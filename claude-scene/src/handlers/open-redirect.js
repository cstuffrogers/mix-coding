import { readFileSync } from 'fs';
import chalk from 'chalk';
import { stripCommentsAndStrings } from '../lib/code-analysis-utils.js';
import { assertSources, listProjectCodeFiles } from '../lib/project-sources.js';

function scanPatternsInFile(file, redirectPatterns) {
  // [patched:open-redirect-nosec] 支持行内 nosec 豁免（仅用于「已做协议校验」的跳转）。
  // stripCommentsAndStrings 会把注釁抹成空格但保留换行，所以行号仍能对齐；
  // 因此豁免标记必须在**原始行**上找。
  const findings = [];
  const stripped = stripCommentsAndStrings(file.content);
  const rawLines = file.content.split('\n');
  const lineOf = (idx) => stripped.slice(0, idx).split('\n').length - 1;
  for (const { name, re } of redirectPatterns) {
    const matches = [];
    for (const r of re) {
      const global = new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g');
      for (const m of stripped.matchAll(global)) {
        if (/\bnosec\b/i.test(rawLines[lineOf(m.index)] || '')) continue;
        matches.push(m[0]);
      }
    }
    if (matches.length > 0) {
      findings.push({ file: file.path, pattern: name, count: matches.length });
    }
  }
  return findings;
}

export function handleOpenRedirectScan(_action, _params, targetPath, context) {
  const findings = [];

  // [patched:open-redirect-all-sources] 原来只扫 join(targetPath,'src')：前端在
  // frontend/*/ 的项目会扫 0 个文件，然后报「0 处可疑」= 空转也算通过。
  const frontendFiles = listProjectCodeFiles(targetPath).filter((f) => /\.(js|jsx|mjs|cjs|ts|tsx|vue)$/i.test(f));
  if (!assertSources(frontendFiles, context, '开放重定向扫描')) {
    return { status: 'fail', message: '开放重定向检测失败: 未找到任何前端源码文件（扫描范围为空，结果不可信）' };
  }
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

  for (const filePath of frontendFiles) {
    if (/\.test\.|\.spec\./i.test(filePath)) continue;
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    findings.push(...scanPatternsInFile({ path: filePath, content }, redirectPatterns));
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
    if (totalFound > 0) {
      context.high_severity_found = true;
      // [patched:verdict-unify] 命中即判本步失败，与 review 报告口径一致
      context.lastStepFailed = true;
    }
  }
  return `开放重定向检测完成: ${totalFound} 处可疑`;
}
