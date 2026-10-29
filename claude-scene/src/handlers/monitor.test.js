/* global Buffer */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop } };
});

const mockSafeExec = vi.fn(() => { throw new Error('not installed'); });
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
}));

const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '');
const mockWriteFileSync = vi.fn(() => {});
const mockMkdirSync = vi.fn(() => {});
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
}));

import { handleSetupMonitor } from './monitor.js';

describe('handleSetupMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
  });

  it('returns early when target is not a git repo', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleSetupMonitor('setupMonitor', {}, '/test/fake', ctx);
    expect(result.message).toContain('非 Git 仓库');
    // 第十一轮：以前写 monitorConfigured = false，门禁把 false 当「查了不通过」→
    // 报 fail，而这一步的文案是「跳过」。没查不是不通过，现在不写这个键，
    // 让门禁如实记 skipped，并且显式返回 status: 'skip'。
    expect(result.status).toBe('skip');
    expect(ctx.monitorConfigured).toBeUndefined();
  });

  it('generates config when .upptimerc.yml is missing', () => {
    mockExistsSync.mockImplementation((p) => p.endsWith('.git'));
    mockSafeExec.mockReturnValue(Buffer.from('git@github.com:test-user/test-repo.git\n'));
    const ctx = {};
    const result = handleSetupMonitor('setupMonitor', {}, '/test/project', ctx);
    expect(result).toContain('Upptime 监控配置完成');
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(ctx.monitorConfigured).toBe(true);
  });

  it('validates existing .upptimerc.yml', () => {
    mockExistsSync.mockImplementation((p) => p.endsWith('.git') || p.endsWith('.upptimerc.yml') || p.endsWith('upptime.yml'));
    mockReadFileSync.mockReturnValue('owner: test-owner\nsites:\n  - name: test');
    mockSafeExec.mockReturnValue(Buffer.from('https://github.com/test-owner/test-repo.git\n'));
    const ctx = {};
    const result = handleSetupMonitor('setupMonitor', {}, '/test/project', ctx);
    expect(result).toContain('Upptime 监控配置完成');
    expect(ctx.monitorConfigured).toBe(true);
  });

  it('handles missing GitHub remote gracefully', () => {
    mockExistsSync.mockImplementation((p) => p.endsWith('.git'));
    mockSafeExec.mockImplementation(() => { throw new Error('no remote'); });
    const ctx = {};
    const result = handleSetupMonitor('setupMonitor', {}, '/test/project', ctx);
    expect(result).toContain('完成');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('handles write failure for workflow', () => {
    mockExistsSync.mockImplementation((p) => p.endsWith('.git'));
    mockSafeExec.mockReturnValue(Buffer.from('git@github.com:owner/repo.git\n'));
    mockMkdirSync.mockImplementation(() => { throw new Error('permission denied'); });
    const ctx = {};
    const result = handleSetupMonitor('setupMonitor', {}, '/test/project', ctx);
    expect(result).toContain('部分完成');
    expect(ctx.monitorConfigured).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });
});
