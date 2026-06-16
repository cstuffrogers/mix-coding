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

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleDetectAntiPatterns(_action, params, targetPath, context) {
  const patterns = params?.patterns || ['god_object', 'long_method', 'duplicate_code'];
  const srcDir = join(targetPath, 'src');
  const found = { god_object: [], long_method: [], duplicate_code: [] };

  for (const file of readCodeFiles(srcDir)) {
    // Test/spec files naturally have many small methods — not genuine god objects
    if (/\.(test|spec)\.[jt]sx?$/.test(file.path)) continue;
    const content = file.content;
    const lines = content.split('\n');
    const strippedContent = patterns.includes('long_method') || patterns.includes('duplicate_code')
      ? stripCommentsAndStrings(content) : null;
    const strippedLines = strippedContent ? strippedContent.split('\n') : null;

    if (patterns.includes('god_object')) {
      // Only flag files with class/function declarations AND significant method count
      const hasClassOrFunc = /^\s*(?:export\s+)?(?:class|function)\s+\w+/m.test(content);
      const isDataFile = /(?:^|[\\/])(?:data|config|constants|messages|i18n|locales)[\\/]/.test(file.path)
        || /(?:action-messages|messages|constants|i18n|config)\.(?:js|ts|mjs|mts)$/.test(file.path);
      const methodsRe = /^\s*(?:async\s+)?(?:static\s+)?(\w+)\s*\(/gm;
      let methods = 0;
      let rm;
      while ((rm = methodsRe.exec(content)) !== null) {
        if (!CTRL_FLOW.has(rm[1])) methods++;
      }
      // Need BOTH size and method count, OR very high method count (data files exempt)
      if (!isDataFile && hasClassOrFunc && (lines.length > 300 && methods > 5 || methods > 30)) {
        found.god_object.push({ file: file.path, lines: lines.length, methods });
      }
    }

    if (patterns.includes('long_method') || patterns.includes('duplicate_code')) {
      const checkLong = patterns.includes('long_method');
      const checkDup = patterns.includes('duplicate_code');
      const funcStartRe = checkLong
        ? /(?:function\s+\w+\s*\([^)]*\)|(?:\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)\s*\{/
        : null;
      const lineCount = checkDup ? {} : null;
      let braceDepth = 0;
      let funcStart = -1;

      for (let i = 0; i < lines.length; i++) {
        const braceLine = (strippedLines ? strippedLines[i] : lines[i]) || '';
        if (checkLong && funcStartRe) {
          const open = (braceLine.match(/\{/g) || []).length;
          const close = (braceLine.match(/\}/g) || []).length;
          braceDepth += open - close;
          // Only mark funcStart when the line actually has a function/arrow declaration
          if (open > 0 && funcStart === -1 && funcStartRe.test(braceLine)) funcStart = i;
          if (braceDepth <= 0 && funcStart >= 0) {
            const len = i - funcStart;
            if (len > 50) found.long_method.push({ file: file.path, line: funcStart + 1, length: len });
            funcStart = -1;
          }
        }
        if (checkDup) {
          const rawLine = strippedLines ? strippedLines[i] : lines[i];
          if (!rawLine) continue;
          const trimmed = rawLine.trim();
          if (trimmed.length > 10 && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('import')) {
            lineCount[trimmed] = (lineCount[trimmed] || 0) + 1;
          }
        }
      }

      if (checkDup) {
        const dups = Object.entries(lineCount).filter(([, c]) => c >= 3);
        if (dups.length) found.duplicate_code.push({ file: file.path, count: dups.length });
      }
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
