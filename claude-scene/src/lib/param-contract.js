import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * 场景参数契约的判定器（第十三轮抽出成模块，为了让判据本身可以被测试）。
 *
 * 契约：场景里写进 `params` 的每个键，都必须在**这条动作自己的执行路径**上被人读过。
 * 「读了」的合法来源只有这些：
 *   1. 该动作 handler 的函数体里（不再算「同一个文件的别处」）
 *   2. handler 把 params 交给的一跳函数体里（`f(params)` / `f({...params})`）
 *   3. 交互层（commands/）：start.js 等真的在读 step.params 做提问
 *   4. 前缀读取：`k.startsWith('block_')`；泛读：`Object.entries(params)` / `...params`
 * 内联动作（registry 里直接写箭头函数）的 params 是给 agent 的提示词，引擎本就不读。
 *
 * 为什么不能「全仓库有人读过就算」：`.format` 这种键名在 20 个文件里都有，
 * 只要在别处出现一次就判活 —— 场景里写 `format: "json"` 而报告根本不认，也不会被发现。
 */
export const INTERACTION_LAYER = 'commands/';

/** 引用字符串（`'`/`"`/`` ` ``，含转义），返回收尾引号下标 */
function skipQuoted(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i += 1;
  }
  return src.length;
}

/** 注释（`//` 或 `/*`），返回注释结束后的下标 */
function skipComment(src, start) {
  if (src[start + 1] === '/') {
    const nl = src.indexOf('\n', start);
    return nl === -1 ? src.length : nl + 1;
  }
  const end = src.indexOf('*/', start + 2);
  return end === -1 ? src.length : end + 2;
}

/** 从 `{` 或 `[` 之类的开括号配对到闭合下标 */
function matchPair(src, openIdx) {
  const close = src[openIdx] === '{' ? '}' : ')';
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) { i = skipComment(src, i); continue; }
    if (ch === '"' || ch === "'" || ch === '`') { i = skipQuoted(src, i) + 1; continue; }
    if (ch === src[openIdx]) depth += 1;
    if (ch === close && (depth -= 1) === 0) return i;
    i += 1;
  }
  return -1;
}

/** 单个文件的 `{` 配对（字符串/注释感知），用于切出函数体 */
export function blockFrom(src, startIdx) {
  const open = src.indexOf('{', startIdx);
  if (open === -1) return '';
  const close = matchPair(src, open);
  return close === -1 ? src.slice(open) : src.slice(open, close + 1);
}

/** 跳过形参括号（能处理解构形参 `f({ a, b })`），从函数体的 `{` 开始配对 */
export function bodyOfDefinition(src, startIdx) {
  const arrow = src.indexOf('=>', startIdx);
  const firstBrace = src.indexOf('{', startIdx);
  // 只有 `=>` 出现在函数体大括号之前，才说明这是箭头函数定义；
  // 否则 `function f(a) { const g = () => 1; }` 会被当成箭头函数的体。
  if (arrow !== -1 && (firstBrace === -1 || arrow < firstBrace)) return blockFrom(src, arrow);
  const pOpen = src.indexOf('(', startIdx);
  if (pOpen === -1) return blockFrom(src, startIdx);
  const pClose = matchPair(src, pOpen);
  return pClose === -1 ? '' : blockFrom(src, pClose);
}

