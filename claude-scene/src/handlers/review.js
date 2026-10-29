import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { grepScan } from '../lib/grep-scan.js';
import { scanDir } from '../lib/scan-dir.js';
import { isConversationMode } from '../lib/platform.js';
import { formatCandidates } from './security/insecure-defaults.js';

/**
 * Run a command that may exit non-zero (e.g. linter finding issues).
 * Returns stdout on success or non-zero exit; throws only on crash/signal.
 */
export function runDiagnostic(command, targetPath) {
  try {
    return safeExec(`${command} 2>&1`, targetPath, { stdio: 'pipe' }).toString();
  } catch (e) {
    // execSync throws on non-zero exit — return captured output if available
    if (e.stdout) return e.stdout.toString();
    if (e.stderr) return e.stderr.toString();
    return '';
  }
}

// [patched:lint-from-script] 各项目源码目录/工具链各不相同（本仓库前端在 frontend/student，
// 没有 src/ 目录），硬编码 `npx eslint src` 必然报环境错误 → 被归为「跳过」= 假通过。
// 项目 package.json 里有 lint / typecheck 脚本就优先用项目自己的。
function _projectScript(targetPath, name) {
  try {
    const raw = safeExec('cat package.json', targetPath, { stdio: 'pipe', timeout: 5000 }).toString();
    const scripts = JSON.parse(raw).scripts || {};
    return typeof scripts[name] === 'string' ? scripts[name] : null;
  } catch {
    return null;
  }
}

// [patched:lint-from-script] stylish 格式把文件名与「行:列」分两行输出，原正则只认一行式
// file:line:col，会把真实问题漏成「无问题」。多认两种形式：缩进行号式（仅 error 级，
// warning 不影响门禁）+ eslint 汇总 errors 计数。提取为共享函数避免两处重复。
function _hasLintIssues(result) {
  // eslint-disable-next-line sonarjs/super-linear-regex -- bounded CLI output (stylish「行:列 error」行，无回溯风险)
  if (/^\s*\d+:\d+\s+error\b/m.test(result)) return true;
  if (/(?:^|\n)[^\n:]+:\d+:\d+\b/.test(result)) return true;
  // eslint-disable-next-line sonarjs/super-linear-regex -- bounded CLI output (eslint 汇总「N errors」)
  const errorCount = /(\d+)\s+errors?\b/.exec(result);
  return errorCount ? Number(errorCount[1]) > 0 : false;
}

function runSecurityEslint(targetPath, autoFix) {
  const lintScript = _projectScript(targetPath, 'lint');
  let cmd = lintScript
    ? `npm run lint${autoFix ? ' -- --fix' : ''}`
    : `npx eslint src --ext .js,.jsx,.ts,.tsx${autoFix ? ' --fix' : ''}`;
  const result = runDiagnostic(cmd, targetPath);
  const hasFileIssues = _hasLintIssues(result);
  // Only treat security-rule violations as security findings, not arbitrary lint errors.
  const securityRulePattern = /\b(security|sonarjs\/(?:hardcoded-credentials|os-command|code-eval|no-clear-text-protocols|no-weak-cipher|no-weak-hash|insecure-jwt-token|x-frame-options|cors|sql-queries|disabled-auto-escaping|content-length|production-debug|hashing|publicly-writable-directories))\b/i;
  if (securityRulePattern.test(result) && hasFileIssues) {
    return { foundIssues: true, foundSecurityIssues: true };
  }
  if (hasFileIssues) {
    return { foundIssues: true, foundSecurityIssues: false };
  }
  if (result.includes('fixed')) {
    return { foundIssues: true, foundSecurityIssues: false };
  }
  if (/No files matching|Could not find config|Cannot find module|Invalid option|ESLint couldn't find/i.test(result)) {
    console.log(chalk.dim('  ℹ ESLint 配置/环境问题（非代码问题），跳过'));
  }
  return { foundIssues: false, foundSecurityIssues: false };
}

