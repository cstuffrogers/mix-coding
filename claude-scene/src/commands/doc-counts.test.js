import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * 两份 README 与 CLAUDE.md 里「数得出来」的数字，必须和仓库一致。
 *
 * 这些数字曾经全都不对，而且没有任何东西会红：CLAUDE.md 写「25 个场景」（实际 26）、
 * README「37 个 .md」（实际 33）、「Skills 24 个」（实际 29）、「MCP 服务器 16 个，.mcp.json」
 * （实际 3 个）、「85+ 个外部组件：24 + 16 + 24 + 28」（加起来 92，且每一项都不对）、
 * 「集成 GitHub 项目（27 个）」（名单里 30 个）。
 *
 * 第三十二轮改了两处**契约**（不是为了让测试变绿，是因为旧判据本身是错的）：
 *   1. 正文清单那一行改名为「外部安全工具链」—— 它跟「外部工具（按类型）」是两个概念，
 *      同名会让人以为 33 和 28 是同一个数字的两种说法。
 *   2. 「外部组件」算式的第 4 项改为**按类型表的 Count 列之和**（安装清单 28 个），
 *      不再是正文清单的 33 个 —— 否则同一份文档里两个「外部工具数」各自成立。
 *      夹具因此也必须让第 4 项等于按类型表之和，否则它测的是旧判据。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-doc-counts.cjs');

