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
    execSync(`sqlite3 "${dbPath}" "CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT, content TEXT, tags TEXT, created_at TEXT, updated_at TEXT, project_path TEXT);"`, { stdio: 'pipe' });
  }
  ensureProjectColumn(dbPath);
  return dbPath;
}

// 存量库是在没有 project_path 列的时候建的。ALTER TABLE 不能重复加同名列，
// 所以先查 pragma；老行该列为 NULL，召回时按「无归属」处理（不静默丢）。
function ensureProjectColumn(dbPath) {
  try {
    const cols = execSync(`sqlite3 "${dbPath}" "SELECT name FROM pragma_table_info('memories');"`, { stdio: 'pipe' })
      .toString().split('\n').map(s => s.trim()).filter(Boolean);
    if (!cols.includes('project_path')) {
      execSync(`sqlite3 "${dbPath}" "ALTER TABLE memories ADD COLUMN project_path TEXT;"`, { stdio: 'pipe' });
    }
  } catch { /* 迁移失败不阻断写入：宁可无归属，也不要丢数据 */ }
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

// 项目过滤：本项目 + 无归属（历史）行。别的项目默认不进召回，避免把
// A 项目的审查结论当 B 项目的上下文。projectPath 已在 normalizeProjectPath
// 里去掉引号风险，这里保守地再做一次单引号转义。
function whereClause(tags, projectPath) {
  const conditions = [];
  const tagPart = tagClause(tags);
  if (tagPart) conditions.push(tagPart.replace(/^ WHERE /, ''));
  if (projectPath) {
    const safe = String(projectPath).replace(/'/g, "''");
    conditions.push(`(project_path = '${safe}' OR project_path IS NULL OR project_path = '')`);
  }
  if (!conditions.length) return '';
  return ` WHERE (${conditions.map(c => `(${c})`).join(' AND ')})`;
}

export function readAgentmemory(limit = 20, tags = null, projectPath = null) {
  const dbPath = join(agentmemoryDir(), 'memory.db');
  if (!existsSync(dbPath)) return [];
  const safeLimit = parseInt(limit, 10) || 20;
  try {
    const rows = execSync(
      `sqlite3 "${dbPath}" ".mode json" "SELECT id, type, content, tags, created_at, project_path FROM memories${whereClause(tags, projectPath)} ORDER BY updated_at DESC LIMIT ${safeLimit};"`,
      { stdio: 'pipe' }
    ).toString().trim();
    if (!rows) return [];
    return JSON.parse(rows).map(r => ({
      source: 'agentmemory',
      id: r.id,
      type: r.type,
      ...truncateContent(r.content),
      tags: r.tags ? r.tags.split(',') : [],
      projectPath: r.project_path || '',
      timestamp: r.created_at,
    }));
  } catch { return []; }
}

export function writeAgentmemory(type, content, tags = [], projectPath = '') {
  try {
    const dbPath = initAgentmemory();
    const id = memoryId();
    const now = new Date().toISOString();
    const safeContent = (typeof content === 'string' ? content : JSON.stringify(content)).replace(/'/g, "''");
    const safeTags = tags.join(',').replace(/'/g, "''");
    const safeType = type.replace(/'/g, "''");
    const safeProject = String(projectPath || '').replace(/'/g, "''");
    // SQL 走 stdin，不经过 shell。先前的写法把 SQL 包进双引号再交给 Shell，
    // 于是 JSON 内容里的 `"` 被 shell 吃掉（`{"a":1}` 变成 `{a:1}`），`$`/反引号
    // 还会被解释。SQL 层面转义了单引号，却漏了 shell 这一层，写入总是报
    // "unrecognized token"。stdin 让 shell 只看到 `sqlite3 "<db>"`。
    const sql = `INSERT OR REPLACE INTO memories (id, type, content, tags, created_at, updated_at, project_path) VALUES ('${id}', '${safeType}', '${safeContent}', '${safeTags}', '${now}', '${now}', '${safeProject}');`;
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
