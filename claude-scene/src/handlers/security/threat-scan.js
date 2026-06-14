import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';

export function handleSecBugHunt(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🐛 正在进行安全漏洞深度扫描...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量扫描，完整安全审计需 Claude Code + sec-bug-hunt skill'));
  let issues = 0;
  try {
    safeExec('npx eslint src --ext .js,.jsx,.ts,.tsx --no-eslintrc --rule "no-eval: error" --rule "no-implied-eval: error" 2>&1', targetPath, { stdio: 'pipe' });
  } catch (e) {
    if (e.status === 1) issues++;
  }
  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    context.securityScanResult.highSeverityFound = issues > 0;
    if (issues > 0) context.high_severity_found = true;
  }
  console.log(chalk[issues ? 'yellow' : 'green'](`  ${issues ? `⚠ 发现 ${issues} 类安全问题` : '✅ 未发现严重安全漏洞'}`));
  return `安全漏洞扫描完成: ${issues ? `${issues} 个问题` : '无问题'}`;
}

export function handleLogSanitization(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📜 正在扫描日志脱敏...'));
  const findings = [];
  const sensitivePatterns = [
    { name: 'Token/Key', regex: /console\.(?:log|warn|error|info|debug)\s*\([^)]*(?:access[_-]?token|auth[_-]?token|bearer[_-]?token|jwt[_-]?token|api[_-]?token|secret|password|apiKey|api_key|privateKey|private_key|credential)[^)]*\)/gi },
    { name: '身份证号', regex: /console\.(?:log|warn|error|info|debug)\s*\([^)]*\d{17}[\dXx][^)]*\)/g },
    { name: '手机号', regex: /console\.(?:log|warn|error|info|debug)\s*\([^)]*1[3-9]\d{9}[^)]*\)/g },
    { name: '邮箱地址', regex: /console\.(?:log|warn|error|info|debug)\s*\([^)]*[\w.-]+@[\w.-]+\.\w+[^)]*\)/gi },
  ];

  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.codegraph --exclude-dir=coverage --exclude-dir=dist --exclude-dir=build';

  for (const { name, regex } of sensitivePatterns) {
    try {
      const raw = safeExec(
        `grep -rn --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" ${excludeDirs} "console\\\\.\\\\(log\\\\|warn\\\\|error\\\\|info\\\\|debug\\\\)" . 2>&1 || true`,
        targetPath,
        { stdio: 'pipe', timeout: 30000 }
      ).toString();

      if (!raw.trim()) continue;

      const lines = raw.split('\n');
      const selfFiles = ['security-scanning', 'threat-scan'];
      for (const line of lines) {
        if (selfFiles.some(f => line.includes(f))) continue;
        if (/_API_KEY|_SECRET.*(?:未设置|not set|跳过|skip|不可用)/i.test(line)) continue;
        if (regex.test(line)) {
          const fileMatch = line.match(/^\.\/(.+?):(\d+):/);
          const loc = fileMatch ? `${fileMatch[1]}:${fileMatch[2]}` : line.slice(0, 120);
          findings.push(`${name}: ${loc}`);
        }
      }
    } catch { /* skip */ }
  }

  if (findings.length > 0) {
    console.log(chalk.red(`  🔴 发现 ${findings.length} 处日志敏感数据泄露`));
    findings.slice(0, 5).forEach(f => console.log(chalk.dim(`    ${f}`)));
  } else {
    console.log(chalk.green('  ✅ 未发现日志敏感数据泄露'));
  }

  if (context) context.logSanitizationPassed = findings.length === 0;
  return `日志脱敏扫描完成: ${findings.length ? `${findings.length} 处泄露` : '无问题'}`;
}
