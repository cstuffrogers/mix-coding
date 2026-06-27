/**
 * LLM Proxy Detector — differential testing engine.
 * Sends identical prompts to direct API and proxy, compares responses
 * to detect tool-call injection, content tampering, and data exfiltration.
 *
 * Usage:
 *   import { detectProxyTampering } from './lib/llm-proxy-detector.js';
 *   const report = await detectProxyTampering({ prompt: "Hello", ... });
 */

const EXFIL_PATTERNS = [
  // URLs that don't belong in normal tool calls
  { pattern: /https?:\/\/[^\s"'}]*webhook[^\s"'}]*/i,  label: 'webhook URL' },
  { pattern: /https?:\/\/[^\s"'}]*discord[^\s"'}]*/i,   label: 'Discord webhook' },
  { pattern: /https?:\/\/[^\s"'}]*telegram[^\s"'}]*/i,  label: 'Telegram bot API' },
  { pattern: /https?:\/\/[^\s"'}]*slack[^\s"'}]*/i,     label: 'Slack webhook' },
  { pattern: /https?:\/\/[^\s"'}]*pastebin[^\s"'}]*/i,  label: 'Pastebin upload' },
  { pattern: /https?:\/\/[^\s"'}]*requestbin[^\s"'}]*/i, label: 'RequestBin' },
  { pattern: /https?:\/\/[^\s"'}]*ngrok[^\s"'}]*/i,     label: 'ngrok tunnel' },
  { pattern: /https?:\/\/[^\s"'}]*beeceptor[^\s"'}]*/i, label: 'Beeceptor' },
  { pattern: /https?:\/\/[^\s"'}]*pipedream[^\s"'}]*/i, label: 'Pipedream' },
  { pattern: /https?:\/\/[^\s"'}]*canarytokens[^\s"'}]*/i, label: 'CanaryToken' },
  // Suspicious env var access
  { pattern: /\bprocess\.env\.(?!NODE_ENV|CI|VERCEL|NETLIFY)[A-Z_]{3,}/, label: 'env var access' },
  // File exfiltration patterns
  { pattern: /\breadFileSync\(.*\.env/i, label: '.env file read' },
  { pattern: /\bcat\s+.*\.env/i, label: 'cat .env' },
  { pattern: /\.pem\b|private.*key|secret.*key/i, label: 'private key reference' },
  // Data exfiltration function names
  { pattern: /\b(sendTo|uploadTo|exfiltrate|steal|leak|dump_)\w*/i, label: 'exfiltration function name' },
];

/**
 * @typedef {object} DetectorConfig
 * @property {string} prompt - The prompt to send
 * @property {string} systemPrompt - System message
 * @property {string} directApiUrl - Direct API endpoint (e.g. https://api.anthropic.com/v1/messages)
 * @property {string} directApiKey - API key for direct endpoint
 * @property {string} proxyApiUrl - Proxy API endpoint
 * @property {string} proxyApiKey - API key for proxy
 * @property {string} model - Model name
 * @property {number} [maxTokens=1024] - Max tokens
 * @property {object[]} [tools] - Tool definitions to send
 * @property {string} [provider='anthropic'] - 'anthropic' or 'openai'
 * @property {number} [timeoutMs=30000] - Request timeout
 * @property {number} [rounds=3] - Number of rounds to test
 */

/**
 * @typedef {object} RoundReport
 * @property {number} round
 * @property {object} direct - Direct API response (parsed)
 * @property {object} proxy - Proxy API response (parsed)
 * @property {Difference[]} differences
 */

/**
 * @typedef {object} Difference
 * @property {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'} severity
 * @property {string} category - 'tool_calls' | 'content' | 'finish_reason' | 'usage' | 'structure'
 * @property {string} description
 * @property {*} [directValue]
 * @property {*} [proxyValue]
 */

/**
 * @typedef {object} DetectionReport
 * @property {boolean} tamperingDetected
 * @property {'CLEAN'|'SUSPICIOUS'|'CONFIRMED_TAMPERING'} verdict
 * @property {string} summary
 * @property {RoundReport[]} rounds
 * @property {Difference[]} allDifferences
 */

// ---- Request helpers ----

function buildAnthropicRequest(prompt, systemPrompt, model, maxTokens, tools) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (systemPrompt) body.system = systemPrompt;
  if (tools && tools.length) body.tools = tools;
  return body;
}

function buildOpenAIRequest(prompt, systemPrompt, model, maxTokens, tools) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  const body = { model, max_tokens: maxTokens, messages };
  if (tools && tools.length) body.tools = tools;
  return body;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function callLLM(apiUrl, apiKey, body, provider, timeoutMs) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const resp = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, timeoutMs);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${errText.slice(0, 500)}`);
  }
  return resp.json();
}

// ---- Diff engine ----

function deepDiff(a, b, path = '') {
  /** @type {Difference[]} */
  const diffs = [];

  if (a === b) return diffs;
  if (a == null || b == null) {
    diffs.push({ severity: 'HIGH', category: 'structure', description: `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`, directValue: a, proxyValue: b });
    return diffs;
  }
  if (typeof a !== typeof b) {
    diffs.push({ severity: 'HIGH', category: 'structure', description: `${path}: type mismatch ${typeof a} vs ${typeof b}`, directValue: a, proxyValue: b });
    return diffs;
  }
  if (typeof a !== 'object') {
    diffs.push({ severity: 'LOW', category: 'content', description: `${path}: "${a}" vs "${b}"`, directValue: a, proxyValue: b });
    return diffs;
  }

  const aIsArr = Array.isArray(a), bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) {
    diffs.push({ severity: 'HIGH', category: 'structure', description: `${path}: array vs object mismatch`, directValue: a, proxyValue: b });
    return diffs;
  }

  if (aIsArr) {
    if (a.length !== b.length) {
      diffs.push({
        severity: 'CRITICAL',
        category: 'tool_calls',
        description: `${path}: length differs (${a.length} vs ${b.length}) — possible injection`,
        directValue: a,
        proxyValue: b,
      });
    }
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...deepDiff(a[i], b[i], `${path}[${i}]`));
    }
    return diffs;
  }

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    if (!(k in a)) {
      diffs.push({
        severity: 'CRITICAL',
        category: 'tool_calls',
        description: `${path}.${k}: key only in proxy — possible injection`,
        directValue: undefined,
        proxyValue: b[k],
      });
    } else if (!(k in b)) {
      diffs.push({
        severity: 'MEDIUM',
        category: 'structure',
        description: `${path}.${k}: key only in direct — possible suppression`,
        directValue: a[k],
        proxyValue: undefined,
      });
    } else {
      diffs.push(...deepDiff(a[k], b[k], `${path}.${k}`));
    }
  }
  return diffs;
}

function diffResponses(direct, proxy) {
  const diffs = [];

  // Compare stop_reason / finish_reason
  const directStop = direct.stop_reason ?? direct.choices?.[0]?.finish_reason;
  const proxyStop = proxy.stop_reason ?? proxy.choices?.[0]?.finish_reason;
  if (directStop !== proxyStop) {
    diffs.push({
      severity: 'HIGH',
      category: 'finish_reason',
      description: `finish_reason differs: "${directStop}" vs "${proxyStop}"`,
      directValue: directStop,
      proxyValue: proxyStop,
    });
  }

  // Compare tool_calls
  const directTools = extractToolCalls(direct);
  const proxyTools = extractToolCalls(proxy);
  const toolDiffs = compareToolCalls(directTools, proxyTools);
  diffs.push(...toolDiffs);

  // Compare content text
  const directContent = extractContent(direct);
  const proxyContent = extractContent(proxy);
  if (directContent !== proxyContent) {
    diffs.push({
      severity: 'MEDIUM',
      category: 'content',
      description: 'Response content differs between direct and proxy',
      directValue: directContent.slice(0, 500),
      proxyValue: proxyContent.slice(0, 500),
    });
  }

  return diffs;
}

function extractToolCalls(response) {
  // Anthropic format
  if (response.content) {
    return response.content.filter(c => c.type === 'tool_use').map(t => ({
      id: t.id,
      name: t.name,
      input: t.input,
    }));
  }
  // OpenAI format
  if (response.choices?.[0]?.message?.tool_calls) {
    return response.choices[0].message.tool_calls.map(t => ({
      id: t.id,
      name: t.function?.name,
      input: JSON.parse(t.function?.arguments || '{}'),
    }));
  }
  return [];
}

function extractContent(response) {
  if (response.content) {
    return response.content.filter(c => c.type === 'text').map(c => c.text).join('');
  }
  if (response.choices?.[0]?.message?.content) {
    return response.choices[0].message.content;
  }
  return '';
}

function compareToolCalls(directTools, proxyTools) {
  /** @type {Difference[]} */
  const diffs = [];

  if (directTools.length !== proxyTools.length) {
    const extra = proxyTools.length - directTools.length;
    diffs.push({
      severity: 'CRITICAL',
      category: 'tool_calls',
      description: `tool_calls count differs: direct=${directTools.length}, proxy=${proxyTools.length} (+${extra} extra in proxy) — POSSIBLE INJECTION`,
      directValue: directTools,
      proxyValue: proxyTools,
    });
  }

  const directNames = new Set(directTools.map(t => t.name));
  for (const pt of proxyTools) {
    if (!directNames.has(pt.name)) {
      diffs.push({
        severity: 'CRITICAL',
        category: 'tool_calls',
        description: `Proxy returned unknown tool "${pt.name}" not in direct response — INJECTED TOOL CALL`,
        directValue: undefined,
        proxyValue: pt,
      });
    }
    // Check for exfiltration patterns in parameters
    const paramStr = JSON.stringify(pt.input || {});
    for (const ep of EXFIL_PATTERNS) {
      if (ep.pattern.test(paramStr)) {
        diffs.push({
          severity: 'CRITICAL',
          category: 'tool_calls',
          description: `Tool "${pt.name}" parameters contain ${ep.label}: ${paramStr.slice(0, 200)}`,
          directValue: null,
          proxyValue: paramStr,
        });
      }
    }
  }

  return diffs;
}

// ---- Main detection ----

/**
 * Run differential testing between direct API and proxy.
 * Returns a structured report of all detected anomalies.
 */
export async function detectProxyTampering(config) {
  const {
    prompt,
    systemPrompt = '',
    directApiUrl,
    directApiKey,
    proxyApiUrl,
    proxyApiKey,
    model,
    maxTokens = 1024,
    tools = [],
    provider = 'anthropic',
    timeoutMs = 300000,
    rounds = 3,
  } = config;

  /** @type {RoundReport[]} */
  const roundReports = [];

  for (let r = 0; r < rounds; r++) {
    const body = provider === 'anthropic'
      ? buildAnthropicRequest(prompt, systemPrompt, model, maxTokens, tools)
      : buildOpenAIRequest(prompt, systemPrompt, model, maxTokens, tools);

    const [directResp, proxyResp] = await Promise.all([
      callLLM(directApiUrl, directApiKey, body, provider, timeoutMs),
      callLLM(proxyApiUrl, proxyApiKey, body, provider, timeoutMs),
    ]);

    const differences = diffResponses(directResp, proxyResp);

    roundReports.push({
      round: r + 1,
      direct: directResp,
      proxy: proxyResp,
      differences,
    });
  }

  const allDiffs = roundReports.flatMap(r => r.differences);
  const criticals = allDiffs.filter(d => d.severity === 'CRITICAL');
  const highs = allDiffs.filter(d => d.severity === 'HIGH');

  let verdict = 'CLEAN';
  let tamperingDetected = false;

  if (criticals.length > 0) {
    verdict = 'CONFIRMED_TAMPERING';
    tamperingDetected = true;
  } else if (highs.length > 0) {
    verdict = 'SUSPICIOUS';
    tamperingDetected = true;
  }

  const summary = criticals.length > 0
    ? `DETECTED ${criticals.length} CRITICAL anomalies across ${rounds} rounds. Proxy is injecting or modifying tool calls.`
    : highs.length > 0
      ? `Found ${highs.length} HIGH-severity anomalies. Proxy behavior differs from direct API — investigate.`
      : allDiffs.length > 0
        ? `Found ${allDiffs.length} minor differences. Likely benign (rounding, timing).`
        : `No differences detected across ${rounds} rounds. Proxy appears clean.`;

  return {
    tamperingDetected,
    verdict,
    summary,
    rounds: roundReports,
    allDifferences: allDiffs,
  };
}

/**
 * Quick single-round check. Returns true if proxy appears tampered.
 */
export async function quickCheck(config) {
  const report = await detectProxyTampering({ ...config, rounds: 1 });
  return {
    suspicious: report.tamperingDetected,
    verdict: report.verdict,
    summary: report.summary,
    criticalCount: report.allDifferences.filter(d => d.severity === 'CRITICAL').length,
  };
}

export { EXFIL_PATTERNS };
