import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMigrationReview } from './migration.js';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop } };
});

const mockSafeExec = vi.fn(() => { throw new Error('not installed'); });
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
}));

const mockExistsSync = vi.fn(() => false);
const mockReaddirSync = vi.fn(() => []);
const mockReadFileSync = vi.fn(() => '');
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
}));

describe('handleMigrationReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks 不会清掉 mockImplementation —— 单独恢复默认，避免测试间互相污染
    mockSafeExec.mockImplementation(() => { throw new Error('not installed'); });
    mockReadFileSync.mockReturnValue('');
    mockReaddirSync.mockReturnValue([]);
    mockExistsSync.mockReturnValue(false);
  });

  it('returns clean when no migration files exist', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleMigrationReview('migration-review', {}, '/tmp', ctx);
    // 没有迁移文件 = 没审到东西 → skip，以前记 ✓ pass
    expect(result.status).toBe('skip');
    expect(result.message).toContain('无迁移文件');
    expect(ctx.migrationReviewPassed).toBeUndefined();
  });

  it('scans migration dirs for SQL files', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['001_init.sql']);
    mockReadFileSync.mockReturnValue('CREATE TABLE users (id SERIAL PRIMARY KEY);');
    const ctx = {};
    const result = handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(result).toContain('通过');
    expect(ctx.migrationReviewPassed).toBe(true);
  });

  it('detects dangerous NOT NULL without DEFAULT', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['001_danger.sql']);
    mockReadFileSync.mockReturnValue('ALTER TABLE users ADD COLUMN status VARCHAR NOT NULL');
    const ctx = {};
    handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(ctx.migrationFindings.some((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL')).toBe(true);
    expect(ctx.migrationReviewPassed).toBe(false);
  });

  it('detects DROP TABLE as CRITICAL', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['002_drop.sql']);
    mockReadFileSync.mockReturnValue('DROP TABLE legacy_users');
    const ctx = {};
    handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(ctx.migrationFindings.some((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL')).toBe(true);
    expect(ctx.migrationReviewPassed).toBe(false);
  });

  // 第十一轮：读不出来 ≠ 没问题。以前 scanMigrationFile 静默 catch 返回 []，
  // 于是 highOrAbove = 0 → migrationReviewPassed = true（假绿）。
  it('迁移文件读不出来时不发通过结论（不是通过，也不是失败）', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['004_unreadable.sql']);
    mockReadFileSync.mockImplementationOnce(() => { throw new Error('EACCES'); });
    const ctx = {};
    const result = handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('读不出来');
    expect(ctx.migrationReviewPassed).toBeUndefined();
  });

  // 第十一轮：以前用 /CRITICAL|HIGH/i 数 override 输出里的出现次数 ——
  // 输出里写「No critical issues」也会被数成 1 个 CRITICAL（假红）。
  it('guardian 输出里出现 "no critical issues" 不算发现问题', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['005_safe.sql']);
    mockReadFileSync.mockReturnValue('CREATE INDEX idx_email ON users(email);');
    mockSafeExec.mockReturnValueOnce('Analysis complete: no critical issues, no high severity findings');
    const ctx = {};
    const result = handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(String(result)).toContain('通过');
    expect(ctx.migrationReviewPassed).toBe(true);
  });

  // guardian 非零退出 = 它报了问题，但没给出可解析的结论 → 不许算通过
  it('guardian 非零退出且内置扫描干净 → warn，不报通过', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['006_safe.sql']);
    mockReadFileSync.mockReturnValue('CREATE INDEX idx_email ON users(email);');
    const err = new Error('exit 1');
    err.status = 1;
    err.stdout = 'something went wrong';
    mockSafeExec.mockImplementationOnce(() => { throw err; });
    const ctx = {};
    const result = handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(result.status).toBe('warn');
    expect(ctx.migrationReviewPassed).toBeUndefined();
  });

  it('passes safe migrations', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['003_safe.sql']);
    mockReadFileSync.mockReturnValue('CREATE INDEX idx_email ON users(email);');
    const ctx = {};
    const result = handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(result).toContain('通过');
    expect(ctx.migrationReviewPassed).toBe(true);
  });
});
