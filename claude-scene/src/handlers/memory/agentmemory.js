import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { AGENTMEMORY_DIR } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-utils.js';

function memoryId() {
  return crypto.randomBytes(6).toString('hex');
}

function initAgentmemory() {
  const dbPath = join(AGENTMEMORY_DIR, 'memory.db');
  ensureDir(AGENTMEMORY_DIR);
  if (!existsSync(dbPath)) {
    execSync(`sqlite3 "${dbPath}" "CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT, content TEXT, tags TEXT, created_at TEXT, updated_at TEXT);"`, { stdio: 'pipe' });
  }
  return dbPath;
}

export function readAgentmemory(limit = 20) {
  const dbPath = join(AGENTMEMORY_DIR, 'memory.db');
  if (!existsSync(dbPath)) return [];
  const safeLimit = parseInt(limit, 10) || 20;
  try {
    const rows = execSync(
      `sqlite3 "${dbPath}" ".mode json" "SELECT id, type, content, tags, created_at FROM memories ORDER BY updated_at DESC LIMIT ${safeLimit};"`,
      { stdio: 'pipe' }
    ).toString().trim();
    if (!rows) return [];
    return JSON.parse(rows).map(r => ({
      source: 'agentmemory',
      id: r.id,
      type: r.type,
      content: r.content?.slice(0, 500),
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
    execSync(
      `sqlite3 "${dbPath}" "INSERT OR REPLACE INTO memories (id, type, content, tags, created_at, updated_at) VALUES ('${id}', '${safeType}', '${safeContent}', '${safeTags}', '${now}', '${now}');"`,
      { stdio: 'pipe' }
    );
    return { id, type, ok: true };
  } catch (e) {
    console.error(`  ⚠ agentmemory 写入失败: ${e.message}`);
    return { ok: false };
  }
}

export function getAgentmemoryStats() {
  const dbPath = join(AGENTMEMORY_DIR, 'memory.db');
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
