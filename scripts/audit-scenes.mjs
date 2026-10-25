// 场景引擎静态审计：找出逻辑漏洞与输入输出缺陷
// 用法: node scripts/audit-scenes.mjs [sceneDir]
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sceneDir = process.argv[2] || join(root, 'claude-scene', 'scenes');

// 引擎在 start.js 里特判、不需要注册到 ACTION_REGISTRY 的动作
const SPECIAL_ACTIONS = new Set(['selectModes', 'selectSetupKind', 'selectOption']);

// 条件表达式拆解：排除函数调用名（includes(...)、length 等）与 JS 关键字
const JS_NOISE = new Set(['true', 'false', 'and', 'or', 'not', 'null', 'undefined',
  'includes', 'length', 'some', 'every', 'filter', 'map', 'push', 'toLowerCase', 'trim']);
function extractConditions(expr) {
  const s = String(expr);
  // 先剔除字符串字面量内容（避免把 'aa' 当成条件名）
  const bare = s.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  // 剔除函数调用名 foo(...)
  const noCalls = bare.replace(/([A-Za-z_]\w*)\s*\(/g, ' ');
  const out = [];
  for (const m of noCalls.matchAll(/[A-Za-z_]\w*/g)) out.push(m[0]);
  return [...new Set(out)].filter((x) => !JS_NOISE.has(x));
}


const registrySrc = readFileSync(join(root, 'claude-scene', 'src', 'actions.js'), 'utf8');
const conditionsSrc = readFileSync(join(root, 'claude-scene', 'src', 'lib', 'conditions.js'), 'utf8');
// context 由 start.js 的 applyPostStepContext / 交互逻辑写入，也要扫
const startSrc = readFileSync(join(root, 'claude-scene', 'src', 'commands', 'start.js'), 'utf8');
// 所有 handler 文件：context key 由各个 handler 写入（如 cicd.js 写 ciConfigured）
const allHandlerSrc = readAllSource(join(root, 'claude-scene', 'src'));

function readAllSource(dir) {
  let acc = '';
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) acc += readAllSource(p);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) acc += readFileSync(p, 'utf8');
  }
  return acc;
}

