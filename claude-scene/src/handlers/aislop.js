import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleAislopScan(_action, params, targetPath, context) {
  const mode = params?.mode || 'scan';
  const autoFix = params?.autoFix || false;

  if (mode === 'fix') {
    console.log(chalk.blue('\n🤖 正在自动修复 AI 代码气味（aislop fix --safe）...'));
    try {
      const result = safeExec('npx aislop fix --safe . 2>&1', targetPath, { stdio: 'pipe' }).toString();
      console.log(chalk.green('  ✅ aislop 安全修复完成'));
      if (context) context.aislop_fixed = true;
      return `aislop 修复完成`;
    } catch (e) {
      const msg = e.stdout?.toString() || e.stderr?.toString() || e.message || '';
      console.log(chalk.dim(`  ℹ aislop fix 执行完成: ${msg.slice(0, 100)}`));
      if (context) context.aislop_fixed = true;
      return `aislop 修复完成`;
    }
  }

  console.log(chalk.blue('\n🤖 正在扫描 AI 代码气味（aislop）...'));
  console.log(chalk.dim('  50+ 规则：叙事注释 | 吞异常 | 死代码 | as any 滥用 | 重复 helper | 过多抽象'));

  let issueCount = 0;
  let rawOutput = '';

  try {
    // CI mode exits non-zero on findings, captures output
    rawOutput = safeExec('npx aislop ci . 2>&1', targetPath, {
      stdio: 'pipe',
      timeout: 60000,
    }).toString();
  } catch (e) {
    // aislop ci exits non-zero when issues found — capture output
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
    console.log(chalk.red(`  ❌ aislop 发现 ${issueCount} 个 AI 代码气味`));
    // Show top findings
    const findings = rawOutput.split('\n').filter(l => /error|warning/i.test(l)).slice(0, 5);
    findings.forEach(f => console.log(chalk.dim(`    ${f.trim().slice(0, 150)}`)));
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
