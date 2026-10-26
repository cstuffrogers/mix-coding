import { isConversationMode } from './platform.js';
import { hasMcpServer } from './mcp-config.js';
import { existsSync } from "fs";
import { join } from 'path';
import { execSync } from 'child_process';
import { PROJECT_ROOT, findResourceDir } from './paths.js';


const SIMPLE_CONDITIONS = {
  frontend_involved: (ctx) =>
    ctx.selectedTheme === 'animal-island' ||
    ctx.selectedTheme === 'liquid-glass' ||
    /前端|UI|界面|页面|组件|样式|设计/i.test(ctx.prompt || ''),

  selected_theme_liquid_glass: (ctx) =>
    ctx.selectedTheme === 'liquid-glass' ||
    /液态玻璃|liquid.?glass/i.test(ctx.prompt || ''),

  // File-existence guards (used by plan/cicd/setup scenes)
  build_artifacts_exist: () => existsSync(join(PROJECT_ROOT, 'build')) || existsSync(join(PROJECT_ROOT, 'dist')) || existsSync(join(PROJECT_ROOT, '.next')),
  planning_files_exist: () => existsSync(join(PROJECT_ROOT, 'plan.md')) || existsSync(join(PROJECT_ROOT, 'findings.md')) || existsSync(join(PROJECT_ROOT, 'progress.md')),
  spec_file_exists: () => existsSync(join(PROJECT_ROOT, 'spec.md')) || existsSync(join(PROJECT_ROOT, 'specs')),
  spec_file_not_exists: () => !existsSync(join(PROJECT_ROOT, 'spec.md')) && !existsSync(join(PROJECT_ROOT, 'specs')),
  setupConfigured: (ctx) => ctx?.setupConfigured === true || ctx?.e2eConfigured === true || ctx?.monitorConfigured === true,
  has_frontend_changes: (ctx) => ctx?.has_frontend_changes === true,
  attestation_enabled: (ctx) => ctx?.attestation_enabled === true || ctx?.user_confirmed === true,
  awesome_design_md_used: (ctx) => ctx?.awesome_design_md_used === true || ctx?.user_selected_brand !== undefined,
  ai_design: (ctx) => Array.isArray(ctx?.selected_modes) && ctx.selected_modes.includes('ai_design'),
  full_audit: (ctx) => Array.isArray(ctx?.selected_modes) && ctx.selected_modes.includes('full_audit'),
  code_review: (ctx) => Array.isArray(ctx?.selected_modes) && ctx.selected_modes.includes('code_review'),
  analyze_only: (ctx) => Array.isArray(ctx?.selected_modes) && ctx.selected_modes.includes('analyze_only'),
  quality_tools: (ctx) => Array.isArray(ctx?.selected_modes) && ctx.selected_modes.includes('quality_tools'),
  security_deep: (ctx) => Array.isArray(ctx?.selected_modes) && ctx.selected_modes.includes('security_deep'),

  user_confirmed_open_design: (ctx) =>
    ctx.user_confirmed_open_design === true,

  user_confirmed_refactor: (ctx) =>
    ctx.user_confirmed_refactor === true,

  open_design_executed: (ctx) =>
    ctx.open_design_executed === true,

  user_mentioned_competitor_or_domain: (ctx) =>
    /竞品|对比|领域|市场|同类|竞争对手|分析/i.test(ctx.prompt || ''),

  'migrationHighCount > 0': (ctx) => (ctx.migrationHighCount || 0) > 0,

  'fix_failed_count >= 3': (ctx) => ctx.fixFailedCount >= 3,

  generate_doc_site: (ctx) =>
    /文档站点|网站|在线文档|doc site/i.test(ctx.prompt || ''),

  fixes_applied: (ctx) =>
    ctx.fixApplied === true || ctx.securityScanResult?.fixesApplied || false,

  high_severity_found: (ctx) =>
    ctx.securityScanResult?.highSeverityFound || false,

  // CE Plugin — check for actual installation file
  plugin_ce_available: () => {
    const ceConfig = join(PROJECT_ROOT, '.claude', 'plugins', 'compound-engineering.json');
    return existsSync(ceConfig);
  },

  // Claude Code skills — not callable from CLI subprocess.
  // Detect CLAUDECODE env var: when running inside a Claude Code session,
  // the Skill tool IS available. When running in a standalone CLI, it's not.
  conversation_mode: () => isConversationMode(),
  mattpocock_skill_available: () => isConversationMode(),
  web_design_engineer_available: () => isConversationMode(),
  ai_friendly_web_design_available: () => isConversationMode(),

  impeccable_available: () => {
    return existsSync(join(findResourceDir('skills', 'impeccable'), 'SKILL.md'));
  },

  awesome_design_md_available: () => {
    return existsSync(join(findResourceDir('skills', 'awesome-design-md'), 'SKILL.md'));
  },

  mobile_ui_review_available: () => {
    // Skill() tool only available in conversation mode (CLAUDECODE=1)
    if (!isConversationMode()) return false;
    return existsSync(join(findResourceDir('skills', 'mobile-ui-review'), 'SKILL.md'));
  },

  webapp_testing_available: () => isConversationMode(),

  // MCP 条件看的是**真配置**（.pi/mcp.json / ~/.pi/agent/mcp.json / .claude/mcp.json）。
  // 以前这里是 isConversationMode()：在对话里就假定什么 MCP 都有，结果配置里只剩
  // 三个 server 时 github/sentry/tavily/context7 依然判「满足」，场景排了一堆
  // 调用不存在的工具的步骤。缺工具就把步骤跳过，比假装能用诚实。
  github_mcp_available: () => hasMcpServer('github'),
  sentry_mcp_available: () => hasMcpServer('sentry'),
  tavily_mcp_available: () => hasMcpServer('tavily'),
  context7_mcp_available: () => hasMcpServer('context7'),
  codegraph_mcp_available: () => hasMcpServer('codegraph'),
  crg_mcp_available: () => hasMcpServer('codegraph'),
  crg_skill_available: () => isConversationMode(),
  // CRG graph already built for this repo (.code-review-graph/ dir exists)
  crg_graph_built: () => existsSync(join(PROJECT_ROOT, '.code-review-graph')),
  supabase_mcp_available: () => hasMcpServer('supabase'),
  stripe_mcp_available: () => hasMcpServer('stripe'),
  resend_mcp_available: () => hasMcpServer('resend'),
  // memory/codeguardian 是引擎自带的 handler，不依赖 MCP
  memory_mcp_available: () => true,
  codeguardian_mcp_available: () => true,
  playwright_mcp_available: () => hasMcpServer('playwright'),

  // Mobile platform guards
  mobile_platform: (ctx) => ctx.platform === 'android' || ctx.platform === 'ios' || ctx.platform === 'both',
  ios_platform: (ctx) => ctx.platform === 'ios' || ctx.platform === 'both',
  android_platform: (ctx) => ctx.platform === 'android' || ctx.platform === 'both',

  // Mobile tool availability
  mobsf_mcp_available: () => hasMcpServer('mobsf'),
  mobsfscan_available: () => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('pip show mobsfscan 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { return false; }
  },
  bearer_mcp_available: () => hasMcpServer('bearer'),
  dependencycheck_available: () => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('dependency-check --version 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { /* not on PATH */ }
    const dcBat = join(PROJECT_ROOT, 'tools', 'dependency-check', 'bin', 'dependency-check.bat');
    return existsSync(dcBat);
  },
  detox_mcp_available: () => hasMcpServer('detox'),
};

