/* global Buffer */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';

// 第五轮：`checkCoverage {threshold: 80, block_on_fail: true}` 以前根本没人读，
// 只要覆盖率命令「跑起来了」就 coveragePassed = true。这里钉住真判定。
vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop, white: noop } };
});

const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
  escapeArg: (s) => s,
}));

let files = {};
const mockExistsSync = vi.fn((p) => Object.prototype.hasOwnProperty.call(files, p));
const mockReadFileSync = vi.fn((p) => {
  if (!(p in files)) throw new Error(`ENOENT ${p}`);
  return files[p];
});
const mockWriteFileSync = vi.fn((p, content) => { files[p] = content; });
const mockMkdirSync = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...a) => mockExistsSync(...a),
  readFileSync: (...a) => mockReadFileSync(...a),
  writeFileSync: (...a) => mockWriteFileSync(...a),
  mkdirSync: (...a) => mockMkdirSync(...a),
  readdirSync: () => [],
}));

const { handleTestCoverage } = await import('./testing.js');

const DIR = '/proj';
// 用 join 拼，Windows 上是反斜杠 —— handleTestCoverage 里就是这么拼的
const PKG = join(DIR, 'package.json');
const BASELINE = join(DIR, '.claude', 'coverage-baseline.json');

// vitest/istanbul 的文本表：File | % Stmts | % Branch | % Funcs | % Lines | Uncovered
function coverageTable(lines) {
  return [
    ' % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s',
    '---------|---------|---------|---------|-------------------',
    `All files |   ${lines} |      70 |   65.0 |   ${lines} |`,
    "  index.ts |   ${lines} |      70 |   65.0 |   ${lines} |",
  ].join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  files = { [PKG]: JSON.stringify({ name: 'x' }) };
});

describe('handleTestCoverage：threshold 真的生效', () => {
  it('覆盖率达标 → coveragePassed = true', () => {
    mockSafeExec.mockReturnValue(Buffer.from(coverageTable('88.20')));
    const ctx = {};
    const result = handleTestCoverage('checkCoverage', { threshold: 80 }, DIR, ctx);
    expect(String(result)).toContain('88.2');
    expect(ctx.coveragePassed).toBe(true);
  });

  it('低于阈值且没声明 block_on_fail → warn，但 coveragePassed = false 留给门禁', () => {
    mockSafeExec.mockReturnValue(Buffer.from(coverageTable('72.50')));
    const ctx = {};
    const result = handleTestCoverage('checkCoverage', { threshold: 80 }, DIR, ctx);
    expect(result.status).toBe('warn');
    expect(ctx.coveragePassed).toBe(false);
    expect(ctx.lastStepFailed).toBeUndefined();
  });

  it('低于阈值 + block_on_fail: true → 当场 fail', () => {
    mockSafeExec.mockImplementation(() => {
      const error = new Error('Command failed: npx vitest run --coverage');
      error.stdout = Buffer.from(coverageTable('72.50'));
      throw error;
    });
    const ctx = {};
    const result = handleTestCoverage('checkCoverage', { threshold: 85, block_on_fail: true }, DIR, ctx);
    expect(result.status).toBe('fail');
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('场景没声明 threshold → 只报告，不发通过结论', () => {
    mockSafeExec.mockReturnValue(Buffer.from(coverageTable('55.00')));
    const ctx = {};
    const result = handleTestCoverage('checkCoverage', { mode: 'gate' }, DIR, ctx);
    expect(result.status).toBe('warn');
    expect(ctx.coveragePassed).toBeUndefined();
  });

  it('输出里没有统计表 → warn（没数据 ≠ 达标）', () => {
    mockSafeExec.mockReturnValue(Buffer.from('No coverage provider installed'));
    const ctx = {};
    const result = handleTestCoverage('checkCoverage', { threshold: 80 }, DIR, ctx);
    expect(result.status).toBe('warn');
    expect(ctx.coveragePassed).toBeUndefined();
  });

  it('compare_to_baseline：第一次记基线，第二次给差值', () => {
    mockSafeExec.mockReturnValue(Buffer.from(coverageTable('80.00')));
    const ctx = {};
    const first = handleTestCoverage('checkCoverage', { threshold: 80, compare_to_baseline: true }, DIR, ctx);
    expect(String(first)).toContain('首次记录基线');

    mockSafeExec.mockReturnValue(Buffer.from(coverageTable('83.20')));
    const second = handleTestCoverage('checkCoverage', { threshold: 80, compare_to_baseline: true }, DIR, {});
    expect(String(second)).toContain('+3.2');
  });

  it('基线写入的是同一份文件（compare_to_baseline 的持久化路径）', () => {
    mockSafeExec.mockReturnValue(Buffer.from(coverageTable('80.00')));
    handleTestCoverage('checkCoverage', { threshold: 80, compare_to_baseline: true }, DIR, {});
    expect(files[BASELINE]).toBeTruthy();
    expect(JSON.parse(files[BASELINE]).percent).toBe(80);
  });

  it('没有 package.json → skip', () => {
    files = {};
    const ctx = {};
    const result = handleTestCoverage('checkCoverage', { threshold: 80 }, DIR, ctx);
    expect(result.status).toBe('skip');
    expect(ctx.coveragePassed).toBeUndefined();
  });
});
