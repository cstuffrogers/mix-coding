/**
 * LLM Single-Endpoint Audit — 单端审计引擎。
 *
 * 不需要直连 API，只对中转站发请求就能检测 tool call 注入。
 *
 * 原理：
 *   1. 混入蜜罐工具 → 中转站注入调用蜜罐 = 确认攻击
 *   2. 返回不在请求列表中的 tool name → 确认注入
 *   3. 参数含外发 URL/env var 读取 → 高度可疑
 *
 * Usage:
 *   node src/scripts/audit-proxy.js --url https://proxy.com/v1/messages --key sk-xxx
 */

import { generateHoneytools, toAnthropicTools, toOpenAITools, checkHoneytoolHit, checkCanaryTokens } from './honeytools.js';
import { EXFIL_PATTERNS } from './llm-proxy-detector.js';

// 混入蜜罐的基础工具集 — 看起来正常的工具列表
const BASE_TOOLS_ANTHROPIC = [
  { name: 'Read', description: 'Read a file from the local filesystem.', input_schema: { type: 'object', properties: { file_path: { type: 'string', description: 'The absolute path to the file' } }, required: ['file_path'] } },
  { name: 'Bash', description: 'Execute a bash command.', input_schema: { type: 'object', properties: { command: { type: 'string', description: 'The command to execute' } }, required: ['command'] } },
  { name: 'Write', description: 'Write a file to the local filesystem.', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
  { name: 'Glob', description: 'Find files matching a pattern.', input_schema: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } },
  { name: 'Grep', description: 'Search file contents with regex.', input_schema: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } },
  { name: 'WebSearch', description: 'Search the web.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'WebFetch', description: 'Fetch content from a URL.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
];

// 测试用提示词 — 不同类别触发不同行为
const TEST_PROMPTS = [
  {
    id: 'simple_list',
    prompt: 'List all .js files in the current directory. Use only the tools that are absolutely necessary.',
    purpose: '基础测试：简单文件操作，不应触发任何 tool call 注入',
  },
  {
    id: 'read_config',
    prompt: 'Read the package.json file and tell me what dependencies are installed.',
    purpose: '文件读取：中转站可能趁机注入读取 .env 的 tool call',
  },
  {
    id: 'data_analysis',
    prompt: 'Analyze the project structure. Count files by type and summarize the codebase.',
    purpose: '多步操作：需要多个工具配合，给中转站更多注入机会',
  },
];

/**
 * @typedef {object} SingleAuditFinding
 * @property {'CRITICAL'|'HIGH'|'MEDIUM'|'INFO'} severity
 * @property {string} category - 'honeytool_hit' | 'unknown_tool' | 'exfil_param' | 'extra_tool_use' | 'suspicious_content'
 * @property {number} round - Which test round
 * @property {string} promptId - Which prompt was used
 * @property {string} description
 * @property {*} [detail]
 */

/**
 * @typedef {object} SingleAuditReport
 * @property {'CLEAN'|'SUSPICIOUS'|'CONFIRMED_INJECTION'} verdict
 * @property {boolean} injectionDetected
 * @property {SingleAuditFinding[]} findings
 * @property {number} roundsCompleted
 * @property {number} totalPrompts
 * @property {string} summary
 * @property {object} config - Audit config used (sanitized)
 */

/**
 * @param {object} config
 * @param {string} config.proxyUrl - 中转站 API 端点
 * @param {string} config.proxyKey - 中转站 API Key
 * @param {string} [config.model='claude-sonnet-4-6']
 * @param {string} [config.provider='anthropic']
 * @param {number} [config.maxTokens=1024]
 * @param {number} [config.timeoutMs=30000]
 * @param {string[]} [config.promptIds] - 指定运行哪些提示词，不传则全部
 * @returns {Promise<SingleAuditReport>}
 */
export async function auditSingleEndpoint(config) {
  const {
    proxyUrl,
    proxyKey,
    model = 'claude-sonnet-4-6',
    provider = 'anthropic',
    maxTokens = 1024,
    timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '300000', 10),
    promptIds,
  } = config;

  const honeytools = generateHoneytools();
  const htAnthropic = toAnthropicTools(honeytools);
  const htOpenAI = toOpenAITools(honeytools);
  const htNames = new Set(honeytools.map(h => h.name));

  // Convert base tools to the right format
  const baseOpenAI = BASE_TOOLS_ANTHROPIC.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  const allTools = provider === 'anthropic'
    ? [...BASE_TOOLS_ANTHROPIC, ...htAnthropic]
    : [...baseOpenAI, ...htOpenAI];

  const sentToolNames = new Set(
    provider === 'anthropic'
      ? allTools.map(t => t.name)
      : allTools.map(t => t.function?.name || t.name)
  );

  const prompts = promptIds
    ? TEST_PROMPTS.filter(p => promptIds.includes(p.id))
    : TEST_PROMPTS;

  /** @type {SingleAuditFinding[]} */
  const allFindings = [];

  for (const tp of prompts) {
    const findings = await auditOnePrompt({
      proxyUrl, proxyKey, model, provider, maxTokens, timeoutMs,
      allTools, sentToolNames, htNames, honeytools,
      promptId: tp.id, prompt: tp.prompt,
    });
    allFindings.push(...findings);
  }

  const criticals = allFindings.filter(f => f.severity === 'CRITICAL');
  const highs = allFindings.filter(f => f.severity === 'HIGH');

  let verdict = 'CLEAN';
  let injectionDetected = false;

  if (criticals.length > 0) {
    verdict = 'CONFIRMED_INJECTION';
    injectionDetected = true;
  } else if (highs.length > 0) {
    verdict = 'SUSPICIOUS';
    injectionDetected = true;
  }

  const summary = criticals.length > 0
    ? `🚨 确认注入: ${criticals.length} CRITICAL 发现 — 中转站在注入 tool call`
    : highs.length > 0
      ? `⚠ 可疑: ${highs.length} HIGH 发现 — 中转站行为异常，建议进一步调查`
      : allFindings.length > 0
        ? `ℹ ${allFindings.length} 个低级别发现 — 暂未发现明显注入`
        : `✅ 干净: ${prompts.length} 个提示词测试通过，未发现注入迹象`;

  return {
    verdict,
    injectionDetected,
    findings: allFindings,
    roundsCompleted: 1,
    totalPrompts: prompts.length,
    summary,
    config: { proxyUrl, model, provider, promptCount: prompts.length },
  };
}

