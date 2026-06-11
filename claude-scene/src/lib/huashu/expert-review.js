/**
 * Huashu 5-dimension expert review for UI/design artifacts.
 * Adapted from huashu-design references/critique-guide.md.
 * Scores: philosophy / hierarchy / craft / functionality / originality (0-10 each).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { scanDir } from '../scan-dir.js';

const DIMENSIONS = [
  { key: 'philosophy', name: '哲学一致性', focus: '设计是否纯粹体现选定哲学, 有无自相矛盾元素' },
  { key: 'hierarchy', name: '视觉层级', focus: '主次清晰度, 字号对比≥2.5倍, 眯眼测试' },
  { key: 'craft', name: '细节执行', focus: '对齐/间距/颜色精确度, 8pt网格, 颜色≤3-4种' },
  { key: 'functionality', name: '功能性', focus: '每元素服务目标, CTA显眼, 装饰最小化' },
  { key: 'originality', name: '创新性', focus: '在哲学框架内的独特表达, 避免 cliché' },
];

function scoreFromHeuristics(filePath) {
  if (!existsSync(filePath)) return null;
  let content;
  try { content = readFileSync(filePath, 'utf8'); } catch { return null; }
  if (!content) return null;

  const hardcodedColors = (content.match(/#[0-9a-fA-F]{3,6}\b/g) || []).length;
  const cssVars = (content.match(/--[\w-]{1,80}:/g) || []).length;
  const inlineStyles = (content.match(/style[ \t]{0,4}=[ \t]{0,4}["'{]/g) || []).length;
  const fontFamilies = new Set([...content.matchAll(/font-family[ \t]{0,4}:[ \t]{0,4}([^;}\n]{1,200})/g)].map(m => m[1].trim())).size;
  const importantCount = (content.match(/!important/g) || []).length;

  const philosophy = Math.max(3, 10 - Math.min(7, Math.floor(fontFamilies / 2)));
  const hierarchy = Math.max(4, 9 - Math.min(5, Math.floor(inlineStyles / 10)));
  const craft = Math.max(2, 10 - Math.min(8, Math.floor(hardcodedColors / 8) + Math.floor(importantCount / 3)));
  const functionality = cssVars > 0 ? 8 : 6;
  const originality = fontFamilies > 1 && fontFamilies <= 3 ? 7 : 5;

  return { philosophy, hierarchy, craft, functionality, originality };
}

function aggregateScores(scoresList) {
  if (scoresList.length === 0) return null;
  const sum = { philosophy: 0, hierarchy: 0, craft: 0, functionality: 0, originality: 0 };
  for (const s of scoresList) {
    for (const k of Object.keys(sum)) sum[k] += s[k] || 0;
  }
  for (const k of Object.keys(sum)) sum[k] = Math.round(sum[k] / scoresList.length);
  return sum;
}

export function review({ targetPath, context = {} } = {}) {
  console.log(chalk.blue('\n🎯 huashu expert-review: 5 维度设计评审'));

  const cssFiles = scanDir(targetPath, { filter: f => /\.(css|scss|sass|less)$/.test(f) });
  const htmlFiles = scanDir(targetPath, { filter: f => /\.html?$/.test(f) });
  const componentFiles = scanDir(targetPath, { filter: f => /\.(jsx|tsx|vue|svelte)$/.test(f) });
  const candidates = [...cssFiles, ...htmlFiles, ...componentFiles].slice(0, 50);

  if (candidates.length === 0) {
    console.log(chalk.yellow('  ⚠ 未检测到 UI 文件，跳过评审'));
    return { skipped: true };
  }

  const allScores = candidates.map(f => scoreFromHeuristics(f)).filter(Boolean);
  const aggregate = aggregateScores(allScores);
  if (!aggregate) {
    console.log(chalk.yellow('  ⚠ 无法读取 UI 文件'));
    return { skipped: true };
  }

  const total = Object.values(aggregate).reduce((a, b) => a + b, 0);
  const max = DIMENSIONS.length * 10;
  const percent = Math.round((total / max) * 100);

  console.log(chalk.bold('\n  评分:'));
  for (const d of DIMENSIONS) {
    const score = aggregate[d.key];
    const color = score >= 8 ? 'green' : score >= 6 ? 'yellow' : 'red';
    console.log(chalk[color](`    ${d.name.padEnd(12)} ${score}/10`));
  }
  console.log(chalk.bold(`\n  总分: ${total}/${max} (${percent}%)\n`));

  const keepFixSuggestions = generateSuggestions(aggregate);
  const reportFile = writeReport(targetPath, { aggregate, total, percent, suggestions: keepFixSuggestions, fileCount: candidates.length });

  if (context) {
    context.huashu_review = { aggregate, total, percent, report: reportFile };
  }

  return { aggregate, total, percent, suggestions: keepFixSuggestions, reportFile };
}

function generateSuggestions(scores) {
  const keep = [];
  const fix = [];
  const quickWins = [];

  for (const d of DIMENSIONS) {
    const score = scores[d.key];
    if (score >= 8) keep.push(`${d.name}: ${score}/10 — 保持`);
    else if (score >= 6) quickWins.push(`${d.name}: ${score}/10 — 微调即可上 8 分（${d.focus}）`);
    else fix.push(`${d.name}: ${score}/10 — 需重点修复（${d.focus}）`);
  }

  return { keep, fix, quickWins };
}

function writeReport(targetPath, { aggregate, total, percent, suggestions, fileCount }) {
  const dir = join(targetPath, '.claude', 'reviews');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `huashu-expert-review-${Date.now()}.md`);
  const lines = [
    '# huashu 5 维度专家评审',
    '',
    `> 生成时间: ${new Date().toISOString()}`,
    `> 评审文件数: ${fileCount}`,
    '',
    '## 评分',
    '',
    '| 维度 | 分数 | 关注点 |',
    '|------|------|--------|',
    ...DIMENSIONS.map(d => `| ${d.name} | ${aggregate[d.key]}/10 | ${d.focus} |`),
    `| **总分** | **${total}/${DIMENSIONS.length * 10} (${percent}%)** | — |`,
    '',
    '## Keep（保持）',
    '',
    ...(suggestions.keep.length ? suggestions.keep.map(s => `- ${s}`) : ['- (无)']),
    '',
    '## Quick Wins（微调即可上 8 分）',
    '',
    ...(suggestions.quickWins.length ? suggestions.quickWins.map(s => `- ${s}`) : ['- (无)']),
    '',
    '## Fix（重点修复）',
    '',
    ...(suggestions.fix.length ? suggestions.fix.map(s => `- ${s}`) : ['- (无)']),
    '',
  ];
  writeFileSync(file, lines.join('\n'), 'utf8');
  return file;
}
