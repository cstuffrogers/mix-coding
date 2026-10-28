import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';
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

export function handleKnipCheck(_action, _params, targetPath, context) {
  try {
    const result = safeExec('npx knip --reporter json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    try {
      const parsed = JSON.parse(result);
      const issues = parsed.issues || [];
      let fileCount = 0;
      let depCount = 0;
      let exportCount = 0;
      for (const issue of issues) {
        fileCount += issue.files?.length || 0;
        depCount += (issue.dependencies?.length || 0) + (issue.devDependencies?.length || 0);
        exportCount += issue.exports?.length || 0;
      }
      const total = fileCount + depCount + exportCount;
      if (total > 0) {
        if (context) context.deadCodePassed = false;
        return `死代码检测完成: ${total} 项`;
      }
      if (context) context.deadCodePassed = true;
      return '死代码检测完成: 无死代码';
    } catch {
      if (result.includes('✂️') || result.includes('excellent') || result.includes('congratulations')) {
        if (context) context.deadCodePassed = true;
        return '死代码检测完成: 无死代码';
      }
      // 解析不出结果 = 没拿到结论。以前返回「完成（结果解析失败）」，
      // 消息里有「完成」二字，报告里就是这个 gate ✓ pass。
      return { status: 'warn', message: `死代码检测未完成：knip 输出无法解析（${String(result).trim().slice(0, 80) || '空输出'}）` };
    }
  } catch (e) {
    console.log(chalk.dim(`  ⚠ knip 不可用: ${e.message?.slice(0, 100) || '未安装'}`));
  }
  // 工具没装 = 这一步什么都没做。以前同样写成「完成（knip 不可用）」，靠 NOOP 正则
  // 碰巧记成 noop；显式 skip 才不依赖文案巧合。
  return { status: 'skip', message: '死代码检测跳过：knip 未安装（npm i -D knip 后可启用）' };
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
    // Don't set buildLeakPassed — let gate report as skipped (tool didn't run)
    return '构建泄露检查完成: 无构建产物，已跳过';
  }

  const findings = [];
  let isPassed = true;

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

  if (context) context.buildLeakPassed = isPassed;
  return `构建泄露检查完成: ${findings.length ? findings.join('; ') : '无泄露'}`;
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
  return `死链接检测完成: ${brokenCount} 个死链接`;
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
    return 'ReDoS 扫描失败: 未找到任何 JS/TS 源码（扫描范围为空，结果不可信）';
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
    return `ReDoS 扫描完成: ${hits.length} 处可疑（扫描 ${files.length} 个文件）`;
  }
  console.log(chalk.green(`  ✅ 未发现嵌套量词正则（扫描 ${files.length} 个文件）`));
  return `ReDoS 扫描完成: 未发现可疑正则（扫描 ${files.length} 个文件）`;
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

function reportSkillspectorFindings(allFindings, context) {
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
    if (context) context.skillspectorPassed = critical.length === 0;
    // 显式状态：「N 个问题」靠 WARN_RES 猜太脆，而且这里本来就该让人看见。
    return {
      status: 'warn',
      message: `SkillSpector 扫描完成: ${total} 个问题（CRITICAL ${critical.length} / HIGH ${high.length}）`,
    };
  }

  if (context) context.skillspectorPassed = true;
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

export function handleSkillspectorScan(_action, _params, targetPath, context) {
  const targets = buildScanTargets(targetPath);
  if (targets.length === 0) return { status: 'skip', message: 'SkillSpector 扫描跳过: 没有技能目录' };

  const skillspectorCmd = _resolvePythonTool('skillspector', null);
  const probe = probeTool(skillspectorCmd, targetPath);
  if (!probe.available) {
    return { status: 'skip', message: 'SkillSpector 扫描跳过：本机没有安装 skillspector（pip install skillspector 后可启用）' };
  }
  const hasLlmKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const llmFlag = hasLlmKey ? '' : ' --no-llm';

  const allFindings = [];
  let isScanFailed = false;
  let failReason = '';

  for (const target of targets) {
    try {
      // 不要 2>&1：stderr 里是 Python 依赖的弃用警告，混进 stdout 会让 JSON 解析失败。
      const cmd = `${skillspectorCmd} scan ${target} --format json${llmFlag}`;
      const result = scanSingleTarget(cmd, targetPath, allFindings);
      if (result.isScanFailed) isScanFailed = true;
    } catch (e) {
      const err = classifyScanError(e);
      if (err.missing) return { status: 'skip', message: 'SkillSpector 扫描跳过：本机没有可用的 skillspector' };
      isScanFailed = true;
      failReason ||= err.reason;
    }
  }

  // 「部分失败」带「部分」二字，恰好命中 detectHandlerFailure 的排除名单 → 以前记 pass。
  // 扫描没跑完就不算通过，但也不该判 fail（没有证据说技能有问题）。
  if (isScanFailed && allFindings.length === 0) {
    return {
      status: 'warn',
      message: `SkillSpector 扫描未完成: 部分技能目录执行失败，没有扫描结果${failReason ? `（${failReason.slice(0, 120)}）` : ''}`,
    };
  }

  return reportSkillspectorFindings(allFindings, context);
}