function run(root) {
  const args = root ? [SCRIPT, root] : [SCRIPT];
  const res = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

const N = { commands: 26, scenes: 26, core: 14, speckit: 11, mcpActive: 3, mcpFull: 5, deps: 20, devDeps: 4, tools: 12, rows: 3 };
const skills = N.core + N.speckit;
const npm = N.deps + N.devDeps;
const listed = 4; // 3 启用的 + filesystem（明说的参考条目）
const names = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const slash = (list) => list.join(' / ');

function toolRows() {
  return [
    '| **type-a** | 1 | `ta1` | pip |',
    '| **type-b** | 1 | `tb1` | brew |',
    '| **type-c** | 1 | `tc1` | npx |',
  ].join('\n');
}

function mcpTable() {
  const cells = [...names('mcp', N.mcpActive), 'filesystem'].map((s) => `| \`${s}\` | x |`);
  return ['| Server | Purpose |', '|---|---|', ...cells].join('\n');
}

function docs(over = {}) {
  const o = { ...N, ...over };
  const toolList = names('tool', o.tools);
  const repos = names('owner/repo', o.rows);
  // 第 4 项取按类型表的 Count 列之和（fixture 里 = o.byType ?? o.rows），不是正文清单的条数
  const partTools = o.componentsTools ?? o.byType ?? o.rows;
  const components = (o.componentsTotal ?? skills + o.mcpActive + npm + partTools);
  const en = [
    '# Project',
    '',
    `│   ├── commands/             # Slash commands (${o.commands} .md files: ${o.scenes} workflows + 0 others)`,
    `│   ├── skills/               # Claude Skills (${o.skills ?? skills}: ${o.core} core + ${o.speckit} speckit)`,
    '',
    `- ✅ **External security toolchain**: ${o.declaredTools ?? o.tools} tools (${slash(toolList)})`,
    '',
    `> **${components} external components, each counted**: ${o.skills ?? skills} local skills + ${o.mcpActive} active MCP servers + ${o.npm ?? npm} npm packages + ${partTools} external tools`,
    '',
    `### Local Skills (${o.localSkills ?? skills}, \`.claude/skills/\`)`,
    '',
    `### MCP Servers (${o.mcpActive} active in \`.mcp.json\`, ${o.mcpFull} in \`.mcp.json.full\`, ${o.listed ?? listed} listed below)`,
    '',
    mcpTable(),
    '',
    `### npm Packages (${o.npm ?? npm}, \`claude-scene/package.json\`)`,
    '',
    `**devDependencies (${o.devDeps})**: a, b`,
    '',
    `**dependencies (${o.deps})**: c, d`,
    '',
    `### External Tools (${o.byType ?? o.rows}, by type)`,
    '',
    toolRows(),
    '',
    `### Integrated GitHub Projects (${o.repos ?? o.rows})`,
    '',
    repos.map((r) => `\`${r}\``).join(' · '),
    '',
    '---',
    '',
    '# end',
    '',
  ].join('\n');

  const zh = [
    '# 项目',
    '',
    `│   ├── commands/             # Slash commands（${o.commands} 个 .md：${o.scenes} 个工作流 + 0 个非场景命令）`,
    `│   ├── skills/               # Claude Skills（${o.skills ?? skills} 个：${o.core} 个通用 + ${o.speckit} 个 speckit）`,
    '',
    `- ✅ **外部安全工具链**：${o.declaredTools ?? o.tools} 个工具（${toolList.join(' / ')}）`,
    '',
    `> 共集成 **${components} 个外部组件，每一类都数得出来**：本地 Skills ${o.skills ?? skills} 个 + 启用的 MCP ${o.mcpActive} 个 + npm 包 ${o.npm ?? npm} 个 + 外部工具 ${partTools} 个`,
    '',
    `### 本地 Skills（${o.localSkills ?? skills} 个，\`.claude/skills/\`）`,
    '',
    `### MCP 服务器（\`.mcp.json\` 启用 ${o.mcpActive} 个，\`.mcp.json.full\` ${o.mcpFull} 个，下表列 ${o.listed ?? listed} 个）`,
    '',
    mcpTable(),
    '',
    `### npm 包（${o.npm ?? npm} 个，\`claude-scene/package.json\`）`,
    '',
    `**devDependencies（${o.devDeps}）**：a、b`,
    '',
    `**dependencies（${o.deps}）**：c、d`,
    '',
    `### 外部工具（${o.byType ?? o.rows} 个，按类型）`,
    '',
    toolRows(),
    '',
    `### 集成 GitHub 项目（${o.repos ?? o.rows} 个）`,
    '',
    repos.map((r) => `\`${r}\``).join(' · '),
    '',
    '---',
    '',
    '# end',
    '',
  ].join('\n');

  return { en: o.en ?? en, zh: o.zh ?? zh };
}

/** 造一份「所有数字都对」的仓库骨架，overrides 用来单独弄错某一项。 */
function scaffold(over = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'doc-counts-'));
  mkdirSync(join(dir, '.claude', 'commands'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(dir, 'claude-scene', 'scenes'), { recursive: true });

  for (const n of names('cmd', N.commands)) writeFileSync(join(dir, '.claude', 'commands', `${n}.md`), '# cmd\n');
  for (const n of names('scene', over.sceneFiles ?? N.scenes)) writeFileSync(join(dir, 'claude-scene', 'scenes', `${n}.json`), '{}');
  for (const n of names('core', N.core)) mkdirSync(join(dir, '.claude', 'skills', n));
  for (const n of names('speckit-', N.speckit)) mkdirSync(join(dir, '.claude', 'skills', n));

  const pkg = {
    dependencies: Object.fromEntries(names('d', N.deps).map((n) => [n, '1.0.0'])),
    devDependencies: Object.fromEntries(names('v', N.devDeps).map((n) => [n, '1.0.0'])),
  };
  writeFileSync(join(dir, 'claude-scene', 'package.json'), JSON.stringify(pkg));

  const mcp = (k) => JSON.stringify({ mcpServers: Object.fromEntries(names('mcp', k).map((n) => [n, {}])) });
  writeFileSync(join(dir, '.mcp.json'), mcp(N.mcpActive));
  writeFileSync(join(dir, '.mcp.json.full'), mcp(N.mcpFull));

  const text = docs(over);
  writeFileSync(join(dir, 'README.md'), text.zh);
  writeFileSync(join(dir, 'README_EN.md'), text.en);
  writeFileSync(join(dir, 'CLAUDE.md'), `Scene 引擎在对话内执行工作流。${over.claudeScenes ?? N.scenes} 个场景。\n`);
  return dir;
}

