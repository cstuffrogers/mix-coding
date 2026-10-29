import { describe, it, expect } from 'vitest';
import { describeNotPassSteps } from './start.js';

// 收尾摘要以前只有计数（fail: 1 / warn: 2），读者拿不到「哪一步、什么原因」。
// 这一组守的是：摘要必须能点名到步骤，而不是只给一个数字。
describe('describeNotPassSteps', () => {
  it('只列非 pass 步骤，并带上步号', () => {
    const { lines, total } = describeNotPassSteps([
      { step: 2, action: 'verify', status: 'pass' },
      { step: 5, action: 'test-coverage', status: 'warn' },
      { step: 7, action: 'checkGate', status: 'fail' },
      { step: 9, action: 'report', status: 'skip' },
    ]);
    expect(total).toBe(3);
    expect(lines).toEqual([
      'Step 5 test-coverage → warn',
      'Step 7 checkGate → fail',
      'Step 9 report → skip',
    ]);
  });

  it('没有 stepResults / 全部通过时保持安静', () => {
    // 契约变更（第十九轮）：返回值多了 idleLines / idleTotal ——
    // noop 以前混在「未通过 / 未执行」里，看着像那一步出了问题。分开后调用方
    // 才能把「真的没过」和「没什么可做」分开显示，所以这里断言完整结构。
    const quiet = { lines: [], total: 0, idleLines: [], idleTotal: 0 };
    expect(describeNotPassSteps()).toEqual(quiet);
    expect(describeNotPassSteps([])).toEqual(quiet);
    expect(describeNotPassSteps([{ step: 1, action: 'verify', status: 'pass' }]).lines).toEqual([]);
  });

  it('noop 不算「未通过」：单独进 idleLines，不进 lines/total', () => {
    const { lines, total, idleLines, idleTotal } = describeNotPassSteps([
      { step: 2, action: 'recall', status: 'noop' },
      { step: 4, action: 'checkGate', status: 'fail' },
      { step: 6, action: 'invokeSkill', status: 'noop' },
    ]);
    expect(lines).toEqual(['Step 4 checkGate → fail']);
    expect(total).toBe(1);
    expect(idleLines).toEqual(['Step 2 recall → noop', 'Step 6 invokeSkill → noop']);
    expect(idleTotal).toBe(2);
  });

  it('全是 noop 时 lines 为空（不会被当成「有步骤没过」）', () => {
    const r = describeNotPassSteps([{ step: 1, action: 'recall', status: 'noop' }]);
    expect(r.lines).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.idleTotal).toBe(1);
  });

  it('缺 status 的脏数据不算步骤（不渲染、也不计数）', () => {
    const { lines, total } = describeNotPassSteps([{ action: 'verify' }, null, { step: 3, action: 'x', status: 'fail' }], 10);
    expect(total).toBe(1);
    expect(lines).toEqual(['Step 3 x → fail']);
  });

  it('有 status 但没步号时用 ? 占位，不假装知道', () => {
    const { lines } = describeNotPassSteps([{ action: 'notify', status: 'warn' }]);
    expect(lines).toEqual(['Step ? notify → warn']);
  });

  it('超过 limit 时只渲染前 limit 条，total 仍是全量', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ step: i + 1, action: 'a', status: 'warn' }));
    const { lines, total } = describeNotPassSteps(many, 3);
    expect(lines).toHaveLength(3);
    expect(total).toBe(20);
  });
});
