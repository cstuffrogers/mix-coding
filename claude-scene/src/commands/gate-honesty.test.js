import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ── 门禁自己的诚实性 ──
//
// 第二十一轮那次提交带着 3 个失败测试落地了：`.husky/pre-commit` 没有 set -e，
// 收尾还是 `npm run scan:deadcode 2>/dev/null || true` —— 最后一条命令永远返回 0，
// 整段脚本退出码恒为 0。而 `scripts/find-deadcode-full.cjs` 算出 totalDead 就只打印，
// 压根没设退出码：扫描器「跑完了」被当成「扫干净了」。
//
// 这组测试盯的就是这两处：门禁命令失败必须拦住，扫描器的结论必须能变成退出码。

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HOOK = join(ROOT, '.husky', 'pre-commit');
const SCANNER = join(ROOT, 'scripts', 'find-deadcode-full.cjs');
// eslint-disable-next-line sonarjs/no-os-command-from-path -- 命令是固定的 sh，PATH 只用来注入替身
const hasSh = spawnSync('sh', ['-c', 'exit 0'], { encoding: 'utf8' }).status === 0;

function hookLines() {
  return readFileSync(HOOK, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/** 造一组替身 npm / npx：`failing` 里的名字返回 1，其余返回 0。 */
function stubBin(failing) {
  const bin = mkdtempSync(join(tmpdir(), 'hook-stub-'));
  for (const name of ['npx', 'npm']) {
    const code = failing.includes(name) ? 1 : 0;
    const file = join(bin, name);
    writeFileSync(file, `#!/bin/sh\necho "[stub ${name}] exit ${code}" >&2\nexit ${code}\n`);
    chmodSync(file, 0o755);
  }
  return bin;
}

/**
 * 跑门禁。`indexFile` 是给 `GIT_INDEX_FILE` 用的**替身暂存区**：
 * 第四道现在按「本次提交动了什么」判断，若不隔离，测试就会读宿主真实的暂存区 ——
 * 真实的提交过程本身就在跑这些测试，于是「谁刚好 staged 了场景文件」会决定测试红绿。
 * 缺省给一个不存在的路径：等于空暂存区 → 第四道走「没碰场景文件」分支。
 */
function runHook(failing, indexFile = join(tmpdir(), 'hook-index-absent')) {
  const bin = stubBin(failing);
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- 固定的 sh + 常量路径的脚本，PATH 前缀是测试替身目录
    const r = spawnSync('sh', [HOOK], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, PATH: bin + ':' + process.env.PATH, GIT_INDEX_FILE: indexFile },
      timeout: 20_000,
    });
    return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

/** 造一份「改了场景文件、但没提 scenes-stats.json」的替身暂存区（不碰真实 index 与工作区）。 */
function stagedSceneEditIndex() {
  const dir = mkdtempSync(join(tmpdir(), 'hook-index-'));
  const indexFile = join(dir, 'index');
  copyFileSync(join(ROOT, '.git', 'index'), indexFile);
  // 不用展开 process.env：git 只需要多一个 GIT_INDEX_FILE，用 Object.assign 拼，
  // 免得踩上「把 PATH 交出去」的告警（那告警这里本来也不成立）。
  const env = Object.assign({}, process.env, { GIT_INDEX_FILE: indexFile });
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- env 只多带一个 GIT_INDEX_FILE，PATH 是宿主原值
  const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: ROOT, encoding: 'utf8', env, input: '{"scene":"probe","steps":[]}' + String.fromCodePoint(10),
  });
  const sha = (blob.stdout || '').trim();
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- env 只多带一个 GIT_INDEX_FILE，PATH 是宿主原值
  spawnSync('git', ['update-index', '--cacheinfo', `100644,${sha},claude-scene/scenes/review.json`], {
    cwd: ROOT, encoding: 'utf8', env,
  });
  return { dir, indexFile };
}

function mkFixture(extra) {
  const root = mkdtempSync(join(tmpdir(), 'deadcode-probe-'));
  const names = [];
  const write = (rel, body) => {
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  };

  // 40 个 handler：内容里不能出现自己的文件名，否则 isReferenced 自己就命中了
  for (let i = 0; i < 40; i += 1) {
    write(`claude-scene/src/handlers/live-${i}.js`, 'export const value = 1;\n');
    names.push(`live-${i}`);
  }
  for (let i = 0; i < 15; i += 1) {
    write(`.claude/scenes/s${i}.json`, '{"steps":[]}\n');
    names.push(`s${i}`);
  }
  for (let i = 0; i < 15; i += 1) {
    write(`.claude/commands/c${i}.md`, '# cmd\n');
    names.push(`c${i}`);
  }
  for (let i = 0; i < 10; i += 1) {
    write(`.claude/skills/sk${i}/SKILL.md`, '# skill\n');
    names.push(`sk${i}`);
  }
  // refs.md 自己也是一条 command，所以也得被引用（写下自己的名字）
  write('.claude/commands/refs.md', `refs ${names.join(' ')}\n`);
  if (extra) write(`claude-scene/src/handlers/${extra}.js`, 'export const value = 2;\n');
  return root;
}