/** 只改 fixture 里的一份文档，模拟某一行漂移。 */
function patchDoc(over, target = 'README.md') {
  const dir = scaffold(over);
  const text = docs(over);
  writeFileSync(join(dir, target), target === 'README.md' ? text.zh : text.en);
  return dir;
}

describe('check-doc-counts：README/CLAUDE.md 里数得出来的数字', () => {
  it('全部对得上 → exit 0，三份文档各报一句', () => {
    const { code, out } = run(scaffold());
    expect(code, out).toBe(0);
    expect(out).toContain('✅ README.md');
    expect(out).toContain('✅ README_EN.md');
    expect(out).toContain('✅ CLAUDE.md');
  });

  const drift = [
    ['CLAUDE.md 场景数少写一个', { claudeScenes: N.scenes - 1 }, 'CLAUDE.md 场景数：文档写 25，实际 26'],
    ['命令数写成 37', { commands: 37 }, '命令数：文档写 37，实际 26'],
    ['Skills 与 core 数都写老', { skills: 24, core: 13, localSkills: 24 }, 'Skills 总数：文档写 24，实际 25'],
    ['MCP 启用数写成 16', { mcpActive: 16 }, '启用的 MCP 数：文档写 16，实际 3'],
    ['npm 包数写成 19', { npm: 19 }, 'npm 包总数：文档写 19，实际 24'],
    ['GitHub 项目数写老', { repos: N.rows + 3 }, '集成 GitHub 项目数'],
    ['外部组件总数与自己列的四项不符', { componentsTotal: 92 }, '外部组件总数：文档写 92'],
    ['外部组件里的工具数与按类型表不符', { componentsTools: N.rows + 2 }, '外部组件第 4 项'],
    ['外部安全工具链清单声明数与点名数不符', { declaredTools: N.tools + 1 }, '外部安全工具链清单个数：文档写 13，实际 12'],
  ];

  for (const [title, over, needle] of drift) {
    it(`${title} → exit 1 并点名`, () => {
      const { code, out } = run(patchDoc(over));
      expect(code, out).toBe(1);
      expect(out).toContain(needle);
    });
  }

  it('幽灵 MCP 服务器（既没启用也不在完整档、也没说是参考）→ exit 1 并点名', () => {
    const dir = scaffold();
    const doc = readFileSync(join(dir, 'README_EN.md'), 'utf8');
    writeFileSync(join(dir, 'README_EN.md'), doc.replace('| `mcp3` | x |', '| `stripe-mcp` | x |'));
    const { code, out } = run(dir);
    expect(code, out).toBe(1);
    expect(out).toContain('幽灵 MCP 服务器：`stripe-mcp`');
  });

  it('句子被改写认不出来 → exit 2（读不到不等于对得上）', () => {
    const dir = scaffold();
    writeFileSync(join(dir, 'README_EN.md'), '# Project\n\nnothing to count here\n');
    const { code, out } = run(dir);
    expect(code, out).toBe(2);
    expect(out).toContain('扫描面塌了');
  });

  it('场景太少（塌面）→ exit 2', () => {
    const { code, out } = run(scaffold({ scenes: 5, sceneFiles: 5 }));
    expect(code, out).toBe(2);
    expect(out).toContain('只读到 5 个场景（下限 20）');
  });

  it('真仓库：三份文档都对得上（漂移守卫）', () => {
    const { code, out } = run();
    expect(code, out).toBe(0);
    expect(out).toContain('✅ README.md');
    expect(out).toContain('✅ README_EN.md');
    expect(out).toContain('✅ CLAUDE.md');
  });

  it('switch-mcp.cjs 不许再写死 MCP 个数', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'switch-mcp.cjs'), 'utf8');
    const hardcoded = ['4 个 MCP', '14 个 MCP', '(4 active servers)', '4 MCPs'].filter((n) => src.includes(n));
    expect(hardcoded, `MCP 个数必须从文件里数出来，不许写死：${hardcoded.join(', ')}`).toEqual([]);
  });
});