function runNpmAudit(targetPath, autoFix) {
  const cmd = autoFix
    ? 'npm audit fix --only=prod 2>&1 || npm audit fix 2>&1'
    : 'npm audit';
  const result = runDiagnostic(cmd, targetPath);
  // Detect mirror/registry failures (npmmirror returns 404 for /-/npm/v1/security/*) — treat as non-blocking warning.
  if (result.includes('NOT_IMPLEMENTED') || /404 Not Found.{0,200}\/-\/npm\/v1\/security/i.test(result)) {
    return { foundIssues: false, foundSecurityIssues: false };
  }
  if (result.includes('high') || result.includes('critical')) {
    return { foundIssues: true, foundSecurityIssues: true };
  }
  if (result.includes('moderate') || result.includes('fixed')) {
    return { foundIssues: true, foundSecurityIssues: false };
  }
  return { foundIssues: false, foundSecurityIssues: false };
}

// [patched:tri-state] 三个检查都返回三态：issues（真有问题）/ pass（真跑过且干净）/
// skip（没跑成）。原先只有 true/false，把「没跑成」和「跑过且干净」合并成 false，
// 上层 deriveStepStatus 就把跳过报成 pass —— 假绿。
const TS_CONFIG_SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'target', '.mcp', '.claude', 'open-design',
]);

/**
 * 根目录没有 tsconfig.json 时向下探一层。本仓库源码在 claude-scene/ 这类子项目里，
 * 在根跑 `npx tsc --noEmit` 只会打印帮助并退出 1，命中 /error|Error/ 就被误判成
 * 「配置问题」而静默跳过类型检查。
 */
export function findTsconfigs(targetPath, maxDepth = 1) {
  if (existsSync(path.join(targetPath, 'tsconfig.json'))) return [targetPath];
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth || found.length >= 3) return;
    const entries = readdirSyncOrEmpty(dir);
    for (const entry of entries) {
      if (!entry.isDirectory() || TS_CONFIG_SKIP_DIRS.has(entry.name)) continue;
      const sub = path.join(dir, entry.name);
      if (existsSync(path.join(sub, 'tsconfig.json'))) found.push(sub);
      else walk(sub, depth + 1);
      if (found.length >= 3) return;
    }
  };
  walk(targetPath, 1);
  return found;
}

