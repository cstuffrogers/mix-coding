import { describe, it, expect } from 'vitest';
import { resolveIterations, shouldStopLooping, deriveStepStatus } from './start.js';

// 回归：`claude-scene start loop --auto "循环10次"` 之前只是把「循环10次」当纯文本塞进
// prompt —— 引擎根本没有迭代概念，一次就结束。现在 --iterations 才是真驱动。
describe('resolveIterations', () => {
  it('默认 1 轮，保持旧行为', () => {
    expect(resolveIterations({}, {})).toBe(1);
    expect(resolveIterations()).toBe(1);
  });

  it('读 --iterations，字符串数字也认', () => {
    expect(resolveIterations({ iterations: '10' }, {})).toBe(10);
    expect(resolveIterations({ iterations: 7 }, {})).toBe(7);
  });

  it('场景可声明默认轮数，CLI 优先', () => {
    expect(resolveIterations({}, { iterations: 5 })).toBe(5);
    expect(resolveIterations({ iterations: 2 }, { iterations: 5 })).toBe(2);
  });

  it('非法值回落 1，超大值封顶 20', () => {
    expect(resolveIterations({ iterations: 'abc' }, {})).toBe(1);
    expect(resolveIterations({ iterations: 0 }, {})).toBe(1);
    expect(resolveIterations({ iterations: 999 }, {})).toBe(20);
  });
});

describe('shouldStopLooping', () => {
  it('跑满轮数即停', () => {
    const d = shouldStopLooping({ iteration: 10, max: 10, prevFindings: 100, findings: 50 });
    expect(d.stop).toBe(true);
    expect(d.reason).toBe('max');
  });

  it('本轮干净提前结束', () => {
    const d = shouldStopLooping({ iteration: 1, max: 10, prevFindings: null, findings: 0 });
    expect(d).toMatchObject({ stop: true, reason: 'clean' });
  });

  it('发现数下降时继续下一轮', () => {
    const d = shouldStopLooping({ iteration: 1, max: 10, prevFindings: null, findings: 900 });
    expect(d.stop).toBe(false);
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 900, findings: 400 }).stop).toBe(false);
  });

  it('发现数没下降就停止空转（避免 10 轮同一批问题）', () => {
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 940 }))
      .toMatchObject({ stop: true, reason: 'no-progress' });
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 950 }).stop).toBe(true);
  });
});

// 处理器可以直接布状态（三态检查），不该再靠正则猜 pass
describe('deriveStepStatus 显式状态', () => {
  it('处理器返回 {status} 时以它为准', () => {
    expect(deriveStepStatus({ status: 'skip', message: '没跑成' }, { lastStepFailed: false }).stepStatus).toBe('skip');
    expect(deriveStepStatus({ status: 'warn', message: '部分检查未执行' }, { lastStepFailed: false }).stepStatus).toBe('warn');
    expect(deriveStepStatus({ status: 'pass', message: '代码审查完成（无问题）' }, { lastStepFailed: false }).stepStatus).toBe('pass');
  });

  it('显式状态的 message 仍用于展示', () => {
    const { resultStr } = deriveStepStatus({ status: 'skip', message: '类型检查跳过' }, { lastStepFailed: false });
    expect(resultStr).toBe('类型检查跳过');
  });

  it('未知 status 回落到文本启发式', () => {
    expect(deriveStepStatus({ status: 'weird', message: '已跳过该步骤' }, { lastStepFailed: false }).stepStatus).toBe('noop');
  });

  it('纯文本结果行为不变', () => {
    expect(deriveStepStatus('代码审查完成（无问题）', { lastStepFailed: false }).stepStatus).toBe('pass');
    expect(deriveStepStatus('任务失败', { lastStepFailed: false }).stepStatus).toBe('fail');
  });
});
