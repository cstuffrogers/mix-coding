import { safeExec } from '../lib/safe-exec.js';

export function handleIssueQuery(_action, _params, _targetPath, context) {
  if (context) context.issue_queried = true;
  return { status: 'noop', message: `Issue 查询（CLI 不执行，需在对话模式由 agent 完成）` };
}

export function handleLocate(_action, _params, _targetPath, context) {
  if (context) context.issue_located = true;
  return { status: 'noop', message: '问题定位（CLI 不执行，需在对话模式由 agent 完成）' };
}

export function handleAnalyzeDependencies(_action, params, _targetPath, context) {
  if (context) context.deps_analyzed = true;
  // depth（bugfix#1.4 / rollback#4）声明了依赖树深度。CLI 不执行分析（交给 agent），
  // 但声明不能默默消失：带进结论，agent 才知道按几层看。
  const depth = Number.isSafeInteger(params?.depth) ? `，按 depth=${params.depth} 层` : '';
  return { status: 'noop', message: `依赖分析（CLI 不执行，需在对话模式由 agent 完成${depth}）` };
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
  // 测试器都跑不起来（或根本没有测试），就等于没验证 —— 只能是 skip，不能是 pass：
  // warn 在验收门禁里算「已审阅的信号」，用它表示「未执行」会让「改了代码、没验证」
  // 的运行被判成已审阅。
  return {
    status: 'skip',
    message: `修复验证未执行：${r.output.split('\n')[0].slice(0, 80) || '测试运行器不可用'} —— Bug 修复未经测试验证（不是通过）`,
  };
}

export function handleRegression(_action, _params, targetPath) {
  const r = runTestSuite(targetPath);
  if (r.kind === 'ok') return '回归测试通过';
  if (r.kind === 'failed') return { status: 'fail', message: `回归测试失败（exit ${r.exitCode}）` };
  // 以前 catch 里回「回归测试完成（无测试运行器）」→ 记 ✓ pass。没跑 = skip（不是通过）。
  return { status: 'skip', message: `回归测试未执行：${r.output.split('\n')[0].slice(0, 80) || '测试运行器不可用'} —— 不是通过` };
}

export function handleCloseTicket(_action, params, _targetPath, context) {
  if (context) context.ticket_closed = true;
  // comment：关闭时要贴的说明。以前没人读 —— 带进结论，agent 照着填。
  const note = typeof params?.comment === 'string' && params.comment ? `；待附评论：${params.comment.split(/[\r\n]+/)[0].slice(0, 60)}` : '';
  return { status: 'noop', message: `Ticket 未关闭（CLI 不执行，需在对话模式由 agent 完成${note}）` };
}
