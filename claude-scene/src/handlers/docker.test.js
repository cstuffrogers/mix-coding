import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, green: noop, yellow: noop, red: noop, dim: noop } };
});

const mockSafeExec = vi.fn(() => { throw new Error('not installed'); });
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
}));

const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '{}');
const mockWriteFileSync = vi.fn(() => {});
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
}));

import { handleSetupDocker } from './docker.js';

describe('handleSetupDocker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
    mockExistsSync.mockImplementation(() => false);
    mockWriteFileSync.mockImplementation(() => {});
    mockReadFileSync.mockImplementation(() => '{}');
  });

  it('generates all 3 files for Node project', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    const ctx = {};
    const result = handleSetupDocker('setupDocker', {}, '/test/project', ctx);
    expect(result).toContain('配置完成');
    expect(ctx.dockerConfigured).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(3);
  });

  it('generates multi-stage Dockerfile for Python project', () => {
    mockExistsSync.mockImplementation((p) => p.includes('requirements.txt'));
    const ctx = {};
    handleSetupDocker('setupDocker', {}, '/test/project', ctx);
    expect(ctx.dockerConfigured).toBe(true);
    const dockerfileCall = mockWriteFileSync.mock.calls.find(([path]) => path.includes('Dockerfile'));
    expect(dockerfileCall[1]).toContain('python');
  });

  it('skips Docker validation when Docker not installed', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    const ctx = {};
    handleSetupDocker('setupDocker', {}, '/test/project', ctx);
    expect(ctx.dockerConfigured).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('validates existing Dockerfile without overwriting', () => {
    mockExistsSync.mockImplementation((p) => p.includes('Dockerfile'));
    mockReadFileSync.mockReturnValue('FROM node:20-alpine');
    const ctx = {};
    handleSetupDocker('setupDocker', {}, '/test/project', ctx);
    const dockerfileWrites = mockWriteFileSync.mock.calls.filter(([path]) => path.includes('Dockerfile'));
    expect(dockerfileWrites).toHaveLength(0);
  });

  it('falls back to Node when language not detected', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    handleSetupDocker('setupDocker', {}, '/test/project', ctx);
    expect(ctx.dockerConfigured).toBe(true);
    const dockerfileCall = mockWriteFileSync.mock.calls.find(([path]) => path.includes('Dockerfile'));
    expect(dockerfileCall[1]).toContain('node:20-alpine');
  });
});
