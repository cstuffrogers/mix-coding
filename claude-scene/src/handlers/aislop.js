import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

function handleAislopFixMode(params, targetPath, context) {
  try {
    safeExec('npx aislop fix --safe . 2>&1', targetPath, { stdio: 'pipe' }).toString();
    if (context) context.aislop_fixed = true;
    return `aislop 修复完成`;
  } catch {
    if (context) context.aislop_fixed = true;
    return `aislop 修复完成`;
  }
}

function countAislopIssues(rawOutput) {
  const countMatch = rawOutput.match(/(?<!\d)(\d+)\s+(?:issues?|problems?)/i);
  if (countMatch) return parseInt(countMatch[1]);
  return rawOutput.split('\n').filter(l =>
    /error|warning|issue|problem/i.test(l) && !/no (issues|problems|findings)/i.test(l)
  ).length;
}

function runAislopCi(targetPath) {
  try {
    return safeExec('npx aislop ci . 2>&1', targetPath, {
      stdio: 'pipe',
      timeout: 60000,
    }).toString();
  } catch (e) {
    return e.stdout?.toString() || e.stderr?.toString() || '';
  }
}

export function handleAislopScan(_action, params, targetPath, context) {
  const mode = params?.mode || 'scan';
  if (mode === 'fix') return handleAislopFixMode(params, targetPath, context);

  const rawOutput = runAislopCi(targetPath);
  const issueCount = rawOutput ? countAislopIssues(rawOutput) : 0;

  if (issueCount === 0) {
    console.log(chalk.green('  ✅ aislop 未发现 AI 代码气味'));
  }

  if (context) {
    context.aislopPassed = issueCount === 0;
    context.aislop_issue_count = issueCount;
  }

  return issueCount > 0
    ? `aislop 扫描完成: ${issueCount} 个 AI 代码气味`
    : 'aislop 扫描完成: 无问题';
}
