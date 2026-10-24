/**
 * Host platform detection layer.
 *
 * The scene engine is platform-agnostic: it runs the same in Claude Code,
 * opencode, Codex, ZCode, pi, or a plain CLI. The only thing that varies is
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
 *   pi          → AI_AGENT=pi                 (set unconditionally in cli.ts setupCli())
 *
 * ZCode does NOT set a bare "ZCODE=1"; it exposes ZCODE_APP_VERSION,
 * ZCODE_RUNTIME_ENV, ZCODE_WINDOWS_APP_INSTALL_DIR. We key on APP_VERSION
 * since every ZCode session sets it and it is human-readable.
 *
 * pi marker verified from @earendil-works/pi-coding-agent source: the CLI
 * entry calls setupCli(), which sets both AI_AGENT=pi and PI_CODING_AGENT=true.
 * We key on AI_AGENT because its value ("pi") is a clean platform id.
 *
 * Percho — a desktop GUI shell for pi — reuses the same engine and ~/.pi
 * config, but does NOT call setupCli(), so it never sets AI_AGENT=pi. Its
 * Electron main process instead sets PI_PACKAGE_DIR to the bundled pi SDK
 * (resources/pi-package under the install dir). Pi CLI only *reads*
 * PI_PACKAGE_DIR (for Nix/Guix store overrides) and never sets it, so its
 * presence uniquely identifies a Percho process. Both map to the pi platform.
 */
const PLATFORM_MARKERS = [
  ['CLAUDECODE', '1', 'claude'],
  ['OPENCODE', '1', 'opencode'],
  ['CODEX', '1', 'codex'],
  ['AI_AGENT', 'pi', 'pi'],
];

/** ZCode is matched by presence + non-empty value (it carries a version, not "1"). */
function detectZCode() {
  const v = process.env.ZCODE_APP_VERSION;
  return v && v.trim() !== '' ? 'zcode' : null;
}

/** Percho sets PI_PACKAGE_DIR to its bundled pi SDK; pi CLI only reads it. */
function detectPercho() {
  const v = process.env.PI_PACKAGE_DIR;
  return v && v.trim() !== '' ? 'pi' : null;
}

/** Per-platform dedicated config directory name (e.g. '.claude', '.opencode'). */
const PLATFORM_DIRS = {
  claude: '.claude',
  opencode: '.opencode',
  codex: '.codex',
  zcode: '.zcode',
  pi: '.pi',
  cli: '.claude',
};

/**
 * Detect which host platform is running the engine.
 * Returns 'claude' | 'opencode' | 'codex' | 'zcode' | 'pi' | 'cli'.
 * @public
 */
export function getHostPlatform() {
  for (const [envVar, expected, platform] of PLATFORM_MARKERS) {
    if (process.env[envVar] === expected) return platform;
  }
  return detectZCode() || detectPercho() || 'cli';
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
