/**
 * Tool Call Validator — whitelist-based guard for LLM-returned tool calls.
 *
 * Before any tool call from an LLM response gets executed, run it through
 * validateToolCalls(). Unknown tools and suspicious parameters are blocked.
 *
 * Usage:
 *   import { validateToolCalls, loadWhitelist } from './lib/tool-call-validator.js';
 *   const whitelist = loadWhitelist();
 *   const result = validateToolCalls(response.tool_calls, whitelist);
 *   if (!result.allowed) throw new SecurityError(result.blockReasons.join('; '));
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Default whitelist ----

const BUILTIN_ALLOWED_TOOLS = [
  // Claude Code built-in tools (Always allow core tools)
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'WebSearch',
  'WebFetch',
  'Task',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  'TaskOutput',
  'TaskStop',
  'Agent',
  'Skill',
  'AskUserQuestion',
  'EnterPlanMode',
  'ExitPlanMode',
  'EnterWorktree',
  'ExitWorktree',
  'CronCreate',
  'CronList',
  'CronDelete',
  'ScheduleWakeup',
  'NotebookEdit',
];

/** Tools allowed but restricted (parameter inspection required) */
const RESTRICTED_TOOLS = [
  'Bash',       // Inspect command for exfiltration
  'Write',      // Inspect file_path and content
  'WebFetch',   // Inspect URL
  'WebSearch',  // Inspect query
];

/**
 * @typedef {object} ToolCall
 * @property {string} id
 * @property {string} name
 * @property {object} [input] - Parameters (Anthropic) or arguments (OpenAI)
 * @property {{ name: string, arguments: string }} [function] - OpenAI format
 */

/**
 * @typedef {object} ValidationIssue
 * @property {'BLOCKED'|'WARNING'} level
 * @property {string} tool
 * @property {string} reason
 * @property {string} [detail]
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} allowed - Whether ALL tool calls pass validation
 * @property {ValidationIssue[]} issues
 * @property {string[]} blockReasons - Human-readable reasons for blocks
 */

// ---- Parameter inspection ----




// ---- Core validation ----






/**
 * Load whitelist from a JSON config file, merging with builtin defaults.
 * Config format: { "allow": ["ToolA", "ToolB"], "deny": ["ToolC"], "restricted": ["ToolD"] }
 */
function applyConfig(config, whitelist, extraRestricted) {
  if (config.allow) config.allow.forEach(t => whitelist.add(t));
  if (config.deny) config.deny.forEach(t => whitelist.delete(t));
  if (config.restricted) {
    for (const t of config.restricted) {
      if (!RESTRICTED_TOOLS.includes(t)) extraRestricted.push(t);
    }
  }
}

export function loadWhitelist(configPath) {
  const whitelist = new Set(BUILTIN_ALLOWED_TOOLS);
  const extraRestricted = [];

  const paths = [
    configPath,
    join(process.cwd(), '.tool-whitelist.json'),
    join(__dirname, '..', '..', '.tool-whitelist.json'),
    join(process.cwd(), '.claude', 'tool-whitelist.json'),
  ].filter(Boolean);

  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const config = JSON.parse(readFileSync(p, 'utf-8'));
      applyConfig(config, whitelist, extraRestricted);
    } catch { /* malformed config */ }
  }

  return { allowed: [...whitelist], restricted: [...RESTRICTED_TOOLS, ...extraRestricted] };
}


/**
 * Generate a default whitelist config file.
 */
export function generateWhitelistConfig(_outputPath) {
  const config = {
    _comment: 'Tool Call Whitelist — tools returned by LLM must be in this list to execute',
    allow: [...BUILTIN_ALLOWED_TOOLS],
    deny: [],
    restricted: [...RESTRICTED_TOOLS],
  };
  return config;
}

/**
 * @public
 * Built-in allowed tools and restricted tools for tool call validation.
 */
export { BUILTIN_ALLOWED_TOOLS, RESTRICTED_TOOLS };
