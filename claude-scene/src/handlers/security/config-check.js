import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';

export function handleCorsCheck(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🌐 正在检查 CORS 配置...'));
  const findings = [];
  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.codegraph';

  const corsPatterns = [
    { name: 'CORS 通配符*', grep: 'Access-Control-Allow-Origin.*[*]' },
    { name: 'cors() 无配置', grep: 'cors()', fixed: true },
    { name: 'credentials + *', grep: 'credentials.*true.*origin.*[*]|origin.*[*].*credentials.*true' },
  ];

  for (const { name, grep, fixed } of corsPatterns) {
    try {
      const flag = fixed ? ' -Frn' : ' -rn';
      const raw = safeExec(
        `grep${flag} --include="*.js" --include="*.ts" --include="*.mjs" --include="*.mts" ${excludeDirs} "${grep}" . 2>&1 || true`,
        targetPath,
        { stdio: 'pipe', timeout: 15000 }
      ).toString().trim();

      if (raw) {
        const lines = raw.split('\n').filter(l => {
          if (!l) return false;
          if (/corsCheck|cors_check|cors-check|config-check|handleCorsCheck|security-scanning\.js/i.test(l)) return false;
          return true;
        });
        if (lines.length === 0) continue;
        lines.slice(0, 3).forEach(l => {
          const trimmed = l.length > 150 ? l.slice(0, 150) + '...' : l;
          findings.push(`${name}: ${trimmed}`);
        });
        console.log(chalk.yellow(`  ⚠ ${name}: ${lines.length} 处`));
        lines.slice(0, 3).forEach(l => console.log(chalk.dim(`    ${l.length > 150 ? l.slice(0, 150) + '...' : l}`)));
      }
    } catch { /* skip */ }
  }

  if (findings.length === 0) {
    console.log(chalk.green('  ✅ CORS 配置安全'));
  }

  if (context) context.corsCheckPassed = findings.length === 0;
  return `CORS 配置检查完成: ${findings.length ? `${findings.length} 处问题` : '安全'}`;
}

function scanViteEnvLeaks(targetPath, excludeDirs) {
  const findings = [];
  try {
    const raw = safeExec(
      `grep -rn --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" ${excludeDirs} "import\\\\.meta\\\\.env\\\\." . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 15000 }
    ).toString();

    if (!raw.trim()) return findings;
    for (const line of raw.split('\n').filter(Boolean)) {
      if (/import\.meta\.env\.(?:VITE_|DEV\b|PROD\b|MODE\b|SSR\b|BASE_URL\b)/i.test(line)) continue;
      const match = line.match(/import\.meta\.env\.(\w+)/);
      if (match && !match[1].startsWith('VITE_')) {
        const fileMatch = line.match(/^\.\/(.+?):(\d+):/);
        findings.push(`Vite 非VITE_前缀: ${match[1]} (${fileMatch ? `${fileMatch[1]}:${fileMatch[2]}` : line.slice(0, 100)})`);
      }
    }
  } catch { /* skip */ }
  return findings;
}

function scanProcessEnvLeaks(targetPath, excludeDirs) {
  const findings = [];
  try {
    const raw = safeExec(
      `grep -rn --include="*.jsx" --include="*.tsx" --include="*.svelte" --include="*.vue" ${excludeDirs} "process\\\\.env\\\\.[A-Z]" . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 15000 }
    ).toString();

    if (!raw.trim()) return findings;
    for (const line of raw.split('\n').filter(Boolean)) {
      if (/NEXT_PUBLIC_|REACT_APP_|GATSBY_|VITE_|EXPO_PUBLIC_/i.test(line)) continue;
      if (/config|webpack|builder/i.test(line)) continue;
      const fileMatch = line.match(/^\.\/(.+?):(\d+):/);
      findings.push(`process.env 泄露风险: ${fileMatch ? `${fileMatch[1]}:${fileMatch[2]}` : line.slice(0, 100)}`);
    }
  } catch { /* skip */ }
  return findings;
}

export function handleEnvVarLeak(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔐 正在检查前端环境变量泄露...'));
  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.codegraph';

  const findings = [
    ...scanViteEnvLeaks(targetPath, excludeDirs),
    ...scanProcessEnvLeaks(targetPath, excludeDirs),
  ];

  if (findings.length > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${findings.length} 处环境变量泄露风险`));
    findings.slice(0, 5).forEach(f => console.log(chalk.dim(`    ${f}`)));
  } else {
    console.log(chalk.green('  ✅ 未发现前端环境变量泄露'));
  }

  if (context) context.envVarLeakPassed = findings.length === 0;
  return `环境变量泄露扫描完成: ${findings.length ? `${findings.length} 处风险` : '安全'}`;
}
