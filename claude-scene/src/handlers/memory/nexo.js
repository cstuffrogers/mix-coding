import { readFileSync, existsSync, mkdirSync, statSync, renameSync } from 'fs';
import { join, basename } from 'path';
import { NEXO_DIR } from '../../lib/paths.js';
import { scanDir } from '../../lib/scan-dir.js';
import { writeFileAtomic } from '../../lib/fs-utils.js';
import { normalizeProjectPath, safeTypeName } from './project-scope.js';

// NEXO_DIR is frozen at import time; resolve per call so tests can point it at a
// sandbox instead of the developer's real ~/.nexo.
function nexoDir() {
  return process.env.NEXO_HOME || NEXO_DIR;
}

// 只数文件、不读内容：记忆列表要报「NEXO 全局 N 条」的**总数**，
// 之前拿 readNexoData(5000).length 当总数，超过 5000 就静默少数。
export function countNexoFiles() {
  const runtimeDir = join(nexoDir(), 'runtime');
  if (!existsSync(runtimeDir)) return 0;
  try {
    return scanDir(runtimeDir, { filter: f => /\.(json|md|yml|yaml)$/.test(f) }).length;
  } catch { return 0; }
}

export function readNexoData(limit = 20) {
  if (!existsSync(nexoDir())) return [];
  try {
    const entries = [];
    const runtimeDir = join(nexoDir(), 'runtime');
    if (existsSync(runtimeDir)) {
      // scanDir returns readdir order, which is arbitrary on NTFS. Slicing it
      // before sorting meant recall read 20 random historical events out of
      // hundreds and never the event just written. Sort by mtime first.
      const files = scanDir(runtimeDir, { filter: f => /\.(json|md|yml|yaml)$/.test(f) })
        .map(f => { try { return { f, mtime: statSync(f).mtimeMs }; } catch { return null; } })
        .filter(Boolean)
        .sort((a, b) => b.mtime - a.mtime)
        .map(x => x.f);
      const cap = Number.isFinite(limit) && limit > 0 ? limit : 20;
      for (const f of files.slice(0, cap)) {
        try {
          const content = readFileSync(f, 'utf-8');
          // 截断必须显式：被截断的内容回写成新记忆就把残片固化了。
          const truncated = content.length > 300;
          const file = basename(f);
          const meta = readMeta(content);
          // 优先用事件自己记的 type，旧文件没有才从文件名 `<type>_<ts>.json` 里取。
          // 没有 type 就无法按 category 过滤，category 参数会对这个后端失效。
          const type = meta.type || typeFromFile(file);
          entries.push({ source: 'nexo', file, type, data: meta.data, content: content.slice(0, 300), truncated, length: content.length, projectPath: meta.projectPath });
        } catch { /* skip unreadable */ }
      }
    }
    return entries;
  } catch { return []; }
}

// 事件文件是 {type, timestamp, project?, data}。老文件没有 project 字段，
// 解析失败也按无归属处理（召回时标记出来，而不是静默丢掉）。
function readMeta(content) {
  try {
    const parsed = JSON.parse(content);
    return { projectPath: parsed?.project?.path || '', type: parsed?.type || '', data: parsed?.data };
  } catch { return { projectPath: '', type: '' }; }
}

// 文件名是 `<type>_<ISO 时间戳>.json`，type 本身允许出现下划线，所以不能用
// split('_')[0]（`mobile_review_...` 会被切成 `mobile`）。
function typeFromFile(file) {
  const match = /^(.+?)_\d{4}-\d{2}-\d{2}T[^.]*\./.exec(file);
  return match ? match[1] : '';
}

export function writeNexoEvent(type, data, project = null) {
  try {
    const runtimeDir = join(nexoDir(), 'runtime');
    if (!existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const name = safeTypeName(type);
    const file = join(runtimeDir, `${name}_${ts}.json`);
    const event = { type: name, timestamp: new Date().toISOString(), data };
    // 入库前归一化：同一项目写成 'E:p' 和 'e:/p' 会分裂成两份归属。
    const scopePath = normalizeProjectPath(project?.path);
    if (scopePath) event.project = { path: scopePath, name: project.name || '' };
    writeFileAtomic(file, JSON.stringify(event, null, 2));
    return file;
  } catch { return null; }
}

/**
 * 保留策略：`runtime/` 只留最新的 `maxFiles` 个事件，超过 `maxAgeDays` 的一律
 * 搬到 `archive/`。搬而不是删 —— 这个目录是外部工具也可能在读的落地目录。
 *
 * 旧问题：这个库只增不减（实测 894 个文件），而每次召回都要 `statSync` 整个
 * 目录按 mtime 排序，文件越多召回越慢，且全是过期事件。
 */
export function pruneNexo({ maxFiles = 2000, maxAgeDays = 30 } = {}) {
  const runtimeDir = join(nexoDir(), 'runtime');
  if (!existsSync(runtimeDir)) return { archived: 0 };
  try {
    const files = scanDir(runtimeDir, { filter: f => /\.(json|md|yml|yaml)$/.test(f) })
      .map(f => {
        try { return { f, mtime: statSync(f).mtimeMs }; } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime); // 新 → 旧
    const cutoff = Date.now() - (Number(maxAgeDays) || 30) * 86_400_000;
    const stale = [...files.slice(Number(maxFiles) || 2000), ...files.filter(x => x.mtime < cutoff)];
    const uniq = [...new Map(stale.map(x => [x.f, x])).values()];
    if (!uniq.length) return { archived: 0 };
    const archiveDir = join(nexoDir(), 'archive');
    mkdirSync(archiveDir, { recursive: true });
    let archived = 0;
    for (const { f } of uniq) {
      try {
        // 同名已存在时加 pid 后缀：rename 在 Windows 上会直接覆盖旧归档，
        // 那等于用新文件吃掉历史归档。
        const target = join(archiveDir, basename(f));
        // 用时间戳而不是 pid：同一进程连续两次 prune 也可能撞名，pid 相同就覆盖了。
        const dest = existsSync(target) ? join(archiveDir, `${Date.now()}-${basename(f)}`) : target;
        renameSync(f, dest);
        archived++;
      } catch { /* 文件被删或目标不可写 */ }
    }
    return { archived };
  } catch (e) {
    console.error(`  ⚠ NEXO 保留策略执行失败: ${e.message}（未移动任何文件）`);
    return { archived: 0 };
  }
}
