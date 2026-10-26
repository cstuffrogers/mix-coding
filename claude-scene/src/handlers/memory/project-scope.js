import { resolve, basename } from 'path';
import crypto from 'crypto';
import { realpathSync } from 'fs';
import { PROJECT_ROOT } from '../../lib/paths.js';

/**
 * 对「还不存在」的路径做 realpath：向上找最近一个存在的祖先，展开它，再把
 * 剩余的路径段拼回去。直接 realpath 一个尚未创建的目录会抛错，于是同一项目
 * 在「刚写入时」和「目录建好后」算出两个不同字符串 —— 记忆就分裂了。
 */
function realpathDeep(absPath) {
  const segments = [];
  let head = absPath;
  for (;;) {
    try {
      const real = realpathSync.native(head);
      return segments.length ? resolve(real, ...segments.reverse()) : real;
    } catch {
      const parent = resolve(head, '..');
      if (parent === head) return absPath; // 到根了还是不行：原样返回
      segments.push(basename(head));
      head = parent;
    }
  }
}

/**
 * 项目作用域：给「全局共享」的三个记忆后端（claude-mem / agentmemory / NEXO）
 * 打上归属信息，让召回时能区分本项目、其他项目、以及打标之前的历史记录。
 *
 * 路径一律 normalize 后存盘：
 * - 分隔符统一成 `/`，避免 `E:\a\b` 与 `E:/a/b` 被当成两个项目
 * - 去掉尾随分隔符（`E:/a/` 与 `E:/a` 是同一目录）
 * - Windows 上转小写：NTFS 大小写不敏感，`E:/Auto-Coding` 和 `e:/auto-coding`
 *   对用户是同一个项目；不转小写会让它们分裂成两份记忆
 * - 解析成绝对路径：相对路径存进库后，换个 cwd 就再也认不回来了
 * - 走 realpath 展开：Windows 8.3 短名（`ADMINI~1`）与长名是同一目录，
 *   不展开就会把同一个项目记成两个；符号链接同理
 */
export function normalizeProjectPath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return '';
  let abs;
  try {
    abs = resolve(targetPath);
  } catch {
    return '';
  }
  // 路径不存在时 realpath 会抛错（例如还没创建的目录），保留绝对路径即可
  abs = realpathDeep(abs);
  let out = abs.replace(/\\/g, '/');
  // 不用 /\/+$/ 这类回溯尾缀正则：长路径上是 super-linear
  while (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  if (!out) return '';
  return process.platform === 'win32' ? out.toLowerCase() : out;
}

/**
 * 把任意字符串收敛成安全的「记忆类型」目录名。`type` 来自场景参数，
 * `type: '../../escaped'` 虽然没跑到沙箱外，但会写到意料之外的目录。
 */
export function safeTypeName(type, fallback = 'general') {
  const raw = String(type ?? '').toLowerCase();
  let out = raw.replace(/[^a-z0-9_-]+/g, '-');
  while (out.startsWith('-')) out = out.slice(1);
  while (out.endsWith('-')) out = out.slice(0, -1);
  return out || fallback;
}

/**
 * 当前项目的作用域。`targetPath` 来自场景步骤（`--target`）或 handler 参数；
 * 缺省回落到 PROJECT_ROOT（= $MIX_CODING_PROJECT_DIR || cwd）。
 */
export function projectScope(targetPath) {
  const path = normalizeProjectPath(targetPath || PROJECT_ROOT);
  const name = path ? (path.split('/').pop() || basename(path)) : '';
  let slug = name.replace(/[^\w-]+/g, '-').toLowerCase();
  while (slug.startsWith('-')) slug = slug.slice(1);
  while (slug.endsWith('-')) slug = slug.slice(0, -1);
  if (!slug) slug = 'project';
  return { path, name, slug };
}

/**
 * 判定一条全局记忆的归属：
 * - `project`        —— 存的就是本项目
 * - `unscoped`       —— 没有归属信息（打标之前写入的历史记录）
 * - `cross-project`  —— 明确属于另一个项目
 */
export function classifyScope(storedPath, current) {
  const stored = normalizeProjectPath(storedPath);
  if (!stored) return 'unscoped';
  const currentPath = typeof current === 'string' ? normalizeProjectPath(current) : current?.path;
  if (!currentPath) return 'unscoped';
  return stored === currentPath ? 'project' : 'cross-project';
}

/**
 * 召回时是否纳入某条全局记忆。默认只取本项目和「无归属」的历史记录：
 * 历史记录不能静默丢弃（等于删用户数据），但必须标记出来，让人知道
 * 它不一定属于当前项目。`cross_project` 显式开启才跨项目召回。
 */
export function includeInRecall(scope, { crossProject = false } = {}) {
  if (scope === 'project' || scope === 'unscoped') return true;
  return crossProject === true;
}

// ── 内容指纹（写入去重）────────────────────────────────────────
// 一次场景结束会把同一份结果写进 4 个后端。project-memory 用「完整 JSON 的
// sha256」去重，但 autoRemember 的 data 里带 timestamp，每轮都不一样 —— 于是
// claude-mem / agentmemory / NEXO 每跑一次就多一份**内容相同**的副本。

// 写入侧去重的时间窗：同一份内容 7 天内只落一份。窗口不能无限长 ——
// 那样「每周跑一次同样的检查」就永远只在第一天留一条记录，看不出趋势；
// 也不能太短（1 小时），否则一天连跑几次场景照样堆副本。
export const DEDUPE_WINDOW_MS = 7 * 24 * 3600 * 1000;

// 只忽略「时间戳」这一类天然易变的字段。`id` 不能忽略 —— 它就藏在 data 里
// 用来区分两条记录（实测把 id 当成易变字段后，两条 note 相同、id 不同的
// 记忆被判成重复，直接丢一条）。

const VOLATILE_KEYS = new Set(['timestamp', 'ts', 'created_at', 'updated_at', 'stored_at', 'archived_at']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE_KEYS.has(key)) continue;
      const next = canonicalize(value[key]);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value;
}

export function contentFingerprint(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(canonicalize(value ?? ''));
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}
