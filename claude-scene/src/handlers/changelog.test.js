import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, green: noop, yellow: noop, red: noop, dim: noop } };
});

const mockSafeExec = vi.fn(() => { throw new Error('not a git repo'); });
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

import { handleGenerateChangeLog } from './changelog.js';

describe('handleGenerateChangeLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not a git repo'); });
    mockExistsSync.mockImplementation(() => false);
    mockWriteFileSync.mockImplementation(() => {});
    mockReadFileSync.mockImplementation(() => '{}');
  });

  it('generates changelog from tagged conventional commits', () => {
    mockExistsSync.mockImplementation((p) => p.includes('.git') || p.includes('package.json'));
    const tagOutput = 'v1.2.0';
    const commitOutput = 'feat: add dark mode\nfix: crash on startup\ndocs: update README';
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('tag')) return { toString: () => tagOutput };
      if (cmd.includes('log')) return { toString: () => commitOutput };
      throw new Error('not installed');
    });
    const ctx = {};
    const result = handleGenerateChangeLog('genChangelog', {}, '/test/project', ctx);
    expect(result).toContain('变更日志已生成');
    expect(ctx.changelogGenerated).toBe(true);
    expect(ctx.commitCount).toBe(3);
    const written = mockWriteFileSync.mock.calls[0][1];
    expect(written).toContain('## [1.2.0]');
    expect(written).toContain('### Added');
    expect(written).toContain('### Fixed');
  });

  it('generates full history when no tags exist', () => {
    mockExistsSync.mockImplementation((p) => p.includes('.git'));
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('tag')) return { toString: () => '' };
      if (cmd.includes('log')) return { toString: () => 'feat: initial commit' };
      throw new Error('not installed');
    });
    const ctx = {};
    handleGenerateChangeLog('genChangelog', {}, '/test/project', ctx);
    expect(ctx.changelogGenerated).toBe(true);
    const written = mockWriteFileSync.mock.calls[0][1];
    expect(written).toContain('Unreleased');
  });

  it('returns early when not a git repo', () => {
    const ctx = {};
    const result = handleGenerateChangeLog('genChangelog', {}, '/test/project', ctx);
    expect(result).toContain('非 Git 仓库');
    expect(ctx.changelogGenerated).toBe(false);
    expect(ctx.changelogSkipped).toBe(true);
  });

  it('prepends to existing CHANGELOG.md', () => {
    mockExistsSync.mockImplementation((p) => p.includes('.git') || p.includes('CHANGELOG.md'));
    mockReadFileSync.mockReturnValue('# Changelog\n\n## [1.0.0] - 2025-01-01\n\n### Added\n\n- old feature\n');
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('tag')) return { toString: () => 'v2.0.0' };
      if (cmd.includes('log')) return { toString: () => 'feat: new feature' };
      throw new Error('not installed');
    });
    const ctx = {};
    handleGenerateChangeLog('genChangelog', {}, '/test/project', ctx);
    const written = mockWriteFileSync.mock.calls[0][1];
    expect(written).toContain('## [2.0.0]');
    expect(written).toContain('old feature');
    expect(written).toContain('new feature');
  });

  it('handles non-conventional commits in Other section', () => {
    mockExistsSync.mockImplementation((p) => p.includes('.git'));
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('tag')) return { toString: () => '' };
      if (cmd.includes('log')) return { toString: () => 'random change without prefix' };
      throw new Error('not installed');
    });
    const ctx = {};
    handleGenerateChangeLog('genChangelog', {}, '/test/project', ctx);
    const written = mockWriteFileSync.mock.calls[0][1];
    expect(written).toContain('### Other Changes');
    expect(written).toContain('random change');
  });
});
