#!/usr/bin/env node
/**
 * check-opencode-config.cjs — 校验 opencode 全局配置那份「说明书」有没有说谎
 *
 * 背景：`.opencode/deploy-global.cjs` 会把 `scripts/generate-opencode-config.cjs` 里手写的命令表
 * 写进 `~/.config/opencode/opencode.json`，agent 真的会照着模板去读 `.claude/commands/X.md`、
 * 真的会按模板里写的「N 步」去执行。所以这里的三类声明必须可核对：
 *
 *   1) 模板里引用的每个 `.claude/commands/X.md` 必须真存在，且每个真实命令文件都要被引用
 *      （以前 `/hunt` `/e2e` `/monitor` 三个已删除的命令文件还挂在表里，agent 会去读空气）
 *   2) 模板里的「（N 步」必须等于 `claude-scene/scenes/X.json` 的 flow 键数
 *      （以前 `/review` 写「86行33步」，真实是 80 行 / 43 步；`/loop` 写 10 实际 18）
 *   3) 文档里写死的 opencode 计数必须等于生成器的真值
 *      （以前 README 写「108 命令 + 17 MCP，38 工作流」，真值 106 / 17 / 1 provider / 38 个引用 .md）
 *
 * 用法：
 *   node scripts/check-opencode-config.cjs                     # 真跑生成器（--dry-run）取真值
 *   node scripts/check-opencode-config.cjs <root>              # 校验指定仓库根
 *   node scripts/check-opencode-config.cjs <root> --config f   # 用现成的配置 JSON 取真值（测试用）
 *
 * 退出码：0 = 全部一致 / 1 = 有不一致（点名） / 2 = 扫不到东西（读不到生成器/命令目录/配置）
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 塌面下限：读到的量低于这里就说明「不是这个仓库」或路径错了，不能报「干净」
const MIN_COMMANDS = 50;
const MIN_COMMAND_FILES = 20;
const MIN_MD_REFS = 15;
const MIN_SCENES = 20;

const argv = process.argv.slice(2);
let configPath = null;
const rest = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--config') {
    configPath = argv[i + 1];
    i += 1;
  } else {
    rest.push(argv[i]);
  }
}
const root = path.resolve(rest[0] || process.cwd());

function die(msg) {
  console.error(`[扫不到东西] ${msg}`);
  process.exit(2);
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function commandFiles() {
  const dir = path.join(root, '.claude', 'commands');
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    die(`读不到命令目录 ${dir}`);
  }
  const list = names.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
  if (list.length < MIN_COMMAND_FILES) die(`只读到 ${list.length} 个命令文件（下限 ${MIN_COMMAND_FILES}）`);
  return list;
}

function sceneSteps() {
  const dir = path.join(root, 'claude-scene', 'scenes');
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    die(`读不到场景目录 ${dir}`);
  }
  const out = new Map();
  for (const f of names.filter((n) => n.endsWith('.json'))) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      out.set(f.replace(/\.json$/, ''), Object.keys(json.flow || {}).length);
    } catch {
      die(`场景文件解析失败：${f}`);
    }
  }
  if (out.size < MIN_SCENES) die(`只读到 ${out.size} 个场景（下限 ${MIN_SCENES}）`);
  return out;
}

function generatedConfig() {
  if (configPath) {
    const text = readText(path.resolve(configPath));
    if (text === null) die(`读不到指定的配置：${configPath}`);
    try {
      return JSON.parse(text);
    } catch {
      die(`指定的配置不是合法 JSON：${configPath}`);
    }
  }
  const deploy = path.join(root, '.opencode', 'deploy-global.cjs');
  if (!fs.existsSync(deploy)) die(`读不到生成器 ${deploy}`);
  // 用当前 node 的可执行文件绝对路径，避免从 PATH 里挑一个 node
  const res = spawnSync(process.execPath, [deploy, '--dry-run'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) die(`生成器退出码 ${res.status}：${(res.stderr || '').slice(0, 400)}`);
  try {
    return JSON.parse(res.stdout);
  } catch {
    die('生成器输出不是合法 JSON');
  }
  return null;
}

const problems = [];
function expect(label, actual, wanted) {
  if (actual === wanted) return;
  problems.push(`${label}：写了 ${String(wanted)}，实际 ${String(actual)}`);
}

const cmds = commandFiles();
const steps = sceneSteps();
const config = generatedConfig();

// ---------- 真值 ----------
const genSrc = readText(path.join(root, 'scripts', 'generate-opencode-config.cjs'));
if (genSrc === null) die(`读不到生成器源码 ${path.join(root, 'scripts', 'generate-opencode-config.cjs')}`);
const refs = [...new Set([...genSrc.matchAll(/\.claude\/commands\/([a-z0-9-]+)\.md/g)].map((m) => m[1]))].sort();
if (refs.length < MIN_MD_REFS) die(`生成器里只找到 ${refs.length} 个 .md 引用（下限 ${MIN_MD_REFS}）`);

const truth = {
  commands: Object.keys(config.command || {}).length,
  mcp: Object.keys(config.mcp || {}).length,
  providers: Object.keys(config.provider || {}).length,
  mdRefs: Object.values(config.command || {}).filter((v) => v.template && v.template.includes('.claude/commands'))
    .length,
};
if (truth.commands < MIN_COMMANDS) die(`生成结果只有 ${truth.commands} 个命令（下限 ${MIN_COMMANDS}）`);

// ---------- ① .md 引用必须真存在，且不遗漏 ----------
const ghosts = refs.filter((r) => !cmds.includes(r));
if (ghosts.length > 0) problems.push(`模板引用了不存在的命令文件：${ghosts.join(', ')}`);
const orphans = cmds.filter((c) => !refs.includes(c));
if (orphans.length > 0) problems.push(`真实命令文件没被任何模板引用：${orphans.join(', ')}`);

// ---------- ② 「（N 步」必须等于场景真步数 ----------
const claims = [...genSrc.matchAll(/\.claude\/commands\/([a-z0-9-]+)\.md[^'\n]{0,40}?（\s*(\d+)\s*步/g)].map((m) => ({
  file: m[1],
  written: Number(m[2]),
}));
for (const c of claims) {
  const actual = steps.get(c.file);
  if (actual === undefined) {
    problems.push(`「${c.file}」写的是 ${c.written} 步，但没有这个场景可核对`);
  } else if (actual !== c.written) {
    problems.push(`「${c.file}」写了 ${c.written} 步，场景实际 ${actual} 步`);
  }
}

// ---------- ③ 文档里写死的计数必须等于真值 ----------
const readme = readText(path.join(root, 'README.md'));
if (readme === null) die('读不到 README.md');
const row = readme.split(/\r?\n/).find((l) => l.includes('**opencode 全局配置**'));
if (!row) {
  die('README.md 里找不到「opencode 全局配置」这一行（格式变了？）');
}
// 整行结构一次性卡住：格式被改了就是 exit 2（认不出来），数字对不上才是 exit 1
const rowRe = /(\d+) 命令（其中 (\d+) 个直接引用本仓库[^）]*）· (\d+) MCP · (\d+) Provider/;
const m = row.match(rowRe);
if (!m) die(`README.md 的 opencode 行格式变了，认不出计数：${row.slice(0, 160)}`);
expect('README 的 opencode 命令数', truth.commands, Number(m[1]));
expect('README 的「引用本仓库 .md」条数', truth.mdRefs, Number(m[2]));
expect('README 的 opencode MCP 数', truth.mcp, Number(m[3]));
expect('README 的 opencode Provider 数', truth.providers, Number(m[4]));

// ---------- ④ 计数的度量方式不许偷懒 ----------
const setupSh = readText(path.join(root, 'scripts', 'setup-opencode-global.sh'));
if (setupSh === null) die('读不到 scripts/setup-opencode-global.sh');
if (/^\s*CMD_COUNT=.*grep/m.test(setupSh)) {
  problems.push('setup-opencode-global.sh 又用 grep 数行来当命令数了（数的是描述，不是命令）');
}
if (!setupSh.includes('JSON.parse') || !setupSh.includes('c.command')) {
  problems.push('setup-opencode-global.sh 不再从配置 JSON 里数 command 键（命令数会变成猜的）');
}

// ---------- 报告 ----------
console.log(
  `[真值] 命令 ${truth.commands} · MCP ${truth.mcp} · Provider ${truth.providers} · ` +
    `引用 .md ${truth.mdRefs} 处（${refs.length} 个不同文件 / 磁盘 ${cmds.length} 个命令文件）`,
);
console.log(`[真值] 模板里的步骤数声明 ${claims.length} 处，逐个对上 ${claims.length - problems.filter((p) => p.includes('步')).length} 处`);

if (problems.length === 0) {
  console.log('[ok] opencode 全局配置的说明书与仓库一致');
  process.exit(0);
}
for (const p of problems) console.log(`[FAIL] ${p}`);
process.exit(1);
