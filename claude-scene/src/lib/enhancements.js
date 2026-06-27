/**
 * Optional enhancement system: detects project features, shows checkbox menu,
 * sets context.enh_* flags. Scene steps gate on those flags via `condition`.
 *
 * Auto mode (--auto) or non-TTY: only DEFAULT-true items are enabled.
 * Interactive: 3-second timeout falls back to defaults; otherwise user picks.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { scanDir } from './scan-dir.js';

/**
 * Feature detectors. Each returns true if the project has the feature.
 * Cached per project root.
 */
const DETECTORS = {
  webFrontend: (root) => {
    if (!existsSync(join(root, 'package.json'))) return false;
    const hits = scanDir(root, { filter: f => /\.(tsx|jsx|html?)$/i.test(f) });
    return hits.length > 0;
  },
  database: (root) => {
    const markers = ['migrations', 'schema.prisma', 'prisma', 'drizzle', 'schema.sql'];
    if (markers.some(m => existsSync(join(root, m)))) return true;
    const sql = scanDir(root, { filter: f => /\.sql$/i.test(f) });
    return sql.length > 0;
  },
  i18n: (root) => {
    if (existsSync(join(root, 'locale')) || existsSync(join(root, 'locales'))) return true;
    if (existsSync(join(root, 'src', 'locales'))) return true;
    return false;
  },
  uiFiles: (root) => {
    const ui = scanDir(root, {
      filter: f => /\.(css|scss|sass|less|tsx|jsx|vue|svelte|html?)$/i.test(f),
    });
    return ui.length > 0;
  },
  brandLikelyMentioned: (prompt = '') => {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const known = ['apple', 'google', 'stripe', 'linear', 'vercel', 'notion', 'figma', 'github', 'anthropic', 'tesla', 'sony', 'samsung'];
    if (known.some(b => lower.includes(b))) return true;
    return /\b[A-Z][a-z]+(?:\s+[A-Z0-9][a-z0-9]*){0,2}\b/.test(prompt);
  },
  complexRequirement: (prompt = '') => (prompt || '').length > 50,
  stagehand: (root) => {
    try {
      const pkgPath = join(root, 'package.json');
      if (!existsSync(pkgPath)) return false;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return '@browserbasehq/stagehand' in deps;
    } catch { return false; }
  },
  mythosAgent: () => {
    try {
      execSync('mythos-agent --version', { stdio: 'ignore' });
      return true;
    } catch { return false; }
  },
  gepa: () => {
    try {
      execSync('python -c "import gepa"', { stdio: 'ignore' });
      return true;
    } catch { return false; }
  },
  critiq: (root) => {
    try {
      const pkgPath = join(root, 'package.json');
      if (!existsSync(pkgPath)) return false;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return '@critiq/cli' in deps;
    } catch { return false; }
  },
};

/**
 * Scene → enhancement registry.
 * key: context flag name (becomes context.enh_<key>)
 * label: displayed text
 * default: whether checked by default
 * when: () => bool — only show if detector returns true
 */
