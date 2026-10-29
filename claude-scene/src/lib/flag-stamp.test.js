import { describe, it, expect } from 'vitest';
import { snapshotFlags, stampFlagWrites, flagWrittenAt, staleFlagDetail, staleFlags } from './flag-stamp.js';
import { explainCondition } from './conditions.js';

// 维度：**多轮（--iterations N）下 context 旗标的归属**。
//
// 每轮都重跑整条 flow，但 context 是同一个对象。第 1 轮写下的
// `testPassed = false` 在第 2 轮 test 那一步没跑时依然躺在 context 上，
// 后面的条件读到它就像读到了本轮结论 —— 报告看不出区别，行为差一个分支。
// 这里钉住两件事：写过就记轮次；早前轮次的值不算本轮的答案。

function simulateRound(context, iteration, mutate) {
  const snap = snapshotFlags(context);
  context.iteration = iteration;
  mutate(context);
  return stampFlagWrites(context, snap, { step: 1, iteration });
}

describe('flag-stamp：旗标记账', () => {
  it('只记被动过的键，没动的键不冒领', () => {
    const context = { iteration: 1, untouched: 'x' };
    const touched = simulateRound(context, 1, (ctx) => {
      ctx.testPassed = false;
    });
    expect(touched).toContain('testPassed');
    expect(touched).not.toContain('untouched');
    expect(flagWrittenAt(context, 'testPassed')).toBe(1);
    expect(flagWrittenAt(context, 'untouched')).toBeNull();
  });

  it('同一轮内重写仍是这一轮的：不会把本轮的测量误判成旧值', () => {
    const context = { iteration: 1 };
    simulateRound(context, 1, (ctx) => { ctx.lintPassed = true; });
    simulateRound(context, 1, (ctx) => { ctx.lintPassed = false; });
    expect(staleFlags(context)).toEqual([]);
  });

  it('第 2 轮没重新测量 → 该键算旧值（这才是本维度要抓的）', () => {
    const context = { iteration: 1 };
    simulateRound(context, 1, (ctx) => { ctx.deadCodePassed = true; });
    // 第 2 轮什么也没写
    context.iteration = 2;
    expect(staleFlags(context)).toEqual(['deadCodePassed']);
    expect(staleFlagDetail(context)).toEqual([{ key: 'deadCodePassed', iteration: 1, step: 1 }]);
  });

  it('第 2 轮重新测了就不再是旧值', () => {
    const context = { iteration: 1 };
    simulateRound(context, 1, (ctx) => { ctx.deadCodePassed = true; });
    simulateRound(context, 2, (ctx) => { ctx.deadCodePassed = false; });
    expect(staleFlags(context)).toEqual([]);
    expect(flagWrittenAt(context, 'deadCodePassed')).toBe(2);
  });

  it('被删掉的键也算这一步动过（不会留着上轮的归属）', () => {
    const context = { iteration: 1, tmp: 1 };
    simulateRound(context, 1, (ctx) => { ctx.tmp = 2; });
    simulateRound(context, 2, (ctx) => { delete ctx.tmp; });
    expect(flagWrittenAt(context, 'tmp')).toBe(2);
  });

  it('单轮跑（iteration 1）永远不产生旧值', () => {
    const context = { iteration: 1 };
    simulateRound(context, 1, (ctx) => { ctx.testPassed = false; });
    expect(staleFlags(context)).toEqual([]);
  });
});

describe('conditions：早前轮次留下的旗标不算本轮答案', () => {
  const base = () => ({ iteration: 1, lastStepFailed: false });

  it('本轮写过 → 按真值判定，不报未判定', () => {
    const context = base();
    simulateRound(context, 1, (ctx) => { ctx.testPassed = false; });
    const r = explainCondition('testPassed', context);
    expect(r.met).toBe(false);
    expect(r.unknown).toEqual([]);
    expect(r.stale).toEqual([]);
  });

  it('上一轮的 testPassed=false 不能当本轮结论 → 未判定，并点名是哪一轮的', () => {
    const context = base();
    simulateRound(context, 1, (ctx) => { ctx.testPassed = false; });
    context.iteration = 2;
    const r = explainCondition('testPassed', context);
    expect(r.met).toBe(false);
    // 关键：met 仍是「真跑起来会怎么做」，但同时必须承认它是未判定的（不是「确定不满足」）
    expect(r.unknown).toContain('testPassed');
    expect(r.determinable).toBe(false);
    expect(r.stale).toEqual([{ key: 'testPassed', iteration: 1, step: 1 }]);
  });

  it('短路仍然生效：本轮已确定的键先定局，旧值不干扰', () => {
    const context = { iteration: 1, lastStepFailed: false };
    simulateRound(context, 1, (ctx) => { ctx.testPassed = false; });
    context.iteration = 2;
    context.hasHardConflict = false;
    expect(explainCondition('hasHardConflict && testPassed', context).met).toBe(false);
    expect(explainCondition('hasHardConflict && testPassed', context).unknown).toEqual([]);
  });

  it('旧值为 true 时也不白送一个「满足」', () => {
    const context = base();
    simulateRound(context, 1, (ctx) => { ctx.lintPassed = true; });
    context.iteration = 2;
    // 本轮没人测过 lint —— 条件“成立”只是上轮的旧值，必须点名（否则就是默认它仍然成立）
    const r = explainCondition('lintPassed', context);
    expect(r.met).toBe(true);
    expect(r.stale).toEqual([{ key: 'lintPassed', iteration: 1, step: 1 }]);
  });
});
