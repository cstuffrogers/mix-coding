import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';

export function handleCheckOutdated(_action, _params, targetPath, context) {
  try {
    const result = safeExec('npm outdated --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString().trim();
    if (result && result !== '{}') {
      const outdated = JSON.parse(result);
      const count = Object.keys(outdated).length;
      Object.entries(outdated).slice(0, 10).forEach(([name, info]) => {
        console.log(chalk.dim(`    ${name}: ${info.current} → ${info.latest}`));
      });
      if (context) context.dependencyAuditPassed = false;
      return `发现 ${count} 个过期依赖`;
    }
    if (context) context.dependencyAuditPassed = true;
    return '所有依赖已是最新';
  } catch {
    return '过期检查完成（npm outdated 不可用）';
  }
}

export function handleUpdateDeps(_action, params, targetPath) {
  const packages = params?.packages || [];
  try {
    if (packages.length) {
      safeExec(`npm install ${packages.map(p => escapeArg(p)).join(' ')} 2>&1`, targetPath, { stdio: 'pipe' });
    } else {
      safeExec('npm update 2>&1', targetPath, { stdio: 'pipe' });
    }
    return '依赖更新完成';
  } catch {
    return `依赖更新部分完成`;
  }
}

export function handleCheckBreakingChanges(_action, _params, targetPath) {
  try {
    const result = safeExec('npm outdated --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString().trim();
    if (result && result !== '{}') {
      const outdated = JSON.parse(result);
      const breaking = Object.entries(outdated).filter(([, info]) => {
        const current = String(info.current || '0').split('.', 1)[0];
        const latest = String(info.latest || '0').split('.', 1)[0];
        return parseInt(latest) > parseInt(current);
      });
      if (breaking.length) {
        breaking.forEach(([name, info]) => {
          console.log(chalk.yellow(`    ${name}: ${info.current} → ${info.latest}`));
        });
        return `发现 ${breaking.length} 个潜在 Breaking Changes`;
      }
    }
    return '无 Breaking Changes';
  } catch (e) {
    return `Breaking Changes 检查失败: ${e.message?.slice(0, 100)}`;
  }
}
