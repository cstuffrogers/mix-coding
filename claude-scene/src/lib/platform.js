/**
 * Host platform detection layer.
 *
 * The scene engine is platform-agnostic: it runs the same in Claude Code,
 * opencode, Codex, ZCode, or a plain CLI. The only thing that varies is
 * whether "conversation mode" is active — i.e. whether a conversational agent
 * host is present to handle semantic steps (MCP tool calls, Skill() invocations,
 * free-form code reasoning).
 *
 * Each host sets a marker env var when it spawns the engine. This module turns
 * those markers into a single source of truth so handlers don't hardcode env
 * checks. Adding a new platform means appending one line to PLATFORM_MARKERS.
 */

/**
 * Env-var → platform-id mapping. Each host injects a distinctive marker when
 * it spawns the engine. Verified markers (probed from real sessions):
 *
 *   Claude Code → CLAUDECODE=1
 *   ZCode       → ZCODE_APP_VERSION=<x.y.z>  (e.g. "3.2.1")
 *   opencode    → OPENCODE=1                  (per opencode docs)
 *   Codex       → CODEX=1                     (per OpenAI docs)
 *
 * ZCode does NOT set a bare "ZCODE=1"; it exposes ZCODE_APP_VERSION,
 * ZCODE_RUNTIME_ENV, ZCODE_WINDOWS_APP_INSTALL_DIR. We key on APP_VERSION
 * since every ZCode session sets it and it is human-readable.
 */
const PLATFORM_MARKERS = [
  ['CLAUDECODE', '1', 'claude'],
  ['OPENCODE', '1', 'opencode'],
  ['CODEX', '1', 'codex'],
];

/** ZCode is matched by presence + non-empty value (it carries a version, not "1"). */
function detectZCode() {
  const v = process.env.ZCODE_APP_VERSION;
  return v && v.trim() !== '' ? 'zcode' : null;
}

/** Per-platform dedicated config directory name (e.g. '.claude', '.opencode'). */
const PLATFORM_DIRS = {
  claude: '.claude',
  opencode: '.opencode',
  codex: '.codex',
  zcode: '.zcode',
  cli: '.claude',
};

/**
 * Detect which host platform is running the engine.
 * Returns 'claude' | 'opencode' | 'codex' | 'zcode' | 'cli'.
 * @public
 */
export function getHostPlatform() {
  for (const [envVar, expected, platform] of PLATFORM_MARKERS) {
    if (process.env[envVar] === expected) return platform;
  }
  return detectZCode() || 'cli';
}

/**
 * True when a conversational agent host is present and can handle semantic
 * steps (MCP tools, Skill() calls, code reasoning). This replaces every former
 * `process.env.CLAUDECODE === '1'` check.
 *
 * For Claude Code the result is unchanged: CLAUDECODE=1 → true.
 */
export function isConversationMode() {
  return getHostPlatform() !== 'cli';
}

/** Per-platform dedicated config directory name (e.g. '.claude', '.opencode').
 * @public
 */
export function getPlatformDir() {
  return PLATFORM_DIRS[getHostPlatform()];
}
