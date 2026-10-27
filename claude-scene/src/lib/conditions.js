import { isConversationMode } from './platform.js';
import { hasMcpServer } from './mcp-config.js';
import { existsSync } from "fs";
import { join } from 'path';
import { execSync } from 'child_process';
import { PROJECT_ROOT, findResourceDir } from './paths.js';

// 移动端平台事实的唯一出处：用户显式指定（ctx.platform，接受 ios/android/both）
// 或 detectProject 的探测结果（ctx.platforms / ctx.project_type，expo 视为双端）。
// 文件类谓词一律按「目标项目」看，不能用 import 时冻结的 PROJECT_ROOT（= cwd 或
// $MIX_CODING_PROJECT_DIR）—— 那样 `--target 别的项目` 时判定的是引擎自己。
function rootOf(ctx) {
  return ctx?.targetPath || PROJECT_ROOT;
}

function platformFlags(ctx) {
  const explicit = ctx?.platform;
  const detected = ctx?.platforms || {};
  const both = explicit === 'both' || ctx?.project_type === 'expo';
  return {
    ios: both || explicit === 'ios' || detected.ios === true,
    android: both || explicit === 'android' || detected.android === true,
  };
}


const SIMPLE_CONDITIONS = {
  frontend_involved: (ctx) =>
    ctx.selectedTheme === 'animal-island' ||
    ctx.selectedTheme === 'liquid-glass' ||
    /前端|UI|界面|页面|组件|样式|设计/i.test(ctx.prompt || ''),

  selected_theme_liquid_glass: (ctx) =>
    ctx.selectedTheme === 'liquid-glass' ||
    /液态玻璃|liquid.?glass/i.test(ctx.prompt || ''),

  // File-existence guards (used by plan/cicd/setup scenes)
  build_artifacts_exist: (ctx) => ['build', 'dist', '.next'].some((dir) => existsSync(join(rootOf(ctx), dir))),
  planning_files_exist: (ctx) => ['plan.md', 'findings.md', 'progress.md'].some((f) => existsSync(join(rootOf(ctx), f))),
  spec_file_exists: (ctx) => ['spec.md', 'specs'].some((f) => existsSync(join(rootOf(ctx), f))),
  spec_file_not_exists: (ctx) => ['spec.md', 'specs'].every((f) => !existsSync(join(rootOf(ctx), f))),
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

  // 需求意图（new-project 靠它决定要不要取 Supabase/Stripe/Resend 模板）。
  // 以前这三个键只出现在 WorkflowContext 的 typedef 里，**没有任何地方给它赋值**，
  // 于是 new-project 的 1.3/1.4/1.5 三步条件恒假 —— 永远不执行。
  database_required: (ctx) =>
    ctx.database_required === true || ctx.databaseRequired === true ||
    /数据库|数据表|表结构|持久化|存储层|database|postgres|supabase|mysql|sqlite|prisma|drizzle/i.test(ctx.prompt || ''),

  payment_required: (ctx) =>
    ctx.payment_required === true || ctx.paymentRequired === true ||
    /支付|付款|订阅|计费|收费|充值|payment|stripe|checkout|subscription|billing/i.test(ctx.prompt || ''),

  email_required: (ctx) =>
    ctx.email_required === true || ctx.emailRequired === true ||
    /邮件|邮箱|通知信|验证信|邮件模板|email|resend|newsletter/i.test(ctx.prompt || ''),

  'migrationHighCount > 0': (ctx) => (ctx.migrationHighCount || 0) > 0,

  'fix_failed_count >= 3': (ctx) => ctx.fixFailedCount >= 3,

  generate_doc_site: (ctx) =>
    /文档站点|网站|在线文档|doc site/i.test(ctx.prompt || ''),

  fixes_applied: (ctx) =>
    ctx.fixApplied === true || ctx.securityScanResult?.fixesApplied || false,

  high_severity_found: (ctx) =>
    ctx.securityScanResult?.highSeverityFound || false,

  // CE Plugin — check for actual installation file
  plugin_ce_available: (ctx) => {
    const ceConfig = join(rootOf(ctx), '.claude', 'plugins', 'compound-engineering.json');
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
  crg_graph_built: (ctx) => existsSync(join(rootOf(ctx), '.code-review-graph')),
  supabase_mcp_available: () => hasMcpServer('supabase'),
  stripe_mcp_available: () => hasMcpServer('stripe'),
  resend_mcp_available: () => hasMcpServer('resend'),
  // memory/codeguardian 是引擎自带的 handler，不依赖 MCP
  memory_mcp_available: () => true,
  codeguardian_mcp_available: () => true,
  playwright_mcp_available: () => hasMcpServer('playwright'),

  // Mobile platform guards
  // `ctx.platform` 全引擎从来没人写（handlers/mobile/audit.js 的 detectProject 写的是
  // `project_type` + `platforms`）—— 只读 ctx.platform 就等于这三条条件恒假，
  // mobile-audit / mobile-release / mobile-onboard 里 iOS·Android 专有步骤永不执行。
  mobile_platform: (ctx) => {
    const flags = platformFlags(ctx);
    return flags.ios || flags.android;
  },
  ios_platform: (ctx) => platformFlags(ctx).ios,
  android_platform: (ctx) => platformFlags(ctx).android,

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
  dependencycheck_available: (ctx) => {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- tool detection, not user-controlled
      execSync('dependency-check --version 2>&1', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch { /* not on PATH */ }
    const dcBat = join(rootOf(ctx), 'tools', 'dependency-check', 'bin', 'dependency-check.bat');
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
  // 左边可能是 SIMPLE_CONDITIONS 里的谓词（如 setupConfigured），它比 ctx 里
  // 一个宽松的布尔值更可信：`setupConfigured == false` 以前读 ctx.setupConfigured
  // （从没人赋值）→ String(undefined) !== 'false' → 恒假，失败通知永远不触发。
  const actual = key in SIMPLE_CONDITIONS ? SIMPLE_CONDITIONS[key](ctx) : ctx[key];
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

// ── dry-run 可判定性 ──
//
// dry-run 不执行步骤，所以「条件不满足」有两个完全不同的来源：
//   a) 真的不满足（例如 MCP 没配、文件不存在、CLI 没给 --kind）→ 可以相信
//   b) 只是运行时状态还没产生（如 testPassed 要等 test 步骤跑完才有）
// 以前两者都打印「⏭ 跳过」，于是 25 个场景 dry-run 全绿掩盖了 9 个恒假条件。
// 下面两个函数把 b) 单独标出来，让试运行不再充当假绿的背书。

const CONDITION_KEYWORDS = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'includes', 'some', 'every',
  'startsWith', 'endsWith', 'length', 'Number', 'String', 'Boolean',
]);

/**
 * 真值完全取决于「前置步骤写入的 flag」的谓词。
 * 这类谓词在 dry-run 下必然是 false（没人写 flag），false 不具权威性。
 * 反向例子：`build_artifacts_exist` / `*_mcp_available` 读的是文件与配置，
 * 现场就能求值，不能算未判定。
 */
const RUNTIME_STATE_PREDICATES = new Set([
  'setupConfigured',
  'has_frontend_changes',
  'attestation_enabled',
  'awesome_design_md_used',
  'user_confirmed_open_design',
  'user_confirmed_refactor',
  'open_design_executed',
  'fixes_applied',
  'high_severity_found',
  'mobile_platform',
  'ios_platform',
  'android_platform',
]);

/** 条件表达式里引用到的 context 键（先抹掉字符串字面量）。 */
export function conditionIdentifiers(condition) {
  if (!condition || typeof condition !== 'string') return [];
  const stripped = condition.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  const words = stripped.match(/[A-Za-z_]\w*/g) || [];
  const seen = new Set();
  for (const word of words) {
    if (CONDITION_KEYWORDS.has(word) || /^[A-Z]/.test(word)) continue;
    seen.add(word);
  }
  return [...seen];
}

/**
 * 条件里依赖「运行时状态」的键：既不是内置谓词（可现场求值），
 * 也没在 context 上出现过。dry-run 下这些键的真假无从得知。
 */
function runtimeDependentIdentifiers(condition, context) {
  const ctx = context || {};
  return conditionIdentifiers(condition).filter((id) => {
    if (RUNTIME_STATE_PREDICATES.has(id)) return true;
    if (id in SIMPLE_CONDITIONS) return false;
    return ctx[id] === undefined;
  });
}

/**
 * 三态判定：满足 / 不满足 / 未判定（dry-run 缺运行时状态）。
 */
export function explainCondition(condition, context) {
  const met = evaluateCondition(condition, context);
  if (met) return { met, unknown: [], determinable: true };
  const unknown = runtimeDependentIdentifiers(condition, context);
  return { met, unknown, determinable: unknown.length === 0 };
}
