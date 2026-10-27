import { Buffer } from 'node:buffer';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleDetectorReport } from './detector-report.js';
import { safeExec } from '../lib/safe-exec.js';

vi.mock('../lib/safe-exec.js', () => ({ safeExec: vi.fn() }));

const HEAD = 'aaaabbbbccccdddd';
let root;

/** 产物目录 + 一份自检记录 */
function writeReport(payload, { raw } = {}) {
  const dir = join(root, '.claude', 'reports');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'detector-sweep-2026-06-01T00-00-00-000Z.json'),
    raw ?? JSON.stringify({ stamp: '2026-06-01T00:00:00.000Z', gitSha: HEAD, workingTreeDirty: false, total: 12, passed: 12, stale: [], failed: [], ...payload }, undefined, 2),
  );
}

const clean = { total: 12, passed: 12, stale: [], failed: [] };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'detector-report-'));
  vi.mocked(safeExec).mockReturnValue(Buffer.from(`${HEAD}\n`));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.mocked(safeExec).mockReset();
});

describe('detectorReport —— 只消费产物，不在 review 里跑变异测试', () => {
  it('没有自检记录时报 skip，绝不报 pass（没验 ≠ 验过了）', () => {
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('skip');
    expect(result.message).toContain('未验');
    expect(result.message).toContain('npm run detector:sweep');
  });

  it('产物不是合法 JSON 时 skip，不拿半截数据当结论', () => {
    writeReport({}, { raw: '{ 坏掉的 json' });
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('skip');
    expect(result.message).toContain('不是合法 JSON');
  });

  it('产物缺 total/failed 等字段时 skip（形状不对等于没有）', () => {
    writeReport({ total: undefined, passed: undefined });
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('skip');
    expect(result.message).toContain('total');
  });

  it('12/12 且 HEAD 一致、工作区干净 → pass', () => {
    writeReport(clean);
    const context = {};
    const result = handleDetectorReport('detectorReport', {}, root, context);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('12/12');
    expect(context.detectorSweepPassed).toBe(12);
  });

  it('有 failed 条目时 warn 并点名（守卫是空的）', () => {
    writeReport({ ...clean, passed: 10, failed: ['假绿哨兵：skip 打绿', '围栏：零通过'] });
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('守卫是空的');
    expect(result.message).toContain('围栏：零通过');
  });

  it('有 stale 条目时 warn（注入点过期 = 守卫可能和代码脱节）', () => {
    writeReport({ ...clean, stale: ['场景契约：未知动作'] });
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('注入点已过期');
  });

  it('HEAD 变了 → warn「已过期」，不拿旧结论充数', () => {
    writeReport({ ...clean, gitSha: 'ffffffff00000000' });
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('已过期');
    expect(result.message).toContain('fffffff');
  });

  it('产物是在有未提交改动时跑的 → warn', () => {
    writeReport({ ...clean, workingTreeDirty: true });
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('未提交改动');
  });
});
