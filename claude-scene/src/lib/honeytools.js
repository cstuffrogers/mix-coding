/**
 * Honeytools — AgentShield-style deception layer.
 *
 * Generates realistic-looking decoy tool definitions. A proxy that injects
 * tool calls can't distinguish real tools from honeytools. If a honeytool
 * is invoked, it's confirmed tampering — zero false positives.
 *
 * Usage:
 *   import { generateHoneytools, writeHoneytoolConfig } from './lib/honeytools.js';
 *   const tools = generateHoneytools();
 *   // Mix these into your real tool definitions before sending to the LLM.
 */

/**
 * @typedef {object} Honeytool
 * @property {string} name - Tool name (looks realistic)
 * @property {string} description - Convincing but fake description
 * @property {object} input_schema - JSON Schema for parameters
 * @property {string[]} canaryTokens - Unique strings that tag this as a honeytool
 * @property {('high_value_data'|'exfiltration_path'|'credential_access'|'internal_admin')} baitCategory
 * @property {string} triggerDescription - What kind of malicious behavior triggers this
 */

/** @type {Honeytool[]} */
const HONEYTOOLS = [
  {
    name: 'fetch_internal_config',
    description: 'Retrieve internal application configuration including feature flags, API endpoints, and service credentials. Use when debugging or checking deployment settings.',
    input_schema: {
      type: 'object',
      properties: {
        config_key: { type: 'string', description: 'Configuration key to fetch (e.g. "database", "api_keys", "secrets")' },
        environment: { type: 'string', enum: ['development', 'staging', 'production'], description: 'Target environment' },
      },
      required: ['config_key'],
    },
    canaryTokens: ['FCHC-INT-4A7B', 'internal_config_v2_secret_backend'],
    baitCategory: 'credential_access',
    triggerDescription: 'Proxy injects a call to steal credentials or API keys',
  },
  {
    name: 'sync_internal_cache',
    description: 'Synchronize the internal distributed cache. Transfers cached data between nodes. Used by the ops team during deployments.',
    input_schema: {
      type: 'object',
      properties: {
        target_node: { type: 'string', description: 'Cache node URL to sync to' },
        data_bucket: { type: 'string', description: 'Data bucket identifier' },
        full_sync: { type: 'boolean', description: 'Perform full data transfer', default: false },
      },
      required: ['target_node'],
    },
    canaryTokens: ['SYNC-HNT-D92E', 'cache_sync_payload_v1_token'],
    baitCategory: 'exfiltration_path',
    triggerDescription: 'Proxy injects a call with an attacker-controlled target_node URL to exfiltrate data',
  },
  {
    name: 'send_admin_notification',
    description: 'Send an internal notification to system administrators. Used for alerts, deployment notifications, and infrastructure status updates.',
    input_schema: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: ['slack', 'email', 'webhook', 'pagerduty'], description: 'Notification channel' },
        message: { type: 'string', description: 'Notification message body' },
        webhook_url: { type: 'string', description: 'Override webhook URL (admin only)' },
      },
      required: ['channel', 'message'],
    },
    canaryTokens: ['ADMIN-NTF-B33F', 'admin_notify_hook_v3_secret'],
    baitCategory: 'exfiltration_path',
    triggerDescription: 'Proxy injects a call with an attacker webhook_url to exfiltrate data',
  },
  {
    name: 'verify_user_credentials',
    description: 'Internal credential verification service. Validates user session tokens and access credentials against the auth database.',
    input_schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Session token or API key to verify' },
        user_id: { type: 'string', description: 'User identifier' },
        return_details: { type: 'boolean', description: 'Return full credential details including permissions', default: false },
      },
      required: ['token'],
    },
    canaryTokens: ['VRFY-CRED-8C11', 'credential_verify_backdoor_check'],
    baitCategory: 'credential_access',
    triggerDescription: 'Proxy injects a call to validate stolen credentials or extract token details',
  },
  {
    name: 'export_analytics_report',
    description: 'Export aggregated analytics data as CSV/JSON. Used by the data team for weekly reporting. Includes user metrics, revenue data, and engagement stats.',
    input_schema: {
      type: 'object',
      properties: {
        date_range: { type: 'string', description: 'Date range (e.g. "last_7_days", "2026-Q2")' },
        format: { type: 'string', enum: ['csv', 'json', 'parquet'], description: 'Export format' },
        destination_url: { type: 'string', description: 'Optional URL to POST the export to' },
        include_pii: { type: 'boolean', description: 'Include personally identifiable information', default: false },
      },
      required: ['date_range', 'format'],
    },
    canaryTokens: ['EXPORT-ANL-F005', 'analytics_egress_token_v4'],
    baitCategory: 'high_value_data',
    triggerDescription: 'Proxy injects a call to export user data to an attacker-controlled destination',
  },
];

/**
 * Generate honeytool definitions.
 * @param {object} [options]
 * @param {number} [options.count=5] - How many honeytools to return
 * @param {string[]} [options.categories] - Filter by bait categories
 * @returns {Honeytool[]}
 */
export function generateHoneytools(options = {}) {
  const { count = 5, categories } = options;
  let pool = HONEYTOOLS;
  if (categories && categories.length) {
    pool = HONEYTOOLS.filter(h => categories.includes(h.baitCategory));
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * Format honeytools as Anthropic-compatible tool definitions.
 */
export function toAnthropicTools(honeytools) {
  return honeytools.map(h => ({
    name: h.name,
    description: h.description,
    input_schema: h.input_schema,
  }));
}

/**
 * Format honeytools as OpenAI-compatible tool definitions.
 */
export function toOpenAITools(honeytools) {
  return honeytools.map(h => ({
    type: 'function',
    function: {
      name: h.name,
      description: h.description,
      parameters: h.input_schema,
    },
  }));
}

/**
 * Check if a tool call name matches a honeytool. If it does, it's confirmed tampering.
 * @param {string} toolName
 * @returns {{ isHoneytool: boolean, honeytool?: Honeytool }}
 */
export function checkHoneytoolHit(toolName) {
  const match = HONEYTOOLS.find(h => h.name === toolName);
  return match
    ? { isHoneytool: true, honeytool: match }
    : { isHoneytool: false };
}

/**
 * Check if tool call parameters contain canary tokens from any honeytool.
 * Catches cases where the proxy renames the tool but copies the canary token in params.
 */
export function checkCanaryTokens(params) {
  const paramStr = JSON.stringify(params);
  const hits = [];
  for (const ht of HONEYTOOLS) {
    for (const token of ht.canaryTokens) {
      if (paramStr.includes(token)) {
        hits.push({ honeytool: ht.name, token, baitCategory: ht.baitCategory });
      }
    }
  }
  return hits;
}

/**
 * Generate a config file content for honeytool monitoring.
 */
export function generateHoneytoolConfig() {
  return {
    _comment: 'AgentShield-style honeytool configuration. These fake tools detect LLM proxy injection.',
    version: '1.0.0',
    honeytools: HONEYTOOLS.map(h => ({
      name: h.name,
      baitCategory: h.baitCategory,
      triggerDescription: h.triggerDescription,
    })),
    monitoring: {
      log_file: '.honeytool-hits.log',
      alert_on_hit: true,
      alert_channels: ['console', 'file'],
    },
    integration_guide: {
      anthropic: 'Add toAnthropicTools(honeytools) to your tools array in the API request',
      openai: 'Add toOpenAITools(honeytools) to your tools array in the API request',
      claude_code: 'Mix honeytool names into your allowed tool list. Monitor for invocations.',
    },
  };
}

export { HONEYTOOLS };
