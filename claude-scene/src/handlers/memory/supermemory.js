import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { PROJECT_ROOT } from '../../lib/paths.js';

// Supermemory client instance (lazy init)
let _client = null;
let _initError = null;
let _cachedProjectName = null;

function getApiKey() {
  return process.env.SUPERMEMORY_API_KEY || null;
}

function getProjectName() {
  if (_cachedProjectName) return _cachedProjectName;
  try {
    const pkgPath = join(PROJECT_ROOT, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      _cachedProjectName = pkg.name || 'mix-coding';
      return _cachedProjectName;
    }
  } catch { /* no package.json */ }
  _cachedProjectName = 'mix-coding';
  return _cachedProjectName;
}

// Map our internal memory types to Supermemory containerTags
function containerTag(type) {
  const project = getProjectName();
  return `${project}/${type || 'general'}`;
}

async function initClient() {
  if (_client) return _client;
  if (_initError) return null;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    // eslint-disable-next-line import/no-unresolved
    const mod = await import('supermemory');
    const Supermemory = mod.default;
    _client = new Supermemory({ apiKey });
    return _client;
  } catch (e) {
    _initError = e.message;
    console.error(`  ⚠ Supermemory SDK 初始化失败: ${e.message}`);
    return null;
  }
}

function isAvailable() {
  return !!getApiKey() && !_initError;
}

// ── Recall ──────────────────────────────────────────────────────────
export async function recallFromSupermemory({ type, query, limit = 10 }) {
  if (!isAvailable()) return [];

  const client = await initClient();
  if (!client) return [];

  try {
    const tag = containerTag(type);

    const [profileResult, searchResult] = await Promise.allSettled([
      client.profile({ containerTag: tag }),
      client.search.memories({
        q: query || '',
        containerTag: tag,
        searchMode: 'memories',
        limit,
      }),
    ]);

    const results = [];

    if (profileResult.status === 'fulfilled' && profileResult.value?.profile) {
      const p = profileResult.value.profile;
      if (p.static?.length) {
        results.push({
          source: 'supermemory',
          kind: 'profile-static',
          type,
          data: p.static,
          timestamp: new Date().toISOString(),
        });
      }
      if (p.dynamic?.length) {
        results.push({
          source: 'supermemory',
          kind: 'profile-dynamic',
          type,
          data: p.dynamic,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (searchResult.status === 'fulfilled' && searchResult.value?.length) {
      for (const mem of searchResult.value) {
        results.push({
          source: 'supermemory',
          kind: 'memory',
          type,
          id: mem.id,
          data: mem.content || mem.text,
          score: mem.score,
          timestamp: mem.createdAt || new Date().toISOString(),
        });
      }
    }

    return results;
  } catch (e) {
    console.error(`  ⚠ Supermemory 召回失败: ${e.message}`);
    return [];
  }
}

// ── Remember ─────────────────────────────────────────────────────────
export async function saveToSupermemory(type, data) {
  if (!isAvailable()) return null;

  const client = await initClient();
  if (!client) return null;

  try {
    const content = typeof data === 'string' ? data : JSON.stringify(data);

    const result = await client.add({
      content,
      containerTag: containerTag(type),
    });

    return { id: result?.id, type, ok: true };
  } catch (e) {
    console.error(`  ⚠ Supermemory 保存失败: ${e.message}`);
    return null;
  }
}

// ── Health check ────────────────────────────────────────────────────
export function supermemoryStatus() {
  return {
    available: isAvailable(),
    configured: !!getApiKey(),
    error: _initError,
  };
}

// ── Dedup helper (local cache for recent saves to avoid duplicate API calls) ──
const _recentSaves = new Map();

function dedupKey(type, data) {
  const hash = crypto.createHash('sha256');
  hash.update(type);
  hash.update(JSON.stringify(data ?? '').slice(0, 500));
  return hash.digest('hex');
}

export function shouldSkipSave(type, data) {
  const key = dedupKey(type, data);
  const lastTime = _recentSaves.get(key);
  if (lastTime && Date.now() - lastTime < 3600000) {
    return true;
  }
  _recentSaves.set(key, Date.now());
  // Prune: remove expired first, then oldest if still over cap
  const cutoff = Date.now() - 7200000;
  for (const [k, t] of _recentSaves) {
    if (t < cutoff) _recentSaves.delete(k);
  }
  if (_recentSaves.size > 100) {
    const sorted = [..._recentSaves].sort((a, b) => a[1] - b[1]);
    for (const [k] of sorted.slice(0, _recentSaves.size - 100)) {
      _recentSaves.delete(k);
    }
  }
  return false;
}
