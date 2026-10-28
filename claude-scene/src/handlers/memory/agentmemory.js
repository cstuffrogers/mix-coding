import { existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { AGENTMEMORY_DIR } from '../../lib/paths.js';
import { ensureDir, writeFileAtomic } from '../../lib/fs-utils.js';
import { safeExecFile } from '../../lib/safe-exec.js';
import { normalizeProjectPath, safeTypeName, DEDUPE_WINDOW_MS } from './project-scope.js';

// AGENTMEMORY_DIR is a module-level constant, so it is frozen at import time and
// an env override set later never takes effect. Resolve per call instead, so
// tests (and multi-home setups) can redirect the store without touching the
// developer's real ~/.agentmemory database.
export function agentmemoryDir() {
  return process.env.AGENTMEMORY_HOME || AGENTMEMORY_DIR;
}

function memoryId() {
  return crypto.randomBytes(6).toString('hex');
}

// sqlite 一律走 safeExecFile + 参数数组：不再拼 shell 字符串。
// 旧写法 `sqlite3 "${dbPath}" "${sql}"` 把 SQL 包进双引号交给 shell，
// 记忆内容里的 `"` / `` ` `` / `$()` 都能逃出双引号执行任意命令。
function sqlite(dbPath, args, opts = {}) {
  return safeExecFile('sqlite3', [dbPath, ...args], null, { stdio: 'pipe', ...opts });
}

function initAgentmemory() {
  const dir = agentmemoryDir();
  const dbPath = join(dir, 'memory.db');
  ensureDir(dir);
  if (!existsSync(dbPath)) {
    sqlite(dbPath, ['CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT, content TEXT, tags TEXT, created_at TEXT, updated_at TEXT, project_path TEXT);']);
  }
  ensureProjectColumn(dbPath);
  return dbPath;
}

// 存量库是在没有 project_path 列的时候建的。ALTER TABLE 不能重复加同名列，
// 所以先查 pragma；老行该列为 NULL，召回时按「无归属」处理（不静默丢）。
function ensureProjectColumn(dbPath) {
  try {
    const cols = new Set(sqlite(dbPath, ["SELECT name FROM pragma_table_info('memories');"])
      .toString().split('\n').map(s => s.trim()).filter(Boolean));
    if (!cols.has('project_path')) {
      sqlite(dbPath, ['ALTER TABLE memories ADD COLUMN project_path TEXT;']);
    }
    // 内容指纹列：写入去重用。历史行是 NULL，比较时自然不命中。
    if (!cols.has('content_hash')) {
      sqlite(dbPath, ['ALTER TABLE memories ADD COLUMN content_hash TEXT;']);
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

// sqlite3 通过管道返回的 JSON 如果超过默认的 1MB maxBuffer，会抛 ENOBUFS，
// 而读函数外面是 catch → 返回 []。
// 于是「库里明明有记录，召回却永远是 0 条」——完全静默。两头都堵：
// maxBuffer 放大，并且内容在 SQL 里就截断，输出体积与存储体积无关。
const SQLITE_MAX_BUFFER = 64 * 1024 * 1024;

function sqliteJson(dbPath, sql) {
  return sqlite(dbPath, ['.mode json', sql], { maxBuffer: SQLITE_MAX_BUFFER }).toString().trim();
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

export function writeAgentmemory(type, content, tags = [], projectPath = '', options = {}) {
  try {
    const dbPath = initAgentmemory();
    const id = memoryId();
    const now = new Date().toISOString();
    const safeContent = (typeof content === 'string' ? content : JSON.stringify(content)).replace(/'/g, "''");
    // 默认参数只兜 undefined，传 null 时 tags.join 会抛，整条写入静默失败。
    const safeTags = (Array.isArray(tags) ? tags : []).join(',').replace(/'/g, "''");
    // type 可能来自场景参数，不一定是字符串。旧实现直接 type.replace 会抛
    // TypeError，被 catch 成 ok:false，于是这一轮静默少了一个后端。
    // 统一过 safeTypeName，和目录名/items.json 用同一套名字。
    const safeType = safeTypeName(type);
    const safeProject = normalizeProjectPath(projectPath).replace(/'/g, "''");
    // SQL 走 stdin，不经过 shell。先前的写法把 SQL 包进双引号再交给 Shell，
    // 于是 JSON 内容里的 `"` 被 shell 吃掉（`{"a":1}` 变成 `{a:1}`），`$`/反引号
    // 还会被解释。SQL 层面转义了单引号，却漏了 shell 这一层，写入总是报
    // "unrecognized token"。stdin 让 shell 只看到 `sqlite3 "<db>"`。
    // 同 type + 同项目 + 同内容指纹的旧行还在就不再插一份。判重必须在 SQL 里做：
    // 召回侧读的是截断后的 content，JS 比对会误判（前 500 字相同、后面不同）。
    const fingerprint = options.fingerprint || '';
    if (fingerprint) {
      // created_at 存的是 ISO 串，字典序比较即时间序，窗口也能下推到 SQL。
      const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
      const dup = sqlite(dbPath, [
        `SELECT COUNT(*) FROM memories WHERE content_hash = '${fingerprint}' AND type = '${safeType}' AND project_path = '${safeProject}' AND created_at >= '${cutoff}';`,
      ], { maxBuffer: SQLITE_MAX_BUFFER }).toString().trim();
      if (Number(dup) > 0) return { skipped: true, ok: true };
    }
    const sql = `INSERT OR REPLACE INTO memories (id, type, content, tags, created_at, updated_at, project_path, content_hash) VALUES ('${id}', '${safeType}', '${safeContent}', '${safeTags}', '${now}', '${now}', '${safeProject}', '${fingerprint}');`;
    safeExecFile('sqlite3', [dbPath], null, { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });
    return { id, type, ok: true, skipped: false };
  } catch (e) {
    console.error(`  ⚠ agentmemory 写入失败: ${e.message}`);
    return { ok: false };
  }
}

export function getAgentmemoryStats() {
  const dbPath = join(agentmemoryDir(), 'memory.db');
  if (!existsSync(dbPath)) return { count: 0, ok: false };
  try {
    const count = parseInt(sqlite(dbPath, ['SELECT COUNT(*) FROM memories;'], { maxBuffer: SQLITE_MAX_BUFFER })
      .toString().trim(), 10) || 0;
    const types = sqlite(dbPath, ['SELECT DISTINCT type FROM memories;'], { maxBuffer: SQLITE_MAX_BUFFER })
      .toString().trim().split('\n').filter(Boolean);
    return { count, types, ok: true };
  } catch { return { count: 0, ok: false }; }
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

/**
 * 保留策略：每类只留最新 maxPerType 条，另外超过 maxAgeDays 的一律下架。
 *
 * 下架 = 先整行导出到 `<home>/archive/agentmemory-<ts>.jsonl`，再从表里 DELETE。
 * 旧问题：这个库只增不减，写入还是整份内容（不截断），跑久了就是几十 MB 的
 * 死数据躺在召回热路径上。删除前必须留底 —— 直接 DELETE 等于静默删用户记忆。
 */
export function pruneAgentmemory({ maxPerType = 200, maxAgeDays = 365 } = {}) {
  const dbPath = join(agentmemoryDir(), 'memory.db');
  if (!existsSync(dbPath)) return { archived: 0, byType: {} };
  try {
    const types = sqlite(dbPath, ['SELECT DISTINCT type FROM memories;'], { maxBuffer: SQLITE_MAX_BUFFER })
      .toString().trim().split('\n').map(s => s.trim()).filter(Boolean);
    const stale = [];
    for (const type of types) {
      // 不能拿 safeTypeName(type) 当 WHERE 条件：写入侧确实会归一化，但历史行
      // （别的工具写的）可能存着 `Security Audit`，归一化后的名字匹配不上，
      // 这些行就永远不会被按类型裁剪。改成对原始值做 SQL 转义。
      const literal = String(type).replace(/'/g, "''");
      const rows = sqliteJson(dbPath,
        `SELECT id, type, content, tags, created_at, project_path FROM memories ` +
        `WHERE type = '${literal}' ORDER BY created_at DESC LIMIT -1 OFFSET ${Number(maxPerType) || 200};`);
      if (rows) stale.push(...JSON.parse(rows));
    }
    const cutoff = new Date(Date.now() - (Number(maxAgeDays) || 365) * 86_400_000).toISOString();
    const old = sqliteJson(dbPath,
      `SELECT id, type, content, tags, created_at, project_path FROM memories ` +
      `WHERE created_at IS NOT NULL AND created_at < '${cutoff}';`);
    if (old) stale.push(...JSON.parse(old));
    const uniq = [...new Map(stale.map(r => [r.id, r])).values()];
    if (!uniq.length) return { archived: 0, byType: {} };
    // 留底失败就不删。归档是「删除前的唯一证据」，写不进去还照删等于静默丢数据。
    if (!archiveAgentmemoryRows(uniq)) return { archived: 0, byType: {} };
    // id 是本进程生成的 hex，但仍然做一次白名单过滤再拼进 SQL
    const ids = uniq.map(r => String(r.id)).filter(id => /^[\w-]+$/.test(id)).map(id => `'${id}'`).join(',');
    if (ids) safeExecFile('sqlite3', [dbPath], null, { input: `DELETE FROM memories WHERE id IN (${ids});`, stdio: ['pipe', 'pipe', 'pipe'] });
    const byType = {};
    for (const row of uniq) byType[row.type || 'unknown'] = (byType[row.type || 'unknown'] || 0) + 1;
    return { archived: uniq.length, byType };
  } catch (e) {
    // 静默返回 0 会让「保留策略从来没生效」永远看不出来。
    console.error(`  ⚠ agentmemory 保留策略执行失败: ${e.message}（未删除任何记录）`);
    return { archived: 0, byType: {} };
  }
}

function archiveAgentmemoryRows(rows) {
  try {
    const dir = join(agentmemoryDir(), 'archive');
    ensureDir(dir);
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const file = join(dir, `agentmemory-${stamp}.jsonl`);
    writeFileAtomic(file, rows.map(r => JSON.stringify({ ...r, archived_at: new Date().toISOString() })).join('\n') + '\n');
    return existsSync(file);
  } catch { return false; }
}
