import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';
import { scanDir } from '../../lib/scan-dir.js';
import { assertSources, codeRoots, listProjectCodeFiles } from '../../lib/project-sources.js';

/**
 * Static security vulnerability scanner for CLI mode.
 * Covers the same vulnerability classes as the sec-bug-hunt Skill:
 * SQL injection, XSS, command injection, hardcoded secrets, path traversal.
 */
function _runEslintOnRoot(bin, root, eslintRules, targetPath) {
  for (const flag of ['--no-config-lookup', '--no-eslintrc']) {
    try {
      const eslintRaw = safeExec(
        `"${bin}" "${root}" --ext .js,.jsx,.mjs,.cjs ${flag} --rule "${eslintRules.join(',')}" --format json 2>&1 || true`,
        targetPath,
        { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024, timeout: 120000 }
      ).toString();
      let parsed;
      try {
        parsed = JSON.parse(eslintRaw);
      } catch {
        continue;
      }
      const out = [];
      for (const file of parsed) {
        if (file.messages && file.messages.length > 0) {
          out.push({ type: 'ESLint 安全规则', severity: 'high', file: file.filePath, count: file.messages.length });
        }
      }
      return out;
    } catch {
      /* 换下一个 flag */
    }
  }
  return null;
}

function scanEslintSecurity(targetPath, files = []) {
  const eslintRules = [
    'no-eval: error',
    'no-implied-eval: error',
    'no-new-func: error',
    'no-script-url: error',
    'no-prototype-builtins: error',
  ];
  // [patched:scan-all-sources] 原来固定跑 `npx eslint src`（本项目没有 src/ → 0 文件）。
  // 改为「项目里真实的 JS 目录 + 项目自带的 eslint 可执行文件」，并且只用 espree
  // 能解析的 js/jsx —— TS/TSX 由 review 的 lint/typecheck 门禁覆盖（那边用项目自己的 parser）。
  const jsFiles = files.filter((f) => /\.(js|jsx|mjs|cjs)$/i.test(f));
  if (jsFiles.length === 0) return [];
  const roots = codeRoots(targetPath, jsFiles);
  const bin = findEslintBin(targetPath, jsFiles);
  if (!bin) {
    console.log(chalk.dim('  ℹ 未找到项目内 eslint 可执行文件，跳过 ESLint 安全规则向量（TS/TSX 已由 lint 门禁覆盖）'));
    return [];
  }
  const findings = [];
  for (const root of roots) {
    const result = _runEslintOnRoot(bin, root, eslintRules, targetPath);
    if (result) findings.push(...result);
  }
  return findings;
}

