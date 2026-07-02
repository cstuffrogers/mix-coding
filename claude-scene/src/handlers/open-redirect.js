import { join } from 'path';
import chalk from 'chalk';
import { readCodeFiles, stripCommentsAndStrings } from '../lib/code-analysis-utils.js';

function scanPatternsInFile(file, redirectPatterns) {
  const findings = [];
  const stripped = stripCommentsAndStrings(file.content);
  for (const { name, re } of redirectPatterns) {
    const matches = [];
    for (const r of re) {
      const m = stripped.match(r);
      if (m) matches.push(...m);
    }
    if (matches.length > 0) {
      findings.push({ file: file.path, pattern: name, count: matches.length });
    }
  }
  return findings;
}

export function handleOpenRedirectScan(_action, _params, targetPath, context) {
  const findings = [];

  const srcDir = join(targetPath, 'src');
  const redirectPatterns = [
    { name: 'location.href 参数拼接', re: [
      /location\.href\s*=\s*(?!['"]#['"])(?!['"]\/['"])\w+/gi,
      /location\.href\s*=\s*[`'"].*\$\{/gi,
    ]},
    { name: 'location.replace 参数注入', re: [
      /location\.replace\s*\(\s*(?!['"]\/['"])\w+/gi,
      /location\.replace\s*\(\s*[`'"].*\$\{/gi,
    ]},
    { name: 'window.open 参数拼接', re: [
      /window\.open\s*\(\s*(?!['"]\/['"])\w+/gi,
      /window\.open\s*\(\s*[`'"].*\$\{/gi,
    ]},
    { name: 'location.assign 参数注入', re: [
      /location\.assign\s*\(\s*(?!['"]\/['"])\w+/gi,
      /location\.assign\s*\(\s*[`'"].*\$\{/gi,
    ]},
    { name: 'JSX href 参数拼接', re: [/href\s*=\s*\{/gi] },
  ];

  for (const file of readCodeFiles(srcDir)) {
    if (/\.test\./.test(file.path)) continue;
    findings.push(...scanPatternsInFile(file, redirectPatterns));
  }

  if (findings.length > 0) {
    findings.slice(0, 5).forEach(f => {
      console.log(chalk.yellow(`  ⚠ ${f.file}: ${f.pattern} (${f.count} 处)`));
    });
  } else {
    console.log(chalk.green('  ✅ 未发现明显开放重定向风险'));
  }

  const totalFound = findings.length;
  if (context) {
    context.openRedirectPassed = totalFound === 0;
    if (totalFound > 0) context.high_severity_found = true;
  }
  return `开放重定向检测完成: ${totalFound} 处可疑`;
}
