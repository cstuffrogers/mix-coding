import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';
import { statusForFindings } from '../lib/finding-verdict.js';
import { assertSources, listProjectCodeFiles } from '../lib/project-sources.js';

function _resolvePythonTool(toolName, moduleName) {
  // Windows: scan Python Scripts directories for the tool executable
  if (process.platform === 'win32' && process.env.APPDATA) {
    const pythonDir = process.env.APPDATA.replace(/\\/g, '/') + '/Python';
    try {
      const versions = readdirSync(pythonDir).filter(d => /^Python3\d+$/.test(d)).sort().reverse();
      for (const ver of versions) {
        const exePath = `${pythonDir}/${ver}/Scripts/${toolName}.exe`;
        if (existsSync(exePath)) return exePath;
      }
    } catch { /* dir doesn't exist */ }
  }
  // Fallback to module invocation if supported
  if (moduleName) return `python -m ${moduleName}`;
  return toolName;
}

/**
 * 「工具根本没装」和「工具没装但 npx 把报错写在 stdout」都会走到这里：
 * 以前这类输出被当成工具的正常输出，`findings > 0` 的分支永远不成立 → 写 passed = true。
 */
function isToolMissing(raw) {
  return /not recognized|command not found|ENOENT|npm ERR! 404|could not determine executable/i.test(String(raw));
}

function countKnipIssues(parsed) {
  const counts = { fileCount: 0, depCount: 0, exportCount: 0 };
  const buckets = [['files', 'fileCount'], ['dependencies', 'depCount'], ['devDependencies', 'depCount'], ['exports', 'exportCount']];
  for (const issue of parsed.issues || []) {
    for (const [key, bucket] of buckets) counts[bucket] += issue[key]?.length || 0;
  }
  return { ...counts, total: counts.fileCount + counts.depCount + counts.exportCount };
}

/** knip 有发现时退出码非 0，然而 JSON 还在 stdout —— 抛错不代表没结果 */
function readKnipOutput(targetPath, strictFlag) {
  try {
    return safeExec(`npx knip --reporter json${strictFlag} 2>&1`, targetPath, { stdio: 'pipe', maxBuffer: 1024 * 1024 }).toString();
  } catch (e) {
    return e.stdout?.toString?.() || e.stderr?.toString?.() || e.message || '';
  }
}

export function handleKnipCheck(_action, params, targetPath, context) {
  // strict: true → knip --strict（未使用的导出/类型也算问题）。场景 review#2.6
  // 声明了它，以前没人读 —— 严格档和默认档跑出来一模一样。
  const strictFlag = params?.strict === true ? ' --strict' : '';
  const raw = readKnipOutput(targetPath, strictFlag);

  // 工具没装 = 这一步什么都没做（以前 `|| true` 把报错文本当输出，
  // 解析失败后靠 NOOP 正则碰巧记成 noop；显式 skip 不依赖文案巧合）。
  if (isToolMissing(raw)) {
    return { status: 'skip', message: '死代码检测跳过：knip 未安装（npm i -D knip 后可启用）' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (/✂️|excellent|congratulations/i.test(raw)) {
      if (context) context.deadCodePassed = true;
      return '死代码检测完成: 无死代码';
    }
    // 解析不出结果 = 没拿到结论。以前返回「完成（结果解析失败）」，
    // 消息里有「完成」二字，报告里就是这个 gate ✓ pass。
    return { status: 'warn', message: `死代码检测未完成：knip 输出无法解析（${String(raw).trim().slice(0, 80) || '空输出'}）` };
  }

  const counts = countKnipIssues(parsed);
  // 状态与门禁旗标同源：以前找到 27 项死代码仍返回「完成」，步骤记 pass、
  // 旗标写 false —— 汇总里一行 pass 一行 failed，看报告的人只能猜哪个算数。
  if (context) context.deadCodePassed = counts.total === 0;
  if (counts.total === 0) return '死代码检测完成: 无死代码';
  return {
    status: statusForFindings(counts.total),
    message: `死代码检测: ${counts.total} 项（未使用文件 ${counts.fileCount} / 依赖 ${counts.depCount} / 导出 ${counts.exportCount}）`,
  };
}

export function _parseNoleakOutput(raw) {
  const findings = [];
  // Parse structured JSON output first; fall back to substring heuristics
  try {
    const json = JSON.parse(raw);
    const items = json.findings || [];
    const relevant = items.filter(f =>
      !f.filePath?.includes('node_modules') && f.severity === 'block'
    );
    if (relevant.length > 0) {
      const byRule = {};
      for (const f of relevant) {
        byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;
      }
      for (const [rule, count] of Object.entries(byRule)) {
        findings.push(`${rule} (${count} 处)`);
      }
    }
  } catch {
    // JSON parse failed — fall back to substring heuristics
    if (raw.includes('source-map') || raw.includes('.map')) {
      findings.push('Source Map 文件泄露');
    }
    if (raw.includes('.env') || raw.includes('env-file')) {
      findings.push('.env 文件可能泄露');
    }
    if (raw.includes('credential') || raw.includes('entropy')) {
      findings.push('高熵密钥检测');
    }
    if (/\.git[/\\]/.test(raw)) {
      findings.push('.git 目录暴露');
    }
  }
  return findings;
}

export function handleBuildLeakCheck(_action, _params, targetPath, context) {
  const buildDirs = ['dist', 'build', 'out', '.next', 'coverage', 'public'];
  const hasArtifacts = buildDirs.some(d => {
    try { return existsSync(join(targetPath, d)); } catch { return false; }
  });

  if (!hasArtifacts) {
    // Don't set buildLeakPassed — 没有产物就没有可泄露的东西，不是「通过」。
    return { status: 'noop', message: '构建泄露检查无需执行: 无构建产物' };
  }

  const findings = [];
  let isPassed = true;
  let ran = false;

  try {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const targets = buildDirs.filter(d => {
      try { return existsSync(join(targetPath, d)); } catch { return false; }
    });
    const scanPath = targets.length > 0 ? targets[0] : '.';

    const raw = safeExec(
      `${cmd} noleak scan -o json ${scanPath} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 30000 }
    ).toString();

    // noleak 没装 / 输出为空 = 没扫。以前 isPassed 保持 true 并写
    // buildLeakPassed = true ——「扫描没跑」变成了「没有泄露」。
    if (/ENOENT|not recognized|command not found/i.test(raw) || !raw.trim()) {
      return { status: 'skip', message: '构建泄露检查跳过：noleak 不可用（没扫不等于没有泄露）' };
    }
    ran = true;
    const leaks = _parseNoleakOutput(raw);
    findings.push(...leaks);

    if (leaks.length > 0) {
      isPassed = false;
    } else {
      console.log(chalk.green('  ✅ noleak 扫描完成，未发现泄露'));
    }
  } catch (e) {
    console.log(chalk.dim('  ℹ noleak 不可用，跳过泄露检查'), e.message);
  }

  if (!ran) {
    return { status: 'warn', message: '构建泄露检查未完成：noleak 执行异常，没拿到结论' };
  }
  if (context) context.buildLeakPassed = isPassed;
  // 以前返回裸字符串，「构建泄露检查完成: <泄露清单>」里没有「失败」二字 →
  // 引擎记 ✓ pass：扫出泄露的那一步看起来是通过。有发现就显式 warn。
  if (findings.length > 0) {
    return { status: 'warn', message: `构建泄露检查完成: ${findings.join('; ')}` };
  }
  return { status: 'pass', message: '构建泄露检查完成: 无泄露' };
}

export function handleDeadLinkCheck(_action, _params, targetPath, context) {
  let brokenCount = 0;
  const brokenUrls = [];

  try {
    const lycheeCmd = process.platform === 'win32' ? 'lychee.exe' : 'lychee';
    const raw = safeExec(
      `${lycheeCmd} --format json --no-progress --exclude 'node_modules' --exclude '.git' --exclude '.claude' . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024 }
    ).toString();

    // Parse structured JSON; fall back to line heuristics
    try {
      const json = JSON.parse(raw);
      brokenCount = json.errors || 0;
      const errMap = json.error_map || {};
      brokenUrls.push(...Object.keys(errMap));
    } catch {
      const lines = raw.split('\n');
      const brokenLines = lines.filter(l => /^\s*(?:✗|×|ERROR|FAIL|error)\b/i.test(l));
      brokenCount = brokenLines.length;
      brokenUrls.push(...brokenLines.map(l => l.slice(0, 200)));
    }

    if (brokenCount > 0) {
      brokenUrls.slice(0, 10).forEach(u => {
        console.log(chalk.yellow(`    🔗 ${u.length > 120 ? u.slice(0, 120) + '...' : u}`));
      });
    } else {
      console.log(chalk.green('  ✅ 未发现死链接'));
    }
  } catch (e) {
    console.log(chalk.dim('  ℹ lychee 不可用，跳过死链检测'), e.message);
  }

  if (context) context.deadLinkPassed = brokenCount === 0;
  // 同上：`3 个死链接` 不含任何「发现类」词，裸字符串会被判 pass。
  if (brokenCount > 0) {
    return { status: 'warn', message: `死链接检测完成: ${brokenCount} 个死链接` };
  }
  return { status: 'pass', message: '死链接检测完成: 0 个死链接' };
}

