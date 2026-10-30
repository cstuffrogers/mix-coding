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
      return { status: 'skip', message: `API 文档生成跳过：没有源文件目录 ${includeDir}` };
    }

    const { moduleMap, totalExports } = scanExports(targetPath, srcDir);

    if (totalExports === 0) {
      return { status: 'skip', message: 'API 文档生成跳过：源文件里没有可提取的导出' };
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
  // docEntries 为 0 说明一份文档都没写出来（提取报错或没导出），以前照样记 ✓ pass。
  return docEntries > 0
    ? `API 文档已生成 (${docEntries} 个模块)`
    : { status: 'skip', message: 'API 文档未生成：没有写出任何模块文档（提取失败或无可提取内容）' };
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

/**
 * 把 since 声明翻译成 git rev。
 * - 'last_release' → 最近的 tag（git describe --tags --abbrev=0）
 * - 其他非空字符串 → 原样当作 rev
 * - 没声明 → 空串（不限制范围）
 * 解析不出来时也返回空串，但会打一行提示 —— 不静默当成「没有范围」。
 */
function resolveSinceRev(since, targetPath) {
  if (typeof since !== 'string' || !since) return '';
  if (since !== 'last_release') return since;
  try {
    const tag = safeExec('git describe --tags --abbrev=0', targetPath, { stdio: 'pipe' }).toString().trim();
    return tag;
  } catch {
    console.log(chalk.dim('  ℹ 没有找到上一个 tag（since=last_release 无法解析），CHANGELOG 按最近 50 条生成'));
    return '';
  }
}

/**
 * 生成区的起止标记。和 `DEV_DOCS_MARKER` 同一个作用：区分「我上次写的」和「人写的」。
 * 只靠 `split('\n').slice(1)` 丢标题行来「保留旧内容」是不行的 ——
 * 那样每跑一次都在顶部叠一段新版本，跑三次文件里就有三个 `## Unreleased`。
 */
const CHANGELOG_BEGIN = '<!-- generated-by: mix-coding /docs changelog -->';
const CHANGELOG_END = '<!-- /generated-by -->';

function buildChangelogBlock(version, today, groups) {
  let body = `## ${version} (${today})\n\n`;
  for (const [type, entries] of Object.entries(groups)) {
    // 分组用 ### ：## 是版本号的位置。以前两者都是 ## ，跑一次就把手写 CHANGELOG
    // （本仓库用的是 ### Fixed）压成一排平级章节。
    body += `### ${CONVENTIONAL_LABELS[type]}\n\n`;
    for (const e of entries) body += `- ${e}\n`;
    body += '\n';
  }
  return `${CHANGELOG_BEGIN}\n${body}${CHANGELOG_END}\n`;
}

/** 找生成区；返回位置，判断「这是不是我的产物」只此一处。 */
function markerRange(existing) {
  const beginAt = existing.indexOf(CHANGELOG_BEGIN);
  const endAt = existing.indexOf(CHANGELOG_END);
  return { beginAt, endAt, generated: beginAt !== -1 && endAt > beginAt };
}

/**
 * 只重写标记之间那一段，标记之外的人写内容原样保留。
 * 标记后面的空行无论几个都归成一个分隔 —— 否则每跑一次文件末尾就多一个换行：
 * 内容一样、字节不同，提交里永远挂着一个「无变化」的 diff。
 */
function mergeGeneratedBlock(existing, block) {
  const { beginAt, endAt } = markerRange(existing);
  const before = existing.slice(0, beginAt);
  const after = existing.slice(endAt + CHANGELOG_END.length).replace(/^\n+/u, '');
  return after === '' ? `${before}${block}` : `${before}${block}\n${after}`;
}

function parseCommitLines(log) {
  return log
    .split('\n')
    .map((line) => {
      const match = line.match(/^[a-f0-9]+\s(.+)$/u);
      return match ? match[1] : line;
    })
    .filter((line) => line !== '');
}

export function handleChangelog(_action, params, targetPath, context) {
  const changelogPath = guardWrite(targetPath, 'docs/CHANGELOG.md');
  // 手写的 CHANGELOG 不许碰：覆盖一次就是销毁一次人工工作（与 handleDevDocs 同一规矩）。
  const existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf-8') : '';
  const { generated } = markerRange(existing);
  if (existing !== '' && !generated) {
    return {
      status: 'skip',
      reason: 'input-invalid',
      message: 'CHANGELOG 未生成：docs/CHANGELOG.md 已存在且不像生成物（没有生成标记），不覆盖手写记录；确认要重新生成请先删掉那个文件',
    };
  }

  try {
    // since: "last_release" 或具体 tag/rev —— 决定从哪个点开始生成条目。
    // specs 里声明了它，以前没人读：永远只取最近 50 条，上一个版本之前的
    // 提交也会被写进本版 CHANGELOG。
    const since = resolveSinceRev(params?.since, targetPath);
    const range = since ? `${since}..HEAD` : '';
    const log = safeExec(
      `git log --oneline --no-decorate ${range ? `${range} ` : ''}-50`,
      targetPath, { stdio: 'pipe' }
    ).toString().trim();
    const commits = parseCommitLines(log);

    // 零提交也产出一份只有标题的 CHANGELOG = 假绿。
    if (commits.length === 0) {
      return {
        status: 'skip',
        reason: 'input-missing',
        message: `CHANGELOG 未生成：${range ? `${range} ` : ''}区间里没有任何提交`,
      };
    }

    const today = new Date().toISOString().split('T', 1)[0];
    const block = buildChangelogBlock(params?.version || 'Unreleased', today, parseConventionalCommits(commits));

    ensureDocsDir(targetPath);
    writeFileSync(changelogPath, generated ? mergeGeneratedBlock(existing, block) : `# Changelog\n\n${block}`, 'utf-8');

    if (context) context.changelogGenerated = true;
    return {
      status: 'pass',
      message: `CHANGELOG 已生成（${commits.length} 条提交${since ? `，范围 ${since}..HEAD` : ''}）`,
    };
  } catch (e) {
    const message = String(e?.message ?? e);
    // 空仓库不是错误：还没有任何提交时 `git log` 会直接 throw。
    // 这是「没东西可写」，不是「写失败了」—— 两者对上游的含义完全不同。
    if (/does not have any commits|bad default revision 'HEAD'/iu.test(message)) {
      return {
        status: 'skip',
        reason: 'input-missing',
        message: `CHANGELOG 未生成：仓库里还没有任何提交（${message}）`,
      };
    }
    // 其余（EPERM、不是 git 仓库…）才算真错误，不许写成「跳过」。
    return { status: 'warn', message: `CHANGELOG 未生成：${message}` };
  }
}

// ── Dev Docs (architecture.md) ──

/**
 * 生成标记：`handleDevDocs` 靠它区分「我上次生成的产物」和「人写的文档」。
 * 没有它的 docs/architecture.md 一律不覆盖 —— 覆盖一次就是销毁一次人工工作。
 */
const DEV_DOCS_MARKER = '<!-- generated-by: mix-coding /docs arch -->';
const TREE_MAX_LINES = 80;
const TREE_MAX_DEPTH = 3;
const DEP_MAX_LINES = 30;

/**
 * 目录树最多保留 TREE_MAX_LINES 行，**省略了多少必须写出来**。
 *
 * 以前是静默 `slice(0, 80)`：生成的文档看起来完整，其实只有第一段 ——
 * 仓库里那份退役的 `docs/architecture.md` 就只写出了 `Archon-dev/` 一棵子树，
 * 正文却像模像样地写着「目录结构」，谁也看不出它少算了 99%。
 */
function buildDirectoryTree(targetPath) {
  const all = [];
  function walk(dir, depth = 0) {
    if (depth > TREE_MAX_DEPTH) return;
    try {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
        const full = join(dir, entry);
        try {
          const st = statSync(full);
          const indent = '  '.repeat(depth);
          if (st.isDirectory()) {
            all.push(`${indent}${entry}/`);
            walk(full, depth + 1);
          } else {
            all.push(`${indent}${entry}`);
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  }
  walk(targetPath);
  return {
    lines: all.slice(0, TREE_MAX_LINES),
    omitted: Math.max(0, all.length - TREE_MAX_LINES),
  };
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

function readDepKeys(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  if (!existsSync(pkgPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
}

function describeStack(stack) {
  // 「待补充」不是结论：它让读者以为再跑一次就有了。探测不到就直说探测不到。
  if (stack.length === 0) {
    return '- 未识别：没有 next.config / src/App.tsx / vite.config / express 依赖，技术栈请手写补充';
  }
  return stack.map((s) => `- ${s}`).join('\n');
}

function describeDeps(depKeys) {
  if (depKeys.length === 0) return '- 未识别：package.json 里没有 dependencies / devDependencies';
  const shown = depKeys.slice(0, DEP_MAX_LINES).map((d) => `- \`${d}\``).join('\n');
  // 截断同样要写在脸上：40 个依赖只列 30 个却说「核心依赖」，读者会以为就这些。
  return depKeys.length > DEP_MAX_LINES
    ? `（前 ${DEP_MAX_LINES} 个，共 ${depKeys.length} 个）\n\n${shown}`
    : shown;
}

function describeTree(tree) {
  const body = tree.lines.length > 0 ? tree.lines.join('\n') : '（空）';
  const note = tree.omitted > 0
    ? `\n\n…（已省略 ${tree.omitted} 项：本表最多 ${TREE_MAX_LINES} 行 / ${TREE_MAX_DEPTH} 层，完整列表请用 ls 或 tree）`
    : '';
  return body + note;
}

export function handleDevDocs(_action, _params, targetPath, context) {
  // 先看目标里有没有可写的结构：空目录也产出一份「架构文档」= 假绿。
  const tree = buildDirectoryTree(targetPath);
  if (tree.lines.length === 0) {
    return {
      status: 'skip',
      reason: 'input-missing',
      message: '开发者文档未生成：目标目录里没有任何可扫描的结构（只有隐藏文件，或不可读）',
    };
  }

  const archPath = guardWrite(targetPath, 'docs/architecture.md');
  if (existsSync(archPath)) {
    const existing = readFileSync(archPath, 'utf-8');
    if (!existing.includes(DEV_DOCS_MARKER)) {
      return {
        status: 'skip',
        reason: 'input-invalid',
        message: '开发者文档未生成：docs/architecture.md 已存在且不像生成物（没有生成标记），不覆盖手写内容；确认要重新生成请先删掉那个文件',
      };
    }
  }

  try {
    const depKeys = readDepKeys(targetPath);
    const stack = detectStack(targetPath, depKeys.join(' '));
    const today = new Date().toISOString().split('T', 1)[0];
    // 只写「读者在这个目录里能自己核」的东西。本仓库的模块说明 / 数据流 / 工作流条数
    // 以前就硬编码在这段模板里 —— 在别人的项目里写我们的自传，而且是错的条数。
    const content = `# 项目架构

${DEV_DOCS_MARKER}
> 自动生成于 ${today}。本文件由 \`/docs arch\` 生成，手改会在下次生成时被覆盖；
> 想手写请先删掉上面那行生成标记（生成器见到没标记的文件会拒绝覆盖）。

## 技术栈

${describeStack(stack)}

## 目录结构

\`\`\`
${describeTree(tree)}
\`\`\`

## 核心依赖

${describeDeps(depKeys)}

## 编码规范 / 工作流

本项目使用的编码规范、场景工作流以仓库里的 \`CLAUDE.md\` / \`AGENTS.md\` 与
\`.claude/\` 目录为准 —— 那是活的配置，不在这里抄一遍。
`;

    ensureDocsDir(targetPath);
    writeFileSync(archPath, content, 'utf-8');
    if (context) context.devDocsGenerated = true;
    const truncated = tree.omitted > 0 ? `，目录树省略 ${tree.omitted} 项` : '';
    return { status: 'pass', message: `开发者文档已生成（目录树 ${tree.lines.length} 行${truncated}）` };
  } catch (e) {
    return { status: 'warn', message: `开发者文档未生成：${e.message}` };
  }
}
