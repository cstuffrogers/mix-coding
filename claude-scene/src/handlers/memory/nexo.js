import { readFileSync, existsSync, mkdirSync, statSync } from 'fs';
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