// [patched:sec-headers-langs] 把逐项头匹配抽成独立函数，控制 handleSecurityHeaders 认知复杂度。
function _matchHeaderChecks(checks, rawHeaders, findings) {
  for (const check of checks) {
    if (new RegExp(check.grep, 'i').test(rawHeaders)) {
      console.log(chalk.dim(`  ✓ ${check.name}: 已配置`));
    } else {
      findings.push(`${check.name}: 未配置`);
    }
  }
}

export function handleSecurityHeaders(_action, _params, targetPath, context) {
  const findings = [];
  let isPassed = true;

  const checks = [
    { name: 'CSP', grep: 'contentSecurityPolicy|Content-Security-Policy|helmet' },
    { name: 'HSTS', grep: 'hsts|Strict-Transport-Security' },
    { name: 'X-Frame-Options', grep: 'xframe|X-Frame-Options|frameguard' },
    { name: 'X-Content-Type-Options', grep: 'xContentType|X-Content-Type-Options|noSniff' },
    { name: 'Referrer-Policy', grep: 'referrerPolicy|Referrer-Policy' },
    { name: 'Permissions-Policy', grep: 'permissionsPolicy|Permissions-Policy|Feature-Policy' },
  ];

  // [patched:sec-headers-langs] 两处修正：
  // a) 原实现只扫 js/ts/json，Python/Go/Java 后端的响应头配置永远看不见；
  // b) 原实现对 6 项头各跑一次全仓 grep（本仓库单次约 30s）→ 必然超时，
  //    超时被 catch 成「检查失败」却仍算 pass。改为一次 grep 收齐再逐项匹配。
  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.codegraph --exclude-dir=.venv --exclude-dir=venv --exclude-dir=__pycache__ --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage --exclude-dir=.next --exclude-dir=target';
  const includeFlags = '--include="*.js" --include="*.ts" --include="*.json" --include="*.py" --include="*.go" --include="*.rb" --include="*.php" --include="*.java"';
  const pattern = checks.map(c => c.grep).join('|');
  let rawHeaders = '';
  try {
    rawHeaders = safeExec(
      `grep -rniE "${pattern}" ${includeFlags} ${excludeDirs} . 2>&1 | head -n 4000`,
      targetPath,
      { stdio: 'pipe', timeout: 180000, maxBuffer: 32 * 1024 * 1024 }
    ).toString();
  } catch (e) {
    for (const check of checks) findings.push(`${check.name}: 检查失败 (${e.message})`);
    if (context) context.lastStepFailed = true;
  }

  if (rawHeaders) {
    _matchHeaderChecks(checks, rawHeaders, findings);
  }

  _runLiveHeaderScan(targetPath, findings);

  const missingCount = findings.filter(f => f.includes('未配置')).length;
  if (missingCount > 0) {
    isPassed = false;
  } else if (findings.length === 0) {
    console.log(chalk.green('  ✅ 安全响应头配置完整'));
  }

  if (context) context.securityHeadersPassed = isPassed;
  return `安全响应头扫描完成: ${findings.length ? findings.join('; ') : '全部已配置'}`;
}

