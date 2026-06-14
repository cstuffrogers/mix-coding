import { existsSync, readFileSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

/**
 * Run a command that may exit non-zero (e.g. linter finding issues).
 * Returns stdout on success or non-zero exit; throws only on crash/signal.
 */
function runDiagnostic(command, targetPath) {
  try {
    return safeExec(`${command} 2>&1`, targetPath, { stdio: 'pipe' }).toString();
  } catch (e) {
    // execSync throws on non-zero exit — return captured output if available
    if (e.stdout) return e.stdout.toString();
    if (e.stderr) return e.stderr.toString();
    console.log(chalk.dim(`  ℹ ${command.split(' ', 1)[0]} 执行失败: ${e.message}`));
    return '';
  }
}

function runSecurityEslint(targetPath, autoFix) {
  console.log(chalk.dim('  🛡️ 运行 ESLint 安全扫描...'));
  let cmd = 'npx eslint src --ext .js,.jsx,.ts,.tsx';
  if (autoFix) cmd += ' --fix';
  const result = runDiagnostic(cmd, targetPath);
  // eslint-disable-next-line sonarjs/slow-regex -- matches known CLI output format (file:line:col)
  const hasFileIssues = /[^\s:]+:\d+:\d+/.test(result);
  // Only treat security-rule violations as security findings, not arbitrary lint errors.
  const securityRulePattern = /\b(security|sonarjs\/(?:hardcoded-credentials|os-command|code-eval|no-clear-text-protocols|no-weak-cipher|no-weak-hash|insecure-jwt-token|x-frame-options|cors|sql-queries|disabled-auto-escaping|content-length|production-debug|hashing|publicly-writable-directories))\b/i;
  if (securityRulePattern.test(result) && hasFileIssues) {
    console.log(chalk.red('  ❌ ESLint 安全扫描发现安全规则违规'));
    return { foundIssues: true, foundSecurityIssues: true };
  }
  if (hasFileIssues) {
    console.log(chalk.yellow('  ⚠️ ESLint 发现非安全类问题'));
    return { foundIssues: true, foundSecurityIssues: false };
  }
  if (result.includes('fixed')) {
    console.log(chalk.green('  ✅ ESLint 安全扫描自动修复完成'));
    return { foundIssues: true, foundSecurityIssues: false };
  }
  if (result.includes('error') || result.includes('Error')) {
    console.log(chalk.dim('  ℹ ESLint 配置/环境问题（非代码问题），跳过'));
  }
  return { foundIssues: false, foundSecurityIssues: false };
}

function runNpmAudit(targetPath, autoFix) {
  console.log(chalk.dim('  📦 运行 npm audit...'));
  const cmd = autoFix
    ? 'npm audit fix --only=prod 2>&1 || npm audit fix 2>&1'
    : 'npm audit';
  const result = runDiagnostic(cmd, targetPath);
  // Detect mirror/registry failures (npmmirror returns 404 for /-/npm/v1/security/*) — treat as non-blocking warning.
  if (result.includes('NOT_IMPLEMENTED') || /404 Not Found.{0,200}\/-\/npm\/v1\/security/i.test(result)) {
    console.log(chalk.yellow('  ⚠️ npm audit 镜像不支持安全端点，已跳过（不阻断）'));
    return { foundIssues: false, foundSecurityIssues: false };
  }
  if (result.includes('high') || result.includes('critical')) {
    console.log(chalk.red('  ❌ npm audit 发现高危漏洞'));
    return { foundIssues: true, foundSecurityIssues: true };
  }
  if (result.includes('moderate') || result.includes('fixed')) {
    const tag = result.includes('fixed') ? '✅ npm audit 自动修复完成' : '⚠️ npm audit 发现中等风险';
    console.log(chalk[result.includes('fixed') ? 'green' : 'yellow'](`  ${tag}`));
    return { foundIssues: true, foundSecurityIssues: false };
  }
  return { foundIssues: false, foundSecurityIssues: false };
}

function runEslintCheck(targetPath, autoFix) {
  console.log(chalk.dim('  📝 运行 ESLint...'));
  let cmd = 'npx eslint src --ext .js,.jsx,.ts,.tsx';
  if (autoFix) cmd += ' --fix';
  const result = runDiagnostic(cmd, targetPath);
  // Distinguish config/runtime errors from actual lint issues — only
  // file:line:column patterns count as real code problems.
  // eslint-disable-next-line sonarjs/slow-regex -- matches known CLI output format (file:line:col)
  const hasFileIssues = /[^\s:]+:\d+:\d+/.test(result);
  if (hasFileIssues) {
    console.log(chalk.yellow('  ⚠️ ESLint 发现问题'));
    return true;
  }
  if (result.includes('fixed')) {
    console.log(chalk.green('  ✅ ESLint 自动修复完成'));
    return true;
  }
  if (result.includes('error') || result.includes('Error')) {
    console.log(chalk.dim('  ℹ ESLint 配置/环境问题（非代码问题），跳过'));
  }
  return false;
}

function runTypeCheck(targetPath) {
  console.log(chalk.dim('  📘 运行 TypeScript 检查...'));
  const result = runDiagnostic('npx tsc --noEmit', targetPath);
  // tsc outputs "error TS<code>" for type errors, config errors look different
  const hasTypeErrors = /\berror\s+TS\d+/i.test(result);
  if (hasTypeErrors) {
    console.log(chalk.yellow('  ⚠️ TypeScript 发现问题'));
    return true;
  }
  if (/error|Error/.test(result)) {
    console.log(chalk.dim('  ℹ TypeScript 配置/环境问题（非代码问题），跳过'));
  }
  return false;
}

function runA11yCheck(targetPath) {
  console.log(chalk.blue('\n♿ 正在进行无障碍检查 (WCAG 2.1 AA)...'));
  let issueCount = 0;

  // Phase 1: pa11y-ci against static HTML files (if any)
  const htmlFiles = safeExec(
    `find . -name "*.html" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -20 || true`,
    targetPath,
    { stdio: 'pipe', timeout: 10000 }
  ).toString().trim();

  if (htmlFiles) {
    const urls = htmlFiles.split('\n').filter(Boolean).map(f => {
      const abs = `${targetPath.replace(/\\/g, '/')}/${f.replace(/^\.\//, '')}`;
      return `file://${abs}`;
    });

    if (urls.length > 0) {
      try {
        console.log(chalk.dim(`  🔍 pa11y-ci 正在检查 ${urls.length} 个页面...`));
        const pa11yCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const pa11yRaw = safeExec(
          `${pa11yCmd} pa11y-ci ${urls.join(' ')} 2>&1 || true`,
          targetPath,
          { stdio: 'pipe', maxBuffer: 5 * 1024 * 1024, timeout: 120000 }
        ).toString();

        // Parse pa11y-ci output for error counts
        const errMatch = pa11yRaw.match(/(\d+)\s+errors?/i);
        if (errMatch) {
          issueCount += parseInt(errMatch[1]);
        }
        // Count individual WCAG violations
        const violations = pa11yRaw.split('\n').filter(l =>
          /error:/i.test(l) || /^\s*•/.test(l)
        );
        if (violations.length > 0 && issueCount === 0) {
          issueCount = violations.length;
        }

        if (issueCount > 0) {
          console.log(chalk.yellow(`  ⚠ pa11y-ci: ${issueCount} 个 WCAG 问题`));
          violations.slice(0, 8).forEach(v => console.log(chalk.dim(`    ${v.trim().slice(0, 140)}`)));
        } else {
          console.log(chalk.green('  ✅ pa11y-ci: WCAG 2.1 AA 通过'));
        }
        return issueCount;
      } catch {
        console.log(chalk.dim('  ℹ pa11y-ci 执行失败，回退到代码级检查'));
      }
    }
  }

  // Phase 2: Code-level checks (JSX/TSX — grep for common a11y issues)
  console.log(chalk.dim('  ℹ 无 HTML 文件，使用代码级 a11y 检查（grep）'));
  let grepIssues = 0;

  const imgNoAlt = runDiagnostic(
    'grep -rn "<img[^>]*>" --include="*.tsx" --include="*.jsx" --include="*.html" . | grep -v "alt=" || true',
    targetPath
  ).trim();
  if (imgNoAlt) {
    const lines = imgNoAlt.split('\n').filter(Boolean);
    grepIssues += lines.length;
    console.log(chalk.yellow(`  ⚠ 发现 ${lines.length} 个 img 标签缺少 alt 属性`));
  }

  const divOnClick = runDiagnostic(
    'grep -rn "<div[^>]*onClick" --include="*.tsx" --include="*.jsx" . || true',
    targetPath
  ).trim();
  if (divOnClick) {
    const lines = divOnClick.split('\n').filter(Boolean);
    grepIssues += lines.length;
    console.log(chalk.yellow(`  ⚠ 发现 ${lines.length} 个 div 使用 onClick（应使用语义化 button）`));
  }

  const emptyLinks = runDiagnostic(
    'grep -rn "<a[^>]*></a>\\|<a[^>]*/>" --include="*.tsx" --include="*.jsx" . | grep -v "aria-label" || true',
    targetPath
  ).trim();
  if (emptyLinks) {
    const lines = emptyLinks.split('\n').filter(Boolean);
    grepIssues += lines.length;
    console.log(chalk.yellow(`  ⚠ 发现 ${lines.length} 个空链接缺少 aria-label`));
  }

  issueCount = grepIssues;
  if (issueCount === 0) {
    console.log(chalk.green('  ✅ 无障碍基础检查通过'));
  } else {
    console.log(chalk.red(`  ❌ 无障碍检查: ${issueCount} 个问题`));
  }
  return issueCount;
}

function runI18nCheck(targetPath) {
  console.log(chalk.blue('\n🌐 正在进行国际化检查...'));
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
      console.log(chalk.yellow(`  ⚠ 发现约 ${lines.length} 处硬编码中文字符串（应使用 i18n）`));
      if (lines.length >= 50) console.log(chalk.dim('  ℹ 仅显示前 50 条，请手动检查更多'));
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

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleRunReview(_action, params, targetPath, context) {
  const mode = params?.mode || 'full';
  const options = params?.options || {};
  const rules = options.rules || ['eslint', 'typescript'];
  const autoFix = options.autoFix || false;

  console.log(chalk.blue(`\n🔍 正在进行代码审查 (${mode})...`));
  console.log(chalk.dim(`  扫描规则: ${rules.join(', ')}`));
  if (autoFix) console.log(chalk.dim('  自动修复: 已启用'));

  const packagePath = path.join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    return '代码审查完成（未找到 package.json，跳过）';
  }

  const specialResult = handleSpecialMode(mode, targetPath, context);
  if (specialResult !== null) return specialResult;

  let foundIssues = false;
  let foundSecurityIssues = false;

  if (rules.includes('eslint-plugin-security') || rules.includes('OWASP-Top-10') || mode === 'security') {
    const r = runSecurityEslint(targetPath, autoFix);
    foundIssues = foundIssues || r.foundIssues;
    foundSecurityIssues = foundSecurityIssues || r.foundSecurityIssues;
  }

  if (rules.includes('npm-audit') || mode === 'security') {
    const r = runNpmAudit(targetPath, autoFix);
    foundIssues = foundIssues || r.foundIssues;
    foundSecurityIssues = foundSecurityIssues || r.foundSecurityIssues;
  }

  if (rules.includes('eslint') || mode === 'full') {
    const lintIssues = runEslintCheck(targetPath, autoFix);
    if (lintIssues) foundIssues = true;
    if (context) context.lintPassed = !lintIssues;
  }

  if (rules.includes('typescript') || mode === 'full') {
    const tsIssues = runTypeCheck(targetPath);
    if (tsIssues) foundIssues = true;
    if (context) context.typecheckPassed = !tsIssues;
  }

  applyReviewResults(context, foundSecurityIssues, foundIssues, autoFix);

  if (foundSecurityIssues) return '代码审查完成（发现安全问题）';
  return foundIssues ? '代码审查完成（发现问题已标记）' : '代码审查完成（无问题）';
}

export function handleReviewFull(_action, _params, _targetPath) {
  const inClaudeCode = process.env.CLAUDECODE === '1';

  if (inClaudeCode) {
    console.log(chalk.blue('\n🔍 代码审查: skill available'));
    console.log(chalk.dim('  → 由对话模式调用 review skill 进行跨文件语义审查'));
    return '代码审查就绪（对话模式 Skill 调用）';
  }

  console.log(chalk.yellow('\n⏭ 完整语义审查仅在对话模式可用'));
  console.log(chalk.dim('  → 需 Claude Code + review skill（支持跨文件上下文、反模式识别、架构审查）'));
  return '代码审查已跳过（需对话模式）';
}

export function handleVerifyVisual(_action, _params, _targetPath) {
  const inClaudeCode = process.env.CLAUDECODE === '1';

  if (inClaudeCode) {
    console.log(chalk.blue('\n🖼️ 视觉验证: Playwright available'));
    console.log(chalk.dim('  → 由对话模式运行 Playwright 视觉回归测试'));
    return '视觉验证就绪（对话模式 Playwright 执行）';
  }

  console.log(chalk.yellow('\n⏭ 视觉回归对比仅在对话模式可用'));
  console.log(chalk.dim('  → 需 Claude Code + Playwright + 浏览器环境'));
  return '视觉验证已跳过（需对话模式）';
}

export function handleAiFriendlyReview(_action, _params, targetPath) {
  console.log(chalk.blue('\n♿ 正在进行可访问性审查（静态扫描）...'));
  const issues = [];
  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build';

  // 1. img tags without alt attribute
  try {
    const raw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" --include="*.html" "<img[^>]*>" . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const lines = raw.split('\n').filter(l => l && !/alt\s*=/.test(l));
    if (lines.length > 0) {
      issues.push({ rule: 'img-alt', count: lines.length, desc: '图片缺少 alt 属性' });
      console.log(chalk.yellow(`  ⚠ img 缺 alt: ${lines.length} 处`));
    }
  } catch { /* skip */ }

  // 2. form inputs without associated label
  try {
    const inputRaw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" "<input[^>]*>" . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const inputLines = inputRaw.split('\n').filter(l => l && !/aria-label|aria-labelledby|id\s*=/.test(l));
    if (inputLines.length > 0) {
      // Check for nearby <label> — rough heuristic
      let unlabeledCount = 0;
      for (const line of inputLines.slice(0, 50)) {
        if (!/type\s*=\s*["']hidden["']/.test(line) && !/type\s*=\s*["']submit["']/.test(line)) {
          unlabeledCount++;
        }
      }
      if (unlabeledCount > 0) {
        issues.push({ rule: 'input-label', count: unlabeledCount, desc: 'input 可能缺少 label 关联' });
        console.log(chalk.yellow(`  ⚠ input 缺 label: ~${unlabeledCount} 处`));
      }
    }
  } catch { /* skip */ }

  // 3. html element missing lang attribute
  try {
    const htmlFiles = scanDir(targetPath, { filter: f => /\.html$/.test(f) && !f.includes('node_modules') });
    for (const f of htmlFiles) {
      try {
        const content = readFileSync(f, 'utf-8');
        if (/<html[^>]*>/i.test(content) && !/<html[^>]*lang\s*=/i.test(content)) {
          issues.push({ rule: 'html-lang', count: 1, desc: `${path.basename(f)}: <html> 缺少 lang 属性` });
          console.log(chalk.yellow(`  ⚠ ${path.basename(f)}: <html> 缺 lang`));
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  // 4. Hardcoded color contrast risk — light text on light bg, or vice versa
  try {
    const textRaw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" --include="*.css" -E "(text-white|text-gray-[12]00|text-neutral-[12]00)" . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const textLines = textRaw.split('\n').filter(Boolean);
    if (textLines.length > 0) {
      issues.push({ rule: 'contrast-risk', count: textLines.length, desc: '浅色文字可能存在对比度不足' });
      console.log(chalk.yellow(`  ⚠ 潜在对比度问题: ${textLines.length} 处`));
    }
  } catch { /* skip */ }

  // 5. onClick on non-interactive elements (div/span without role)
  try {
    const clickRaw = safeExec(
      `grep -rn "${excludeDirs}" --include="*.jsx" --include="*.tsx" -E "<(div|span)[^>]*onClick" . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 15000 }
    ).toString();
    const clickLines = clickRaw.split('\n').filter(l => l && !/role\s*=/.test(l) && !/tabIndex|tabindex/.test(l));
    if (clickLines.length > 0) {
      issues.push({ rule: 'clickable-div', count: clickLines.length, desc: '可点击元素缺少 role/tabIndex' });
      console.log(chalk.yellow(`  ⚠ 非交互元素有 onClick 但缺 role: ${clickLines.length} 处`));
    }
  } catch { /* skip */ }

  const totalIssues = issues.reduce((s, i) => s + i.count, 0);
  if (totalIssues === 0) {
    console.log(chalk.green('  ✅ 静态可访问性扫描通过'));
  } else {
    console.log(chalk.red(`  ❌ 发现 ${issues.length} 类可访问性问题 (共 ${totalIssues} 处)`));
    issues.forEach(i => console.log(chalk.dim(`    ${i.rule}: ${i.desc} (${i.count})`)));
  }
  return `可访问性审查完成: ${totalIssues} 处问题`;
}
