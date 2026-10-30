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
/**
 * 增强项依赖哪个探测器 → **必须同时有一句人话解释**。
 *
 * 为什么需要：`when(ctx)` 返回 false 时这一项从菜单里直接消失，用户看到的只是
 * 「菜单比文档里写的少了几项」。第 31 轮之前引擎一个字都不说 —— 又一次「替你
 * 决定了，但没告诉你」。有了这张表，`applyEnhancements` 才能打印
 * 「未提供的增强项: mythos_agent_review —— 没装 mythos-agent CLI（PATH 里找不到）」。
 *
 * 守卫：`DETECTORS` 里每个键都必须在这张表里有一句解释（`enhancements.test.js`），
 * 新加探测器不许只带回一个 false。
 */
export const DETECTOR_HINTS = {
  uiFiles: '项目里没扫到 UI 文件（css/scss/sass/less/tsx/jsx/vue/svelte/html）',
  stagehand: '项目依赖里没有 @browserbasehq/stagehand',
  critiq: '项目依赖里没有 @critiq/cli',
  mythosAgent: '没装 mythos-agent CLI（PATH 里找不到）',
  gepa: 'python 里 import 不到 gepa 模块',
  webFrontend: '没有 package.json，或项目里没有前端文件（死探测器，无增强项引用）',
  database: '没有 migrations / prisma / drizzle / schema.sql（死探测器，无增强项引用）',
  i18n: '没有 locale / locales / src/locales 目录（死探测器，无增强项引用）',
  brandLikelyMentioned: '需求里没提到已知品牌（死探测器，无增强项引用）',
  complexRequirement: '需求描述不超过 50 字（死探测器，无增强项引用）',
};

/** 需要项目路径的探测器（其余的是「本机有没有这个工具」，不带参数） */
const PATH_DETECTORS = new Set(['uiFiles', 'stagehand', 'critiq']);

/**
 * 场景 → 增强项登记表。
 * key: context flag 名（变成 context.enh_<key>）
 * label: 菜单文案
 * default: 是否默认勾选
 * needs: 依赖哪个探测器（省略 = 无条件提供）；`when` 由 `withWhen` 派生
 *
 * 以前每项都手写 `when: (ctx) => DETECTORS.xxx(ctx.targetPath)`，于是
 * 「依赖谁」这件事只活在函数体里：既没法在缺席时说出原因，也没法静态对账。
 */
const RAW_REGISTRY = {

  'ui-polish': [
    {
      key: 'huashu_expert_review',
      label: 'Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality',
      default: true,
      needs: 'uiFiles',
    },
    {
      key: 'impeccable_audit',
      label: 'Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感',
      default: true,
    },
    {
      key: 'stagehand_interaction',
      label: 'Stagehand 交互完整性校验 — 美化后确认 hover/click/focus/modal 未损坏',
      default: true,
      needs: 'stagehand',
    },
  ],
  review: [
    {
      key: 'huashu_expert_review',
      label: 'Huashu 5 维度专家评审 (Layer 6) — UI 设计质量评分',
      default: true,
      needs: 'uiFiles',
    },
    {
      key: 'stagehand_behavior',
      label: 'Stagehand 行为验证 — git diff → 受影响页面自动操作验证（自愈选择器）',
      default: false,
      needs: 'stagehand',
    },
    {
      key: 'mythos_agent_review',
      label: 'mythos-agent 安全深度推理 — 基于 diff 推理新攻击面',
      default: false,
      needs: 'mythosAgent',
    },
    {
      key: 'critiq_security_scan',
      label: 'Critiq 确定性安全扫描 — 1,243 条规则 (SQLi/SSRF/路径遍历/反序列化)，零成本秒级',
      default: true,
      needs: 'critiq',
    },
  ],
  release: [
    {
      key: 'huashu_release_deck',
      label: 'Huashu Release Deck — HTML deck → 可编辑 PPTX',
      default: false,
    },
    {
      key: 'huashu_release_animation',
      label: 'Huashu Release Animation — MP4/GIF 发布动画 (需 sharp+playwright)',
      default: false,
    },
    {
      key: 'stagehand_smoke',
      label: 'Stagehand 发布前冒烟 — 关键路径浏览器验证，任一失败阻断发布',
      default: false,
      needs: 'stagehand',
    },
    {
      key: 'mythos_agent_release',
      label: 'mythos-agent 发布安全门禁 — 假设驱动全量扫描，不通过则阻断',
      default: false,
      needs: 'mythosAgent',
    },
  ],
  bugfix: [
    {
      key: 'stagehand_reproduce',
      label: 'Stagehand 浏览器复现闭环 — 自然语言 → 复现 → 修复 → 验证',
      default: true,
      needs: 'stagehand',
    },
    {
      key: 'mythos_agent_variants',
      label: 'mythos-agent 同根因排查 — 修一个漏洞，全库扫描同类模式',
      default: true,
      needs: 'mythosAgent',
    },
  ],
  deps: [
    {
      key: 'mythos_agent_cve',
      label: 'mythos-agent CVE 可利用性分析 — 判断 CVE 是否真正到达受影响代码路径',
      default: false,
      needs: 'mythosAgent',
    },
  ],
  feature: [
    {
      key: 'stagehand_acceptance',
      label: 'Stagehand 功能验收 — 新功能完整用户流程浏览器自动化验证',
      default: true,
      needs: 'stagehand',
    },
    {
      key: 'mythos_agent_feature',
      label: 'mythos-agent 新功能安全审计 — API 端点/文件上传/数据流安全推理',
      default: true,
      needs: 'mythosAgent',
    },
  ],
  'new-project': [
    {
      key: 'stagehand_scaffold',
      label: 'Stagehand E2E 脚手架 — 自动生成 Stagehand 测试模板 + CI 配置',
      default: false,
      needs: 'stagehand',
    },
  ],
  optimize: [
    {
      key: 'gepa_evolve',
      label: 'GEPA prompt 进化 — LLM 反思执行轨迹 → Pareto 进化搜索 → 自动优化场景 prompt',
      default: true,
      needs: 'gepa',
    },
  ],
  loop: [
    {
      key: 'gepa_self_evolve',
      label: 'GEPA 自进化模式 — 每轮自动评估 → GEPA 优化 prompt → 循环至收敛',
      default: true,
      needs: 'gepa',
    },
  ],
  refactor: [
    {
      key: 'stagehand_regression',
      label: 'Stagehand 行为回归 — 重构前后浏览器功能一致性验证',
      default: true,
      needs: 'stagehand',
    },
    {
      key: 'mythos_agent_refactor',
      label: 'mythos-agent 安全审计 — 假设驱动全库扫描 + 数据流变化推理',
      default: true,
      needs: 'mythosAgent',
    },
  ],};

