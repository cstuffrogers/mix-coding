import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { CODEGRAPH_DB } from '../../lib/paths.js';

export function queryCodeGraph(limit = 20) {
  if (!existsSync(CODEGRAPH_DB)) return { nodes: 0, edges: 0, files: 0, topExports: [] };
  const safeLimit = parseInt(limit, 10) || 20;
  try {
    const counts = {
      nodes: parseInt(execSync(`sqlite3 "${CODEGRAPH_DB}" "SELECT COUNT(*) FROM nodes;"`, { stdio: 'pipe' }).toString().trim(), 10) || 0,
      edges: parseInt(execSync(`sqlite3 "${CODEGRAPH_DB}" "SELECT COUNT(*) FROM edges;"`, { stdio: 'pipe' }).toString().trim(), 10) || 0,
      files: parseInt(execSync(`sqlite3 "${CODEGRAPH_DB}" "SELECT COUNT(*) FROM files;"`, { stdio: 'pipe' }).toString().trim(), 10) || 0,
    };
    const topExports = execSync(
      `sqlite3 "${CODEGRAPH_DB}" "SELECT name, kind, file_path FROM nodes WHERE is_exported=1 ORDER BY name LIMIT ${safeLimit};"`,
      { stdio: 'pipe' }
    ).toString().trim().split('\n').filter(Boolean).map(line => {
      const [name, kind, file_path] = line.split('|');
      return { source: 'codegraph', name, kind, file_path };
    });
    return { ...counts, topExports };
  } catch { return { nodes: 0, edges: 0, files: 0, topExports: [] }; }
}
