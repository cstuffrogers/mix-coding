import { existsSync, readFileSync } from 'fs';
import { join , dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// claude-scene/src/lib/ → up 3 = auto-coding/
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// eslint-disable-next-line sonarjs/cognitive-complexity
function mcpAvailable(name) {
  // Check local .mcp/ directories first
  const mcpDir = join(PROJECT_ROOT, '.mcp');
  if (existsSync(mcpDir)) {
    const candidates = [`${name}-mcp`, name];
    for (const c of candidates) {
      if (existsSync(join(mcpDir, c))) return true;
    }
  }
  // Also check .claude/mcp.json for configured servers
  const mcpConfigPath = join(PROJECT_ROOT, '.claude', 'mcp.json');
  if (existsSync(mcpConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      if (config.mcpServers && config.mcpServers[name]) return true;
      // tavily MCP is named "tavily-search" in mcp.json
      if (name === 'tavily' && config.mcpServers['tavily-search']) return true;
    } catch { /* mcp config not found or invalid */ }
  }
  // CodeGraph: check for local binary
  if (name === 'codegraph') {
    const cgBase = join(PROJECT_ROOT, 'codegraph-win32-x64');
    return existsSync(cgBase);
  }
  return false;
}

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

  manual_intervention_required: () => false,

  'migrationHighCount > 0': (ctx) => (ctx.migrationHighCount || 0) > 0,

  'fix_failed_count >= 3': (ctx) => ctx.fixFailedCount >= 3,

  generate_doc_site: (ctx) =>
    /文档站点|网站|在线文档|doc site/i.test(ctx.prompt || ''),

  fixes_applied: (ctx) =>
    ctx.fixApplied === true || ctx.securityScanResult?.fixesApplied || false,

  high_severity_found: (ctx) =>
    ctx.securityScanResult?.highSeverityFound || false,

  plugin_ce_available: () => {
    return existsSync(join(PROJECT_ROOT, '.claude', 'plugins', 'compound-engineering.json'));
  },

  anthropic_skill_available: () => {
    return existsSync(join(PROJECT_ROOT, '.claude', 'skills', 'sec-bug-hunt'));
  },

  mattpocock_skill_available: () => {
    return existsSync(join(PROJECT_ROOT, '.claude', 'skills', 'mattpocock', 'skills'));
  },

  web_design_engineer_available: () => {
    return existsSync(join(PROJECT_ROOT, '.claude', 'skills', 'web-design-engineer', 'SKILL.md'));
  },

  ai_friendly_web_design_available: () => {
    return existsSync(join(PROJECT_ROOT, '.claude', 'skills', 'ai-friendly-web-design', 'SKILL.md'));
  },

  impeccable_available: () => {
    const homeSkill = join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'skills', 'impeccable', 'SKILL.md');
    const projectSkill = join(PROJECT_ROOT, '.claude', 'skills', 'impeccable', 'SKILL.md');
    return existsSync(homeSkill) || existsSync(projectSkill);
  },

  awesome_design_md_available: () => {
    return existsSync(join(PROJECT_ROOT, '.claude', 'skills', 'awesome-design-md', 'SKILL.md'));
  },

  github_mcp_available: () => mcpAvailable('github'),
  sentry_mcp_available: () => mcpAvailable('sentry'),
  tavily_mcp_available: () => mcpAvailable('tavily'),
  context7_mcp_available: () => mcpAvailable('context7'),
  codegraph_mcp_available: () => mcpAvailable('codegraph'),
  supabase_mcp_available: () => mcpAvailable('supabase'),
  stripe_mcp_available: () => mcpAvailable('stripe'),
  resend_mcp_available: () => mcpAvailable('resend'),
  memory_mcp_available: () => mcpAvailable('memory'),

  // Mobile platform guards
  mobile_platform: (ctx) => ctx.platform === 'android' || ctx.platform === 'ios' || ctx.platform === 'both',
  ios_platform: (ctx) => ctx.platform === 'ios' || ctx.platform === 'both',
  android_platform: (ctx) => ctx.platform === 'android' || ctx.platform === 'both',

  // Mobile tool availability
  mobsf_mcp_available: () => mcpAvailable('mobsf'),
  mobsfscan_available: () => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('mobsfscan --version 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { return false; }
  },
  bearer_mcp_available: () => mcpAvailable('bearer'),
  dependencycheck_available: () => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('dependency-check --version 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { /* not on PATH */ }
    const dcBat = join(PROJECT_ROOT, 'tools', 'dependency-check', 'bin', 'dependency-check.bat');
    return existsSync(dcBat);
  },
  flutter_or_rn: (ctx) => ctx.project_type === 'flutter' || ctx.project_type === 'rn',
  fastlane_available: () => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('fastlane --version 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { return false; }
  },
  shorebird_available: () => mcpAvailable('shorebird'),
  maestro_mcp_available: () => mcpAvailable('maestro'),
  detox_mcp_available: () => mcpAvailable('detox'),
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