function runScanner(root) {
  const r = spawnSync(process.execPath, [SCANNER, root], { encoding: 'utf8', cwd: ROOT, timeout: 60_000 });
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

describe('pre-commit 门禁：失败必须拦住提交', () => {
  it('脚本开了 set -e，且没有任何吞错的写法', () => {
    const lines = hookLines();
    // 只看真正会执行的命令行：注释里写着「以前是 `|| true`」不算违规。
    const code = lines.join(String.fromCodePoint(10));
    expect(lines).toContain('set -e');
    expect(code).not.toContain('|| true');
    expect(code).not.toContain('set +e');
    expect(code).not.toContain('2>/dev/null');
  });

  // 第 28 轮加了第四道（scenes-stats.json 同步），所以这里的 x/3 全部改成 x/4。
  it('四道门禁都在：claude-scene eslint / vitest / 死代码扫描 / 场景统计同步', () => {
    const lines = hookLines();
    const joined = lines.join('\n');
    expect(joined).toContain('npx eslint . --max-warnings 0');
    expect(joined).toContain('npm test');
    expect(joined).toContain('npm run scan:deadcode');
    expect(joined, 'stats 必须由门禁重跑，不能指望提交者记得').toContain('node scripts/scan-scenes.cjs');
    expect(joined).toContain('git diff --quiet -- scripts/scenes-stats.json');
    // 判据必须是「本次提交」（--cached），不是「工作区」：后者会把别人的半成品算成你的错。
    expect(joined).toContain('git diff --cached --name-only');
    expect(joined).toContain('claude-scene/scenes/*.json');
  });

  it('每一步都自报名字（事后能核出到底验过什么）', () => {
    const labelled = hookLines().filter((line) => line.startsWith("echo '[pre-commit]"));
    expect(labelled.length).toBeGreaterThanOrEqual(4);
    const tail = hookLines().at(-1);
    expect(tail).toContain('全部通过');
  });

  it('门禁脚本是 LF：CRLF 会让 sh 把 set -e 读成非法选项', () => {
    const raw = readFileSync(HOOK, 'utf-8');
    expect(raw.includes('\r\n')).toBe(false);
    // core.autocrlf=true 的机器上，靠 .gitattributes 保证检出后仍是 LF
    const attrs = readFileSync(join(ROOT, '.gitattributes'), 'utf-8');
    expect(attrs).toContain('.husky/** text eol=lf');
    expect(attrs).toContain('*.sh text eol=lf');
  });

  it.skipIf(!hasSh)('eslint 失败：非零退出，且不再往下跑测试', () => {
    const { status, out } = runHook(['npx']);
    expect(status).not.toBe(0);
    expect(out).toContain('1/4');
    expect(out).not.toContain('2/4');
  });

  it.skipIf(!hasSh)('测试失败：非零退出，且不再往下跑死代码扫描', () => {
    const { status, out } = runHook(['npm']);
    expect(status).not.toBe(0);
    expect(out).toContain('2/4');
    expect(out).not.toContain('3/4');
  });

  it.skipIf(!hasSh)('四道全过才 0，并明确说「全部通过」', () => {
    const { status, out } = runHook([]);
    expect(status).toBe(0);
    expect(out).toContain('4/4');
    expect(out).toContain('全部通过');
  });

  it.skipIf(!hasSh)('本次提交没碰场景文件：第四道明说跳过，不拿工作区的改动判人', () => {
    const { status, out } = runHook([]);
    expect(status).toBe(0);
    expect(out).toContain('跳过这一道');
  });

  it.skipIf(!hasSh)('改了场景文件却没提 scenes-stats.json → 非零退出并点名', () => {
    const { dir, indexFile } = stagedSceneEditIndex();
    try {
      const { status, out } = runHook([], indexFile);
      expect(status).not.toBe(0);
      expect(out).toContain('却没把 scripts/scenes-stats.json 一起提交');
      expect(out).toContain('claude-scene/scenes/review.json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('死代码扫描器：结论要能变成退出码', () => {
  it('扫到死代码 → 退出码 1，并点名是哪个文件', () => {
    const root = mkFixture('dead-one');
    try {
      const { status, out } = runScanner(root);
      expect(status).toBe(1);
      expect(out).toContain('dead-one');
      expect(out).toMatch(/Total dead: [1-9]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('干净的项目 → 退出码 0', () => {
    const root = mkFixture(null);
    try {
      const { status, out } = runScanner(root);
      expect(status).toBe(0);
      expect(out).toContain('Total dead: 0');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('一个都没扫到 → 退出码 2，不许把「路径配错」报成「干净」', () => {
    const root = mkdtempSync(join(tmpdir(), 'deadcode-empty-'));
    try {
      const { status, out } = runScanner(root);
      expect(status).toBe(2);
      expect(out).toContain('扫描面塌了');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
