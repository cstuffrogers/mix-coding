import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_REGISTRY, hasActionHandler } from '../actions.js';
import { UI_POLISH_ACTIONS } from '../handlers/ui-polish.js';
import { handleInteractiveStep } from './start.js';
import { classifyAction } from '../lib/acceptance-check.js';

const LF = String.fromCodePoint(10);
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

/**
 * 验收三元组的场景侧：有变更动作就必须有验证动作。
 * 以前这条只写在文档和 CLAUDE.md 里 —— 「改了东西没验证」在场景层没人拦，
 * 全靠写场景的人记得。现在逐场景机器断言：要么带 verify 步骤，
 * 要么显式声明 allow_no_verify + 理由（豁免不许静默）。
 */
describe('全场景：变更类步骤必须有验证类步骤，豁免必须带理由', () => {
  const scenes = files.map((file) => {
    const scene = JSON.parse(readFileSync(join(SCENE_DIR, file), 'utf8'));
    const kinds = (scene.flow || []).map((s) => classifyAction(s.action));
    return {
      file,
      edits: kinds.filter((k) => k === 'edit').length,
      verifies: kinds.filter((k) => k === 'verify').length,
      allow: scene.allow_no_verify,
      reason: scene.allow_no_verify_reason,
    };
  });

  it('有变更类动作的场景都带验证类动作，或有明确豁免', () => {
    const bad = scenes
      .filter((s) => s.edits > 0 && s.verifies === 0 && s.allow !== true)
      .map((s) => `${s.file}: ${s.edits} 个变更类步骤，0 个验证类步骤，也没声明 allow_no_verify`);
    expect(bad, bad.join(LF)).toEqual([]);
  });

  it('声明了 allow_no_verify 就必须写理由（否则等于悄悄关掉门禁）', () => {
    const bad = scenes
      .filter((s) => s.allow === true && !(typeof s.reason === 'string' && s.reason.trim().length >= 8))
      .map((s) => `${s.file}: allow_no_verify=true 但 allow_no_verify_reason 缺失或过短`);
    expect(bad, bad.join(LF)).toEqual([]);
  });

  it('allow_no_verify 只认布尔 true，且豁免要有东西可豁免', () => {
    const bad = [];
    for (const s of scenes) {
      if (s.allow !== undefined && s.allow !== true) bad.push(`${s.file}: allow_no_verify=${JSON.stringify(s.allow)}（只认布尔 true）`);
      // 没有变更类步骤却声明豁免 = 一个永远不会生效的开关，读者会以为有门禁挡着
      if (s.allow === true && s.edits === 0) bad.push(`${s.file}: allow_no_verify=true 但场景没有变更类步骤（豁免是空的）`);
      if (s.allow !== true && s.reason !== undefined) bad.push(`${s.file}: 没声明 allow_no_verify 却写了 allow_no_verify_reason`);
    }
    expect(bad, bad.join(LF)).toEqual([]);
  });
});
