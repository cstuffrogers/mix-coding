import { existsSync } from 'fs';
import { join } from 'path';
import { CODEGRAPH_DB as DEFAULT_CODEGRAPH_DB } from '../../lib/paths.js';
import { safeExecFile } from '../../lib/safe-exec.js';

// CODEGRAPH_DB 是 import 时冻结的 PROJECT_ROOT/.codegraph/codegraph.db。用
// `--target` 跑别的项目时 PROJECT_ROOT 仍是 cwd，于是召回会把**引擎自己的**
// 符号图当目标项目的代码结构注入 —— 和项目记忆写错项目是同一类错误。
// 所以按调用时的 targetPath 定位，并支持 CODEGRAPH_HOME 覆盖（测试/多库）。
export function codegraphDbPath(targetPath = null) {
  if (process.env.CODEGRAPH_HOME) return join(process.env.CODEGRAPH_HOME, 'codegraph.db');
  if (targetPath) return join(targetPath, '.codegraph', 'codegraph.db');
  return DEFAULT_CODEGRAPH_DB;
}

export function queryCodeGraph(limit = 20, targetPath = null) {
  const dbPath = codegraphDbPath(targetPath);
  if (!existsSync(dbPath)) return { nodes: 0, edges: 0, files: 0, topExports: [] };
  const safeLimit = parseInt(limit, 10) || 20;
  try {
    // 参数数组直传 sqlite3，不拼 shell 字符串（旧写法内容里的 `"` / `$()` 能逃出去）
    const countOf = (table) => parseInt(
      safeExecFile('sqlite3', [dbPath, `SELECT COUNT(*) FROM ${table};`], null, { stdio: 'pipe' }).toString().trim(), 10
    ) || 0;
    const counts = { nodes: countOf('nodes'), edges: countOf('edges'), files: countOf('files') };
    const topExports = safeExecFile(
      'sqlite3',
      [dbPath, `SELECT name, kind, file_path FROM nodes WHERE is_exported=1 ORDER BY name LIMIT ${safeLimit};`],
      null,
      { stdio: 'pipe' }
    ).toString().trim().split('\n').filter(Boolean).map(line => {
      const [name, kind, file_path] = line.split('|');
      return { source: 'codegraph', name, kind, file_path };
    });
    return { ...counts, topExports };
  } catch { return { nodes: 0, edges: 0, files: 0, topExports: [] }; }
}
