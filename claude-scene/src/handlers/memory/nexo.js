import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { NEXO_DIR } from '../../lib/paths.js';
import { scanDir } from '../../lib/scan-dir.js';

// NEXO_DIR is frozen at import time; resolve per call so tests can point it at a
// sandbox instead of the developer's real ~/.nexo.
function nexoDir() {
  return process.env.NEXO_HOME || NEXO_DIR;
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
          entries.push({ source: 'nexo', file: basename(f), content: content.slice(0, 300) });
        } catch { /* skip unreadable */ }
      }
    }
    return entries;
  } catch { return []; }
}

export function writeNexoEvent(type, data) {
  try {
    const runtimeDir = join(nexoDir(), 'runtime');
    if (!existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(runtimeDir, `${type}_${ts}.json`);
    writeFileSync(file, JSON.stringify({ type, timestamp: new Date().toISOString(), data }, null, 2), 'utf-8');
    return file;
  } catch { return null; }
}
