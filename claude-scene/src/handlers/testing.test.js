import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleRunSuite, handleRunAffected, handleRunCI, handleGenerateTest,
} from './testing.js';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop, white: noop } };
});

// Mock safeExec to return controlled output
const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
  escapeArg: (s) => s,
}));

// Mock fs
const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '{}');
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
}));

describe('handleRunSuite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when no package.json exists', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(result).toContain('未找到 package.json');
    expect(ctx.testPassed).toBe(null);
  });

  it('sets testPassed=false when test output contains "failed"', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { test: 'vitest' } }));
    mockSafeExec.mockReturnValue('Tests: 3 passed, 1 failed');
    const ctx = {};
    const result = handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(ctx.testPassed).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
    expect(result).toContain('失败');
  });

  it('handles JSON.parse error gracefully (regression test)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => { throw new Error('Invalid JSON'); });
    const ctx = {};
    const result = handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(ctx.testPassed).toBe(false);
    expect(result).toContain('失败');
  });

  it('uses vitest when no test script', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { vitest: 'vitest' } }));
    mockSafeExec.mockReturnValue('All tests passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(ctx.testPassed).toBe(true);
  });

  it('integration mode falls back to unit when no integration script', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { test: 'jest' } }));
    mockSafeExec.mockReturnValue('All passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'integration' }, '/tmp', ctx);
    expect(ctx.testPassed).toBe(true);
  });

  it('integration mode uses test:integration when available', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { 'test:integration': 'vitest integration' } }));
    mockSafeExec.mockReturnValue('All passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'integration' }, '/tmp', ctx);
    expect(mockSafeExec).toHaveBeenCalledWith(
      'npm run test:integration 2>&1 || true',
      '/tmp',
      { stdio: 'pipe' },
    );
  });

  it('integration mode uses playwright when e2e script exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { e2e: 'playwright test' } }));
    mockSafeExec.mockReturnValue('All passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'integration' }, '/tmp', ctx);
    expect(mockSafeExec).toHaveBeenCalledWith(
      'npx playwright test 2>&1 || true',
      '/tmp',
      { stdio: 'pipe' },
    );
  });
});

describe('handleRunAffected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when no package.json', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(result).toContain('部分失败');
    expect(ctx.affectedTestsPassed).toBe(null);
  });

  it('sets false when tests fail', () => {
    mockExistsSync.mockReturnValue(true);
    mockSafeExec.mockReturnValue('2 tests failed');
    const ctx = {};
    handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(ctx.affectedTestsPassed).toBe(false);
  });
});

describe('handleRunCI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs all default checks', () => {
    mockSafeExec.mockReturnValue('ok');
    const result = handleRunCI('run-ci', {}, '/tmp');
    expect(result).toContain('通过');
    expect(mockSafeExec).toHaveBeenCalledTimes(3); // lint + typing + coverage
  });

  it('respects custom check list', () => {
    mockSafeExec.mockReturnValue('ok');
    const result = handleRunCI('run-ci', { check: ['linting'] }, '/tmp');
    expect(result).toContain('通过');
    expect(mockSafeExec).toHaveBeenCalledTimes(1);
  });

  it('reports failed checks', () => {
    mockSafeExec.mockImplementation(() => { throw new Error('fail'); });
    const result = handleRunCI('run-ci', { check: ['linting'] }, '/tmp');
    expect(result).toContain('0/1');
  });
});

describe('handleGenerateTest', () => {
  it('sets tests_generated context flag', () => {
    const ctx = {};
    const result = handleGenerateTest('generate-test', { mode: 'unit' }, '/tmp', ctx);
    expect(ctx.testGenPrepared).toBe(true);
    expect(result).toContain('测试缺口分析');
  });

  it('returns clean result when no test gaps found', () => {
    const ctx = {};
    const result = handleGenerateTest('generate-test', {}, '/tmp', ctx);
    expect(result).toContain('测试缺口分析');
  });
});
