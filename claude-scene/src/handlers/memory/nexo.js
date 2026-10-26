import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { NEXO_DIR } from '../../lib/paths.js';
import { scanDir } from '../../lib/scan-dir.js';
import { normalizeProjectPath, safeTypeName } from './project-scope.js';

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
          // 截断必须显式：被截断的内容回写成新记忆就把残片固化了。
          const truncated = content.length > 300;
          entries.push({ source: 'nexo', file: basename(f), content: content.slice(0, 300), truncated, length: content.length, projectPath: readProjectPath(content) });
        } catch { /* skip unreadable */ }
      }
    }
    return entries;
  } catch { return []; }
}

// 事件文件是 {type, timestamp, project?, data}。老文件没有 project 字段，
// 解析失败也按无归属处理（召回时标记出来，而不是静默丢掉）。
function readProjectPath(content) {
  try {
    const parsed = JSON.parse(content);
    return parsed?.project?.path || '';
  } catch { return ''; }
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
    writeFileSync(file, JSON.stringify(event, null, 2), 'utf-8');
    return file;
  } catch { return null; }
}
