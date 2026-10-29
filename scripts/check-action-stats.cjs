/**
 * README 里「多少个 action / 多少个 handler 函数 / 多少个 handler 模块」必须是真的。
 *
 * 用法：node scripts/check-action-stats.cjs [root]
 *
 * 退出码：
 *   0 = 两份 README 的数字与代码一致，且表格里点名的动作、`前缀-*（N 个）` 的通配计数全都对得上
 *   1 = 数字不符 / 幽灵动作 / 通配计数不符（逐条打印）
 *   2 = 扫描面塌了（注册表读不到、段落或表格没认出来、数量少得离谱）—— 结论不可信
 *
 * 以前的毛病（README_EN.md 写「126 actions / 222 handler functions / 41 handler modules」，
 * README.md 写「126 个 action / 41 个 handler 模块 / 222 个 handler 函数 / 27 个工作流」）：
 *   1. 每个数字都是历史的，实际是 428 / 284 / 70 / 26，没有任何东西会红。
 *   2. 「Action 处理器完整性」表格清一色 ✅，从没有人验证：`npm-audit`（其实是 runReview 的规则名）
 *      与 `state-audit`（源码里根本没有）根本不是动作；`huashu-*（7 个）` 实际 6 个、`mp-*（10 个）` 实际 14 个。
 *   3. 所以这份脚本不只核对数字，也把表格里点名的每个动作拿去注册表里查一遍，并核对通配计数 ——
 *      「✅」与「（N 个）」必须能被机器复核，否则它们只是装饰。
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

// 扫描面塌了的判定下限（当前实际：428 个动作名 / 70 个模块 / 每份文档点名 40+ 个动作）。
const MIN_ACTIONS = 200;
const MIN_MODULES = 40;
const MIN_NAMED = 20;

// 段落里出现、但不是动作名的词（说明它是「去哪看」的指引，不是 ✅ 的对象）。
const PROSE_TOKENS = new Set(['ACTION_REGISTRY']);

/**
 * 两份文档的格式差异（中文 `N 个 action` / 英文 `N action names`、标题不同）各自编码进来，
 * 而不是用一条宽松正则糊过去 —— 糊过去的结果是「读不到数字」也能算「对得上」。
 */
const DOCS = [
  {
    file: 'README_EN.md',
    section: '## 🔧 Action Handler Completeness',
    claims: (s) => ({
      actionNames: pick(s, /registers\s+\*\*(\d+)\s+action names\*\*/),
      handlerFunctions: pick(s, /\*\*(\d+)\s+distinct handler functions\*\*/),
      handlerModules: pick(s, /\*\*(\d+)\s+handler modules\*\*/),
      workflows: pick(s, /across\s+(\d+)\s+workflows/),
    }),
  },
  {
    file: 'README.md',
    section: '## 🔧 Action 处理器完整性',
    claims: (s) => ({
      actionNames: pick(s, /系统注册了\s+\*\*(\d+)\s+个 action 名\*\*/),
      handlerFunctions: pick(s, /\*\*(\d+)\s+个不同的 handler 函数\*\*/),
      handlerModules: pick(s, /\*\*(\d+)\s+个 handler 模块\*\*/),
      workflows: pick(s, /覆盖\s+(\d+)\s+个工作流/),
    }),
  },
];

function pick(section, re) {
  const m = re.exec(section);
  return m ? Number.parseInt(m[1], 10) : null;
}

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function handlerModules(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...handlerModules(full));
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) out.push(full);
  }
  return out;
}

async function loadRegistry() {
  // Windows 上动态 import 必须走 file:// URL，直接给盘符路径会报 unsupported protocol 'e:'
  const file = pathToFileURL(path.join(ROOT, 'claude-scene/src/actions.js')).href;
  try {
    const mod = await import(file);
    return mod.ACTION_REGISTRY || null;
  } catch {
    // 读不到注册表就什么都判不了 —— 这是扫描面塌了，不许当成「0 个动作，全部对得上」
    return null;
  }
}

function sectionOf(doc, heading) {
  const start = doc.indexOf(heading);
  if (start === -1) return null;
  const rest = doc.slice(start + heading.length);
  const end = rest.indexOf('\n---');
  return end === -1 ? rest : rest.slice(0, end);
}

/** 表格行 = 以 "| `" 开头的行；✅ 只在这些行里，正文提到的名字不是 ✅ 的对象。 */
function tableRows(section) {
  return section.split('\n').filter((line) => line.startsWith('| `'));
}

function namedActions(section) {
  const names = tableRows(section).flatMap((line) =>
    [...line.matchAll(/`([A-Za-z][\w-]*)`/g)].map((m) => m[1]),
  );
  return [...new Set(names)].filter((name) => !PROSE_TOKENS.has(name));
}

