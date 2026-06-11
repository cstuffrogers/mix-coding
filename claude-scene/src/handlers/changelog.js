import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

function getLatestTag(targetPath) {
  try {
    const stdout = safeExec('git tag --sort=-creatordate --merged HEAD', targetPath, { stdio: 'pipe' });
    const tags = stdout.toString().trim().split('\n').filter(Boolean);
    return tags.length > 0 ? tags[0] : null;
  } catch { return null; }
}

function getCommitsSinceTag(targetPath, tag, includeAll) {
  try {
    let range;
    if (tag) {
      range = `${tag}..HEAD`;
    } else if (includeAll) {
      range = '';
    } else {
      return [];
    }
    const args = range
      ? `git log ${range} --format="%s|%an|%ad" --date=short`
      : `git log --format="%s|%an|%ad" --date=short`;
    const stdout = safeExec(args, targetPath, { stdio: 'pipe' });
    return stdout.toString().trim().split('\n').filter(Boolean);
  } catch { return []; }
}

const CONVENTIONAL_MAP = {
  feat: 'Added',
  fix: 'Fixed',
  docs: 'Documentation',
  style: 'Changed',
  refactor: 'Changed',
  perf: 'Changed',
  test: 'Internal',
  build: 'Internal',
  ci: 'Internal',
  chore: 'Internal',
  revert: 'Removed',
};

const CONVENTIONAL_RE = /^(\w+)(\([^)]*\))?!?:\s*(.*)/;

function parseConventional(line) {
  const match = line.match(CONVENTIONAL_RE);
  if (!match) return { category: 'Other Changes', message: line };
  const [, type, , message] = match;
  const category = CONVENTIONAL_MAP[type.toLowerCase()] || 'Other Changes';
  return { category, message: `${type}: ${message}` };
}

function getVersionLabel(tag) {
  if (!tag) return 'Unreleased';
  const cleaned = tag.replace(/^v/, '');
  return cleaned.includes('.') ? cleaned : tag;
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function generateChangelog(commits, tag, targetPath) {
  const version = getVersionLabel(tag);
  const date = getCurrentDate();
  const pkgPath = join(targetPath, 'package.json');
  let projectName = '';
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      projectName = pkg.name ? ` for ${pkg.name}` : '';
    } catch { /* ignore */ }
  }

  const groups = {};
  for (const line of commits) {
    const { category, message } = parseConventional(line);
    if (!groups[category]) groups[category] = [];
    groups[category].push(message);
  }

  const order = ['Added', 'Fixed', 'Documentation', 'Changed', 'Removed', 'Internal', 'Other Changes'];
  let body = '';
  for (const cat of order) {
    if (groups[cat] && groups[cat].length > 0) {
      body += `### ${cat}\n\n`;
      for (const msg of groups[cat]) {
        body += `- ${msg}\n`;
      }
      body += '\n';
    }
  }

  return `# Changelog${projectName}

## [${version}] - ${date}

${body}`;
}

function writeChangelog(path, content) {
  try {
    writeFileSync(path, content, 'utf-8');
    console.log(chalk.green('  ✅ CHANGELOG.md 已生成'));
    return true;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 写入失败: ${e.message}`));
    return false;
  }
}

function prependChangelog(path, content) {
  console.log(chalk.dim('  CHANGELOG.md 已存在，将在顶部追加新内容'));
  try {
    const existing = readFileSync(path, 'utf-8');
    const headerEnd = existing.indexOf('\n## ');
    if (headerEnd !== -1) {
      const header = existing.slice(0, headerEnd);
      const rest = existing.slice(headerEnd);
      const newBody = content.slice(content.indexOf('\n## '));
      writeFileSync(path, header + newBody + '\n' + rest, 'utf-8');
    } else {
      writeFileSync(path, content, 'utf-8');
    }
    return true;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 追加失败: ${e.message}`));
    try { writeFileSync(path, content, 'utf-8'); } catch { /* ignore */ }
    return false;
  }
}

export function handleGenerateChangeLog(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📝 正在生成变更日志...'));

  if (!existsSync(join(targetPath, '.git'))) {
    console.log(chalk.yellow('  ⚠ 非 Git 仓库，跳过变更日志生成'));
    if (context) {
      context.changelogGenerated = false;
      context.changelogSkipped = true;
    }
    return '变更日志跳过（非 Git 仓库）';
  }

  const tag = getLatestTag(targetPath);
  console.log(chalk.dim(tag ? `  最新标签: ${tag}` : '  无标签，将生成完整历史'));

  const commits = getCommitsSinceTag(targetPath, tag, true);
  console.log(chalk.dim(`  找到 ${commits.length} 条提交`));

  if (commits.length === 0) {
    console.log(chalk.yellow('  ⚠ 无提交记录'));
    if (context) {
      context.changelogGenerated = false;
      context.commitCount = 0;
    }
    return '无提交记录，未生成变更日志';
  }

  const content = generateChangelog(commits, tag, targetPath);
  const changelogPath = join(targetPath, 'CHANGELOG.md');

  const ok = existsSync(changelogPath)
    ? prependChangelog(changelogPath, content)
    : writeChangelog(changelogPath, content);

  if (!ok) {
    if (context) context.lastStepFailed = true;
    return '变更日志生成失败';
  }

  const conventionalCount = commits.filter((c) => CONVENTIONAL_RE.test(c)).length;
  console.log(chalk.dim(`  符合 Conventional Commits: ${conventionalCount}/${commits.length}`));

  if (context) {
    context.changelogGenerated = true;
    context.changelogPath = changelogPath;
    context.commitCount = commits.length;
  }

  return `变更日志已生成：${changelogPath}（${commits.length} 条提交）`;
}
