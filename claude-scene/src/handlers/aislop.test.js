import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, green: noop, yellow: noop, red: noop, dim: noop } };
});

const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
}));

const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockExistsSync = vi.fn(() => true);
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
}));

import {
  parseAislopOutput, writeAislopReport, handleAislopScan, SAFE_FIX_MAX_FINDINGS,
} from './aislop.js';

// 真实 `aislop ci` 输出是 JSON：{"summary":{"errors":93,"warnings":846,"fixable":537,...}}
const AISLOP_JSON = JSON.stringify({
  schemaVersion: '1',
  score: 4,
  label: 'Critical',
  summary: { errors: 93, warnings: 846, fixable: 537, files: 188, elapsed: '12.7s' },
  engines: { lint: { issues: 257 }, 'ai-slop': { issues: 534 } },
  findingAssessment: { rows: [] },
});

const output = (s) => ({ toString: () => s });

describe('parseAislopOutput', () => {
  it('JSON 输出按 summary 计数，不再逐行数 issue 字样', () => {
    const parsed = parseAislopOutput(AISLOP_JSON);
    expect(parsed.total).toBe(939);
    expect(parsed.fixable).toBe(537);
    expect(parsed.json.score).toBe(4);
  });

  it('文本输出走兜底：认 `N issues` 汇总', () => {
    const parsed = parseAislopOutput('aislop scan\n12 issues found in 3 files\n');
    expect(parsed.total).toBe(12);
    expect(parsed.json).toBeNull();
  });

  it('空输出不算问题', () => {
    expect(parseAislopOutput('').total).toBe(0);
    expect(parseAislopOutput().total).toBe(0);
  });
});

describe('writeAislopReport', () => {
  it('写到 .claude/reports/aislop-*.json 并返回路径', () => {
    const file = writeAislopReport('/proj', { summary: { errors: 1 } });
    expect(file).toMatch(/\.claude[\\/]reports[\\/]aislop-.*\.json$/);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('reports 目录不存在时创建', () => {
    mockExistsSync.mockReturnValueOnce(false);
    writeAislopReport('/proj', { summary: {} });
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('reports'), { recursive: true });
  });
});

describe('handleAislopScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('scan 模式：回落真实计数 + 落盘 + 回写 context', () => {
    mockSafeExec.mockReturnValue(output(AISLOP_JSON));
    const context = {};
    const result = handleAislopScan('aislop-scan', { mode: 'scan' }, '/proj', context);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('939');
    expect(context.aislop_issue_count).toBe(939);
    expect(context.aislop_fixable).toBe(537);
    expect(context.aislop_report_path).toMatch(/aislop-.*\.json$/);
  });

  it('干净时返回 pass', () => {
    mockSafeExec.mockReturnValue(output(JSON.stringify({ summary: { errors: 0, warnings: 0, fixable: 0 } })));
    const result = handleAislopScan('aislop-scan', {}, '/proj', {});
    expect(result.status).toBe('pass');
  });

  it('fix 模式：可修复数超上限时只报警、不动文件', () => {
    mockSafeExec.mockReturnValue(output(AISLOP_JSON));
    const result = handleAislopScan('aislop-fix', { mode: 'fix', maxFindings: SAFE_FIX_MAX_FINDINGS }, '/proj', {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('超过上限');
    const cmds = mockSafeExec.mock.calls.map(c => c[0]);
    expect(cmds.some(c => c.includes('aislop fix'))).toBe(false);
  });

  it('fix 模式：可修复数在上限内时执行 fix 并复扫', () => {
    mockSafeExec
      .mockReturnValueOnce(output(JSON.stringify({ summary: { errors: 40, warnings: 50, fixable: 10 } })))
      .mockReturnValueOnce(output('fixed 10'))
      .mockReturnValueOnce(output(JSON.stringify({ summary: { errors: 30, warnings: 50, fixable: 0 } })));

    const context = {};
    const result = handleAislopScan('aislop-fix', { mode: 'fix', maxFindings: 200 }, '/proj', context);

    expect(result.message).toContain('90 → 80');
    expect(context.aislop_fixed_count).toBe(10);
    expect(mockSafeExec.mock.calls.map(c => c[0]).some(c => c.includes('aislop fix --safe'))).toBe(true);
  });

  it('fix 失败时不谎报成功', () => {
    mockSafeExec
      .mockReturnValueOnce(output(JSON.stringify({ summary: { errors: 5, warnings: 5, fixable: 5 } })))
      .mockImplementationOnce(() => { throw new Error('boom'); });

    const result = handleAislopScan('aislop-fix', { mode: 'fix' }, '/proj', {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('执行失败');
  });
});
