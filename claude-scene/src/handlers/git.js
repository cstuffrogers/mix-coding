import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { safeExec, escapeArg } from '../lib/safe-exec.js';

export function handleCreateBranch(_action, params, targetPath) {
  const branchType = params?.branch_type || 'feature';
  const base = params?.base_branch;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `${branchType}/auto-${timestamp}`;
  try {
    // base_branch 以前没人读（场景里写了 "main"）。用 `git checkout -b <name> <base>`
    // 让它真的生效；base 不存在时 git 会报错，下面照实报。
    const baseArg = base ? ` ${escapeArg(base)}` : '';
    safeExec(`git checkout -b ${escapeArg(branchName)}${baseArg} 2>&1`, targetPath, { stdio: 'pipe' });
    return `分支已创建: ${branchName}${base ? `（基于 ${base}）` : ''}`;
  } catch (e) {
    // 以前分支没建成也返回「分支创建跳过: …」，引擎按「跳过」算 pass。
    return { status: 'fail', message: `分支创建失败: ${String(e.message).split('\n').slice(-1)[0].slice(0, 100)}` };
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
  // auto_assign / auto_label 以前也是死的（场景里写了）。gh 有对应参数：
  // --assignee @me、--label a --label b。
  const labels = Array.isArray(params?.auto_label) ? params.auto_label : [];
  try {
    let cmd = `gh pr create --title ${escapeArg(params?.title || 'Auto PR')} --body ${escapeArg(params?.body || 'Auto-generated PR')}`;
    if (params?.auto_assign) cmd += ' --assignee @me';
    for (const label of labels) cmd += ` --label ${escapeArg(label)}`;
    // 以前拼了 `|| true`：gh 不存在也只是 exit 0 → 假绿。
    const result = safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim();
    return `PR 已创建: ${result}`;
  } catch (e) {
    const errMsg = [e.stderr, e.stdout, e.message].filter(Boolean).join('\n').trim();
    if (errMsg.includes('command not found') || errMsg.includes('ENOENT')) {
      return { status: 'skip', message: 'PR 未创建：gh CLI 不可用' };
    }
    return { status: 'fail', message: `PR 创建失败: ${errMsg.split('\n').slice(-1)[0].slice(0, 100)}` };
  }
}

export function handleAutoUpdate(_action, params, targetPath, context) {
  const mode = params?.mode || 'pull';
  const isRebase = params?.rebase !== false;
  // 没有远程仓库时 `git pull origin` 必定失败，但这不是「代码更新失败」——
  // 是本地仓库本来就没地方拉。以前报「执行异常（无错误输出）」并被判 fail，
  // 让任何在自己仓库里跑 deps 的人都看到一盏不明所以的红灯。
  let remotes = '';
  try {
    remotes = safeExec('git remote 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
  } catch { /* 不是 git 仓库：继续走下面的分支，让真实错误浮出来 */ }
  if (remotes === '') {
    return { status: 'skip', message: '代码更新跳过：仓库没有配置远程（git remote 为空）' };
  }
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
    // execSync 的 e.message 形如「Command failed: git pull…\nfatal: …」，
    // 以前只看 stderr/stdout，两者都空时把真实原因（在 message 里）丢了。
    const raw = [e.stderr, e.stdout, e.message].filter(Boolean).join('\n');
    const realLine = raw.split(/[\r\n]+/).map(l => l.trim())
      .find(l => l && !l.startsWith('Command failed'));
    return realLine
      ? { status: 'fail', message: `代码更新失败: ${realLine.slice(0, 160)}` }
      : { status: 'fail', message: '代码更新失败：git 退出码非零但没有任何输出（检查网络或 origin 权限）' };
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
  // annotated（场景里写了 true）以前没人读：`git tag -a` 是写死的。
  // annotated: false → 轻量 tag（没有 tag message）。
  const annotated = params?.annotated !== false;
  try {
    let tagName = version;
    if (!tagName) {
      const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
      tagName = `v${pkg.version}`;
    }
    const tagCmd = annotated
      ? `git tag -a ${escapeArg(tagName)} -m ${escapeArg(`Release ${tagName}`)}`
      : `git tag ${escapeArg(tagName)}`;
    safeExec(`${tagCmd} 2>&1`, targetPath, { stdio: 'pipe' });
    safeExec(`git push origin ${escapeArg(tagName)} 2>&1`, targetPath, { stdio: 'pipe' });
    return `Tag 已创建: ${tagName}${annotated ? '（annotated）' : '（轻量）'}`;
  } catch (e) {
    if (context) context.lastStepFailed = true;
    return { status: 'fail', message: `Tag 创建失败: ${String(e.message).split('\n').slice(-1)[0].slice(0, 100)}` };
  }
}

export function handleDeploy(_action, params, targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  // strategy 以前没人读（场景里写 rolling）。真部署策略由项目自己的 deploy 脚本决定，
  // 引擎无法伪造，所以只在输出里回显声明值，别让它看起来被应用了。
  const strategy = params?.strategy;
  const strategyNote = strategy ? `（声明的策略: ${strategy}，由部署脚本自身实现）` : '';
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.deploy) {
        safeExec('npm run deploy 2>&1', targetPath, { stdio: 'inherit' });
        return `部署完成${strategyNote}`;
      }
      if (pkg.scripts?.build) {
        safeExec('npm run build 2>&1', targetPath, { stdio: 'inherit' });
        // 「仅构建」不是「部署完成」——以前的文案会让人以为已经上线了。
        return { status: 'warn', message: `只完成了构建，没有部署（项目没有 deploy 脚本）${strategyNote}` };
      }
    } catch (e) {
      return { status: 'fail', message: `部署失败: ${String(e.message).split('\n').slice(-1)[0].slice(0, 100)}` };
    }
  }
  return { status: 'skip', message: `部署未执行：无可部署项目${strategyNote}` };
}

