import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `scripts/check-tool-steps.cjs` —— README 外部工具表「负责工作流」列的真值校验器。
 *
 * 改前实测（第 27 轮）：这张表写着 `/review` (step 4.10) / (step 4.12) / (step 4.15) / (step 3)，
 * 而 `review.json` 的 `flow` 里根本没有这些 step；还有整列指向 `/audit` `/hunt` `/e2e`
 * 这些**已经删掉的场景**。校验器必须能把这类假引用判红，而不是「表里有 step 就当通过」。
 *
 * 三态：干净 → 0；有假引用 → 1；扫不到东西（表/引用格式变了）→ 2。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-tool-steps.cjs');

const SCENES = {
  review: { flow: { a: { step: 1, action: 'listPullRequests' }, b: { step: 2.5, action: 'huashu-expert-review' } } },
  release: { flow: { x: { step: 8.5, action: 'build-leak-check' } } },
};

function scaffold({ rows = 15, workflows = '`/review` (step 1), `/release` (step 8.5)', override = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tool-steps-'));
  mkdirSync(join(dir, 'claude-scene', 'scenes'), { recursive: true });
  for (const [name, body] of Object.entries(SCENES)) {
    writeFileSync(join(dir, 'claude-scene', 'scenes', `${name}.json`), JSON.stringify(body));
  }
  const body = Array.from({ length: rows }, (_, i) => {
    const tool = `tool-${i}`;
    const cell = override[tool] ?? workflows;
    return `| **${tool}** | npm CLI | ${cell} | 功能 ${i} | — |`;
  });
  const table = ['| 工具 | 类型 | 负责工作流 | 功能 | 阻断级别 |', '|---|---|---|---|---|', ...body].join('\n');
  writeFileSync(join(dir, 'README.md'), `# fixture\n\n${table}\n`);
  // 另外两份被校验的文档：存在但没有工具表也算「没东西可查」，不允许 exit 2
  writeFileSync(join(dir, 'README_EN.md'), '# fixture\n');
  mkdirSync(join(dir, '.claude', 'rules', 'conditional'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'rules', 'conditional', 'security-toolchain.md'), '# fixture\n');
  return dir;
}

function run(dir) {
  const res = spawnSync(process.execPath, [SCRIPT, dir], { cwd: ROOT, encoding: 'utf8', timeout: 30_000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

describe('check-tool-steps：工具表的卡片引用必须是真的', () => {
  it('全部对得上 → exit 0，并打印真值（行数 / 引用数 / 场景数）', () => {
    const { code, out } = run(scaffold());
    expect(code, out).toBe(0);
    expect(out).toContain('[真值]');
    expect(out).toContain('工具表 15 行');
    expect(out).toContain('可核引用 30 处');
    expect(out).toContain('场景 2 个');
  });

  it('指向已退役的场景（/audit /hunt /e2e）→ exit 1', () => {
    const dir = scaffold({ override: { 'tool-3': '`/audit` (step 1)' } });
    const { code, out } = run(dir);
    expect(code, out).toBe(1);
    expect(out).toContain('[FAIL]');
    expect(out).toContain('已退役的场景 /audit');
    expect(out).toContain('README.md:');
  });

  it('指向不存在的场景 → exit 1（点名文件名和缺失的 json）', () => {
    const { code, out } = run(scaffold({ override: { 'tool-0': '`/nope`' } }));
    expect(code, out).toBe(1);
    expect(out).toContain('不存在的场景 /nope');
    expect(out).toContain('claude-scene/scenes/nope.json');
  });

  it('步骤号编的（场景在、step 不在）→ exit 1，并把真实 step 列出来', () => {
    const { code, out } = run(scaffold({ override: { 'tool-7': '`/review` (step 9.9)' } }));
    expect(code, out).toBe(1);
    expect(out).toContain('/review (step 9.9)');
    expect(out).toContain('没有这个 step');
    expect(out).toContain('真实值：1, 2.5');
  });

  it('不写 step 也算可核引用（场景存在即可）', () => {
    const { code, out } = run(scaffold({ rows: 25, workflows: '`/review`' }));
    expect(code, out).toBe(0);
    expect(out).toContain('可核引用 25 处');
  });

  it('表行数不足 → exit 2（认错表时不许假装通过）', () => {
    const { code, out } = run(scaffold({ rows: 5, workflows: '`/review` (step 1)' }));
    expect(code, out).toBe(2);
    expect(out).toContain('下限 15');
  });

  it('行数够但可核引用太少 → exit 2（引用格式变了）', () => {
    const { code, out } = run(scaffold({ workflows: '`/review` (step 1)' }));
    expect(code, out).toBe(2);
    expect(out).toContain('下限 20');
  });

  it('没有 scenes 目录 → exit 2（真值来源不存在）', () => {
    const dir = scaffold();
    const res = spawnSync(process.execPath, [SCRIPT, join(dir, 'nope')], { cwd: ROOT, encoding: 'utf8' });
    expect(res.status).toBe(2);
    expect(`${res.stdout}${res.stderr}`).toContain('找不到场景 JSON');
  });

  it('真仓库自己必须干净（本文件不是只在 fixture 里过）', () => {
    const { code, out } = run(ROOT);
    expect(code, out).toBe(0);
    expect(out).toContain('全部对得上');
  });
});
