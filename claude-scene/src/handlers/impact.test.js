import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleImpactReport } from './impact.js';

const REPORT = {
  changedFiles: ['src/a.js', 'src/b.js'],
  callers: ['src/c.js:12', 'src/d.js:7', 'src/e.js:3'],
  riskLevel: 'medium',
};

let dir;

function writeReport(name, payload) {
  const reportsDir = join(dir, '.claude', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, name), typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function fakeStamp(offsetSeconds) {
  const base = new Date('2026-01-01T00:00:00.000Z').getTime();
  return new Date(base + offsetSeconds * 1000).toISOString().replaceAll(/[:.]/g, '-');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'impact-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('handleImpactReport 三态', () => {
  it('没有产物 → warn（修复范围未评估，不谎报 via pass）', () => {
    const ctx = {};
    const result = handleImpactReport('impactReport', {}, dir, ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('修复范围未评估');
    expect(ctx.impactReported).toBe(false);
  });

  it('产物合法 → pass，并把风险/规模写进上下文', () => {
    writeReport(`impact-${fakeStamp(0)}.json`, REPORT);
    const ctx = {};
    const result = handleImpactReport('impactReport', {}, dir, ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('改 2 个文件');
    expect(result.message).toContain('3 处调用方');
    expect(ctx.impactReported).toBe(true);
    expect(ctx.impactRiskLevel).toBe('medium');
    expect(ctx.impactChangedCount).toBe(2);
    expect(ctx.impactCallerCount).toBe(3);
  });

  it('高风险 → warn（不阻断但要点名）', () => {
    writeReport(`impact-${fakeStamp(0)}.json`, { ...REPORT, riskLevel: 'high' });
    const result = handleImpactReport('impactReport', {}, dir, {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('高风险');
  });

  it('取最新一份产物，不用旧的', () => {
    writeReport(`impact-${fakeStamp(0)}.json`, { changedFiles: ['old.js'], callers: [], riskLevel: 'low' });
    writeReport(`impact-${fakeStamp(60)}.json`, REPORT);
    const result = handleImpactReport('impactReport', {}, dir, {});
    expect(result.message).toContain('改 2 个文件');
  });

  it.each([
    ['JSON 坏掉', '{ not json'],
    ['缺 changedFiles', { callers: [], riskLevel: 'low' }],
    ['changedFiles 空数组', { changedFiles: [], callers: [], riskLevel: 'low' }],
    ['缺 callers', { changedFiles: ['a.js'], riskLevel: 'low' }],
    ['riskLevel 不合法', { changedFiles: ['a.js'], callers: [], riskLevel: 'very-high' }],
  ])('产物不合格（%s）→ warn 并说明原因', (_label, payload) => {
    writeReport(`impact-${fakeStamp(0)}.json`, payload);
    const ctx = {};
    const result = handleImpactReport('impactReport', {}, dir, ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('修复范围未评估');
    expect(ctx.impactReported).toBe(false);
    expect(ctx.impactProblem).toBeTruthy();
  });

  it('不是 impact-*.json 的报告不算影响域产物', () => {
    writeReport(`fence-${fakeStamp(0)}.json`, REPORT);
    const result = handleImpactReport('impactReport', {}, dir, {});
    expect(result.status).toBe('warn');
  });
});
