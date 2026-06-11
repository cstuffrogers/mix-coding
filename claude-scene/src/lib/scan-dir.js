import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);

export function scanDir(rootDir, { filter, onError } = {}) {
  const results = [];
  const walk = (dir) => {
    try {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') || EXCLUDED_DIRS.has(entry)) continue;
        const fullPath = join(dir, entry);
        let stat;
        try { stat = statSync(fullPath); } catch { continue; }
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (!filter || filter(fullPath)) {
          results.push(fullPath);
        }
      }
    } catch (err) {
      if (onError) onError(dir, err);
    }
  };
  walk(rootDir);
  return results;
}
