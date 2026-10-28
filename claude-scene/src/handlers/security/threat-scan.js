import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import chalk from 'chalk';
import { safeExec, safeExecFile } from '../../lib/safe-exec.js';
import { scanDir } from '../../lib/scan-dir.js';
import { assertSources, listProjectCodeFiles } from '../../lib/project-sources.js';

/**
 * Static security vulnerability scanner for CLI mode.
 * Covers the same vulnerability classes as the sec-bug-hunt Skill:
 * SQL injection, XSS, command injection, hardcoded secrets, path traversal.
 */
// 收集 eslint --format json 的结果。只认**本次显式传入**的安全规则：
// `--no-config-lookup` 在部分 eslint 版本/配置形态下不生效，项目自己的 lint 规则
// （sonarjs/*、import-x/*）会跟着冒出来，被当成「安全 HIGH」记进 findings →
// 57 个文件 112 条全是 lint 噪音（含 3 条「Unused eslint-disable directive」）。
// 那些规则由 `npm run lint` 门禁管，这里重复计数就等于假红。
export function _collectEslintMessages(parsed, eslintRules, out) {
  const allowed = new Set(eslintRules.map((r) => r.split(':')[0].trim()));
  let parseErrors = 0;
  for (const file of parsed) {
    const messages = file.messages || [];
    const hits = messages.filter((m) => m.ruleId && allowed.has(m.ruleId));
    // 解析失败 = 这个文件根本没被检查，不能说「扫过了没问题」
    parseErrors += messages.filter((m) => !m.ruleId && m.fatal).length;
    if (hits.length > 0) {
      out.push({
        type: 'ESLint 安全规则',
        severity: 'high',
        file: file.filePath,
        count: hits.length,
        rules: [...new Set(hits.map((m) => m.ruleId))],
      });
    }
  }
  return parseErrors;
}

