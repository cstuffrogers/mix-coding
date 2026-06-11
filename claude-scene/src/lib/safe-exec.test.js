import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

// We test the sanitization logic by importing and exercising safeExec.
// The module under test:
import { safeExec } from './safe-exec.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('safeExec', () => {
  it('strips shell metacharacters from cwd', () => {
    existsSync.mockReturnValue(true);
    safeExec('echo hello', '/path/with$pecial`chars"quoted');
    expect(existsSync).toHaveBeenCalledWith('/path/withpecialcharsquoted');
  });

  it('preserves forward slashes and backslashes in paths', () => {
    existsSync.mockReturnValue(true);
    safeExec('echo hello', 'E:\\auto-coding\\project');
    expect(existsSync).toHaveBeenCalledWith('E:\\auto-coding\\project');
  });

  it('throws when target directory does not exist', () => {
    existsSync.mockReturnValue(false);
    expect(() => safeExec('echo hello', '/nonexistent')).toThrow(
      'safeExec: target directory does not exist: /nonexistent'
    );
  });

  it('executes command with cd into sanitized cwd', () => {
    existsSync.mockReturnValue(true);
    execSync.mockReturnValue('output');
    const result = safeExec('npm test', '/valid/path', { stdio: 'pipe' });
    expect(execSync).toHaveBeenCalledWith('cd "/valid/path" && npm test', { stdio: 'pipe' });
    expect(result).toBe('output');
  });

  it('passes through additional execSync options', () => {
    existsSync.mockReturnValue(true);
    safeExec('npm install', '/valid/path', { stdio: 'inherit', timeout: 30000 });
    expect(execSync).toHaveBeenCalledWith('cd "/valid/path" && npm install', {
      stdio: 'inherit',
      timeout: 30000,
    });
  });
});
