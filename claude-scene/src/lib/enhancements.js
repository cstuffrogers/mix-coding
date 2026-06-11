/**
 * Optional enhancement system: detects project features, shows checkbox menu,
 * sets context.enh_* flags. Scene steps gate on those flags via `condition`.
 *
 * Auto mode (--auto) or non-TTY: only DEFAULT-true items are enabled.
 * Interactive: 3-second timeout falls back to defaults; otherwise user picks.
 */
import { existsSync } from 'fs';
import { join } from 'path';
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
  ],
  review: [
    {
      key: 'huashu_expert_review',
      label: 'Huashu 5 维度专家评审 (Layer 6) — UI 设计质量评分',
      default: true,
      when: (ctx) => DETECTORS.uiFiles(ctx.targetPath),
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

  // Auto/non-TTY: take defaults silently
  if (options.auto || !process.stdout.isTTY) {
    for (const e of enhancements) {
      if (e.default) context[`enh_${e.key}`] = true;
    }
    const selected = enhancements.filter(e => e.default).map(e => e.key);
    if (selected.length > 0) {
      console.log(chalk.dim(`  ⚙ 自动模式增强已选: ${selected.join(', ')}`));
    }
    return;
  }

  console.log(chalk.cyan('\n📋 本次可选增强（空格切换勾选，回车确认；3 秒无操作 = 默认勾选）：\n'));
  const choices = enhancements.map(e => ({
    name: e.label,
    value: e.key,
    checked: e.default,
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

  if (result._timeout) console.log(chalk.dim(`  ⏱ 3 秒超时，使用默认: ${selected.join(', ') || '(无)'}`));
  else console.log(chalk.green(`  ✅ 已启用增强: ${selected.join(', ') || '(无)'}`));
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
