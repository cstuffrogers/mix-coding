import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

// Hard constraint: docs handler may only write into docs/ directory
function guardWrite(targetPath, relativePath) {
  const resolved = join(targetPath, relativePath);
  const docsRoot = join(targetPath, 'docs');
  if (!resolved.startsWith(docsRoot)) {
    throw new Error(`docs handler 写入越界: ${resolved} (仅允许 ${docsRoot})`);
  }
  return resolved;
}

function ensureDocsDir(targetPath) {
  const docsDir = join(targetPath, 'docs');
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }
  return docsDir;
}

// ── API Docs ──

function walkDir(dir, extensions, maxDepth = 5) {
  const results = [];
  function walk(current, depth) {
    if (depth > maxDepth) return;
    try {
      for (const entry of readdirSync(current)) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
        const full = join(current, entry);
        try {
          const st = statSync(full);
          if (st.isDirectory()) { walk(full, depth + 1); }
          else if (extensions.includes(extname(entry))) { results.push(full); }
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  }
  walk(dir, 0);
  return results;
}

function scanExports(targetPath, srcDir) {
  const files = walkDir(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
  const moduleMap = {};
  let totalExports = 0;

  for (const filePath of files) {
    const lines = readFileSync(filePath, 'utf-8').split('\n');
    const exports = [];
    for (const line of lines) {
      const match = line.match(/^\s*export\s+(async\s+)?(function|class|const|interface|type)\s+(\w+)/);
      if (match) exports.push({ name: match[3], kind: match[2] });
    }
    if (exports.length > 0) {
      moduleMap[relative(targetPath, filePath).replace(/\\/g, '/')] = exports;
      totalExports += exports.length;
    }
  }
  return { moduleMap, totalExports };
}

export function handleApiDocs(_action, params, targetPath, context) {
  const includeDir = params?.include || 'src';
  ensureDocsDir(targetPath);
  let docEntries = 0;

  try {
    const srcDir = join(targetPath, includeDir);
    if (!existsSync(srcDir)) {
      return 'API 文档生成完成（无源文件目录）';
    }

    const { moduleMap, totalExports } = scanExports(targetPath, srcDir);

    if (totalExports === 0) {
      return 'API 文档生成完成（无可提取内容）';
    }

    const apiDir = join(targetPath, 'docs', 'api');
    if (!existsSync(apiDir)) mkdirSync(apiDir, { recursive: true });

    for (const [modPath, modExports] of Object.entries(moduleMap)) {
      const modName = modPath.replace(/^src\//, '').replace(/\//g, '-').replace(/\.(ts|tsx|js|jsx)$/, '');
      const docPath = guardWrite(targetPath, `docs/api/${modName}.md`);
      let content = `# ${modName}\n\n> 源文件: \`${modPath}\`\n\n## 导出\n\n`;
      for (const exp of modExports) {
        content += `### \`${exp.name}\`\n\n- 类型: ${exp.kind}\n- 描述: 自动生成，详见源码注释\n\n`;
      }
      writeFileSync(docPath, content, 'utf-8');
      docEntries++;
    }

  } catch (e) {
    console.log(chalk.yellow(`  ⚠ API 文档提取失败: ${e.message}`));
  }

  if (context) context.apiDocsGenerated = docEntries;
  return docEntries > 0 ? `API 文档已生成 (${docEntries} 个模块)` : 'API 文档生成完成（无可提取内容）';
}

// ── Changelog helpers ──

const CONVENTIONAL_LABELS = { feat: 'Features', fix: 'Bug Fixes', perf: 'Performance', refactor: 'Refactoring', chore: 'Chores', docs: 'Documentation', test: 'Tests', other: 'Other' };

function parseConventionalCommits(messages) {
  const groups = {};
  for (const key of Object.keys(CONVENTIONAL_LABELS)) groups[key] = [];
  for (const msg of messages) {
    const m = msg.match(/^(feat|fix|perf|refactor|chore|docs|test|style|ci|build)(\(.+?\))?:\s(.+)/);
    if (m) { (groups[m[1]] || groups.other).push(m[3]); }
    else { groups.other.push(msg); }
  }
  return groups;
}

// ── Changelog ──

export function handleChangelog(_action, params, targetPath, context) {
  ensureDocsDir(targetPath);

  try {
    const log = safeExec(
      `git log --oneline --no-decorate -50`,
      targetPath, { stdio: 'pipe' }
    ).toString().trim();

    const commits = log.split('\n').map(line => {
      const match = line.match(/^[a-f0-9]+\s(.+)$/);
      return match ? match[1] : line;
    });

    const groups = parseConventionalCommits(commits);
    const today = new Date().toISOString().split('T', 1)[0];
    const version = params?.version || 'Unreleased';
    let changelog = `# Changelog\n\n## ${version} (${today})\n\n`;

    for (const [type, entries] of Object.entries(groups)) {
      changelog += `## ${CONVENTIONAL_LABELS[type]}\n\n`;
      for (const e of entries) changelog += `- ${e}\n`;
      changelog += '\n';
    }

    const changelogPath = guardWrite(targetPath, 'docs/CHANGELOG.md');
    const existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf-8').split('\n').slice(1).join('\n') : '';
    writeFileSync(changelogPath, changelog + existing, 'utf-8');

    if (context) context.changelogGenerated = true;
    return `CHANGELOG 已生成 (${commits.length} 条提交)`;
  } catch {
    return 'CHANGELOG 生成跳过';
  }
}

// ── Dev Docs (architecture.md) ──

function buildDirectoryTree(targetPath) {
  const treeLines = [];
  function walk(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return;
    try {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
        const full = join(dir, entry);
        try {
          const st = statSync(full);
          const indent = '  '.repeat(depth);
          if (st.isDirectory()) {
            treeLines.push(`${indent}${entry}/`);
            walk(full, depth + 1, maxDepth);
          } else {
            treeLines.push(`${indent}${entry}`);
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  }
  walk(targetPath);
  return treeLines.slice(0, 80).join('\n');
}

function detectStack(targetPath, deps) {
  const hasReact = existsSync(join(targetPath, 'src', 'App.tsx')) || existsSync(join(targetPath, 'src', 'App.jsx'));
  const hasNext = existsSync(join(targetPath, 'next.config.js')) || existsSync(join(targetPath, 'next.config.ts'));
  const hasExpress = deps.includes('express');
  const hasVite = existsSync(join(targetPath, 'vite.config.ts')) || existsSync(join(targetPath, 'vite.config.js'));
  const stack = [];
  if (hasNext) stack.push('Next.js');
  else if (hasReact) stack.push('React' + (hasVite ? ' + Vite' : ''));
  if (hasExpress) stack.push('Express');
  return stack;
}

export function handleDevDocs(_action, _params, targetPath, context) {
  ensureDocsDir(targetPath);

  try {
    const tree = buildDirectoryTree(targetPath);

    let deps = '';
    const pkgPath = join(targetPath, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depList = Object.keys(allDeps).slice(0, 30);
      deps = depList.map(d => `- \`${d}\``).join('\n');
    }

    const stack = detectStack(targetPath, deps);

    const archPath = guardWrite(targetPath, 'docs/architecture.md');
    const content = `# 项目架构

> 自动生成于 ${new Date().toISOString().split('T', 1)[0]}

## 技术栈

${stack.length ? stack.map(s => `- ${s}`).join('\n') : '- 待补充'}

## 目录结构

\`\`\`
${tree || '待补充'}
\`\`\`

## 核心依赖

${deps || '待补充'}

## 模块说明

| 目录 | 职责 |
|------|------|
| \`src/commands/\` | CLI 命令入口（list/start/show/fork） |
| \`src/handlers/\` | Action 处理器（安全/性能/文档/审计/流程控制等） |
| \`src/lib/\` | 共享库（代码分析/条件评估/增强选择/文档同步） |
| \`src/data/\` | 配置常量（Action 消息/场景标签/门禁标志） |

## 数据流

CLI 命令 → Commander 解析参数 → \`commands/start.js\` 加载场景 JSON → \`actions.js\` 分发到 handler → handler 执行并更新 context → 质量门禁检查 → 通知完成

## 编码规范

详见 \`CLAUDE.md\` 和 \`.claude/rules/\` 目录。

## 工作流

本项目使用 mix-coding 系统，支持 28 个自动化工作流。详见 \`CLAUDE.md\`。
`;

    writeFileSync(archPath, content, 'utf-8');
    if (context) context.devDocsGenerated = true;
    return '开发者文档已生成';
  } catch {
    return '开发者文档生成跳过';
  }
}
