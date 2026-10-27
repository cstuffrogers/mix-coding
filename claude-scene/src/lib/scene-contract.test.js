import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ACTION_REGISTRY } from '../actions.js';
import { hasActionMessage } from '../data/action-messages.js';

/**
 * 场景契约：场景里写的每个条件标识符、每个 action 名，都必须有人实现。
 *
 * 为什么需要这条：同一类「悬空引用」bug 在本仓库靠人肉审计出现了 5 次
 * （恒假条件、未知动作静默 pass、hooks 里的动作），每次都是"读的没人写"或
 * "写的没人读"。人肉 grep 只能猜，而且我自己的 grep 也错过两次
 * （把 `memoryRecall` 当成场景键、把动态写入的 `enh_*` 当成悬空）。
 * 这里把这层契约变成可执行断言，换人/换会话都不会退化。
 *
 * 覆盖三种"提供者"：
 *   1. SIMPLE_CONDITIONS 里的谓词（条件的求值侧）
 *   2. `context.X = …` / `ctx.X = …` 直接赋值
 *   3. 两处动态写入：enhancements.js 的 `enh_${key}`、start.js 单选分支的映射表
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = join(HERE, '..', '..');
const REPO_ROOT = join(ENGINE_ROOT, '..');
const SRC = join(ENGINE_ROOT, 'src');

const CONDITION_KEYWORDS = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'includes', 'some', 'every',
  'startsWith', 'endsWith', 'length', 'Number', 'String', 'Boolean',
]);

/** 说明：如果将来出现只由 CLI/LLM 提供、引擎内不赋值的条件键，
 *  在这里加一个显式白名单并写明理由 —— 不要靠放宽断言让它过去。 */

/** start.js 里被单独特判、不进 ACTION_REGISTRY 的动作。 */
const START_SPECIALS = new Set(['selectModes', 'selectSetupKind']);

/** 自带 action 表、不经 executeAction 分发的场景。 */
const SCENE_OWNED_ACTIONS = new Set(['ui-polish']);

function read(path) {
  return readFileSync(path, 'utf8');
}

function listSources(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listSources(full, acc);
    else if (entry.endsWith('.js') && !entry.includes('.test.')) acc.push(full);
  }
  return acc;
}

/** 取出 `const NAME = { … }` 的块体（切到对象结尾，别把文件尾的键也算进来）。 */
function objectBlock(file, header) {
  const src = read(file);
  const start = src.indexOf(header);
  expect(start, `找不到 ${header}`).not.toBe(-1);
  const end = src.indexOf('\n};', start);
  return src.slice(start, end === -1 ? undefined : end);
}

function simplePredicates() {
  const block = objectBlock(join(SRC, 'lib', 'conditions.js'), 'const SIMPLE_CONDITIONS = {');
  return new Set([...block.matchAll(/^ {2}([A-Za-z_]\w*):/gm)].map((m) => m[1]));
}

function contextWriters(blob) {
  const keys = new Set();
  for (const m of blob.matchAll(/\b(?:context|ctx)\??\.([A-Za-z_]\w*)\s*=(?!=)/g)) keys.add(m[1]);
  // 动态写入 1：enhancements.js 把注册表的 key 铺成 enh_<key>
  for (const m of read(join(SRC, 'lib', 'enhancements.js')).matchAll(/key:\s*'([a-z][a-z0-9_]*)'/g)) {
    keys.add(`enh_${m[1]}`);
  }
  // 动态写入 2：start.js 单选分支 actionMap（selectXxx → context 键）
  const mapBlock = objectBlock(join(SRC, 'commands', 'start.js'), 'const actionMap = {');
  for (const m of mapBlock.matchAll(/:\s*'([a-z][a-z0-9_]*)'/g)) keys.add(m[1]);
  return keys;
}

function loadScenes() {
  const scenes = [];
  for (const dir of [join(ENGINE_ROOT, 'scenes'), join(REPO_ROOT, '.claude', 'scenes')]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const json = JSON.parse(read(join(dir, file)));
      scenes.push({ scene: file.replace('.json', ''), json });
    }
  }
  return scenes;
}

/** 从条件表达式里取标识符（先抹掉字符串字面量）。 */
function identifiersOf(expression) {
  const stripped = expression.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  const words = stripped.match(/[A-Za-z_]\w*/g) || [];
  return words.filter((id) => !CONDITION_KEYWORDS.has(id) && !/^[A-Z]/.test(id));
}

function record(map, key, scene) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(scene);
}

function handleEntry(key, value, scene, out) {
  // hooks 块不是步骤：引擎不执行它，里面的 action 名不参与契约
  if (key === 'hooks') return;
  if ((key === 'condition' || key === 'skip_if') && typeof value === 'string') {
    for (const id of identifiersOf(value)) record(out.conditions, id, scene);
    return;
  }
  if (key === 'action' && typeof value === 'string') {
    record(out.actions, value, scene);
    return;
  }
  walkScenes(value, scene, out);
}

function walkScenes(node, scene, out) {
  if (Array.isArray(node)) {
    for (const item of node) walkScenes(item, scene, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) handleEntry(key, value, scene, out);
  return out;
}

function isKnownAction(action, where) {
  if (Object.hasOwn(ACTION_REGISTRY, action)) return true;
  if (action.startsWith('ce-')) return true;
  if (START_SPECIALS.has(action)) return true;
  if (hasActionMessage(action)) return true;
  return [...where].every((s) => SCENE_OWNED_ACTIONS.has(s));
}

function collectAll() {
  const out = { conditions: new Map(), actions: new Map() };
  for (const { scene, json } of loadScenes()) walkScenes(json, scene, out);
  return out;
}

const scenes = loadScenes();
const collected = collectAll();
const blob = listSources(SRC).map((p) => read(p)).join('\n');

describe('场景 ↔ 引擎契约', () => {
  it('扫到了场景与求值器（防止测试自己空跑变假绿）', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(20);
    expect(simplePredicates().size).toBeGreaterThanOrEqual(50);
    expect(collected.conditions.size).toBeGreaterThan(20);
    expect(collected.actions.size).toBeGreaterThan(100);
  });

  it('每个条件标识符都有人求值（或在 context 上被写入）', () => {
    const providers = new Set([...simplePredicates(), ...contextWriters(blob)]);
    const dangling = [...collected.conditions]
      .filter(([id]) => !providers.has(id))
      .map(([id, where]) => `${id}  ←  ${[...where].join(', ')}`);
    expect(dangling, `悬空条件（读了没人写，条件恒假/恒真）：\n${dangling.join('\n')}`).toEqual([]);
  });

  it('每个 action 都在 ACTION_REGISTRY / 消息表 / 已知特例里', () => {
    const dangling = [...collected.actions]
      .filter(([action, where]) => !isKnownAction(action, where))
      .map(([action, where]) => `${action}  ←  ${[...where].join(', ')}`);
    expect(dangling, `悬空动作（引擎不认识，静默 pass）：\n${dangling.join('\n')}`).toEqual([]);
  });
});