function findEslintBin(targetPath, files) {
  const exe = process.platform === 'win32' ? 'eslint.cmd' : 'eslint';
  // 从文件路径逐级向上找最近的 node_modules/.bin/eslint（前端代码常在 frontend/<app>/）
  const dirs = new Set();
  for (const file of files) {
    let dir = dirname(file);
    while (dir && dir.length >= targetPath.length) {
      dirs.add(dir);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  for (const dir of dirs) {
    const bin = join(dir, 'node_modules', '.bin', exe);
    if (existsSync(bin)) return bin;
  }
  return null;
}
function _auditOneDir(targetPath, dir) {
  try {
    const auditRaw = safeExec('npm audit --json 2>&1 || true', dir, {
      stdio: 'pipe',
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    }).toString();
    if (/NOT_IMPLEMENTED|E404|404 Not Found/i.test(auditRaw)) {
      return { unavailable: true, findings: [] };
    }
    let parsed;
    try {
      parsed = JSON.parse(auditRaw);
    } catch {
      return { unavailable: false, findings: [] };
    }
    const vulns = parsed && parsed.vulnerabilities ? Object.values(parsed.vulnerabilities) : [];
    const criticalHigh = vulns.filter((v) => v.severity === 'critical' || v.severity === 'high');
    const where = relative(targetPath, dir) || '.';
    const findings = [];
    if (criticalHigh.length > 0) {
      findings.push({ type: `依赖漏洞 (Critical/High) @ ${where}`, severity: 'critical', count: criticalHigh.length });
    }
    if (vulns.length > criticalHigh.length) {
      findings.push({ type: `依赖漏洞 (Moderate/Low) @ ${where}`, severity: 'medium', count: vulns.length - criticalHigh.length });
    }
    return { unavailable: false, findings };
  } catch {
    return { unavailable: false, findings: [] };
  }
}

function scanNpmAudit(targetPath) {
  // [patched:scan-all-sources] 原来只在仓库根跑一次 `npm audit`；多前端仓库
  // 真正的依赖在 frontend/*/，根 package.json 往往只有 devDeps。
  const lockFiles = scanDir(targetPath).filter((f) => /(^|[\\/])package-lock\.json$/.test(f));
  const dirs = [...new Set(lockFiles.map((f) => dirname(f)))].slice(0, 4);
  if (dirs.length === 0) {
    return { findings: [], note: '未找到 package-lock.json，依赖审计未执行' };
  }
  const findings = [];
  let unavailable = 0;
  for (const dir of dirs) {
    const r = _auditOneDir(targetPath, dir);
    if (r.unavailable) { unavailable += 1; continue; }
    findings.push(...r.findings);
  }
  const note = unavailable > 0
    ? `${unavailable}/${dirs.length} 个 package-lock 的 npm audit 接口不可用（registry 不支持 audit API），依赖漏洞未知`
    : '';
  return { findings, note };
}
const VULN_PATTERNS = [
  { name: 'XSS: dangerouslySetInnerHTML', regex: /dangerouslySetInnerHTML\s*=\s*\{/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: 'XSS: innerHTML 赋值', regex: /\.innerHTML\s*=\s*/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: 'SQL注入: 模板字面量拼接', regex: /(?:execute|query|run)\s*\(\s*['"`][^)]*\$\{/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: 'SQL注入: 字符串拼接查询', regex: /(?:execute|query|run)\s*\(\s*['"`][^)]*\+/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: '命令注入: exec/spawn 包含变量', regex: /(?<!safeE)(?:execSync|exec|spawnSync|spawn)\s*\(\s*(?:`[^`]*\$\{|'[^']*\+|"[^"]*\+)/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'], excludeFiles: ['src/lib/safe-exec.js', 'src/handlers/memory/agentmemory.js', 'src/handlers/memory/codegraph.js', 'src/handlers/llm-proxy-audit.js'] },
  { name: '硬编码密钥: 长随机字符串赋值', regex: /(?:SECRET|TOKEN|API_KEY|PASSWORD)\s*[:=]\s*['"`][A-Za-z0-9+/_-]{20,}['"`]/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: '路径遍历: 未验证的相对路径', regex: /(?:readFile|writeFile|createReadStream|createWriteStream)\s*\(\s*(?:`[^`]*\.\.\/|['"][^'"]*\.\.\/)/g, severity: 'medium', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  // [patched:open-redirect] 盲区：服务端直接把请求参数当跳转目标，攻击者用
  // `?next=https://evil.example` 就能把用户带去任意外站（钓鱼/偷 token）。
  // 三种写法分开列（直取 / 模板串 / Python 侧），漏一种就等于没扫。
  { name: '开放重定向: redirect 目标直接取自请求参数', regex: /(?:res|response|reply)\.redirect\s*\(\s*(?:req|request)\.(?:query|params|body)\b/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: '开放重定向: redirect 模板串里拼请求参数', regex: /(?:res|response|reply)\.redirect\s*\(\s*`[^`]*\b(?:req|request)\.(?:query|params|body)\b/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: '开放重定向(Python): redirect 目标取自 request.args/GET', regex: /(?:redirect|HttpResponseRedirect)\s*\(\s*request\.(?:args|GET|form|POST)\b/g, severity: 'high', ext: ['.py'] },
  // [patched:scan-all-sources] 原规则只覆盖 JS/TS，Python 后端（本仓库 backend/）完全不可见
  { name: 'SQL注入(Python): f-string 拼接查询', regex: /(?:execute|executemany)\s*\(\s*(?:text\s*\(\s*)?f["']/g, severity: 'critical', ext: ['.py'] },
  { name: '命令注入(Python): os.system / subprocess shell=True', regex: /(?:os\.system\s*\(|subprocess\.\w+\s*\([^)]*shell\s*=\s*True)/g, severity: 'critical', ext: ['.py'] },
  { name: '硬编码密钥(Python)', regex: /(?:API_KEY|SECRET_KEY|PASSWORD|DATABASE_URL)\s*=\s*["'][^"']{16,}["']/g, severity: 'critical', ext: ['.py'] },
];

function scanPatternInFiles(filePath, pattern, targetPath) {
  const { name, regex, severity, ext, excludeFiles } = pattern;
  if (ext.every(e => !filePath.endsWith(e))) return null;
  const excluded = excludeFiles ? new Set(excludeFiles.map(f => join(targetPath, f))) : new Set();
  if (excluded.has(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    // [patched:nosec-allow] 支持行内豁免（bandit/eslint 的 nosec 习惯）。
    // 只用于「值根本无法参数化」的合法场景：DDL 的标识符（表名/列名/类型名）、
    // information_schema 查询的表名常量。豁免必须在同一行写明理由，方便审计。
    // 注意：跨行 SQL 的豁免注释要写在这条语句的起始行（命中位置所在行）。
    const lines = content.split('\n');
    let count = 0;
    for (const m of content.matchAll(regex)) {
      if (/\bnosec\b/i.test(lines[(content.slice(0, m.index).match(/\n/g) || []).length] || '')) continue;
      count += 1;
    }
    if (count > 0) return { type: name, severity, count, files: [filePath] };
  } catch { /* unreadable */ }
  return null;
}

function scanGrepPatterns(files, targetPath) {
  // [patched:scan-all-sources] 原来只扫 join(targetPath, 'src') → 本项目 0 文件
  const codeFiles = files.filter((f) => /\.(js|jsx|ts|tsx|py)$/i.test(f));
  const findings = [];
  for (const pattern of VULN_PATTERNS) {
    let matchCount = 0;
    const matchedFiles = [];
    for (const filePath of codeFiles) {
      const result = scanPatternInFiles(filePath, pattern, targetPath);
      if (result) {
        matchCount += result.count;
        matchedFiles.push(filePath);
      }
    }
    if (matchCount > 0) {
      findings.push({ type: pattern.name, severity: pattern.severity, count: matchCount, files: matchedFiles.slice(0, 3) });
    }
  }
  return findings;
}
function reportFindings(findings) {
  if (findings.length === 0) {
    return;
  }
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
}

function setContextResults(context, findings) {
  if (!context) return;
  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasHigh = findings.some(f => f.severity === 'high');
  context.securityScanResult = context.securityScanResult || {};
  context.securityScanResult.highSeverityFound = hasCritical || hasHigh;
  context.securityScanResult.findings = findings;
  if (hasCritical || hasHigh) context.high_severity_found = true;
}

export function handleSecBugHunt(_action, _params, targetPath, context) {
  // [patched:scan-all-sources] 三个向量原来都只认 <repo>/src（本项目没有 src/ → 扫 0 文件仍报「无问题」）
  const files = listProjectCodeFiles(targetPath);
  if (!assertSources(files, context, '安全漏洞扫描')) {
    return '安全漏洞深度扫描失败: 未找到任何源码文件（扫描范围为空，结果不可信）';
  }
  const npmAudit = scanNpmAudit(targetPath);
  const findings = [
    ...scanEslintSecurity(targetPath, files),
    ...npmAudit.findings,
    ...scanGrepPatterns(files, targetPath),
  ];

  reportFindings(findings);
  setContextResults(context, findings);

  // [patched:verdict-unify] 高/严重问题必须计入场景 ✗ fail：否则
  // 「review 报告 failed: N」与「场景 fail: 0」两套口径互相矛盾。
  if (context && findings.some((f) => f.severity === 'critical' || f.severity === 'high')) {
    context.lastStepFailed = true;
  }

  const note = npmAudit.note ? `；${npmAudit.note}` : '';
  return `安全漏洞深度扫描完成: ${findings.length ? `${findings.length} 类问题` : '无问题'}（扫描 ${files.length} 个源码文件${note}）`;
}
function grepConsoleLines(targetPath) {
  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.codegraph --exclude-dir=coverage --exclude-dir=dist --exclude-dir=build';
  // [patched:logsan-maxbuffer] execSync 默认 maxBuffer 只有 1MB，大仓库直接 ENOBUFS 抛异常，
  // 整个扫描被跳过却仍记为 pass。这里放宽上限并给行数兜底。
  const maxBuffer = Number(process.env.SCENE_LOGSCAN_MAXBUFFER || 32 * 1024 * 1024);
  const maxLines = Number(process.env.SCENE_LOGSCAN_MAXLINES || 5000);
  try {
    return safeExec(
    `grep -rn --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" ${excludeDirs} "console\\\\.\\\\(log\\\\|warn\\\\|error\\\\|info\\\\|debug\\\\)" . 2>&1 | head -n ${maxLines}`,
    targetPath,
    { stdio: 'pipe', timeout: 60000, maxBuffer }
  ).toString();
  } catch (error) {
    // [patched:logsan-maxbuffer] 交给 handleLogSanitization 判定失败，绝不静默当通过
    throw new Error(`log-sanitization grep 失败（maxBuffer=${maxBuffer}）: ${error.message}`, { cause: error });
  }
}

function isSelfFile(line) {
  return ['security-scanning', 'threat-scan'].some(f => line.includes(f));
}

const TOKEN_TYPES = ['access', 'auth', 'bearer', 'api'];
const tokenRe = RegExp('console\\.(?:log|warn|error|info|debug)\\s*\\([^)]*(?:' + TOKEN_TYPES.join('|') + ')[_-]?token', 'gi');
const credRe = /console\.(?:log|warn|error|info|debug)\s*\([^)]*credential/gi;
const jwtRe = /console\.(?:log|warn|error|info|debug)\s*\([^)]*\bjwt[_-]?token/gi;
const secretRe = /console\.(?:log|warn|error|info|debug)\s*\([^)]*(?:secret|password|apiKey|api_key|privateKey|private_key)/gi;
const LOG_SENSITIVE_PATTERNS = [
  { name: 'Token-Key', regex: tokenRe },
  { name: 'Token-Key', regex: credRe },
  { name: 'Token-JWT', regex: jwtRe },
  { name: 'Token-Secret', regex: secretRe },
  { name: '身份证号', regex: /console\.(?:log|warn|error|info|debug)\s*\([^)\d]*\d{17}[\dXx]/g },
  { name: '手机号', regex: /console\.(?:log|warn|error|info|debug)\s*\([^)]*?1[3-9]\d{9}/g },
  { name: '邮箱地址', regex: /console\.(?:log|warn|error|info|debug)\s*\([^\s()]+@[^\s()]+/gi },

];

function checkLineForPattern(line) {
  for (const { name, regex } of LOG_SENSITIVE_PATTERNS) {
    if (!regex.test(line)) continue;
    const fileMatch = line.match(/^\.\/(.+?):(\d+):/);
    const loc = fileMatch ? `${fileMatch[1]}:${fileMatch[2]}` : line.slice(0, 120);
    return `${name}: ${loc}`;
  }
  return null;
}

// [patched:logsan-maxbuffer] 逐行判定抽出来，把 handleLogSanitization 的认知复杂度压回限制内。
function _collectLogFindings(raw) {
  const findings = [];
  for (const line of raw.split('\n')) {
    if (isSelfFile(line)) continue;
    if (/_API_KEY|_SECRET.*(?:未设置|not set|跳过|skip|不可用)/i.test(line)) continue;
    const result = checkLineForPattern(line);
    if (result) findings.push(result);
  }
  return findings;
}

export function handleLogSanitization(_action, _params, targetPath, context) {
  let raw;
  try {
    raw = grepConsoleLines(targetPath);
  } catch (error) {
    // [patched:logsan-maxbuffer] 扫描本身失败必须计入 fail，不能返回「部分操作可能失败」被算成 pass
    console.log(chalk.red(`  ❌ 日志脱敏扫描失败: ${error.message}`));
    if (context) context.lastStepFailed = true;
    return `日志脱敏扫描失败（未能扫描，结果不可信）: ${error.message}`;
  }
  if (!raw.trim()) {
    return '日志脱敏扫描完成: 无问题';
  }

  const findings = _collectLogFindings(raw);

  if (findings.length > 0) {
    console.log(chalk.red(`  🔴 发现 ${findings.length} 处日志敏感数据泄露`));
    for (const f of findings.slice(0, 5)) console.log(chalk.dim(`    ${f}`));
  } else {
    console.log(chalk.green('  ✅ 未发现日志敏感数据泄露'));
  }

  if (context) context.logSanitizationPassed = findings.length === 0;
  return `日志脱敏扫描完成: ${findings.length ? `${findings.length} 处泄露` : '无问题'}`;
}
