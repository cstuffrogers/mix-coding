import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleEnclosureMetrics, summarizeEnclosure, verdictOf } from './enclosure-metrics.js';

const NEWLINE = String.fromCodePoint(10);

let dir;

function writeLedger(events) {
  const reports = join(dir, '.claude', 'reports');
  mkdirSync(reports, { recursive: true });
  writeFileSync(
    join(reports, 'enclosure-events.jsonl'),
    events.map((e) => JSON.stringify(e)).join(NEWLINE) + NEWLINE,
    'utf-8',
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrics-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('summarizeEnclosure：把台账聚合成能看趋势的数字', () => {
  it('空台账 → 比率是 null（未测量），不是 0', () => {
    const summary = summarizeEnclosure([]);
    expect(summary.captures).toBe(0);
    expect(summary.violationRate).toBeNull();
    expect(summary.impactMissingRate).toBeNull();
  });

  it('按类型计数并算越界率', () => {
    const summary = summarizeEnclosure([
      { type: 'capture', testCount: 10 },
      { type: 'verify', violations: 0 },
      { type: 'verify', violations: 2 },
      { type: 'restore', restored: 1 },
      { type: 'impact', ok: true },
      { type: 'impact', ok: false },
    ]);
    expect(summary.captures).toBe(1);
    expect(summary.verifies).toBe(2);
    expect(summary.violations).toBe(2);
    expect(summary.restores).toBe(1);
    expect(summary.violationRate).toBe(1);
    expect(summary.impactMissingRate).toBe(0.5);
  });
});

describe('verdictOf：阈值判读', () => {
  it('从没比对过 → skip（没数据不等于没越界）', () => {
    expect(verdictOf(summarizeEnclosure([])).status).toBe('skip');
  });

  it('越界率过高 → warn', () => {
    const summary = summarizeEnclosure([
      { type: 'capture' },
      { type: 'verify', violations: 3 },
      { type: 'verify', violations: 3 },
    ]);
    expect(verdictOf(summary).status).toBe('warn');
  });

  it('影响域缺失率过高 → warn', () => {
    const summary = summarizeEnclosure([
      { type: 'capture' },
      { type: 'verify', violations: 0 },
      { type: 'impact', ok: false },
      { type: 'impact', ok: false },
      { type: 'impact', ok: true },
    ]);
    expect(verdictOf(summary).status).toBe('warn');
  });

  it('干净台账 → pass', () => {
    const summary = summarizeEnclosure([
      { type: 'capture' },
      { type: 'verify', violations: 0 },
      { type: 'impact', ok: true },
    ]);
    expect(verdictOf(summary).status).toBe('pass');
  });
});

describe('handleEnclosureMetrics：三态 + 落盘', () => {
  it('没有台账 → skip（不冒充「零越界」）', () => {
    const result = handleEnclosureMetrics('enclosureMetrics', {}, dir, {});
    expect(result.status).toBe('skip');
  });

  it('有台账 → pass 并把汇总写进 context + 落盘一份快照', () => {
    writeLedger([
      { type: 'capture', testCount: 10 },
      { type: 'verify', violations: 0 },
      { type: 'impact', ok: true },
    ]);
    const ctx = {};
    const result = handleEnclosureMetrics('enclosureMetrics', {}, dir, ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('拍桩 1 次');
    expect(result.message).toContain('越界 0 次');
    expect(ctx.enclosureMetrics.verifies).toBe(1);
    expect(ctx.enclosureVerdict).toBe('pass');

    const files = readdirSync(join(dir, '.claude', 'reports')).filter((f) => f.startsWith('enclosure-metrics-'));
    expect(files).toHaveLength(1);
    const saved = JSON.parse(readFileSync(join(dir, '.claude', 'reports', files[0]), 'utf-8'));
    expect(saved.summary.captures).toBe(1);
  });

  it('越界率过高 → warn 并点名原因', () => {
    writeLedger([
      { type: 'capture' },
      { type: 'verify', violations: 2 },
      { type: 'verify', violations: 2 },
    ]);
    const result = handleEnclosureMetrics('enclosureMetrics', {}, dir, {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('越界率');
  });

  it('台账里的坏行被跳过，不让统计崩掉', () => {
    const reports = join(dir, '.claude', 'reports');
    mkdirSync(reports, { recursive: true });
    writeFileSync(
      join(reports, 'enclosure-events.jsonl'),
      ['{ 坏行', JSON.stringify({ type: 'capture' }), '', '{"no":"type"}', ''].join(NEWLINE),
      'utf-8',
    );
    const result = handleEnclosureMetrics('enclosureMetrics', {}, dir, {});
    // 只剩 1 条合法 capture：能统计出来，但由于从没比对过 → warn（围栏形同虚设）
    expect(result.status).toBe('warn');
    expect(result.message).toContain('拍桩 1 次');
    expect(result.message).toContain('从未比对');
  });

  it('建了围栏却从没比对 → warn（假绿的经典形态）', () => {
    writeLedger([{ type: 'capture' }, { type: 'capture' }]);
    const summary = summarizeEnclosure([{ type: 'capture' }, { type: 'capture' }]);
    expect(verdictOf(summary)).toEqual({ status: 'warn', reason: '围栏建了 2 次但从未比对' });
  });

  it('回滚失败单独计数，不算进「已回滚」', () => {
    const events = [
      { type: 'capture' },
      { type: 'verify', violations: 1 },
      { type: 'restore', restored: 1 },
      { type: 'restore', restored: 0, failed: true },
    ];
    const summary = summarizeEnclosure(events);
    expect(summary.restores).toBe(1);
    expect(summary.restoreFailures).toBe(1);
    expect(verdictOf(summary).status).toBe('warn');
  });});
