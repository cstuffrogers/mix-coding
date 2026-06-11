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
  });

  it('returns clean when no migration files exist', () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = {};
    const result = handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(result).toContain('无迁移文件');
    expect(ctx.migrationReviewPassed).toBe(true);
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
    expect(ctx.migrationHighCount).toBeGreaterThan(0);
    expect(ctx.migrationReviewPassed).toBe(false);
  });

  it('detects DROP TABLE as CRITICAL', () => {
    mockExistsSync.mockImplementation((p) => p.includes('migrations'));
    mockReaddirSync.mockReturnValue(['002_drop.sql']);
    mockReadFileSync.mockReturnValue('DROP TABLE legacy_users');
    const ctx = {};
    handleMigrationReview('migration-review', {}, '/tmp', ctx);
    expect(ctx.migrationHighCount).toBeGreaterThan(0);
    expect(ctx.migrationReviewPassed).toBe(false);
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
