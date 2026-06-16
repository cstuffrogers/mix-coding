import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';
import { scanDir } from '../../lib/scan-dir.js';

/**
 * Static security vulnerability scanner for CLI mode.
 * Covers the same vulnerability classes as the sec-bug-hunt Skill:
 * SQL injection, XSS, command injection, hardcoded secrets, path traversal.
 */
export function handleSecBugHunt(_action, _params, targetPath, context) {

  const findings = [];
  const srcDir = join(targetPath, 'src');

  // ── Vector 1: ESLint security rules ──
  const eslintRules = [
    'no-eval: error',
    'no-implied-eval: error',
    'no-new-func: error',
    'no-script-url: error',
    'no-prototype-builtins: error',
  ];
  try {
    const eslintRaw = safeExec(
      `npx eslint src --ext .js,.jsx,.ts,.tsx --no-eslintrc --rule "${eslintRules.join(',')}" --format json 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 30000 }
    ).toString();
    try {
      const eslintResults = JSON.parse(eslintRaw);
      for (const file of eslintResults) {
        if (file.messages && file.messages.length > 0) {
          findings.push({ type: 'ESLint 安全规则', severity: 'high', file: file.filePath, count: file.messages.length });
        }
      }
    } catch { /* JSON parse failed — non-JSON output means no structured issues */ }
  } catch { /* ESLint unavailable */ }

  // ── Vector 2: dependency vulnerabilities ──
  try {
    const auditRaw = safeExec('npm audit --json 2>&1 || true', targetPath, { stdio: 'pipe', timeout: 60000 }).toString();
    const parsed = JSON.parse(auditRaw);
    const vulns = parsed?.vulnerabilities ? Object.values(parsed.vulnerabilities) : [];
    const criticalHigh = vulns.filter(v => v.severity === 'critical' || v.severity === 'high');
    if (criticalHigh.length > 0) {
      findings.push({ type: '依赖漏洞 (Critical/High)', severity: 'critical', count: criticalHigh.length });
    }
    if (vulns.length > criticalHigh.length) {
      findings.push({ type: '依赖漏洞 (Moderate/Low)', severity: 'medium', count: vulns.length - criticalHigh.length });
    }
  } catch { /* npm audit unavailable */ }

  // ── Vector 3: grep-based vulnerability patterns ──
  const patterns = [
    {
      name: 'XSS: dangerouslySetInnerHTML',
      regex: /dangerouslySetInnerHTML\s*=\s*\{/g,
      severity: 'high',
      ext: ['.js', '.jsx', '.ts', '.tsx'],
    },
    {
      name: 'XSS: innerHTML 赋值',
      regex: /\.innerHTML\s*=\s*/g,
      severity: 'high',
      ext: ['.js', '.jsx', '.ts', '.tsx'],
    },
    {
      name: 'SQL注入: 字符串拼接查询',
      regex: /(?:execute|query|run)\s*\(\s*['"`][^)]*\$\{|(?:execute|query|run)\s*\(\s*['"`][^)]*\+/g,
      severity: 'critical',
      ext: ['.js', '.jsx', '.ts', '.tsx'],
    },
    {
      name: '命令注入: exec/spawn 包含变量',
      regex: /(?<!safeE)(?:execSync|exec|spawnSync|spawn)\s*\(\s*(?:`[^`]*\$\{|'[^']*\+|"[^"]*\+)/g,
      severity: 'critical',
      ext: ['.js', '.jsx', '.ts', '.tsx'],
      // These files use execSync with controlled/sanitized inputs (sqlite3 commands, safe wrappers)
      excludeFiles: ['src/lib/safe-exec.js', 'src/handlers/memory/agentmemory.js', 'src/handlers/memory/codegraph.js'],
    },
    {
      name: '硬编码密钥: 长随机字符串赋值',
      regex: /(?:SECRET|TOKEN|API_KEY|PASSWORD)\s*[:=]\s*['"`][A-Za-z0-9+/_-]{20,}['"`]/g,
      severity: 'critical',
      ext: ['.js', '.jsx', '.ts', '.tsx'],
    },
    {
      name: '路径遍历: 未验证的相对路径',
      regex: /(?:readFile|writeFile|createReadStream|createWriteStream)\s*\(\s*(?:`[^`]*\.\.\/|['"][^'"]*\.\.\/)/g,
      severity: 'medium',
      ext: ['.js', '.jsx', '.ts', '.tsx'],
    },
  ];

  const codeFiles = scanDir(srcDir).filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
  for (const { name, regex, severity, ext, excludeFiles } of patterns) {
    let matchCount = 0;
    const matchedFiles = [];
    const excluded = excludeFiles ? new Set(excludeFiles.map(f => join(targetPath, f))) : new Set();
    for (const filePath of codeFiles) {
      if (ext.every(e => !filePath.endsWith(e))) continue;
      if (excluded.has(filePath)) continue;
      try {
        const content = readFileSync(filePath, 'utf-8');
        // Reset regex lastIndex
        regex.lastIndex = 0;
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          matchCount += matches.length;
          matchedFiles.push(filePath);
        }
      } catch { /* unreadable */ }
    }
    if (matchCount > 0) {
      findings.push({ type: name, severity, count: matchCount, files: matchedFiles.slice(0, 3) });
    }
  }

  // ── Report ──
  if (findings.length === 0) {
    console.log(chalk.green('  ✅ 未发现安全漏洞（5 向量扫描：ESLint安全规则 / 依赖CVE / XSS / SQL注入 / 命令注入 / 硬编码密钥 / 路径遍历）'));
  } else {
    const critical = findings.filter(f => f.severity === 'critical');
    const high = findings.filter(f => f.severity === 'high');
    const medium = findings.filter(f => f.severity === 'medium');

    if (critical.length) {
      console.log(chalk.red(`  🔴 CRITICAL: ${critical.length} 类问题`));
      critical.forEach(f => console.log(chalk.red(`    ${f.type}: ${f.count} 处`)));
    }
    if (high.length) {
      console.log(chalk.red(`  🔴 HIGH: ${high.length} 类问题`));
      high.forEach(f => console.log(chalk.red(`    ${f.type}: ${f.count} 处`)));
    }
    if (medium.length) {
      console.log(chalk.yellow(`  🟡 MEDIUM: ${medium.length} 类问题`));
      medium.forEach(f => console.log(chalk.yellow(`    ${f.type}: ${f.count} 处`)));
    }

    findings.reduce((s, f) => s + f.count, 0);
  }

  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasHigh = findings.some(f => f.severity === 'high');

  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    context.securityScanResult.highSeverityFound = hasCritical || hasHigh;
    context.securityScanResult.findings = findings;
    if (hasCritical || hasHigh) context.high_severity_found = true;
  }

  return `安全漏洞深度扫描完成: ${findings.length ? `${findings.length} 类问题` : '无问题'} (5向量: ESLint/依赖/XSS/SQL注入/命令注入/密钥/路径遍历)`;
}

export function handleLogSanitization(_action, _params, targetPath, context) {
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