/** 拼 `gh release create …` 的命令行（纯字符串，不碰 shell，方便单测）。 */
function buildReleaseCommand({ tag, title, target, prerelease, draft, notes }) {
  let cmd = `gh release create ${escapeArg(tag || 'latest')}`;
  if (title) cmd += ` --title ${escapeArg(title)}`;
  if (target) cmd += ` --target ${escapeArg(String(target))}`;
  if (prerelease) cmd += ' --prerelease';
  if (draft) cmd += ' --draft';
  // 以前这里拼了 `|| true`：gh 不存在 / 没登录也只是 exit 0，于是
  // "Release 已创建: gh: command not found" 被记成 ✓ pass。
  // 正文走临时文件（--notes-file），不经 shell 引号/JSON 转义。
  if (notes) {
    const notesFile = join(tmpdir(), `mix-coding-release-notes-${Date.now()}.md`);
    writeFileSync(notesFile, notes, 'utf-8');
    cmd += ` --notes-file ${escapeArg(notesFile)}`;
  }
  return cmd;
}

export function handleCreateRelease(_action, params, targetPath, context) {
  const tag = params?.tag || '';
  const title = params?.title || 'Release';
  // mobile-release 声明了 body_ref / tag_ref / prerelease，以前全都不读。
  // body_ref 指向 context 里的变量名（如 changelog_content）—— 变量不存在就
  // 不用空串冒充正文，而是在返回里说明。
  const bodyRef = params?.body_ref;
  const bodyFromContext = bodyRef && context ? context[bodyRef] : undefined;
  const notes = params?.notes || (typeof bodyFromContext === 'string' ? bodyFromContext : '');
  const target = params?.tag_ref && context ? context[params.tag_ref] : undefined;
  const prerelease = params?.prerelease === true;
  // release#13 / mobile-release#10 都写了 `draft`。以前没人读它 —— 场景写着
  // 「建草稿 Release」，实际发的是正式版（而且因为没人读，参数契约守卫也
  // 看不见：文案表里的 `web-design-v0-draft` 里恰好包含这几个字母）。
  const draft = params?.draft === true;
  try {
    const cmd = buildReleaseCommand({ tag, title, target, prerelease, draft, notes });
    const result = safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim();
    const missingBody = bodyRef && typeof bodyFromContext !== 'string' ? `（body_ref=${bodyRef} 在 context 里不存在，正文为空）` : '';
    return `Release 已创建${draft ? '（草稿）' : ''}: ${result}${missingBody}`;
  } catch (e) {
    const full = [e.message, e.stderr, e.stdout].filter(Boolean).join('\n');
    const first = String(e.message).split('\n')[0].slice(0, 80);
    if (/command not found|ENOENT|not recognized/i.test(full)) {
      return { status: 'skip', message: `Release 未创建：gh CLI 不可用（${first}）` };
    }
    return { status: 'fail', message: `Release 创建失败: ${first}` };
  }
}

export function handleListReleases(_action, params, targetPath) {
  // 场景声明了 `limit: 10`（rollback#2）。以前命令里写死 --limit 10，参数没人读。
  const declared = Number(params?.limit);
  const limit = Number.isSafeInteger(declared) && declared > 0 ? declared : 10;
  try {
    const result = safeExec(`gh release list --limit ${limit} 2>&1`, targetPath, { stdio: 'pipe' }).toString().trim();
    if (result) {
      return `Release 列表已获取`;
    }
    return 'Release 列表为空';
  } catch (e) {
    return { status: 'warn', message: `Release 列表未获取：gh CLI 不可用（${String(e.message).split('\n')[0].slice(0, 80)}）` };
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

export function handleGitDiffNameOnly(_action, _params, targetPath, context) {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git diff, not user input
    const output = execSync('git diff --name-only', { cwd: targetPath, encoding: 'utf-8', stdio: 'pipe' }).trim();
    const files = output ? output.split('\n').filter(Boolean) : [];
    const frontendExts = ['.tsx', '.jsx', '.vue', '.html', '.css', '.scss', '.sass', '.less', '.astro', '.svelte'];
    const hasFrontend = files.some((f) => frontendExts.some((ext) => f.endsWith(ext)));
    if (context) {
      context.gitDiffFiles = files;
      context.has_frontend_changes = hasFrontend;
    }
    return `Git diff 完成: ${files.length} 个变更文件${hasFrontend ? ' (含前端)' : ''}`;
  } catch (e) {
    // Non-git directory or no commits: treat as no changes, do not fail the step.
    if (context) { context.gitDiffFiles = []; context.has_frontend_changes = false; context.lastStepFailed = false; }
    return `Git diff 跳过（非 git 仓库或无提交）: ${e.message.split('\n')[0]}`;
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
    const result = safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim();
    return `Issue 已创建: ${result}`;
  } catch (e) {
    return { status: 'warn', message: `Issue 未创建：gh CLI 不可用（${String(e.message).split('\n')[0].slice(0, 80)}）（CLI 不执行，需在对话模式由 agent 完成）` };
  }
}
