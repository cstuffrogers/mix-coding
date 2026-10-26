import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { AGENTMEMORY_DIR } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-utils.js';
import { normalizeProjectPath, safeTypeName } from './project-scope.js';

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

// Recall-time cap。写入整份，读时截断，并**明确标记** truncated：静默截断的行
// 一旦被回写成新记忆，就会把残片固化下来。
export const CONTENT_CAP = 500;

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
    // 入库前归一化，读时也归一化：直接调这个函数的人不一定走了 scope.path，
    // 存进去的 'e:/p/' 和 'e:/p' 不归一就会互相看不见（同一项目分裂）。
    const safe = normalizeProjectPath(projectPath).replace(/'/g, "''");
    conditions.push(`(project_path = '${safe}' OR project_path IS NULL OR project_path = '')`);
  }
  if (!conditions.length) return '';
  return ` WHERE (${conditions.map(c => `(${c})`).join(' AND ')})`;
}

// sqlite3 通过管道返回的 JSON 如果超过 execSync 默认的 1MB maxBuffer，
// execSync 会抛 ENOBUFS，而读函数外面是 catch → 返回 []。
// 于是「库里明明有记录，召回却永远是 0 条」——完全静默。两头都堵：
// maxBuffer 放大，并且内容在 SQL 里就截断，输出体积与存储体积无关。
const SQLITE_MAX_BUFFER = 64 * 1024 * 1024;

function sqliteJson(dbPath, sql) {
  return execSync(`sqlite3 "${dbPath}" ".mode json" "${sql}"`, {
    stdio: 'pipe',
    maxBuffer: SQLITE_MAX_BUFFER,
  }).toString().trim();
}

export function readAgentmemory(limit = 20, tags = null, projectPath = null) {
  const dbPath = join(agentmemoryDir(), 'memory.db');
  if (!existsSync(dbPath)) return [];
  const safeLimit = parseInt(limit, 10) || 20;
  try {
    // content 在 SQL 里 substr 截断 + 另外取 length()：原来 SELECT 整列，
    // 存了一条 5MB 的记录就足以把这次读取整体拖进 ENOBUFS。
    const rows = sqliteJson(dbPath,
      `SELECT id, type, substr(content, 1, ${CONTENT_CAP}) AS content, ` +
      `length(content) AS full_len, tags, created_at, project_path FROM memories` +
      `${whereClause(tags, projectPath)} ORDER BY updated_at DESC LIMIT ${safeLimit};`);
    if (!rows) return [];
    return JSON.parse(rows).map(r => ({
      source: 'agentmemory',
      id: r.id,
      type: r.type,
      content: r.content,
      truncated: Number(r.full_len) > CONTENT_CAP,
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
    // type 可能来自场景参数，不一定是字符串。旧实现直接 type.replace 会抛
    // TypeError，被 catch 成 ok:false，于是这一轮静默少了一个后端。
    // 统一过 safeTypeName，和目录名/items.json 用同一套名字。
    const safeType = safeTypeName(type);
    const safeProject = normalizeProjectPath(projectPath).replace(/'/g, "''");
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
      `sqlite3 "${dbPath}" "SELECT COUNT(*) FROM memories;"`,
      { stdio: 'pipe', maxBuffer: SQLITE_MAX_BUFFER }
    ).toString().trim(), 10) || 0;
    const types = execSync(
      `sqlite3 "${dbPath}" "SELECT DISTINCT type FROM memories;"`,
      { stdio: 'pipe', maxBuffer: SQLITE_MAX_BUFFER }
    ).toString().trim().split('\n').filter(Boolean);
    return { count, types, running: true };
  } catch { return { count: 0, running: false }; }
}

/**
 * 三态计数用 SQL 算，不把全库行拉进内存。旧写法 `readAgentmemory(10000)`
 * 再在 JS 里分类：库一大就慢，而且超过 10000 行时数字直接错（还把限额当事实）。
 * 空 projectPath 时不区分「本项目」，全部算作无归属/其他。
 */
export function getAgentmemoryScopeCounts(projectPath = null) {
  const dbPath = join(agentmemoryDir(), 'memory.db');
  if (!existsSync(dbPath)) return { total: 0, project: 0, unscoped: 0, other: 0 };
  const safe = normalizeProjectPath(projectPath).replace(/'/g, "''");
  try {
    const out = sqliteJson(dbPath,
      `SELECT COUNT(*) AS total, ` +
      `SUM(CASE WHEN project_path = '${safe}' THEN 1 ELSE 0 END) AS mine, ` +
      `SUM(CASE WHEN project_path IS NULL OR project_path = '' THEN 1 ELSE 0 END) AS unscoped FROM memories;`);
    const [row] = JSON.parse(out || '[{}]');
    const total = row?.total || 0;
    const project = safe ? row?.mine || 0 : 0;
    const unscoped = row?.unscoped || 0;
    return { total, project, unscoped, other: Math.max(0, total - project - unscoped) };
  } catch { return { total: 0, project: 0, unscoped: 0, other: 0 }; }
}
