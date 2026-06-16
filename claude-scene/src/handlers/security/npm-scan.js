import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';
import { readCodeFiles } from '../../lib/code-analysis-utils.js';

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleSecurityScan(_action, _params, targetPath, context) {
  const issues = [];

  try {
    const audit = safeExec('npm audit --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    const parsed = JSON.parse(audit);
    const vulns = parsed?.vulnerabilities ? Object.keys(parsed.vulnerabilities).length : 0;
    if (vulns) {
      issues.push(`npm: ${vulns} 漏洞`);
    } else {
      console.log(chalk.green('  ✅ npm: 无漏洞'));
    }
  } catch {
    try {
      const audit2 = safeExec('npm audit 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
      // eslint-disable-next-line sonarjs/slow-regex
      const foundMatch = audit2.match(/(\d+)\s+vulnerabilities/);
      if (foundMatch && parseInt(foundMatch[1]) > 0) {
        issues.push(`npm: ${foundMatch[1]} 漏洞`);
      }
    } catch { /* fallback */ }
  }

  const srcDir = join(targetPath, 'src');
  const secretPatterns = [
    { name: 'API Key', regex: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*['"][\w-]{20,}['"]/gi },
    { name: 'Password', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"](?!.*(?:placeholder|example|test|xxx|\*))/gi },
    { name: 'Token', regex: /(?:token|secret|jwt)\s*[:=]\s*['"][\w.-]{20,}['"]/gi },
  ];
  for (const file of readCodeFiles(srcDir)) {
    for (const { name, regex } of secretPatterns) {
      const matches = file.content.match(regex);
      if (matches) {
        issues.push(`${name}: ${file.path} (${matches.length} 处)`);
      }
    }
  }

  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    context.securityScanResult.highSeverityFound = issues.length > 0;
    if (issues.length > 0) context.high_severity_found = true;
  }

  return `安全扫描完成: ${issues.length ? issues.join('; ') : '无问题'}`;
}

export function handleAnalyzeSecurityVulnerabilities(_action, _params, targetPath, context) {
  const findings = { critical: 0, high: 0, medium: 0, low: 0 };
  try {
    const audit = safeExec('npm audit --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    try {
      const parsed = JSON.parse(audit);
      const vulns = parsed?.vulnerabilities || {};
      for (const v of Object.values(vulns)) {
        const severity = v.severity || 'low';
        if (findings[severity] !== undefined) findings[severity]++;
      }
    } catch { /* JSON parse failed */ }
  } catch { /* npm audit unavailable */ }
  const total = findings.critical + findings.high + findings.medium + findings.low;
  if (total) {
    console.log(chalk.yellow(`  ⚠ 漏洞: Critical ${findings.critical}, High ${findings.high}, Medium ${findings.medium}, Low ${findings.low}`));
  } else {
    console.log(chalk.green('  ✅ 未发现已知漏洞'));
  }
  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    context.securityScanResult.highSeverityFound = (findings.critical + findings.high) > 0;
    context.securityScanResult.vulnerabilityCount = total;
    if ((findings.critical + findings.high) > 0) context.high_severity_found = true;
  }
  return `安全漏洞分析完成: ${total} 个漏洞`;
}

export function handleDeprecatedDeps(_action, _params, targetPath, context) {
  let deprecatedCount = 0;
  const deprecatedPkgs = [];

  try {
    const raw = safeExec('npm outdated --json 2>&1 || true', targetPath, { stdio: 'pipe', timeout: 60000 }).toString();
    try {
      const parsed = JSON.parse(raw);
      for (const [name, info] of Object.entries(parsed)) {
        if (info.deprecated) {
          deprecatedPkgs.push(`${name} (${info.current} → ${info.latest})`);
          deprecatedCount++;
        }
      }
    } catch {
      const lines = raw.split('\n').filter(Boolean);
      for (const l of lines) {
        if (/wanted|unsupported|deprecated/i.test(l)) {
          deprecatedPkgs.push(l.trim().slice(0, 120));
          deprecatedCount++;
        }
      }
    }
  } catch { /* npm outdated unavailable */ }

  if (deprecatedCount > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${deprecatedCount} 个废弃依赖`));
    deprecatedPkgs.slice(0, 5).forEach(p => console.log(chalk.dim(`    ${p}`)));
  } else {
    console.log(chalk.green('  ✅ 未发现废弃依赖'));
  }

  if (context) context.deprecatedDepsPassed = deprecatedCount === 0;
  return `废弃依赖检测完成: ${deprecatedCount} 个`;
}
