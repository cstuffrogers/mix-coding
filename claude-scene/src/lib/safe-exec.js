import { existsSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Sanitize a path for safe shell usage by stripping shell metacharacters.
 * Preserves backslashes (Windows path separator) and forward slashes.
 */
function sanitizePath(p) {
  return p.replace(/["$`]/g, '');
}

export function escapeArg(value) {
  const text = String(value);
  // Windows 上 execSync 走 cmd.exe，单引号**不是**引号：`'ghp_'` 会把引号原样
  // 传给命令，于是 `git log -S 'ghp_'` 实际搜的是带引号的字面量 —— 永远搜不到。
  // 同一个坑还让 `git commit -m 'xxx'` 在 Windows 上把单引号写进提交信息。
  // cmd 只认双引号，内部双引号用 \" 转义。
  if (process.platform === 'win32') return `"${text.replace(/"/g, '\\"')}"`;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

/**
 * Execute a shell command in a given working directory with path sanitization.
 *
 * The working directory is handed to execSync's native `cwd` option rather than
 * a `cd "<dir>" &&` prefix. That prefix silently fails to switch drives on
 * Windows: cmd.exe `cd C:\x` issued from an E: prompt only changes C:'s
 * remembered directory and leaves the process on E:, so every handler ran
 * against the engine's own directory instead of the target project.
 *
 * 注意：Windows 下 command 由 cmd.exe 执行 —— 给参数加引号必须用 `escapeArg`
 * （它按平台选引号），自己拼单引号会静默变成「搜索带引号的字面量」。
 *
 * @param {string} command - Command to run
 * @param {string} cwd - Working directory (will be sanitized)
 * @param {object} [options] - Passed through to execSync (env, stdio, timeout…)
 * @returns {string|undefined} stdout as string (pipe mode) or undefined (inherit mode)
 */
export function safeExec(command, cwd, options = {}) {
  const cleanCwd = sanitizePath(cwd);

  if (!existsSync(cleanCwd)) {
    throw new Error(`safeExec: target directory does not exist: ${cleanCwd}`);
  }

  return execSync(command, { ...options, cwd: cleanCwd });
}
