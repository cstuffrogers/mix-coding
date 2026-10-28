import { safeExec } from '../lib/safe-exec.js';

export function handleIssueQuery(_action, _params, _targetPath, context) {
  if (context) context.issue_queried = true;
  return { status: 'noop', message: `Issue 查询（CLI 不执行，需在对话模式由 agent 完成）` };
}

export function handleLocate(_action, _params, _targetPath, context) {
  if (context) context.issue_located = true;
  return { status: 'noop', message: '问题定位（CLI 不执行，需在对话模式由 agent 完成）' };
}

export function handleAnalyzeDependencies(_action, _params, _targetPath, context) {
  if (context) context.deps_analyzed = true;
  return { status: 'noop', message: '依赖分析（CLI 不执行，需在对话模式由 agent 完成）' };
}

/**
 * 跑测试并区分三种结局，别把「测试失败」说成「运行器不可用」，
 * 也别把「没有测试」当成通过：
 *   ok          → 测试全绿
 *   failed      → 测试真跑了且失败（有 exit code）
 *   unavailable → 运行器起不来 / 没有任何测试文件
 */
function runTestSuite(targetPath) {
  try {
    const output = safeExec('npx vitest run 2>&1', targetPath, { stdio: 'pipe' }).toString();
    return { kind: 'ok', output };
  } catch (err) {
    const output = String(err?.stdout || err?.stderr || err?.message || '');
    if (/No test files found|未找到测试|no test files/i.test(output)) return { kind: 'unavailable', output };
    if (typeof err?.status === 'number') return { kind: 'failed', output, exitCode: err.status };
    return { kind: 'unavailable', output };
  }
}

export function handleFix(_action, _params, _targetPath, context) {
  if (context) context.fixApplied = true;
  return { status: 'noop', message: '修复待应用（CLI 不执行，需在对话模式由 agent 完成）' };
}

export function handleVerifyFix(_action, _params, targetPath) {
  const r = runTestSuite(targetPath);
  if (r.kind === 'ok') return '修复验证通过';
  if (r.kind === 'failed') return { status: 'fail', message: `修复验证失败：测试未通过（exit ${r.exitCode}）` };
  // 测试器都跑不起来（或根本没有测试），就等于没验证 —— 只能是 warn，不能是 pass。
  return {
    status: 'warn',
    message: `修复验证未执行：${r.output.split('\n')[0].slice(0, 80) || '测试运行器不可用'} —— Bug 修复未经测试验证`,
  };
}

export function handleRegression(_action, _params, targetPath) {
  const r = runTestSuite(targetPath);
  if (r.kind === 'ok') return '回归测试通过';
  if (r.kind === 'failed') return { status: 'fail', message: `回归测试失败（exit ${r.exitCode}）` };
  // 以前 catch 里回「回归测试完成（无测试运行器）」→ 记 ✓ pass。
  return { status: 'warn', message: `回归测试未执行：${r.output.split('\n')[0].slice(0, 80) || '测试运行器不可用'}` };
}

export function handleCloseTicket(_action, _params, _targetPath, context) {
  if (context) context.ticket_closed = true;
  return { status: 'noop', message: 'Ticket 未关闭（CLI 不执行，需在对话模式由 agent 完成）' };
}
