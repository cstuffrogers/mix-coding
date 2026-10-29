// Acceptance-check helper extracted so the "edit-without-verify" boundary is
// unit-testable without mounting the orchestrator. Classifies a scene's
// completed step actions into edit/verify buckets and flags a change-bearing
// run that closed without any verified (passing) reviewed-check action.
const VERIFY_RE = /lint|test|verify|audit|check|build|review|smoke|regression|validate|suite/i;
const EDIT_RE = /edit|write|generate|create|modify|patch|refactor|implement|fix/i;
// A verify step counts as "reviewed-passing" when it ran and did not fail.
// pass = clean, warn = passed with findings (still a reviewed signal), noop = skipped/unavailable.
// 注意：warn 只能表示「真跑了、但有发现」。表示「没测」的步骤必须是 skip ——
// 否则这一行就成了假绿通道（实测：写文件 + verify 两步都没执行，exit 0）。
// 守卫在 commands/step-status-contract.test.js。
const PASSING_RE = /^(pass|warn)$/i;

export function classifyAction(action) {
  if (!action || typeof action !== 'string') return 'other';
  if (VERIFY_RE.test(action)) return 'verify';
  if (EDIT_RE.test(action)) return 'edit';
  return 'other';
}

// Build a lookup of the latest status per action name from stepResults.
function buildStatusLookup(stepResults) {
  const map = new Map();
  if (!Array.isArray(stepResults)) return map;
  for (const r of stepResults) {
    if (r && r.action) map.set(r.action, r.status);
  }
  return map;
}

// A verify step counts as "reviewed-passing" when it ran and did not fail.
// pass = clean, warn = passed with findings (still a reviewed signal), noop = skipped/unavailable.
// Without stepResults (static scene check), any verify action counts as presence.
function isPassingVerify(action, statusLookup, hasStepResults) {
  if (!hasStepResults) return true;
  const status = statusLookup.get(action);
  return typeof status === 'string' && PASSING_RE.test(status);
}

// 真的动过东西的步骤：pass / warn 是做了，fail 是做了但出错（也可能写了一半）。
// noop = 没人可做的事，skip = 本环境没执行 —— 这两个没产生变更，
// 以前按动作名一律算「有变更」，于是 qa / update 这类报告型场景在对话模式下
// 收尾时被「变更未通过验证」拦下（实测 exit 1），而那条消息里的「有变更」是假话。
const CHANGED_RE = /^(pass|warn|fail)$/i;

// 判定一个变更类步骤算不算真的动了东西：没有 stepResults（静态检查）只能按动作名；
// 有 stepResults 就必须看状态 —— pass/warn/fail 是做了，noop/skip 是没做。
function isChangedEdit(action, statusLookup, hasStepResults) {
  if (!hasStepResults) return true;
  const status = statusLookup.get(action);
  return typeof status === 'string' && CHANGED_RE.test(status);
}

/** 一个已完成步骤对验收门禁意味着什么（拆出来只是为了让主循环保持平坦）。 */
function classifyCompletedStep(step, statusLookup, hasStepResults) {
  const kind = classifyAction(step.action);
  if (kind === 'edit') {
    // 注意：edit 与 inert 互斥 —— 「是变更类动作」不等于「真的改了」。
    const changed = isChangedEdit(step.action, statusLookup, hasStepResults);
    return { edit: changed, inert: !changed };
  }
  if (kind === 'verify') {
    return { verify: true, passingVerify: isPassingVerify(step.action, statusLookup, hasStepResults) };
  }
  return {};
}

// stepResults: optional array of { action, status } for the completed steps.
// When provided, a verify step counts only if its status is pass/warn (reviewed-passing).
// When absent, any verify action in the flow counts (presence-only, for static scene checks).
export function checkAcceptance(flow, completedStepNums, allowNoVerify = false, stepResults = null) {
  const completed = new Set(completedStepNums);
  const statusLookup = buildStatusLookup(stepResults);
  const hasStepResults = Array.isArray(stepResults);
  let hasEdit = false;
  let hasVerify = false;
  let hasPassingVerify = false;
  // 有变更类动作、但一步都没真改动过：调用方要把这个事实说出来，否则
  // 「门禁没拦」和「门禁被关了」在输出上长得一样。
  const inertEditSteps = [];
  for (const step of flow || []) {
    if (!completed.has(step.step)) continue;
    const c = classifyCompletedStep(step, statusLookup, hasStepResults);
    if (c.edit) hasEdit = true;
    if (c.inert) inertEditSteps.push(step.action);
    if (c.verify) hasVerify = true;
    if (c.passingVerify) hasPassingVerify = true;
  }
  return {
    hasEdit,
    hasVerify,
    hasPassingVerify,
    inertEditSteps,
    missingVerify: !allowNoVerify && hasEdit && !hasVerify,
    // Hard gate: change-bearing run closed without any reviewed-passing verify step.
    unreviewedChange: !allowNoVerify && hasEdit && !hasPassingVerify,
  };
}
