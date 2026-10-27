import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleDetectorReport } from './detector-report.js';
import { safeExec } from '../lib/safe-exec.js';

vi.mock('../lib/safe-exec.js', () => ({ safeExec: vi.fn() }));
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

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

/** git 三个查询各自返回什么（show-toplevel 默认就是 root，status 默认干净） */
function mockGit({ top, head, status = '' } = {}) {
  vi.mocked(safeExec).mockImplementation((cmd) => {
    const command = String(cmd);
    if (command.includes('--show-toplevel')) return Buffer.from(`${top ?? root}\n`);
    if (command.includes('status --porcelain')) return Buffer.from(`${status}\n`);
    return Buffer.from(`${head ?? HEAD}\n`);
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'detector-report-'));
  mockGit();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.mocked(safeExec).mockReset();
  vi.mocked(execFileSync).mockReset();
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

  it('在子目录里被调起时，按 git 仓库根找产物（否则会误报「没有记录」）', () => {
    mkdirSync(join(root, 'claude-scene'));
    writeReport(clean);
    const result = handleDetectorReport('detectorReport', {}, join(root, 'claude-scene'), {});

    expect(result.status).toBe('pass');
    expect(result.message).toContain('12/12');
  });

  it('产物是在有未提交改动时跑的 → warn', () => {
    writeReport({ ...clean, workingTreeDirty: true });
    const result = handleDetectorReport('detectorReport', {}, root, {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('未提交改动');
  });
});

describe('detectorReport —— --with-sweep 现场自检（跑在审查之前，审查本体仍只读）', () => {
  it('工作区干净时现场跑一次，产物新了才出 pass', () => {
    writeReport(clean);
    const result = handleDetectorReport('detectorReport', {}, root, { withSweep: true });

    expect(execFileSync).toHaveBeenCalledOnce();
    expect(String(vi.mocked(execFileSync).mock.calls[0][1])).toContain('detector-sweep.cjs');
    expect(result.status).toBe('pass');
    expect(result.message).toContain('本轮现场自检');
  });

  it('工作区脏时不跑（脏着跑出来的记录一样不可信），直接 warn', () => {
    mockGit({ status: ' M src/x.js' });
    writeReport(clean);
    const result = handleDetectorReport('detectorReport', {}, root, { withSweep: true });

    expect(execFileSync).not.toHaveBeenCalled();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('跳过现场自检');
  });

  it('没传 --with-sweep 就不跑（默认行为不变，只读产物）', () => {
    writeReport(clean);
    handleDetectorReport('detectorReport', {}, root, {});

    expect(execFileSync).not.toHaveBeenCalled();
  });
});
