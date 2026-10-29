import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';
import { readCodeFiles } from '../../lib/code-analysis-utils.js';

// Try JSON npm audit first, fall back to scraping the human-readable output.
//
// 返回值三种情况必须区分开（第十一轮）：
//   - 数字 > 0：真查到漏洞
//   - 0：npm audit 真的跑了，确实没漏洞
//   - **null**：没跑成（npm 不存在 / 离线 / 输出无法解析）
// 以前三种都返回 0，于是 handleSecurityScan 把「npm audit 没跑」写成
// `highSeverityFound = false`，security 门禁报「✓ 通过」—— 没人查过也算过。
function detectNpmVulnerabilities(targetPath) {
  try {
    const parsed = JSON.parse(safeExec('npm audit --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString());
    if (!parsed || typeof parsed !== 'object' || !('vulnerabilities' in parsed) && !('metadata' in parsed)) {
      return null; // 不是 audit 的 JSON（可能是 registry 不支持 / 报错文本）
    }
    const vulns = parsed?.vulnerabilities ? Object.keys(parsed.vulnerabilities).length : 0;
    if (vulns) return vulns;
    console.log(chalk.green('  ✅ npm: 无漏洞'));
    return 0;
  } catch {
    try {
      const audit2 = safeExec('npm audit 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
      const foundMatch = audit2.match(/(?<!\d)(\d+)\s+vulnerabilities/);
      if (foundMatch) return Math.max(Number.parseInt(foundMatch[1], 10), 0);
      if (/found\s+0\s+vulnerabilities/i.test(audit2)) return 0;
      return null; // 输出里既没有数字也没有「0 vulnerabilities」→ 不知道
    } catch { return null; }
  }
}

// Scan source files for hardcoded secrets; returns a list of finding strings.
function scanHardcodedSecrets(srcDir) {
  const secretPatterns = [
    { name: 'API Key', regex: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*['"][\w-]{20,}['"]/gi },
    { name: 'Password', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"](?!.*(?:placeholder|example|test|xxx|\*))/gi },
    { name: 'Token', regex: /(?:token|secret|jwt)\s*[:=]\s*['"][\w.-]{20,}['"]/gi },
  ];
  const findings = [];
  for (const file of readCodeFiles(srcDir)) {
    for (const { name, regex } of secretPatterns) {
      const matches = file.content.match(regex);
      if (matches) findings.push(`${name}: ${file.path} (${matches.length} 处)`);
    }
  }
  return findings;
}

export function handleSecurityScan(_action, _params, targetPath, context) {
  const issues = [];

  // null = npm audit 没跑成，不是「没漏洞」
  const npmVulns = detectNpmVulnerabilities(targetPath);
  const npmUnknown = npmVulns === null;
  if (npmVulns) issues.push(`npm: ${npmVulns} 漏洞`);

  issues.push(...scanHardcodedSecrets(join(targetPath, 'src')));

  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    // 只有「真的查到结论」才写 verdict。npm 那一侧没跑成时，不能把
    // highSeverityFound 写成 false —— security 门禁会据此报「✓ 通过」。
    if (!npmUnknown || issues.length > 0) {
      context.securityScanResult.highSeverityFound = issues.length > 0;
    }
    if (issues.length > 0) context.high_severity_found = true;
  }

  if (npmUnknown && issues.length === 0) {
    return { status: 'warn', message: '安全扫描未完成：npm audit 没给出可解析的结果，也没在源码里发现秘密（npm 这一侧没人查过，不是通过）' };
  }
  return `安全扫描完成: ${issues.length ? issues.join('; ') : '无问题'}`;
}

const SEVERITY_KEYS = ['critical', 'high', 'medium', 'low'];

function countSeverities(vulns) {
  const findings = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const vuln of Object.values(vulns)) {
    const severity = vuln.severity || 'low';
    if (findings[severity] !== undefined) findings[severity]++;
  }
  return findings;
}

// 返回 { audited, findings, unavailable }。audited = false 表示「没审成」，
// 与「审了、零漏洞」完全不同，调用方不能把两者当同一件事。
function readNpmAudit(targetPath, depthFlag) {
  let raw;
  try {
    raw = safeExec(`npm audit --json${depthFlag} 2>&1 || true`, targetPath, { stdio: 'pipe' }).toString();
  } catch (error) {
    return { audited: false, findings: countSeverities({}), unavailable: String(error.message || 'npm audit 执行失败').slice(0, 80) };
  }
  try {
    const parsed = JSON.parse(raw);
    return { audited: true, findings: countSeverities(parsed?.vulnerabilities || {}), unavailable: '' };
  } catch {
    return { audited: false, findings: countSeverities({}), unavailable: String(raw).trim().slice(0, 80) || '空输出' };
  }
}

export function handleAnalyzeSecurityVulnerabilities(_action, params, targetPath, context) {
  // depth: npm audit --depth（依赖树深度）。review#4.58 声明了 3，以前没人读。
  const depth = Number.isSafeInteger(params?.depth) && params.depth > 0 ? params.depth : undefined;
  const depthFlag = depth === undefined ? '' : ` --depth ${depth}`;
  const { audited, findings, unavailable } = readNpmAudit(targetPath, depthFlag);
  const total = SEVERITY_KEYS.reduce((sum, key) => sum + findings[key], 0);
  if (!audited) {
    // 以前 npm audit 没跑成时 findings 全 0 → highSeverityFound = false → 安全门禁
    // 报「✓ 通过」。审计没跑成不是「没漏洞」，所以这里**不写**那个字段（留 undefined
    // 让门禁如实跳过）。
    return { status: 'warn', message: `安全漏洞分析未完成：npm audit 没给出可解析的结果（${unavailable}）` };
  }
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

// npm outdated 的两种输出形式（JSON / 人类可读）都可能是「查了，没有」。
// 返回 { queried, packages }：queried 为 false 时调用方不得发任何结论。
function collectDeprecated(raw) {
  if (raw.trim() === '') return { queried: true, packages: [] };
  try {
    const parsed = JSON.parse(raw);
    const packages = [];
    for (const [name, info] of Object.entries(parsed)) {
      if (info.deprecated) packages.push(`${name} (${info.current} → ${info.latest})`);
    }
    return { queried: true, packages };
  } catch {
    const lines = raw.split('\n').filter(Boolean);
    const looksLikeData = lines.some((l) => /wanted|unsupported|deprecated/i.test(l));
    if (!looksLikeData) return { queried: false, packages: [] };
    return { queried: true, packages: lines.map((l) => l.trim().slice(0, 120)) };
  }
}

export function handleDeprecatedDeps(_action, _params, targetPath, context) {
  // 第十一轮：跟 npm audit 同一个病 —— npm outdated 没跑成时 deprecatedCount 仍是 0，
  // 于是 deprecatedDepsPassed = true，门禁报「✓ 通过」。没查过不能算过。
  let outcome = { queried: false, packages: [] };
  try {
    const raw = safeExec('npm outdated --json 2>&1 || true', targetPath, { stdio: 'pipe', timeout: 60000 }).toString();
    outcome = collectDeprecated(raw);
  } catch { /* npm outdated unavailable */ }

  const { queried, packages: deprecatedPkgs } = outcome;
  const deprecatedCount = deprecatedPkgs.length;

  if (deprecatedCount > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${deprecatedCount} 个废弃依赖`));
    deprecatedPkgs.slice(0, 5).forEach(p => console.log(chalk.dim(`    ${p}`)));
  } else if (queried) {
    console.log(chalk.green('  ✅ 未发现废弃依赖'));
  } else {
    console.log(chalk.yellow('  ⚠ npm outdated 没给可用输出，废弃依赖未检查'));
  }

  if (context) {
    // 只有真查过才写 verdict；没查过留 undefined 让门禁如实跳过
    if (queried) context.deprecatedDepsPassed = deprecatedCount === 0;
  }
  if (!queried && deprecatedCount === 0) {
    return { status: 'warn', message: '废弃依赖检测未完成：npm outdated 没给出可用输出（不是通过）' };
  }
  return `废弃依赖检测完成: ${deprecatedCount} 个`;
}
