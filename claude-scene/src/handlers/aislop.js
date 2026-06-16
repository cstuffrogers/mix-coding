import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleAislopScan(_action, params, targetPath, context) {
  const mode = params?.mode || 'scan';

  if (mode === 'fix') {
    try {
      safeExec('npx aislop fix --safe . 2>&1', targetPath, { stdio: 'pipe' }).toString();
      if (context) context.aislop_fixed = true;
      return `aislop 修复完成`;
    } catch {
      if (context) context.aislop_fixed = true;
      return `aislop 修复完成`;
    }
  }

  let issueCount = 0;
  let rawOutput = '';

  try {
    // CI mode exits non-zero on findings, captures output
    rawOutput = safeExec('npx aislop ci . 2>&1', targetPath, {
      stdio: 'pipe',
      timeout: 60000,
    }).toString();
  } catch (e) {
    // aislop CI exits non-zero when issues found — capture output
    rawOutput = e.stdout?.toString() || e.stderr?.toString() || '';
  }

  if (rawOutput) {
    // Try to parse issue count from output
    const countMatch = rawOutput.match(/(\d+)\s+issues?|problems?/i);
    if (countMatch) issueCount = parseInt(countMatch[1]);

    // Also count individual lines that look like findings
    if (issueCount === 0) {
      const findingLines = rawOutput.split('\n').filter(l =>
        /error|warning|issue|problem/i.test(l) && !/no (issues|problems|findings)/i.test(l)
      );
      issueCount = findingLines.length;
    }
  }

  if (issueCount > 0) {
    // Top findings extracted from rawOutput
  } else {
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
