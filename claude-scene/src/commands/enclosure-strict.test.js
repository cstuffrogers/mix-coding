import { describe, it, expect } from 'vitest';
import { shouldAbortOnEnclosure } from './start.js';

/**
 * `--strict-enclosure` 的判定必须是个纯函数：它决定「要不要在越界当场停手」，
 * 这种判断不能藏在 process.exit 里，否则只能靠人肉跑一遍才知道对不对。
 */
describe('shouldAbortOnEnclosure：strict 模式越界即中止', () => {
  it('没开 strict → 不中止（默认记账模式）', () => {
    expect(shouldAbortOnEnclosure({ boundaryViolations: ['超出'] })).toBe(false);
    expect(shouldAbortOnEnclosure({})).toBe(false);
    expect(shouldAbortOnEnclosure(null)).toBe(false);
  });

  it('开了 strict 但没越界 → 不中止', () => {
    expect(shouldAbortOnEnclosure({ strictEnclosure: true, boundaryViolations: [] })).toBe(false);
    expect(shouldAbortOnEnclosure({ strictEnclosure: true })).toBe(false);
  });

  it('开了 strict 且越界 → 中止', () => {
    expect(shouldAbortOnEnclosure({ strictEnclosure: true, boundaryViolations: ['变更 80 行超过上限 50'] })).toBe(true);
  });

  it('boundaryViolations 不是数组（处理器没量成）→ 不中止，交给步骤状态说话', () => {
    expect(shouldAbortOnEnclosure({ strictEnclosure: true, boundaryViolations: null })).toBe(false);
    expect(shouldAbortOnEnclosure({ strictEnclosure: true, boundaryViolations: 'oops' })).toBe(false);
  });
});
