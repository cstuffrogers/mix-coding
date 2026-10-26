import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { AGENTMEMORY_DIR } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-utils.js';

// AGENTMEMORY_DIR is a module-level constant, so it is frozen at import time and
// an env override set later never takes effect. Resolve per call instead, so
// tests (and multi-home setups) can redirect the store without touching the
// developer's real ~/.agentmemory database.
function agentmemoryDir() {
  return process.env.AGENTMEMORY_HOME || AGENTMEMORY_DIR;
}

function memoryId() {
  return crypto.randomBytes(6).toString('hex');
}

function initAgentmemory() {
  const dir = agentmemoryDir();
  const dbPath = join(dir, 'memory.db');
  ensureDir(dir);
  if (!existsSync(dbPath)) {
    execSync(`sqlite3 "${dbPath}" "CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT, content TEXT, tags TEXT, created_at TEXT, updated_at TEXT);"`, { stdio: 'pipe' });
  }
  return dbPath;
}

// Recall-time cap. Rows are stored whole; cutting on read keeps prompts small.
// The cut is reported via `truncated` rather than silently applied, because a
// truncated row fed back into `remember` would persist a lossy copy forever.
export const CONTENT_CAP = 500;

function truncateContent(content) {
  if (typeof content !== 'string') return { content, truncated: false };
  if (content.length <= CONTENT_CAP) return { content, truncated: false };
  return { content: content.slice(0, CONTENT_CAP), truncated: true };
}

// Tag values may only contain word characters and dashes, so stitching them
// into the WHERE clause cannot break out of the string literal.
function tagClause(tags) {
  const safe = (Array.isArray(tags) ? tags : []).filter(t => typeof t === 'string' && /^[\w-]+$/.test(t));
  if (!safe.length) return '';
  return ` WHERE (${safe.map(t => `',' || tags || ',' LIKE '%,${t},%'`).join(' OR ')})`;
}

export function readAgentmemory(limit = 20, tags = null) {
  const dbPath = join(agentmemoryDir(), 'memory.db');
  if (!existsSync(dbPath)) return [];
  const safeLimit = parseInt(limit, 10) || 20;
  try {
    const rows = execSync(
      `sqlite3 "${dbPath}" ".mode json" "SELECT id, type, content, tags, created_at FROM memories${tagClause(tags)} ORDER BY updated_at DESC LIMIT ${safeLimit};"`,
      { stdio: 'pipe' }
    ).toString().trim();
    if (!rows) return [];
    return JSON.parse(rows).map(r => ({
      source: 'agentmemory',
      id: r.id,
      type: r.type,
      ...truncateContent(r.content),
      tags: r.tags ? r.tags.split(',') : [],
      timestamp: r.created_at,
    }));
  } catch { return []; }
}

export function writeAgentmemory(type, content, tags = []) {
  try {
    const dbPath = initAgentmemory();
    const id = memoryId();
    const now = new Date().toISOString();
    const safeContent = (typeof content === 'string' ? content : JSON.stringify(content)).replace(/'/g, "''");
    const safeTags = tags.join(',').replace(/'/g, "''");
    const safeType = type.replace(/'/g, "''");
    // SQL 走 stdin，不经过 shell。先前的写法把 SQL 包进双引号再交给 Shell，
    // 于是 JSON 内容里的 `"` 被 shell 吃掉（`{"a":1}` 变成 `{a:1}`），`$`/反引号
    // 还会被解释。SQL 层面转义了单引号，却漏了 shell 这一层，写入总是报
    // "unrecognized token"。stdin 让 shell 只看到 `sqlite3 "<db>"`。
    const sql = `INSERT OR REPLACE INTO memories (id, type, content, tags, created_at, updated_at) VALUES ('${id}', '${safeType}', '${safeContent}', '${safeTags}', '${now}', '${now}');`;
    execSync(`sqlite3 "${dbPath}"`, { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });
    return { id, type, ok: true };
  } catch (e) {
    console.error(`  ⚠ agentmemory 写入失败: ${e.message}`);
    return { ok: false };
  }
}

export function getAgentmemoryStats() {
  const dbPath = join(agentmemoryDir(), 'memory.db');
  if (!existsSync(dbPath)) return { count: 0, running: false };
  try {
    const count = parseInt(execSync(
      `sqlite3 "${dbPath}" "SELECT COUNT(*) FROM memories;"`, { stdio: 'pipe' }
    ).toString().trim(), 10) || 0;
    const types = execSync(
      `sqlite3 "${dbPath}" "SELECT DISTINCT type FROM memories;"`, { stdio: 'pipe' }
    ).toString().trim().split('\n').filter(Boolean);
    return { count, types, running: true };
  } catch { return { count: 0, running: false }; }
}