// ── actionlint — GitHub Actions workflow syntax checker (3k+ stars) ──

export function handleActionlint(_action, _params, targetPath, context) {
  const workflowsDir = join(targetPath, '.github', 'workflows');

  if (!existsSync(workflowsDir)) {
    if (context) context.actionlintPassed = true;
    return 'actionlint 检查完成: 无 GitHub Actions 工作流目录';
  }

  let issueCount = 0;

  try {
    const raw = safeExec(
      'npx actionlint -format "{{range .}}::error file={{.Filepath}},line={{.Lineno}},col={{.Col}}::{{.Message}}{{end}}" .github/workflows/ 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 1024 * 1024, timeout: 30000 }
    ).toString();

    const lines = raw.split('\n').filter(Boolean);
    issueCount = lines.filter(l => /^::error\b/.test(l)).length;

    if (issueCount > 0) {
      lines.filter(l => /^::error\b/.test(l)).slice(0, 15).forEach(l => {
        console.log(chalk.yellow(`    ${l.replace(/^::error\s+/, '').slice(0, 200)}`));
      });
    } else if (raw.includes('no lint errors') || raw.trim() === '') {
      console.log(chalk.green('  ✅ actionlint: 工作流语法无问题'));
    }
  } catch {
    console.log(chalk.dim('  ℹ actionlint 不可用，跳过工作流语法检查'));
  }

  if (context) context.actionlintPassed = issueCount === 0;
  return `actionlint 检查完成: ${issueCount > 0 ? `${issueCount} 个问题` : '无问题'}`;
}

// ── zizmor — GitHub Actions security auditor (2.5k+ stars) ──