const definitionRe = (name) => new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=)`);

/** 函数体（含所在文件）；找不到返回 null */
export function findDefinition(sources, name) {
  for (const source of sources) {
    const match = definitionRe(name).exec(source.src);
    if (match) return { file: source.file, body: bodyOfDefinition(source.src, match.index) };
  }
  return null;
}

/**
 * handler 体里所有「参数文本里出现 params」的调用目标，返回它们的函数体（跳一层）。
 * `selfName` 用于排掉同名递归：`function handleX(params) { … }` 里 `handleX(` 自己不算一跳。
 */
export function oneHopBodies(sources, body, selfName) {
  const bodies = [];
  for (const match of body.matchAll(/\b([A-Za-z_$][\w$]*)\(/g)) {
    const name = match[1];
    if (name === selfName) continue;
    const openIdx = match.index + match[0].length - 1;
    const end = matchPair(body, openIdx);
    if (end === -1) continue;
    if (!/\bparams\b/.test(body.slice(openIdx + 1, end))) continue;
    const definition = findDefinition(sources, name);
    if (definition) bodies.push(definition.body);
  }
  return bodies;
}

const escapeRe = (text) => text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

/** 属性读取：`params.key` / `.key` / `['key']`（带词边界，防子串误命中） */
export const propertyReaders = (key) => new RegExp(`(?:\\?\\.|\\.)${escapeRe(key)}\\b|\\[\\s*['"]${escapeRe(key)}['"]\\s*\\]`);

/** 前缀读取：`k.startsWith('block_')` 能读到 `block_release`（任一前缀都算） */
export function readByPrefix(texts, key) {
  for (let i = 0; i < key.length; i += 1) {
    if (key[i] !== '_') continue;
    const prefix = escapeRe(key.slice(0, i + 1));
    const re = new RegExp(`startsWith\\(\\s*['"]${prefix}['"]\\s*\\)`);
    if (texts.some((text) => re.test(text))) return true;
  }
  return false;
}

/** 泛读整包 params：`Object.entries(params)` / `JSON.stringify(params)` / `...params` */
export const GENERIC_READ = /(?:Object\.(?:entries|keys|values)|JSON\.stringify)\(\s*_?params\s*\)|\.\.\._?params\b/;

/** 从 actions.js 解析 `ACTION_REGISTRY`：值像标识符 = 走 handler，其余 = 内联实现（null） */
export function parseHandlerMap(actionsSource) {
  const start = actionsSource.indexOf('export const ACTION_REGISTRY = {');
  if (start === -1) return new Map();
  const block = actionsSource.slice(start, actionsSource.indexOf('\n};', start));
  const map = new Map();
  for (const line of block.split('\n')) {
    // 不用正则切 key: value —— 惰性量词会触发 sonarjs/super-linear-regex，
    // 按第一个冒号切一刀就够（registry 行内不会有引号里的冒号）。
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().replaceAll("'", '');
    const value = line.slice(colon + 1).trim().replace(/,$/, '');
    if (!key || !value) continue;
    map.set(key, /^\w+$/.test(value) ? value : null);
  }
  return map;
}

/**
 * 某动作 handler 的「合法读取范围」文本（函数体 + 一跳函数体 + 交互层）。
 * 拿不到定义时返回 null（解析失败，由调用方另做范围自检）。
 */
export function readScopeOf(handler, { sources, cache }) {
  if (cache.has(handler)) return cache.get(handler);
  const definition = findDefinition(sources, handler);
  let scope = null;
  if (definition) {
    const interaction = sources.filter((s) => s.file.startsWith(INTERACTION_LAYER)).map((s) => s.src);
    scope = [definition.body, ...oneHopBodies(sources, definition.body, handler), ...interaction];
  }
  cache.set(handler, scope);
  return scope;
}

/** 判定一行场景参数有没有人读（handler 解析不到时返回 true，另由 unresolvedHandlers 点名） */
export function isParamRead(row, options) {
  const handler = options.handlers.get(row.action);
  if (!handler) return true; // 内联动作：params 是 agent 的提示词
  const scope = readScopeOf(handler, options);
  if (!scope) return true;
  if (scope.some((text) => propertyReaders(row.key).test(text))) return true;
  if (readByPrefix(scope, row.key)) return true;
  return GENERIC_READ.test(scope.join('\n'));
}

/** 场景里声明了 action、但源码里找不到对应 handler 定义的动作（解析失效信号） */
export function unresolvedHandlers(rows, options) {
  const missing = new Set();
  for (const row of rows) {
    const handler = options.handlers.get(row.action);
    if (!handler) continue;
    if (!readScopeOf(handler, options)) missing.add(`${row.action} → ${handler}`);
  }
  return [...missing];
}

/** 返回没人读的参数行（空数组 = 契约成立） */
export function deadParams(rows, options) {
  const cache = new Map();
  return rows.filter((row) => !isParamRead(row, { ...options, cache }));
}

/** 收集 claude-scene/src 下所有非测试源码 */
export function collectSources(srcDir) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.js') && !name.includes('.test.')) out.push(full);
    }
  };
  walk(srcDir);
  return out.map((file) => ({ file: relative(srcDir, file).split(sep).join('/'), src: readFileSync(file, 'utf-8') }));
}

/** 收集场景里声明的每个 param 行 */
export function collectSceneParams(scenesDir) {
  const rows = [];
  for (const name of readdirSync(scenesDir).filter((n) => n.endsWith('.json'))) {
    const scene = JSON.parse(readFileSync(join(scenesDir, name), 'utf-8'));
    for (const step of scene.flow || []) {
      for (const key of Object.keys(step.params || {})) {
        rows.push({ scene: name.replace('.json', ''), step: step.step, action: step.action, key });
      }
    }
  }
  return rows;
}
