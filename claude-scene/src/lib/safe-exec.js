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
 * @param {string} command - The shell command to run (CD is automatically prepended)
 * @param {string} cwd - Working directory (will be sanitized)
 * @param {object} [options] - Passed through to execSync (stdio, etc.)
 * @returns {string|undefined} stdout as string (pipe mode) or undefined (inherit mode)
 */
export function safeExec(command, cwd, options = {}) {
  const cleanCwd = sanitizePath(cwd);

  if (!existsSync(cleanCwd)) {
    throw new Error(`safeExec: target directory does not exist: ${cleanCwd}`);
  }

  return execSync(`cd "${cleanCwd}" && ${command}`, options);
}
