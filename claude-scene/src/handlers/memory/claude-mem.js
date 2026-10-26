import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { CLAUDE_MEM_DIR } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-utils.js';

// CLAUDE_MEM_DIR 是 import 时冻结的常量；解析放到调用时，测试与多环境才能把
// 全局库指到沙箱，而不是写进开发者真实的 ~/.claude/memory。
function claudeMemDir() {
  return process.env.CLAUDE_MEM_HOME || CLAUDE_MEM_DIR;
}

export function readClaudeMemItems(category) {
  const itemsFile = join(claudeMemDir(), 'areas', 'topics', category || 'general', 'items.json');
  if (!existsSync(itemsFile)) return [];
  try {
    const parsed = JSON.parse(readFileSync(itemsFile, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function writeClaudeMemItem(category, entry, project = null) {
  const dir = join(claudeMemDir(), 'areas', 'topics', category || 'general');
  ensureDir(dir);
  const itemsFile = join(dir, 'items.json');
  let items = [];
  if (existsSync(itemsFile)) {
    try { items = JSON.parse(readFileSync(itemsFile, 'utf-8')); } catch { /* parse error: write to backup to avoid data loss */ }
  }
  if (!Array.isArray(items)) { items = []; }
  // project 是这个后端唯一能区分「哪条属于哪个项目」的字段：全局库里的记录
  // 一混在一起，召回就无法分辨上下文。传 null 时不写，老条目保持无归属。
  const scoped = project?.path ? { ...entry, project: { path: project.path, name: project.name } } : { ...entry };
  items.unshift({ ...scoped, stored_at: new Date().toISOString() });
  if (items.length > 500) items = items.slice(0, 500);
  writeFileSync(itemsFile, JSON.stringify(items, null, 2), 'utf-8');
  return items.length;
}

export function readClaudeMemMarkdown() {
  const mdDir = join(claudeMemDir(), 'memory');
  if (!existsSync(mdDir)) return [];
  try {
    return readdirSync(mdDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const content = readFileSync(join(mdDir, f), 'utf-8');
        return { source: 'claude-mem', file: f, content: content.slice(0, 500), projectPath: readMarkdownProject(content) };
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
  const dir = join(claudeMemDir(), 'memory');
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${type}-${ts}.md`;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const origin = project?.path
    ? `- 项目: ${project.name}\n- 路径: ${project.path}\n`
    : '- 项目: 未标注\n- 路径: 未标注\n';
  const markdown = `# ${type} — ${new Date().toISOString()}\n\n${origin}\n${content}\n`;
  writeFileSync(join(dir, filename), markdown, 'utf-8');

  // Cap markdown files to 100 most recent
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .toReversed(); // newest first (ISO timestamps sort lexicographically)
    for (const old of files.slice(100)) {
      try { unlinkSync(join(dir, old)); } catch { /* skip */ }
    }
  } catch { /* cleanup best-effort */ }

  return filename;
}