// 直接传文件清单，不传目录：传目录时 eslint 会把 root 下的一切都走一遍，
// 构建产物（build/web/canvaskit.js、.dart_tool/、vendored 的 *-win32-x64/lib/dist）
// 又全回来了。清单来自 listProjectCodeFiles，已经排除这些。
function _parseEslintChunk(cmd, entry, chunk, eslintRules, flag, targetPath) {
  const args = [
    ...(entry ? [entry] : []),
    ...chunk,
    '--ext', '.js,.jsx,.mjs,.cjs', flag,
    '--rule', eslintRules.join(','),
    '--format', 'json',
  ];
  let raw;
  try {
    raw = safeExecFile(cmd, args, targetPath, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024, timeout: 120000 }).toString();
  } catch (error) {
    // eslint 命中规则时退出码非 0，结果仍在 stdout
    raw = error.stdout ? error.stdout.toString() : '';
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function _runEslintOnFiles(bin, files, eslintRules, targetPath) {
  const ESLINT_CHUNK = 60;
  // .bin/eslint.cmd 在 Node ≥ 18.20 已不能被直接 execFile（EINVAL），
  // 而且 .cmd 只是壳。优先用包里的 JS 入口 + 当前 node：绕开 .cmd，也不经过 shell。
  const entry = resolveEslintEntry(bin);
  // entry 是 .js 文件，必须用当前 node 执行；cmd 只能是 node 或 .bin 里的壳
  const cmd = entry ? process.execPath : bin;
  for (const flag of ['--no-config-lookup', '--no-eslintrc']) {
    const out = [];
    let parseErrors = 0;
    let usable = true;
    for (let i = 0; i < files.length; i += ESLINT_CHUNK) {
      const parsed = _parseEslintChunk(cmd, entry, files.slice(i, i + ESLINT_CHUNK), eslintRules, flag, targetPath);
      if (!parsed) {
        usable = false;
        break;
      }
      parseErrors += _collectEslintMessages(parsed, eslintRules, out);
    }
    if (!usable) continue;
    if (parseErrors > 0) {
      // 解析失败 = 这些文件根本没被检查，不能说「扫过了没问题」
      console.log(chalk.dim(`  ℹ ${parseErrors} 处 eslint 解析错误，对应文件未参与安全规则检查`));
    }
    return out;
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
  const bin = findEslintBin(targetPath, jsFiles);
  if (!bin) {
    console.log(chalk.dim('  ℹ 未找到项目内 eslint 可执行文件，跳过 ESLint 安全规则向量（TS/TSX 已由 lint 门禁覆盖）'));
    return [];
  }
  return _runEslintOnFiles(bin, jsFiles, eslintRules, targetPath) || [];
}

function resolveEslintEntry(bin) {
  // <dir>/node_modules/.bin/eslint → <dir>/node_modules/eslint/bin/eslint.js
  const entry = join(dirname(dirname(bin)), 'eslint', 'bin', 'eslint.js');
  return existsSync(entry) ? entry : null;
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
// 扫描器自己的测试文件里全是「危险写法样本」（res.redirect(req.query.x)、
// execSync 拼变量），它们不可执行，只是断言用的输入。
// 不豁免的话每跑一次 review 都会报 2 处 HIGH → security 门禁永远 FAIL，
// 而「修复」只能是删样本或改断言 —— 把人逼去弱化测试。
const SCANNER_FIXTURES = ['claude-scene/src/handlers/security/threat-scan.test.js'];
// 已改成 argv 数组（safeExecFile）的实现 + 扫描器自己的测试样本：再过一遍
// shell 字符串匹配没有意义（测试文件里全是「危险写法」反例）
const CMD_EXCLUDE = [...SCANNER_FIXTURES, 'src/lib/safe-exec.js', 'src/handlers/memory/agentmemory.js', 'src/handlers/memory/codegraph.js', 'src/handlers/llm-proxy-audit.js'];
const VULN_PATTERNS = [
  { name: 'XSS: dangerouslySetInnerHTML', regex: /dangerouslySetInnerHTML\s*=\s*\{/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: 'XSS: innerHTML 赋值', regex: /\.innerHTML\s*=\s*/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: 'SQL注入: 模板字面量拼接', regex: /(?:execute|query|run)\s*\(\s*['"`][^)]*\$\{/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: 'SQL注入: 字符串拼接查询', regex: /(?:execute|query|run)\s*\(\s*['"`][^)]*\+/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  // 盲区记录：旧分支写的是「引号后面直接要求 +」，于是最常见的拼接写法
  // execSync('ls ' + x) 一个都扫不到 —— 检测器长期假绿。拆成两条规则，
  // 既让正则复杂度留在 lint 限内，也让报告能区分「插值」和「拼接」。
  { name: '命令注入: exec/spawn 模板串插值', regex: /(?<!safeE)(?<![.\w$])(?:execSync|exec|spawnSync|spawn)\s*\(\s*`[^`]*\$\{/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'], excludeFiles: CMD_EXCLUDE },
  { name: '命令注入: exec/spawn 拼接字符串', regex: /(?<!safeE)(?<![.\w$])(?:execSync|exec|spawnSync|spawn)\s*\(\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*\+/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'], excludeFiles: CMD_EXCLUDE },
  { name: '硬编码密钥: 长随机字符串赋值', regex: /(?:SECRET|TOKEN|API_KEY|PASSWORD)\s*[:=]\s*['"`][A-Za-z0-9+/_-]{20,}['"`]/g, severity: 'critical', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  { name: '路径遍历: 未验证的相对路径', regex: /(?:readFile|writeFile|createReadStream|createWriteStream)\s*\(\s*(?:`[^`]*\.\.\/|['"][^'"]*\.\.\/)/g, severity: 'medium', ext: ['.js', '.jsx', '.ts', '.tsx'] },
  // [patched:open-redirect] 盲区：服务端直接把请求参数当跳转目标，攻击者用
  // `?next=https://evil.example` 就能把用户带去任意外站（钓鱼/偷 token）。
  // 三种写法分开列（直取 / 模板串 / Python 侧），漏一种就等于没扫。
  { name: '开放重定向: redirect 目标直接取自请求参数', regex: /(?:res|response|reply)\.redirect\s*\(\s*(?:req|request)\.(?:query|params|body)\b/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'], excludeFiles: SCANNER_FIXTURES },
  { name: '开放重定向: redirect 模板串里拼请求参数', regex: /(?:res|response|reply)\.redirect\s*\(\s*`[^`]*\b(?:req|request)\.(?:query|params|body)\b/g, severity: 'high', ext: ['.js', '.jsx', '.ts', '.tsx'], excludeFiles: SCANNER_FIXTURES },
  { name: '开放重定向(Python): redirect 目标取自 request.args/GET', regex: /(?:redirect|HttpResponseRedirect)\s*\(\s*request\.(?:args|GET|form|POST)\b/g, severity: 'high', ext: ['.py'] },
  // [patched:scan-all-sources] 原规则只覆盖 JS/TS，Python 后端（本仓库 backend/）完全不可见
  { name: 'SQL注入(Python): f-string 拼接查询', regex: /(?:execute|executemany)\s*\(\s*(?:text\s*\(\s*)?f["']/g, severity: 'critical', ext: ['.py'] },
  { name: '命令注入(Python): os.system / subprocess shell=True', regex: /(?:os\.system\s*\(|subprocess\.\w+\s*\([^)]*shell\s*=\s*True)/g, severity: 'critical', ext: ['.py'] },
  { name: '硬编码密钥(Python)', regex: /(?:API_KEY|SECRET_KEY|PASSWORD|DATABASE_URL)\s*=\s*["'][^"']{16,}["']/g, severity: 'critical', ext: ['.py'] },
];

// excludeFiles 写的是「相对项目根」的路径（如 src/lib/safe-exec.js），但引擎自己
// 就住在 <root>/claude-scene/src/... 下，直接 join(targetPath, f) 永远对不上 →
// 豁免名单形同虚设，已经改成 argv 数组的合法实现仍被反复报红（报错疲劳）。
// 改成按路径后缀比对（相对路径 / 绝对路径双向），嵌套根也能命中。
function isExcludedFile(filePath, excludeFiles, targetPath) {
  if (!excludeFiles || excludeFiles.length === 0) return false;
  const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');
  const relFile = norm(relative(targetPath, filePath));
  const absFile = norm(filePath);
  return excludeFiles.some((f) => {
    const rel = norm(f);
    return relFile === rel || relFile.endsWith(`/${rel}`) || absFile.endsWith(`/${rel}`);
  });
}

function scanPatternInFiles(filePath, pattern, targetPath) {
  const { name, regex, severity, ext, excludeFiles } = pattern;
  if (ext.every(e => !filePath.endsWith(e))) return null;
  if (isExcludedFile(filePath, excludeFiles, targetPath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    // [patched:nosec-allow] 支持行内豁免（bandit/eslint 的 nosec 习惯）。
    // 只用于「值根本无法参数化」的合法场景：DDL 的标识符（表名/列名/类型名）、
    // information_schema 查询的表名常量。豁免必须在同一行写明理由，方便审计。
    // 注意：跨行 SQL 的豁免注释要写在这条语句的起始行（命中位置所在行）。
    // 注释行不算命中：文档里举的「错误写法」示例不可执行，报上去只会让人
    // 去删注释（本节新增 1 处真实 FP 就是这么来的）。
    const lines = content.split('\n');
    let count = 0;
    for (const m of content.matchAll(regex)) {
      const lineText = lines[(content.slice(0, m.index).match(/\n/g) || []).length] || '';
      if (/^\s*(?:\*|\/\/|\/\*)/.test(lineText)) continue;
      if (/\bnosec\b/i.test(lineText)) continue;
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

export function handleSecBugHunt(_action, params, targetPath, context) {
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
  // review 场景还声明了 block_merge_on_critical: true。注意：CLI 不执行合
  // 并动作，所以这里只能把结论写成「不可合并」，不能提 gateBlocked
  // （那会直接中止 review 本身，连报告都不出 —— 也不是这个键的意思）。
  const blockingFinding = findings.some((f) => f.severity === 'critical' || f.severity === 'high');
  if (context && blockingFinding) context.lastStepFailed = true;
  const mergeNote = blockingFinding && params?.block_merge_on_critical === true
    ? '；block_merge_on_critical 生效：结论为不可合并'
    : '';

  const note = npmAudit.note ? `；${npmAudit.note}` : '';
  return `安全漏洞深度扫描完成: ${findings.length ? `${findings.length} 类问题` : '无问题'}（扫描 ${files.length} 个源码文件${note}）${mergeNote}`;
}
const CONSOLE_CALL_RE = /\bconsole\.(?:log|warn|error|info|debug)\s*\(/;

// 扫描范围必须和其他安全向量一致：走 listProjectCodeFiles（跳过 node_modules、
// 点目录、产物目录、自带 .git 的嵌套仓库、.claude/scene-scan-ignore）。
// 旧实现 shell 出 `grep -r .`：把 vendored 的 open-design/、codeguardian/ 也扫进来，
// 10 处「泄露」全是别人仓库的代码，报红只能靠改第三方源码消掉。
// 同时不再走 shell：没有 maxBuffer 上限，也不会把 grep 的 stderr 混进结果。
function grepConsoleLines(targetPath) {
  const files = listProjectCodeFiles(targetPath).filter((f) => /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(f));
  if (files.length === 0) {
    // 扫不到文件 = 结果不可信，交给上层判定失败（返回空串会被当成「无问题」）
    throw new Error('未找到任何源码文件（扫描范围为空，结果不可信）');
  }
  const maxLines = Number(process.env.SCENE_LOGSCAN_MAXLINES || 5000);
  const out = [];
  for (const file of files) {
    if (out.length >= maxLines) break;
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    if (!content.includes('console.')) continue;
    const rel = relative(targetPath, file).split(sep).join('/');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length && out.length < maxLines; i += 1) {
      if (CONSOLE_CALL_RE.test(lines[i])) out.push(`./${rel}:${i + 1}:${lines[i]}`);
    }
  }
  return out.join('\n');
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
