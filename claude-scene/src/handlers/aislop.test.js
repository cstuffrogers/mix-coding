import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, green: noop, yellow: noop, red: noop, dim: noop } };
});

const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args) }));

const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockExistsSync = vi.fn(() => true);
const mockReadFileSync = vi.fn(() => '');
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  // .aislop/config.yml 的内容，默认「没有关任何规则」
  readFileSync: (...args) => mockReadFileSync(...args),
}));

import { handleAislopScan, parseAislopOutput, writeAislopReport } from './aislop.js';

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
    const diagnostics = Array.from({ length: 5 }, () => ({ engine: 'lint', rule: 'ruff/F401', fixable: true }));
    mockSafeExec.mockReturnValue(output(JSON.stringify({ summary: { errors: 1, warnings: 4, fixable: 5 }, diagnostics })));
    const result = handleAislopScan('aislop-fix', { mode: 'fix', maxFindings: 3 }, '/proj', {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('超过上限');
    const cmds = mockSafeExec.mock.calls.map(c => c[0]);
    expect(cmds.some(c => c.includes('aislop fix'))).toBe(false);
  });

  it('fix 模式：规则全在允许清单内且在上限内时才执行 fix', () => {
    const diagnostics = Array.from({ length: 10 }, () => ({ engine: 'lint', rule: 'ruff/F401', fixable: true }));
    mockSafeExec
      .mockReturnValueOnce(output(JSON.stringify({ summary: { errors: 40, warnings: 50, fixable: 10 }, diagnostics })))
      .mockReturnValueOnce(output('fixed 10'))
      .mockReturnValueOnce(output(JSON.stringify({ summary: { errors: 30, warnings: 50, fixable: 0 }, diagnostics: [] })));

    const context = {};
    const result = handleAislopScan('aislop-fix', { mode: 'fix', maxFindings: 200 }, '/proj', context);

    expect(result.message).toContain('90 → 80');
    expect(context.aislop_fixed_count).toBe(10);
    expect(mockSafeExec.mock.calls.map(c => c[0]).some(c => c.includes('aislop fix --safe'))).toBe(true);
  });

  it('fix 模式：有删代码类规则时不执行 fix，并点名是哪条', () => {
    const diagnostics = [{ engine: 'ai-slop', rule: 'ai-slop/console-leftover', fixable: true }];
    mockSafeExec.mockReturnValue(output(JSON.stringify({ summary: { errors: 0, warnings: 1, fixable: 1 }, diagnostics })));
    const result = handleAislopScan('aislop-fix', { mode: 'fix' }, '/proj', {});

    expect(result.status).toBe('warn');
    expect(result.message).toContain('console-leftover');
    expect(mockSafeExec.mock.calls.map(c => c[0]).some(c => c.includes('aislop fix'))).toBe(false);
  });

  it('fix 模式：结果没有逐条明细时不动手（fail-closed）', () => {
    mockSafeExec.mockReturnValue(output(JSON.stringify({ summary: { errors: 1, warnings: 4, fixable: 5 } })));
    const result = handleAislopScan('aislop-fix', { mode: 'fix' }, '/proj', {});
    expect(result.message).toContain('没有逐条规则明细');
  });

  it('fix 失败时不谎报成功', () => {
    const diagnostics = Array.from({ length: 5 }, () => ({ engine: 'lint', rule: 'ruff/F401', fixable: true }));
    mockSafeExec
      .mockReturnValueOnce(output(JSON.stringify({ summary: { errors: 5, warnings: 5, fixable: 5 }, diagnostics })))
      .mockImplementationOnce(() => { throw new Error('boom'); });

    const result = handleAislopScan('aislop-fix', { mode: 'fix' }, '/proj', {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('执行失败');
  });
});

// 端到端回归：仓库配了 .aislop/config.yml 关掉 console 规则，而 `aislop fix`
// 不认配置 —— 实测放它跑会删掉 494 行注释/输出。现在必须拒跑。
describe('handleAislopScan fix 模式：配置关过规则就不跑 fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('');
  });

  it('即使诊断里只剩安全规则也拒绝，并说明原因', () => {
    const diagnostics = [{ engine: 'lint', rule: 'ruff/F401', fixable: true }];
    mockSafeExec.mockReturnValue(output(JSON.stringify({ summary: { errors: 0, warnings: 1, fixable: 1 }, diagnostics })));
    mockReadFileSync.mockReturnValue('rules:\n  ai-slop/console-leftover: "off"\n');

    const result = handleAislopScan('aislop-fix', { mode: 'fix' }, '/proj', {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('aislop fix 不认配置');
    expect(mockSafeExec.mock.calls.map(c => c[0]).some(c => c.includes('aislop fix'))).toBe(false);
    mockReadFileSync.mockReturnValue('');
  });
});
