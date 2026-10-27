import { describe, it, expect, vi } from 'vitest';
import { evaluateCondition } from './conditions.js';
// fs 在本文件被 mock，源码文本用 Vite 的 ?raw 直接取
import conditionsSource from './conditions.js?raw';
import { hasMcpServer } from './mcp-config.js';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock fs for file-existence-based conditions
vi.mock('fs', () => {
  const actual = vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
  };
});

describe('移动端平台条件（ctx.platform 从来没人写 → 曾经的恒假 bug）', () => {
  it('ctx.platform 显式指定 ios 时只开 iOS 分支', () => {
    expect(evaluateCondition('ios_platform', { platform: 'ios' })).toBe(true);
    expect(evaluateCondition('android_platform', { platform: 'ios' })).toBe(false);
  });

  it('detectProject 的探测结果（platforms）参与判定', () => {
    const ctx = { project_type: 'rn', platforms: { ios: true, android: true } };
    expect(evaluateCondition('mobile_platform', ctx)).toBe(true);
    expect(evaluateCondition('ios_platform', ctx)).toBe(true);
    expect(evaluateCondition('android_platform', ctx)).toBe(true);
  });

  it('expo 项目视为双端', () => {
    expect(evaluateCondition('ios_platform', { project_type: 'expo' })).toBe(true);
    expect(evaluateCondition('android_platform', { project_type: 'expo' })).toBe(true);
  });

  it('只探测到 android 时不误开 iOS 分支', () => {
    const ctx = { project_type: 'android-native', platforms: { ios: false, android: true } };
    expect(evaluateCondition('mobile_platform', ctx)).toBe(true);
    expect(evaluateCondition('ios_platform', ctx)).toBe(false);
    expect(evaluateCondition('android_platform', ctx)).toBe(true);
  });

  it('什么信息都没有时三条都为假（不再靠猜）', () => {
    expect(evaluateCondition('mobile_platform', {})).toBe(false);
    expect(evaluateCondition('ios_platform', {})).toBe(false);
  });
});

describe('文件类条件看目标项目，不看引擎自己（--target 修复）', () => {
  it('spec_file_exists 用 ctx.targetPath 而不是 cwd', async () => {
    const { existsSync } = await import('fs');
    const norm = (p) => String(p).replaceAll(String.fromCodePoint(92), '/');
    const other = join(tmpdir(), 'other-proj');
    const empty = join(tmpdir(), 'empty-proj');
    existsSync.mockImplementation((p) => norm(p).startsWith(norm(other)));
    expect(evaluateCondition('spec_file_exists', { targetPath: other })).toBe(true);
    expect(evaluateCondition('spec_file_exists', { targetPath: empty })).toBe(false);
    existsSync.mockReset();
    existsSync.mockImplementation(() => false);
  });

  it('build_artifacts_exist / planning_files_exist 同样跟随 targetPath', async () => {
    const { existsSync } = await import('fs');
    const norm = (p) => String(p).replaceAll(String.fromCodePoint(92), '/');
    const other = join(tmpdir(), 'other-proj');
    existsSync.mockImplementation((p) => [join(other, 'dist'), join(other, 'plan.md')].map((q) => norm(q)).includes(norm(p)));
    const ctx = { targetPath: other };
    expect(evaluateCondition('build_artifacts_exist', ctx)).toBe(true);
    expect(evaluateCondition('planning_files_exist', ctx)).toBe(true);
    existsSync.mockReset();
    existsSync.mockImplementation(() => false);
  });
});

