/**
 * 两份 README 与 CLAUDE.md 里那些「数得出来」的数字，必须和仓库里的真值一致。
 *
 * 用法：node scripts/check-doc-counts.cjs [root]
 *
 * 退出码：
 *   0 = 全部对得上
 *   1 = 有数字对不上（逐条打印「文档写 X，实际 Y」）
 *   2 = 扫描面塌了（文档读不到、关键句子没认出来、数出来的东西少得离谱）—— 结论不可信
 *
 * 这一轮修掉的陈年假数字（都是「写的时候对，之后没人核对」）：
 *   · CLAUDE.md「25 个场景」—— 实际 26
 *   · README「37 个 .md」—— 实际 33（26 个工作流 + 7 个非场景命令）
 *   · README「Skills 24 个 / 13 core」—— 实际 29 / 18
 *   · README「MCP 服务器 16 个，`.mcp.json`」—— `.mcp.json` 里只有 3 个，`.mcp.json.full` 里 14 个
 *   · README「85+ 个外部组件：24 + 16 + 24 + 28」—— 四部分加起来是 92，而且每一部分都不对
 *   · README「集成 GitHub 项目（27 个）」—— 名单里列了 30 个
 *
 * 定义（写进文档、也写在这里，两边必须是同一套）：
 *   工作流数   = claude-scene/scenes/*.json 的个数
 *   命令数     = .claude/commands/*.md 的个数（工作流命令 + 非场景命令）
 *   Skills 数  = .claude/skills/* 目录数（`speckit-` 前缀算 speckit）
 *   MCP 数     = .mcp.json 的 mcpServers 键数（启用）/ .mcp.json.full 的键数（完整档）
 *   npm 包数   = claude-scene/package.json 的 dependencies + devDependencies
 *   工具数     = 正文安全工具链括号里点名的个数；另由 check-toolchain-lists.cjs 核「名字集合」
 *                （本脚本只管「声明数 vs 点名数」，集合是否等于真值归那个脚本）
 *   场景表行数 = `.claude/scenes/README.md` AUTO-SYNC 表里 `| \`id\` |` 的行数
 *                （表由 sync-docs 生成，标题里的数字没有生成器 → 第三十三轮发现写着 27、实际 26）
 *   GitHub 数  = 该段里列出的 `owner/repo` 个数
 *   外部组件数 = Skills + 启用的 MCP + npm 包 + 外部工具（公式写进文档，脚本核对算术与每一项）
 *                其中「外部工具」取**按类型表的 Count 列之和**（安装清单 28 个）——
 *                不是正文安全工具链那一行（33 个）：两者是不同概念，混用会得到两个总数。
 */
const fs = require('fs');
const path = require('path');

const { resolveScenes } = require('./lib/scene-dir.cjs');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

// 扫不到东西时的下限（当前实际：33 命令 / 26 场景 / 29 skills / 25~30 项目 / 23 npm 包）。
const FLOOR = { commands: 20, scenes: 20, skills: 20, npm: 15, github: 15 };

// 参考条目：既不在 .mcp.json 也不在 .mcp.json.full 里，文档明说「只是参考」。
const MCP_REFERENCE_ONLY = new Set(['tavily-search', 'filesystem', 'sequential-thinking']);

const BT = '`';

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function readJson(file) {
  try {
    return JSON.parse(readOrNull(file));
  } catch {
    return null;
  }
}

function listDir(dir, filter) {
  try {
    return fs.readdirSync(dir).filter(filter);
  } catch {
    return [];
  }
}

/** 仓库真值：一次读完；读不到的由 main 当成「扫描面塌了」。 */
function truth() {
  const commands = listDir(path.join(ROOT, '.claude/commands'), (f) => f.endsWith('.md'));
  const scenes = [...resolveScenes(ROOT).scenes.keys()];
  const skills = listDir(path.join(ROOT, '.claude/skills'), () => true);
  const pkg = readJson(path.join(ROOT, 'claude-scene/package.json')) || {};
  const active = readJson(path.join(ROOT, '.mcp.json'));
  const full = readJson(path.join(ROOT, '.mcp.json.full'));
  return {
    commands: commands.length,
    scenes: scenes.length,
    skills: skills.length,
    speckit: skills.filter((s) => s.startsWith('speckit-')).length,
    deps: Object.keys(pkg.dependencies || {}).length,
    devDeps: Object.keys(pkg.devDependencies || {}).length,
    mcpActive: Object.keys((active && active.mcpServers) || {}),
    mcpFull: Object.keys((full && full.mcpServers) || {}),
  };
}

