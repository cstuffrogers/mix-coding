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
    safeExec('echo hello', 'claude-scene\\src\\project');
    expect(existsSync).toHaveBeenCalledWith('claude-scene\\src\\project');
  });

  it('throws when target directory does not exist', () => {
    existsSync.mockReturnValue(false);
    expect(() => safeExec('echo hello', '/nonexistent')).toThrow(
      'safeExec: target directory does not exist: /nonexistent'
    );
  });

  it('runs the command in the sanitized cwd without a shell cd prefix', () => {
    existsSync.mockReturnValue(true);
    execSync.mockReturnValue('output');
    const result = safeExec('npm test', '/valid/path', { stdio: 'pipe' });
    // cwd must go through execSync's option: a shell `cd ...` prefix does not
    // switch drives in cmd.exe, silently running in the engine directory.
    expect(execSync).toHaveBeenCalledWith('npm test', { stdio: 'pipe', cwd: '/valid/path' });
    expect(result).toBe('output');
  });

  it('passes through additional execSync options', () => {
    existsSync.mockReturnValue(true);
    safeExec('npm install', '/valid/path', { stdio: 'inherit', timeout: 30000 });
    expect(execSync).toHaveBeenCalledWith('npm install', {
      stdio: 'inherit',
      timeout: 30000,
      cwd: '/valid/path',
    });
  });

  it('keeps a caller-supplied env while overriding cwd', () => {
    existsSync.mockReturnValue(true);
    const env = { PATH: '/custom' };
    safeExec('semgrep --version', '/valid/path', { env });
    expect(execSync).toHaveBeenCalledWith('semgrep --version', { env, cwd: '/valid/path' });
  });
});
