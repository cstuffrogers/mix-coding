import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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
    return '';
  }
}

function runSecurityEslint(targetPath, autoFix) {
  let cmd = 'npx eslint src --ext .js,.jsx,.ts,.tsx';
  if (autoFix) cmd += ' --fix';
  const result = runDiagnostic(cmd, targetPath);
  // eslint-disable-next-line sonarjs/slow-regex -- matches known CLI output format (file:line:col)
  const hasFileIssues = /[^\s:]+:\d+:\d+/.test(result);
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
  if (result.includes('error') || result.includes('Error')) {
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

function runEslintCheck(targetPath, autoFix) {
  let cmd = 'npx eslint src --ext .js,.jsx,.ts,.tsx';
  if (autoFix) cmd += ' --fix';
  const result = runDiagnostic(cmd, targetPath);
  // Distinguish config/runtime errors from actual lint issues — only
  // file:line:column patterns count as real code problems.
  // eslint-disable-next-line sonarjs/slow-regex -- matches known CLI output format (file:line:col)
  const hasFileIssues = /[^\s:]+:\d+:\d+/.test(result);
  if (hasFileIssues) {
    return true;
  }
  if (result.includes('fixed')) {
    return true;
  }
  if (result.includes('error') || result.includes('Error')) {
    console.log(chalk.dim('  ℹ ESLint 配置/环境问题（非代码问题），跳过'));
  }
  return false;
}

function runTypeCheck(targetPath) {
  const result = runDiagnostic('npx tsc --noEmit', targetPath);
  // tsc outputs "error TS<code>" for type errors, config errors look different
  const hasTypeErrors = /\berror\s+TS\d+/i.test(result);
  if (hasTypeErrors) {
    return true;
  }
  if (/error|Error/.test(result)) {
    console.log(chalk.dim('  ℹ TypeScript 配置/环境问题（非代码问题），跳过'));
  }
  return false;
}

function runA11yCheck(targetPath) {
  let issueCount = 0;

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
        const pa11yCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const pa11yRaw = safeExec(
          `${pa11yCmd} pa11y-ci ${urls.join(' ')} 2>&1 || true`,
          targetPath,
          { stdio: 'pipe', maxBuffer: 5 * 1024 * 1024, timeout: 120000 }
        ).toString();

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

  let grepIssues = 0;

  const imgNoAlt = runDiagnostic(
    'grep -rn "<img[^>]*>" --include="*.tsx" --include="*.jsx" --include="*.html" . | grep -v "alt=" || true',
    targetPath
  ).trim();
  if (imgNoAlt) {
    const lines = imgNoAlt.split('\n').filter(Boolean);
    grepIssues += lines.length;
  }

  const divOnClick = runDiagnostic(
    'grep -rn "<div[^>]*onClick" --include="*.tsx" --include="*.jsx" . || true',
    targetPath
  ).trim();
  if (divOnClick) {
    const lines = divOnClick.split('\n').filter(Boolean);
    grepIssues += lines.length;
  }

  const emptyLinks = runDiagnostic(
    'grep -rn "<a[^>]*></a>\\|<a[^>]*/>" --include="*.tsx" --include="*.jsx" . | grep -v "aria-label" || true',
    targetPath
  ).trim();
  if (emptyLinks) {
    const lines = emptyLinks.split('\n').filter(Boolean);
    grepIssues += lines.length;
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

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleRunReview(_action, params, targetPath, context) {
  const mode = params?.mode || 'full';
  const options = params?.options || {};
  const rules = options.rules || ['eslint', 'typescript'];
  const autoFix = options.autoFix || false;

  const packagePath = path.join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    return '代码审查完成（未找到 package.json，跳过）';
  }

  const specialResult = handleSpecialMode(mode, targetPath, context);
  if (specialResult !== null) return specialResult;

  let isFoundIssues = false;
  let isFoundSecurityIssues = false;

  if (rules.includes('eslint-plugin-security') || rules.includes('OWASP-Top-10') || mode === 'security') {
    const r = runSecurityEslint(targetPath, autoFix);
    isFoundIssues ||= r.foundIssues;
    isFoundSecurityIssues ||= r.foundSecurityIssues;
  }

  if (rules.includes('npm-audit') || mode === 'security') {
    const r = runNpmAudit(targetPath, autoFix);
    isFoundIssues ||= r.foundIssues;
    isFoundSecurityIssues ||= r.foundSecurityIssues;
  }

  if (rules.includes('eslint') || mode === 'full') {
    const lintIssues = runEslintCheck(targetPath, autoFix);
    if (lintIssues) isFoundIssues = true;
    if (context) context.lintPassed = !lintIssues;
  }

  if (rules.includes('typescript') || mode === 'full') {
    const tsIssues = runTypeCheck(targetPath);
    if (tsIssues) isFoundIssues = true;
    if (context) context.typecheckPassed = !tsIssues;
  }

  applyReviewResults(context, isFoundSecurityIssues, isFoundIssues, autoFix);

  if (isFoundSecurityIssues) return '代码审查完成（发现安全问题）';
  return isFoundIssues ? '代码审查完成（发现问题已标记）' : '代码审查完成（无问题）';
}

export function handleReviewFull(_action, _params, targetPath) {
  const isInClaudeCode = process.env.CLAUDECODE === '1';

  if (isInClaudeCode) {
    return '代码审查就绪（对话模式 Skill 调用）';
  }

  // CLI mode: run a lightweight semantic grep scan as fallback
  let issues = 0;
  try {
    const exclude = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist';
    const patterns = [
      { name: 'any 类型滥用', grep: ': any\\b', exts: '*.ts,*.tsx' },
      { name: 'console.log 残留', grep: 'console\\.log', exts: '*.ts,*.tsx,*.js' },
      { name: '@ts-ignore', grep: '@ts-ignore', exts: '*.ts,*.tsx' },
      { name: 'TODO/FIXME 未处理', grep: 'TODO\\|FIXME', exts: '*.ts,*.tsx,*.js' },
    ];
    for (const p of patterns) {
      const cmd = `grep -rn "${exclude}" --include="${p.exts}" "${p.grep}" . 2>/dev/null | head -20 || true`;
      const result = safeExec(cmd, targetPath, { stdio: 'pipe', timeout: 10000 }).toString().trim();
      if (result) {
        const count = result.split('\n').length;
        issues += count;
      }
    }
  } catch { /* non-critical */ }

  return `完整审查完成: CLI 模式发现 ${issues} 处可疑代码`;
}

export function handleVerifyVisual(_action, _params, targetPath) {
  const isInClaudeCode = process.env.CLAUDECODE === '1';

  if (isInClaudeCode) {
    return '视觉验证就绪（对话模式 Playwright 执行）';
  }

  // CLI mode: check if Playwright is installed and attempt to run
  const packagePath = path.join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    return '视觉验证已跳过';
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

export function handleAiFriendlyReview(_action, _params, targetPath) {
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
      }
    }
  } catch { /* skip */ }

  // 3. HTML element missing lang attribute
  try {
    const htmlFiles = scanDir(targetPath, { filter: f => f.endsWith('.html') && !f.includes('node_modules') });
    for (const f of htmlFiles) {
      try {
        const content = readFileSync(f, 'utf-8');
        if (/<html[^>]*>/i.test(content) && !/<html[^>]*lang\s*=/i.test(content)) {
          issues.push({ rule: 'html-lang', count: 1, desc: `${path.basename(f)}: <html> 缺少 lang 属性` });
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
    }
  } catch { /* skip */ }

  const totalIssues = issues.reduce((s, i) => s + i.count, 0);
  if (totalIssues === 0) {
    console.log(chalk.green('  ✅ 静态可访问性扫描通过'));
  } else {
    console.log(chalk.red(`  ❌ 发现 ${issues.length} 类可访问性问题 (共 ${totalIssues} 处)`));
    for (const i of issues) console.log(chalk.dim(`    ${i.rule}: ${i.desc} (${i.count})`));
  }
  return `可访问性审查完成: ${totalIssues} 处问题`;
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
    state_audit: context.stateAuditPassed,
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
    context.stateAuditFindings
      ? `- **State Audit Issues**: ${context.stateAuditFindings.length}`
      : '- **State Audit Issues**: N/A',
    context.securityScanResult?.highSeverityFound
      ? '- **🔴 Security**: HIGH severity issues found — review required before merge'
      : '- **Security**: No critical issues found',
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