function _runLiveHeaderScan(targetPath, findings) {
  const liveUrl = process.env.SERAPHIM_AUDIT_URL;
  if (!liveUrl) return;

  try {
    const seraphimCmd = _resolvePythonTool('seraphim-audit', 'seraphim_audit');
    const liveRaw = safeExec(
      `${seraphimCmd} --authorized --format json --no-crawl ${liveUrl} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    try {
      const liveJson = JSON.parse(liveRaw);
      const headerIssues = liveJson.headers || liveJson.findings || [];
      if (Array.isArray(headerIssues) && headerIssues.length > 0) {
        headerIssues.forEach(h => {
          findings.push(`[Live] ${h.header || h.name}: ${h.issue || h.severity}`);
        });
      }
    } catch {
      if (/MISSING|WARNING|FAIL/i.test(liveRaw)) {
        console.log(chalk.yellow('  ⚠ 实时扫描发现问题（详见 seraphim-audit 输出）'));
      } else {
        console.log(chalk.green('  ✅ 实时扫描未发现响应头问题'));
      }
    }
  } catch {
    console.log(chalk.dim('  ℹ seraphim-audit 实时扫描跳过'));
  }
}

export function handleRecheckCli(_action, _params, targetPath, context) {
  // [patched:redos-builtin] 原来跑 `npx recheck "src/**/*.js"`：本项目没有 src/，
  // 且 recheck-cli 不在依赖里 → 两种情况下都是「没有结果」，却都报「无问题」。
  // 改为内置嵌套量词启发式（ReDoS 的经典形态），不依赖外部 CLI 与网络。
  const files = listProjectCodeFiles(targetPath).filter((f) => /\.(js|jsx|mjs|cjs|ts|tsx)$/i.test(f));
  if (!assertSources(files, context, 'ReDoS 扫描')) {
    return { status: 'fail', message: 'ReDoS 扫描失败: 未找到任何 JS/TS 源码（扫描范围为空，结果不可信）' };
  }
  // 只认「括号内以量词结尾 + 括号本身也被量词修饰」： (a+)+ / (\w*)* / (.*)+
  // 普通算术 `(a + 3) * 2` 不会命中（`)` 前必须紧贴「原子+量词」）。
  // 左括号必须是真分组：`\(` 是字面量转义，不是分组 —— 不加这个排除，
  // 检测器自己那行 `/\(\w+[+*]\)[+*]/` 就把自己报成了 ReDoS（唯一的命中项）。
  const NESTED = /(?<!\\)\((?:\?:)?\w+[+*]\)[+*]/;
  const hits = [];
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    if (!content.includes('/') && !content.includes('RegExp')) continue;
    content.split('\n').forEach((line, idx) => {
      if (!/\/|RegExp/.test(line)) return;
      // 注释行不执行，不可能是 ReDoS 风险；不排掉的话，文档里写 `(a+)+` 这种
      // 反例就会把注释本身报成漏洞（本节最先命中的就是自己那行注释）。
      if (/^\s*(?:\*|\/\/|\/\*)/.test(line)) return;
      if (NESTED.test(line)) hits.push(`${file}:${idx + 1}`);
    });
  }
  if (hits.length > 0) {
    console.log(chalk.red(`  🔴 发现 ${hits.length} 处嵌套量词正则（潜在 ReDoS）`));
    hits.slice(0, 10).forEach((h) => console.log(chalk.dim(`    ${h}`)));
    if (context) context.lastStepFailed = true;
    // 以前靠 context.lastStepFailed 这条侧信道让它变成 fail，返回值本身是裸字符串。
    // 侧信道一断（调用方忘了读 flag）就成 pass —— 结论要写在返回值里。
    return { status: 'fail', message: `ReDoS 扫描完成: ${hits.length} 处可疑（扫描 ${files.length} 个文件）` };
  }
  console.log(chalk.green(`  ✅ 未发现嵌套量词正则（扫描 ${files.length} 个文件）`));
  return { status: 'pass', message: `ReDoS 扫描完成: 未发现可疑正则（扫描 ${files.length} 个文件）` };
}
function buildScanTargets(targetPath) {
  const targets = [];
  const skillsDir = join(targetPath, '.claude', 'skills');
  const commandsDir = join(targetPath, '.claude', 'commands');
  if (existsSync(skillsDir)) targets.push('.claude/skills/');
  if (existsSync(commandsDir)) targets.push('.claude/commands/');
  return targets;
}

/**
 * 工具装了没？没装就别跑：以前不探测直接扫，命令不存在时 execSync 会在
 * cmd.exe 里挂到 timeout（ETIMEDOUT），报成「部分技能目录执行失败」——
 * 每条 review 都挂一个看不懂的 warn，而真实原因只是没安装。
 */
const SKILLSPECTOR_TIMEOUT_MS = () => Number(process.env.SKILLSPECTOR_TIMEOUT_MS) || 120000;

/**
 * 从外部工具的错误输出里挑一句人话。
 * 实测 skillspector 失败时 stderr 头部是一堆 LangChain 弃用警告，直接取第一行会
 * 把「某个依赖库要改默认值」当成失败原因展示给用户。
 */
function pickToolFailReason(detail) {
  const lines = String(detail || '').split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  // 「Traceback (most recent call last):」是头部，真正的错误行在最后。
  const noise = /^Command failed|^Traceback|Warning/i;
  const real = lines.find(l => /(Error|Exception|错误|失败|denied|No such)/i.test(l) && !noise.test(l));
  if (real) return real;
  const meaningful = lines.filter(l => !noise.test(l));
  return meaningful.at(-1) || lines.at(-1) || '';
}

function probeTool(cmd, targetPath) {
  try {
    // 这个 CLI 光 import 依赖就要 ~30s（实测 skillspector --version 28s），
    // 探测超时给少了会把「装了但启动慢」误判成「没装」。
    safeExec(`${cmd} --version 2>&1`, targetPath, { stdio: 'pipe', timeout: 45000 });
    return { available: true };
  } catch (e) {
    const detail = [e.message, e.stdout?.toString?.(), e.stderr?.toString?.()]
      .filter(Boolean).join('\n');
    if (/ETIMEDOUT|timed ?out/i.test(detail)) return { available: true, slow: true };
    return { available: false, detail };
  }
}

function scanSingleTarget(cmd, targetPath, allFindings) {
  let raw;
  try {
    raw = safeExec(cmd, targetPath, { stdio: 'pipe', timeout: SKILLSPECTOR_TIMEOUT_MS() }).toString();
  } catch (e) {
    // linter 类 CLI 找到问题时用非零退出码报信（skillspector 实测：exit 1 +
    // 完整 JSON 在 stdout）。以前 execSync 一抛就当扫描失败，于是「抓到了
    // 1 个 CRITICAL / 62 个 HIGH」被报成「扫描未完成，没有结果」。
    if (/ETIMEDOUT|timed ?out/i.test(String(e.message || ''))) throw e;
    // stdout 才是 JSON；和 stderr 拼起来会让 JSON.parse 直接碎掉
    // （stderr 里是 Python 依赖的弃用警告）。
    raw = e.stdout?.toString?.() || '';
    if (!raw.trim()) raw = e.stderr?.toString?.() || '';
    if (!raw.trim()) throw e;
  }
  try {
    const result = JSON.parse(raw);
    // skillspector 把结果放在 issues 里（不是 findings/results）——
    // 只认 findings 会让 101 条发现变成「无问题」的假绿。
    const findings = result.findings || result.results || result.issues || [];
    allFindings.push(...findings);
    return { isScanFailed: false };
  } catch {
    if (raw.toLowerCase().includes('vulnerability') || raw.toLowerCase().includes('malicious')) {
      return { isScanFailed: true };
    }
    if (raw.includes('No issues') || raw.includes('no issues') || raw.includes('clean')) {
      console.log(chalk.dim(`  ✓ ${targetPath}: 未发现问题`));
    } else {
      console.log(chalk.dim(`  ℹ ${targetPath}: 输出无法解析`));
    }
    return { isScanFailed: false };
  }
}

function reportSkillspectorFindings(allFindings) {
  const critical = allFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'critical');
  const high = allFindings.filter(f => f.severity === 'HIGH' || f.severity === 'high');
  const total = allFindings.length;

  if (total > 0) {
    for (const f of critical.slice(0, 5)) {
      console.log(chalk.red(`    🔴 ${f.pattern || f.rule || f.type}: ${f.location?.file || f.file || f.path}`));
    }
    for (const f of high.slice(0, 3)) {
      console.log(chalk.yellow(`    🟡 ${f.pattern || f.rule || f.type}: ${f.location?.file || f.file || f.path}`));
    }
    // 不写 skillspectorPassed：扫的是文档（技能/命令的 markdown），
    // 里面的反例代码会被 YARA 命中 —— 本仓库的 CRITICAL 就是
    // sharp-edges/references/lang-php.md 里那句 preg_replace('/.*/e') 反例。
    // 这种发现只能人工复核：判 fail 是假红，写「通过」的旗标是假绿。
    return {
      status: statusForFindings(total),
      message: `SkillSpector 扫描完成: ${total} 个问题（CRITICAL ${critical.length} / HIGH ${high.length}）—— 扫描对象是文档，示例代码会被当成漏洞，需人工复核`,
    };
  }

  return { status: 'pass', message: 'SkillSpector 扫描完成: 无问题' };
}

/** 扫描抛错时归类：工具根本不存 / 真正的失败原因。 */
function classifyScanError(e) {
  const detail = [e.message, e.stdout?.toString?.(), e.stderr?.toString?.()]
    .filter(Boolean).join('\n');
  // 命令不存在时 execSync 也会抛（退出码 127），以前只看 message 里有没有
  // "NOT_FOUND"，其余一律当「部分失败」。结果本机没装 skillspector 时，
  // 每条 review 都挂一个看不懂的 warn。
  if (/NOT_FOUND|not found|ENOENT|not recognized|command not found/i.test(detail)) {
    return { missing: true };
  }
  const reason = /ETIMEDOUT|timed ?out/i.test(detail)
    ? `扫描超时（每个目标 ${Math.round(SKILLSPECTOR_TIMEOUT_MS() / 1000)}s，可设 SKILLSPECTOR_TIMEOUT_MS 放宽）`
    : pickToolFailReason(detail);
  return { missing: false, reason };
}

// context 不再写任何旗标：扫文档的发现只能人工复核（见 reportSkillspectorFindings）
export function handleSkillspectorScan(_action, params, targetPath) {
  // targets: ["..."] 覆盖默认扫描范围。review#4.57 显式声明了要扫的目录，
  // 以前没人读 —— 声明被静默忽略。
  const declaredTargets = Array.isArray(params?.targets) ? params.targets.filter((t) => typeof t === 'string' && t) : [];
  const targets = declaredTargets.length > 0 ? declaredTargets : buildScanTargets(targetPath);
  if (targets.length === 0) return { status: 'skip', message: 'SkillSpector 扫描跳过: 没有技能目录' };

  const skillspectorCmd = _resolvePythonTool('skillspector', null);
  const probe = probeTool(skillspectorCmd, targetPath);
  if (!probe.available) {
    return { status: 'skip', message: 'SkillSpector 扫描跳过：本机没有安装 skillspector（pip install skillspector 后可启用）' };
  }
  const hasLlmKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const llmFlag = hasLlmKey ? '' : ' --no-llm';

  const sweep = sweepSkillTargets(targets, skillspectorCmd, llmFlag, targetPath);
  if (sweep.missingTool) return { status: 'skip', message: 'SkillSpector 扫描跳过：本机没有可用的 skillspector' };

  // 「部分失败」带「部分」二字，恰好命中 detectHandlerFailure 的排除名单 → 以前记 pass。
  // 扫描没跑完就不算通过，但也不该判 fail（没有证据说技能有问题）。
  if (sweep.failed && sweep.findings.length === 0) {
    return {
      status: 'warn',
      message: `SkillSpector 扫描未完成: 部分技能目录执行失败，没有扫描结果${sweep.failReason ? `（${sweep.failReason.slice(0, 120)}）` : ''}`,
    };
  }

  return reportSkillspectorFindings(sweep.findings);
}

/**
 * 逐个目标目录跑 skillspector，收集发现项与失败标记。
 * 抽成纯循环是为了把 handleSkillspectorScan 的认知复杂度拉回 15 以下（行为不变）。
 */
function sweepSkillTargets(targets, skillspectorCmd, llmFlag, targetPath) {
  const findings = [];
  let failed = false;
  let failReason = '';
  for (const target of targets) {
    try {
      // 不要 2>&1：stderr 里是 Python 依赖的弃用警告，混进 stdout 会让 JSON 解析失败。
      const cmd = `${skillspectorCmd} scan ${target} --format json${llmFlag}`;
      const result = scanSingleTarget(cmd, targetPath, findings);
      if (result.isScanFailed) failed = true;
    } catch (e) {
      const err = classifyScanError(e);
      if (err.missing) return { missingTool: true, findings, failed, failReason };
      failed = true;
      failReason ||= err.reason;
    }
  }
  return { missingTool: false, findings, failed, failReason };
}

// ── actionlint — GitHub Actions workflow syntax checker (3k+ stars) ──

function readActionlintOutput(targetPath) {
  try {
    return safeExec(
      'npx actionlint -format "{{range .}}::error file={{.Filepath}},line={{.Lineno}},col={{.Col}}::{{.Message}}{{end}}" .github/workflows/ 2>&1',
      targetPath,
      { stdio: 'pipe', maxBuffer: 1024 * 1024, timeout: 30000 }
    ).toString();
  } catch (e) {
    // actionlint 发现语法错误时退出码非 0，报告仍在 stdout
    return e.stdout?.toString?.() || e.stderr?.toString?.() || e.message || '';
  }
}

export function handleActionlint(_action, _params, targetPath, context) {
  const workflowsDir = join(targetPath, '.github', 'workflows');

  if (!existsSync(workflowsDir)) {
    if (context) context.actionlintPassed = true;
    return 'actionlint 检查完成: 无 GitHub Actions 工作流目录';
  }

  const raw = readActionlintOutput(targetPath);
  // 以前 `|| true` 把 npx 的「没装」报错吞成空输出 → issueCount = 0 →
  // actionlintPassed = true。工具没装却记「工作流语法无问题」。
  if (isToolMissing(raw)) {
    return { status: 'skip', message: 'actionlint 检查跳过：本机没有 actionlint（npx actionlint 未安装）' };
  }

  const errorLines = raw.split('\n').filter((l) => /^::error\b/.test(l));
  if (errorLines.length > 0) {
    errorLines.slice(0, 15).forEach((l) => {
      console.log(chalk.yellow(`    ${l.replace(/^::error\s+/, '').slice(0, 200)}`));
    });
    if (context) context.actionlintPassed = false;
    // 工作流语法错误 = 工具自己的 error 级：CI 会直接挂，不该只记一句黄字
    return {
      status: statusForFindings(errorLines.length, { severity: 'error' }),
      message: `actionlint 检查完成: ${errorLines.length} 个工作流语法错误`,
    };
  }

  if (raw.trim() && !/no lint errors/i.test(raw)) {
    // 既没有 ::error 行又不是干净的输出格式 = 没解析出结论，不许当通过
    return { status: 'warn', message: `actionlint 检查未完成：输出无法解析（${raw.trim().slice(0, 80)}）` };
  }
  if (context) context.actionlintPassed = true;
  return 'actionlint 检查完成: 无问题';
}

// ── zizmor — GitHub Actions security auditor (2.5k+ stars) ──

const ZIZMOR_HARD = /^(?:error|critical|high)$/i;

function parseZizmorJson(raw) {
  try {
    const results = JSON.parse(raw);
    const allFindings = Array.isArray(results) ? results : (results.findings || []);
    if (allFindings.length === 0) {
      return { findingCount: 0, errorCount: 0 };
    }
    const bySeverity = {};
    for (const f of allFindings) {
      const sev = f.severity || 'unknown';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    console.log(chalk.dim(`  ℹ 发现 ${allFindings.length} 项 (${Object.entries(bySeverity).map(([k, v]) => `${k}: ${v}`).join(', ')})`));
    const errorCount = allFindings.filter(f => ZIZMOR_HARD.test(String(f.severity || ''))).length;
    return { findingCount: allFindings.length, errorCount };
  } catch {
    return null;
  }
}

function parseZizmorText(raw) {
  if (raw.toLowerCase().includes('vulnerability') || raw.toLowerCase().includes('error')) {
    // 纯文本兜底只能数出「有几条」，分不出严重级别 —— errorCount 记 0，
    // 于是结论最多是 warn。不许把数不出的级别当成 error（那是假红）。
    return { findingCount: (raw.match(/\b(ERROR|WARN|FAIL)\b/g) || []).length, errorCount: 0 };
  }
  if (raw.includes('no issues') || raw.includes('clean') || raw.trim() === '') {
    console.log(chalk.green('  ✅ zizmor: 工作流安全无问题'));
    return { findingCount: 0, errorCount: 0 };
  }
  // 既没说有问题也没说干净 = 解析不出结论，返回 null 让调用方记 warn。
  // 以前这里默认 findingCount = 0 → 「无问题」，于是任何输出变样都是 ✓ pass。
  return null;
}

export function handleZizmor(_action, params, targetPath, context) {
  // persona（pedantic / regular）控制上游严格程度。cicd#2.4 声明了 pedantic，
  // 以前没人读 —— 两个档位跑出来一样。
  const persona = typeof params?.persona === 'string' ? params.persona : '';
  const personaFlag = persona ? ` --persona=${escapeArg(persona)}` : '';
  const workflowsDir = join(targetPath, '.github', 'workflows');
  if (!existsSync(workflowsDir)) {
    if (context) context.zizmorPassed = true;
    return 'zizmor 检查完成: 无 GitHub Actions 工作流目录';
  }

  let result;
  try {
    const raw = safeExec(
      `npx zizmor --format json${personaFlag} .github/workflows/ 2>&1`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    // npx 把「没装」的报错写在 stdout 时也不会抛 —— 先认这一种，
    // 否则会被当成「输出无法解析」的 warn（或是更糟的 pass）。
    if (isToolMissing(raw)) {
      return { status: 'skip', message: 'zizmor 检查跳过：本机没有 zizmor（npx zizmor 未安装）' };
    }

    const jsonResult = parseZizmorJson(raw);
    result = jsonResult || parseZizmorText(raw);
    if (!result) {
      // 解析不出结论 ≠ 没问题。以前 findingCount 保持 0 → 报「无问题」并置
      // zizmorPassed = true，于是工具没装 / 输出变样都成了 ✓ pass。
      return { status: 'warn', message: `zizmor 检查未完成：输出无法解析（${String(raw).trim().slice(0, 80) || '空输出'}）` };
    }
  } catch (e) {
    const raw = e.stdout?.toString?.() || e.stderr?.toString?.() || e.message || '';
    // 工具没装（npx 报错）与真正的执行失败要分开：前者是 skip，后者是 warn
    if (isToolMissing(raw)) return { status: 'skip', message: 'zizmor 检查跳过：本机没有 zizmor（npx zizmor 未安装）' };
    return { status: 'warn', message: `zizmor 检查未完成：${String(raw).trim().slice(0, 80) || '无输出'}` };
  }

  const { findingCount, errorCount } = result;
  if (context) context.zizmorPassed = findingCount === 0;
  if (findingCount === 0) return 'zizmor 检查完成: 无问题';
  return {
    status: statusForFindings(findingCount, { severity: errorCount > 0 ? 'error' : 'warning' }),
    message: `zizmor 检查完成: ${findingCount} 个问题（其中 error/critical 级 ${errorCount} 个）`,
  };
}

// ── jscpd — code duplication detector (4.7k+ stars) ──

function runJscpd(targetPath, minTokens = 50) {
  try {
    return safeExec(
      `npx jscpd --format json --min-tokens ${minTokens} --min-lines 5 --ignore "node_modules,.git,.claude,dist,build,coverage,.next" . 2>&1`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();
  } catch (e) {
    return (e.stdout || '').toString();
  }
}

function parseJscpdResult(raw) {
  const cloneMatch = raw.match(/Found\s+(\d+)\s*clones?/i);
  const pctMatch = raw.match(/\b(\d+)\s*\(\s*(\d+(?:\.\d+)?)%\s*\)/) || raw.match(/Duplicated lines[^\d]*(\d+(?:\.\d+)?)%/i);
  if (!cloneMatch && !pctMatch) return null;
  const clones = cloneMatch ? parseInt(cloneMatch[1], 10) : 0;
  const pct = pctMatch ? parseFloat(pctMatch[2] || pctMatch[1]) : 0;
  return { clones, pct };
}

const JSCPD_DEFAULT_THRESHOLD_PCT = 5;

/**
 * 场景声明的是 `threshold: 0.05`（比例）或 `5`（百分数），两种写法都认。
 * 以前阈值写死在常量里，场景里那个 0.05 没人读 —— 改阈值等于没改。
 * 认不出来的值不猜：直接用默认值并在结论里写明「声明值不可用」。
 */
function resolveThresholdPct(raw) {
  if (raw === undefined || raw === null || raw === '') return { pct: JSCPD_DEFAULT_THRESHOLD_PCT, declared: null };
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return { pct: JSCPD_DEFAULT_THRESHOLD_PCT, declared: String(raw) };
  // ≤1 视为比例（0.05 → 5%），>1 视为百分数（5 → 5%）
  return { pct: num <= 1 ? Math.round(num * 1000) / 10 : num, declared: String(raw) };
}

function jscpdVerdict(clones, pct, context, thresholdPct, declaredNote = '') {
  // 5% 是阈值，不是工具的严重级别：越线记「有问题」（warn），没超线才是通过。
  // 以前两条分支都返回「完成」→ 重复率 40% 也是一行 pass，旗标写 false。
  const overThreshold = pct > thresholdPct;
  if (context) context.jscpdPassed = !overThreshold;
  if (!overThreshold) return `代码重复检测完成: ${clones} 处重复，重复率 ${pct.toFixed(1)}%（阈值 ${thresholdPct}%${declaredNote}）`;
  return {
    status: statusForFindings(Math.max(clones, 1)),
    message: `代码重复检测: ${clones} 处重复，重复率 ${pct.toFixed(1)}% 超过 ${thresholdPct}% 阈值${declaredNote}`,
  };
}

export function handleJscpd(_action, params, targetPath, context) {
  // 场景声明了 minTokens（review#…写的是 50）。以前 runJscpd 写死了--min-tokens 50，
  // 参数是装饰品。
  const minTokens = Number.parseInt(params?.minTokens, 10);
  const raw = runJscpd(targetPath, Number.isFinite(minTokens) && minTokens > 0 ? minTokens : 50);
  const { pct: thresholdPct, declared } = resolveThresholdPct(params?.threshold);
  const declaredNote = declared === null ? '' : Number.isFinite(Number(declared)) ? `，场景声明 ${declared}` : `，场景声明的 ${declared} 不是数字 → 用默认阈值`;
  if (!raw) {
    // jscpd 没输出 = 没拿到结论（不可用/崩了）。以前这句带「完成」二字，引擎判 pass。
    return { status: 'warn', message: '代码重复检测未完成: jscpd 无输出（未安装或执行失败）' };
  }

  const parsed = parseJscpdResult(raw);
  if (parsed && (parsed.clones > 0 || parsed.pct > 0)) {
    return jscpdVerdict(parsed.clones, parsed.pct, context, thresholdPct, declaredNote);
  }

  if (/no clones|no duplicates|0 clones/i.test(raw)) {
    if (context) context.jscpdPassed = true;
    return '代码重复检测完成: 无重复';
  }

  // 解析不了输出 = 没拿到结论，以前记 ✓ pass。
  return { status: 'warn', message: '代码重复检测未完成: 无法解析 jscpd 输出' };
}

// ── Stryker — mutation testing (2.9k+ stars) ──

function hasStrykerConfig(targetPath) {
  const configFiles = ['stryker.config.js', 'stryker.config.mjs', 'stryker.config.json', 'stryker.config.ts'];
  if (configFiles.some(f => existsSync(join(targetPath, f)))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    return !!(pkg.stryker || pkg['@stryker-mutator/core']);
  } catch { return false; }
}

function parseStrykerJson(raw) {
  try {
    const result = JSON.parse(raw);
    const report = result.mutationScore || result.report;
    if (report) {
      return {
        score: report.mutationScore || report.percentage || 0,
        killed: report.killed || 0,
        survived: report.survived || 0,
      };
    }
    return {
      score: result.mutationScore || 0,
      killed: result.killed || 0,
      survived: result.survived || 0,
    };
  } catch {
    return null;
  }
}

function parseStrykerText(raw) {
  const scoreMatch = raw.match(/mutation\s+score[^\d]*(\d+(?:\.\d+)?)\s*%/i);
  if (scoreMatch) {
    const killedMatch = raw.match(/killed.*?(\d+)/i);
    const survivedMatch = raw.match(/survived.*?(\d+)/i);
    return {
      score: parseFloat(scoreMatch[1]),
      killed: killedMatch ? parseInt(killedMatch[1], 10) : 0,
      survived: survivedMatch ? parseInt(survivedMatch[1], 10) : 0,
    };
  }
  if (raw.includes('No mutants') || raw.includes('no mutants')) {
    console.log(chalk.green('  ✅ Stryker: 无变异体'));
  }
  return null;
}

// Stryker 的 json reporter 写到文件（reports/mutation/mutation.json），
// 不是 stdout —— 原来对 stdout 整体 JSON.parse 几乎必然失败，静默退化成
// 「通过」。这里先读报告文件，再退回文本解析。
function readStrykerReport(targetPath) {
  const candidates = [
    'reports/mutation/mutation.json',
    'reports/mutation/mutation-report.json',
    'mutation-report.json',
  ];
  for (const rel of candidates) {
    const file = join(targetPath, rel);
    if (!existsSync(file)) continue;
    try {
      const parsed = parseStrykerJson(readFileSync(file, 'utf-8'));
      if (parsed) return parsed;
    } catch {
      /* 试下一个候选文件 */
    }
  }
  return null;
}

export function handleStryker(_action, _params, targetPath, context) {
  if (!hasStrykerConfig(targetPath)) {
    // 没配置就没跑。置 passed 等于「没验证却算通过」——这正是本引擎要杜绝的。
    return { status: 'skip', message: 'Stryker 跳过: 无 stryker 配置（npm i -D @stryker-mutator/core 后可启用变异测试）' };
  }

  try {
    const raw = safeExec(
      'npx stryker run --reporter json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 600000 },
    ).toString();

    if (isToolMissing(raw)) {
      return { status: 'skip', message: 'Stryker 跳过: 本机没有 stryker（不是通过）' };
    }
    const report = readStrykerReport(targetPath) || parseStrykerText(raw);
    if (!report || !report.score) {
      return { status: 'skip', message: 'Stryker 未产生变异测试报告（检查 stryker 配置与测试命令），本轮未测量 —— 不是通过' };
    }

    const { score, killed, survived } = report;
    if (context) {
      context.strykerScore = score;
      context.strykerSurvived = survived;
      context.strykerPassed = survived === 0;
    }
    console.log(chalk.dim(`  ℹ 变异分数 ${score.toFixed(1)}%（杀死 ${killed} / 存活 ${survived}）`));
    // 有存活变异体说明测试没覆盖到该路径 —— 归 warn，不归 pass。
    return survived > 0
      ? { status: 'warn', message: `Stryker 变异测试完成: 分数 ${score.toFixed(1)}%，${survived} 处发现（存活变异体，测试未覆盖）` }
      : `Stryker 变异测试完成: 分数 ${score.toFixed(1)}%，变异体全部被杀死`;
  } catch {
    // 「执行失败」以前被「跳过」二字救回 → 记成 noop。工具没跑通=没测量，但必须可见。
    return { status: 'skip', message: 'Stryker 执行失败（未测量，不算通过）' };
  }
}

// ── Spectral — API/OpenAPI linting (2.5k+ stars) ──

function hasSpectralConfig(targetPath) {
  return existsSync(join(targetPath, '.spectral.yaml')) ||
    existsSync(join(targetPath, '.spectral.json')) ||
    existsSync(join(targetPath, '.spectral.js'));
}

function parseSpectralJson(raw) {
  try {
    const results = JSON.parse(raw);
    if (!Array.isArray(results)) return null;
    const errors = results.filter(r => r.severity === 0).map(r =>
      `${r.code || 'unknown'}: ${(r.message || '').slice(0, 150)}`
    );
    if (results.length > 0) {
      console.error(chalk[errors.length > 0 ? 'red' : 'yellow'](
        `  ${errors.length > 0 ? '🔴' : '⚠'} Spectral: ${results.length} 个问题（error: ${errors.length}）`
      ));
    } else {
      console.log(chalk.green('  ✅ Spectral: API lint 无问题'));
    }
    return { issueCount: results.length };
  } catch {
    return null;
  }
}

function parseSpectralText(raw) {
  if (raw.trim() === '' || raw.includes('No errors') || raw.includes('no results')) {
    return { issueCount: 0 };
  }
  return { issueCount: (raw.match(/\berror\b/gi) || []).length };
}

export function handleSpectral(_action, _params, targetPath, context) {
  const specFiles = scanDir(targetPath, {
    filter: f => /(openapi|swagger).*\.(yaml|yml|json)$/i.test(f) && !f.includes('node_modules'),
  });

  if (!hasSpectralConfig(targetPath) && specFiles.length === 0) {
    // 没有 spec 文件 = 没有可 lint 的对象，不是「lint 通过」。
    return { status: 'noop', message: 'Spectral API lint 无需执行: 无 OpenAPI/Spec 文件' };
  }

  let issueCount = 0;
  let measured = false;
  let missing = false;
  try {
    const targets = specFiles.length > 0 ? specFiles.join(' ') : '.';
    const raw = safeExec(
      `npx spectral lint ${targets} --format json 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    if (isToolMissing(raw)) {
      missing = true;
    } else {
      const result = parseSpectralJson(raw) || parseSpectralText(raw);
      issueCount = result.issueCount;
      measured = true;
    }
  } catch {
    console.log(chalk.dim('  ℹ Spectral 不可用，跳过 API lint'));
  }

  if (!measured) {
    // 以前 catch 后 issueCount 仍是 0 → spectralPassed = true → 门禁报通过。
    return { status: 'skip', message: `Spectral API lint 未执行：${missing ? '本机没有 spectral' : '无输出'}（不是通过）` };
  }
  if (context) context.spectralPassed = issueCount === 0;
  return issueCount > 0
    ? { status: 'warn', message: `Spectral API lint 完成: ${issueCount} 个问题` }
    : 'Spectral API lint 完成: 无问题';
}

// ── markdownlint — Markdown file linting (5k+ stars) ──

function countMdJsonErrors(results) {
  let count = 0;
  if (Array.isArray(results)) {
    for (const r of results) {
      count += Array.isArray(r.errors) ? r.errors.length : (r.errorCount || 0);
    }
  } else if (typeof results === 'object') {
    for (const errors of Object.values(results)) {
      count += Array.isArray(errors) ? errors.length : 0;
    }
  }
  return count;
}

function countMdTextErrors(raw) {
  return raw.split('\n').filter(Boolean).filter(l =>
    /^[^:]+:\d+:\d+\s+(MD\d+|\w+-)/i.test(l)
  ).length;
}

export function handleMarkdownlint(_action, _params, targetPath, context) {
  let issueCount = 0;
  let measured = false;
  let missing = false;
  try {
    const raw = safeExec(
      'npx markdownlint "**/*.md" --ignore node_modules --ignore ".git" --ignore ".claude/worktrees" --json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 60000 }
    ).toString();

    if (isToolMissing(raw) || !raw.trim()) {
      missing = isToolMissing(raw);
    } else {
      try {
        issueCount = countMdJsonErrors(JSON.parse(raw));
      } catch {
        issueCount = countMdTextErrors(raw);
      }
      measured = true;
      if (issueCount > 0) {
        console.log(chalk.yellow(`  ⚠ markdownlint: ${issueCount} 个问题`));
      } else {
        console.log(chalk.green('  ✅ markdownlint: 无问题'));
      }
    }
  } catch {
    console.log(chalk.dim('  ℹ markdownlint 不可用，跳过 Markdown lint'));
  }

  if (!measured) {
    // 以前工具没装时 issueCount 停在 0 → markdownlintPassed = true（没查=通过）。
    return { status: 'skip', message: `markdownlint 未执行：${missing ? '本机没有 markdownlint' : '无输出'}（不是通过）` };
  }
  if (context) context.markdownlintPassed = issueCount === 0;
  return issueCount > 0
    ? { status: 'warn', message: `markdownlint 完成: ${issueCount} 个问题` }
    : 'markdownlint 完成: 无问题';
}

// ── size-limit — bundle size budgeting (6.5k+ stars) ──

function hasSizeLimitConfig(targetPath) {
  if (existsSync(join(targetPath, '.size-limit.json')) ||
      existsSync(join(targetPath, '.size-limit.cjs')) ||
      existsSync(join(targetPath, '.size-limit.mjs'))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    return !!(pkg['size-limit'] || pkg.sizeLimit);
  } catch { return false; }
}

function parseSizeLimitResults(results) {
  const items = Array.isArray(results) ? results : (results.results || []);
  const failures = [];
  for (const item of items) {
    const name = item.name || 'unknown';
    const size = item.size || 0;
    const limit = item.limit || item.maxSize || 0;
    if (limit > 0 && size > limit) {
      const sizeKB = (size / 1024).toFixed(1);
      const limitKB = (limit / 1024).toFixed(1);
      failures.push(`${name}: ${sizeKB} KB > 限制 ${limitKB} KB`);
    }
  }
  return { failures, isEmpty: items.length === 0 };
}

function logSizeLimitOutcome(failures, itemsEmpty) {
  if (failures.length > 0) {
    return false;
  }
  if (!itemsEmpty) {
    console.log(chalk.green('  ✅ size-limit: 所有包体积符合预算'));
  }
  return true;
}

function logSizeLimitText(raw) {
  if (raw.includes('FAIL') || raw.includes('exceed')) {
    return false;
  }
  if (raw.trim()) {
    console.log(chalk.green('  ✅ size-limit 检查通过'));
  }
  return true;
}

export function handleSizeLimit(_action, _params, targetPath, context) {
  if (!hasSizeLimitConfig(targetPath)) {
    // 没有预算配置 = 无事可做；以前顺手置 sizeLimitPassed = true 冒充「体积达标」。
    return { status: 'noop', message: '包体积检查无需执行: 无 size-limit 配置' };
  }

  let isPassed = true;
  let failures = [];
  let measured = false;
  let missing = false;

  try {
    const raw = safeExec(
      'npx size-limit --json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 1024 * 1024, timeout: 60000 }
    ).toString();

    if (isToolMissing(raw)) {
      missing = true;
    } else {
      try {
        const parsed = parseSizeLimitResults(JSON.parse(raw));
        failures = parsed.failures;
        isPassed = logSizeLimitOutcome(parsed.failures, parsed.isEmpty);
      } catch {
        isPassed = logSizeLimitText(raw);
      }
      measured = true;
    }
  } catch {
    console.log(chalk.dim('  ℹ size-limit 不可用，跳过包体积检查'));
  }

  if (!measured) {
    // 以前 catch 后 isPassed 仍是 true → sizeLimitPassed = true（没测=通过）。
    return { status: 'skip', message: `包体积检查未执行：${missing ? '本机没有 size-limit' : '调用失败'}（不是通过）` };
  }
  if (context) context.sizeLimitPassed = isPassed;
  return isPassed
    ? '包体积检查完成: 通过'
    : { status: 'warn', message: `包体积检查完成: 超出预算 — ${failures.join('; ') || '见 size-limit 输出'}` };
}

// ── pa11y-ci — WCAG 无障碍扫描 ──

export function handlePa11yCi(_action, params, targetPath, context) {
  // standard（WCAG2A / WCAG2AA / WCAG2AAA）：无障碍标准档位。review#2.35
  // 声明了 WCAG2AA，以前没人读 —— 扫的是 pa11y-ci 的默认档。
  const standard = typeof params?.standard === 'string' ? params.standard : '';
  const standardFlag = standard ? ` --standard ${escapeArg(standard)}` : '';
  try {
    // 以前 `|| true` 吞掉退出码，再用 `!raw.includes('Error:')` 猜结论：
    // 工具没装时 catch 分支返回字符串「不可用，跳过」→ 也被记 ✓ pass。
    safeExec(`npx pa11y-ci${standardFlag} 2>&1`, targetPath, { stdio: 'pipe', timeout: 120000 });
  } catch (error) {
    const text = `${error?.stdout || ''}${error?.stderr || ''}${error?.message || ''}`;
    if (/ENOENT|not recognized|not found|command not found/i.test(text)) {
      return { status: 'skip', message: 'pa11y-ci 无障碍扫描跳过：本机没有 pa11y-ci（npx pa11y-ci 未安装）' };
    }
    // 退出码非 0 = 扫出了违规（pa11y-ci 就是这么表达的），有结论：不通过
    if (context) context.pa11yPassed = false;
    return { status: 'fail', message: `pa11y-ci 无障碍扫描未通过（${standard || '默认标准'}）：${firstLines(text) || '见 pa11y-ci 输出'}` };
  }
  if (context) context.pa11yPassed = true;
  return { status: 'pass', message: `pa11y-ci 无障碍扫描完成（${standard || '默认标准'}）：无违规` };
}

function firstLines(text) {
  return text
    .split(/[\r\n]+/)
    .filter(Boolean)
    .slice(-3)
    .join(' ')
    .slice(0, 200);
}

// ── DESIGN.md lint — Google DESIGN.md CLI 格式校验 ──

export function handleDesignMdLint(_action, _params, targetPath, context) {
  try {
    const raw = safeExec('npx @google/design.md lint 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    if (/ENOENT|not recognized|command not found/i.test(raw) || !raw.trim()) {
      // 工具没装 = 没检查。以前 raw 为空 → 两个 includes 全 false → 置 true。
      return { status: 'skip', message: '@google/design.md lint 跳过：本机没有这个 CLI（没检查不等于通过）' };
    }
    if (context) context.designMdPassed = !raw.includes('error') && !raw.includes('FAIL');
    return `DESIGN.md lint 完成`;
  } catch {
    return { status: 'skip', message: 'DESIGN.md lint 不可用（未检查，不是通过）' };
  }
}

// ── DESIGN.md export — Google DESIGN.md CLI Tailwind 导出 ──

export function handleDesignMdExport(_action, _params, targetPath) {
  try {
    safeExec('npx @google/design.md export --format tailwind 2>&1', targetPath, { stdio: 'pipe' });
    return 'DESIGN.md Tailwind 配置导出完成';
  } catch {
    return { status: 'skip', message: 'DESIGN.md export 不可用（未导出，不是通过）' };
  }
}

// ── CodeGraph / CodeGuardian — MCP 工具（仅对话模式可用）──

export function handleCodeGraphImpact(_action, params) {
  // symbol / depth 是给 codegraph 的查询参数。以前完全不读：场景写的
  // symbol:"affected_function"、depth:3 被静默丢弃，跳过的还是同一句。
  // 引擎不执行 MCP，但必须把「本来要问什么」带进结论，否则没人看得出来声明丢了。
  const ask = describeCodeGraphAsk(params);
  return { status: 'skip', message: `未配置 codegraph MCP，跳过 CodeGraph 影响分析（未测量）${ask}` };
}

export function handleCodeGraphTrace(_action, params) {
  const ask = describeCodeGraphAsk(params);
  return { status: 'skip', message: `未配置 codegraph MCP，跳过 CodeGraph 依赖追踪（未测量）${ask}` };
}

/** 把 codegraph 的查询参数拼成一句人话（没声明就返回空串，不凭空补默认值）。 */
function describeCodeGraphAsk(params) {
  if (!params || typeof params !== 'object') return '';
  const parts = [];
  if (params.symbol) parts.push(`symbol=${params.symbol}`);
  if (params.from) parts.push(`from=${params.from}`);
  if (params.to) parts.push(`to=${params.to}`);
  if (params.depth !== undefined) parts.push(`depth=${params.depth}`);
  return parts.length > 0 ? `；本应查询 ${parts.join(', ')}` : '';
}

