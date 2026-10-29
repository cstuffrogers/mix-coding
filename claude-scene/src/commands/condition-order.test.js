import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CONDITION_PREDICATES } from '../lib/conditions.js';

/**
 * 条件 ↔ 上游写入顺序的契约（第十一轮维度③）
 *
 * `condition` 只认 context 里的键。如果一个条件读的键**只有后面的步骤才会写**，
 * 那么这个条件在求值的那一刻永远是 undefined —— 不是「不满足」，而是「还轮不到」。
 * 运行时确实会把「从头到尾没人写过」的键记进 `_unjudgedSteps` 并点名，但
 * 「后面才写」这种情况在运行时看起来跟「真的不满足」一模一样：静默跳过，没人发现。
 *
 * 两种违例：
 *   1. 顺序违例：条件读的键只有 step > 当前 step 才写；
 *   2. 保障违例：唯一的上游写者自己也是条件步骤（条件条件成立时才写）——
 *      时序对了，但「上游一定写过」这个保证不成立。
 *
 * 键集从哪里来：全部从实现源码推导（处理器函数体里的 `context.x =`、引擎里
 * 步骤之外写的键、`actionMap` 那张「交互动作 → context 键」的表），不手写白名单。
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCENE_DIR = join(SRC, '..', 'scenes');

/** 条件表达式里除了键名以外的词（JS 语法 + 谓词名），不是 context 键 */
const NOISE = new Set([
  ...CONDITION_PREDICATES,
  'true', 'false', 'null', 'undefined',
  'includes', 'startsWith', 'endsWith', 'length', 'every', 'some', 'map', 'filter',
]);

function listJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    if (!entry.name.endsWith('.js') || entry.name.includes('.test.')) return [];
    return [full];
  });
}

function keysWrittenIn(code) {
  const keys = new Set();
  for (const m of code.matchAll(/(?:context|ctx)\.(\w+)\s*=(?!=)/g)) keys.add(m[1]);
  for (const m of code.matchAll(/(?:context|ctx)\[(['"])(\w+)\1\]\s*=(?!=)/g)) keys.add(m[2]);
  return keys;
}

/** 从 `export function name(` 起按花括号配对切出函数体 */
function functionBody(lines, startIndex) {
  let depth = 0;
  let started = false;
  for (let i = startIndex; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
      }
    }
    if (started && depth === 0) return lines.slice(startIndex, i + 1).join('\n');
  }
  return lines.slice(startIndex).join('\n');
}

/** 每个导出函数体里写了哪些 context 键：函数名 → Set */
function handlerWrites() {
  const writes = new Map();
  for (const file of listJs(join(SRC, 'handlers'))) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const fn = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
      if (!fn) return;
      writes.set(fn[1], keysWrittenIn(functionBody(lines, i)));
    });
  }
  return writes;
}

/** actions.js 的 action → 处理器函数名 */
function actionToHandler() {
  const map = new Map();
  for (const m of readFileSync(join(SRC, 'actions.js'), 'utf8').matchAll(/^ *'?([\w-]+)'?: *(handle\w+),? *$/gm)) {
    if (!map.has(m[1])) map.set(m[1], m[2]);
  }
  return map;
}

/**
 * 引擎在「步骤流程」之外写过的键：交互层（`actionMap` 那张表）、`selectModes`
 * 写 `selected_modes`、确认流写 `user_confirmed`……这些在执行 flow 之前就有了，
 * 条件读到它们不算顺序违例。
 */
function engineWrittenKeys() {
  const keys = new Set();
  const files = [...listJs(join(SRC, 'commands')), ...listJs(join(SRC, 'lib'))];
  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    for (const key of keysWrittenIn(code)) keys.add(key);
    // 交互动作 → context 键的映射表（`selectSetupKind: 'setup_kind'`）
    const at = code.indexOf('const actionMap = {');
    if (at !== -1) {
      const block = code.slice(at, code.indexOf('};', at));
      for (const m of block.matchAll(/:\s*'(\w+)'/g)) keys.add(m[1]);
    }
  }
  return keys;
}

/** applyPostStepContext：按 action 补写的键（重试成功后也会重跑） */
function postStepWrites() {
  const writes = new Map();
  const code = readFileSync(join(SRC, 'commands', 'start.js'), 'utf8');
  const start = code.indexOf('function applyPostStepContext');
  const chunk = code.slice(start, code.indexOf('\n}\n', start));
  for (const part of chunk.split(/(?=if \(step\.action ===)/)) {
    const actions = [...part.matchAll(/step\.action === '(\w+)'/g)].map((m) => m[1]);
    const keys = [...keysWrittenIn(part)];
    for (const action of actions) writes.set(action, new Set([...(writes.get(action) || []), ...keys]));
  }
  return writes;
}

/** 一个条件表达式引用了哪些 context 键 */
function conditionKeys(condition) {
  const stripped = String(condition).replace(/'[^']*'|"[^"]*"/g, ' ');
  return [...stripped.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)]
    .map((m) => m[1])
    .filter((id) => !NOISE.has(id));
}

/**
 * @param {Array} flow         场景的 step 列表
 * @param {(step) => string[]} keysOf  这一步写哪些 context 键
 * @param {Set<string>} engineKeys     流程开始前就存在的键
 * @returns {string[]} 违例描述（空 = 契约成立）
 */
