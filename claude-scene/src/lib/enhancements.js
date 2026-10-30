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
import { resolveScenePath } from './paths.js';

/**
 * Feature detectors. Each returns true if the project has the feature.
 * Cached per project root.
 */
/**
 * 探测器表。**导出是为了让文档能被对账**：`.claude/rules/conditional/enhancements*.md`
 * 里写了「用到 5 个、另外 4 个无人引用」—— 那两串名字得能跟这里比，不能靠手抄。
 */
export const DETECTORS = {
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
      // Intentional PATH lookup: detecting whether the CLI is installed.
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      execSync('mythos-agent --version', { stdio: 'ignore' });
      return true;
    } catch { return false; }
  },
  gepa: () => {
    try {
      // Intentional PATH lookup: detecting whether the python module is importable.
      // eslint-disable-next-line sonarjs/no-os-command-from-path
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
 * 这个场景真正会「用上」的增强键 —— 即有没有某个步骤的 `condition` 里写了 `enh_<key>`。
 *
 * 为什么需要：`REGISTRY` 21 项里只有 3 项被场景条件消费（`release` 的两项 +
 * `ui-polish` 的 `huashu_expert_review`）。其余 18 项勾了只是往 context 里放一个没人读的
 * flag —— 用户以为选了「Stagehand 行为验证」，跑起来一个字都不会变。
 * 引擎不许替用户假装这件事发生过，所以选定之后要如实分成「有步骤消费」和「仅建议」两栏。
 *
 * @param {string} sceneId
 * @returns {Set<string>} 被 `condition: "enh_*"` 引用的键；读不到场景就当空集
 */
export function consumedEnhKeys(sceneId) {
  const used = new Set();
  let file;
  try {
    file = resolveScenePath(sceneId);
  } catch {
    return used;
  }
  if (!file || !existsSync(file)) return used;

  let scene;
  try {
    scene = JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return used;
  }

  const flow = scene.flow || {};
  const steps = Array.isArray(flow) ? flow : Object.values(flow);
  for (const step of steps) {
    if (typeof step?.condition !== 'string') continue;
    for (const hit of step.condition.matchAll(/\benh_([a-z0-9_]+)\b/gu)) used.add(hit[1]);
  }
  return used;
}

/**
 * 把选中的增强项分成「有步骤消费」与「只是建议」。纯函数，便于测试。
 * @param {string[]} selected 选中的 key
 * @param {Set<string>} consumed `consumedEnhKeys()` 的结果
 * @returns {{live: string[], inert: string[]}}
 */
export function partitionSelection(selected, consumed) {
  const live = [];
  const inert = [];
  for (const key of selected) {
    (consumed.has(key) ? live : inert).push(key);
  }
  return { live, inert };
}

/**
 * 如实披露这次启用了什么：分两栏，且「仅建议」那一栏要说清 CLI 下不会执行。
 * 没有这一行，用户看到的只有菜单勾选，跑完什么也没发生。
 */
function discloseSelection(selected, consumed, how) {
  const { live, inert } = partitionSelection(selected, consumed);
  if (selected.length === 0) {
    console.log(chalk.dim(`  ⚙ 没有启用任何增强项（${how}）`));
    return;
  }
  if (live.length > 0) {
    console.log(chalk.dim(`  ⚙ 增强已选（${how}，场景里有步骤消费）: ${live.join(', ')}`));
  }
  if (inert.length > 0) {
    console.log(chalk.yellow(
      `  ⚠ 增强已选但没有场景步骤消费（${how}）: ${inert.join(', ')}`
      + ' —— 只是给对话模式 agent 的建议，CLI 下不会执行任何步骤',
    ));
  }
}

/**
 * @returns {Promise<void>} mutates context with enh_* flags
 */
export async function applyEnhancements(sceneId, context, options = {}) {
  const enhancements = (REGISTRY[sceneId] || []).filter(e => {
    try { return e.when(context); } catch { return false; }
  });
  if (enhancements.length === 0) return;

  const consumed = consumedEnhKeys(sceneId);

  // Parse --enh flag: comma-separated keys to ADDITIVELY enable beyond defaults
  const enhanceOverrides = options.enh
    ? new Set(options.enh.split(',').map(s => s.trim()).filter(Boolean))
    : new Set();

  // Non-TTY: take defaults + overrides (no interactive menu possible), but never silently:
  // 打印分成两栏，让「勾了但没有步骤执行」这件事当场可见。
  if (!process.stdout.isTTY) {
    const chosen = enhancements.filter(e => e.default || enhanceOverrides.has(e.key));
    for (const e of chosen) context[`enh_${e.key}`] = true;
    discloseSelection(chosen.map(e => e.key), consumed, '非交互模式，按默认值 + --enh');
    return;
  }

  // Always show the menu (even in --auto), 3-second timeout falls back to defaults.
  // --auto only controls step confirmation, not enhancement selection.
  // 菜单里就写明「没有步骤消费」，别等用户勾完才说。
  const choices = enhancements.map(e => ({
    name: consumed.has(e.key) ? e.label : `${e.label}（无场景步骤消费，仅建议）`,
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
  discloseSelection(
    selected,
    consumed,
    result._timeout ? `交互选择：${String(DEFAULT_TIMEOUT_MS / 1000)} 秒无操作，已按默认值` : '交互选择',
  );
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

/** 原样的登记表（带 `default` / `label` / `when`）。文档对账与菜单审计都用它。 */
export const ENHANCEMENT_REGISTRY = REGISTRY;
