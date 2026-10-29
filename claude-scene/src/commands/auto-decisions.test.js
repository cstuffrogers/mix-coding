// 第二十轮 ④：--auto 替用户做的每个决定，都得说得出来。
//
// --auto 的语义是「别打断我」，不是「替我选」。两者的分界是**事后能不能看见**：
// 路径、模式、确认题、轮数、sweep 全在 `if (options.auto)` 里悄悄取值，屏幕上最多一行灰字，
// 日志里一个字没有 —— 用户看到的是「跑通了」，实际发生了好几次「没人问过」。
//
// 这个文件守三件事：
//   ① 每个自主决定都登记在 data/auto-decisions.js（有名字、有覆盖方式）；
//   ② start.js 里凡是提到 options.auto 的函数，必须属于「披露 / 问人 / 纯判定」之一；
//   ③ 披露出来的条目真的带标签和覆盖提示（不是一句「已自动处理」）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_DECISIONS, ALLOWED_AS_GATE_ONLY, autoDecisionLabel, autoDecisionOverride, isAutoDecisionId } from '../data/auto-decisions.js';
import { noteAutoDecision, printAutoDecisions } from './start.js';

const START_PATH = join(import.meta.dirname, 'start.js');
const SOURCE = readFileSync(START_PATH, 'utf-8');

/** 从一个函数声明行开始，按花括号深度切到配对的 `}`。 */
function functionBody(lines, startIndex) {
  let depth = 0;
  let started = false;
  const body = [];
  for (let index = startIndex; index < lines.length; index++) {
    body.push(lines[index]);
    for (const ch of lines[index]) {
      if (ch === '{') { depth += 1; started = true; }
      else if (ch === '}') depth -= 1;
    }
    if (started && depth <= 0) return { body, end: index };
  }
  return { body, end: lines.length - 1 };
}

/** 机械切出每个函数体（只认 `function` 声明 —— start.js 里全是这种写法）。 */
function collectFunctions(source) {
  const lines = source.split(/\r?\n/);
  const rows = [];
  let index = 0;
  while (index < lines.length) {
    const m = /^(?:export )?(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/.exec(lines[index]);
    if (!m) { index += 1; continue; }
    const { body, end } = functionBody(lines, index);
    rows.push({ name: m[1], body: body.join('\n') });
    index = end + 1;
  }
  return rows;
}

describe('自主决定登记表', () => {
  it('每项都有名字和覆盖方式（没写覆盖方式 = 用户改不了）', () => {
    expect(AUTO_DECISIONS.size).toBeGreaterThanOrEqual(6);
    for (const [id, meta] of AUTO_DECISIONS) {
      expect(id.trim()).toBe(id);
      expect(meta.label.trim().length).toBeGreaterThan(0);
      expect(meta.override.trim().length).toBeGreaterThan(0);
    }
    expect(isAutoDecisionId('target-path')).toBe(true);
    expect(isAutoDecisionId('nope')).toBe(false);
    expect(autoDecisionLabel('nope')).toContain('nope');
    expect(autoDecisionOverride('nope')).toBe('没有声明覆盖方式');
  });

  it('被门禁豁免的函数必须给出理由（写不出理由就不许豁免）', () => {
    const names = new Set(collectFunctions(SOURCE).map((f) => f.name));
    for (const [name, reason] of ALLOWED_AS_GATE_ONLY) {
      expect(names.has(name)).toBe(true);
      expect(reason.trim().length).toBeGreaterThan(10);
    }
  });
});

describe('start.js 里提到 options.auto 的每个函数都得交代清楚', () => {
  const functions = collectFunctions(SOURCE);
  const touching = functions.filter((f) => /options\??\.auto/.test(f.body));

  it('扫描本身不是空跑（找得到函数、也找得到提到 auto 的函数）', () => {
    expect(functions.length).toBeGreaterThan(80);
    expect(touching.length).toBeGreaterThanOrEqual(6);
    // 正则本身得真能命中
    expect(SOURCE).toContain('options.auto');
  });

  it('三类之外没有漏网的：披露 / 问人 / 纯判定', () => {
    const offenders = touching
      .filter((f) => !f.body.includes('noteAutoDecision('))
      .filter((f) => !f.body.includes('inquirer.prompt'))
      .filter((f) => !f.body.includes('markAwaiting('))
      .filter((f) => !f.body.includes('awaiting'))
      .filter((f) => !ALLOWED_AS_GATE_ONLY.has(f.name))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  it('披露用的 id 全部登记过（写错名字当场红，不留到运行时）', () => {
    const used = [...SOURCE.matchAll(/noteAutoDecision\([^,]+,[^,]+,\s*'([^']+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThanOrEqual(6);
    expect(used.filter((id) => !isAutoDecisionId(id))).toEqual([]);
  });
});

describe('noteAutoDecision 记下什么', () => {
  it('逐条入表，带标签、步骤号、是否登记', () => {
    const context = {};
    noteAutoDecision(context, { step: 4, action: 'confirm' }, 'confirm-answer', '要不要跑 sweep → false');
    noteAutoDecision(context, null, 'target-path', 'E:/proj');
    noteAutoDecision(context, { step: 9, action: 'x' }, 'not-registered', 'y');
    expect(context._autoDecisions).toHaveLength(3);
    expect(context._autoDecisions[0]).toMatchObject({ id: 'confirm-answer', step: 4, action: 'confirm', registered: true });
    expect(context._autoDecisions[0].label).toBe('确认题的回答');
    expect(context._autoDecisions[1]).toMatchObject({ step: null, decided: 'E:/proj' });
    // 未登记的 id 照样进表（可见），但 marked registered=false，收尾会点名
    expect(context._autoDecisions[2].registered).toBe(false);
    expect(context._autoDecisions[2].label).toContain('未登记');
  });

  it('没有 context 时安静返回（dry-run / 工具函数调用不该炸）', () => {
    expect(() => noteAutoDecision(null, null, 'theme', 'x')).not.toThrow();
  });

  it('重复调用不会互相覆盖（一次运行里同一个决定可能做好几次）', () => {
    const context = {};
    noteAutoDecision(context, { step: 1, action: 'a' }, 'modes', 'quick');
    noteAutoDecision(context, { step: 2, action: 'b' }, 'modes', 'deep');
    expect(context._autoDecisions.map((r) => r.decided)).toEqual(['quick', 'deep']);
  });
});

describe('收尾打印：说了做了什么，也说了怎么改', () => {
  afterEach(() => vi.restoreAllMocks());

  it('打印每一项的标签、取值和覆盖方式', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const context = {};
      noteAutoDecision(context, { step: 4, action: 'confirm' }, 'confirm-answer', '不跑 sweep');
      noteAutoDecision(context, null, 'target-path', 'E:/proj');
      printAutoDecisions(context);
      const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('--auto 替你做的决定（共 2 项');
      expect(out).toContain('Step 4 confirm: 确认题的回答 → 不跑 sweep');
      expect(out).toContain('目标项目路径 → E:/proj');
      expect(out).toContain('--yes / --decline');
      expect(out).toContain('--target');
    } finally {
      spy.mockRestore();
    }
  });

  it('一份都没有时一个字都不打印（不给用户「有这么个表」的错觉）', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      printAutoDecisions({});
      printAutoDecisions(null);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('未登记的类别在屏幕上点名', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const context = {};
      noteAutoDecision(context, { step: 1, action: 'x' }, 'typo-id', 'y');
      printAutoDecisions(context);
      const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('未登记的类别');
      expect(out).toContain('data/auto-decisions.js');
    } finally {
      spy.mockRestore();
    }
  });
});
