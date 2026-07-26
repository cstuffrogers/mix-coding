import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop, bold: noop } };
});

const mockSafeExec = vi.fn(() => '');
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
}));

const mockEnsureDir = vi.fn(() => {});
vi.mock('../lib/fs-utils.js', () => ({
  ensureDir: (...args) => mockEnsureDir(...args),
}));

const mockScanAll = vi.fn(() => ({ hard: [], soft: [] }));
vi.mock('../lib/conflict-scanner.js', () => ({
  scanAllConflicts: (...args) => mockScanAll(...args),
}));

const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '');
const mockWriteFileSync = vi.fn(() => '');
const mockReaddirSync = vi.fn(() => []);
const mockStatSync = vi.fn(() => ({ isDirectory: () => false }));
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
  statSync: (...args) => mockStatSync(...args),
}));

import { handleScanUpdates, handleDetectConflicts, handleAutoUpdateSafe, handleWriteUpdateLog, handleUpdateReport, bumpLevel } from './update.js';

describe('update handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatSync.mockImplementation(() => ({ isDirectory: () => true }));
  });

  describe('handleDetectConflicts', () => {
    it('passes when no hard conflicts', () => {
      mockScanAll.mockReturnValue({ hard: [], soft: [{ message: 'overlap' }] });
      const ctx = {};
      const result = handleDetectConflicts('detectConflicts', {}, '/project', ctx);
      expect(result).toContain('冲突检测通过');
      expect(ctx.hasHardConflict).toBe(false);
    });

    it('blocks when hard conflict present', () => {
      mockScanAll.mockReturnValue({ hard: [{ message: 'dup' }], soft: [] });
      const ctx = {};
      const result = handleDetectConflicts('detectConflicts', {}, '/project', ctx);
      expect(result).toContain('阻断');
      expect(ctx.hasHardConflict).toBe(true);
    });
  });

  describe('handleAutoUpdateSafe', () => {
    it('skips when hard conflict flag set', () => {
      const ctx = { hasHardConflict: true };
      const result = handleAutoUpdateSafe('autoUpdateSafe', {}, '/project', ctx);
      expect(result).toContain('跳过');
    });

    it('returns no-update when scan empty', () => {
      const ctx = { updateScanResult: { updatable: [] } };
      const result = handleAutoUpdateSafe('autoUpdateSafe', {}, '/project', ctx);
      expect(result).toContain('无 patch/minor');
    });

    it('updates npm patch packages', () => {
      const ctx = {
        updateScanResult: {
          updatable: [{ type: 'npm', name: 'foo', current: '1.0.0', latest: '1.0.1', bumpLevel: 'patch' }],
        },
      };
      mockSafeExec.mockReturnValue('');
      const result = handleAutoUpdateSafe('autoUpdateSafe', {}, '/project', ctx);
      expect(result).toContain('1');
      expect(ctx.autoUpdated).toHaveLength(1);
    });

    it('blocks npm install on malicious package name (injection defense)', () => {
      const ctx = {
        updateScanResult: {
          updatable: [{ type: 'npm', name: 'evil;rm -rf /', current: '1.0.0', latest: '1.0.1', bumpLevel: 'patch' }],
        },
      };
      mockSafeExec.mockReturnValue('');
      const result = handleAutoUpdateSafe('autoUpdateSafe', {}, '/project', ctx);
      expect(result).toContain('非法字符');
      expect(mockSafeExec).not.toHaveBeenCalled();
    });
  });

  describe('bumpLevel', () => {
    it('detects major bump', () => {
      expect(bumpLevel('1.2.3', '2.0.0')).toBe('major');
    });
    it('detects minor bump', () => {
      expect(bumpLevel('1.2.3', '1.3.0')).toBe('minor');
    });
    it('detects patch bump', () => {
      expect(bumpLevel('1.2.3', '1.2.4')).toBe('patch');
    });
    it('strips non-numeric prefix (v/^) before comparing', () => {
      expect(bumpLevel('^1.2.3', 'v1.3.0')).toBe('minor');
    });
    it('falls back to patch for same version', () => {
      expect(bumpLevel('1.2.3', '1.2.3')).toBe('patch');
    });
  });

  describe('handleWriteUpdateLog', () => {
    it('writes log file with summary', () => {
      const ctx = {
        updateScanResult: { all: [], updatable: [], majorPending: [] },
        conflictResult: { hard: [], soft: [] },
        autoUpdated: [],
        updateCounts: { npm: 1, skill: 2, cli: 3 },
      };
      const result = handleWriteUpdateLog('writeUpdateLog', {}, '/project', ctx);
      expect(result).toContain('更新日志已写入');
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(mockEnsureDir).toHaveBeenCalled();
      const content = mockWriteFileSync.mock.calls[0][1];
      expect(content).toContain('系统资源更新日志');
      expect(content).toContain('npm 1 · skill 2 · CLI 3');
    });
  });

  describe('handleScanUpdates', () => {
    it('aggregates scan results into context', () => {
      mockExistsSync.mockImplementation((p) => p.includes('skills') || p.includes('claude-scene'));
      mockReaddirSync.mockImplementation((p) => p.includes('skills') ? ['foo'] : []);
      mockReadFileSync.mockReturnValue('---\nname: foo\nversion: 1.0.0\n---\n');
      mockSafeExec.mockReturnValue('{}');
      const ctx = {};
      handleScanUpdates('scanUpdates', {}, '/project', ctx);
      expect(ctx.updateScanResult).toBeDefined();
      expect(ctx.updateCounts).toBeDefined();
    });
  });

  describe('handleUpdateReport', () => {
    it('returns summary counts', () => {
      const ctx = {
        updateScanResult: { updatable: [], majorPending: [{ name: 'x' }] },
        conflictResult: { hard: [], soft: [] },
        autoUpdated: [],
      };
      const result = handleUpdateReport('updateReport', {}, '/project', ctx);
      expect(result).toContain('待确认 1');
    });
  });
});
