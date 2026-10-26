import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

// We test the sanitization logic by importing and exercising safeExec.
// The module under test:
import { safeExec, escapeArg } from './safe-exec.js';

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

describe('escapeArg', () => {
  // Windows 上 execSync 走 cmd.exe：单引号不是引号，'ghp_' 会原样把引号传给命令，
  // 于是 git log -S 'ghp_' 实际搜的是带引号的字面量 —— 永远搜不到，静默漏报。
  const original = process.platform;
  const setPlatform = value => Object.defineProperty(process, 'platform', { value, configurable: true });

  afterEach(() => setPlatform(original));

  it('POSIX 用单引号，内部单引号按 shell 规则转义', () => {
    setPlatform('linux');
    expect(escapeArg('plain')).toBe("'plain'");
    expect(escapeArg("it's")).toBe("'it'\\''s'");
  });

  it('Windows 用双引号（cmd 只认双引号）', () => {
    setPlatform('win32');
    expect(escapeArg('ghp_abc')).toBe('"ghp_abc"');
    expect(escapeArg('sk-[A-Za-z0-9_-]{20,}')).toBe('"sk-[A-Za-z0-9_-]{20,}"');
  });
});
