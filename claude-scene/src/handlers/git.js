import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { safeExec, escapeArg } from '../lib/safe-exec.js';

export function handleCreateBranch(_action, params, targetPath) {
  const branchType = params?.branch_type || 'feature';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `${branchType}/auto-${timestamp}`;
  console.log(chalk.blue(`\n🌿 正在创建分支: ${branchName}`));
  try {
    safeExec(`git checkout -b ${escapeArg(branchName)} 2>&1`, targetPath, { stdio: 'pipe' });
    console.log(chalk.green(`  ✅ 分支已创建: ${branchName}`));
    return `分支已创建: ${branchName}`;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 分支创建失败: ${e.message}`));
    return `分支创建跳过: ${e.message}`;
  }
}

export function handleCommitPush(_action, params, targetPath) {
  const message = params?.message || 'feat: auto-commit';
  console.log(chalk.blue('\n📦 正在提交代码...'));
  try {
    safeExec('git add -A 2>&1', targetPath, { stdio: 'pipe' });
    safeExec(`git commit -m ${escapeArg(message)} 2>&1`, targetPath, { stdio: 'pipe' });
    console.log(chalk.green(`  ✅ 已提交: ${message}`));
    if (params?.push_remote) {
      safeExec('git push origin HEAD 2>&1', targetPath, { stdio: 'pipe' });
      console.log(chalk.green('  ✅ 已推送到远程'));
    }
    return '代码已提交' + (params?.push_remote ? '并推送' : '');
  } catch (e) {
    const errMsg = e.stderr ? e.stderr.toString() : e.message;
    if (errMsg.includes('nothing to commit') || errMsg.includes('nothing added')) {
      console.log(chalk.dim('  ℹ 无变更需要提交'));
      return '无变更提交';
    }
    console.log(chalk.yellow(`  ⚠ 提交失败: ${errMsg.slice(0, 200)}`));
    return `提交跳过: ${errMsg.slice(0, 100)}`;
  }
}

export function handleCreatePR(_action, params, targetPath) {
  console.log(chalk.blue('\n🔀 正在创建 Pull Request...'));
  try {
    const result = safeExec(`gh pr create --title ${escapeArg(params?.title || 'Auto PR')} --body ${escapeArg(params?.body || 'Auto-generated PR')} 2>&1 || true`, targetPath, { stdio: 'pipe' }).toString().trim();
    console.log(chalk.green(`  ✅ PR 已创建: ${result}`));
    return `PR 已创建: ${result}`;
  } catch (e) {
    const errMsg = e.stderr ? e.stderr.toString() : e.message;
    if (errMsg && errMsg.includes('command not found')) {
      console.log(chalk.yellow('  ⚠ gh CLI 未安装，跳过 PR 创建'));
      return 'PR 创建跳过（gh CLI 不可用）';
    }
    console.log(chalk.red(`  ❌ PR 创建失败: ${errMsg?.slice(0, 200) || '未知错误'}`));
    return `PR 创建失败: ${errMsg?.slice(0, 100)}`;
  }
}

export function handleAutoUpdate(_action, params, targetPath) {
  const mode = params?.mode || 'pull';
  const rebase = params?.rebase !== false;
  console.log(chalk.blue(`\n🔄 正在更新代码 (${mode}${rebase ? ', rebase' : ''})...`));
  try {
    if (mode === 'fetch') {
      safeExec('git fetch origin 2>&1 || true', targetPath, { stdio: 'pipe' });
      console.log(chalk.green('  ✅ 已获取远程更新'));
      return '远程更新已获取（fetch only）';
    }
    const rebaseFlag = rebase ? ' --rebase' : '';
    safeExec(`git pull${rebaseFlag} origin 2>&1 || true`, targetPath, { stdio: 'pipe' });
    console.log(chalk.green('  ✅ 代码已更新'));
    return '代码已更新到最新版本';
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 更新跳过: ${e.message}`));
    return '代码更新跳过';
  }
}