function parseZizmorJson(raw) {
  try {
    const results = JSON.parse(raw);
    const allFindings = Array.isArray(results) ? results : (results.findings || []);
    if (allFindings.length === 0) {
      return { findingCount: 0 };
    }
    const bySeverity = {};
    for (const f of allFindings) {
      const sev = f.severity || 'unknown';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    console.log(chalk.dim(`  ℹ 发现 ${allFindings.length} 项 (${Object.entries(bySeverity).map(([k, v]) => `${k}: ${v}`).join(', ')})`));
    return { findingCount: allFindings.length };
  } catch {
    return null;
  }
}

function parseZizmorText(raw) {
  if (raw.toLowerCase().includes('vulnerability') || raw.toLowerCase().includes('error')) {
    return { findingCount: (raw.match(/\b(ERROR|WARN|FAIL)\b/g) || []).length };
  }
  if (raw.includes('no issues') || raw.includes('clean') || raw.trim() === '') {
    console.log(chalk.green('  ✅ zizmor: 工作流安全无问题'));
  }
  return { findingCount: 0 };
}

export function handleZizmor(_action, _params, targetPath, context) {
  const workflowsDir = join(targetPath, '.github', 'workflows');
  if (!existsSync(workflowsDir)) {
    if (context) context.zizmorPassed = true;
    return 'zizmor 检查完成: 无 GitHub Actions 工作流目录';
  }

  let findingCount = 0;
  try {
    const raw = safeExec(
      'npx zizmor --format json .github/workflows/ 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    const jsonResult = parseZizmorJson(raw);
    const result = jsonResult || parseZizmorText(raw);
    findingCount = result.findingCount;
  } catch {
    console.log(chalk.dim('  ℹ zizmor 不可用，跳过工作流安全审计'));
  }

  if (context) context.zizmorPassed = findingCount === 0;
  return `zizmor 检查完成: ${findingCount > 0 ? `${findingCount} 个问题` : '无问题'}`;
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

function reportJscpdFound(clones, pct, context) {
  if (pct > 5) {
    if (context) context.jscpdPassed = false;
  } else {
    if (context) context.jscpdPassed = true;
  }
  return `代码重复检测完成: ${clones} 处重复，重复率 ${pct.toFixed(1)}%`;
}

export function handleJscpd(_action, params, targetPath, context) {
  // 场景声明了 minTokens（review#…写的是 50）。以前 runJscpd 写死了--min-tokens 50，
  // 参数是装饰品。
  const minTokens = Number.parseInt(params?.minTokens, 10);
  const raw = runJscpd(targetPath, Number.isFinite(minTokens) && minTokens > 0 ? minTokens : 50);
  if (!raw) {
    // jscpd 没输出 = 没拿到结论（不可用/崩了）。以前这句带「完成」二字，引擎判 pass。
    return { status: 'warn', message: '代码重复检测未完成: jscpd 无输出（未安装或执行失败）' };
  }

  const parsed = parseJscpdResult(raw);
  if (parsed && (parsed.clones > 0 || parsed.pct > 0)) {
    return reportJscpdFound(parsed.clones, parsed.pct, context);
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
    if (context) context.strykerSkipped = true;
    return 'Stryker 跳过: 无 stryker 配置（npm i -D @stryker-mutator/core 后可启用变异测试）';
  }

  try {
    const raw = safeExec(
      'npx stryker run --reporter json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 600000 },
    ).toString();

    const report = readStrykerReport(targetPath) || parseStrykerText(raw);
    if (!report || !report.score) {
      if (context) context.strykerSkipped = true;
      return 'Stryker 跳过: 未产生变异测试报告（检查 stryker 配置与测试命令）';
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
      ? `Stryker 变异测试完成: 分数 ${score.toFixed(1)}%，${survived} 处发现（存活变异体，测试未覆盖）`
      : `Stryker 变异测试完成: 分数 ${score.toFixed(1)}%，变异体全部被杀死`;
  } catch {
    if (context) context.strykerSkipped = true;
    return 'Stryker 跳过: 执行失败';
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
    if (context) context.spectralPassed = true;
    return 'Spectral API lint 完成: 无 OpenAPI/Spec 文件，已跳过';
  }

  let issueCount = 0;
  try {
    const targets = specFiles.length > 0 ? specFiles.join(' ') : '.';
    const raw = safeExec(
      `npx spectral lint ${targets} --format json 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    const result = parseSpectralJson(raw) || parseSpectralText(raw);
    issueCount = result.issueCount;
  } catch {
    console.log(chalk.dim('  ℹ Spectral 不可用，跳过 API lint'));
  }

  if (context) context.spectralPassed = issueCount === 0;
  return `Spectral API lint 完成: ${issueCount > 0 ? `${issueCount} 个问题` : '无问题'}`;
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
  try {
    const raw = safeExec(
      'npx markdownlint "**/*.md" --ignore node_modules --ignore ".git" --ignore ".claude/worktrees" --json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 60000 }
    ).toString();

    try {
      issueCount = countMdJsonErrors(JSON.parse(raw));
    } catch {
      issueCount = countMdTextErrors(raw);
    }

    if (issueCount > 0) {
      console.log(chalk.yellow(`  ⚠ markdownlint: ${issueCount} 个问题`));
    } else if (raw.trim()) {
      console.log(chalk.green('  ✅ markdownlint: 无问题'));
    }
  } catch {
    console.log(chalk.dim('  ℹ markdownlint 不可用，跳过 Markdown lint'));
  }

  if (context) context.markdownlintPassed = issueCount === 0;
  return `markdownlint 完成: ${issueCount > 0 ? `${issueCount} 个问题` : '无问题'}`;
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
    if (context) context.sizeLimitPassed = true;
    return '包体积检查完成: 无 size-limit 配置，已跳过';
  }

  let isPassed = true;
  let failures = [];

  try {
    const raw = safeExec(
      'npx size-limit --json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 1024 * 1024, timeout: 60000 }
    ).toString();

    try {
      const parsed = parseSizeLimitResults(JSON.parse(raw));
      failures = parsed.failures;
      isPassed = logSizeLimitOutcome(parsed.failures, parsed.isEmpty);
    } catch {
      isPassed = logSizeLimitText(raw);
    }
  } catch {
    console.log(chalk.dim('  ℹ size-limit 不可用，跳过包体积检查'));
  }

  if (context) context.sizeLimitPassed = isPassed;
  return `包体积检查完成: ${isPassed ? '通过' : failures.join('; ')}`;
}

// ── pa11y-ci — WCAG 无障碍扫描 ──

export function handlePa11yCi(_action, _params, targetPath, context) {
  try {
    const raw = safeExec('npx pa11y-ci 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    if (context) context.pa11yPassed = !raw.includes('Error:');
    return `pa11y-ci 无障碍扫描完成`;
  } catch {
    return 'pa11y-ci 不可用，跳过无障碍扫描';
  }
}

// ── DESIGN.md lint — Google DESIGN.md CLI 格式校验 ──

export function handleDesignMdLint(_action, _params, targetPath, context) {
  try {
    const raw = safeExec('npx @google/design.md lint 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    if (context) context.designMdPassed = !raw.includes('error') && !raw.includes('FAIL');
    return `DESIGN.md lint 完成`;
  } catch {
    return 'DESIGN.md lint 不可用，跳过';
  }
}

// ── DESIGN.md export — Google DESIGN.md CLI Tailwind 导出 ──

export function handleDesignMdExport(_action, _params, targetPath) {
  try {
    safeExec('npx @google/design.md export --format tailwind 2>&1', targetPath, { stdio: 'pipe' });
    return 'DESIGN.md Tailwind 配置导出完成';
  } catch {
    return 'DESIGN.md export 不可用，跳过';
  }
}

// ── CodeGraph / CodeGuardian — MCP 工具（仅对话模式可用）──

export function handleCodeGraphImpact() {
  // 未配置 codegraph MCP 时这里是明确的跳过，不是「通过」
  return '未配置 codegraph MCP，跳过 CodeGraph 影响分析（未测量）';
}

export function handleCodeGraphTrace() {
  return '未配置 codegraph MCP，跳过 CodeGraph 依赖追踪（未测量）';
}