describe('全部 SIMPLE_CONDITIONS 谓词都不得抛异常', () => {
  // 曾经 `dependencycheck_available` 里引用了没在形参里的 ctx，只有在依赖检查
  // 真被求值时才会 ReferenceError（整条 workflow 崩）。这里把所有谓词用空 ctx
  // 跑一遍，任何「漏形参 / 未定义变量」都会当场炸出来。
  it('每个谓词用空 ctx 求值都不抛', async () => {
    const block = conditionsSource.slice(conditionsSource.indexOf('const SIMPLE_CONDITIONS = {'));
    const names = [...block.matchAll(/^ {2}([a-z][a-z0-9_]*):/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(40);

    const failures = [];
    for (const name of names) {
      try {
        evaluateCondition(name, {});
      } catch (error) {
        failures.push(`${name}: ${error.message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('evaluateCondition', () => {
  describe('empty/truthy conditions', () => {
    it('returns true for null/undefined/empty (no condition)', () => {
      expect(evaluateCondition(null, {})).toBe(true);
      expect(evaluateCondition(undefined, {})).toBe(true);
      expect(evaluateCondition('', {})).toBe(true); // empty string is falsy → treated as no condition
    });

    it('returns true when context key is truthy', () => {
      expect(evaluateCondition('debug', { debug: true })).toBe(true);
      expect(evaluateCondition('ready', { ready: 1 })).toBe(true);
    });

    it('returns false when context key is falsy', () => {
      expect(evaluateCondition('debug', { debug: false })).toBe(false);
      expect(evaluateCondition('ready', {})).toBe(false);
    });
  });

  describe('named conditions (SIMPLE_CONDITIONS)', () => {
    it('evaluates frontend_involved from prompt text', () => {
      expect(evaluateCondition('frontend_involved', { prompt: '美化前端页面' })).toBe(true);
      expect(evaluateCondition('frontend_involved', { prompt: '修复后端bug' })).toBe(false);
      expect(evaluateCondition('frontend_involved', { selectedTheme: 'animal-island' })).toBe(true);
    });

    it('evaluates user_confirmed flags', () => {
      expect(evaluateCondition('user_confirmed_open_design', { user_confirmed_open_design: true })).toBe(true);
      expect(evaluateCondition('user_confirmed_open_design', {})).toBe(false);
      expect(evaluateCondition('user_confirmed_refactor', { user_confirmed_refactor: true })).toBe(true);
    });

    it('evaluates fix_failed_count >= 3', () => {
      const key = 'fix_failed_count >= 3';
      expect(evaluateCondition(key, { fixFailedCount: 5 })).toBe(true);
      expect(evaluateCondition(key, { fixFailedCount: 2 })).toBe(false);
      expect(evaluateCondition(key, {})).toBe(false);
    });

    it('evaluates user_mentioned_competitor_or_domain', () => {
      const key = 'user_mentioned_competitor_or_domain';
      expect(evaluateCondition(key, { prompt: '帮我做竞品分析' })).toBe(true);
      expect(evaluateCondition(key, { prompt: '修复一个小bug' })).toBe(false);
    });

  });

  describe('compound conditions', () => {
    it('evaluates A || B', () => {
      expect(evaluateCondition('a || b', { a: true, b: false })).toBe(true);
      expect(evaluateCondition('a || b', { a: false, b: true })).toBe(true);
      expect(evaluateCondition('a || b', { a: false, b: false })).toBe(false);
    });

    it('evaluates A && B', () => {
      expect(evaluateCondition('a && b', { a: true, b: true })).toBe(true);
      expect(evaluateCondition('a && b', { a: true, b: false })).toBe(false);
      expect(evaluateCondition('a && b', { a: false, b: true })).toBe(false);
    });

    it('handles compound with named conditions', () => {
      const cond = 'open_design_executed || user_confirmed_open_design';
      expect(evaluateCondition(cond, { open_design_executed: true })).toBe(true);
      expect(evaluateCondition(cond, { user_confirmed_open_design: true })).toBe(true);
      expect(evaluateCondition(cond, {})).toBe(false);
    });
  });

  describe('comparison operators', () => {
    it('evaluates key === value', () => {
      expect(evaluateCondition('mode === test', { mode: 'test' })).toBe(true);
      expect(evaluateCondition('mode === test', { mode: 'prod' })).toBe(false);
    });

    it('evaluates key !== value', () => {
      expect(evaluateCondition('mode !== test', { mode: 'prod' })).toBe(true);
      expect(evaluateCondition('mode !== test', { mode: 'test' })).toBe(false);
    });

    it('evaluates == and !=', () => {
      expect(evaluateCondition('count == 5', { count: '5' })).toBe(true);
      expect(evaluateCondition('count != 5', { count: '3' })).toBe(true);
    });

    it('strips quotes from values', () => {
      expect(evaluateCondition('name === "hello"', { name: 'hello' })).toBe(true);
      expect(evaluateCondition("name === 'hello'", { name: 'hello' })).toBe(true);
    });
  });

  describe('length comparisons', () => {
    it('evaluates key.length > N for arrays', () => {
      expect(evaluateCondition('items.length > 2', { items: [1, 2, 3] })).toBe(true);
      expect(evaluateCondition('items.length > 2', { items: [1] })).toBe(false);
    });

    it('evaluates key.length for strings', () => {
      expect(evaluateCondition('name.length >= 5', { name: 'hello world' })).toBe(true);
      expect(evaluateCondition('name.length < 3', { name: 'hi' })).toBe(true);
    });

    it('handles missing key as length 0', () => {
      expect(evaluateCondition('items.length > 0', {})).toBe(false);
      expect(evaluateCondition('items.length <= 0', {})).toBe(true);
    });
  });

  describe('skill/MCP availability (mocked)', () => {
    it('github_mcp_available returns boolean', () => {
      const result = evaluateCondition('github_mcp_available', {});
      expect(typeof result).toBe('boolean');
    });

    it('plugin_ce_available returns boolean', () => {
      const result = evaluateCondition('plugin_ce_available', {});
      expect(typeof result).toBe('boolean');
    });

    // 回归锁定：MCP 条件必须等于「配置里真有这个 server」。
    // 老实现是 isConversationMode()，等于「在对话里就假定什么 MCP 都有」，
    // 配置只剩三个 server 时它们依然全为 true。
    it('MCP 条件与真实配置一致（不是「在对话里就算有」）', () => {
      const pairs = [
        ['github_mcp_available', 'github'],
        ['sentry_mcp_available', 'sentry'],
        ['tavily_mcp_available', 'tavily'],
        ['context7_mcp_available', 'context7'],
        ['codegraph_mcp_available', 'codegraph'],
        ['supabase_mcp_available', 'supabase'],
        ['stripe_mcp_available', 'stripe'],
        ['resend_mcp_available', 'resend'],
        ['mobsf_mcp_available', 'mobsf'],
        ['bearer_mcp_available', 'bearer'],
        ['playwright_mcp_available', 'playwright'],
      ];
      for (const [condition, kind] of pairs) {
        expect(evaluateCondition(condition, {})).toBe(hasMcpServer(kind));
      }
    });
  });

  describe('membership: key.includes(\'value\')', () => {
    // Regression: review 场景 25 个步骤靠 `selected_modes.includes(...)` 判门，
    // 该语法此前无解析器、永远返回 false，导致 --auto 下只跑 5 步、25 步被误跳过。
    const ctx = { selected_modes: ['code_review', 'security_deep'] };

    it('is true when the value is present', () => {
      expect(evaluateCondition("selected_modes.includes('code_review')", ctx)).toBe(true);
      expect(evaluateCondition("selected_modes.includes('security_deep')", ctx)).toBe(true);
    });

    it('is false when the value is absent', () => {
      expect(evaluateCondition("selected_modes.includes('full_audit')", ctx)).toBe(false);
      expect(evaluateCondition("selected_modes.includes('ai_design')", ctx)).toBe(false);
    });

    it('supports double quotes and inner spacing', () => {
      expect(evaluateCondition('selected_modes.includes("code_review")', ctx)).toBe(true);
      expect(evaluateCondition("selected_modes.includes( 'code_review' )", ctx)).toBe(true);
    });

    it('works on strings', () => {
      expect(evaluateCondition("name.includes('ell')", { name: 'hello' })).toBe(true);
      expect(evaluateCondition("name.includes('zzz')", { name: 'hello' })).toBe(false);
    });

    it('is false for missing keys and non-collection values', () => {
      expect(evaluateCondition("missing.includes('x')", ctx)).toBe(false);
      expect(evaluateCondition("count.includes('x')", { count: 3 })).toBe(false);
    });

    it('composes with || and &&', () => {
      expect(evaluateCondition("selected_modes.includes('code_review') || selected_modes.includes('full_audit')", ctx)).toBe(true);
      expect(evaluateCondition("selected_modes.includes('ai_design') || selected_modes.includes('full_audit')", ctx)).toBe(false);
      // frontend_involved is a derived predicate (reads selectedTheme/prompt), so put it on the
      // right-hand side where the membership clause is still the deciding factor.
      expect(evaluateCondition("selected_modes.includes('code_review') && frontend_involved", { ...ctx, prompt: '优化页面组件' })).toBe(true);
      expect(evaluateCondition("selected_modes.includes('code_review') && frontend_involved", { ...ctx, prompt: '修复后端接口' })).toBe(false);
    });
  });

  describe('unknown conditions', () => {
    it('falls back to truthy context lookup', () => {
      expect(evaluateCondition('some_random_key', { some_random_key: 1 })).toBe(true);
      expect(evaluateCondition('some_random_key', {})).toBe(false);
    });
  });
});

// 回归：这三个键以前只写在 WorkflowContext 的 typedef 里，没有任何地方赋值，
// 导致 new-project 的 1.3/1.4/1.5（取 Supabase/Stripe/Resend 模板）永不执行。
describe('需求意图条件（database/payment/email）', () => {
  it('从需求文本识别', () => {
    expect(evaluateCondition('database_required', { prompt: '做一个带数据库的库存系统' })).toBe(true);
    expect(evaluateCondition('payment_required', { prompt: '需要 Stripe 订阅收款' })).toBe(true);
    expect(evaluateCondition('email_required', { prompt: '注册后发验证邮件' })).toBe(true);
  });

  it('无关需求不误触发', () => {
    const ctx = { prompt: '给按钮加个 hover 动画' };
    expect(evaluateCondition('database_required', ctx)).toBe(false);
    expect(evaluateCondition('payment_required', ctx)).toBe(false);
    expect(evaluateCondition('email_required', ctx)).toBe(false);
  });

  it('显式上下文标记优先', () => {
    expect(evaluateCondition('database_required', { prompt: '', database_required: true })).toBe(true);
  });

  it('组合条件在真 MCP 下可成立（判据不再恒假）', () => {
    const ctx = { prompt: '需要数据库存用户数据' };
    // 有 supabase 时组合条件才该成立；没有时保持跳过
    expect(evaluateCondition('supabase_mcp_available && database_required', ctx)).toBe(hasMcpServer('supabase'));
  });
});

// 回归：`setupConfigured == false` 以前读 ctx.setupConfigured（没人赋值）→ 恒假，
// setup 场景「配置失败通知」这一步永远不会触发。
describe('比较表达式优先解析 SIMPLE_CONDITIONS 谓词', () => {
  it('未配置时 setupConfigured == false 为真', () => {
    expect(evaluateCondition('setupConfigured == false', {})).toBe(true);
  });

  it('已配置（e2eConfigured）时为假', () => {
    expect(evaluateCondition('setupConfigured == false', { e2eConfigured: true })).toBe(false);
  });

  it('ctx 上的普通键仍按原样比较', () => {
    expect(evaluateCondition('selectedTheme == "daisyui"', { selectedTheme: 'daisyui' })).toBe(true);
    expect(evaluateCondition('selectedTheme == "daisyui"', { selectedTheme: 'x' })).toBe(false);
  });
});
