import { describe, it, expect } from 'vitest';
import { statusForFindings } from './finding-verdict.js';

describe('statusForFindings：发现数量 → 步骤状态', () => {
  it('没有发现 → pass', () => {
    expect(statusForFindings(0)).toBe('pass');
    expect(statusForFindings(0, { severity: 'critical' })).toBe('pass');
  });

  it('error / critical → fail（工具自己的最高档）', () => {
    expect(statusForFindings(1, { severity: 'error' })).toBe('fail');
    expect(statusForFindings(3, { severity: 'critical' })).toBe('fail');
  });

  it('warning（默认）/ info / note → warn：真实问题但不冒充硬错误', () => {
    expect(statusForFindings(27)).toBe('warn');
    expect(statusForFindings(5, { severity: 'warning' })).toBe('warn');
    expect(statusForFindings(2, { severity: 'info' })).toBe('warn');
    expect(statusForFindings(2, { severity: 'note' })).toBe('warn');
  });

  it('未识别的 severity 直接抛错，不静默降级成 warning', () => {
    expect(() => statusForFindings(1, { severity: 'blocker' })).toThrow(/未知 severity/);
    expect(() => statusForFindings(1, { severity: 'HIGH' })).toThrow(/未知 severity/);
  });

  it('数量不是真实测量（NaN / 负数 / 小数 / 字符串）就抛错，不许当成「没问题」', () => {
    for (const bad of [NaN, -1, 2.5, '3', null, undefined]) {
      expect(() => statusForFindings(bad)).toThrow(/count 必须是 ≥0 的整数/);
    }
  });

  it('不变量：只有 0 个发现才可能拿到 pass（「有问题」永远不是绿）', () => {
    const counts = [1, 2, 27, 105];
    const severities = ['critical', 'error', 'warning', 'info', 'note'];
    for (const count of counts) {
      for (const severity of severities) {
        expect(statusForFindings(count, { severity })).not.toBe('pass');
      }
    }
  });
});
