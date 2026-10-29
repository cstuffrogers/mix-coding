import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * 两份 README 里「多少个 action / 多少个 handler 函数 / 多少个 handler 模块」必须和代码一致，
 * 表格里点名的动作与 `前缀-*（N 个）` 的通配计数也必须是真的。
 *
 * 这曾经是纯装饰：README_EN 写「126 actions / 222 handler functions / 41 handler modules」、
 * README.md 写「126 个 action / 41 个 handler 模块 / 222 个 handler 函数 / 27 个工作流」，
 * 实际是 428 / 284 / 70 / 26；那张「Action 处理器完整性」表格清一色 ✅ 却没人核对，
 * 里面躺着 `npm-audit`（其实是 runReview 的规则名）、`state-audit`（源码里根本没有）、
 * `huashu-*（7 个）`（实际 6 个）、`mp-*（10 个）`（实际 14 个）。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-action-stats.cjs');

function run(root) {
  const args = root ? [SCRIPT, root] : [SCRIPT];
  const res = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

const MODULES = 40;
const ACTIONS = 206;
const SCENES = 21;

/** fixture 的注册表：206 个名字 → 206 个不同函数（含 3 个 zz-*、2 个 awm-brand-*、1 个 huashu-*）。 */
function registrySource() {
  const names = [];
  for (let i = 1; i <= 200; i += 1) names.push(`act${i}`);
  for (let i = 1; i <= 3; i += 1) names.push(`zz-${i}`);
  for (let i = 1; i <= 2; i += 1) names.push(`awm-brand-${i}`);
  names.push('huashu-1');
  return [
    `const names = ${JSON.stringify(names)};`,
    'export const ACTION_REGISTRY = Object.fromEntries(names.map((n, i) => [n, () => i]));',
    '',
  ].join('\n');
}

/** 两份 README 的 fixture 文本（表格点名 24 个动作 + 两条通配计数）。 */
function docs({ actions = ACTIONS, functions = ACTIONS, modules = MODULES, workflows = SCENES, ghost = null, wildcard = 3 } = {}) {
  const existing = Array.from({ length: 20 }, (_, i) => `\`act${i + 1}\``).join(' / ');
  const ghostCell = ghost ? ` / \`${ghost}\`` : '';
  const rows = [
    `| ${existing}${ghostCell} | 动作示例 | ✅ |`,
    `| \`zz-*\` (${wildcard}) | 通配组 | ✅ |`,
    `| \`awm-brand-*\` (2) | 品牌导入 | ✅ |`,
  ];
  const zh = [
    '# 项目',
    '',
    '## 🔧 Action 处理器完整性',
    '',
    `系统注册了 **${actions} 个 action 名**（\`ACTION_REGISTRY\` 的键），由 **${modules} 个 handler 模块**`
      + `共 **${functions} 个不同的 handler 函数**实现，覆盖 ${workflows} 个工作流的全部步骤需求。`,
    '',
    '| Action | 用途 | 实现状态 |',
    '|--------|------|---------|',
    ...rows,
    '',
    '---',
    '',
    '## 其他',
    '',
  ].join('\n');
  const en = [
    '# Project',
    '',
    '## 🔧 Action Handler Completeness',
    '',
    `The system registers **${actions} action names**, backed by **${functions} distinct handler functions** `
      + `across **${modules} handler modules**, covering all steps across ${workflows} workflows.`,
    '',
    '| Action | Purpose | Status |',
    '|--------|---------|--------|',
    ...rows,
    '',
    '---',
    '',
    '## Other',
    '',
  ].join('\n');
  return { zh, en };
}

function scaffold(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'action-stats-'));
  mkdirSync(join(dir, 'claude-scene', 'src', 'handlers'), { recursive: true });
  mkdirSync(join(dir, 'claude-scene', 'scenes'), { recursive: true });
  writeFileSync(join(dir, 'claude-scene', 'src', 'actions.js'), registrySource());
  for (let i = 0; i < MODULES; i += 1) {
    writeFileSync(
      join(dir, 'claude-scene', 'src', 'handlers', `mod${i}.js`),
      `export function fn${i}() { return ${i}; }\n`,
    );
  }
  for (let i = 0; i < SCENES; i += 1) {
    writeFileSync(
      join(dir, 'claude-scene', 'scenes', `scene${i}.json`),
      JSON.stringify({ name: `scene${i}`, flow: { 0: { action: 'act1' } } }),
    );
  }
  const text = docs(overrides);
  writeFileSync(join(dir, 'README.md'), overrides.zh ?? text.zh);
  writeFileSync(join(dir, 'README_EN.md'), overrides.en ?? text.en);
  return dir;
}

