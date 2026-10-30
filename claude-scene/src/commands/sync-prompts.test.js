import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST, RETIRED_PROMPTS, SRC_FLOOR, syncPrompts } from '../../../scripts/sync-prompts.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'sync-prompts.mjs');

/**
 * `scripts/sync-prompts.mjs` 是「安装器会收敛」这句话的唯一执行者。
 *
 * 它之前不存在，于是仓库里退役掉的 `/hunt` 在用户机上活了一整年：安装器只**拷**不**删**，
 * 两个数字（源 33 / 目标 34）打印出来没人看。这里把它的三类行为钉住：
 *
 *   1. 该写的写（缺的、内容变了的；CRLF ≠ 漂移）；
 *   2. 该删的删（上一轮自己装过、这次源里没了；以及没有清单的老安装里的退役名）；
 *   3. **不该删的绝对不删** —— 用户在同一目录里自己写的模板，既不在清单也不在退役名单，
 *      必须留下。这条是这个脚本存在的最大风险，所以单独设断言；
 *   4. 源目录读崩时一个字节都不动（路径给错不能把用户的模板目录抹光）。
 */

let root;

function write(dir, name, text) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), text);
}

/** 源目录的假仓库：12 个模板（下限 10 之上，留出删减余地）。 */
function seedSrc(count = 12) {
  const src = join(root, 'src');
  for (let i = 1; i <= count; i += 1) write(src, `p${String(i).padStart(2, '0')}.md`, `# prompt ${i}\n`);
  return src;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sync-prompts-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('syncPrompts', () => {
  it('空目标目录：把源全部写过去，并留下清单', () => {
    const src = seedSrc();
    const dst = join(root, 'dst');
    const result = syncPrompts({ src, dst });
    expect(result.written).toHaveLength(12);
    expect(result.unchanged).toEqual([]);
    expect(result.pruned).toEqual([]);
    expect(readdirSync(join(dst)).filter((n) => n.endsWith('.md'))).toHaveLength(12);
    const manifest = JSON.parse(readFileSync(join(dst, MANIFEST), 'utf-8'));
    expect(manifest.installed).toHaveLength(12);
  });

  it('内容相同就不动 —— CRLF 不算漂移', () => {
    const src = seedSrc();
    const dst = join(root, 'dst');
    syncPrompts({ src, dst });
    // 目标改成 CRLF，内容等价
    write(dst, 'p01.md', '# prompt 1\n'.replace('\n', '\r\n'));
    const again = syncPrompts({ src, dst });
    expect(again.written).toEqual([]);
    expect(again.unchanged).toHaveLength(12);
  });

  it('内容变了就更新', () => {
    const src = seedSrc();
    const dst = join(root, 'dst');
    syncPrompts({ src, dst });
    write(dst, 'p03.md', '# 旧内容\n');
    const again = syncPrompts({ src, dst });
    expect(again.written).toEqual(['p03.md']);
    expect(readFileSync(join(dst, 'p03.md'), 'utf-8')).toBe('# prompt 3\n');
  });

  it('清单里记过、这次源里没了 → 删掉（仓库退役的名字必须收敛）', () => {
    const src = seedSrc(11);
    const dst = join(root, 'dst');
    write(dst, 'p12.md', '# prompt 12\n');
    write(dst, MANIFEST, JSON.stringify({ installed: ['p12.md'] }));
    const result = syncPrompts({ src, dst });
    expect(result.pruned).toEqual(['p12.md']);
    expect(existsSync(join(dst, 'p12.md'))).toBe(false);
  });

  it('没有清单的老安装：退役名照样清掉', () => {
    const src = seedSrc();
    const dst = join(root, 'dst');
    const retired = RETIRED_PROMPTS.find((n) => !existsSync(join(src, `${n}.md`))) ?? RETIRED_PROMPTS[0];
    write(dst, `${retired}.md`, '# 退役命令\n');
    const result = syncPrompts({ src, dst });
    expect(result.pruned).toEqual([`${retired}.md`]);
    expect(existsSync(join(dst, `${retired}.md`))).toBe(false);
  });

  it('**用户自己的模板既不在清单也不在退役名单 —— 必须留着**', () => {
    const src = seedSrc();
    const dst = join(root, 'dst');
    write(dst, 'my-own-prompt.md', '# 我自己写的\n');
    syncPrompts({ src, dst });
    const again = syncPrompts({ src, dst });
    expect(again.kept).toEqual(['my-own-prompt.md']);
    expect(readFileSync(join(dst, 'my-own-prompt.md'), 'utf-8')).toBe('# 我自己写的\n');
  });

  it('--dry-run 一个字节都不动（连清单都不写）', () => {
    const src = seedSrc(11);
    const dst = join(root, 'dst');
    write(dst, 'stale.md', 'x\n');
    write(dst, MANIFEST, JSON.stringify({ installed: ['stale.md'] }));
    const result = syncPrompts({ src, dst, dryRun: true });
    expect(result.written).toHaveLength(11);
    expect(result.pruned).toEqual(['stale.md']);
    expect(readdirSync(dst).filter((n) => n.endsWith('.md'))).toEqual(['stale.md']);
    const manifest = JSON.parse(readFileSync(join(dst, MANIFEST), 'utf-8'));
    expect(manifest.installed).toEqual(['stale.md']);
  });

  it('源目录读不到下限 → 抛错，且目标目录原封不动（路径给错不能抹光用户模板）', () => {
    const src = seedSrc(3);
    const dst = join(root, 'dst');
    write(dst, 'keep-me.md', 'y\n');
    expect(() => syncPrompts({ src, dst })).toThrow(floorHint());
    expect(readdirSync(dst)).toEqual(['keep-me.md']);
    // 不存在也要报错，而不是「0 个文件、全部删除」这种通过
    expect(() => syncPrompts({ src: join(root, 'nope'), dst })).toThrow(floorHint());
    expect(readdirSync(dst)).toEqual(['keep-me.md']);
  });

  it('下限本身不许被调到 0（否则上面那条安全阀是空的）', () => {
    expect(SRC_FLOOR).toBeGreaterThanOrEqual(10);
  });
});

/**
 * `--check` 是给安装器当判据用的：**只看退出码**。
 * 两个安装器（`install-global.sh` / `install-percho.bat`）一个是 sh、一个是**没有 chcp** 的
 * GBK 批处理 —— 后者读不了中文输出。所以这个模式只打 ASCII、用退出码报结论；
 * 谁把它改回中文解析，这两条断言先红。
 */
describe('CLI --check', () => {
  function run(...args) {
    const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 60_000 });
    return { code: res.status, out: `${res.stdout}${res.stderr}` };
  }

  it('一致时退出 0，且输出是 ASCII（GBK 批处理能读）', () => {
    const src = seedSrc();
    const dst = join(root, 'dst');
    syncPrompts({ src, dst });
    const res = run('--src', src, '--dst', dst, '--check');
    expect(res.code).toBe(0);
    expect(res.out).toContain('to-write=0');
    expect(res.out).toContain('to-prune=0');
    const nonAscii = [...res.out].filter((ch) => (ch.codePointAt(0) ?? 0) > 127);
    expect(nonAscii).toEqual([]);
  });

  it('有漂移或退役残留时退出 1，并点名是哪一个', () => {
    const src = seedSrc(11);
    const dst = join(root, 'dst');
    syncPrompts({ src, dst });
    write(dst, 'hunt.md', '# 退役');
    rmSync(join(dst, 'p05.md'));
    const res = run('--src', src, '--dst', dst, '--check');
    expect(res.code).toBe(1);
    expect(res.out).toContain('to-write=1');
    expect(res.out).toContain('to-prune=1');
    expect(res.out).toContain('to-write: p05.md');
    expect(res.out).toContain('to-prune: hunt.md');
    // --check 不得改任何东西
    expect(existsSync(join(dst, 'hunt.md'))).toBe(true);
    expect(existsSync(join(dst, 'p05.md'))).toBe(false);
  });

  it('源路径给错时退出 1，不报「一致」', () => {
    const dst = join(root, 'dst');
    write(dst, 'keep-me.md', 'y\n');
    const res = run('--src', join(root, 'nope'), '--dst', dst, '--check');
    expect(res.code).toBe(1);
    expect(res.out).toContain(`下限 ${SRC_FLOOR}`);
    expect(readdirSync(dst)).toEqual(['keep-me.md']);
  });
});

/** 只核错因里的下限数字，不核整句中文（文案会改）。 */
function floorHint() {
  return new RegExp(`下限 ${SRC_FLOOR}`);
}
