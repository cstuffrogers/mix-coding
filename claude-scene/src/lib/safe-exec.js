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
  return `'${String(value).replace(/'/g, "'\\''")}'`;
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
