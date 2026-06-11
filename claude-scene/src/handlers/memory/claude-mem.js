import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { CLAUDE_MEM_DIR } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-utils.js';

export function readClaudeMemItems(category) {
  const itemsFile = join(CLAUDE_MEM_DIR, 'areas', 'topics', category || 'general', 'items.json');
  if (!existsSync(itemsFile)) return [];
  try {
    const parsed = JSON.parse(readFileSync(itemsFile, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function writeClaudeMemItem(category, entry) {
  const dir = join(CLAUDE_MEM_DIR, 'areas', 'topics', category || 'general');
  ensureDir(dir);
  const itemsFile = join(dir, 'items.json');
  let items = [];
  if (existsSync(itemsFile)) {
    try { items = JSON.parse(readFileSync(itemsFile, 'utf-8')); } catch { /* parse error: write to backup to avoid data loss */ }
  }
  if (!Array.isArray(items)) { items = []; }
  items.unshift({ ...entry, stored_at: new Date().toISOString() });
  if (items.length > 500) items = items.slice(0, 500);
  writeFileSync(itemsFile, JSON.stringify(items, null, 2), 'utf-8');
  return items.length;
}

export function readClaudeMemMarkdown() {
  const mdDir = join(CLAUDE_MEM_DIR, 'memory');
  if (!existsSync(mdDir)) return [];
  try {
    return readdirSync(mdDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const content = readFileSync(join(mdDir, f), 'utf-8');
        return { source: 'claude-mem', file: f, content: content.slice(0, 500) };
      });
  } catch { return []; }
}

export function writeClaudeMemMarkdown(type, data) {
  const dir = join(CLAUDE_MEM_DIR, 'memory');
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${type}-${ts}.md`;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const markdown = `# ${type} — ${new Date().toISOString()}\n\n${content}\n`;
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
