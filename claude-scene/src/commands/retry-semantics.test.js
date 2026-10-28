import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `on_error: retry` 的三条承诺（以前一条都没兑现）：
 *   1. 重试结果要真的被判定 —— 以前无论返回什么都打绿勾；
 *   2. 重试成功要把先前那次 fail 从 stepResults / 汇总里改写掉 ——
 *      以前汇总还是 ✗ fail，收尾摘要点名一个已经不存在的失败；
 *   3. 重试成功要重跑 applyPostStepContext —— 以前只改了 context，没有转发。
 * 外加：重试的处理器反过来要人回答问题（`context._awaitingAnswer`）时，
 * 必须跟首次执行一样中止去问，不许把问题悄悄吞掉再报成功。
 */

vi.mock('../actions.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, executeAction: vi.fn() };
});

const { executeAction } = await import('../actions.js');
const { retryFailedStep, shiftSummary, rewriteStepRecord, bucketOf } = await import('./start.js');

const STEP = { step: 7, action: 'runSuite', on_error: 'retry', description: '跑测试套件' };

/** 一次「失败」的处理器返回值：既走显式 status，又置 lastStepFailed（真实 handler 就这么干） */
function failingResult(message = '执行失败: 3 个用例失败') {
  return (sceneId, action, params, context) => {
    context.lastStepFailed = true;
    return { status: 'fail', message };
  };
}

beforeEach(() => {
  executeAction.mockReset();
});

describe('bucketOf / shiftSummary', () => {
  it('认不出的状态算 pass（与 recordStepResult 的 switch 一致）', () => {
    expect(bucketOf('pass')).toBe('pass');
    expect(bucketOf('fail')).toBe('fail');
    expect(bucketOf('whatever')).toBe('pass');
  });

  it('重试成功：fail 减一、pass 加一', () => {
    const summary = { total: 1, pass: 0, fail: 1, skip: 0, noop: 0, warn: 0 };
    shiftSummary(summary, 'fail', 'pass');
    expect(summary).toMatchObject({ fail: 0, pass: 1, total: 1 });
  });

  it('同桶不折腾（fail→fail 不动计数）', () => {
    const summary = { total: 1, pass: 0, fail: 1, skip: 0, noop: 0, warn: 0 };
    shiftSummary(summary, 'fail', 'fail');
    expect(summary.fail).toBe(1);
  });

  it('不会把计数减成负数', () => {
    const summary = { total: 0, pass: 0, fail: 0, skip: 0, noop: 0, warn: 0 };
    shiftSummary(summary, 'fail', 'pass');
    expect(summary.fail).toBe(0);
    expect(summary.pass).toBe(1);
  });
});

describe('rewriteStepRecord', () => {
  it('改写最近的一条同步骤记录，并标记 retried', () => {
    const results = [
      { step: 7, action: 'runSuite', status: 'fail', detail: '执行失败' },
      { step: 8, action: 'verify', status: 'pass', detail: 'ok' },
    ];
    const updated = rewriteStepRecord(results, 7, 'pass', '全部通过');
    expect(updated).toMatchObject({ step: 7, status: 'pass', detail: '全部通过', retried: true });
    expect(results[1].status).toBe('pass');
  });

  it('没有该步骤时返回 null（不凭空造记录）', () => {
    expect(rewriteStepRecord([{ step: 1 }], 7, 'pass', 'x')).toBeNull();
    expect(rewriteStepRecord(null, 7, 'pass', 'x')).toBeNull();
  });
});

describe('retryFailedStep', () => {
  it('第 2 次成功 → recovered，且记录/汇总不再报 fail', async () => {
    const context = {
      stepResults: [{ step: 7, action: 'runSuite', status: 'fail', detail: '执行失败' }],
    };
    let call = 0;
    executeAction.mockImplementation(() => {
      call++;
      if (call === 1) {
        context.lastStepFailed = true;
        return { status: 'fail', message: '执行失败: 3 个用例失败' };
      }
      context.lastStepFailed = false;
      return { status: 'pass', message: '全部通过（12 个用例）' };
    });

    const outcome = await retryFailedStep(STEP, 'bugfix', {}, context);

    expect(outcome).toBe('recovered');
    expect(executeAction).toHaveBeenCalledTimes(2);
    expect(context.stepResults[0]).toMatchObject({ status: 'pass', retried: true });
    expect(context.lastStepFailed).toBe(false);
  });

  it('一直失败 → exhausted（交给调用方中止，不假装成功）', async () => {
    const context = { stepResults: [] };
    executeAction.mockImplementation(failingResult());

    const outcome = await retryFailedStep(STEP, 'bugfix', {}, context);

    expect(outcome).toBe('exhausted');
    expect(executeAction).toHaveBeenCalledTimes(3);
    expect(context.lastStepFailed).toBe(true);
    // 失败的重试不许往记录里塞一条 pass
    expect(context.stepResults).toEqual([]);
  });

  it('重试返回「失败」文案时不打绿勾（deriveStepStatus 说了算）', async () => {
    const context = { stepResults: [] };
    // 处理器没设 lastStepFailed，但返回了明确的 fail 状态
    executeAction.mockImplementation(() => ({ status: 'fail', message: '安全阻断: 检测到密钥泄露' }));

    const outcome = await retryFailedStep(STEP, 'bugfix', {}, context);

    expect(outcome).toBe('exhausted');
  });

  it('重试的处理器要人回答问题 → awaiting（不许吞掉问题继续）', async () => {
    const context = {
      stepResults: [],
      _awaitingAnswer: undefined,
    };
    executeAction.mockImplementation((sceneId, action, params, ctx) => {
      ctx._awaitingAnswer = { prompt: '选一个主题', options: ['a', 'b'] };
      return { status: 'fail', message: '需要人工选择' };
    });

    const outcome = await retryFailedStep(STEP, 'bugfix', {}, context);

    expect(outcome).toBe('awaiting');
    expect(executeAction).toHaveBeenCalledTimes(1);
  });
});
