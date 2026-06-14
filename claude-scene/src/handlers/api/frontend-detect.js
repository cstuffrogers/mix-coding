import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { scanDir } from '../../lib/scan-dir.js';
import { normalizePath } from './spec-utils.js';

export function findFrontendDir(root) {
  const candidates = ['src', 'app', 'pages', 'components', 'frontend', 'client', 'web'];
  for (const dir of candidates) {
    const full = join(root, dir);
    if (existsSync(full)) return full;
  }
  return existsSync(join(root, 'package.json')) ? root : null;
}

const BACKEND_DIRS = new Set(['server', 'api', 'routes', 'controllers', 'services', 'middleware', 'handlers']);

function isBackendFile(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.some(p => BACKEND_DIRS.has(p)) ||
    /\.(controller|service|route|middleware|handler)\.(ts|js)x?$/.test(filePath);
}

export async function detectFrontendApiCalls(frontendDir) {
  const sourceFiles = scanDir(frontendDir, {
    filter: f => /\.(tsx?|jsx?|vue|svelte)$/.test(f)
      && !f.includes('node_modules')
      && !f.includes('.test.')
      && !f.includes('.spec.'),
  });
  const toScan = sourceFiles.slice(0, 200);
  const calls = [];

  for (const f of toScan) {
    if (isBackendFile(f)) continue;
    extractCallsFromFile(f, calls);
  }

  const seen = new Set();
  return calls.filter(c => {
    const key = `${c.method}:${normalizePath(c.path)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseCallFromUrl(url, method) {
  let path = url;
  try {
    const u = new globalThis.URL(url, 'http://localhost');
    path = u.pathname;
  } catch { /* relative path */ }
  const qIdx = path.indexOf('?');
  if (qIdx !== -1) path = path.slice(0, qIdx);
  return { method: method || 'GET', path, bodyFields: [] };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function extractCallsFromFile(f, calls) {
  let content;
  try { content = readFileSync(f, 'utf-8'); } catch { return; }

  for (const m of content.matchAll(/fetch\s*\(\s*`?["']([^"'`]+)["'`]/g)) {
    calls.push(parseCallFromUrl(m[1], 'GET'));
  }
  for (const m of content.matchAll(/fetch\s*\([^,]+,\s*\{[^}]*method\s*:\s*["']([^"']+)["'][^}]*\}/g)) {
    const start = Math.max(0, m.index);
    const urlM = content.slice(start, start + 200).match(/fetch\s*\(\s*`?["']([^"'`]+)["'`]/);
    if (urlM) calls.push(parseCallFromUrl(urlM[1], m[1].toUpperCase()));
  }
  for (const m of content.matchAll(/axios\.(get|post|put|delete|patch)\s*\(\s*`?["']([^"'`]+)["'`]/g)) {
    calls.push(parseCallFromUrl(m[2], m[1].toUpperCase()));
  }
  for (const m of content.matchAll(/use(?:Query|Mutation)\s*\(\s*\{[^}]*url\s*:\s*["']([^"']+)["'][^}]*method\s*:\s*["']([^"']+)["']/g)) {
    calls.push(parseCallFromUrl(m[1], m[2].toUpperCase()));
  }
  for (const m of content.matchAll(/use(?:Query|Mutation)\s*\(\s*\{[^}]*url\s*:\s*`([^`]+)`[^}]*\}/g)) {
    calls.push(parseCallFromUrl(m[1], 'GET'));
  }
  for (const m of content.matchAll(/(?:ky|got|ofetch)\s*\(\s*["']([^"']+)["']/g)) {
    calls.push(parseCallFromUrl(m[1], 'GET'));
  }
  for (const m of content.matchAll(/hx-(get|post|put|delete|patch)\s*=\s*["']([^"']+)["']/gi)) {
    calls.push(parseCallFromUrl(m[2], m[1].toUpperCase()));
  }
  const normalizedPath = f.replace(/\\/g, '/');
  const isApiRouteFile = /\/(?:app|pages)\/api\//.test(normalizedPath);
  if (!isApiRouteFile) {
    for (const m of content.matchAll(/\/api\/[\w/-]+/g)) {
      if (!calls.some(c => c.path.includes(m[0]))) {
        calls.push({ method: 'GET', path: m[0], bodyFields: [] });
      }
    }
  }
}
