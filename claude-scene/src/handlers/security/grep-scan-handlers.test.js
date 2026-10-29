import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 第十一轮：「grep 没跑起来」不许写进门禁旗标。
// 这两个 handler 以前都是 `const findings = [...scanX(), ...]`，然后
// `context.xxxPassed = findings.length === 0` —— 而 scanX 内部用 `|| true` 把
// 「grep 不可用 / 目录不存在」也变成空数组，于是没查过的项目报「✓ 安全」。
const { mockGrepScan } = vi.hoisted(() => ({ mockGrepScan: vi.fn() }));
vi.mock('../../lib/grep-scan.js', () => ({ grepScan: mockGrepScan }));

const { handleEnvVarLeak } = await import('./config-check.js');
const { handleSensitiveFileCheck } = await import('./secret-scan.js');

let root;
beforeEach(() => {
  // 这两个 handler 还有基于 readFileSync/existsSync 的旁路检查（.gitignore 等），
  // 所以给一个干净的临时目录，只让 grepScan 这一个变量可控。
  root = mkdtempSync(join(tmpdir(), 'grep-scan-'));
  // 敏感文件检查还会查 .gitignore 规则，缺规则本身算一条发现 —— 先满足它
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.env\n*.pem\n*.key\ncredentials.json\n');
  mockGrepScan.mockReset();
  mockGrepScan.mockReturnValue({ ok: true, raw: '' });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('handleEnvVarLeak：没查过 ≠ 安全', () => {
  it('两个 grep 都跑成、零发现 → 通过', () => {
    const context = {};
    const result = handleEnvVarLeak('env-var-leak', {}, root, context);
    // 契约变更（第十八轮）：返回值从裸字符串改成 {status,message}。
    // 「安全」这个结论写在返回值里，不再靠引擎猜。
    expect(result.status).toBe('pass');
    expect(result.message).toContain('安全');
    expect(context.envVarLeakPassed).toBe(true);
  });

  it('真扫出泄露 → 失败，且指出数量', () => {
    mockGrepScan
      .mockReturnValueOnce({ ok: true, raw: 'src/a.js:3:import.meta.env.SECRET_KEY' })
      .mockReturnValueOnce({ ok: true, raw: '' });
    const context = {};
    const result = handleEnvVarLeak('env-var-leak', {}, root, context);
    // 有泄露 = 安全类发现 → fail（不是「完成: 1 处风险」的 pass）
    expect(result.status).toBe('fail');
    expect(result.message).toContain('1 处风险');
    expect(context.envVarLeakPassed).toBe(false);
  });

  it('grep 没跑起来且零发现 → skip，不写 verdict', () => {
    mockGrepScan.mockReturnValue({ ok: false, raw: '', reason: 'grep: command not found' });
    const context = {};
    const result = handleEnvVarLeak('env-var-leak', {}, root, context);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('未完成');
    expect(result.message).toContain('不是通过');
    expect(context.envVarLeakPassed).toBeUndefined();
  });

  it('一侧没跑成、另一侧真扫出问题 → 仍算失败（不因为工具坏了放过真问题）', () => {
    mockGrepScan
      .mockReturnValueOnce({ ok: false, raw: '', reason: 'boom' })
      .mockReturnValueOnce({ ok: true, raw: 'src/a.jsx:9:process.env.SECRET_TOKEN' });
    const context = {};
    const result = handleEnvVarLeak('env-var-leak', {}, root, context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('1 处风险');
    expect(context.envVarLeakPassed).toBe(false);
  });
});

describe('handleSensitiveFileCheck：git 不可用不是「没有敏感文件」', () => {
  it('git 可用且零命中 → 通过', () => {
    const context = {};
    const result = handleSensitiveFileCheck('sensitive-file', {}, root, context);
    expect(String(result)).toContain('安全');
    expect(context.sensitiveFilePassed).toBe(true);
  });

  it('git 命中被追踪的 .env → 失败', () => {
    mockGrepScan.mockReturnValue({ ok: true, raw: '.env' });
    const context = {};
    const result = handleSensitiveFileCheck('sensitive-file', {}, root, context);
    // 敏感文件被 Git 追踪 = 安全类发现 → fail
    expect(result.status).toBe('fail');
    expect(result.message).toContain('处风险');
    expect(context.sensitiveFilePassed).toBe(false);
  });

  it('git 不可用 → skip，不写 sensitiveFilePassed', () => {
    mockGrepScan.mockReturnValue({ ok: false, raw: '', reason: 'not a git repository' });
    const context = {};
    const result = handleSensitiveFileCheck('sensitive-file', {}, root, context);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('git 不可用');
    expect(context.sensitiveFilePassed).toBeUndefined();
  });
});
