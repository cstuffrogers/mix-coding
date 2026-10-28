import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';

export function handleCheckOutdated(_action, _params, targetPath, context) {
  // npm outdated 在「有过期依赖」时 exit 1（但仍输出 JSON），所以不能去掉 `|| true`；
  // 代价是工具自身崩溃时输出也不是 JSON —— 那种情况必须说「没拿到结论」，
  // 以前一律回「（npm outdated 不可用）」，只靠 NOOP 正则碰巧记成 noop。
  let raw;
  try {
    raw = safeExec('npm outdated --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return { status: 'warn', message: `过期依赖检查未完成：npm outdated 执行失败（${String(e.message).slice(0, 100)}）` };
  }
  let outdated;
  try {
    outdated = JSON.parse(raw || '{}');
  } catch {
    return {
      status: 'warn',
      message: `过期依赖检查未完成：npm outdated 没有返回可解析的 JSON（${raw.split(/[\r\n]+/).find(Boolean)?.slice(0, 100) || '空输出'}）`,
    };
  }
  const count = Object.keys(outdated).length;
  if (count > 0) {
    Object.entries(outdated).slice(0, 10).forEach(([name, info]) => {
      console.log(chalk.dim(`    ${name}: ${info.current} → ${info.latest}`));
    });
    if (context) context.dependencyAuditPassed = false;
    return { status: 'warn', message: `发现 ${count} 个过期依赖` };
  }
  if (context) context.dependencyAuditPassed = true;
  return { status: 'pass', message: '所有依赖已是最新' };
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
  } catch (e) {
    // 以前只说「部分完成」—— 既像成功又像失败，最后靠正则只看到「完成」二字 → ✓ pass。
    return { status: 'warn', message: `依赖更新未完成：${String(e.message).slice(0, 120)}` };
  }
}

export function handleCheckBreakingChanges(_action, _params, targetPath) {
  let raw;
  try {
    raw = safeExec('npm outdated --json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return { status: 'warn', message: `Breaking Changes 检查未完成：npm outdated 执行失败（${String(e.message).slice(0, 100)}）` };
  }

  let outdated;
  try {
    outdated = JSON.parse(raw || '{}');
  } catch {
    // 以前这里是「检查失败: …」，含「失败」二字 → 整步判 fail：
    // 工具没跑通不是「发现 Breaking Changes」，不该发红。
    return {
      status: 'warn',
      message: `Breaking Changes 检查未完成：npm outdated 输出无法解析（${raw.split(/[\r\n]+/).find(Boolean)?.slice(0, 100) || '空输出'}）`,
    };
  }

  const breaking = Object.entries(outdated).filter(([, info]) => {
    const current = String(info.current || '0').split('.', 1)[0];
    const latest = String(info.latest || '0').split('.', 1)[0];
    return parseInt(latest) > parseInt(current);
  });
  if (breaking.length) {
    breaking.forEach(([name, info]) => {
      console.log(chalk.yellow(`    ${name}: ${info.current} → ${info.latest}`));
    });
    return { status: 'warn', message: `发现 ${breaking.length} 个潜在 Breaking Changes` };
  }
  return { status: 'pass', message: '无 Breaking Changes' };
}
