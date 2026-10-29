/* global Buffer */
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

  // 契约变更（第五轮）：测试结论只看退出码，输出内容不参与判断；
  // 「没跑成」与「跑挂了」分开（skip/warn vs fail）——以前的用例断言的
  // 正是旧行为（对输出跑正则 + 没 package.json 也算跑过）。
  it('没有 package.json → skip，且不冒充「跑过了」', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('未测量');
    expect(ctx.testPassed).toBeUndefined();
  });

  it('退出码非零 → fail', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { test: 'vitest' } }));
    mockSafeExec.mockImplementation(() => {
      const error = new Error('Command failed: npm test');
      error.stdout = Buffer.from('Tests: 3 passed, 1 failed');
      throw error;
    });
    const ctx = {};
    const result = handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(ctx.testPassed).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
    expect(result.status).toBe('fail');
  });

  it('输出里有 "failed" 但退出码是 0 → 通过（`0 failed` 不再假红）', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { test: 'vitest' } }));
    mockSafeExec.mockReturnValue('Tests: 12 passed, 0 failed');
    const ctx = {};
    const result = handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(ctx.testPassed).toBe(true);
    expect(String(result)).toContain('全部通过');
  });

  it('package.json 解析失败 → warn（没测量，不是失败）', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => { throw new Error('Invalid JSON'); });
    const ctx = {};
    const result = handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(result.status).toBe('warn');
    expect(ctx.testPassed).toBeUndefined();
  });

  it('没有 test 脚本时用 vitest', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { vitest: 'vitest' } }));
    mockSafeExec.mockReturnValue('All tests passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'unit' }, '/tmp', ctx);
    expect(mockSafeExec).toHaveBeenCalledWith('npx vitest run', '/tmp', { stdio: 'pipe' });
    expect(ctx.testPassed).toBe(true);
  });

  it('integration 模式没有 integration 脚本时回落 unit', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { test: 'jest' } }));
    mockSafeExec.mockReturnValue('All passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'integration' }, '/tmp', ctx);
    expect(ctx.testPassed).toBe(true);
  });

  it('integration 模式用 test:integration，且不再挂 `|| true`（退出码要真实）', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { 'test:integration': 'vitest integration' } }));
    mockSafeExec.mockReturnValue('All passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'integration' }, '/tmp', ctx);
    expect(mockSafeExec).toHaveBeenCalledWith('npm run test:integration', '/tmp', { stdio: 'pipe' });
  });

  it('integration 模式用 playwright（e2e 脚本）', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { e2e: 'playwright test' } }));
    mockSafeExec.mockReturnValue('All passed');
    const ctx = {};
    handleRunSuite('run-suite', { mode: 'integration' }, '/tmp', ctx);
    expect(mockSafeExec).toHaveBeenCalledWith('npx playwright test', '/tmp', { stdio: 'pipe' });
  });
});

describe('handleRunAffected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('没有 package.json → skip，且不冒充「部分失败」', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('未测量');
    expect(ctx.affectedTestsPassed).toBeUndefined();
  });

  it('测试真失败 → fail', () => {
    mockExistsSync.mockReturnValue(true);
    mockSafeExec.mockReturnValue('  2 failed | 5 passed');
    const ctx = {};
    const result = handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(result.status).toBe('fail');
    expect(ctx.affectedTestsPassed).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('全部通过 → pass（返回字符串）', () => {
    mockExistsSync.mockReturnValue(true);
    mockSafeExec.mockReturnValue('  12 passed (12)');
    const ctx = {};
    const result = handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(result).toContain('全部通过');
    expect(ctx.affectedTestsPassed).toBe(true);
  });

  it('没有可跑的测试 → skip（不能因为输出里没有 fail 字样就报通过）', () => {
    mockExistsSync.mockReturnValue(true);
    mockSafeExec.mockReturnValue('No test files found, exiting with code 0');
    const ctx = {};
    const result = handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(result.status).toBe('skip');
    expect(ctx.affectedTestsPassed).toBeUndefined();
  });

  it('runner 崩溃（抛错 + Cannot find module）→ skip，不默认通过', () => {
    mockExistsSync.mockReturnValue(true);
    mockSafeExec.mockImplementation(() => {
      const err = new Error('Command failed: npx vitest run --changed');
      err.stderr = 'Error [ERR_MODULE_NOT_FOUND]: Cannot find package vitest';
      throw err;
    });
    const ctx = {};
    const result = handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(result.status).toBe('skip');
    expect(ctx.affectedTestsPassed).toBeUndefined();
  });

  it('runner 崩溃但 stderr 明说有失败 → fail（不因抛错就降级成 skip）', () => {
    mockExistsSync.mockReturnValue(true);
    mockSafeExec.mockImplementation(() => {
      const err = new Error('Command failed');
      err.stdout = '  3 failed | 1 passed';
      throw err;
    });
    const ctx = {};
    const result = handleRunAffected('run-affected', {}, '/tmp', ctx);
    expect(result.status).toBe('fail');
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
    // 「CI 完成: 0/1 通过」曾是真假绿：文案带「完成」→ 引擎判 pass，但一个检查都没过。
    expect(result.status).toBe('fail');
    expect(result.message).toContain('0/1');
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