// start.js 里不一定用 `context.x =` 写入的 key：
// buildSceneContext 的对象字面量 + handleSingleChoice 的 actionMap 值
const START_CONTEXT_KEYS = new Set();
{
  const ctxFn = startSrc.match(/function buildSceneContext\([\s\S]*?\n\}/);
  if (ctxFn) {
    for (const m of ctxFn[0].matchAll(/^\s+(\w+)\s*:/gm)) START_CONTEXT_KEYS.add(m[1]);
  }
  const mapFn = startSrc.match(/const actionMap = \{([\s\S]*?)\};/);
  if (mapFn) {
    for (const m of mapFn[1].matchAll(/^\s+\w+\s*:\s*['"](\w+)['"]/gm)) START_CONTEXT_KEYS.add(m[1]);
  }
}
const msgsSrc = readFileSync(join(root, 'claude-scene', 'src', 'data', 'action-messages.js'), 'utf8');

// 已注册的 action 名（对象 key）
const registeredActions = new Set();
for (const m of registrySrc.matchAll(/^[ \t]+(?:'([^']+)'|"([^"]+)"|(\w+))\s*:/gm)) {
  registeredActions.add(m[1] || m[2] || m[3]);
}
// ui-polish 走独立分发（UI_POLISH_ACTIONS），不在主 registry 里
const uiPolishSrc = readFileSync(join(root, 'claude-scene', 'src', 'handlers', 'ui-polish.js'), 'utf8');
const uiPolishActions = uiPolishSrc.match(/const UI_POLISH_ACTIONS = \{([\s\S]*?)\n\};/);
if (uiPolishActions) {
  for (const m of uiPolishActions[1].matchAll(/^[ \t]+(?:'([^']+)'|"([^"]+)"|(\w+))\s*:/gm)) {
    registeredActions.add(m[1] || m[2] || m[3]);
  }
}
// 已定义的 condition 名
const definedConds = new Set();
for (const m of conditionsSrc.matchAll(/^ {2}(\w+)\s*:/gm)) definedConds.add(m[1]);
// 已知的输入参数名（params 里合法键）
const sceneFiles = readdirSync(sceneDir).filter((f) => f.endsWith('.json'));

const issues = [];
const push = (severity, scene, step, kind, detail) => issues.push({ severity, scene, step, kind, detail });

const CONTEXT_KEYS = new Set(); // 由 applyPostStepContext / handlers 写入的 context key

for (const file of sceneFiles) {
  const scene = JSON.parse(readFileSync(join(sceneDir, file), 'utf8'));
  const sceneId = scene.scene_id || file.replace(/\.json$/, '');
  if (!scene.scene_id) push('error', file, '-', 'missing-scene_id', '缺少 scene_id');
  if (!scene.description) push('warn', file, '-', 'missing-description', '缺少 description');
  if (!Array.isArray(scene.flow) || scene.flow.length === 0) {
    push('error', file, '-', 'empty-flow', 'flow 为空');
    continue;
  }

  const steps = scene.flow;
  const seenStepNums = new Set();
  let prevStep = -Infinity;
  // 收集本场景写出的 context key（用于孤儿条件检测）
  const writtenKeys = new Set();
  let hasVerifyAction = false;
  let hasChangeAction = false;

  for (const step of steps) {
    const label = `step ${step.step}`;
    // ── 结构校验 ──
    if (typeof step.step !== 'number') push('error', file, label, 'bad-step-number', `step 非数字: ${step.step}`);
    if (seenStepNums.has(step.step)) push('error', file, label, 'dup-step-number', `step 编号重复: ${step.step}`);
    seenStepNums.add(step.step);
    if (step.step < prevStep) push('warn', file, label, 'step-order', `step 顺序倒置: ${step.step} < ${prevStep}`);
    prevStep = step.step;

    if (!step.action) push('error', file, label, 'missing-action', '缺少 action');
    if (!step.description) push('warn', file, label, 'missing-description', '缺少 description');

    // ── action 注册校验（selectModes 由 start.js 特判，不走 registry）──
    if (step.action && !registeredActions.has(step.action) && !SPECIAL_ACTIONS.has(step.action)) {
      push('error', file, label, 'phantom-action', `action 未在 ACTION_REGISTRY 注册: ${step.action}`);
    }

    // ── 条件校验 ──
    if (step.condition) {
      const conds = extractConditions(step.condition);
      for (const c of conds) {
        if (!definedConds.has(c) && !isContextKey(c)) {
          push('error', file, label, 'orphan-condition', `condition 未定义且非 context key: ${c}`);
        }
      }
    }

    // ── on_error 校验（引擎实际实现: abort / fail_workflow / retry）──
    if (step.on_error && !['abort', 'fail_workflow', 'retry'].includes(step.on_error)) {
      push('error', file, label, 'bad-on_error', `on_error 非法值: ${step.on_error}`);
    }

    // ── 变更/验证类动作统计（验收三元组门禁）──
    if (/^(lint|test|build|typecheck|verify|runTests|verifyBuild)$/i.test(step.action)) hasVerifyAction = true;
    if (/(implement|apply|write|create|generate|fix|refactor)/i.test(step.action)) hasChangeAction = true;

    // ── 记录 context 写入 ──
    for (const k of Object.keys(step.params || {})) {
      if (/^(set_|has_|selected_|.*_executed|.*_done)$/.test(k)) writtenKeys.add(k);
    }
  }

  if (hasChangeAction && !hasVerifyAction) {
    push('warn', file, '-', 'no-verify-step', '场景含变更类动作但没有验证类步骤（验收三元组门禁会阻断）');
  }

  // ── 最后一个 step 之后是否还有依赖某个前序 step 的 condition（悬空）──
  if (!scene.status) push('warn', file, '-', 'missing-status', '缺少 status 字段');
}

// 是否可能是 context key（handler 运行时写入）
function isContextKey(name) {
  if (CONTEXT_KEYS.has(name)) return true;
  // enhancements.js 动态写入 context[`enh_${key}`]
  if (name.startsWith('enh_')) return true;
  // context.NAME / context?.NAME / context['NAME'] 任一种形式
  const re = new RegExp(`context\\s*\\??\\.\\s*${name}\\b|context\\s*\\??\\.?\\s*\\[\\s*['"]${name}['"]\\s*\\]`);
  // start.js 的特殊写入：buildSceneContext 对象字面量 / handleModeSelection /
  // handleSingleChoice 的 actionMap（映射到 context key）
  return re.test(registrySrc) || re.test(startSrc) || re.test(allHandlerSrc)
    || START_CONTEXT_KEYS.has(name);
}

// ── 输出 ──
const errors = issues.filter((i) => i.severity === 'error');
const warns = issues.filter((i) => i.severity === 'warn');
console.log(`\n审计场景目录: ${sceneDir}`);
console.log(`共 ${sceneFiles.length} 个场景，发现 ${errors.length} 个错误 / ${warns.length} 个警告\n`);
if (errors.length) {
  console.log('❌ 错误:');
  for (const e of errors) console.log(`  [${e.scene}] ${e.step} ${e.kind}: ${e.detail}`);
}
if (warns.length) {
  console.log('\n⚠️  警告:');
  for (const w of warns) console.log(`  [${w.scene}] ${w.step} ${w.kind}: ${w.detail}`);
}
process.exit(errors.length > 0 ? 1 : 0);
