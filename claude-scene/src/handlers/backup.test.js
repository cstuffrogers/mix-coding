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
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  mkdirSync: vi.fn(() => {}),
}));

import { handleSetupBackup } from './backup.js';

describe('handleSetupBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
    mockWriteFileSync.mockImplementation(() => {});
    mockExistsSync.mockImplementation(() => false);
  });

  it('generates all config files when restic is not installed', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleSetupBackup('setupBackup', {}, '/test/project', ctx);
    expect(result).toContain('配置完成');
    expect(ctx.backupConfigured).toBe(true);
    expect(ctx.resticAvailable).toBe(false);
    expect(ctx.backupScriptPath).toBeTruthy();
    expect(mockWriteFileSync).toHaveBeenCalledTimes(3);
  });

  it('generates unix script on non-Windows', () => {
    mockExistsSync.mockReturnValue(false);
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const ctx = {};
    handleSetupBackup('setupBackup', {}, '/test/project', ctx);
    expect(ctx.backupScriptPath).toContain('backup.sh');
    const scriptCalls = mockWriteFileSync.mock.calls.filter(c => c[0].includes('backup.sh'));
    expect(scriptCalls.length).toBe(1);
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('detects source dirs and includes them', () => {
    mockExistsSync.mockImplementation((p) => p.includes('src') && !p.includes('restic') || p.includes('lib'));
    const ctx = {};
    handleSetupBackup('setupBackup', {}, '/test/project', ctx);
    expect(ctx.backupConfigured).toBe(true);
  });

  it('handles write failure gracefully', () => {
    mockExistsSync.mockReturnValue(false);
    mockWriteFileSync.mockImplementation((p) => {
      if (p.includes('exclude')) return;
      if (p.includes('backup')) throw new Error('permission denied');
      if (p.includes('restic-env')) return;
    });
    const ctx = {};
    const result = handleSetupBackup('setupBackup', {}, '/test/project', ctx);
    expect(result).toContain('部分完成');
    expect(ctx.backupConfigured).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('detects restic when available', () => {
    mockExistsSync.mockReturnValue(false);
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('restic version')) return Buffer.from('restic 0.17.3 compiled with go1.23.4');
      throw new Error('nope');
    });
    const ctx = {};
    handleSetupBackup('setupBackup', {}, '/test/project', ctx);
    expect(ctx.resticAvailable).toBe(true);
  });
});