const REGISTRY = {
  design: [
    {
      key: 'huashu_brand_protocol',
      label: 'Huashu Brand Protocol — 检测品牌→5 步资产清单→brand-spec.md',
      default: true,
      when: (ctx) => DETECTORS.brandLikelyMentioned(ctx.prompt),
    },
    {
      key: 'huashu_expert_review',
      label: 'Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality',
      default: true,
      when: (ctx) => DETECTORS.uiFiles(ctx.targetPath),
    },
    {
      key: 'impeccable_audit',
      label: 'Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感',
      default: true,
      when: () => true,
    },
    {
      key: 'stagehand_responsive',
      label: 'Stagehand 响应式校验 — desktop/tablet/mobile 多视口自动截图对比',
      default: false,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
  ],
  'ui-polish': [
    {
      key: 'huashu_expert_review',
      label: 'Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality',
      default: true,
      when: (ctx) => DETECTORS.uiFiles(ctx.targetPath),
    },
    {
      key: 'impeccable_audit',
      label: 'Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感',
      default: true,
      when: () => true,
    },
    {
      key: 'stagehand_interaction',
      label: 'Stagehand 交互完整性校验 — 美化后确认 hover/click/focus/modal 未损坏',
      default: true,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
  ],
  review: [
    {
      key: 'huashu_expert_review',
      label: 'Huashu 5 维度专家评审 (Layer 6) — UI 设计质量评分',
      default: true,
      when: (ctx) => DETECTORS.uiFiles(ctx.targetPath),
    },
    {
      key: 'stagehand_behavior',
      label: 'Stagehand 行为验证 — git diff → 受影响页面自动操作验证（自愈选择器）',
      default: false,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
    {
      key: 'mythos_agent_review',
      label: 'mythos-agent 安全深度推理 — 基于 diff 推理新攻击面',
      default: false,
      when: () => DETECTORS.mythosAgent(),
    },
    {
      key: 'critiq_security_scan',
      label: 'Critiq 确定性安全扫描 — 1,243 条规则 (SQLi/SSRF/路径遍历/反序列化)，零成本秒级',
      default: true,
      when: (ctx) => DETECTORS.critiq(ctx.targetPath),
    },
  ],
  release: [
    {
      key: 'huashu_release_deck',
      label: 'Huashu Release Deck — HTML deck → 可编辑 PPTX',
      default: false,
      when: () => true,
    },
    {
      key: 'huashu_release_animation',
      label: 'Huashu Release Animation — MP4/GIF 发布动画 (需 sharp+playwright)',
      default: false,
      when: () => true,
    },
    {
      key: 'stagehand_smoke',
      label: 'Stagehand 发布前冒烟 — 关键路径浏览器验证，任一失败阻断发布',
      default: false,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
    {
      key: 'mythos_agent_release',
      label: 'mythos-agent 发布安全门禁 — 假设驱动全量扫描，不通过则阻断',
      default: false,
      when: () => DETECTORS.mythosAgent(),
    },
  ],
  changelog: [
    {
      key: 'huashu_release_deck',
      label: 'Huashu Deck — 根据 changelog 高亮生成 HTML deck',
      default: false,
      when: () => true,
    },
  ],
  audit: [
    {
      key: 'huashu_infographic',
      label: 'Huashu Infographic — 审计指标单页 HTML 信息图',
      default: true,
      when: () => true,
    },
    {
      key: 'architecture_deep_audit',
      label: '架构深度审计 — 分层合规 + 复杂度热点图',
      default: false,
      when: () => true,
    },
    {
      key: 'mythos_agent_audit',
      label: 'mythos-agent 安全审计 — 假设驱动全库扫描 + 数据流推理',
      default: true,
      when: () => DETECTORS.mythosAgent(),
    },
    {
      key: 'critiq_full_audit',
      label: 'Critiq 全量安全审计 — 9 语言 21 类别 1,243 条规则 + secret 专项扫描',
      default: true,
      when: (ctx) => DETECTORS.critiq(ctx.targetPath),
    },
  ],
  analyze: [
    {
      key: 'huashu_infographic',
      label: 'Huashu Infographic — 分析报告单页 HTML 信息图',
      default: true,
      when: () => true,
    },
  ],
  prototype: [
    {
      key: 'huashu_prototype_fallback',
      label: 'Huashu HTML Prototype Fallback — MattPocock 不可用时兜底',
      default: true,
      when: () => true,
    },
  ],
  bugfix: [
    {
      key: 'stagehand_reproduce',
      label: 'Stagehand 浏览器复现闭环 — 自然语言 → 复现 → 修复 → 验证',
      default: true,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
    {
      key: 'mythos_agent_variants',
      label: 'mythos-agent 同根因排查 — 修一个漏洞，全库扫描同类模式',
      default: true,
      when: () => DETECTORS.mythosAgent(),
    },
  ],
  deps: [
    {
      key: 'mythos_agent_cve',
      label: 'mythos-agent CVE 可利用性分析 — 判断 CVE 是否真正到达受影响代码路径',
      default: false,
      when: () => DETECTORS.mythosAgent(),
    },
  ],
  e2e: [
    {
      key: 'stagehand_functional',
      label: 'Stagehand 功能性测试 — act/extract/observe 验证用户关键路径',
      default: true,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
  ],
  feature: [
    {
      key: 'stagehand_acceptance',
      label: 'Stagehand 功能验收 — 新功能完整用户流程浏览器自动化验证',
      default: true,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
    {
      key: 'mythos_agent_feature',
      label: 'mythos-agent 新功能安全审计 — API 端点/文件上传/数据流安全推理',
      default: true,
      when: () => DETECTORS.mythosAgent(),
    },
  ],
  hunt: [
    {
      key: 'mythos_agent_hunt',
      label: 'mythos-agent 假设驱动扫描 — AI 推理未知漏洞 + 变量分析 + PoC 生成',
      default: true,
      when: () => DETECTORS.mythosAgent(),
    },
    {
      key: 'critiq_vulnerability_scan',
      label: 'Critiq 确定性漏洞扫描 — SQLi/SSRF/路径遍历/不安全反序列化/硬编码密钥',
      default: true,
      when: (ctx) => DETECTORS.critiq(ctx.targetPath),
    },
  ],
  monitor: [
    {
      key: 'stagehand_synthetic',
      label: 'Stagehand 合成监控 — 定时跑关键路径浏览器验证，失败告警',
      default: false,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
  ],
  'new-project': [
    {
      key: 'stagehand_scaffold',
      label: 'Stagehand E2E 脚手架 — 自动生成 Stagehand 测试模板 + CI 配置',
      default: false,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
  ],
  optimize: [
    {
      key: 'gepa_evolve',
      label: 'GEPA prompt 进化 — LLM 反思执行轨迹 → Pareto 进化搜索 → 自动优化场景 prompt',
      default: true,
      when: () => DETECTORS.gepa(),
    },
  ],
  loop: [
    {
      key: 'gepa_self_evolve',
      label: 'GEPA 自进化模式 — 每轮自动评估 → GEPA 优化 prompt → 循环至收敛',
      default: true,
      when: () => DETECTORS.gepa(),
    },
  ],
  refactor: [
    {
      key: 'stagehand_regression',
      label: 'Stagehand 行为回归 — 重构前后浏览器功能一致性验证',
      default: true,
      when: (ctx) => DETECTORS.stagehand(ctx.targetPath),
    },
    {
      key: 'mythos_agent_refactor',
      label: 'mythos-agent 安全审计 — 假设驱动全库扫描 + 数据流变化推理',
      default: true,
      when: () => DETECTORS.mythosAgent(),
    },
  ],
};

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * @returns {Promise<void>} mutates context with enh_* flags
 */
export async function applyEnhancements(sceneId, context, options = {}) {
  const enhancements = (REGISTRY[sceneId] || []).filter(e => {
    try { return e.when(context); } catch { return false; }
  });
  if (enhancements.length === 0) return;

  // Parse --enh flag: comma-separated keys to ADDITIVELY enable beyond defaults
  const enhanceOverrides = options.enh
    ? new Set(options.enh.split(',').map(s => s.trim()).filter(Boolean))
    : new Set();

  // Non-TTY: take defaults + overrides silently (no interactive menu possible)
  if (!process.stdout.isTTY) {
    for (const e of enhancements) {
      if (e.default || enhanceOverrides.has(e.key)) context[`enh_${e.key}`] = true;
    }
    const selected = enhancements.filter(e => e.default || enhanceOverrides.has(e.key)).map(e => e.key);
    if (selected.length > 0) {
      console.log(chalk.dim(`  ⚙ 增强已选（非交互模式）: ${selected.join(', ')}`));
    }
    return;
  }

  // Always show the menu (even in --auto), 3-second timeout falls back to defaults.
  // --auto only controls step confirmation, not enhancement selection.
  const choices = enhancements.map(e => ({
    name: e.label,
    value: e.key,
    checked: e.default || enhanceOverrides.has(e.key),
  }));

  const result = await Promise.race([
    inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: '选择启用：',
      choices,
    }]),
    new Promise(resolve => setTimeout(
      () => resolve({ selected: enhancements.filter(e => e.default).map(e => e.key), _timeout: true }),
      DEFAULT_TIMEOUT_MS,
    )),
  ]);

  const selected = result.selected || [];
  for (const k of selected) context[`enh_${k}`] = true;

}

/**
 * Register an `enh_<key>` truthy condition resolver so scene `condition` strings
 * like "enh_huashu_brand_protocol" work in evaluateCondition.
 * (Already supported by the simple `\w+` truthy fallback in conditions.js,
 * so no change needed there.)
 */
export const ENHANCEMENT_KEYS = Object.fromEntries(
  Object.entries(REGISTRY).map(([scene, list]) => [scene, list.map(e => `enh_${e.key}`)]),
);
