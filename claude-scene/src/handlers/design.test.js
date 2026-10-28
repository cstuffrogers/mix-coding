import { describe, it, expect } from 'vitest';
import { deriveMetricsFromContext, handlePersist } from './design.js';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

describe('handlePersist：不许把 unknown 当数据写进设计档案', () => {
  const mkTmp = () => mkdtempSync(join(tmpdir(), 'mix-coding-design-'));

  it('selected 为空时写 null 并 warn，而不是 variant:"unknown"', () => {
    const dir = mkTmp();
    const r = handlePersist('persist', {}, dir, {});
    expect(r.status).toBe('warn');
    expect(r.message).toContain('没有任何设计选择');
    const saved = JSON.parse(readFileSync(join(dir, '.claude', 'designs', 'current.json'), 'utf-8'));
    expect(saved.variant).toBeNull();
    expect(saved.selected).toBeNull();
    expect(JSON.stringify(saved)).not.toContain('unknown');
  });

  it('有选择时写进 variant 并点名', () => {
    const dir = mkTmp();
    const r = handlePersist('persist', {}, dir, { design_selected: 'linear' });
    expect(r).toContain('linear');
    const saved = JSON.parse(readFileSync(join(dir, '.claude', 'designs', 'current.json'), 'utf-8'));
    expect(saved.variant).toBe('linear');
    expect(saved.selected).toBe('linear');
  });
});