// eslint-disable-next-line sonarjs/super-linear-regex
const CMP_RE = /^(\w+)\s*(===?|!==?)\s*(.+)$/;

function evalComparison(trimmed, ctx) {
  const cmpMatch = trimmed.match(CMP_RE);
  if (!cmpMatch) return null;
  const [, key, op, rawVal] = cmpMatch;
  const expected = rawVal.trim().replace(/^['"]|['"]$/g, '');
  const actual = ctx[key];
  if (op === '===' || op === '==') return String(actual) === expected;
  if (op === '!==' || op === '!=') return String(actual) !== expected;
  return null;
}

const LEN_RE = /^(\w+)\.length\s*(>|<|>=|<=)\s*(\d+)$/;

// Array/string membership: key.includes('value')
// eslint-disable-next-line sonarjs/super-linear-regex
const INCLUDES_RE = /^(\w+)\.includes\(\s*(['"]?)([^'")]+)\2\s*\)$/;

function evalIncludes(trimmed, ctx) {
  const m = trimmed.match(INCLUDES_RE);
  if (!m) return null;
  const [, key, , needle] = m;
  const val = ctx[key];
  if (Array.isArray(val)) return val.includes(needle);
  if (typeof val === 'string') return val.includes(needle);
  return false;
}

function evalLength(trimmed, ctx) {
  const lenMatch = trimmed.match(LEN_RE);
  if (!lenMatch) return null;
  const [, key, op, num] = lenMatch;
  const val = ctx[key];
  const len = Array.isArray(val) || (typeof val === 'string') ? val.length : 0;
  const n = parseInt(num, 10);
  switch (op) {
    case '>': return len > n;
    case '<': return len < n;
    case '>=': return len >= n;
    case '<=': return len <= n;
    default: return null;
  }
}

function evalClause(expr, ctx) {
  const trimmed = expr.trim();

  // compound: A || B
  if (trimmed.includes(' || ')) {
    return trimmed.split(' || ').some(part => evalClause(part, ctx));
  }

  // compound: A && B
  if (trimmed.includes(' && ')) {
    return trimmed.split(' && ').every(part => evalClause(part, ctx));
  }

  // comparison: key === value / key !== value
  const cmpResult = evalComparison(trimmed, ctx);
  if (cmpResult !== null) return cmpResult;

  // property access: key.length > N
  const lenResult = evalLength(trimmed, ctx);
  if (lenResult !== null) return lenResult;

  // membership: key.includes('value')
  const includesResult = evalIncludes(trimmed, ctx);
  if (includesResult !== null) return includesResult;

  // negation: !key
  if (trimmed.startsWith('!')) {
    const key = trimmed.slice(1);
    if (key in SIMPLE_CONDITIONS) return !SIMPLE_CONDITIONS[key](ctx);
    return !ctx[key];
  }

  // simple truthy/falsy: key from context
  if (/^\w+$/.test(trimmed)) {
    // Check SIMPLE_CONDITIONS first — they can be called with context
    if (trimmed in SIMPLE_CONDITIONS) {
      return SIMPLE_CONDITIONS[trimmed](ctx);
    }
    return !!ctx[trimmed];
  }

  // lookup in simple conditions table
  const fn = SIMPLE_CONDITIONS[trimmed];
  return fn ? fn(ctx) : false;
}

export function evaluateCondition(condition, context) {
  if (!condition) return true;
  if (condition in SIMPLE_CONDITIONS) {
    return SIMPLE_CONDITIONS[condition](context);
  }
  return evalClause(condition, context);
}
