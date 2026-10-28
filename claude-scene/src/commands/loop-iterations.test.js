import { describe, it, expect } from 'vitest';
import { resolveIterations, shouldStopLooping, deriveStepStatus, spinnerMethodFor, paintByStatus, normalizeStepStatus } from './start.js';

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

  it('发现数没下降就停止空转（避免 N 轮同一批问题）', () => {
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 940 }))
      .toMatchObject({ stop: true, reason: 'no-progress' });
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 950 }).stop).toBe(true);
  });

  it('--force-iterations 显式要求跑满时不因 no-progress 停，但仍停在 max/clean', () => {
    const forced = shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 940, force: true });
    expect(forced.stop).toBe(false);
    expect(forced.reason).toBe('no-progress-forced');
    expect(forced.message).toContain('继续');
    expect(shouldStopLooping({ iteration: 10, max: 10, prevFindings: 940, findings: 940, force: true }).reason).toBe('max');
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 0, force: true }).reason).toBe('clean');
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

  // 以前认不出的 status 会掉回文本启发式：`{status:'error', message:'EACCES'}` 里没有
  // 「失败」二字，就被记成 ✓ pass。现在认不出 = 状态不明 = warn（可见），绝不猜成 pass。
  it('未知 status 记 warn，不回落文本启发式', () => {
    expect(deriveStepStatus({ status: 'weird', message: '已跳过该步骤' }, { lastStepFailed: false }).stepStatus).toBe('warn');
    expect(deriveStepStatus({ status: 'error', message: 'EACCES: permission denied' }, { lastStepFailed: false }).stepStatus).toBe('fail');
  });

  it('处理器的同义 status 归一成五态', () => {
    expect(normalizeStepStatus('success')).toBe('pass');
    expect(normalizeStepStatus('created')).toBe('pass');
    expect(normalizeStepStatus('EXISTS')).toBe('noop');
    expect(normalizeStepStatus('skipped')).toBe('skip');
    expect(normalizeStepStatus('not_found')).toBe('skip');
    expect(normalizeStepStatus('issues')).toBe('warn');
    expect(normalizeStepStatus('failed')).toBe('fail');
    expect(normalizeStepStatus()).toBeNull();
    expect(normalizeStepStatus('')).toBeNull();
  });

  it('纯文本结果行为不变', () => {
    expect(deriveStepStatus('代码审查完成（无问题）', { lastStepFailed: false }).stepStatus).toBe('pass');
    expect(deriveStepStatus('任务失败', { lastStepFailed: false }).stepStatus).toBe('fail');
  });
});

// 这两个文案曾经都被判成 warn，于是 /check 明明 0 问题却显示「⚡ warn: 2」。
// 状态启发式看的是文字，文字里带数字和「重复」就必须分清「0 个」和「未重复」。
describe('deriveStepStatus 文本启发式', () => {
  const ctx = () => ({ lastStepFailed: false });

  it('0 个问题不是告警', () => {
    expect(deriveStepStatus('11 道检查完成: 0 个问题', ctx()).stepStatus).toBe('pass');
    expect(deriveStepStatus('扫描 0 处发现', ctx()).stepStatus).toBe('pass');
  });

  it('真有问题才算告警', () => {
    expect(deriveStepStatus('发现 3 个问题', ctx()).stepStatus).toBe('warn');
    expect(deriveStepStatus('3 处警告', ctx()).stepStatus).toBe('warn');
  });

  it('"failed" 被 detectHandlerFailure 先一步判成 fail（不走 warn）', () => {
    expect(deriveStepStatus('3 failed', ctx()).stepStatus).toBe('fail');
  });

  it('「未重复写入」是去重的正常路径', () => {
    expect(deriveStepStatus('记忆内容与最近记录相同，4 个后端均未重复写入（正常去重，本轮无新增）', ctx()).stepStatus).toBe('pass');
    expect(deriveStepStatus('检测到 2 处重复记录', ctx()).stepStatus).toBe('warn');
  });
});

describe('逐行输出不再假绿（失败步骤不能打绿色 ✔）', () => {
  it('fail 状态走 spinner.fail', () => {
    expect(spinnerMethodFor('fail')).toBe('fail');
  });

  it('warn / noop 走 spinner.warn', () => {
    expect(spinnerMethodFor('warn')).toBe('warn');
    expect(spinnerMethodFor('noop')).toBe('warn');
  });

  it('pass / skip / 未知状态不会假装失败', () => {
    expect(spinnerMethodFor('pass')).toBe('succeed');
    // 跳过不打 ✔：没跑与跑干净必须能分辨
    expect(spinnerMethodFor('skip')).toBe('info');
  });

  it('paintByStatus 给失败打 ✖ 前缀', () => {
    expect(paintByStatus('fail', '出错')).toContain('✖');
    expect(paintByStatus('warn', '告警')).toContain('⚡');
    expect(paintByStatus('noop', '无事')).toContain('○');
    expect(paintByStatus('pass', '正常')).toContain('正常');
  });
});