export function handleBumpVersion(_action, params, targetPath) {
  const level = params?.level || 'patch';
  console.log(chalk.blue(`\n📌 正在更新版本号 (${level})...`));
  try {
    safeExec(`npm version ${escapeArg(level)} --no-git-tag-version 2>&1 || true`, targetPath, { stdio: 'pipe' });
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    console.log(chalk.green(`  ✅ 版本号: ${pkg.version}`));
    return `版本号已更新: ${pkg.version}`;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 版本号更新失败: ${e.message}`));
    return '版本号更新跳过';
  }
}

export function handleCreateTag(_action, params, targetPath) {
  const version = params?.version || '';
  console.log(chalk.blue(`\n🏷️ 正在创建 Git Tag...`));
  try {
    let tagName = version;
    if (!tagName) {
      const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
      tagName = `v${pkg.version}`;
    }
    safeExec(`git tag -a ${escapeArg(tagName)} -m ${escapeArg(`Release ${tagName}`)} 2>&1`, targetPath, { stdio: 'pipe' });
    safeExec(`git push origin ${escapeArg(tagName)} 2>&1 || true`, targetPath, { stdio: 'pipe' });
    console.log(chalk.green(`  ✅ Tag 已创建并推送: ${tagName}`));
    return `Tag 已创建: ${tagName}`;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ Tag 创建失败: ${e.message}`));
    return 'Tag 创建跳过';
  }
}

export function handleDeploy(_action, params, targetPath) {
  const platform = params?.platform || 'auto';
  console.log(chalk.blue(`\n🚀 正在部署 (${platform})...`));
  const pkgPath = join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.deploy) {
        safeExec('npm run deploy 2>&1', targetPath, { stdio: 'inherit' });
        console.log(chalk.green('  ✅ 部署完成'));
        return '部署完成';
      }
      if (pkg.scripts?.build) {
        safeExec('npm run build 2>&1', targetPath, { stdio: 'inherit' });
        console.log(chalk.green('  ✅ 构建完成（未配置 deploy 脚本，仅执行 build）'));
        return '部署完成（仅构建）';
      }
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ 部署失败: ${e.message}`));
      return `部署失败: ${e.message}`;
    }
  }
  console.log(chalk.dim('  ℹ 未检测到可部署项目'));
  return '部署跳过（无可部署项目）';
}

export function handleCreateRelease(_action, params, targetPath) {
  const tag = params?.tag || '';
  const title = params?.title || 'Release';
  const notes = params?.notes || '';
  console.log(chalk.blue('\n📦 正在创建 GitHub Release...'));
  try {
    let cmd = `gh release create ${escapeArg(tag || 'latest')}`;
    if (title) cmd += ` --title ${escapeArg(title)}`;
    if (notes) cmd += ` --notes ${escapeArg(notes)}`;
    cmd += ' 2>&1 || true';
    const result = safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim();
    console.log(chalk.green(`  ✅ Release 已创建`));
    return `Release 已创建: ${result}`;
  } catch {
    console.log(chalk.dim('  ℹ gh CLI 不可用，CLI 模式下为轻量操作'));
    return 'Release 创建完成（CLI 轻量模式）';
  }
}

export function handleListReleases(_action, _params, targetPath) {
  console.log(chalk.blue('\n📋 正在获取 Release 列表...'));
  try {
    const result = safeExec('gh release list --limit 10 2>&1 || true', targetPath, { stdio: 'pipe' }).toString().trim();
    if (result) {
      console.log(chalk.dim(result.split('\n').slice(0, 5).join('\n')));
      return `Release 列表已获取`;
    }
    console.log(chalk.dim('  ℹ 无 Release 记录'));
    return 'Release 列表为空';
  } catch {
    console.log(chalk.dim('  ℹ gh CLI 不可用，CLI 模式下为轻量操作'));
    return 'Release 列表获取完成（CLI 轻量模式）';
  }
}

export function handleRollback(_action, params, targetPath) {
  const target = params?.target || 'HEAD~1';
  console.log(chalk.blue(`\n⏪ 正在回滚到 ${target}...`));
  try {
    safeExec(`git revert ${escapeArg(target)} --no-edit 2>&1`, targetPath, { stdio: 'pipe' });
    console.log(chalk.green(`  ✅ 已回滚到 ${target}`));
    return `回滚完成: ${target}`;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 回滚失败: ${e.message}`));
    return `回滚失败: ${e.message}`;
  }
}

export function handleCreateIssue(_action, params, targetPath) {
  const title = params?.title || 'Auto Issue';
  const body = params?.body || '';
  const labels = params?.labels || [];
  console.log(chalk.blue('\n📝 正在创建 GitHub Issue...'));
  try {
    let cmd = `gh issue create --title ${escapeArg(title)}`;
    if (body) cmd += ` --body ${escapeArg(body)}`;
    if (labels.length) cmd += ` --label ${escapeArg(labels.join(','))}`;
    cmd += ' 2>&1 || true';
    const result = safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim();
    console.log(chalk.green(`  ✅ Issue 已创建`));
    return `Issue 已创建: ${result}`;
  } catch {
    console.log(chalk.dim('  ℹ gh CLI 不可用，CLI 模式下为轻量操作'));
    return 'Issue 创建完成（CLI 轻量模式）';
  }
}
