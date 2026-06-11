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

import { handleSetupSBOM } from './sbom.js';

describe('handleSetupSBOM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
    mockExistsSync.mockImplementation(() => false);
    mockWriteFileSync.mockImplementation(() => {});
    mockReadFileSync.mockImplementation(() => '{}');
  });

  const sampleLicenses = JSON.stringify({
    'dep-a@1.0.0': { licenses: 'MIT', version: '1.0.0', repository: 'https://github.com/a/a' },
    'dep-b@2.0.0': { licenses: 'GPL-3.0', version: '2.0.0', repository: 'https://github.com/b/b' },
    'dep-c@3.0.0': { licenses: 'Apache-2.0', version: '3.0.0', repository: '' },
  });

  it('generates SBOM + license report for npm project', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('license-checker')) return { toString: () => sampleLicenses };
      throw new Error('not installed');
    });
    const ctx = {};
    const result = handleSetupSBOM('sbom', {}, '/test/project', ctx);
    expect(result).toContain('SBOM');
    expect(ctx.sbomGenerated).toBe(true);
    expect(ctx.licenseIssuesFound).toBe(true);
    expect(mockWriteFileSync.mock.calls.some(([p]) => p.includes('license-report.md'))).toBe(true);
  });

  it('flags restrictive GPL/AGPL licenses', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('license-checker')) return { toString: () => sampleLicenses };
      throw new Error('not installed');
    });
    const ctx = {};
    handleSetupSBOM('sbom', {}, '/test/project', ctx);
    expect(ctx.licenseIssuesFound).toBe(true);
    expect(ctx.restrictiveLicenses).toContain('dep-b@2.0.0:GPL-3.0');
  });

  it('returns early for non-npm project', () => {
    const ctx = {};
    const result = handleSetupSBOM('sbom', {}, '/test/project', ctx);
    expect(result).toContain('非 npm 项目');
    expect(ctx.sbomGenerated).toBe(false);
    expect(ctx.sbomSkipped).toBe(true);
  });

  it('generates manual SBOM when cyclonedx fails', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('license-checker')) return { toString: () => sampleLicenses };
      throw new Error('not installed');
    });
    const ctx = {};
    handleSetupSBOM('sbom', {}, '/test/project', ctx);
    const sbomCall = mockWriteFileSync.mock.calls.find(([p]) => p.includes('sbom.json'));
    expect(sbomCall).toBeTruthy();
    const sbomContent = JSON.parse(sbomCall[1]);
    expect(sbomContent.bomFormat).toBe('CycloneDX');
  });

  it('handles license-checker failure gracefully', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    mockSafeExec.mockImplementation(() => { throw new Error('tool not installed'); });
    const ctx = {};
    const result = handleSetupSBOM('sbom', {}, '/test/project', ctx);
    expect(result).toContain('SBOM');
    expect(ctx.sbomGenerated).toBe(true);
    expect(ctx.licenseIssuesFound).toBe(false);
  });
});
