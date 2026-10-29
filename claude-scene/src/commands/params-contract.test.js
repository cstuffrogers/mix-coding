import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 第五轮审计的常驻守卫：场景里写的 params 必须真的被读。
// 「写了没人读」= 用户以为勾了开关，实际什么都没发生（静默失效）——
// 这种坑不会报错，只能在 CI 里静态拦。
//
// 第十轮把判据从 `source.includes(key)` 换成**属性访问**：
//   旧判据太宽 —— `body` 会命中 `body_ref`、`draft` 会命中 `web-design-v0-draft`、
//   98 条子串命中里有大量假绿。改为正则匹配 `params.key` / `.key` / `['key']`。
//
// 两类**可从源码推导**的豁免（不手写白名单）：
//   1. 内联动作（registry 里直接写箭头函数、不走 handlers/）：params 是给 agent 的
//      提示词，引擎本来就不该读它 —— 由 actions.js 的 ACTION_REGISTRY 结构推导。
//   2. 交互层参数：start.js 等 commands/ 下的文件读它（ask_even_in_auto、
//      theme_selection、validation…）。这些文件也在扫描范围里，无需特判。
const HERE = dirname(fileURLToPath(import.meta.url)); // claude-scene/src/commands
const SRC = join(HERE, '..'); // claude-scene/src
const SCENES = join(HERE, '..', '..', 'scenes');

function walkJs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkJs(full, out);
    else if (name.endsWith('.js') && !name.includes('.test.')) out.push(full);
  }
  return out;
}

function engineSources() {
  return walkJs(SRC).map((file) => ({ file, src: readFileSync(file, 'utf-8') }));
}

function sceneParams() {
  const rows = [];
  for (const file of readdirSync(SCENES).filter((n) => n.endsWith('.json'))) {
    const scene = JSON.parse(readFileSync(join(SCENES, file), 'utf-8'));
    for (const step of scene.flow || []) {
      for (const key of Object.keys(step.params || {})) {
        rows.push({ scene: file.replace('.json', ''), step: step.step, action: step.action, key });
      }
    }
  }
  return rows;
}

/** 键名在源码里被当成属性读过的正则（params.x / .x / ['x']），带词边界防子串误命中。 */
function propertyReaders(key) {
  const esc = key.replace(/[$]/g, '\\$');
  return new RegExp(`(?:\\?\\.|\\.)${esc}\\b|\\[\\s*['"]${esc}['"]\\s*\\]`);
}

/**
 * 前缀式读取：`k.startsWith('block_')` —— 读的是「所有 block_xxx」，
 * 不出现具体键名。这是合法读取（checkGate 就是这么处理 block_release 的）。
 */
function readByPrefix(sources, key) {
  const idx = key.lastIndexOf('_');
  const prefix = idx > 0 ? key.slice(0, idx + 1) : '';
  if (!prefix) return false;
  const re = new RegExp(`startsWith\\(\\s*['"]${prefix.replace(/[$]/g, '\\$')}['"]\\s*\\)`);
  return sources.some(({ src }) => re.test(src));
}

/**
 * 本动作的 handler 把整个 params 交给了一个枚举它的函数吗？
 * 只看一跳：`handleCeAction` → `describePreferences(params)` → `Object.entries(params)`。
 * 必须精确到「这个动作」，不能全局一口（否则一个泛读就把所有键都豁免了）。
 */
function actionReadsGenerically(sources, handlerName) {
  if (!handlerName) return false;
  const fileOf = (src) => new RegExp(`function\\s+${handlerName}\\(`).test(src);
  const handlerSrc = sources.find(({ src }) => fileOf(src));
  if (!handlerSrc) return false;
  for (const m of handlerSrc.src.matchAll(/\b([A-Za-z_$][\w$]*)\(\s*params\s*[,)]/g)) {
    const callee = m[1];
    const re = new RegExp(`function\\s+${callee}\\([^)]*\\)\\s*\\{[\\s\\S]*?Object\\.(entries|keys)\\(\\s*params\\s*\\)`);
    if (sources.some(({ src }) => re.test(src))) return true;
  }
  return false;
}

/**
 * 内联动作：registry 里直接写成箭头函数、不经过 handlers/ 的动作。
 * 这些动作的 params 是给 agent 的执行提示（例如 Context7 的 topic），
 * 引擎不执行、也没资格读 —— 由 actions.js 自身结构推导，不是手写名单。
 *
 * 返回 Map<action, handlerName|null>：null = 内联实现。
 */
function actionHandlers() {
  const src = readFileSync(join(SRC, 'actions.js'), 'utf-8');
  const start = src.indexOf('export const ACTION_REGISTRY = {');
  const block = src.slice(start, src.indexOf('\n};', start));
  const map = new Map();
  for (const line of block.split('\n')) {
    // 不用正则切 key: value —— 惰性量词会触发 sonarjs/super-linear-regex，
    // 按第一个冒号切一刀就够（registry 行内不会有引号里的冒号）。
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().replaceAll("'", '');
    const value = line.slice(colon + 1).trim().replace(/,$/, '');
    if (!key || !value) continue;
    // `x: handleFoo` = 走 handler；其他写法（箭头函数、条件表达式）都是内联实现
    map.set(key, /^\w+$/.test(value) ? value : null);
  }
  return map;
}

describe('场景参数契约：写进场景的每个键都要有人读', () => {
  it('扫描范围不能是空的（空扫描 ≠ 通过）', () => {
    expect(engineSources().length).toBeGreaterThan(100);
    expect(sceneParams().length).toBeGreaterThan(500);
  });

  it('没有「写了没人读」的参数（按属性访问判定）', () => {
    const sources = engineSources();
    const handlers = actionHandlers();
    const dead = sceneParams()
      .filter((row) => {
        const handler = handlers.get(row.action);
        if (handler === null) return false; // 内联动作：params 是 agent 的提示词
        if (sources.some(({ src }) => propertyReaders(row.key).test(src))) return false;
        if (readByPrefix(sources, row.key)) return false;
        return !actionReadsGenerically(sources, handler);
      });

    const detail = dead.map((d) => `  ${d.scene}#${d.step} ${d.action}: ${d.key}`).join('\n');
    expect(detail).toBe('');
  });

  it('内联动作与前缀读取确实存在（防止解析失效后变成全豁免）', () => {
    const handlers = actionHandlers();
    const inline = [...handlers.values()].filter((v) => v === null);
    // actions.js 里有 30+ 个内联动作；解析一旦坏掉这里立刻响
    expect(inline.length).toBeGreaterThan(20);
    expect(handlers.get('getDocumentation')).toBeNull();
    expect(handlers.get('checkGate')).toBe('handleCheckGate');
    // block_ 前缀读取必须真的在源码里（checkGate 的执行路径）
    expect(readByPrefix(engineSources(), 'block_release')).toBe(true);
  });
});
