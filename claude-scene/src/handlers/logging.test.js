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

import { handleSetupLogging } from './logging.js';

describe('handleSetupLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
    mockExistsSync.mockImplementation(() => false);
    mockWriteFileSync.mockImplementation(() => {});
    mockReadFileSync.mockImplementation(() => '{}');
  });

  it('generates winston config when no logger installed', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    const ctx = {};
    const result = handleSetupLogging('setupLogging', {}, '/test/project', ctx);
    expect(result).toContain('配置完成');
    expect(ctx.loggingConfigured).toBe(true);
    const configCall = mockWriteFileSync.mock.calls.find(([path]) => path.includes('logging.config.js'));
    expect(configCall[1]).toContain('winston');
  });

  it('validates existing config without overwriting', () => {
    mockExistsSync.mockImplementation((p) => p.includes('logging.config.js'));
    mockReadFileSync.mockReturnValue('module.exports = { level: "info" };');
    const ctx = {};
    handleSetupLogging('setupLogging', {}, '/test/project', ctx);
    const configWrites = mockWriteFileSync.mock.calls.filter(([path]) => path.includes('logging.config.js'));
    expect(configWrites).toHaveLength(0);
  });

  it('generates pino config when pino detected', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({ dependencies: { pino: '^8.0.0' } }));
    const ctx = {};
    handleSetupLogging('setupLogging', {}, '/test/project', ctx);
    const configCall = mockWriteFileSync.mock.calls.find(([path]) => path.includes('logging.config.js'));
    expect(configCall[1]).toContain('pino');
  });

  it('generates Filebeat config when ELK indicators found', () => {
    mockExistsSync.mockImplementation((p) => p.includes('package.json') || p.includes('.env'));
    mockReadFileSync.mockReturnValue('ELASTICSEARCH_URL=http://elk:9200\n');
    const ctx = {};
    handleSetupLogging('setupLogging', {}, '/test/project', ctx);
    const fbCall = mockWriteFileSync.mock.calls.find(([path]) => path.includes('filebeat.yml'));
    expect(fbCall).toBeTruthy();
    expect(fbCall[1]).toContain('filebeat.inputs');
  });

  it('falls back when package.json missing', () => {
    const ctx = {};
    handleSetupLogging('setupLogging', {}, '/test/project', ctx);
    expect(ctx.loggingConfigured).toBe(true);
    expect(ctx.logFormat).toBe('json');
  });
});
