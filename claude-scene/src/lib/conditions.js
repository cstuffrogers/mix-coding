import { existsSync } from "fs";
import { join , dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// claude-scene/src/lib/ → up 3 = auto-coding/
const PROJECT_ROOT = join(__dirname, '..', '..', '..');


const SIMPLE_CONDITIONS = {
  frontend_involved: (ctx) =>
    ctx.selectedTheme === 'animal-island' ||
    /前端|UI|界面|页面|组件|样式|设计/i.test(ctx.prompt || ''),

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
  conversation_mode: () => process.env.CLAUDECODE === '1',
  mattpocock_skill_available: () => process.env.CLAUDECODE === '1',
  web_design_engineer_available: () => process.env.CLAUDECODE === '1',
  ai_friendly_web_design_available: () => process.env.CLAUDECODE === '1',

  impeccable_available: () => {
    const homeSkill = join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'skills', 'impeccable', 'SKILL.md');
    const projectSkill = join(PROJECT_ROOT, '.claude', 'skills', 'impeccable', 'SKILL.md');
    return existsSync(homeSkill) || existsSync(projectSkill);
  },

  awesome_design_md_available: () => {
    return existsSync(join(PROJECT_ROOT, '.claude', 'skills', 'awesome-design-md', 'SKILL.md'));
  },

  mobile_ui_review_available: () => {
    // Skill() tool only available in conversation mode (CLAUDECODE=1)
    if (process.env.CLAUDECODE !== '1') return false;
    return existsSync(join(PROJECT_ROOT, '.claude', 'skills', 'mobile-ui-review', 'SKILL.md'));
  },

  webapp_testing_available: () => process.env.CLAUDECODE === '1',

  // MCP tools require Claude Code conversation-level tool calling.
  // When running inside a Claude Code session (CLAUDECODE=1), MCP tools ARE
  // available at the conversation level. When running in a standalone CLI, they're not.
  // In conversation mode, Claude handles MCP steps directly (reads command file and
  // calls MCP tools). In CLI mode, these steps are skipped to avoid stub 空转.
  github_mcp_available: () => process.env.CLAUDECODE === '1',
  sentry_mcp_available: () => process.env.CLAUDECODE === '1',
  tavily_mcp_available: () => process.env.CLAUDECODE === '1',
  context7_mcp_available: () => process.env.CLAUDECODE === '1',
  codegraph_mcp_available: () => process.env.CLAUDECODE === '1',
  supabase_mcp_available: () => process.env.CLAUDECODE === '1',
  stripe_mcp_available: () => process.env.CLAUDECODE === '1',
  resend_mcp_available: () => process.env.CLAUDECODE === '1',
  memory_mcp_available: () => process.env.CLAUDECODE === '1',

  // Mobile platform guards
  mobile_platform: (ctx) => ctx.platform === 'android' || ctx.platform === 'ios' || ctx.platform === 'both',
  ios_platform: (ctx) => ctx.platform === 'ios' || ctx.platform === 'both',
  android_platform: (ctx) => ctx.platform === 'android' || ctx.platform === 'both',

  // Mobile tool availability
  mobsf_mcp_available: () => process.env.CLAUDECODE === '1',
  mobsfscan_available: () => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('pip show mobsfscan 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { return false; }
  },
  bearer_mcp_available: () => process.env.CLAUDECODE === '1',
  dependencycheck_available: () => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('dependency-check --version 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { /* not on PATH */ }
    const dcBat = join(PROJECT_ROOT, 'tools', 'dependency-check', 'bin', 'dependency-check.bat');
    return existsSync(dcBat);
  },
  detox_mcp_available: () => process.env.CLAUDECODE === '1',
};

// eslint-disable-next-line sonarjs/cognitive-complexity
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
  // eslint-disable-next-line sonarjs/slow-regex
  const cmpMatch = trimmed.match(/^(\w+)\s*(===?|!==?)\s*(.+)$/);
  if (cmpMatch) {
    const [, key, op, rawVal] = cmpMatch;
    const expected = rawVal.trim().replace(/^['"]|['"]$/g, '');
    const actual = ctx[key];
    if (op === '===' || op === '==') return String(actual) === expected;
    if (op === '!==' || op === '!=') return String(actual) !== expected;
  }

  // property access: key.length > N
  const lenMatch = trimmed.match(/^(\w+)\.length\s*(>|<|>=|<=)\s*(\d+)$/);
  if (lenMatch) {
    const [, key, op, num] = lenMatch;
    const val = ctx[key];
    const len = Array.isArray(val) || (typeof val === 'string') ? val.length : 0;
    const n = parseInt(num, 10);
    switch (op) {
      case '>': return len > n;
      case '<': return len < n;
      case '>=': return len >= n;
      case '<=': return len <= n;
    }
  }

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
