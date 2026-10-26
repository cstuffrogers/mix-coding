import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { MEMORY_DIR } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-utils.js';
import { safeTypeName } from './project-scope.js';

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
export function contentHash(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
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
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(entry, null, 2), 'utf-8');
  return entry;
}

export function matchFilter(memory, filters) {
  if (!filters) return true;
  return Object.entries(filters).every(([key, val]) => {
    const memVal = memory.data?.[key] ?? memory[key];
    if (val instanceof RegExp) return val.test(String(memVal));
    if (typeof val === 'string') return String(memVal).includes(val);
    return memVal === val;
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
      try { unlinkSync(join(root, safeTypeName(mem.type), `${mem.id}.json`)); removed++; }
      catch { /* 已经被删掉或文件不存在 */ }
    } else { seen.set(key, mem); }
  }
  return { total: all.length, removed, kept: seen.size + skipped, skipped };
}
