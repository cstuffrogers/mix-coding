import { readFileSync, existsSync, readdirSync, unlinkSync, statSync, appendFileSync, renameSync } from 'fs';
import { join } from 'path';
import { CLAUDE_MEM_DIR } from '../../lib/paths.js';
import { ensureDir, writeFileAtomic } from '../../lib/fs-utils.js';
import { normalizeProjectPath, safeTypeName } from './project-scope.js';

// CLAUDE_MEM_DIR 是 import 时冻结的常量；解析放到调用时，测试与多环境才能把
// 全局库指到沙箱，而不是写进开发者真实的 ~/.claude/memory。
function claudeMemDir() {
  return process.env.CLAUDE_MEM_HOME || CLAUDE_MEM_DIR;
}

const ITEMS_CAP = 500;
const MD_CAP = 100;
const MD_CONTENT_CAP = 500;

// 超过上限的条目不是凭空消失，而是落到 archive/*.jsonl 里 —— 静默删用户的
// 记忆是不可接受的，至少留一份可追溯的原文。
function archiveRecords(dir, records) {
  if (!records.length) return;
  try {
    const archiveDir = join(claudeMemDir(), 'archive');
    ensureDir(archiveDir);
    const lines = records.map(r => JSON.stringify({ archived_at: new Date().toISOString(), ...r }));
    appendFileSync(join(archiveDir, `${dir}-items.jsonl`), lines.join('\n') + '\n', 'utf-8');
  } catch { /* 归档失败不阻断写入 */ }
}

function archiveMarkdown(names) {
  if (!names.length) return;
  try {
    const archiveDir = join(claudeMemDir(), 'archive');
    ensureDir(archiveDir);
    appendFileSync(join(archiveDir, 'markdown-pruned.log'), names.map(n => `${new Date().toISOString()}\t${n}`).join('\n') + '\n', 'utf-8');
  } catch { /* 归档失败不阻断写入 */ }
}