describe('check-action-stats：README 的动作计数与点名动作', () => {
  it('数字全对 → exit 0，两份文档各自报对得上', () => {
    const { code, out } = run(scaffold());
    expect(code, out).toBe(0);
    expect(out).toContain('✅ README.md');
    expect(out).toContain('✅ README_EN.md');
  });

  it('计数不符 → exit 1，把「写的」和「实际」都写出来', () => {
    const { code, out } = run(scaffold({ actions: 210, functions: 220, modules: 41, workflows: 27 }));
    expect(code).toBe(1);
    expect(out).toContain('actionNames：文档写 210，实际 206');
    expect(out).toContain('handlerFunctions：文档写 220，实际 206');
    expect(out).toContain('handlerModules：文档写 41，实际 40');
    expect(out).toContain('workflows：文档写 27，实际 21');
  });

  it('幽灵动作 → exit 1 并点名（就是 state-audit 那种）', () => {
    const { code, out } = run(scaffold({ ghost: 'state-audit' }));
    expect(code).toBe(1);
    expect(out).toContain('幽灵动作：`state-audit` 标着 ✅，但 ACTION_REGISTRY 里没有这个名字');
  });

  it('通配计数不符 → exit 1 并点名（就是 huashu-*（7 个）那种）', () => {
    const { code, out } = run(scaffold({ wildcard: 7 }));
    expect(code).toBe(1);
    expect(out).toContain('通配计数：`zz-*` 写 7 个，实际 3 个');
  });

  it('段落标题改了 → exit 2（读不到不等于对得上）', () => {
    const dir = scaffold();
    writeFileSync(join(dir, 'README_EN.md'), '# Project\n\n## Somewhere else\n\nno table here\n');
    const { code, out } = run(dir);
    expect(code).toBe(2);
    expect(out).toContain('README_EN.md 里找不到「## 🔧 Action Handler Completeness」段落');
  });

  it('注册表读不到 → exit 2（不许当成 0 个动作）', () => {
    const dir = scaffold();
    writeFileSync(join(dir, 'claude-scene', 'src', 'actions.js'), 'export const NOTHING = {};\n');
    const { code, out } = run(dir);
    expect(code).toBe(2);
    expect(out).toContain('读不到 claude-scene/src/actions.js 的 ACTION_REGISTRY');
    expect(out).toContain('扫描面塌了');
  });

  it('真仓库：两份 README 与代码一致（漂移守卫）', () => {
    const { code, out } = run();
    expect(code, out).toBe(0);
    expect(out).toContain('✅ README.md');
    expect(out).toContain('✅ README_EN.md');
  });

  it('旧数字不许回来：126 actions / 222 handler functions / 41 个 handler 模块', () => {
    const zh = readFileSync(join(ROOT, 'README.md'), 'utf-8');
    const en = readFileSync(join(ROOT, 'README_EN.md'), 'utf-8');
    const stale = [
      '126 actions', '126 个 action', '222 handler functions', '222 个 handler 函数',
      '41 handler modules', '41 个 handler 模块',
    ].filter((needle) => zh.includes(needle) || en.includes(needle));
    expect(stale, `这两组数字是历史的（实际 428 / 284 / 70），不许写回文档：${stale.join(', ')}`).toEqual([]);
  });
});
