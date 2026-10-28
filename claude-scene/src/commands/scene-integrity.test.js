import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_REGISTRY, hasActionHandler } from '../actions.js';
import { UI_POLISH_ACTIONS } from '../handlers/ui-polish.js';
import { handleInteractiveStep } from './start.js';

const SRC = dirname(fileURLToPath(import.meta.url));
const SCENE_DIR = join(SRC, '..', '..', 'scenes');
const files = readdirSync(SCENE_DIR).filter((f) => f.endsWith('.json')).sort();

/** 这个 action 在这一场景里有没有落点（ui-polish 有自己的一套表） */
const hasHandler = (sceneId, action) =>
  hasActionHandler(action) || (sceneId === 'ui-polish' && Boolean(UI_POLISH_ACTIONS[action]));

/**
 * 场景里写错的 action 名以前是死无对证：executeAction 回一句「执行完成」，
 * 汇总里是 ✓ pass，报告里满分。这条巡检把「有没有落点」变成机器断言 ——
 * 加场景/改 action 名时忘了配处理器，CI 直接红，而不是等某天翻日志才发现。
 */
describe('全场景 step：action 必须有落点', () => {
  it('场景文件齐全（防止目录换了导致巡检空跑）', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  for (const file of files) {
    const scene = JSON.parse(readFileSync(join(SCENE_DIR, file), 'utf8'));
    const sceneId = scene.scene_id || file.replace('.json', '');
    const flow = scene.flow || [];
    if (flow.length === 0) continue;

    it(`${file}：${flow.length} 个步骤都有处理器或交互处理`, async () => {
      const problems = [];
      for (const step of flow) {
        if (hasHandler(sceneId, step.action)) continue;
        // 交互层可能由 handleInteractiveStep 自己拦下（selectModes / confirm 之类）；
        // 返回 false 才轮到 dispatchAction —— 那它就必须有处理器。
        const handledInteractively = step.layer === 'interactive'
          && await handleInteractiveStep(sceneId, step, { selected_modes: [], targetPath: SRC }, { auto: true }) !== false;
        if (!handledInteractively) {
          problems.push(`Step ${step.step} ${step.action}（layer=${step.layer}）没有任何处理器`);
        }
      }
      expect(problems).toEqual([]);
    });
  }

  it('ACTION_REGISTRY 里没有空壳（都是函数）', () => {
    const notFunctions = Object.entries(ACTION_REGISTRY)
      .filter(([, handler]) => typeof handler !== 'function')
      .map(([name]) => name);
    expect(notFunctions).toEqual([]);
  });
});

/**
 * `on_error` 的取值也是契约：写错一个词（`fail-fast` / `stop`）以前完全无声 ——
 * 引擎按「继续」处理，场景作者却以为写下了「失败即中止」的承诺。
 * 这里把允许的取值钉死；新增取值必须同时改引擎和这条断言。
 */
const KNOWN_ON_ERROR = new Set(['abort', 'fail_workflow', 'retry', 'continue']);

describe('全场景 step：on_error 取值必须是引擎认识的', () => {
  it('没有任何场景写了未实现的 on_error', () => {
    const unknown = [];
    for (const file of files) {
      const scene = JSON.parse(readFileSync(join(SCENE_DIR, file), 'utf8'));
      for (const step of scene.flow || []) {
        if (step.on_error === undefined) continue;
        if (!KNOWN_ON_ERROR.has(step.on_error)) {
          unknown.push(`${file} Step ${step.step} ${step.action}: on_error=${step.on_error}`);
        }
      }
    }
    expect(unknown, `引擎只支持 ${[...KNOWN_ON_ERROR].join(' / ')}：\n${unknown.join('\n')}`).toEqual([]);
  });

  it('on_error: retry 的步骤必须声明在「可以重跑」的 action 上（不许退化成静默继续）', () => {
    // retry 现在会真的重跑、真的改写记录；能重跑的 action 必须仍然是注册过的处理器
    const bad = [];
    for (const file of files) {
      const scene = JSON.parse(readFileSync(join(SCENE_DIR, file), 'utf8'));
      const sceneId = scene.scene_id || file.replace('.json', '');
      for (const step of scene.flow || []) {
        if (step.on_error !== 'retry') continue;
        if (!hasHandler(sceneId, step.action)) bad.push(`${file} Step ${step.step} ${step.action}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
