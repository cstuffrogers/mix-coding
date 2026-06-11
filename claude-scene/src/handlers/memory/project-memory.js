import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { MEMORY_DIR } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-utils.js';

function memoryId() {
  return crypto.randomBytes(6).toString('hex');
}

export function loadProjectMemories(type) {
  const dir = join(MEMORY_DIR, type || '');
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

export function loadAllProjectMemories() {
  if (!existsSync(MEMORY_DIR)) return [];
  try {
    return readdirSync(MEMORY_DIR)
      .filter(d => { try { return existsSync(join(MEMORY_DIR, d)) && !d.endsWith('.json'); } catch { return false; } })
      .flatMap(type => loadProjectMemories(type));
  } catch { return []; }
}

export function saveProjectMemory(type, data, meta = {}) {
  ensureDir(join(MEMORY_DIR, type));

  // Dedup: skip if near-identical content saved within last hour for same type
  const existing = loadProjectMemories(type);
  const dataHash = JSON.stringify(data ?? '').slice(0, 200);
  const recent = existing.find(e => {
    if (e.data == null) return false;
    const existingHash = JSON.stringify(e.data).slice(0, 200);
    const isRecent = Date.now() - new Date(e.timestamp).getTime() < 3600000;
    return existingHash === dataHash && isRecent;
  });
  if (recent) {
    return recent; // duplicate, return existing
  }

  const id = memoryId();
  const entry = { ...meta, id, type, data, timestamp: new Date().toISOString() };
  writeFileSync(join(MEMORY_DIR, type, `${id}.json`), JSON.stringify(entry, null, 2), 'utf-8');
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

export function deduplicateProjectMemories() {
  ensureDir(MEMORY_DIR);
  const all = loadAllProjectMemories();
  const seen = new Map();
  let removed = 0;
  for (const mem of all) {
    const key = `${mem.type}::${JSON.stringify(mem.data ?? '').slice(0, 100)}`;
    if (seen.has(key)) {
      try { unlinkSync(join(MEMORY_DIR, mem.type, `${mem.id}.json`)); removed++; }
      catch { /* duplicate file already removed */ }
    } else { seen.set(key, mem); }
  }
  return { total: all.length, removed, kept: seen.size };
}