/** 某段（到下一个 `### ` 或 `---` 为止）里的全部行。 */
function sectionLines(doc, heading) {
  const start = doc.indexOf(heading);
  if (start === -1) return null;
  const rest = doc.slice(start).split('\n');
  const out = [];
  for (const line of rest.slice(1)) {
    if (line.startsWith('### ') || line.startsWith('---')) break;
    out.push(line);
  }
  return out;
}

/** 「外部工具（按类型）」表格：Count 列之和 + 工具名去重个数。 */
function byTypeTable(doc, heading) {
  const lines = sectionLines(doc, heading);
  if (!lines) return null;
  const rows = lines.filter((line) => /^\|\s*\*\*/.test(line));
  if (rows.length === 0) return null;
  const counts = rows.map((line) => Number.parseInt(/\|\s*(\d+)\s*\|/.exec(line)?.[1], 10) || 0);
  // 只数「工具」那一列（第 3 个单元格），并去掉括号里的补充说明
  // （`bruno`（`@usebruno/cli`）这种写法会把包名算成第二个工具）
  const names = rows.flatMap((line) => {
    const cell = (line.split('|')[3] || '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
    return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  });
  return { sum: counts.reduce((a, b) => a + b, 0), names };
}

/** MCP 表格里列出的服务器名（每个单元格里的第一个反引号词）。 */
function mcpTableNames(doc, heading) {
  const lines = sectionLines(doc, heading);
  if (!lines) return null;
  const names = lines.flatMap((line) =>
    line.startsWith('|')
      ? [...line.matchAll(/`([\w-]+)`/g)].map((m) => m[1])
      : [],
  );
  return [...new Set(names)];
}

/** GitHub 项目段里点名的 `owner/repo`。 */
function githubNames(doc, heading) {
  const lines = sectionLines(doc, heading);
  if (!lines) return null;
  return [...new Set([...lines.join('\n').matchAll(/`([\w.-]+\/[\w.*-]+)`/g)].map((m) => m[1]))];
}

/** 一句话里的「数字」：文档写多少 vs 实际多少。 */
function cmp(label, raw, actual, problems) {
  if (raw === null || raw === undefined || Number.isNaN(Number(raw))) {
    problems.push(`${label}：文档里没写（找不到可核对的数字）`);
    return;
  }
  const claimed = Number(raw);
  if (claimed !== actual) problems.push(`${label}：文档写 ${claimed}，实际 ${actual}`);
}

function checkDoc(name, t) {
  const doc = readOrNull(path.join(ROOT, name));
  if (!doc) return { problems: [], collapsed: [`读不到 ${name}`] };

  const isZh = name === 'README.md';
  const problems = [];
  const collapsed = [];

  /** 取一句话的匹配结果；取不到就是格式变了（不是「对得上」）。 */
  const need = (label, re) => {
    const m = re.exec(doc);
    if (!m) collapsed.push(`${name}：「${label}」那句没认出来（格式变了？）`);
    return m;
  };

  const cmd = need('命令数 / 工作流数', isZh
    ? /# Slash commands（(\d+) 个 \.md：(\d+) 个工作流/
    : /# Slash commands \((\d+) \.md files: (\d+) workflows/);
  if (cmd) {
    cmp('命令数', cmd[1], t.commands, problems);
    cmp('工作流数', cmd[2], t.scenes, problems);
  }

  const skills = need('Skills 总数 / 通用 / speckit', isZh
    ? /# Claude Skills（(\d+) 个：(\d+) 个通用 \+ (\d+) 个 speckit）/
    : /# Claude Skills \((\d+): (\d+) core \+ (\d+) speckit\)/);
  if (skills) {
    cmp('Skills 总数', skills[1], t.skills, problems);
    cmp('通用 Skills 数', skills[2], t.skills - t.speckit, problems);
    cmp('speckit Skills 数', skills[3], t.speckit, problems);
  }

  const localSkills = need('本地 Skills 小节标题', isZh
    ? /### 本地 Skills（(\d+) 个，/
    : /### Local Skills \((\d+),/);
  if (localSkills) cmp('本地 Skills 小节标题', localSkills[1], t.skills, problems);

  const mcp = need('MCP 启用数 / 完整档数 / 表内条目数', isZh
    ? new RegExp(`### MCP 服务器（${BT}\\.mcp\\.json${BT} 启用 (\\d+) 个，${BT}\\.mcp\\.json\\.full${BT} (\\d+) 个，下表列 (\\d+) 个）`)
    : new RegExp(`### MCP Servers \\((\\d+) active in ${BT}\\.mcp\\.json${BT}, (\\d+) in ${BT}\\.mcp\\.json\\.full${BT}, (\\d+) listed below\\)`));
  const tableNames = mcpTableNames(doc, isZh ? '### MCP 服务器' : '### MCP Servers');
  if (!tableNames) collapsed.push(`${name}：MCP 服务器表格没认出来`);
  if (mcp && tableNames) {
    cmp('启用的 MCP 数', mcp[1], t.mcpActive.length, problems);
    cmp('完整档 MCP 数', mcp[2], t.mcpFull.length, problems);
    cmp('MCP 表内条目数', mcp[3], tableNames.length, problems);
  }
  if (tableNames) {
    const known = new Set([...t.mcpActive, ...t.mcpFull, ...MCP_REFERENCE_ONLY]);
    for (const server of tableNames.filter((s) => !known.has(s))) {
      problems.push(`幽灵 MCP 服务器：\`${server}\` 既不在 .mcp.json / .mcp.json.full，也不是明说的参考条目`);
    }
  }

  const npmTotal = t.deps + t.devDeps;
  const npm = need('npm 包总数', isZh ? /### npm 包（(\d+) 个，/ : /### npm Packages \((\d+),/);
  if (npm) cmp('npm 包总数', npm[1], npmTotal, problems);
  const dev = need('devDependencies 数', isZh ? /\*\*devDependencies（(\d+)）\*\*/ : /\*\*devDependencies \((\d+)\)\*\*/);
  if (dev) cmp('devDependencies 数', dev[1], t.devDeps, problems);
  const prod = need('dependencies 数', isZh ? /\*\*dependencies（(\d+)）\*\*/ : /\*\*dependencies \((\d+)\)\*\*/);
  if (prod) cmp('dependencies 数', prod[1], t.deps, problems);

  const byType = byTypeTable(doc, isZh ? '### 外部工具' : '### External Tools');
  const toolsHeading = need('外部工具（按类型）', isZh
    ? /### 外部工具（(\d+) 个，按类型）/
    : /### External Tools \((\d+), by type\)/);
  if (!byType) collapsed.push(`${name}：外部工具（按类型）表格没认出来`);
  if (byType) cmp('按类型表：Count 列之和 vs 列出的工具个数', byType.sum, byType.names.length, problems);
  if (toolsHeading && byType) cmp('外部工具（按类型）总数', toolsHeading[1], byType.sum, problems);

  const gh = need('集成 GitHub 项目数', isZh ? /### 集成 GitHub 项目（(\d+) 个）/ : /### Integrated GitHub Projects \((\d+)\)/);
  const ghNames = githubNames(doc, isZh ? '### 集成 GitHub 项目' : '### Integrated GitHub Projects');
  if (!ghNames) collapsed.push(`${name}：GitHub 项目名单没认出来`);
  if (gh && ghNames) cmp('集成 GitHub 项目数', gh[1], ghNames.length, problems);

  const toolchain = need('外部安全工具链清单个数', isZh
    ? new RegExp(`\\*\\*外部安全工具链\\*\\*：(\\d+) 个工具（([^）]*)）`)
    : new RegExp(`\\*\\*External security toolchain\\*\\*: (\\d+) tools \\(([^)]*)\\)`));
  const toolchainNames = toolchain
    ? toolchain[2].split('/').map((s) => s.trim()).filter(Boolean).length
    : null;
  if (toolchain) cmp('外部安全工具链清单个数', toolchain[1], toolchainNames, problems);

  const components = need('外部组件总数', isZh
    ? /\*\*(\d+) 个外部组件[^*]*\*\*：本地 Skills (\d+) 个 \+ 启用的 MCP (\d+) 个 \+ npm 包 (\d+) 个 \+ 外部工具 (\d+) 个/
    : /\*\*(\d+) external components[^*]*\*\*: (\d+) local skills \+ (\d+) active MCP servers \+ (\d+) npm packages \+ (\d+) external tools/);
  if (components) {
    const parts = components.slice(2, 6).map(Number);
    const want = [t.skills, t.mcpActive.length, npmTotal, byType?.sum ?? -1];
    cmp('外部组件总数', components[1], parts.reduce((a, b) => a + b, 0), problems);
    parts.forEach((p, i) => cmp(`外部组件第 ${i + 1} 项`, p, want[i], problems));
  }

  return { problems, collapsed };
}

/** 场景定义目录的 README：标题数字与表行数都得跟场景数一致。 */
function checkScenesReadme(t) {
  const name = '.claude/scenes/README.md';
  const doc = readOrNull(path.join(ROOT, name));
  if (!doc) return { problems: [], collapsed: [`读不到 ${name}`] };

  const problems = [];
  const collapsed = [];
  const heading = /^## 当前场景（(\d+) 个）$/m.exec(doc);
  if (!heading) {
    collapsed.push(`${name}：「## 当前场景（N 个）」标题没认出来（格式变了？）`);
  } else {
    cmp('场景 README 标题里的场景数', heading[1], t.scenes, problems);
  }

  // 表由 sync-docs 生成，但生成只覆盖标记之间 —— 少一行就是「以为同步过了」。
  const rows = doc.split('\n').filter((line) => /^\| `/.test(line.trim()));
  if (rows.length === 0) {
    collapsed.push(`${name}：场景表一行都没认出来`);
  } else {
    cmp('场景表的行数', rows.length, t.scenes, problems);
  }

  return { problems, collapsed };
}

function checkClaudeMd(t) {
  const doc = readOrNull(path.join(ROOT, 'CLAUDE.md'));
  if (!doc) return { problems: [], collapsed: ['读不到 CLAUDE.md'] };
  const m = /Scene 引擎在对话内执行工作流。(\d+) 个场景。/.exec(doc);
  if (!m) return { problems: [], collapsed: ['CLAUDE.md：场景数那句没认出来（格式变了？）'] };
  const problems = [];
  cmp('CLAUDE.md 场景数', m[1], t.scenes, problems);
  return { problems, collapsed: [] };
}

function fail(lines) {
  for (const line of [].concat(lines)) console.error(`❌ ${line}`);
  console.error('❌ 扫描面塌了 —— 这时「一致」是不可信的结论');
  process.exit(2);
}

function main() {
  const t = truth();

  if (t.commands < FLOOR.commands) fail(`只读到 ${t.commands} 个命令文件（下限 ${FLOOR.commands}）`);
  if (t.scenes < FLOOR.scenes) fail(`只读到 ${t.scenes} 个场景（下限 ${FLOOR.scenes}）`);
  if (t.skills < FLOOR.skills) fail(`只读到 ${t.skills} 个 skill 目录（下限 ${FLOOR.skills}）`);
  if (t.deps + t.devDeps < FLOOR.npm) fail(`只读到 ${t.deps + t.devDeps} 个 npm 依赖（下限 ${FLOOR.npm}）`);
  if (t.mcpActive.length === 0) fail('读不到 .mcp.json 的 mcpServers');

  console.log(
    `真值：${t.commands} 个命令 / ${t.scenes} 个工作流 / ${t.skills} 个 skills（${t.speckit} 个 speckit）/ `
      + `MCP 启用 ${t.mcpActive.length} 个 + 完整档 ${t.mcpFull.length} 个 / npm 包 ${t.deps + t.devDeps} 个`,
  );

  const collapsed = [];
  const failures = [];
  for (const name of ['README.md', 'README_EN.md']) {
    const result = checkDoc(name, t);
    collapsed.push(...result.collapsed);
    if (result.problems.length > 0) {
      failures.push(`❌ ${name}：${result.problems.length} 处对不上`);
      failures.push(...result.problems.map((p) => `   · ${p}`));
    } else if (result.collapsed.length === 0) {
      console.log(`✅ ${name}：数得出来的数字全部对得上`);
    }
  }

  const claude = checkClaudeMd(t);
  collapsed.push(...claude.collapsed);
  if (claude.problems.length > 0) {
    failures.push(...claude.problems.map((p) => `❌ ${p}`));
  } else if (claude.collapsed.length === 0) {
    console.log('✅ CLAUDE.md：场景数对得上');
  }

  const scenesReadme = checkScenesReadme(t);
  collapsed.push(...scenesReadme.collapsed);
  if (scenesReadme.problems.length > 0) {
    failures.push(...scenesReadme.problems.map((p) => `❌ .claude/scenes/README.md：${p}`));
  } else if (scenesReadme.collapsed.length === 0) {
    console.log('✅ .claude/scenes/README.md：标题数字与表行数都对得上');
  }

  if (collapsed.length > 0) fail(collapsed);
  for (const line of failures) console.error(line);
  if (failures.length > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  fail(`扫描失败：${error && error.message}`);
}
