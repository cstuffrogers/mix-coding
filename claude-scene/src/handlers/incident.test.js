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

import { handleIncidentRunbook } from './incident.js';

describe('handleIncidentRunbook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
    mockExistsSync.mockImplementation(() => false);
    mockWriteFileSync.mockImplementation(() => {});
    mockReaddirSync.mockImplementation(() => []);
  });

  it('generates generic runbook when no endpoints found', () => {
    const ctx = {};
    const result = handleIncidentRunbook('incidentRunbook', {}, '/test/project', ctx);
    expect(result).toContain('生成完成');
    expect(ctx.incidentRunbookCreated).toBe(true);
    expect(ctx.runbookCount).toBeGreaterThanOrEqual(1);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('generates per-endpoint runbooks from src/routes', () => {
    mockExistsSync.mockImplementation((p) => p.includes('src') && p.includes('routes') || p.includes('incidents'));
    mockReaddirSync.mockImplementation(() => ['users.ts', 'auth.ts', 'products.ts']);
    const ctx = {};
    handleIncidentRunbook('incidentRunbook', {}, '/test/project', ctx);
    expect(ctx.runbookCount).toBe(3);
    expect(mockWriteFileSync.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('detects port from package.json dev script', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { dev: 'next dev --port 8080' } }));
    mockSafeExec.mockImplementation(() => { throw new Error('nope'); });
    const ctx = {};
    handleIncidentRunbook('incidentRunbook', {}, '/test/project', ctx);
    expect(ctx.incidentRunbookCreated).toBe(true);
  });

  it('falls back to default port 3000 without config', () => {
    mockExistsSync.mockReturnValue(false);
    mockSafeExec.mockImplementation(() => { throw new Error('nope'); });
    const ctx = {};
    handleIncidentRunbook('incidentRunbook', {}, '/test/project', ctx);
    expect(ctx.incidentRunbookCreated).toBe(true);
  });

  it('handles generate failure gracefully', () => {
    mockExistsSync.mockReturnValue(false);
    mockWriteFileSync.mockImplementation(() => { throw new Error('disk full'); });
    const ctx = {};
    const result = handleIncidentRunbook('incidentRunbook', {}, '/test/project', ctx);
    expect(result).toContain('失败');
    expect(ctx.incidentRunbookCreated).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });
});
