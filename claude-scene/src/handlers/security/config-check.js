import { readFileSync } from 'fs';
import { relative } from 'path';
import chalk from 'chalk';
import { grepScan } from '../../lib/grep-scan.js';
import { assertSources, listProjectCodeFiles } from '../../lib/project-sources.js';

export function handleCorsCheck(_action, _params, targetPath, context) {
  // [patched:cors-py] 原实现用 grep 只扫 js/ts（漏掉 Python 后端），而且不遵守
  // .claude/scene-scan-ignore、会命中 .next/ 构建产物与 vendored 项目。
  // 改为和 sec-bug-hunt 用同一份「项目源码清单」，0 文件即判失败。
  const files = listProjectCodeFiles(targetPath);
  if (!assertSources(files, context, 'CORS 配置检查')) {
    return 'CORS 配置检查失败: 未找到任何源码文件（扫描范围为空，结果不可信）';
  }

  const corsPatterns = [
    { name: 'CORS 通配符*', test: (line) => /Access-Control-Allow-Origin.*\*/.test(line) },
    { name: 'cors() 无配置', test: (line) => line.includes('cors()') },
    { name: 'credentials + *', test: (line) => /credentials/i.test(line) && /[*]/.test(line) },
    // Python 后端（FastAPI/Django）的写法
    { name: 'allow_origins 通配 *', test: (line) => /allow_origins.*\*/i.test(line) },
    { name: 'CORS_ALLOW_ALL_ORIGINS', test: (line) => /CORS_ALLOW_ALL_ORIGINS.*True/.test(line) },
  ];

  // 规则文本会命中自己：检测器定义行里就写着 `test: (line) => /allow_origins.*\*/`
  const SELF_DEF = /corsCheck|cors_check|cors-check|config-check|handleCorsCheck|security-scanning\.js|grep\s*[:=]\s*['"]|test:\s*\(line\)/i;

  const findings = [];
  for (const file of files) {
    if (!/\.(js|jsx|ts|tsx|mjs|cjs|py)$/i.test(file)) continue;
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    if (!/cors|Access-Control/i.test(content)) continue;
    content.split('\n').forEach((line, idx) => {
      if (SELF_DEF.test(line) || /\bnosec\b/i.test(line)) return;
      // [patched:cors-comment-skip] 注释行不生效：里面写 “credentials + 通配符” 只是解释，不该当成 CORS 问题
      if (/^\s*(?:#|\/\/|\/\*|\*)/.test(line)) return;
      for (const pattern of corsPatterns) {
        if (pattern.test(line)) {
          findings.push(`${pattern.name}: ${relative(targetPath, file)}:${idx + 1} ${line.trim().slice(0, 120)}`);
        }
      }
    });
  }

  if (findings.length === 0) {
    console.log(chalk.green(`  ✅ CORS 配置安全（检查 ${files.length} 个源码文件）`));
  } else {
    findings.slice(0, 10).forEach((f) => console.log(chalk.yellow(`  ⚠ ${f}`)));
  }

  if (context) {
    context.corsCheckPassed = findings.length === 0;
    // [patched:verdict-unify] CORS 不安全即判本步失败，与 review 报告口径一致
    if (findings.length > 0) context.lastStepFailed = true;
  }
  return `CORS 配置检查完成: ${findings.length ? `${findings.length} 处问题` : '安全'}（检查 ${files.length} 个源码文件）`;
}

function scanViteEnvLeaks(targetPath, excludeDirs) {
  const scan = grepScan(
    `grep -rn --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" ${excludeDirs} "import\\.meta\\.env\\." .`,
    targetPath
  );
  const findings = [];
  if (!scan.ok) return { findings, reason: scan.reason };
  const raw = scan.raw;
  if (!raw.trim()) return { findings, ok: true };
  for (const line of raw.split('\n').filter(Boolean)) {
    if (/import\.meta\.env\.(?:VITE_|DEV\b|PROD\b|MODE\b|SSR\b|BASE_URL\b)/i.test(line)) continue;
    const match = line.match(/import\.meta\.env\.(\w+)/);
    if (match && !match[1].startsWith('VITE_')) {
      const fileMatch = line.match(/^\.\/(.+?):(\d+):/);
      findings.push(`Vite 非VITE_前缀: ${match[1]} (${fileMatch ? `${fileMatch[1]}:${fileMatch[2]}` : line.slice(0, 100)})`);
    }
  }
  return { findings, ok: true };
}

function scanProcessEnvLeaks(targetPath, excludeDirs) {
  const scan = grepScan(
    `grep -rn --include="*.jsx" --include="*.tsx" --include="*.svelte" --include="*.vue" ${excludeDirs} "process\\.env\\.[A-Z]" .`,
    targetPath
  );
  const findings = [];
  if (!scan.ok) return { findings, reason: scan.reason };
  const raw = scan.raw;
  if (!raw.trim()) return { findings, ok: true };
  for (const line of raw.split('\n').filter(Boolean)) {
    if (/NEXT_PUBLIC_|REACT_APP_|GATSBY_|VITE_|EXPO_PUBLIC_/i.test(line)) continue;
    if (/config|webpack|builder/i.test(line)) continue;
    const fileMatch = line.match(/^\.\/(.+?):(\d+):/);
    findings.push(`process.env 泄露风险: ${fileMatch ? `${fileMatch[1]}:${fileMatch[2]}` : line.slice(0, 100)}`);
  }
  return { findings, ok: true };
}

export function handleEnvVarLeak(_action, _params, targetPath, context) {
  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.codegraph';

  const viteScan = scanViteEnvLeaks(targetPath, excludeDirs);
  const procScan = scanProcessEnvLeaks(targetPath, excludeDirs);
  const findings = [...viteScan.findings, ...procScan.findings];
  // 两个扫描里只要有一个没跑成（grep 不可用 / 目录不存），就不能写「✓ 通过」——
  // 「零发现」和「没查」在调用方看来都是空数组，那是以前 假绿 的来源。
  const failed = [viteScan, procScan].filter(s => !s.ok);

  if (findings.length > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${findings.length} 处环境变量泄露风险`));
    findings.slice(0, 5).forEach(f => console.log(chalk.dim(`    ${f}`)));
    // 有发现就是有发现，不管另一侧跑没跑成
    if (context) context.envVarLeakPassed = false;
    return `环境变量泄露扫描完成: ${findings.length} 处风险`;
  }
  console.log(chalk.green('  ✅ 未发现前端环境变量泄露'));
  if (failed.length > 0) {
    // 没查过 ≠ 没问题：不写 verdict，让门禁如实记 skipped
    const reason = failed.find(s => s.reason)?.reason || 'grep 不可用';
    return { status: 'warn', message: `环境变量泄露扫描未完成：${reason}（不是通过）` };
  }
  if (context) context.envVarLeakPassed = true;
  return '环境变量泄露扫描完成: 安全';
}
