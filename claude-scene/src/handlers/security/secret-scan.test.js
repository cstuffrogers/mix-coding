import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { handleGitLeaks } from './secret-scan.js';

// 这个文件固化「历史上删掉的密钥还能不能扫出来」。
// 真实事故：codewhale-config.toml 里的 sk- key 被改成了占位符，
// 但 secret-scan 既没有 sk- 的规则，也把该文件放进了 SAFE_FILES 白名单，
// 于是「已经泄露、必须轮换」这件事一直报「未发现明文密钥」。
// 分段拼出来，避免本仓库自己的密钥扫描把测试夹具当成真 key。
const KEY_BODY = 'A1b2C3d4E5f6G7h8I9j0K1l2abcdefghijklmnop';
const FAKE_KEY = ['sk', KEY_BODY].join('-');

function git(root, args) {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- 测试里固定调用 git
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

function initRepo(root) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
}

describe('handleGitLeaks', () => {
  let root;
  let logged;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gitleaks-'));
    logged = [];
    vi.spyOn(console, 'log').mockImplementation(line => { logged.push(String(line)); });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('HEAD 树里有明文密钥 → 报「当前仍是明文」并置 gitLeaksPassed=false', async () => {
    initRepo(root);
    // 用真实事故里的文件名：它曾经在 SAFE_FILES 白名单里，于是模板里写回真 key 也报不出来
    writeFileSync(join(root, 'codewhale-config.toml'), `api_key = "${FAKE_KEY}"\n`);
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'add key']);

    const context = {};
    const msg = handleGitLeaks('git-leaks', {}, root, context);

    expect(msg).toContain('当前 1 个文件仍是明文');
    expect(context.gitLeaksPassed).toBe(false);
    // 「示例/占位文件」白名单不能豁免真实的 key
    expect(logged.join('')).toContain('codewhale-config.toml');
  });

  it('密钥已从工作区删除但仍留在历史里 → 报「仅在历史里」', async () => {
    initRepo(root);
    // 模拟真实形态：初始提交里塞了很多文件，密钥文件排在后面
    writeFileSync(join(root, 'codewhale-config.toml'), `api_key = "${FAKE_KEY}"\n`);
    writeFileSync(join(root, 'README.md'), '# demo\n');
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'initial release, many files']);
    writeFileSync(join(root, 'codewhale-config.toml'), 'api_key = "${CODEWHALE_API_KEY}"\n');
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'sanitize key']);

    const context = {};
    const msg = handleGitLeaks('git-leaks', {}, root, context);

    expect(msg).toContain('1 个文件仅在历史里');
    expect(context.gitLeaksPassed).toBe(false);
    expect(logged.join('')).toContain('codewhale-config.toml');
  });

  it('占位符仓库不误报', async () => {
    initRepo(root);
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'config.toml'), 'api_key = "${MY_API_KEY}"\n');
    writeFileSync(join(root, 'src/app.js'), "const apiKey = process.env.API_KEY;\n");
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'placeholder only']);

    const context = {};
    const msg = handleGitLeaks('git-leaks', {}, root, context);

    expect(msg).toContain('未发现明文密钥');
    expect(context.gitLeaksPassed).toBe(true);
  });

  it('没有 git 仓库 → 明确说明没扫，且不置通过标记', async () => {
    const context = {};
    const msg = handleGitLeaks('git-leaks', {}, root, context);

    expect(msg).toContain('git 不可用');
    expect(context.gitLeaksPassed).toBe(false);
  });

  it('空提交历史不虚构发现', async () => {
    initRepo(root);
    const context = {};
    const msg = handleGitLeaks('git-leaks', {}, root, context);

    expect(msg).toContain('git 不可用');
    expect(context.gitLeaksPassed).toBe(false);
  });
});