function violationFor(step, key, writers) {
  const upstream = writers.filter((w) => w.step < step.step);
  const tail = `Step ${step.step} ${step.action} 读 ${key}`;
  if (upstream.length > 0) {
    return upstream.every((w) => w.gated)
      ? `${tail}，唯一上游写者 Step ${upstream.map((w) => w.step).join(',')} 自己也是条件步骤`
      : null;
  }
  return writers.length > 0
    ? `${tail}，但它要到 Step ${writers.map((w) => w.step).join(',')} 才写（条件先于写入求值）`
    : null; // 从头到尾没人写：运行时 _unjudgedSteps 负责点名，不在这里重复报
}

function findConditionOrderViolations(flow, keysOf, engineKeys) {
  const writers = new Map();
  for (const step of flow) {
    for (const key of keysOf(step)) {
      writers.set(key, [...(writers.get(key) || []), { step: step.step, gated: Boolean(step.condition) }]);
    }
  }

  const violations = [];
  // 「可用」= 流程开始前就有，或被一个无条件步骤写过。条件步骤的写入不算保证：
  // 它自己的条件没成立时就不写，后面的条件照样读到 undefined。
  const guaranteed = new Set(engineKeys);
  for (const step of flow) {
    for (const key of conditionKeys(step.condition || '')) {
      if (guaranteed.has(key)) continue;
      const found = violationFor(step, key, writers.get(key) || []);
      if (found) violations.push(found);
    }
    if (!step.condition) keysOf(step).forEach((key) => guaranteed.add(key));
  }
  return violations;
}

function sceneViolations(file, keysOf, engineKeys) {
  const scene = JSON.parse(readFileSync(join(SCENE_DIR, file), 'utf8'));
  return findConditionOrderViolations(scene.flow || [], keysOf, engineKeys).map((line) => `${file} ${line}`);
}

describe('场景条件 ↔ 上游写入顺序', () => {
  const handlerByAction = actionToHandler();
  const writes = handlerWrites();
  const postWrites = postStepWrites();
  const keysOf = (step) => [
    ...(writes.get(handlerByAction.get(step.action)) || []),
    ...(postWrites.get(step.action) || []),
  ];
  const engineKeys = engineWrittenKeys();
  const files = readdirSync(SCENE_DIR).filter((f) => f.endsWith('.json'));

  it('没有任何场景的条件依赖「后面的步骤才写」的键', () => {
    const all = files.flatMap((file) => sceneViolations(file, keysOf, engineKeys));
    expect(all, `条件读的键在求值时还不存在（永远是 undefined，不是不满足）：\n${all.join('\n')}`).toEqual([]);
  });

  it('键集推导本身是有效的（不是空转：处理器写入真的被解析出来）', () => {
    // 反向验证：如果解析退化成空集，上面那条断言会永远通过 —— 这里钉住它的有效性
    expect(writes.size).toBeGreaterThan(300);
    expect(handlerByAction.size).toBeGreaterThan(300);
    expect(keysOf({ action: 'detectorReport' }).length).toBeGreaterThan(0);
    expect(engineKeys.has('selected_modes')).toBe(true);
    expect(engineKeys.has('setup_kind')).toBe(true);
  });
});

describe('findConditionOrderViolations（自探针）', () => {
  const engineKeys = new Set();
  const keysOf = (step) => step.writes || [];

  it('条件读的键只有后面的步骤写 → 点名违例', () => {
    const flow = [
      { step: 1, action: 'a', condition: 'flag === true' },
      { step: 2, action: 'b', writes: ['flag'] },
    ];
    expect(findConditionOrderViolations(flow, keysOf, engineKeys)).toEqual([
      'Step 1 a 读 flag，但它要到 Step 2 才写（条件先于写入求值）',
    ]);
  });

  it('上游写过 → 没有违例', () => {
    const flow = [
      { step: 1, action: 'a', writes: ['flag'] },
      { step: 2, action: 'b', condition: 'flag === true' },
    ];
    expect(findConditionOrderViolations(flow, keysOf, engineKeys)).toEqual([]);
  });

  it('唯一的上游写者自己也是条件步骤 → 保障违例（时序对但保证不成立）', () => {
    const flow = [
      { step: 1, action: 'a', condition: 'ready === true', writes: ['flag'] },
      { step: 2, action: 'b', condition: 'flag === true' },
    ];
    expect(findConditionOrderViolations(flow, keysOf, new Set(['ready']))).toEqual([
      'Step 2 b 读 flag，唯一上游写者 Step 1 自己也是条件步骤',
    ]);
  });

  it('流程开始前就存在的键（引擎/交互层写的）不算违例', () => {
    const flow = [{ step: 1, action: 'a', condition: "selected_modes.includes('code_review')" }];
    expect(findConditionOrderViolations(flow, keysOf, new Set(['selected_modes']))).toEqual([]);
  });

  it('从头到尾没人写的键不在这里报（运行时 _unjudgedSteps 负责点名）', () => {
    const flow = [{ step: 1, action: 'a', condition: 'ghost === true' }];
    expect(findConditionOrderViolations(flow, keysOf, engineKeys)).toEqual([]);
  });

  it('步骤自己的写入晚于自己的条件：同一步写不算上游（否则条件永远读到 undefined）', () => {
    const flow = [{ step: 1, action: 'a', condition: 'flag === true', writes: ['flag'] }];
    expect(findConditionOrderViolations(flow, keysOf, engineKeys)).toEqual([
      'Step 1 a 读 flag，但它要到 Step 1 才写（条件先于写入求值）',
    ]);
  });

  it('字符串字面量与谓词名不算键名', () => {
    const flow = [{ step: 1, action: 'a', condition: "frontend_involved && selected_modes.includes('quality_tools')" }];
    // frontend_involved 是谓词、'quality_tools' 是字面量，只剩 selected_modes
    expect(conditionKeys(flow[0].condition)).toEqual(['selected_modes']);
  });
});
