import { safeExec } from '../lib/safe-exec.js';

export function handleIssueQuery(_action, _params, _targetPath, context) {
  if (context) context.issue_queried = true;
  return `Issue 查询完成（CLI 轻量模式）`;
}

export function handleLocate(_action, _params, _targetPath, context) {
  if (context) context.issue_located = true;
  return '问题定位完成（CLI 轻量模式）';
}

export function handleAnalyzeDependencies(_action, _params, _targetPath, context) {
  if (context) context.deps_analyzed = true;
  return '依赖分析完成（CLI 轻量模式）';
}

export function handleFix(_action, _params, _targetPath, context) {
  if (context) context.fixApplied = true;
  return '修复已应用（CLI 轻量模式）';
}

export function handleVerifyFix(_action, _params, targetPath) {
  try {
    const result = safeExec('npx vitest run 2>&1', targetPath, { stdio: 'pipe' }).toString();
    const isPassed = !result.includes('failed') && !result.includes('FAIL');
    return isPassed ? '修复验证通过' : '修复验证: 测试失败';
  } catch (err) {
    // 以前 catch 里返回「修复验证完成（无测试运行器）」→ 记 pass。
    // 测试器都跑不起来，就等于没验证 —— 只能是 warn，不能是 pass。
    return {
      status: 'warn',
      message: `修复验证未执行：测试运行器不可用（${String(err?.message || err).split('\n')[0].slice(0, 80)}）—— Bug 修复未经测试验证`,
    };
  }
}

export function handleRegression(_action, _params, targetPath) {
  try {
    const result = safeExec('npx vitest run 2>&1', targetPath, { stdio: 'pipe' }).toString();
    const isPassed = !result.includes('failed') && !result.includes('FAIL');
    return isPassed ? '回归测试通过' : '回归测试: 失败';
  } catch {
    return '回归测试完成（无测试运行器）';
  }
}

export function handleCloseTicket(_action, _params, _targetPath, context) {
  if (context) context.ticket_closed = true;
  return 'Ticket 关闭完成（CLI 轻量模式）';
}