/** `前缀-*`（N 个）/ `前缀-*` (N) 这类通配声明 → [{ prefix, claimed }] */
function wildcardClaims(section) {
  return tableRows(section)
    .map((line) => /`([a-z][\w-]*)\*`\s*[（(]\s*(\d+)/.exec(line))
    .filter(Boolean)
    .map((m) => ({ prefix: m[1], claimed: Number.parseInt(m[2], 10) }));
}

function sceneCount() {
  const dir = path.join(ROOT, 'claude-scene/scenes');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
}

function compare(label, claimed, actual, problems) {
  if (claimed === null) {
    problems.push(`${label}：文档里没写（找不到可核对的数字）`);
    return;
  }
  if (claimed !== actual) problems.push(`${label}：文档写 ${claimed}，实际 ${actual}`);
}

function checkDoc(doc, keys, truthValues) {
  const problems = [];
  const section = sectionOf(doc.text, doc.section);
  if (!section) return { problems, collapsed: `${doc.file} 里找不到「${doc.section}」段落（格式变了？）`, named: 0 };

  const claims = doc.claims(section);
  for (const [key, value] of Object.entries(truthValues)) {
    compare(key, claims[key], value, problems);
  }

  const named = namedActions(section);
  const known = new Set(keys);
  for (const name of named.filter((n) => !known.has(n))) {
    problems.push(`幽灵动作：\`${name}\` 标着 ✅，但 ACTION_REGISTRY 里没有这个名字`);
  }

  for (const { prefix, claimed } of wildcardClaims(section)) {
    const actual = keys.filter((k) => k.startsWith(prefix)).length;
    if (claimed !== actual) {
      problems.push(`通配计数：\`${prefix}*\` 写 ${claimed} 个，实际 ${actual} 个`);
    }
  }

  return { problems, collapsed: named.length < MIN_NAMED ? `只认出 ${named.length} 个被点名的动作（下限 ${MIN_NAMED}）` : null, named: named.length };
}

async function main() {
  const registry = await loadRegistry();
  const keys = registry ? Object.keys(registry) : [];
  const functions = new Set(
    registry ? Object.values(registry).filter((v) => typeof v === 'function') : [],
  );
  const handlersDir = path.join(ROOT, 'claude-scene/src/handlers');
  const modules = fs.existsSync(handlersDir) ? handlerModules(handlersDir) : [];
  const workflows = sceneCount();

  const collapsed = [];
  if (!registry) collapsed.push('读不到 claude-scene/src/actions.js 的 ACTION_REGISTRY');
  if (keys.length < MIN_ACTIONS) collapsed.push(`只读到 ${keys.length} 个动作名（下限 ${MIN_ACTIONS}）`);
  if (modules.length < MIN_MODULES) collapsed.push(`只读到 ${modules.length} 个 handler 模块（下限 ${MIN_MODULES}）`);

  console.log(
    `真值：${keys.length} 个动作名 / ${functions.size} 个不同的 handler 函数 / `
      + `${modules.length} 个 handler 模块 / ${workflows} 个工作流`,
  );
  console.log('（动作名 = ACTION_REGISTRY 的键；同一个函数常登记成 camelCase + kebab-case 两个名字，故多于函数数）');

  const truthValues = {
    actionNames: keys.length,
    handlerFunctions: functions.size,
    handlerModules: modules.length,
    workflows,
  };

  let failed = false;
  for (const doc of DOCS) {
    const text = readOrNull(path.join(ROOT, doc.file));
    if (!text) {
      collapsed.push(`读不到 ${doc.file}`);
      continue;
    }
    const result = checkDoc({ ...doc, text }, keys, truthValues);
    if (result.collapsed) {
      collapsed.push(result.collapsed);
      continue;
    }
    if (result.problems.length > 0) {
      failed = true;
      console.error(`❌ ${doc.file}：${result.problems.length} 处对不上`);
      for (const line of result.problems) console.error(`   · ${line}`);
      continue;
    }
    console.log(`✅ ${doc.file}：4 个计数与 ${result.named} 个点名动作全部对得上`);
  }

  if (collapsed.length > 0) {
    for (const line of collapsed) console.error(`❌ ${line}`);
    console.error('❌ 扫描面塌了 —— 这时「一致」是不可信的结论');
    process.exit(2);
  }
  if (failed) process.exit(1);
}

main().catch((error) => {
  // 未捕获异常也是「扫不到」，不许顺手 exit 1 冒充「有问题」
  console.error(`❌ 扫描失败：${error && error.message}`);
  process.exit(2);
});
