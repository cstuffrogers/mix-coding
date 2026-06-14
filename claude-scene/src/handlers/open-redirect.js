import { join } from 'path';
import chalk from 'chalk';
import { readCodeFiles, stripCommentsAndStrings } from '../lib/code-analysis-utils.js';

export function handleOpenRedirectScan(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔀 正在检测开放重定向风险...'));
  const findings = [];

  // Targeted open redirect pattern scan
  const srcDir = join(targetPath, 'src');
  const redirectPatterns = [
    { name: 'location.href 参数拼接', re: /location\.href\s*=\s*(?!['"]#['"])(?!['"]\/['"])\w+|location\.href\s*=\s*[`'"].*\$\{/gi },
    { name: 'location.replace 参数注入', re: /location\.replace\s*\(\s*(?!['"]\/['"])\w+|location\.replace\s*\(\s*[`'"].*\$\{/gi },
    { name: 'window.open 参数拼接', re: /window\.open\s*\(\s*(?!['"]\/['"])\w+|window\.open\s*\(\s*[`'"].*\$\{/gi },
    { name: 'location.assign 参数注入', re: /location\.assign\s*\(\s*(?!['"]\/['"])\w+|location\.assign\s*\(\s*[`'"].*\$\{/gi },
    { name: 'JSX href 参数拼接', re: /href\s*=\s*\{/gi },
  ];

  for (const file of readCodeFiles(srcDir)) {
    if (/\.test\./.test(file.path)) continue;
    const stripped = stripCommentsAndStrings(file.content);

    for (const { name, re } of redirectPatterns) {
      const matches = stripped.match(re);
      if (matches && matches.length > 0) {
        findings.push({ file: file.path, pattern: name, count: matches.length });
      }
    }
  }

  if (findings.length > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${findings.length} 处潜在开放重定向`));
    findings.slice(0, 5).forEach(f =>
      console.log(chalk.dim(`    ${f.pattern} @ ${f.file} (${f.count} 处)`))
    );
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
