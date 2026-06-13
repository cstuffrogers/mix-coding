import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';

export function handleCheckOutdated(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📦 正在检查过期依赖...'));
  try {
    const result = safeExec('npm outdated --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString().trim();
    if (result && result !== '{}') {
      const outdated = JSON.parse(result);
      const count = Object.keys(outdated).length;
      console.log(chalk.yellow(`  ⚠ ${count} 个包已过期`));
      Object.entries(outdated).slice(0, 10).forEach(([name, info]) => {
        console.log(chalk.dim(`    ${name}: ${info.current} → ${info.latest}`));
      });
      if (context) context.dependencyAuditPassed = false;
      return `发现 ${count} 个过期依赖`;
    }
    console.log(chalk.green('  ✅ 所有依赖已是最新'));
    if (context) context.dependencyAuditPassed = true;
    return '所有依赖已是最新';
  } catch {
    console.log(chalk.dim('  ℹ npm outdated 不可用'));
    return '过期检查完成（npm outdated 不可用）';
  }
}

export function handleUpdateDeps(_action, params, targetPath) {
  const packages = params?.packages || [];
  console.log(chalk.blue('\n📦 正在更新依赖...'));
  try {
    if (packages.length) {
      safeExec(`npm install ${packages.map(p => escapeArg(p)).join(' ')} 2>&1`, targetPath, { stdio: 'pipe' });
      console.log(chalk.green(`  ✅ 已更新: ${packages.join(', ')}`));
    } else {
      safeExec('npm update 2>&1', targetPath, { stdio: 'pipe' });
      console.log(chalk.green('  ✅ 所有依赖已更新'));
    }
    return '依赖更新完成';
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 更新失败: ${e.message}`));
    return `依赖更新部分完成`;
  }
}

export function handleCheckBreakingChanges(_action, _params, targetPath) {
  console.log(chalk.blue('\n🔍 正在检查 Breaking Changes...'));
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
        console.log(chalk.yellow(`  ⚠ ${breaking.length} 个包有主版本号变更（可能包含 Breaking Changes）`));
        breaking.forEach(([name, info]) => {
          console.log(chalk.yellow(`    ${name}: ${info.current} → ${info.latest}`));
        });
        return `发现 ${breaking.length} 个潜在 Breaking Changes`;
      }
    }
    console.log(chalk.green('  ✅ 无 Breaking Changes'));
    return '无 Breaking Changes';
  } catch { return 'Breaking Changes 检查完成'; }
}
