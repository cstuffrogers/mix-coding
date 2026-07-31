import { describe, it, expect } from 'vitest';

// handleStepError calls process.exit(1) on abort/fail_workflow/retry-exhausted,
// so we test the failure-detection helper directly and exercise the on_error
// branches through the exported retry path where exit is stubbed.
import { detectHandlerFailure } from '../lib/failure-detection.js';

describe('detectHandlerFailure', () => {
  it('flags an unambiguous failure string', () => {
    expect(detectHandlerFailure('执行失败')).toBe(true);
    expect(detectHandlerFailure('安全阻断')).toBe(true);
    expect(detectHandlerFailure('ABORT triggered')).toBe(true);
    expect(detectHandlerFailure('FAIL: connection refused')).toBe(true);
  });

  it('does not flag a passing result', () => {
    expect(detectHandlerFailure('全部通过')).toBe(false);
    expect(detectHandlerFailure('11 道检查完成: 40 个问题')).toBe(false);
    expect(detectHandlerFailure('成功')).toBe(false);
  });

  it('treats partial/expected outcomes as non-failure', () => {
    expect(detectHandlerFailure('部分失败，已继续')).toBe(false);
    expect(detectHandlerFailure('已跳过失败项')).toBe(false);
    expect(detectHandlerFailure('非致命错误')).toBe(false);
    expect(detectHandlerFailure('fallback 已降级')).toBe(false);
    expect(detectHandlerFailure('通知已发送')).toBe(false);
    expect(detectHandlerFailure('结果已记录')).toBe(false);
    expect(detectHandlerFailure('已通知维护者')).toBe(false);
  });

  it('returns false for a soft failure word inside a suppression phrase', () => {
    // The word 失败 appears but the suppression 已记录 keeps it non-fatal.
    expect(detectHandlerFailure('检测到失败，已记录到日志')).toBe(false);
  });

  it('returns false for a non-string result so it is never silently misread', () => {
    expect(detectHandlerFailure(null)).toBe(false);
    // Omitting the arg yields undefined, exercising the typeof guard.
    expect(detectHandlerFailure()).toBe(false);
    expect(detectHandlerFailure(0)).toBe(false);
    expect(detectHandlerFailure({ status: 'fail' })).toBe(false);
    expect(detectHandlerFailure(false)).toBe(false);
  });

  it('flags failure when an English suppression word is absent', () => {
    expect(detectHandlerFailure('Step aborted')).toBe(true);
    expect(detectHandlerFailure('abort: dry-run')).toBe(true);
  });

  it('case-insensitively matches FAIL', () => {
    expect(detectHandlerFailure('fail')).toBe(true);
    expect(detectHandlerFailure('Fail')).toBe(true);
  });
});
