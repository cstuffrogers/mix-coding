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

// Each entry: [regex, extractor] where extractor(m) returns the call to push.
const CALL_PATTERNS = [
  [/fetch\s*\(\s*`?["']([^"'`]+)["'`]/g, m => parseCallFromUrl(m[1], 'GET')],
  [/fetch\s*\([^,]+,\s*\{[^}]*method\s*:\s*["']([^"']+)["'][^}]*\}/g, (m, content, start) => {
    const urlM = content.slice(start, start + 200).match(/fetch\s*\(\s*`?["']([^"'`]+)["'`]/);
    return urlM ? parseCallFromUrl(urlM[1], m[1].toUpperCase()) : null;
  }],
  [/axios\.(get|post|put|delete|patch)\s*\(\s*`?["']([^"'`]+)["'`]/g, m => parseCallFromUrl(m[2], m[1].toUpperCase())],
  [/use(?:Query|Mutation)\s*\(\s*\{[^}]*url\s*:\s*["']([^"']+)["'][^}]*method\s*:\s*["']([^"']+)["']/g, m => parseCallFromUrl(m[1], m[2].toUpperCase())],
  [/use(?:Query|Mutation)\s*\(\s*\{[^}]*url\s*:\s*`([^`]+)`[^}]*\}/g, m => parseCallFromUrl(m[1], 'GET')],
  [/(?:ky|got|ofetch)\s*\(\s*["']([^"']+)["']/g, m => parseCallFromUrl(m[1], 'GET')],
  [/hx-(get|post|put|delete|patch)\s*=\s*["']([^"']+)["']/gi, m => parseCallFromUrl(m[2], m[1].toUpperCase())],
];

function extractCallsFromFile(f, calls) {
  let content;
  try { content = readFileSync(f, 'utf-8'); } catch { return; }

  for (const [re, extractor] of CALL_PATTERNS) {
    for (const m of content.matchAll(re)) {
      const call = extractor(m, content, Math.max(0, m.index));
      if (call) calls.push(call);
    }
  }

  const normalizedPath = f.replace(/\\/g, '/');
  const isApiRouteFile = /\/(?:app|pages)\/api\//.test(normalizedPath);
  if (!isApiRouteFile) {
    for (const m of content.matchAll(/\/api\/[\w/-]+/g)) {
      if (calls.every(c => !c.path.includes(m[0]))) {
        calls.push({ method: 'GET', path: m[0], bodyFields: [] });
      }
    }
  }
}
