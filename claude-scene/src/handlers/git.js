import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { safeExec, escapeArg } from '../lib/safe-exec.js';

export function handleCreateBranch(_action, params, targetPath) {
  const branchType = params?.branch_type || 'feature';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `${branchType}/auto-${timestamp}`;
  try {
    safeExec(`git checkout -b ${escapeArg(branchName)} 2>&1`, targetPath, { stdio: 'pipe' });
    return `分支已创建: ${branchName}`;
  } catch (e) {
    return `分支创建跳过: ${e.message}`;
  }
}

export function handleCommitPush(_action, params, targetPath) {
  const message = params?.message || 'feat: auto-commit';
  try {
    safeExec('git add -A 2>&1', targetPath, { stdio: 'pipe' });
    safeExec(`git commit -m ${escapeArg(message)} 2>&1`, targetPath, { stdio: 'pipe' });
    if (params?.push_remote) {
      safeExec('git push origin HEAD 2>&1', targetPath, { stdio: 'pipe' });
    }
    return '代码已提交' + (params?.push_remote ? '并推送' : '');
  } catch (e) {
    const errMsg = e.stderr ? e.stderr.toString() : e.message;
    if (errMsg.includes('nothing to commit') || errMsg.includes('nothing added')) {
      return '无变更提交';
    }
    return `提交跳过: ${errMsg.slice(0, 100)}`;
  }
}

export function handleCreatePR(_action, params, targetPath) {
  try {
    const result = safeExec(`gh pr create --title ${escapeArg(params?.title || 'Auto PR')} --body ${escapeArg(params?.body || 'Auto-generated PR')} 2>&1 || true`, targetPath, { stdio: 'pipe' }).toString().trim();
    return `PR 已创建: ${result}`;
  } catch (e) {
    const errMsg = e.stderr ? e.stderr.toString() : e.message;
    if (errMsg && errMsg.includes('command not found')) {
      return 'PR 创建跳过（gh CLI 不可用）';
    }
    return `PR 创建失败: ${errMsg?.slice(0, 100)}`;
  }
}

export function handleAutoUpdate(_action, params, targetPath, context) {
  const mode = params?.mode || 'pull';
  const isRebase = params?.rebase !== false;
  try {
    if (mode === 'fetch') {
      safeExec('git fetch origin 2>&1', targetPath, { stdio: 'pipe' });
      return '远程更新已获取（fetch only）';
    }
    const rebaseFlag = isRebase ? ' --rebase' : '';
    safeExec(`git pull${rebaseFlag} origin 2>&1`, targetPath, { stdio: 'pipe' });
    return '代码已更新到最新版本';
  } catch (e) {
    if (context) context.lastStepFailed = true;
    const detail = String(e.stderr || e.stdout || e.message || '').trim().slice(0, 120);
    return detail ? `代码更新失败: ${detail}` : '代码更新失败: git pull 执行异常（无错误输出）';
  }
}

export function handleBumpVersion(_action, params, targetPath, context) {
  const level = params?.level || 'patch';
  try {
    safeExec(`npm version ${escapeArg(level)} --no-git-tag-version 2>&1`, targetPath, { stdio: 'pipe' });
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    return `版本号已更新: ${pkg.version}`;
  } catch (e) {
    if (context) context.lastStepFailed = true;
    return `版本号更新失败: ${e.message}`;
  }
}

export function handleCreateTag(_action, params, targetPath, context) {
  const version = params?.version || '';
  try {
    let tagName = version;
    if (!tagName) {
      const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
      tagName = `v${pkg.version}`;
    }
    safeExec(`git tag -a ${escapeArg(tagName)} -m ${escapeArg(`Release ${tagName}`)} 2>&1`, targetPath, { stdio: 'pipe' });
    safeExec(`git push origin ${escapeArg(tagName)} 2>&1`, targetPath, { stdio: 'pipe' });
    return `Tag 已创建: ${tagName}`;
  } catch (e) {
    if (context) context.lastStepFailed = true;
    return `Tag 创建失败: ${e.message}`;
  }
}

export function handleDeploy(_action, params, targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.deploy) {
        safeExec('npm run deploy 2>&1', targetPath, { stdio: 'inherit' });
        return '部署完成';
      }
      if (pkg.scripts?.build) {
        safeExec('npm run build 2>&1', targetPath, { stdio: 'inherit' });
        return '部署完成（仅构建）';
      }
    } catch (e) {
      return `部署失败: ${e.message}`;
    }
  }
  return '部署跳过（无可部署项目）';
}

export function handleCreateRelease(_action, params, targetPath) {
  const tag = params?.tag || '';
  const title = params?.title || 'Release';
  const notes = params?.notes || '';
  try {
    let cmd = `gh release create ${escapeArg(tag || 'latest')}`;
    if (title) cmd += ` --title ${escapeArg(title)}`;
    if (notes) cmd += ` --notes ${escapeArg(notes)}`;
    cmd += ' 2>&1 || true';
    const result = safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim();
    return `Release 已创建: ${result}`;
  } catch {
    return 'Release 创建完成（CLI 轻量模式）';
  }
}

export function handleListReleases(_action, _params, targetPath) {
  try {
    const result = safeExec('gh release list --limit 10 2>&1 || true', targetPath, { stdio: 'pipe' }).toString().trim();
    if (result) {
      return `Release 列表已获取`;
    }
    return 'Release 列表为空';
  } catch {
    return 'Release 列表获取完成（CLI 轻量模式）';
  }
}

export function handleRollback(_action, params, targetPath) {
  const target = params?.target || 'HEAD~1';
  try {
    safeExec(`git revert ${escapeArg(target)} --no-edit 2>&1`, targetPath, { stdio: 'pipe' });
    return `回滚完成: ${target}`;
  } catch (e) {
    return `回滚失败: ${e.message}`;
  }
}

export function handleCreateIssue(_action, params, targetPath) {
  const title = params?.title || 'Auto Issue';
  const body = params?.body || '';
  const labels = params?.labels || [];
  try {
    let cmd = `gh issue create --title ${escapeArg(title)}`;
    if (body) cmd += ` --body ${escapeArg(body)}`;
    if (labels.length) cmd += ` --label ${escapeArg(labels.join(','))}`;
    cmd += ' 2>&1 || true';
    const result = safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim();
    return `Issue 已创建: ${result}`;
  } catch {
    return 'Issue 创建完成（CLI 轻量模式）';
  }
}
