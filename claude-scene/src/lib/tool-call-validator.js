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

import { EXFIL_PATTERNS } from './llm-proxy-detector.js';
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

function inspectBashCommand(input) {
  /** @type {ValidationIssue[]} */
  const issues = [];
  const cmd = typeof input === 'string' ? input : (input?.command || '');

  for (const ep of EXFIL_PATTERNS) {
    if (ep.pattern.test(cmd)) {
      issues.push({
        level: 'BLOCKED',
        tool: 'Bash',
        reason: `Command contains ${ep.label}: "${cmd.slice(0, 200)}"`,
        detail: cmd,
      });
    }
  }

  // Detect curl/wget to unknown hosts
  const curlMatch = cmd.match(/(?:curl|wget)\s+.*?(https?:\/\/[^\s"']+)/i);
  if (curlMatch) {
    issues.push({
      level: 'WARNING',
      tool: 'Bash',
      reason: `Outbound network request detected: ${curlMatch[1]}`,
      detail: cmd,
    });
  }

  return issues;
}

function inspectWriteInput(input) {
  /** @type {ValidationIssue[]} */
  const issues = [];
  const filePath = typeof input === 'string' ? input : (input?.file_path || '');

  // Block writes to sensitive paths
  const sensitivePaths = [
    /\.env$/i, /credentials/i, /\.pem$/i, /\.key$/i,
    /\/etc\//, /\/root\//, /~\/\.ssh\//, /\.git\/config$/,
    /settings\.json$/i,
  ];
  for (const sp of sensitivePaths) {
    if (sp.test(filePath)) {
      issues.push({
        level: 'WARNING',
        tool: 'Write',
        reason: `Write to sensitive path: ${filePath}`,
        detail: filePath,
      });
    }
  }

  // Check content for exfiltration patterns
  const content = typeof input === 'string' ? '' : (input?.content || '');
  if (content) {
    for (const ep of EXFIL_PATTERNS) {
      if (ep.pattern.test(content)) {
        issues.push({
          level: 'BLOCKED',
          tool: 'Write',
          reason: `Content contains ${ep.label}`,
          detail: content.slice(0, 200),
        });
      }
    }
  }

  return issues;
}

function inspectWebFetchInput(input) {
  /** @type {ValidationIssue[]} */
  const issues = [];
  const url = typeof input === 'string' ? input : (input?.url || '');

  // Check for suspicious hosts
  const suspiciousHosts = [
    'webhook', 'discord.com/api', 'api.telegram.org', 'hooks.slack.com',
    'pastebin.com', 'requestbin', 'ngrok.io', 'beeceptor.com',
    'pipedream.com', 'canarytokens', 'burpcollaborator',
    'interact.sh', 'oast.fun', 'dnslog.cn',
  ];

  for (const sh of suspiciousHosts) {
    if (url.toLowerCase().includes(sh)) {
      issues.push({
        level: 'BLOCKED',
        tool: 'WebFetch',
        reason: `Suspicious URL host: ${url}`,
        detail: url,
      });
    }
  }

  return issues;
}

// ---- Core validation ----

/**
 * Validate a list of tool calls against a whitelist.
 *
 * @param {ToolCall[]} toolCalls - Tool calls from LLM response
 * @param {string[]} allowedTools - List of allowed tool names
 * @param {object} [options]
 * @param {boolean} [options.strictMode=true] - Block unknown tools
 * @param {boolean} [options.inspectRestricted=true] - Deep inspect restricted tools
 * @returns {ValidationResult}
 */
export function validateToolCalls(toolCalls, allowedTools, options = {}) {
  const { strictMode = true, inspectRestricted = true } = options;
  const allowedSet = new Set(allowedTools);
  /** @type {ValidationIssue[]} */
  const issues = [];

  for (const tc of toolCalls) {
    // Normalize: handle both Anthropic {name, input} and OpenAI {function: {name, arguments}}
    const name = tc.name || tc.function?.name || 'unknown';
    const input = tc.input || (tc.function?.arguments
      ? (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })()
      : {});

    // Check 1: Tool name in whitelist
    if (!allowedSet.has(name)) {
      if (strictMode) {
        issues.push({
          level: 'BLOCKED',
          tool: name,
          reason: `Unknown tool "${name}" — not in whitelist. Possible injection.`,
          detail: JSON.stringify(input).slice(0, 200),
        });
        continue;
      } else {
        issues.push({
          level: 'WARNING',
          tool: name,
          reason: `Unknown tool "${name}" — not in whitelist (allowed in non-strict mode)`,
        });
      }
    }

    // Check 2: Deep inspect restricted tools
    if (inspectRestricted && RESTRICTED_TOOLS.includes(name)) {
      if (name === 'Bash') issues.push(...inspectBashCommand(input));
      if (name === 'Write') issues.push(...inspectWriteInput(input));
      if (name === 'WebFetch') issues.push(...inspectWebFetchInput(input));
    }

    // Check 3: General parameter exfiltration scan (all tools)
    const paramStr = JSON.stringify(input);
    for (const ep of EXFIL_PATTERNS) {
      if (ep.pattern.test(paramStr)) {
        issues.push({
          level: 'BLOCKED',
          tool: name,
          reason: `Parameters contain ${ep.label}: "${paramStr.slice(0, 200)}"`,
          detail: paramStr,
        });
      }
    }
  }

  const blocks = issues.filter(i => i.level === 'BLOCKED');
  const allowed = blocks.length === 0;

  return {
    allowed,
    issues,
    blockReasons: blocks.map(b => `[${b.tool}] ${b.reason}`),
  };
}

/**
 * Load whitelist from a JSON config file, merging with builtin defaults.
 * Config format: { "allow": ["ToolA", "ToolB"], "deny": ["ToolC"], "restricted": ["ToolD"] }
 */
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
    if (existsSync(p)) {
      try {
        const config = JSON.parse(readFileSync(p, 'utf-8'));
        if (config.allow) config.allow.forEach(t => whitelist.add(t));
        if (config.deny) config.deny.forEach(t => whitelist.delete(t));
        // Collect restricted additions separately — don't mutate the module-level array
        if (config.restricted) {
          for (const t of config.restricted) {
            if (!RESTRICTED_TOOLS.includes(t)) extraRestricted.push(t);
          }
        }
      } catch {
        // Ignore malformed config files
      }
    }
  }

  return { allowed: [...whitelist], restricted: [...RESTRICTED_TOOLS, ...extraRestricted] };
}

/**
 * Load whitelist (simple version — returns array of allowed tool names only).
 */
export function loadWhitelistNames(configPath) {
  return loadWhitelist(configPath).allowed;
}

/**
 * Generate a default whitelist config file.
 */
export function generateWhitelistConfig(outputPath) {
  const config = {
    _comment: 'Tool Call Whitelist — tools returned by LLM must be in this list to execute',
    allow: [...BUILTIN_ALLOWED_TOOLS],
    deny: [],
    restricted: [...RESTRICTED_TOOLS],
  };
  return config;
}

export { BUILTIN_ALLOWED_TOOLS, RESTRICTED_TOOLS };
