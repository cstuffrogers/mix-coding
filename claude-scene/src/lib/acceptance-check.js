// Acceptance-check helper extracted so the "edit-without-verify" boundary is
// unit-testable without mounting the orchestrator. Classifies a scene's
// completed step actions into edit/verify buckets and flags a change-bearing
// run that closed without any verified (passing) reviewed-check action.
const VERIFY_RE = /lint|test|verify|audit|check|build|review|smoke|regression|validate|suite/i;
const EDIT_RE = /edit|write|generate|create|modify|patch|refactor|implement|fix/i;
// A verify step counts as "reviewed-passing" when it ran and did not fail.
// pass = clean, warn = passed with findings (still a reviewed signal), noop = skipped/unavailable.
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
// pass = clean, warn = passed with findings (still a reviewed signal).
// Without stepResults (static scene check), any verify action counts as presence.
function isPassingVerify(action, statusLookup, hasStepResults) {
  if (!hasStepResults) return true;
  const status = statusLookup.get(action);
  return typeof status === 'string' && PASSING_RE.test(status);
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
  for (const step of flow || []) {
    if (!completed.has(step.step)) continue;
    const kind = classifyAction(step.action);
    if (kind === 'edit') hasEdit = true;
    if (kind === 'verify') {
      hasVerify = true;
      if (isPassingVerify(step.action, statusLookup, hasStepResults)) hasPassingVerify = true;
    }
  }
  return {
    hasEdit,
    hasVerify,
    hasPassingVerify,
    missingVerify: !allowNoVerify && hasEdit && !hasVerify,
    // Hard gate: change-bearing run closed without any reviewed-passing verify step.
    unreviewedChange: !allowNoVerify && hasEdit && !hasPassingVerify,
  };
}
