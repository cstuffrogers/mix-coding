import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { NEXO_DIR } from '../../lib/paths.js';
import { scanDir } from '../../lib/scan-dir.js';

export function readNexoData() {
  if (!existsSync(NEXO_DIR)) return [];
  try {
    const entries = [];
    const runtimeDir = join(NEXO_DIR, 'runtime');
    if (existsSync(runtimeDir)) {
      const files = scanDir(runtimeDir, { filter: f => /\.(json|md|yml|yaml)$/.test(f) });
      for (const f of files.slice(0, 20)) {
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
    const runtimeDir = join(NEXO_DIR, 'runtime');
    if (!existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(runtimeDir, `${type}_${ts}.json`);
    writeFileSync(file, JSON.stringify({ type, timestamp: new Date().toISOString(), data }, null, 2), 'utf-8');
    return file;
  } catch { return null; }
}
