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
const mockReaddirSync = vi.fn(() => []);
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
}));

import { handleSetupCI } from './cicd.js';

describe('handleSetupCI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
  });

  it('handles no workflows directory', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleSetupCI('setupCI', {}, '/test/project', ctx);
    expect(result).toContain('CI/CD 配置完成');
    expect(ctx.taskfileGenerated).toBe(true);
    expect(ctx.workflowsFound).toBe(0);
  });

  it('validates existing workflow files', () => {
    mockExistsSync.mockImplementation((p) => p.includes('.github') && p.includes('workflows'));
    mockReaddirSync.mockReturnValue(['ci.yml', 'deploy.yml']);
    mockReadFileSync.mockReturnValue('name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest');
    const ctx = {};
    const result = handleSetupCI('setupCI', {}, '/test/project', ctx);
    expect(result).toContain('CI/CD 配置完成');
    expect(ctx.workflowsFound).toBe(2);
    expect(ctx.workflowsValid).toBe(2);
    expect(ctx.ciConfigured).toBe(true);
  });

  it('detects invalid workflow structure', () => {
    mockExistsSync.mockImplementation((p) => p.includes('.github/workflows'));
    mockReaddirSync.mockReturnValue(['broken.yml']);
    mockReadFileSync.mockReturnValue('# just a comment');
    const ctx = {};
    handleSetupCI('setupCI', {}, '/test/project', ctx);
    expect(ctx.workflowsValid).toBe(0);
  });

  it('generates Taskfile.yml when missing', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json') || p.includes('.github/workflows'));
    mockReaddirSync.mockReturnValue(['ci.yml']);
    mockReadFileSync.mockImplementation((p) => {
      if (p.includes('package.json')) return JSON.stringify({ scripts: { build: 'tsc', test: 'vitest', lint: 'eslint .' } });
      return 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest';
    });
    const ctx = {};
    handleSetupCI('setupCI', {}, '/test/project', ctx);
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(ctx.taskfileGenerated).toBe(true);
  });

  it('skips Taskfile generation when already exists', () => {
    mockExistsSync.mockImplementation((p) => p.includes('Taskfile.yml') || p.includes('.github/workflows'));
    mockReaddirSync.mockReturnValue(['ci.yml']);
    mockReadFileSync.mockReturnValue('name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest');
    const ctx = {};
    handleSetupCI('setupCI', {}, '/test/project', ctx);
    expect(ctx.taskfileGenerated).toBe(true);
  });
});
