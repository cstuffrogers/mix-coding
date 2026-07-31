import { describe, it, expect } from 'vitest';
import { deriveMetricsFromContext } from './design.js';

describe('deriveMetricsFromContext', () => {
  it('returns empty array for empty context', () => {
    expect(deriveMetricsFromContext({})).toEqual([]);
    expect(deriveMetricsFromContext()).toEqual([]);
  });

  it('derives a huashu review percent metric', () => {
    const m = deriveMetricsFromContext({ huashu_review: { percent: 82 } });
    expect(m).toContainEqual({ label: '设计总分', value: '82%' });
  });

  it('derives a HIGH security metric when highSeverityFound is true', () => {
    const m = deriveMetricsFromContext({ securityScanResult: { highSeverityFound: true } });
    const sec = m.find(x => x.label === '安全问题');
    expect(sec.value).toBe('HIGH');
    expect(sec.delta).toBe('需修复');
    expect(sec.deltaPositive).toBe(false);
  });

  it('derives an OK security metric when highSeverityFound is false', () => {
    const m = deriveMetricsFromContext({ securityScanResult: { highSeverityFound: false } });
    const sec = m.find(x => x.label === '安全问题');
    expect(sec.value).toBe('OK');
    expect(sec.deltaPositive).toBe(true);
  });

  it('derives numeric findings metrics as strings', () => {
    const m = deriveMetricsFromContext({ codeMetricsFindings: 7, antiPatternFindings: 3 });
    expect(m).toContainEqual({ label: '复杂度问题', value: '7' });
    expect(m).toContainEqual({ label: '反模式', value: '3' });
  });

  it('does not emit a security metric when highSeverityFound is absent', () => {
    const m = deriveMetricsFromContext({ securityScanResult: {} });
    expect(m.find(x => x.label === '安全问题')).toBeUndefined();
  });
});
