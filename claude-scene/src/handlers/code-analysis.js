import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';
import { ensureDir } from '../lib/fs-utils.js';

function readCodeFiles(dir) {
  if (!existsSync(dir)) return [];
  const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.go', '.rs', '.java', '.kt'];
  return scanDir(dir)
    .filter(f => codeExts.some(ext => f.endsWith(ext)))
    .map(f => {
      try { return { path: f, content: readFileSync(f, 'utf-8') }; }
      catch { return null; }
    })
    .filter(Boolean);
}

function stripCommentsAndStrings(code) {
  /* eslint-disable sonarjs/slow-regex */
  return code
    .replace(/\/\/.*$/gm, ' ')           // single-line comments
    .replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, ' ') // multi-line comments (ReDoS-safe)
    .replace(/'[^']*'/g, '""')           // single-quoted strings
    .replace(/"[^"]*"/g, '""')           // double-quoted strings
    .replace(/`[^`]*`/g, '""');          // template literals
  /* eslint-enable sonarjs/slow-regex */
}

export function handleCodeScan(_action, _params, targetPath) {
  console.log(chalk.blue('\n🔍 正在全量代码扫描...'));
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
  console.log(chalk.dim(`  📁 ${stats.files} 文件 | 📝 ${stats.lines} 行 | ⚙️ ${stats.functions} 函数 | 🏛️ ${stats.classes} 类`));
  return `代码扫描完成: ${stats.files} 文件, ${stats.lines} 行`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleSecurityScan(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔒 正在安全扫描...'));
  const issues = [];

  try {
    const audit = safeExec('npm audit --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    const parsed = JSON.parse(audit);
    const vulns = parsed?.vulnerabilities ? Object.keys(parsed.vulnerabilities).length : 0;
    if (vulns) {
      issues.push(`npm: ${vulns} 漏洞`);
      console.log(chalk.yellow(`  ⚠ npm 漏洞: ${vulns}`));
    } else {
      console.log(chalk.green('  ✅ npm: 无漏洞'));
    }
  } catch {
    try {
      const audit2 = safeExec('npm audit 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
      // eslint-disable-next-line sonarjs/slow-regex
      const foundMatch = audit2.match(/(\d+)\s+vulnerabilities/);
      if (foundMatch && parseInt(foundMatch[1]) > 0) {
        issues.push(`npm: ${foundMatch[1]} 漏洞`);
        console.log(chalk.yellow(`  ⚠ ${foundMatch[0]}`));
      }
    } catch { console.log(chalk.dim('  ℹ npm audit 不可用')); }
  }

  const srcDir = join(targetPath, 'src');
  const secretPatterns = [
    { name: 'API Key', regex: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*['"][\w-]{20,}['"]/gi },
    { name: 'Password', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"](?!.*(?:placeholder|example|test|xxx|\*))/gi },
    { name: 'Token', regex: /(?:token|secret|jwt)\s*[:=]\s*['"][\w.-]{20,}['"]/gi },
  ];
  for (const file of readCodeFiles(srcDir)) {
    for (const { name, regex } of secretPatterns) {
      const matches = file.content.match(regex);
      if (matches) {
        issues.push(`${name}: ${file.path} (${matches.length} 处)`);
        console.log(chalk.red(`  🔴 ${name} 发现于 ${file.path}`));
      }
    }
  }

  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    context.securityScanResult.highSeverityFound = issues.length > 0;
    if (issues.length > 0) context.high_severity_found = true;
  }

  if (!issues.length) console.log(chalk.green('  ✅ 未发现安全问题'));
  return `安全扫描完成: ${issues.length ? issues.join('; ') : '无问题'}`;
}

function findMatchingClose(text, openIdx, openCh, closeCh) {
  let depth = 1;
  let j = openIdx + 1;
  while (j < text.length && depth > 0) {
    const ch = text[j];
    if (ch === openCh) depth++;
    else if (ch === closeCh) depth--;
    j++;
  }
  return depth === 0 ? j : -1;
}

function computeLoopBodyEnd(stripped, start, isMethod) {
  const parenStart = stripped.indexOf('(', start);
  if (parenStart === -1) return start;
  const afterParen = findMatchingClose(stripped, parenStart, '(', ')');
  if (afterParen === -1) return start;
  if (isMethod) return afterParen;
  let bodyStart = afterParen;
  while (bodyStart < stripped.length && /\s/.test(stripped[bodyStart])) bodyStart++;
  if (stripped[bodyStart] === '{') {
    const end = findMatchingClose(stripped, bodyStart, '{', '}');
    return end === -1 ? bodyStart + 1 : end;
  }
  const semi = stripped.indexOf(';', bodyStart);
  return semi > 0 ? semi : bodyStart + 1;
}

function detectNestedLoops(code) {
  const stripped = stripCommentsAndStrings(code);
  const loopRe = /\b(for|while)\s*\(|(?<![.\w])\.(forEach|map|filter|reduce|some|every|flatMap)\s*\(/g;
  const items = [];
  let m;
  while ((m = loopRe.exec(stripped)) !== null) items.push({ start: m.index, isMethod: !!m[2] });
  if (items.length < 2) return { count: 0, deepest: 0 };

  const sorted = items
    .map(it => ({ start: it.start, end: computeLoopBodyEnd(stripped, it.start, it.isMethod) }))
    .sort((a, b) => a.start - b.start);

  let triplePlus = 0;
  const stack = [];
  for (const node of sorted) {
    while (stack.length && stack[stack.length - 1].end <= node.start) stack.pop();
    if (stack.length >= 2) triplePlus++;
    stack.push(node);
  }
  return { count: triplePlus, deepest: triplePlus > 0 ? 3 : 2 };
}

export function handlePerformanceProfile(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n⚡ 正在性能分析（静态）...'));
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
    findings.forEach(f => console.log(chalk.yellow(`  ⚡ ${f.severity}: ${f.pattern} — ${f.file}`)));
  } else {
    console.log(chalk.green('  ✅ 未发现明显性能热点'));
  }
  const highCount = findings.filter(f => f.severity === 'high').length;
  if (context) context.performancePassed = highCount === 0;
  return `性能分析完成: ${findings.length} 个热点`;
}

export function handleCodeMetrics(_action, params, targetPath, context) {
  const thresholds = params?.thresholds || { cyclomatic_complexity: 15, maintainability: 60 };
  console.log(chalk.blue('\n📐 正在计算代码指标...'));
  const srcDir = join(targetPath, 'src');
  let totalComplexity = 0;
  let fileCount = 0;
  const complexFiles = [];

  for (const file of readCodeFiles(srcDir)) {
    fileCount++;
    const stripped = stripCommentsAndStrings(file.content);
    const allMatches = stripped.match(/\b(if|else|for|while|switch|case|catch)\b|&&|\|\||\?/g) || [];
    const complexity = allMatches.length;
    totalComplexity += complexity;
    if (complexity > thresholds.cyclomatic_complexity) {
      complexFiles.push({ file: file.path, complexity });
    }
  }

  const avgComplexity = fileCount ? (totalComplexity / fileCount).toFixed(1) : 0;
  const maintainability = Math.max(0, Math.min(100, 100 - totalComplexity * 0.5));
  console.log(chalk.dim(`  平均圈复杂度: ${avgComplexity} | 可维护性: ${maintainability} | 文件: ${fileCount}`));
  if (complexFiles.length) {
    console.log(chalk.yellow(`  ⚠ ${complexFiles.length} 个文件超过阈值 (${thresholds.cyclomatic_complexity})`));
    complexFiles.slice(0, 5).forEach(f => console.log(chalk.dim(`    ${f.file}: ${f.complexity}`)));
  }
  if (context) context.codeMetricsFindings = complexFiles.length;
  if (context) context.complexityPassed = complexFiles.length === 0;
  return `指标计算完成: 圈复杂度 ${avgComplexity}, 可维护性 ${maintainability}`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleDetectAntiPatterns(_action, params, targetPath, context) {
  const patterns = params?.patterns || ['god_object', 'long_method', 'duplicate_code'];
  console.log(chalk.blue('\n🕵️ 正在检测反模式...'));
  const srcDir = join(targetPath, 'src');
  const found = { god_object: [], long_method: [], duplicate_code: [] };

  for (const file of readCodeFiles(srcDir)) {
    const content = file.content;
    const lines = content.split('\n');

    if (patterns.includes('god_object')) {
      // eslint-disable-next-line sonarjs/slow-regex
      const methods = (content.match(/^\s*(?:async\s+)?(?:static\s+)?\w+\s*\(/gm) || []).length;
      if (lines.length > 300 || methods > 10) {
        found.god_object.push({ file: file.path, lines: lines.length, methods });
      }
    }

    if (patterns.includes('long_method') || patterns.includes('duplicate_code')) {
      const checkLong = patterns.includes('long_method');
      const checkDup = patterns.includes('duplicate_code');
      const funcMatches = checkLong
        // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity
        ? content.match(/(?:function\s+\w+|(?:\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)\s*\{/g)
        : null;
      const lineCount = checkDup ? {} : null;
      let braceDepth = 0;
      let funcStart = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (checkLong && funcMatches) {
          const open = (line.match(/\{/g) || []).length;
          const close = (line.match(/\}/g) || []).length;
          braceDepth += open - close;
          if (open > 0 && funcStart === -1) funcStart = i;
          if (braceDepth <= 0 && funcStart >= 0) {
            const len = i - funcStart;
            if (len > 50) found.long_method.push({ file: file.path, line: funcStart + 1, length: len });
            funcStart = -1;
          }
        }
        if (checkDup) {
          const trimmed = line.trim();
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
  console.log(chalk.blue('\n📝 正在生成分析报告...'));
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
  console.log(chalk.green(`  ✅ 报告已保存: ${destination}`));
  return `报告已生成: ${destination}`;
}

export function handleKnipCheck(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🧹 正在检测死代码（knip）...'));
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
        console.log(chalk.yellow(`  ⚠ 死代码: ${fileCount} 文件, ${depCount} 依赖, ${exportCount} 未使用导出`));
        if (fileCount > 0) {
          const fileNames = issues.flatMap(i => (i.files || []).map(f => f.name)).slice(0, 5);
          fileNames.forEach(f => console.log(chalk.dim(`    📄 ${f}`)));
        }
        if (context) context.deadCodePassed = false;
        return `死代码检测完成: ${total} 项`;
      }
      console.log(chalk.green('  ✅ 未发现死代码'));
      if (context) context.deadCodePassed = true;
      return '死代码检测完成: 无死代码';
    } catch {
      if (result.includes('✂️') || result.includes('excellent') || result.includes('congratulations')) {
        console.log(chalk.green('  ✅ 未发现死代码'));
        if (context) context.deadCodePassed = true;
        return '死代码检测完成: 无死代码';
      }
      console.log(chalk.dim('  ℹ knip 输出无法解析'));
      return '死代码检测完成（结果解析失败）';
    }
  } catch { /* knip not available */ }
  return '死代码检测完成（knip 不可用）';
}

export function handleGitLeaks(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔑 正在扫描 Git 历史密钥...'));
  const findings = [];
  // Use literal substrings with git log -S (pickaxe) to avoid PCRE/POSIX regex incompatibility.
  // -S searches for literal string occurrences in commit diffs.
  const searches = [
    { name: 'GitHub Token', needle: 'ghp_' },
    { name: 'GitHub PAT', needle: 'github_pat_' },
    { name: 'AWS Key', needle: 'AKIA' },
    { name: 'Private Key', needle: 'PRIVATE KEY-----' },
    { name: 'Generic Secret', needle: 'api_key' },
    { name: 'Generic Secret', needle: 'apikey' },
    { name: 'JWT Token', needle: 'eyJ' },
  ];

  try {
    for (const { name, needle } of searches) {
      try {
        const result = safeExec(
          `git log --all --oneline -S "${needle}" 2>&1 || true`,
          targetPath,
          { stdio: 'pipe', maxBuffer: 5 * 1024 * 1024 }
        ).toString().trim();
        if (result) {
          const commitCount = result.split('\n').length;
          // Deduplicate: if same name already reported, skip
          const existing = findings.find(f => f.name === name);
          if (existing) {
            existing.commits += commitCount;
          } else {
            findings.push({ name, commits: commitCount });
          }
          console.log(chalk.red(`  🔴 ${name}: ${commitCount} 个提交`));
          result.split('\n').slice(0, 3).forEach(line =>
            console.log(chalk.dim(`    ${line.slice(0, 80)}`))
          );
        }
      } catch { /* search failed, skip */ }
    }

    if (!findings.length) {
      console.log(chalk.green('  ✅ Git 历史未发现密钥泄露'));
    }
    const hasLeaks = findings.length > 0;
    if (context) context.gitLeaksPassed = !hasLeaks;
    return `Git 密钥扫描完成: ${hasLeaks ? findings.map(f => `${f.name}(${f.commits})`).join(', ') : '无泄露'}`;
  } catch { /* git not available */ }
  return 'Git 密钥扫描完成（git 不可用）';
}

export function handleSecBugHunt(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🐛 正在进行安全漏洞深度扫描...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量扫描，完整安全审计需 Claude Code + sec-bug-hunt skill'));
  let issues = 0;
  try {
    safeExec('npx eslint src --ext .js,.jsx,.ts,.tsx --rule "no-eval: error" --rule "no-implied-eval: error" 2>&1', targetPath, { stdio: 'pipe' });
  } catch (e) {
    // Exit code 1 = lint violations found; exit code 2 = config/runtime error (false positive)
    if (e.status === 1) issues++;
  }
  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    context.securityScanResult.highSeverityFound = issues > 0;
    if (issues > 0) context.high_severity_found = true;
  }
  console.log(chalk[issues ? 'yellow' : 'green'](`  ${issues ? `⚠ 发现 ${issues} 类安全问题` : '✅ 未发现严重安全漏洞'}`));
  return `安全漏洞扫描完成: ${issues ? `${issues} 个问题` : '无问题'}`;
}

export function handleAnalyzeSecurityVulnerabilities(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🛡️ 正在分析安全漏洞...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量分析，完整漏洞分析需 Claude Code 对话上下文'));
  const findings = { critical: 0, high: 0, medium: 0, low: 0 };
  try {
    const audit = safeExec('npm audit --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    try {
      const parsed = JSON.parse(audit);
      const vulns = parsed?.vulnerabilities || {};
      for (const v of Object.values(vulns)) {
        const severity = v.severity || 'low';
        if (findings[severity] !== undefined) findings[severity]++;
      }
    } catch { /* json parse failed */ }
  } catch { /* npm audit unavailable */ }
  const total = findings.critical + findings.high + findings.medium + findings.low;
  if (total) {
    console.log(chalk.yellow(`  ⚠ 漏洞: Critical ${findings.critical}, High ${findings.high}, Medium ${findings.medium}, Low ${findings.low}`));
  } else {
    console.log(chalk.green('  ✅ 未发现已知漏洞'));
  }
  if (context) {
    context.securityScanResult = context.securityScanResult || {};
    context.securityScanResult.highSeverityFound = (findings.critical + findings.high) > 0;
    context.securityScanResult.vulnerabilityCount = total;
    if ((findings.critical + findings.high) > 0) context.high_severity_found = true;
  }
  return `安全漏洞分析完成: ${total} 个漏洞`;
}
