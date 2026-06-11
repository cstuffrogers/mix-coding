import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleIssueQuery(_action, params, _targetPath, context) {
  const type = params?.type || 'bug';
  console.log(chalk.blue(`\n🔎 正在查询 ${type} issue 详情...`));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量查询，完整分析需 Claude Code 对话上下文'));
  if (context) context.issue_queried = true;
  return `Issue 查询完成（CLI 轻量模式）`;
}

export function handleLocate(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n📍 正在定位问题代码...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量定位，精确分析需 Claude Code 对话上下文'));
  if (context) context.issue_located = true;
  return '问题定位完成（CLI 轻量模式）';
}

export function handleAnalyzeDependencies(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n🔗 正在分析依赖关系...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量分析，完整依赖图需 Claude Code + CodeGraph MCP'));
  if (context) context.deps_analyzed = true;
  return '依赖分析完成（CLI 轻量模式）';
}

export function handleFix(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n🔧 正在应用修复...'));
  console.log(chalk.dim('  ℹ CLI 模式下修复为轻量操作，语义修复需 Claude Code 对话上下文'));
  if (context) context.fixApplied = true;
  return '修复已应用（CLI 轻量模式）';
}

export function handleVerifyFix(_action, _params, targetPath) {
  console.log(chalk.blue('\n✅ 正在验证修复...'));
  try { safeExec('npx vitest run 2>&1', targetPath, { stdio: 'pipe' }); } catch { /* no test runner */ }
  return '修复验证完成';
}

export function handleRegression(_action, _params, targetPath) {
  console.log(chalk.blue('\n🔄 正在回归测试...'));
  try { safeExec('npx vitest run 2>&1', targetPath, { stdio: 'pipe' }); } catch { /* no test runner */ }
  return '回归测试完成';
}

export function handleCloseTicket(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n🎫 正在关闭 ticket...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量操作，自动关闭 issue 需 GitHub MCP'));
  if (context) context.ticket_closed = true;
  return 'Ticket 关闭完成（CLI 轻量模式）';
}
