import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { readCodeFiles } from '../lib/code-analysis-utils.js';

export function handleI18nAudit(_action, params, targetPath, context) {
  const mode = params?.mode || 'check';
  console.log(chalk.blue(`\n🌐 正在检查国际化 (i18n) — ${mode === 'rtl' ? 'RTL布局 + 文本溢出' : '硬编码字符串 + RTL'}...`));

  const srcDir = join(targetPath, 'src');
  const findings = [];

  // Check 1: Hardcoded Chinese strings in source
  const chineseRe = /['"`][^'"`]*[一-鿿][^'"`]*['"`]/g;
  let hardcodedChinese = 0;
  for (const file of readCodeFiles(srcDir)) {
    if (/\.test\./.test(file.path)) continue;
    // Skip i18n config/locale files
    if (/locale|i18n|lang|translat/.test(file.path)) continue;

    const matches = file.content.match(chineseRe) || [];
    if (matches.length > 0) {
      hardcodedChinese += matches.length;
      if (matches.length >= 5) {
        findings.push({ file: file.path, issue: '硬编码中文', count: matches.length });
      }
    }
  }

  if (hardcodedChinese > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${hardcodedChinese} 处硬编码中文字符串`));
    findings.filter(f => f.issue === '硬编码中文').slice(0, 5).forEach(f =>
      console.log(chalk.dim(`    ${f.file} (${f.count} 处)`))
    );
  } else {
    console.log(chalk.green('  ✅ 未发现硬编码中文字符串'));
  }

  // Check 2: Detect i18n configuration
  const i18nConfigs = ['i18n.js', 'i18n.ts', 'i18next.js', 'react-i18next.js', 'next-i18next.config.js'];
  let hasI18nConfig = false;
  for (const cfg of i18nConfigs) {
    if (existsSync(join(targetPath, cfg)) || existsSync(join(targetPath, 'src', cfg))) {
      hasI18nConfig = true;
      break;
    }
  }
  // Also check package.json for i18n deps
  try {
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps['i18next'] || allDeps['react-i18next'] || allDeps['vue-i18n'] || allDeps['next-i18next']) {
      hasI18nConfig = true;
    }
  } catch { /* no package.json */ }

  if (!hasI18nConfig && hardcodedChinese > 0) {
    console.log(chalk.yellow('  ⚠ 未检测到 i18n 配置，建议接入 react-i18next / vue-i18n'));
  }

  // Check 3: RTL layout readiness
  const rtlIssues = [];
  for (const file of readCodeFiles(srcDir)) {
    if (/\.css$|\.scss$|\.less$/.test(file.path)) {
      const content = file.content;
      // Check for LTR-only patterns that would break in RTL
      if (/text-align\s*:\s*left(?!\s*\/)/i.test(content) && !/\[dir\s*=\s*["']rtl["']\]/i.test(content)) {
        rtlIssues.push({ file: file.path, issue: 'text-align: left 未适配 RTL' });
      }
      if (/float\s*:\s*left(?!\s*\/)/i.test(content) && !/\[dir\s*=\s*["']rtl["']\]/i.test(content)) {
        rtlIssues.push({ file: file.path, issue: 'float: left 未适配 RTL' });
      }
      if (/margin-left|padding-left|border-left(?!-)/i.test(content) && !/\[dir\s*=\s*["']rtl["']\]|margin-inline|padding-inline|border-inline/i.test(content)) {
        rtlIssues.push({ file: file.path, issue: '使用 left 侧物理属性而非 logical 属性' });
      }
    }
    if (/\.tsx$|\.jsx$/.test(file.path)) {
      const content = file.content;
      // Check for style objects in JSX using left/right instead of start/end
      if (/(?:marginLeft|paddingLeft|borderLeft|marginRight|paddingRight|borderRight)\s*:/g.test(content)) {
        rtlIssues.push({ file: file.path, issue: 'JSX style 使用 left/right 物理属性' });
      }
    }
  }

  if (rtlIssues.length > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${rtlIssues.length} 处 RTL 适配问题`));
    rtlIssues.slice(0, 5).forEach(f =>
      console.log(chalk.dim(`    ${f.issue} @ ${f.file}`))
    );
  } else {
    console.log(chalk.green('  ✅ RTL 布局适配检查通过'));
  }

  // Check 4: Pseudo-localization overflow test (if mode includes it)
  if (mode === 'full') {
    console.log(chalk.dim('  ℹ 伪本地化溢出测试需手动运行: npx pseudo-localization'));
  }

  const totalIssues = findings.length + rtlIssues.length;
  if (context) {
    // For projects without i18n config, hardcoded strings in the project's
    // native language are expected — not a failure.
    context.i18nPassed = hasI18nConfig ? totalIssues === 0 : true;
    context.i18nFindings = totalIssues;
  }
  return `i18n 检查完成: ${totalIssues} 个问题（硬编码 ${hardcodedChinese}, RTL ${rtlIssues.length}）`;
}
