import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectSceneParams,
  collectSources,
  deadParams,
  isParamRead,
  oneHopBodies,
  parseHandlerMap,
  readByPrefix,
  readScopeOf,
  unresolvedHandlers,
} from '../lib/param-contract.js';

// 第五轮审计的常驻守卫：场景里写的 params 必须真的被读。
// 「写了没人读」= 用户以为勾了开关，实际什么都没发生（静默失效）——
// 这种坑不会报错，只能在 CI 里静态拦。
//
// 第十三轮把判据从「全仓库有人读过 `.key`」收窄到**这条动作自己的执行路径**：
//   handler 函数体 + 它把 params 交出去的一跳函数体 + 交互层（commands/）。
//   旧判据的假绿实例：`report.format` 在 8 个场景里写着 `"summary"`，而
//   handleReport 从不读它 —— 但 handlers/logging.js 里有个 `.format`，
//   于是「全仓库有人读过」= 通过。同理 `analyze.metrics`（handler 读的是 metric）、
//   `invokeSkill.command`（handler 读的是 subcommand）都是这种静默失效。
//
// 两类**可从源码推导**的豁免（不手写白名单）：
//   1. 内联动作（registry 里直接写箭头函数、不走 handlers/）：params 是给 agent 的
//      提示词，引擎本来就不该读它 —— 由 actions.js 的 ACTION_REGISTRY 结构推导。
//   2. 交互层参数：start.js 等 commands/ 下的文件读它（ask_even_in_auto、
//      theme_selection、validation…）。这些文件也在扫描范围里，无需特判。
const HERE = dirname(fileURLToPath(import.meta.url)); // claude-scene/src/commands
const SRC = join(HERE, '..'); // claude-scene/src
const SCENES = join(HERE, '..', '..', 'scenes');

// 判定器自己也是源码：它内部有 `.body` / `.file` 这类属性访问，
// 若不排除，任何一个叫 body/file 的场景参数都会「被读到」—— 守卫给自己放水。
const SELF = 'lib/param-contract.js';

function engineSources() {
  return collectSources(SRC).filter((s) => s.file !== SELF);
}

function handlerMap() {
  return parseHandlerMap(readFileSync(join(SRC, 'actions.js'), 'utf-8'));
}

describe('场景参数契约：写进场景的每个键都要有人读', () => {
  it('扫描范围不能是空的（空扫描 ≠ 通过）', () => {
    const sources = engineSources();
    expect(sources.length).toBeGreaterThan(100);
    expect(collectSceneParams(SCENES).length).toBeGreaterThan(500);
    // 一旦 actions.js 的 registry 解析失效，下面每条都会变成「内联动作 = 豁免」
    expect(handlerMap().size).toBeGreaterThan(50);
  });

  it('每个声明了 handler 的动作都能在源码里找到函数体（解析失效要出声）', () => {
    const rows = collectSceneParams(SCENES);
    const options = { sources: engineSources(), handlers: handlerMap(), cache: new Map() };
    expect(unresolvedHandlers(rows, options)).toEqual([]);
  });

  it('没有「写了没人读」的参数（只算这条动作自己的执行路径）', () => {
    const options = { sources: engineSources(), handlers: handlerMap(), cache: new Map() };
    const dead = deadParams(collectSceneParams(SCENES), options);
    const detail = dead.map((d) => `  ${d.scene}#${d.step} ${d.action}: ${d.key}`).join('\n');
    expect(detail).toBe('');
  });

  it('内联动作与前缀读取确实存在（防止解析失效后变成全豁免）', () => {
    const handlers = handlerMap();
    const inline = [...handlers.values()].filter((v) => v === null);
    // actions.js 里有 30+ 个内联动作；解析一旦坏掉这里立刻响
    expect(inline.length).toBeGreaterThan(20);
    expect(handlers.get('getDocumentation')).toBeNull();
    expect(handlers.get('checkGate')).toBe('handleCheckGate');
    // block_ 前缀读取必须真的在源码里（checkGate 的执行路径）
    expect(readByPrefix(engineSources().map((s) => s.src), 'block_release')).toBe(true);
  });
});

describe('判定器本身不许空转（不是「怎么都给过」）', () => {
  const sources = [
    { file: 'handlers/a.js', src: 'function handleA(_action, params) {\n  const mode = params?.mode;\n}' },
    {
      file: 'handlers/b.js',
      src: 'function handleB(_action, params) {\n  return describe(params);\n}\nfunction describe(params) {\n  return Object.entries(params);\n}',
    },
    {
      file: 'handlers/c.js',
      src: 'function handleC(_action, _params) {\n  return 1;\n}\nfunction unrelated() {\n  const other = { format: 1 };\n  return other.format;\n}',
    },
    { file: 'commands/start.js', src: 'export const ask = (params) => params?.ask_even_in_auto;' },
  ];
  const options = { sources, handlers: new Map([['a', 'handleA'], ['b', 'handleB'], ['c', 'handleC']]), cache: new Map() };
  const row = (action, key) => ({ scene: 's', step: 1, action, key });

  it('handler 函数体里读过 → 算读过', () => {
    expect(isParamRead(row('a', 'mode'), options)).toBe(true);
  });

  it('同一个文件的**别的函数**读过不算（这正是旧的「全仓库有人读」假绿）', () => {
    expect(isParamRead(row('c', 'format'), options)).toBe(false);
  });

  it('一跳函数体里的 Object.entries(params) → 泛读，算读过', () => {
    expect(isParamRead(row('b', 'whatever'), options)).toBe(true);
  });

  it('一跳只认「真的把 params 递出去」的调用（且不把自己算成一跳）', () => {
    expect(oneHopBodies(sources, 'function handleB(_action, params) { return describe(params); }', 'handleB')).toHaveLength(1);
    expect(oneHopBodies(sources, 'function handleB(_action, _params) { return describe(config); }', 'handleB')).toHaveLength(0);
  });

  it('交互层（commands/）读 step.params → 算读过', () => {
    expect(isParamRead(row('c', 'ask_even_in_auto'), options)).toBe(true);
  });

  it('handler 找不到 → 报成 unresolved（不许静默当成豁免）', () => {
    expect(readScopeOf('handleMissing', options)).toBeNull();
    expect(unresolvedHandlers([row('c', 'format')], { ...options, handlers: new Map([['c', 'handleMissing']]) })).toEqual([
      'c → handleMissing',
    ]);
  });
});
