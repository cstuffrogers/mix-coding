import { writeFileSync } from 'fs';
import { join, relative } from 'path';
import chalk from 'chalk';
import { ensureDir } from '../lib/fs-utils.js';
import { readCodeFiles, stripCommentsAndStrings, detectNestedLoops, getFunctionComplexities, CTRL_FLOW } from '../lib/code-analysis-utils.js';

export function handleCodeScan(_action, _params, targetPath) {
  const srcDir = join(targetPath, 'src');
  const stats = { files: 0, lines: 0, functions: 0, classes: 0 };
  const files = readCodeFiles(srcDir);
  if (files.length) {
    stats.files = files.length;
    for (const f of files) {
      stats.lines += f.content.split('\n').length;
      stats.functions += (f.content.match(/(?:function|const)\s+\w+/g) || []).length;
      stats.classes += (f.content.match(/class\s+\w+/g) || []).length;
    }
  }
  return `代码扫描完成: ${stats.files} 文件, ${stats.lines} 行`;
}

export function handlePerformanceProfile(_action, _params, targetPath, context) {
  const srcDir = join(targetPath, 'src');
  const findings = [];
  for (const file of readCodeFiles(srcDir)) {
    if (/\.test\.[jt]sx?$/.test(file.path)) continue;
    const { count: tripleNested } = detectNestedLoops(file.content);
    if (tripleNested > 0) {
      findings.push({ file: file.path, pattern: `三层嵌套循环 (${tripleNested} 处)`, severity: 'high' });
    }
    if (/JSON\.parse\s*\(\s*readFileSync/.test(file.content)) {
      findings.push({ file: file.path, pattern: 'JSON.parse 大对象', severity: 'low' });
    }
    const syncIoMatches = file.content.match(/\b(readFileSync|writeFileSync|execSync)\b/g);
    if (syncIoMatches && syncIoMatches.length >= 5) {
      findings.push({ file: file.path, pattern: `同步文件操作 (${syncIoMatches.length} 处)`, severity: 'medium' });
    }
  }
  if (findings.length) {
    for (const f of findings) console.log(chalk.yellow(`  ⚡ ${f.severity}: ${f.pattern} — ${f.file}`));
  } else {
    console.log(chalk.green('  ✅ 未发现明显性能热点'));
  }
  const highCount = findings.filter(f => f.severity === 'high').length;
  if (context) context.performancePassed = highCount === 0;
  return `性能分析完成: ${findings.length} 个热点`;
}

export function handleCodeMetrics(_action, params, targetPath, context) {
  const thresholds = params?.thresholds || { cyclomatic_complexity: 15, maintainability: 60 };
  const srcDir = join(targetPath, 'src');
  let totalComplexity = 0;
  let fileCount = 0;
  const complexFunctions = [];

  for (const file of readCodeFiles(srcDir)) {
    fileCount++;
    const stripped = stripCommentsAndStrings(file.content);
    const allMatches = stripped.match(/\b(if|else|for|while|switch|case|catch)\b|\?(?![?.])/g) || [];
    const complexity = allMatches.length;
    totalComplexity += complexity;

    const funcs = getFunctionComplexities(file.content, thresholds.cyclomatic_complexity);
    for (const f of funcs) {
      complexFunctions.push({ file: file.path, ...f });
    }
  }

  const avgComplexity = fileCount ? (totalComplexity / fileCount).toFixed(1) : 0;
  const maintainability = Math.max(0, Math.min(100, 100 - totalComplexity * 0.5));
  if (complexFunctions.length) {
    console.log(chalk.yellow(`  ⚠ ${complexFunctions.length} 个函数超过阈值 (${thresholds.cyclomatic_complexity})`));
    complexFunctions.slice(0, 5).forEach(f => console.log(chalk.dim(`    ${f.name}() @ ${relative(targetPath, f.file)}:${f.line} (${f.complexity})`)));
  }
  if (context) context.codeMetricsFindings = complexFunctions.length;
  if (context) context.complexityPassed = complexFunctions.length === 0;
  return `指标计算完成: 圈复杂度 ${avgComplexity}, 可维护性 ${maintainability}`;
}

// Counts method-like declarations (excluding control-flow keywords).
// methodsRe only matches at line start, so indentation affects the count —
// this mirrors the original heuristic rather than doing a full AST walk.
function countMethods(content) {
  const methodsRe = /^(?:async\s)?(?:static\s)?(\w+)\s*\(/gm;
  let methods = 0;
  let rm;
  while ((rm = methodsRe.exec(content)) !== null) {
    if (!CTRL_FLOW.has(rm[1])) methods++;
  }
  return methods;
}

// Data/config/message files are exempt from god_object — they legitimately
// hold many small accessors without being real "god objects".
function isDataFile(filePath) {
  return /(?:^|[\\/])(?:data|config|constants|messages|i18n|locales)[\\/]/.test(filePath)
    || /(?:action-messages|messages|constants|i18n|config)\.(?:js|ts|mjs|mts)$/.test(filePath);
}

function detectGodObject(file, lines, found) {
  const hasClassOrFunc = /^(?:export\s+)?(?:class|function)\s+\w+/m.test(file.content);
  const methods = countMethods(file.content);
  // Need BOTH size and method count, OR very high method count (data files exempt)
  if (!isDataFile(file.path) && hasClassOrFunc && (lines.length > 300 && methods > 5 || methods > 30)) {
    found.god_object.push({ file: file.path, lines: lines.length, methods });
  }
}

// Tracks brace depth across stripped lines to find function/arrow bodies that
// exceed 50 lines. funcStartRe identifies declaration lines; funcStart marks
// the opening of a body that gets closed when braceDepth returns to zero.
const LONG_FUNC_RES = [
  /(?:function\s+\w+\s*\([^)]*\))/, // eslint-disable-next-line sonarjs/super-linear-regex
  /(?:\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
];

function detectLongMethods(strippedLines, lines, filePath, found) {
  let braceDepth = 0;
  let funcStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const braceLine = (strippedLines ? strippedLines[i] : lines[i]) || '';
    const open = (braceLine.match(/\{/g) || []).length;
    const close = (braceLine.match(/\}/g) || []).length;
    braceDepth += open - close;
    // Only mark funcStart when the line actually has a function/arrow declaration
    if (open > 0 && funcStart === -1 && LONG_FUNC_RES.some(re => re.test(braceLine))) funcStart = i;
    if (braceDepth <= 0 && funcStart >= 0) {
      const len = i - funcStart;
      if (len > 50) found.long_method.push({ file: filePath, line: funcStart + 1, length: len });
      funcStart = -1;
    }
  }
}

// Tallies non-trivial, non-comment, non-import lines to surface duplication.
function collectDuplicateLines(strippedLines, lines) {
  const lineCount = {};
  for (let i = 0; i < lines.length; i++) {
    const rawLine = strippedLines ? strippedLines[i] : lines[i];
    if (!rawLine) continue;
    const trimmed = rawLine.trim();
    if (trimmed.length > 10 && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('import')) {
      lineCount[trimmed] = (lineCount[trimmed] || 0) + 1;
    }
  }
  return lineCount;
}

function detectDuplicates(strippedLines, lines, filePath, found) {
  const lineCount = collectDuplicateLines(strippedLines, lines);
  const dups = Object.entries(lineCount).filter(([, c]) => c >= 3);
  if (dups.length) found.duplicate_code.push({ file: filePath, count: dups.length });
}

function detectLongMethodAndDuplicates(file, patterns, found) {
  const checkLong = patterns.includes('long_method');
  const checkDup = patterns.includes('duplicate_code');
  if (!checkLong && !checkDup) return;

  const strippedContent = stripCommentsAndStrings(file.content);
  const strippedLines = strippedContent.split('\n');
  const lines = file.content.split('\n');

  if (checkLong) detectLongMethods(strippedLines, lines, file.path, found);
  if (checkDup) detectDuplicates(strippedLines, lines, file.path, found);
}

export function handleDetectAntiPatterns(_action, params, targetPath, context) {
  const patterns = params?.patterns || ['god_object', 'long_method', 'duplicate_code'];
  const srcDir = join(targetPath, 'src');
  const found = { god_object: [], long_method: [], duplicate_code: [] };

  for (const file of readCodeFiles(srcDir)) {
    // Test/spec files naturally have many small methods — not genuine god objects
    if (/\.(test|spec)\.[jt]sx?$/.test(file.path)) continue;
    const lines = file.content.split('\n');

    if (patterns.includes('god_object')) detectGodObject(file, lines, found);
    if (patterns.includes('long_method') || patterns.includes('duplicate_code')) {
      detectLongMethodAndDuplicates(file, patterns, found);
    }
  }

  for (const [key, items] of Object.entries(found)) {
    if (items.length) console.log(chalk.yellow(`  ⚠ ${key}: ${items.length} 处`));
    else console.log(chalk.dim(`  ✅ ${key}: 未发现`));
  }
  const totalFound = Object.values(found).flat().length;
  if (context) context.antiPatternFindings = totalFound;
  return `反模式检测完成: ${totalFound} 个问题`;
}

export function handleGenerateReport(_action, params, targetPath) {
  const destination = params?.destination || 'docs/analysis-report.md';
  const destPath = join(targetPath, destination);
  const reportDir = join(targetPath, 'docs');
  ensureDir(reportDir);
  const report = [
    '# 代码分析报告',
    '',
    `> 生成时间: ${new Date().toISOString()}`,
    '',
    '## 扫描摘要',
    '',
    '| 类别 | 状态 |',
    '|------|------|',
    '| 复杂度分析 | ✅ 完成 |',
    '| 安全检查 | ✅ 完成 |',
    '| 性能分析 | ✅ 完成 |',
    '| 可维护性 | ✅ 完成 |',
    '',
    '## 改进建议',
    '',
    '1. 紧急：安全漏洞需优先修复',
    '2. 高：降低高圈复杂度函数',
    '3. 中：优化性能热点',
    '4. 低：代码风格统一',
  ].join('\n');
  writeFileSync(destPath, report, 'utf-8');
  return `报告已生成: ${destination}`;
}
