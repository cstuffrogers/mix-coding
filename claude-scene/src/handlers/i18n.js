import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { readCodeFiles } from '../lib/code-analysis-utils.js';

function scanHardcodedChinese(srcDir, chineseRe) {
  let hardcodedChinese = 0;
  const findings = [];
  for (const file of readCodeFiles(srcDir)) {
    if (/\.test\./.test(file.path)) continue;
    if (/locale|i18n|lang|translat/.test(file.path)) continue;
    const matches = file.content.match(chineseRe) || [];
    if (matches.length > 0) {
      hardcodedChinese += matches.length;
      if (matches.length >= 5) {
        findings.push({ file: file.path, issue: '硬编码中文', count: matches.length });
      }
    }
  }
  return { findings, hardcodedChinese };
}

function detectI18nConfig(targetPath) {
  const configs = ['i18n.js', 'i18n.ts', 'i18next.js', 'react-i18next.js', 'next-i18next.config.js'];
  for (const cfg of configs) {
    if (existsSync(join(targetPath, cfg)) || existsSync(join(targetPath, 'src', cfg))) {
      return true;
    }
  }
  try {
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps['i18next'] || allDeps['react-i18next'] || allDeps['vue-i18n'] || allDeps['next-i18next']) {
      return true;
    }
  } catch { /* no package.json */ }
  return false;
}

function scanCssRtlIssues(content, filePath) {
  const issues = [];
  if (/text-align\s*:\s*left(?!\s*\/)/i.test(content) && !/\[dir\s*=\s*["']rtl["']\]/i.test(content)) {
    issues.push({ file: filePath, issue: 'text-align: left 未适配 RTL' });
  }
  if (/float\s*:\s*left(?!\s*\/)/i.test(content) && !/\[dir\s*=\s*["']rtl["']\]/i.test(content)) {
    issues.push({ file: filePath, issue: 'float: left 未适配 RTL' });
  }
  if (/margin-left|padding-left|border-left(?!-)/i.test(content) && !/\[dir\s*=\s*["']rtl["']\]|margin-inline|padding-inline|border-inline/i.test(content)) {
    issues.push({ file: filePath, issue: '使用 left 侧物理属性而非 logical 属性' });
  }
  return issues;
}

function scanJsxRtlIssues(content, filePath) {
  const issues = [];
  if (/(?:marginLeft|paddingLeft|borderLeft|marginRight|paddingRight|borderRight)\s*:/g.test(content)) {
    issues.push({ file: filePath, issue: 'JSX style 使用 left/right 物理属性' });
  }
  return issues;
}

function scanRtlIssues(srcDir) {
  const rtlIssues = [];
  for (const file of readCodeFiles(srcDir)) {
    if (/\.css$|\.scss$|\.less$/.test(file.path)) {
      rtlIssues.push(...scanCssRtlIssues(file.content, file.path));
    }
    if (/\.tsx$|\.jsx$/.test(file.path)) {
      rtlIssues.push(...scanJsxRtlIssues(file.content, file.path));
    }
  }
  return rtlIssues;
}

export function handleI18nAudit(_action, params, targetPath, context) {
  const mode = params?.mode || 'check';
  const srcDir = join(targetPath, 'src');
  const chineseRe = /['"`][^'"`\u4e00-\u9fff]*[\u4e00-\u9fff][^'"`]*['"`]/g;

  const { findings, hardcodedChinese } = scanHardcodedChinese(srcDir, chineseRe);

  if (hardcodedChinese > 0) {
    findings.filter(f => f.issue === '硬编码中文').slice(0, 5).forEach(f => {
      console.log(chalk.yellow(`  ⚠ ${f.file}: 硬编码中文 ${f.count} 处`));
    });
  } else {
    console.log(chalk.green('  ✅ 未发现硬编码中文字符串'));
  }

  const hasI18nConfig = detectI18nConfig(targetPath);

  if (!hasI18nConfig && hardcodedChinese > 0) {
    console.log(chalk.yellow('  ⚠ 未检测到 i18n 配置，建议接入 react-i18next / vue-i18n'));
  }

  const rtlIssues = scanRtlIssues(srcDir);

  if (rtlIssues.length > 0) {
    rtlIssues.slice(0, 5).forEach(f => {
      console.log(chalk.yellow(`  ⚠ ${f.file}: ${f.issue}`));
    });
  } else {
    console.log(chalk.green('  ✅ RTL 布局适配检查通过'));
  }

  if (mode === 'full') {
    console.log(chalk.dim('  ℹ 伪本地化溢出测试需手动运行: npx pseudo-localization'));
  }

  const totalIssues = findings.length + rtlIssues.length;
  if (context) {
    context.i18nPassed = hasI18nConfig ? totalIssues === 0 : true;
    context.i18nFindings = totalIssues;
  }
  return `i18n 检查完成: ${totalIssues} 个问题（硬编码 ${hardcodedChinese}, RTL ${rtlIssues.length}）`;
}