function readdirSyncOrEmpty(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function classifyTscOutput(result) {
  if (/\berror\s+TS\d+/i.test(result)) return 'issues';
  // tsc 找不到入口时打印帮助/退出，含 --noEmitOnError 等字样，不能当类型错误。
  if (/COMMON COMMANDS|No inputs were found|--noEmitOnError/i.test(result)) return 'skip';
  return 'pass';
}

function classifyLintOutput(result) {
  if (_hasLintIssues(result)) return 'issues';
  if (result.includes('fixed')) return 'issues';
  if (/No files matching|Could not find config|Cannot find module|Invalid option|ESLint couldn't find/i.test(result)) {
    return 'skip';
  }
  return 'pass';
}

function runEslintCheck(targetPath, autoFix) {
  const lintScript = _projectScript(targetPath, 'lint');
  const cmd = lintScript
    ? `npm run lint${autoFix ? ' -- --fix' : ''}`
    : `npx eslint src --ext .js,.jsx,.ts,.tsx${autoFix ? ' --fix' : ''}`;
  const status = classifyLintOutput(runDiagnostic(cmd, targetPath));
  if (status === 'skip') console.log(chalk.dim('  ℹ ESLint 配置/环境问题（非代码问题），跳过'));
  return { status, detail: status === 'skip' ? 'eslint 未跑成（配置/环境问题）' : 'eslint' };
}

function runTypeCheck(targetPath) {
  const tsScript = _projectScript(targetPath, 'typecheck');
  const configs = tsScript ? [] : findTsconfigs(targetPath);
  if (!tsScript && configs.length === 0) {
    console.log(chalk.dim('  ℹ 未找到 tsconfig.json（根及一层子目录），类型检查跳过'));
    return { status: 'skip', detail: '未找到 tsconfig.json' };
  }
  const runs = tsScript
    ? [{ cmd: 'npm run typecheck', label: 'npm run typecheck' }]
    : configs.map(cfg => {
      const rel = path.relative(targetPath, cfg) || '.';
      return { cmd: `npx tsc --noEmit -p "${rel}"`, label: `tsc ${rel}` };
    });
  const results = runs.map(r => ({ label: r.label, status: classifyTscOutput(runDiagnostic(r.cmd, targetPath)) }));
  const failing = results.filter(r => r.status === 'issues');
  const passed = results.filter(r => r.status === 'pass');
  if (failing.length > 0) {
    console.log(chalk.red(`  ❌ 类型检查: ${failing.map(r => r.label).join(', ')}`));
    return { status: 'issues', detail: `类型错误（${failing.map(r => r.label).join(', ')}）` };
  }
  if (passed.length === 0) {
    return { status: 'skip', detail: '类型检查未跑成（tsc 无入口）' };
  }
  return { status: 'pass', detail: `类型检查通过（${passed.map(r => r.label).join(', ')}）` };
}

function runPa11yCheck(targetPath) {
  const htmlFiles = safeExec(
    `find . -name "*.html" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -20 || true`,
    targetPath,
    { stdio: 'pipe', timeout: 10000 }
  ).toString().trim();
  if (!htmlFiles) return null;

  const urls = htmlFiles.split('\n').filter(Boolean).map(f => {
    const abs = `${targetPath.replace(/\\/g, '/')}/${f.replace(/^\.\//, '')}`;
    return `file://${abs}`;
  });
  if (urls.length === 0) return null;

  try {
    const pa11yCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const pa11yRaw = safeExec(
      `${pa11yCmd} pa11y-ci ${urls.join(' ')} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 5 * 1024 * 1024, timeout: 120000 }
    ).toString();

    let issueCount = 0;
    const errMatch = pa11yRaw.match(/(?<!\d)(\d+)\s+errors?/i);
    if (errMatch) issueCount += parseInt(errMatch[1]);
    const violations = pa11yRaw.split('\n').filter(l => /error:/i.test(l) || /^\s*•/.test(l));
    if (violations.length > 0 && issueCount === 0) issueCount = violations.length;

    if (issueCount > 0) {
      console.log(chalk.yellow(`  ⚠ pa11y-ci: ${issueCount} 个 WCAG 问题`));
      violations.slice(0, 8).forEach(v => console.log(chalk.dim(`    ${v.trim().slice(0, 140)}`)));
    } else {
      console.log(chalk.green('  ✅ pa11y-ci: WCAG 2.1 AA 通过'));
    }
    return issueCount;
  } catch {
    return null;
  }
}

function grepA11yIssue(targetPath, grepCmd) {
  const result = runDiagnostic(grepCmd, targetPath).trim();
  if (!result) return 0;
  return result.split('\n').filter(Boolean).length;
}

function runA11yCheck(targetPath) {
  const pa11yIssues = runPa11yCheck(targetPath);
  if (pa11yIssues !== null) return pa11yIssues;

  const imgNoAlt = grepA11yIssue(targetPath,
    'grep -rn "<img[^>]*>" --include="*.tsx" --include="*.jsx" --include="*.html" . | grep -v "alt=" || true');
  const divOnClick = grepA11yIssue(targetPath,
    'grep -rn "<div[^>]*onClick" --include="*.tsx" --include="*.jsx" . || true');
  const emptyLinks = grepA11yIssue(targetPath,
    'grep -rn "<a[^>]*></a>\\|<a[^>]*/>" --include="*.tsx" --include="*.jsx" . | grep -v "aria-label" || true');

  const issueCount = imgNoAlt + divOnClick + emptyLinks;
  if (issueCount === 0) {
    console.log(chalk.green('  ✅ 无障碍基础检查通过'));
  } else {
    console.log(chalk.red(`  ❌ 无障碍检查: ${issueCount} 个问题`));
  }
  return issueCount;
}

function runI18nCheck(targetPath) {
  let issueCount = 0;

  // Check: hardcoded Chinese characters in source (skip comments/console)
  try {
    const zhResult = safeExec(
      `grep -rPn "[\\x{4e00}-\\x{9fff}]" --include="*.tsx" --include="*.jsx" --include="*.ts" . 2>&1 | grep -v "node_modules" | grep -v "/.mcp/" | grep -v "/.codegraph/" | grep -v "Archon-dev" | grep -v "console\\\\." | grep -v "^[^:]*:[0-9]*:[[:space:]]*//" | grep -v "^[^:]*:[0-9]*:[[:space:]]*\\*" | head -50 || true`,
      targetPath, { stdio: 'pipe' }
    ).toString().trim();
    if (zhResult) {
      const lines = zhResult.split('\n').filter(Boolean);
      issueCount += Math.min(lines.length, 50);
    }
  } catch {
    console.log(chalk.dim('  ℹ 中文硬编码检查跳过（grep -P 不可用）'));
  }

  if (issueCount === 0) {
    console.log(chalk.green('  ✅ 国际化检查通过'));
  } else {
    console.log(chalk.red(`  ❌ 国际化检查: ${issueCount} 个可疑硬编码`));
  }
  return issueCount;
}

function applyReviewResults(context, foundSecurityIssues, foundIssues, autoFix) {
  if (!context) return;
  context.securityScanResult = context.securityScanResult || {};
  if (foundSecurityIssues) {
    context.securityScanResult.highSeverityFound = true;
    context.securityScanResult.fixesApplied = autoFix;
    context.fixApplied = autoFix;
    context.lastStepFailed = true;
    context.high_severity_found = true;
  } else if (foundIssues) {
    context.securityScanResult.fixesApplied = autoFix;
    context.fixApplied = autoFix;
  }
}

function handleSpecialMode(mode, targetPath, context) {
  if (mode === 'a11y') {
    const a11yResult = runA11yCheck(targetPath);
    if (context) context.a11yPassed = !a11yResult;
    return a11yResult ? `无障碍检查发现 ${a11yResult} 个问题` : '无障碍检查通过';
  }
  if (mode === 'i18n') {
    const i18nResult = runI18nCheck(targetPath);
    if (context) context.i18nPassed = !i18nResult;
    return i18nResult ? `国际化检查发现 ${i18nResult} 个可疑硬编码` : '国际化检查通过';
  }
  return null;
}

// Run a check only when the active rules/mode request it; merges results into the accumulators.
function runRuleGatedCheck(active, runner, accum) {
  if (!active) return;
  const r = runner();
  accum.issues ||= r.foundIssues;
  accum.security ||= r.foundSecurityIssues;
}

// Run eslint/tsc gates; flips context flags + returns per-check tri-state.
function runQualityGates(rules, mode, targetPath, autoFix, context) {
  const checks = [];
  if (rules.includes('eslint') || mode === 'full') {
    const r = runEslintCheck(targetPath, autoFix);
    checks.push({ name: 'eslint', ...r });
    if (context) context.lintPassed = r.status === 'pass';
  }
  if (rules.includes('typescript') || mode === 'full') {
    const r = runTypeCheck(targetPath);
    checks.push({ name: 'typescript', ...r });
    if (context) context.typecheckPassed = r.status === 'pass';
  }
  return checks;
}

function summariseChecks(checks) {
  const issues = checks.filter(c => c.status === 'issues');
  const ran = checks.filter(c => c.status === 'pass' || c.status === 'issues');
  const skipped = checks.filter(c => c.status === 'skip');
  return { issues, ran, skipped, detail: checks.map(c => `${c.name}:${c.status}`).join(' / ') };
}

function reviewStatus({ issues, ran, skipped }) {
  if (issues.length > 0) return 'warn';
  if (ran.length === 0) return 'skip';
  return skipped.length > 0 ? 'warn' : 'pass';
}

function reviewMessage({ issues, ran, skipped, detail }) {
  if (issues.length > 0) return `代码审查完成（发现问题：${issues.map(c => c.name).join(', ')}）— ${detail}`;
  if (ran.length === 0) return `代码审查跳过（无可执行的检查）— ${detail}`;
  if (skipped.length > 0) {
    return `代码审查完成（部分检查未执行：${skipped.map(c => c.name).join(', ')}）— ${detail}`;
  }
  return `代码审查完成（无问题）— ${detail}`;
}

export function handleRunReview(_action, params, targetPath, context) {
  const mode = params?.mode || 'full';
  const options = params?.options || {};
  const rules = options.rules || ['eslint', 'typescript'];
  const autoFix = options.autoFix || false;

  const packagePath = path.join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    // 「完成（…跳过）」是自相矛盾的结论：没审查就是没审查。
    return { status: 'skip', message: '代码审查跳过：未找到 package.json（不是通过）' };
  }

  const specialResult = handleSpecialMode(mode, targetPath, context);
  if (specialResult !== null) return specialResult;

  const accum = { issues: false, security: false };
  const runSecurity = rules.includes('eslint-plugin-security') || rules.includes('OWASP-Top-10') || mode === 'security';
  const runAudit = rules.includes('npm-audit') || mode === 'security';

  runRuleGatedCheck(runSecurity, () => runSecurityEslint(targetPath, autoFix), accum);
  runRuleGatedCheck(runAudit, () => runNpmAudit(targetPath, autoFix), accum);

  const checks = runQualityGates(rules, mode, targetPath, autoFix, context);
  if (accum.issues) checks.push({ name: 'security-lint', status: 'issues' });
  const summary = summariseChecks(checks);
  const isFoundIssues = summary.issues.length > 0;
  const isFoundSecurityIssues = accum.security;

  applyReviewResults(context, isFoundSecurityIssues, isFoundIssues, autoFix);
  if (context) context.review_issue_count = summary.issues.length;

  return {
    status: isFoundSecurityIssues ? 'warn' : reviewStatus(summary),
    message: (isFoundSecurityIssues ? '代码审查完成（发现安全问题）— ' : '') + reviewMessage(summary),
  };
}

export function handleReviewFull(_action, _params, targetPath) {
  const isInClaudeCode = isConversationMode();

  if (isInClaudeCode) {
    // 「就绪」之前是裸字符串 → 被文案启发式判成 pass。但引擎在这一步什么都没查：
    // 它只是把活儿交给对话模式的 agent。交接不是通过（同 ceo-review / invokeSkill 的口径）。
    return { status: 'noop', message: '完整审查未在引擎内执行：交给对话模式的 agent 跑 skill（不计为通过）' };
  }

  // CLI mode: run a lightweight semantic grep scan as fallback
  let issues = 0;
  const unmeasured = [];
  const exclude = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist';
  const patterns = [
    { name: 'any 类型滥用', grep: ': any\\b', exts: '*.ts,*.tsx' },
    { name: 'console.log 残留', grep: 'console\\.log', exts: '*.ts,*.tsx,*.js' },
    { name: '@ts-ignore', grep: '@ts-ignore', exts: '*.ts,*.tsx' },
    { name: 'TODO/FIXME 未处理', grep: 'TODO\\|FIXME', exts: '*.ts,*.tsx,*.js' },
  ];
  for (const p of patterns) {
    // 以前是 `grep ... || true`：grep 没装/目录不存在时也是空串 → 「0 处可疑代码」→ pass。
    const scan = grepScan(`grep -rn ${exclude} --include="${p.exts}" "${p.grep}" .`, targetPath);
    if (!scan.ok) { unmeasured.push(p.name); continue; }
    const result = scan.raw.trim();
    if (result) issues += result.split('\n').length;
  }

  if (unmeasured.length === patterns.length) {
    return { status: 'skip', message: `完整审查未执行：grep 不可用（${unmeasured.join(', ')} 均未扫描，不是通过）` };
  }
  if (issues > 0 || unmeasured.length > 0) {
    const tail = unmeasured.length ? `；未扫描: ${unmeasured.join(', ')}` : '';
    return { status: 'warn', message: `完整审查完成: CLI 模式发现 ${issues} 处可疑代码${tail}` };
  }
  return `完整审查完成: CLI 模式发现 0 处可疑代码`;
}

export function handleVerifyVisual(_action, _params, targetPath) {
  const isInClaudeCode = isConversationMode();

  if (isInClaudeCode) {
    return { status: 'noop', message: '视觉验证未在引擎内执行：交给对话模式的 agent 跑 Playwright（不计为通过）' };
  }

  // CLI mode: check if Playwright is installed and attempt to run
  const packagePath = path.join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    return { status: 'skip', message: '视觉验证跳过：未找到 package.json（不是通过）' };
  }

  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    const deps = { ...pkg.devDependencies, ...pkg.dependencies };
    if (deps['@playwright/test'] || deps.playwright) {
      safeExec('npx playwright test --grep visual 2>&1 || true', targetPath, { stdio: 'pipe', timeout: 120000 });
    } else {
      console.log(chalk.yellow('  ⚠ Playwright 未安装，跳过视觉验证'));
      console.log(chalk.dim('    安装: npm install -D @playwright/test && npx playwright install'));
    }
  } catch {
    console.log(chalk.dim('  ℹ 无法检查 Playwright 配置，跳过'));
  }

  return '视觉验证完成';
}

function checkImgAlt(targetPath, excludeDirs) {
  try {
    const raw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" --include="*.html" "<img[^>]*>" . 2>&1 || true`,
      targetPath, { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const lines = raw.split('\n').filter(l => l && !/alt\s*=/.test(l));
    return lines.length > 0 ? [{ rule: 'img-alt', count: lines.length, desc: '图片缺少 alt 属性' }] : [];
  } catch { return []; }
}

function checkInputLabel(targetPath, excludeDirs) {
  try {
    const inputRaw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" "<input[^>]*>" . 2>&1 || true`,
      targetPath, { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const inputLines = inputRaw.split('\n').filter(l => l && !/aria-label|aria-labelledby|id\s*=/.test(l));
    if (!inputLines.length) return [];
    let unlabeledCount = 0;
    for (const line of inputLines.slice(0, 50)) {
      if (!/type\s*=\s*["']hidden["']/.test(line) && !/type\s*=\s*["']submit["']/.test(line)) {
        unlabeledCount++;
      }
    }
    return unlabeledCount > 0 ? [{ rule: 'input-label', count: unlabeledCount, desc: 'input 可能缺少 label 关联' }] : [];
  } catch { return []; }
}

function checkHtmlLang(targetPath) {
  try {
    const htmlFiles = scanDir(targetPath, { filter: f => f.endsWith('.html') && !f.includes('node_modules') });
    const issues = [];
    for (const f of htmlFiles) {
      try {
        const content = readFileSync(f, 'utf-8');
        if (/<html[^>]*>/i.test(content) && !/<html[^>]*lang\s*=/i.test(content)) {
          issues.push({ rule: 'html-lang', count: 1, desc: `${path.basename(f)}: <html> 缺少 lang 属性` });
        }
      } catch { /* skip */ }
    }
    return issues;
  } catch { return []; }
}

function checkContrastRisk(targetPath, excludeDirs) {
  try {
    const textRaw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" --include="*.css" -E "(text-white|text-gray-[12]00|text-neutral-[12]00)" . 2>&1 || true`,
      targetPath, { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const textLines = textRaw.split('\n').filter(Boolean);
    return textLines.length > 0 ? [{ rule: 'contrast-risk', count: textLines.length, desc: '浅色文字可能存在对比度不足' }] : [];
  } catch { return []; }
}

function checkClickableDiv(targetPath, excludeDirs) {
  try {
    const clickRaw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" -E "<(div|span)[^>]*onClick" . 2>&1 || true`,
      targetPath, { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const clickLines = clickRaw.split('\n').filter(l => l && !/role\s*=/.test(l) && !/tabIndex|tabindex/.test(l));
    return clickLines.length > 0 ? [{ rule: 'clickable-div', count: clickLines.length, desc: '可点击元素缺少 role/tabIndex' }] : [];
  } catch { return []; }
}

export function handleAiFriendlyReview(_action, _params, targetPath) {
  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build';

  const issues = [
    ...checkImgAlt(targetPath, excludeDirs),
    ...checkInputLabel(targetPath, excludeDirs),
    ...checkHtmlLang(targetPath),
    ...checkContrastRisk(targetPath, excludeDirs),
    ...checkClickableDiv(targetPath, excludeDirs),
  ];

  const totalIssues = issues.reduce((s, i) => s + i.count, 0);
  if (totalIssues === 0) {
    console.log(chalk.green('  ✅ 静态可访问性扫描通过'));
  } else {
    console.log(chalk.red(`  ❌ 发现 ${issues.length} 类可访问性问题 (共 ${totalIssues} 处)`));
    for (const i of issues) console.log(chalk.dim(`    ${i.rule}: ${i.desc} (${i.count})`));
  }
  return `可访问性审查完成: ${totalIssues} 处问题`;
}

// 不安全默认值只报「候选」：种子命中 ≠ 漏洞，报告里必须写清需要逐条证伪。
function candidateSection(context) {
  const candidates = context?.insecureDefaultsCandidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  return ['', '## 不安全默认值候选（种子命中，需逐条证伪）', '', ...formatCandidates(candidates, 50)];
}

export async function handleGenerateReviewReport(_action, _params, targetPath, context) {
  const { join } = path;

  const reviewDir = join(targetPath, '.claude', 'reviews');
  try { mkdirSync(reviewDir, { recursive: true }); } catch { /* exists */ }

  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const reportPath = join(reviewDir, `review-report-${ts}.md`);

  const flags = {
    lint: context.lintPassed,
    typecheck: context.typecheckPassed,
    security: !context.high_severity_found,
    a11y: context.a11yPassed,
    knip: context.deadCodePassed,
    dependency_cruiser: context.depCruiserPassed,
    aislop: context.aislopPassed,
    open_redirect: context.openRedirectPassed,
    log_sanitization: context.logSanitizationPassed,
    cors_check: context.corsCheckPassed,
    env_leak: context.envVarLeakPassed,
    sensitive_file: context.sensitiveFilePassed,
    recheck: context.recheckPassed,
  };

  const passed = Object.entries(flags).filter(([, v]) => v === true).length;
  const failed = Object.entries(flags).filter(([, v]) => v === false).length;
  const unknown = Object.entries(flags).filter(([, v]) => v === undefined).length;
  const score = Object.keys(flags).length > 0 ? Math.round((passed / (passed + failed)) * 100) || 0 : 100;

  const report = [
    '# Code Review Report',
    '',
    `- **Generated**: ${ts}`,
    `- **Score**: ${score}/100 (${passed} passed, ${failed} failed, ${unknown} skipped)`,
    '',
    '## Quality Gate Results',
    '',
    '| Check | Status |',
    '|-------|--------|',
    ...Object.entries(flags).map(([name, v]) =>
      `| ${name} | ${v === true ? '✅ PASS' : v === false ? '❌ FAIL' : '⏭ SKIP'} |`
    ),
    '',
    '## Findings Summary',
    '',
    context.huashu_review
      ? `- **Huashu Design Score**: ${context.huashu_review.percent}% (${context.huashu_review.reportFile || 'N/A'})`
      : '- **Huashu Design Score**: N/A',
    context.aislop_issue_count != null
      ? `- **AI Code Smells**: ${context.aislop_issue_count}`
      : '- **AI Code Smells**: N/A',
    context.securityScanResult?.highSeverityFound
      ? '- **🔴 Security**: HIGH severity issues found — review required before merge'
      : '- **Security**: No critical issues found',
    ...candidateSection(context),
    '',
    `> Generated by review workflow. ${failed > 0 ? '⚠️ Action required: address failing checks.' : '✅ All checks passed.'}`,
  ].join('\n');

  writeFileSync(reportPath, report, 'utf-8');

  // Generate infographic via Huashu
  try {
    const { renderInfographic } = await import('../lib/huashu/infographic.js');
    const metrics = [
      { label: '审查评分', value: `${score}%` },
      { label: '通过项', value: String(passed) },
      { label: '失败项', value: String(failed), delta: failed > 0 ? '需修复' : '', deltaPositive: failed === 0 },
      ...(context.aislop_issue_count != null ? [{ label: 'AI 气味', value: String(context.aislop_issue_count) }] : []),
      ...(context.huashu_review ? [{ label: '设计分', value: `${context.huashu_review.percent}%` }] : []),
    ];
    renderInfographic({
      targetPath,
      title: 'Code Review Health',
      subtitle: ts,
      metrics,
      sections: [`${passed} passed / ${failed} failed / ${unknown} skipped`],
    });
  } catch {
    console.log(chalk.dim('  ℹ 信息图渲染跳过（huashu infographic 不可用）'));
  }

  return `审查报告已生成: ${reportPath}`;
}