/**
 * 把 `needs` 派生成 `when`：依赖谁只有一处真值，缺席时也就能说出原因。
 * `needs` 写了图里的名字（错别字）→ 加载期直接抛，别等运行时静默 false。
 */
function withWhen(raw) {
  const out = {};
  for (const [scene, list] of Object.entries(raw)) {
    out[scene] = list.map((entry) => {
      if (!entry.needs) return { ...entry, when: () => true };
      const detector = DETECTORS[entry.needs];
      if (typeof detector !== 'function') {
        throw new TypeError(`增强项 ${scene}:${entry.key} 依赖了不存在的探测器 "${entry.needs}"`);
      }
      const when = PATH_DETECTORS.has(entry.needs)
        ? (ctx) => detector(ctx?.targetPath)
        : () => detector();
      return { ...entry, when };
    });
  }
  return out;
}

const REGISTRY = withWhen(RAW_REGISTRY);


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
 * 探测一项增强是否可用。探测器抛错 = 不可用（原因写 hint），不吞成静默 false。
 * @returns {boolean}
 */
function probeEnhancement(entry, context) {
  try { return Boolean(entry.when(context)); } catch { return false; }
}

/**
 * 缺席也要披露：这些项**不进菜单**，不说一句的话，用户只会觉得「文档里写的菜单
 * 少了几个」。原因取自 `DETECTOR_HINTS`（依赖谁 → 人话），绝不现场猜。
 */
function discloseUnavailable(unavailable) {
  if (unavailable.length === 0) return;
  console.log(chalk.yellow(
    `  ⚙ 未提供的增强项（本机不满足条件，既不进菜单也不会执行）: ${unavailable.length} 项`,
  ));
  for (const entry of unavailable) {
    console.log(chalk.yellow(`     ${entry.key} —— ${DETECTOR_HINTS[entry.needs] || `依赖 ${entry.needs} 不满足`}`));
  }
}

/**
 * @returns {Promise<void>} mutates context with enh_* flags
 */
export async function applyEnhancements(sceneId, context, options = {}) {
  const all = REGISTRY[sceneId] || [];
  if (all.length === 0) return;
  // 先分「能提供 / 不能提供」，再决定菜单：不能提供的过去被 filter 静默吃掉，
  // 于是「这一项为什么没出现」在 CLI 里永远没有答案。探测器只跑一次（`mythos-agent
  // --version` 这种要起进程）。
  const probed = all.map(e => ({ entry: e, ok: probeEnhancement(e, context) }));
  const unavailable = probed.filter(p => !p.ok).map(p => p.entry);
  const enhancements = probed.filter(p => p.ok).map(p => p.entry);

  const consumed = consumedEnhKeys(sceneId);

  // Parse --enh flag: comma-separated keys to ADDITIVELY enable beyond defaults
  const enhanceOverrides = options.enh
    ? new Set(options.enh.split(',').map(s => s.trim()).filter(Boolean))
    : new Set();
  // 用户明确点名要的项却不满足条件 —— 这比「默认项没出现」更该说，不然后果是
  // 「我加了 --enh，跑完一个字没变」。
  const ignored = unavailable.filter(e => enhanceOverrides.has(e.key));
  if (ignored.length > 0) {
    console.log(chalk.yellow(
      `  ⚠ --enh 里这些增强项本机不满足条件，没有启用: ${ignored.map(e => e.key).join(', ')}`,
    ));
  }

  // Non-TTY: take defaults + overrides (no interactive menu possible), but never silently:
  // 打印分成两栏，让「勾了但没有步骤执行」这件事当场可见。
  if (!process.stdout.isTTY) {
    const chosen = enhancements.filter(e => e.default || enhanceOverrides.has(e.key));
    for (const e of chosen) context[`enh_${e.key}`] = true;
    discloseSelection(chosen.map(e => e.key), consumed, '非交互模式，按默认值 + --enh');
    discloseUnavailable(unavailable);
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
  discloseUnavailable(unavailable);
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