export function readClaudeMemItems(category) {
  const name = safeTypeName(category);
  const itemsFile = join(claudeMemDir(), 'areas', 'topics', name, 'items.json');
  if (!existsSync(itemsFile)) return [];
  try {
    const parsed = JSON.parse(readFileSync(itemsFile, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/**
 * 实际存在 items.json 的分类目录。分类名 = 工作流类型（review / audit /
 * mobile-review …），种类随场景增长，不能靠调用方列一份固定白名单 —— 写进去
 * 却召不回来、list 也数不到，记忆等于丢了。
 */
export function listClaudeMemCategories() {
  const topics = join(claudeMemDir(), 'areas', 'topics');
  if (!existsSync(topics)) return [];
  try {
    return readdirSync(topics, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => existsSync(join(topics, name, 'items.json')))
      .sort();
  } catch { return []; }
}

export function writeClaudeMemItem(category, entry, project = null) {
  const name = safeTypeName(category);
  const dir = join(claudeMemDir(), 'areas', 'topics', name);
  ensureDir(dir);
  const itemsFile = join(dir, 'items.json');
  let items = [];
  if (existsSync(itemsFile)) {
    try {
      items = JSON.parse(readFileSync(itemsFile, 'utf-8'));
    } catch {
      // 文件坏了不能当空数组直接盖掉：先整份搬到 archive 留底，再重建。
      salvageCorrupt(itemsFile, name);
    }
  }
  if (!Array.isArray(items)) { items = []; }
  // project 是这个后端唯一能区分「哪条属于哪个项目」的字段：全局库里的记录
  // 一混在一起，召回就无法分辨上下文。传 null 时不写，老条目保持无归属。
  const scopePath = normalizeProjectPath(project?.path);
  const scoped = scopePath ? { ...entry, project: { path: scopePath, name: project.name || '' } } : { ...entry };
  items.unshift({ ...scoped, stored_at: new Date().toISOString() });
  if (items.length > ITEMS_CAP) {
    // 旧实现直接 slice 掉最老的 —— 用户看不到任何提示，记忆就没了。
    const dropped = items.slice(ITEMS_CAP);
    archiveRecords(name, dropped);
    items = items.slice(0, ITEMS_CAP);
  }
  writeFileAtomic(itemsFile, JSON.stringify(items, null, 2));
  return items.length;
}

/**
 * items.json 解析失败时的抢救：把坏文件原样搬到 archive，而不是静默重建成空数组。
 * 没有这步，一次崩溃留下的半截 JSON 会让整类记忆在下一次写入时彻底消失。
 */
function salvageCorrupt(itemsFile, name) {
  try {
    const dir = join(claudeMemDir(), 'archive');
    ensureDir(dir);
    const stamp = new Date().toISOString().replaceAll(':', '-');
    renameSync(itemsFile, join(dir, `${name}-items-corrupt-${stamp}.json`));
  } catch { /* 抢救失败也不阻断写入 */ }
}

// markdown 文件名是 `<type>-<2026-10-26T...>.md`，type 本身可能带连字符
// （mobile-review），所以只能剥时间戳尾巴，不能按 '-' 切。
function typeFromMarkdownName(file) {
  const match = /^(.+?)-\d{4}-\d{2}-\d{2}T[^.]*\.md$/.exec(file);
  return match ? match[1] : '';
}

export function readClaudeMemMarkdown() {
  const mdDir = join(claudeMemDir(), 'memory');
  if (!existsSync(mdDir)) return [];
  try {
    return readdirSync(mdDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const content = readFileSync(join(mdDir, f), 'utf-8');
        // truncated 必须显式 —— 截断后的内容一旦被回写成新记忆，500 字的残片
        // 就成了「完整记忆」，和之前 agentmemory 的截断回写是同一类放大。
        const truncated = content.length > MD_CONTENT_CAP;
        return {
          source: 'claude-mem',
          file: f,
          // 文件名是 `<type>-<ISO>.md`，补上 type，否则 filters.type / category
          // 对 markdown 归档完全失效（旧实现这些行没有任何类型标识）。
          type: typeFromMarkdownName(f),
          content: content.slice(0, MD_CONTENT_CAP),
          truncated,
          length: content.length,
          projectPath: readMarkdownProject(content),
        };
      });
  } catch { return []; }
}

// markdown 归档没有 JSON 字段可放归属，只好写在头部一行 `- 路径: ...`。
// 老文件没有这一行 → '' → 召回时归为「未标归属」，不会被当成别项目的。
function readMarkdownProject(content) {
  const match = content.match(/^- 路径: (.+)$/m);
  const value = match?.[1]?.trim() || '';
  return value === '未标注' ? '' : value;
}

export function writeClaudeMemMarkdown(type, data, project = null) {
  const name = safeTypeName(type);
  const dir = join(claudeMemDir(), 'memory');
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${ts}.md`;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const scopePath = normalizeProjectPath(project?.path);
  const origin = scopePath
    ? `- 项目: ${project.name || ''}\n- 路径: ${scopePath}\n`
    : '- 项目: 未标注\n- 路径: 未标注\n';
  const markdown = `# ${name} — ${new Date().toISOString()}\n\n${origin}\n${content}\n`;
  writeFileAtomic(join(dir, filename), markdown);

  // 超过上限时按 **mtime** 删最旧的。旧实现按文件名排序（`type-ts.md`），
  // 等价于先按类型字母序分组 —— 实测把最新的 general/review 归档全删了，
  // 却留下最旧的 aaa。容量控制必须看时间，不能看类型名。
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        try { return { f, mtime: statSync(join(dir, f)).mtimeMs }; } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime); // 新 → 旧
    const pruned = files.slice(MD_CAP).map(x => x.f);
    for (const old of pruned) {
      try { unlinkSync(join(dir, old)); } catch { /* 已被别处删掉 */ }
    }
    archiveMarkdown(pruned);
  } catch { /* cleanup best-effort */ }

  return filename;
}
