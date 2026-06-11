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
const mockReaddirSync = vi.fn(() => []);
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
  mkdirSync: vi.fn(() => {}),
}));

import { handleSetupE2E } from './e2e.js';

describe('handleSetupE2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
    mockExistsSync.mockImplementation(() => false);
    mockWriteFileSync.mockImplementation(() => {});
    mockReaddirSync.mockImplementation(() => []);
  });

  it('generates API tests even without endpoints', () => {
    const ctx = {};
    const result = handleSetupE2E('setupE2E', {}, '/test/project', ctx);
    expect(result).toContain('配置完成');
    expect(ctx.e2eConfigured).toBe(true);
    expect(ctx.apiTestsGenerated).toBe(true);
  });

  it('generates MSW handlers when endpoints found', () => {
    mockExistsSync.mockImplementation((p) => p.includes('src') && p.includes('routes'));
    mockReaddirSync.mockReturnValue(['users.ts', 'auth.ts', 'products.ts']);
    const ctx = {};
    handleSetupE2E('setupE2E', {}, '/test/project', ctx);
    expect(ctx.mswHandlersGenerated).toBe(true);
    expect(ctx.apiTestsGenerated).toBe(true);
    expect(ctx.e2eConfigured).toBe(true);
  });

  it('handles no endpoints gracefully', () => {
    const ctx = {};
    handleSetupE2E('setupE2E', {}, '/test/project', ctx);
    expect(ctx.mswHandlersGenerated).toBe(false);
    expect(ctx.apiTestsGenerated).toBe(true);
    expect(ctx.e2eConfigured).toBe(true);
  });

  it('handles write failure gracefully', () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('permission denied'); });
    const ctx = {};
    const result = handleSetupE2E('setupE2E', {}, '/test/project', ctx);
    expect(result).toContain('部分完成');
    expect(ctx.e2eConfigured).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('detects and validates OpenAPI spec', () => {
    mockExistsSync.mockImplementation((p) => p.includes('openapi.json'));
    mockReadFileSync.mockReturnValue('{}');
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('schemathesis')) return Buffer.from('PASSED');
      throw new Error('nope');
    });
    const ctx = {};
    handleSetupE2E('setupE2E', {}, '/test/project', ctx);
    expect(ctx.e2eConfigured).toBe(true);
    expect(ctx.fuzzTestPassed).toBe(true);
  });
});
