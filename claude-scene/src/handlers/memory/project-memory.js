import { readFileSync, existsSync, readdirSync, unlinkSync, statSync, renameSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { MEMORY_DIR } from '../../lib/paths.js';
import { ensureDir, writeFileAtomic, withFileLock } from '../../lib/fs-utils.js';
import { safeTypeName, contentFingerprint } from './project-scope.js';

// MEMORY_DIR 是 import 时冻结的常量（= PROJECT_ROOT/.claude/memory）。用 --target
// 跑别的项目时 PROJECT_ROOT 仍是 cwd，项目记忆就会写进引擎目录而不是目标项目 ——
// 下次真 cd 到那个项目反而读不到。所以每个入口都按调用时的 rootDir 现算。
function memoryRoot(rootDir) {
  return rootDir ? join(rootDir, '.claude', 'memory') : MEMORY_DIR;
}

function memoryId() {
  return crypto.randomBytes(6).toString('hex');
}

// 去重必须看**完整内容**。旧实现拿 JSON 前 200 字符当指纹，而两次审查的前
// 200 字符几乎一样（`{"findings":{"security":...`），于是第二次被当成重复静默
// 丢弃，`context.last_memory_id` 还指回上一条 —— 报告说「已保存」，实际什么都没写。
//
// 但「完整」不等于「逐字节」：autoRemember 的 data 每轮都带新 timestamp，
// 逐字节比对永远判不出重复，于是每跑一次场景就多一条内容一样的项目记忆。
// 指纹统一走 contentFingerprint（结构化规范化 + 忽略易变字段）。
export function contentHash(value) {
  return contentFingerprint(value);
}

export function loadProjectMemories(type, rootDir = null) {
  const dir = join(memoryRoot(rootDir), safeTypeName(type));
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  } catch { return []; }
}

export function loadAllProjectMemories(rootDir = null) {
  const root = memoryRoot(rootDir);
  if (!existsSync(root)) return [];
  try {
    return readdirSync(root)
      .filter(d => {
        if (d.startsWith('.')) return false; // .archive 之类的内部目录不是记忆类型
        try { return statSync(join(root, d)).isDirectory(); } catch { return false; }
      })
      .flatMap(type => loadProjectMemories(type, rootDir));
  } catch { return []; }
}

export function saveProjectMemory(type, data, meta = {}, rootDir = null) {
  const kind = safeTypeName(type);
  const dir = join(memoryRoot(rootDir), kind);
  ensureDir(dir);

  // 同类型、1 小时内、**完整内容**相同才算重复。
  const dataHash = contentHash(data);
  const existing = loadProjectMemories(kind, rootDir);
  const recent = existing.find(e => {
    if (e.data == null) return false;
    const isRecent = Date.now() - new Date(e.timestamp).getTime() < 3600000;
    return isRecent && contentHash(e.data) === dataHash;
  });
  if (recent) {
    // 标出来，让调用方如实说「命中相同内容」而不是假装又写了一份。
    return { ...recent, duplicate: true };
  }

  const id = memoryId();
  const entry = { ...meta, id, type: kind, data, timestamp: new Date().toISOString() };
  writeFileAtomic(join(dir, `${id}.json`), JSON.stringify(entry, null, 2));
  return entry;
}

// 单个字段是否命中。
// 旧实现只认 RegExp / 字符串 / 严格相等，而场景里的 filters.type 是**数组**
// （`["review","quality","security"]`），`memVal === val` 永远为 false —— 于是
// 24 个场景里有 19 个的召回步骤恒返 0 条：记忆一直在写、从来没被读过。
function valueMatches(memVal, val) {
  if (val instanceof RegExp) return val.test(String(memVal ?? ''));
  if (Array.isArray(val)) return val.length === 0 ? true : val.some(item => valueMatches(memVal, item));
  // 这条记录本身没这个字段（比如 codegraph 摘要）时不能判否，否则一整类来源
  // 会因为「没有 type」而被静默排除。
  if (memVal === undefined || memVal === null) return true;
  if (typeof val === 'string') return String(memVal).includes(val);
  return memVal === val;
}

export function matchFilter(memory, filters) {
  if (!filters) return true;
  return Object.entries(filters).every(([key, val]) => {
    const memVal = memory.data?.[key] ?? memory[key] ?? (key === 'type' ? memory.category : undefined);
    return valueMatches(memVal, val);
  });
}

// 去重是**删除文件**，指纹错一次就是删用户数据。旧实现用 JSON 前 100 字符，
// 实测把 3 条内容不同的记忆删成 1 条。现在按完整 hash 分组，并保留每组最新的
// 那条（先按 timestamp 倒序，遇到重复就删后来的那个）。
// data 为空的历史条目一律不动 —— 没有内容可比，删就是赌。
export function deduplicateProjectMemories(rootDir = null) {
  const root = memoryRoot(rootDir);
  ensureDir(root);
  const all = [...loadAllProjectMemories(rootDir)]
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const seen = new Map();
  let removed = 0;
  let skipped = 0;
  for (const mem of all) {
    if (mem.data == null) { skipped++; continue; }
    const key = `${mem.type}::${contentHash(mem.data)}`;
    if (seen.has(key)) {
      // 内容完全相同的重复件。即使如此也归档而不是删：
      // 「去重」错了就是不可逆的数据丢失，而归档体量很小。
      const from = join(root, safeTypeName(mem.type), `${mem.id}.json`);
      const to = join(root, '.archive', safeTypeName(mem.type), `${mem.id}.json`);
      try {
        ensureDir(join(root, '.archive', safeTypeName(mem.type)));
        renameSync(from, to);
        removed++;
      } catch {
        try { unlinkSync(from); removed++; } catch { /* 已经被删掉或文件不存在 */ }
      }
    } else { seen.set(key, mem); }
  }
  return { total: all.length, removed, kept: seen.size + skipped, skipped };
}

/**
 * 保留策略：每个类型只留最新的 maxPerType 条，其余搬进 `<root>/.archive/<type>/`。
 *
 * 项目记忆是「每次场景跑一遍写一条」，不设上限就是无限增长（旧库实测 rollup
 * 到几百条全是空壳自动摘要）。这里**只搬不删**：`loadAllProjectMemories` 跳过
 * 点开头目录，所以归档件不会进召回，但用户仍能找到。
 */
export function pruneProjectMemories(rootDir = null, { maxPerType = 300 } = {}) {
  const root = memoryRoot(rootDir);
  if (!existsSync(root)) return { archived: 0, types: [] };
  const lock = join(root, '.prune.lock');
  return withFileLock(lock, () => {
    let archived = 0;
    const types = [];
    let dirs;
    try {
      dirs = readdirSync(root).filter(d => !d.startsWith('.') && statSync(join(root, d)).isDirectory());
    } catch { return { archived: 0, types: [] }; }
    for (const type of dirs) {
      const dir = join(root, type);
      const all = loadProjectMemories(type, rootDir); // 已按 timestamp 倒序
      if (all.length <= maxPerType) continue;
      const stale = all.slice(maxPerType);
      const archiveDir = join(root, '.archive', safeTypeName(type));
      ensureDir(archiveDir);
      for (const mem of stale) {
        try {
          renameSync(join(dir, `${mem.id}.json`), join(archiveDir, `${mem.id}.json`));
          archived++;
        } catch { /* 文件可能已被别处清理 */ }
      }
      types.push(type);
    }
    return { archived, types };
  });
}