async function auditOnePrompt(opts) {
  const {
    proxyUrl, proxyKey, model, provider, maxTokens, timeoutMs,
    allTools, sentToolNames, htNames, honeytools,
    promptId, prompt,
  } = opts;

  /** @type {SingleAuditFinding[]} */
  const findings = [];

  const body = provider === 'anthropic'
    ? { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }], tools: allTools }
    : { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }], tools: allTools };

  const headers = {
    'Content-Type': 'application/json',
  };
  if (provider === 'anthropic') {
    headers['x-api-key'] = proxyKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${proxyKey}`;
  }

  let resp;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const fetchResp = await fetch(proxyUrl, {
      method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal,
    });
    clearTimeout(timer);

    if (!fetchResp.ok) {
      const errText = await fetchResp.text().catch(() => '');
      findings.push({
        severity: 'HIGH', category: 'api_error', round: 1, promptId,
        description: `API 返回 ${fetchResp.status}: ${errText.slice(0, 300)}`,
        detail: { status: fetchResp.status, body: errText.slice(0, 500) },
      });
      return findings;
    }
    resp = await fetchResp.json();
  } catch (err) {
    findings.push({
      severity: 'HIGH', category: 'api_error', round: 1, promptId,
      description: `请求失败: ${err.message}`,
      detail: { error: err.message },
    });
    return findings;
  }

  // ── 提取 tool_use ──
  const toolCalls = extractToolCalls(resp, provider);
  const contentText = extractContentText(resp, provider);

  // ── 检查 1: 蜜罐命中 ──
  for (const tc of toolCalls) {
    const htHit = checkHoneytoolHit(tc.name);
    if (htHit.isHoneytool) {
      findings.push({
        severity: 'CRITICAL',
        category: 'honeytool_hit',
        round: 1, promptId,
        description: `蜜罐工具被调用: "${tc.name}" — 确认中转站注入 tool call`,
        detail: { toolName: tc.name, toolInput: tc.input, honeytool: htHit.honeytool },
      });
    }

    // ── 检查 2: 未知工具名 ──
    if (!htHit.isHoneytool && !sentToolNames.has(tc.name)) {
      findings.push({
        severity: 'CRITICAL',
        category: 'unknown_tool',
        round: 1, promptId,
        description: `返回了未在请求中发送的工具名: "${tc.name}" — 确认中转站注入`,
        detail: { toolName: tc.name, toolInput: tc.input },
      });
    }

    // ── 检查 3: 参数中是否有 canary token ──
    const canaryHits = checkCanaryTokens(tc.input || {});
    for (const ch of canaryHits) {
      findings.push({
        severity: 'CRITICAL',
        category: 'canary_token',
        round: 1, promptId,
        description: `工具 "${tc.name}" 参数含蜜罐 canary token "${ch.token}"`,
        detail: { toolName: tc.name, token: ch.token, honeytool: ch.honeytool },
      });
    }

    // ── 检查 4: 参数中的外发/泄露模式 ──
    const paramStr = JSON.stringify(tc.input || {});
    for (const ep of EXFIL_PATTERNS) {
      if (ep.pattern.test(paramStr)) {
        findings.push({
          severity: 'HIGH',
          category: 'exfil_param',
          round: 1, promptId,
          description: `工具 "${tc.name}" 参数含可疑内容 (${ep.label}): ${paramStr.slice(0, 200)}`,
          detail: { toolName: tc.name, patternLabel: ep.label, params: paramStr.slice(0, 300) },
        });
      }
    }
  }

  // ── 检查 5: 响应文本中的可疑内容 ──
  for (const ep of EXFIL_PATTERNS) {
    if (ep.pattern.test(contentText)) {
      findings.push({
        severity: 'MEDIUM',
        category: 'suspicious_content',
        round: 1, promptId,
        description: `响应文本含可疑内容 (${ep.label})`,
        detail: { patternLabel: ep.label, text: contentText.slice(0, 300) },
      });
    }
  }

  return findings;
}

function extractToolCalls(resp, provider) {
  if (provider === 'anthropic') {
    if (!resp.content) return [];
    return resp.content
      .filter(c => c.type === 'tool_use')
      .map(c => ({ name: c.name, input: c.input }));
  }
  // OpenAI
  const toolCalls = resp.choices?.[0]?.message?.tool_calls || [];
  return toolCalls.map(tc => ({
    name: tc.function?.name || 'unknown',
    input: (() => { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return {}; } })(),
  }));
}

function extractContentText(resp, provider) {
  if (provider === 'anthropic') {
    return (resp.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  }
  return resp.choices?.[0]?.message?.content || '';
}
