import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

function detectGitInfo(targetPath) {
  try {
    const remote = safeExec('git remote get-url origin 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/\s.]+?)(?:\.git)?$/);
    if (match) return { owner: match[1], repo: match[2], remote };
    return { owner: '', repo: '', remote };
  } catch { return { owner: '', repo: '', remote: '' }; }
}

function detectHomepage(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.homepage || '';
    } catch { /* ignore */ }
  }
  return '';
}

function generateUpptimeConfig(owner, repo, homepage) {
  const site = homepage || `https://${repo}.vercel.app`;
  return `# Upptime monitoring configuration
# Docs: https://upptime.js.org/docs/
owner: ${owner || 'your-username'}
repo: ${repo || 'your-repo'}
user-agent: upptime
sites:
  - name: ${repo || 'production'}
    url: ${site}
assignees:
  - ${owner || 'your-username'}
status-website:
  baseUrl: /${repo || 'your-repo'}
  name: ${repo || 'Status'}
  cname: ''
schedule: "*/5 * * * *"
`;
}

function generateWorkflowYml() {
  return `name: Upptime
on:
  schedule:
    - cron: "*/5 * * * *"
  workflow_dispatch:
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: upptime/upptime@latest
        with:
          PAT: \${{ secrets.GH_PAT }}
`;
}

function ensureUpptimeConfig(targetPath, gitInfo, homepage) {
  const configPath = join(targetPath, '.upptimerc.yml');
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    const hasOwner = /owner:\s*\S+/i.test(content);
    const hasSites = /sites:/i.test(content);
    return { path: configPath, ok: hasOwner && hasSites };
  }
  const config = generateUpptimeConfig(gitInfo.owner, gitInfo.repo, homepage);
  writeFileSync(configPath, config, 'utf-8');
  return { path: configPath, ok: true };
}

function ensureUpptimeWorkflow(targetPath) {
  const workflowsDir = join(targetPath, '.github', 'workflows');
  const workflowPath = join(workflowsDir, 'upptime.yml');
  if (existsSync(workflowPath)) {
    return { path: workflowPath, ok: true };
  }
  try {
    if (!existsSync(workflowsDir)) mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(workflowPath, generateWorkflowYml(), 'utf-8');
    return { path: workflowPath, ok: true };
  } catch {
    return { path: workflowPath, ok: false };
  }
}

export function handleSetupMonitor(_action, _params, targetPath, context) {

  const hasDotGit = existsSync(join(targetPath, '.git'));
  let isGit = hasDotGit;
  if (!isGit) {
    // .Git can be a file (worktree/submodule) or may be missed; fall back to Git rev-parse
    try {
      safeExec('git rev-parse --git-dir 2>&1', targetPath, { stdio: 'pipe' });
      isGit = true;
    } catch { /* not a Git repo */ }
  }
  if (!isGit) {
    if (context) context.monitorConfigured = false;
    return 'Upptime 配置跳过（非 Git 仓库）';
  }

  const gitInfo = detectGitInfo(targetPath);
  if (!gitInfo.owner || !gitInfo.repo) {
    console.log(chalk.yellow('  ⚠ 未检测到 GitHub remote，使用占位符'));
  } else {
    console.log(chalk.dim(`  仓库: ${gitInfo.owner}/${gitInfo.repo}`));
  }

  const homepage = detectHomepage(targetPath);
  const configResult = ensureUpptimeConfig(targetPath, gitInfo, homepage);
  const workflowResult = ensureUpptimeWorkflow(targetPath);

  if (context) {
    context.monitorConfigured = configResult.ok && workflowResult.ok;
    context.monitorConfigPath = configResult.path;
    context.monitorWorkflowPath = workflowResult.path;
    if (!context.monitorConfigured) context.lastStepFailed = true;
  }

  return context?.monitorConfigured
    ? 'Upptime 监控配置完成'
    : 'Upptime 监控配置部分完成（检查警告）';
}
