#!/usr/bin/env node
import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { evaluateCondition, explainCondition } from '../lib/conditions.js';
import { resolveParams } from '../lib/template.js';
import { executeAction, hasActionHandler } from '../actions.js';
import { executeUIPolish, UI_POLISH_ACTIONS } from '../handlers/ui-polish.js';
import { applyEnhancements } from '../lib/enhancements.js';
import { PROJECT_ROOT, resolveScenePath, describePaths } from '../lib/paths.js';
import { detectHandlerFailure } from '../lib/failure-detection.js';
import { checkAcceptance } from '../lib/acceptance-check.js';
import { captureBoundaryBaseline } from '../handlers/codeguardian.js';

const LAYER_ICONS = {
  interactive: '💬',
  capability: '⚙️',
  runtime: '🚀',
};

const THEME_NAMES = {
  daisyui: 'DaisyUI',
  'animal-island': 'Animal Island UI',
  custom: 'Custom',
  huashu: 'Huashu 40 风格库',
  'awm-brand': 'Awesome Design MD 品牌',
  'liquid-glass': 'Liquid Glass（Apple 液态玻璃效果）',
};

// 主题清单同时服务三处：TTY 的 inquirer 列表、非交互时的选项表、--choice 的序号映射。
// 以前只有 inquirer 里有一份，非交互模式下闸门给的却是 --yes/--decline —— 问题问的是
// 「请输入数字选择主题」，能回答的 flag 却答不上，用户回「2」还可能被当成「拒绝」。
const THEME_CHOICES = [
  { value: 'daisyui', label: 'DaisyUI（35+ 专业主题）' },
  { value: 'animal-island', label: 'Animal Island UI（自然、圆润风格）' },
  { value: 'custom', label: 'Custom（自定义颜色）' },
  { value: 'huashu', label: 'Huashu 40 风格库' },
  { value: 'awm-brand', label: 'Awesome Design MD 品牌' },
  { value: 'liquid-glass', label: 'Liquid Glass（Apple 液态玻璃效果）' },
];

/** --theme / --choice / TTY 的取值统一成主题 key；认不出就返回 undefined（不猜） */
export function resolveThemeChoice(raw) {
  if (raw === undefined || raw === null || raw === true || raw === '') return;
  const value = String(raw).trim().toLowerCase();
  const index = Number(value);
  if (Number.isSafeInteger(index) && index >= 1 && index <= THEME_CHOICES.length) {
    return THEME_CHOICES[index - 1].value;
  }
  const hit = THEME_CHOICES.find(c => c.value === value || c.label.toLowerCase() === value);
  return hit?.value;
}

// ── Execution logging ──

let LOG_PATH = null;
// 折叠后的完整输出落在这里，屏幕上只留摘要 —— 既不刷屏，也不丢信息
let STEP_OUTPUT_PATH = null;
const FOLD_LINE_LIMIT = 6;
let LOG_RUN_ID = null;
let LOG_SUMMARY = { total: 0, pass: 0, fail: 0, skip: 0, noop: 0, warn: 0 };

function initLog(sceneId) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  LOG_RUN_ID = `${ts}-${randomBytes(3).toString('hex')}`;
  const logDir = join(PROJECT_ROOT, '.claude', 'logs');
  mkdirSync(logDir, { recursive: true });
  LOG_PATH = join(logDir, `workflow-${sceneId}-${ts}-${LOG_RUN_ID.slice(-6)}.log`);
  LOG_SUMMARY = { total: 0, pass: 0, fail: 0, skip: 0, noop: 0, warn: 0 };
  STEP_OUTPUT_PATH = join(logDir, `steps-${sceneId}-${LOG_RUN_ID.slice(-6)}.log`);
  const header = JSON.stringify({ event: 'start', scene: sceneId, run_id: LOG_RUN_ID, time: new Date().toISOString() });
  appendFileSync(LOG_PATH, header + '\n');
}

function appendLog(entry) {
  if (!LOG_PATH) return;
  appendFileSync(LOG_PATH, JSON.stringify({ run_id: LOG_RUN_ID, ...entry }) + '\n');
}

const LF = String.fromCodePoint(10);
const CR = String.fromCodePoint(13);

/**
 * 中间输出折叠：pass/warn 的长输出默认只留前 6 行，其余落盘。
 * 失败一律不折叠 —— 藏起失败细节才是真的刷屏问题。
 */
export function foldOutput(text, { fold = true, stepStatus = 'pass', fullLogPath = '' } = {}) {
  const raw = String(text ?? '');
  const lines = raw.split(LF).map((line) => (line.endsWith(CR) ? line.slice(0, -1) : line));
  const keepAll = !fold || stepStatus === 'fail' || lines.length <= FOLD_LINE_LIMIT;
  if (keepAll) return { text: raw, folded: false, hidden: 0 };
  const hidden = lines.length - FOLD_LINE_LIMIT;
  const where = fullLogPath ? '完整输出：' + fullLogPath : '加 --no-fold 查看完整输出';
  const kept = [...lines.slice(0, FOLD_LINE_LIMIT), '  … 省略 ' + hidden + ' 行（' + where + '）'];
  return { text: kept.join(LF), folded: true, hidden };
}

function appendStepOutput(stepNum, action, text) {
  if (!STEP_OUTPUT_PATH) return;
  const header = '===== Step ' + stepNum + ' ' + action + ' @ ' + new Date().toISOString() + ' =====';
  appendFileSync(STEP_OUTPUT_PATH, header + LF + text + LF);
}

// ── Helpers extracted from runStep ──

async function handleThemeSelection(step, options, context) {
  if (step.params?.theme_selection && !options.theme && !options.auto) {
    const answers = await inquirer.prompt([{
      type: 'list', name: 'theme', message: step.params.message,
      choices: THEME_CHOICES.map((c, i) => ({ name: `${i + 1}. ${c.label}`, value: c.value })),
    }]);
    context.selectedTheme = answers.theme;
    noteDecision(context, `theme=${answers.theme}`);

    if (answers.theme === 'awm-brand') {
      const brandAnswer = await inquirer.prompt([{
        type: 'list', name: 'brand', message: '选择品牌设计系统：',
        choices: [
          { name: 'Vercel — 现代 SaaS 仪表板', value: 'Vercel' },
          { name: 'Linear — 任务管理 / Issue Tracker', value: 'Linear' },
          { name: 'Stripe — 金融 / 支付 / Dashboard', value: 'Stripe' },
          { name: 'Notion — 内容 / 知识库 / 协作', value: 'Notion' },
          { name: 'Apple — 极简 / 高端 / 营销站', value: 'Apple' },
        ],
      }]);
      context.user_selected_brand = brandAnswer.brand;
      console.log(chalk.green(`\n✅ 已选择品牌：${brandAnswer.brand}\n`));
    }

    console.log(chalk.green(`\n✅ 已选择主题：${THEME_NAMES[answers.theme] || answers.theme}\n`));
    return true;
  }
  return false;
}

async function handleAwmBrandSelection(step, options, context) {
  if (step.action !== 'awm-brand-list' || options.auto) return false;

  const answers = await inquirer.prompt([{
    type: 'input',
    name: 'brand',
    message: step.params?.message || '输入品牌名（Vercel/Linear/Stripe/Notion/Apple）或 skip 跳过：',
    validate: (input) => {
      const trimmed = input.trim();
      if (trimmed.toLowerCase() === 'skip') return true;
      const valid = ['vercel', 'linear', 'stripe', 'notion', 'apple'];
      return valid.includes(trimmed.toLowerCase()) || `请输入有效品牌名（${valid.join('/')}）或 skip`;
    },
  }]);
  const brand = answers.brand.trim();
  noteDecision(context, `brand=${brand}`);
  if (brand.toLowerCase() !== 'skip') {
    context.user_selected_brand = brand;
    console.log(chalk.green(`\n✅ 已选择品牌：${brand}\n`));
  } else {
    console.log(chalk.dim('\n⏭ 跳过品牌导入\n'));
  }
  return true;
}

function applyDescriptionFlag(stepDesc, enabled, context) {
  const isDesign = stepDesc.includes('open design') || stepDesc.includes('ui');
  const isRefactor = stepDesc.includes('重构') || stepDesc.includes('refactor');
  if (!isDesign && !isRefactor) return false;

  if (isDesign) {
    context.user_confirmed_open_design = enabled;
    console.log(chalk[enabled ? 'green' : 'gray'](`\n${enabled ? '✅ 已启用' : '⏭ 跳过'} Open Design AI 设计`));
  }
  if (isRefactor) {
    context.user_confirmed_refactor = enabled;
    console.log(chalk[enabled ? 'green' : 'gray'](`\n${enabled ? '✅ 已启用' : '⏭ 跳过'} 代码重构检查`));
  }
  return true;
}

/** 落了 context_flag 的步骤：写值 + 打到屏幕上 + 打「已答」标记（没答就不打） */
function applyContextFlag(step, context, options, answer) {
  // 没人回答时（--auto 且没问）取 auto_default（默认 true，其它场景语义不变）。
  // 所以「默认不跑」的交互步骤必须显式写 auto_default: false。
  const flag = step.params.context_flag;
  const autoDefault = step.params?.auto_default ?? true;
  const answered = answer !== undefined;
  context[flag] = answered ? answer : (options.auto ? autoDefault : false);
  // 打印裸 flag 名（withSweep）等于没说人话，优先用 flag_label。
  const label = step.params?.flag_label || flag;
  const suffix = answered ? '' : '（未询问，取默认值）';
  console.log(chalk[context[flag] ? 'green' : 'gray'](`\n${context[flag] ? '✅ 已启用' : '⏭ 跳过'} ${label}${suffix}`));
  answered && noteDecision(context, `${flag}=${context[flag]}`);
}

function setContextFlag(step, context, options, answer) {
  // Prefer structured context_flag param; fall back to description sniffing
  const flag = step.params?.context_flag;
  if (flag) {
    applyContextFlag(step, context, options, answer);
    return true;
  }

  const stepDesc = step.description?.toLowerCase() || '';
  // 显式答案永远优先。以前这里是 `!options.auto ? answer : true`：带 --auto 时
  // 不管答案是什么都当「是」，于是没声明 context_flag 的确认步骤（如 new-project
  // 3.5「是否需要 Open Design」）上 `--decline` / `--choice 2` 被吞掉，屏幕上
  // 还印「✅ 已启用」——flag 与结果相反，比不问更坏。
  const resolved = answer ?? context._confirmAnswer;
  const answered = typeof resolved === 'boolean';
  // 没人回答、又没声明 auto_default：沿用历史语义（auto = 放行），
  // 但这条路径已经不会静默走到（确认步骤没答案时 handleConfirmDialog /
  // handleConfirmation 都去 markAwaiting 了），留作防御。
  const fallback = Boolean(options.auto);
  const enabled = answered ? Boolean(resolved) : fallback;
  if (answered) noteDecision(context, 'confirm-answer');
  return applyDescriptionFlag(stepDesc, enabled, context);
}

/**
 * --auto 的语义是「不打断」，但有些步骤的默认值代价太高、藏起来就成了暗坑：
 * review 的 detector-sweep 会临时改写工作区、跑 2~3 分钟，静默按「不跑」处理，
 * 用户只会看到 2.7 报「自检记录已过期」，却不知道是自己没被问过。
 * 所以标了 ask_even_in_auto 的步骤即便带 --auto 也问一句 —— 但只在真终端问：
 * 没有 TTY（CI、agent 子进程、管道）时 inquirer 会挂死或抛错，必须退回 auto_default。
 */
export function shouldPromptInAuto(step, { isTTY = Boolean(process.stdin.isTTY) } = {}) {
  if (step?.params?.ask_even_in_auto !== true) return false;
  return isTTY;
}

/**
 * 交互步骤的统一闸门：记下「这步要人回答」，由 runStep 中止（exit 2）并叫调用方去问人。
 * confirm / choose-select / input 三类入口共用，保证同一套行为：
 * 没人可问 → 不猜、不装通过、不留默认值。
 */
function markAwaiting(context, step, { prompt, label, hints = [] }) {
  context._awaitingAnswer = {
    step: step.step,
    prompt: String(prompt || step.description || step.action).trim(),
    label: label || step.description || step.action,
    hints,
  };
}

/** 命令行显式表态：--yes / --decline（--no 在 commander 里是取反语法，不能用）
 *  返回 undefined = 没表态（不是 false：「没答案」和「拒绝了」是两件事） */
function explicitConfirmDecision(options) {
  if (options?.yes === true) return true;
  return options?.decline === true ? false : undefined;
}

/** -S / --skip-sweep 这两个 sweep 专用 flag 的显式表态；undefined = 没表态 */
function sweepFlagDecision(options) {
  if (options?.withSweep === true) return 'run';
  return options?.skipSweep === true ? 'skip' : undefined;
}

/**
 * 步骤声明的 context_flag 已被别的 flag 填好（--brand => user_confirmed_open_design）时，
 * 直接拿这个值当确认答案；undefined = 该 flag 还没值，交回闸门去问人。
 */
function declaredFlagAnswer(step, context) {
  const flag = step?.params?.context_flag;
  if (!flag) return;
  const value = context?.[flag];
  // 只有 boolean 才算表态；其它情况必须回 undefined（不能被 ?? 链当成「已答否」）
  if (typeof value !== 'boolean') return;
  return value;
}

/** 命令行的 --choice 也能答 confirm 类问题：序号（1/2）或原文（跑/不跑/是/否）都认 */
const CONFIRM_YES = new Set(['1', 'yes', 'y', 'true', '是', '要', '跑', 'run', 'with-sweep']);
const CONFIRM_NO = new Set(['2', 'no', 'n', 'false', '否', '不要', '不跑', 'skip', 'skip-sweep']);

/** 返回 undefined = 没表态或看不懂 —— 看不懂就交回闸门，不猜 */
export function choiceToConfirm(value) {
  const v = value === undefined || value === '' || value === true ? '' : String(value).trim().toLowerCase();
  if (CONFIRM_YES.has(v)) return true;
  if (CONFIRM_NO.has(v)) return false;
}

/** 把步骤文案里的 ${ctxKey} 渲染出来，让用户看到「到底在确认什么」 */
export function renderPromptText(text, context = {}) {
  return String(text ?? '').replace(/\$\{(\w+)\}/g, (whole, key) => {
    const v = context?.[key];
    return v === undefined || v === null || v === '' ? whole : String(v);
  });
}

/** 打印「这步要人回答但没人可问」的告示，给出可重跑的选项，然后中止 */
function reportAwaitingAnswer(awaiting, stepNum) {
  console.log(chalk.red(`\n✖ Step ${stepNum} 需要人工回答，但当前是非交互环境（无 TTY），引擎不会替你猜：`));
  console.log(chalk.bold(`   ${awaiting.prompt}`));
  const hints = awaiting.hints?.length ? awaiting.hints : [
    { flag: '-S, --with-sweep', text: '答「跑」：审查前现场执行 sweep（约 1~2 分钟，需工作区干净）' },
    { flag: '--skip-sweep', text: '答「不跑」：只读上一份记录' },
  ];
  // 输出成「带序号的选项」而不是一串 flag：用户直接回「1」/「不跑」，
  // agent 再用对应 flag（或 --choice 1）重跑。只列 flag 时用户看不到「跑」这个选项。
  console.log(chalk.yellow('\n   选项（把序号或原文回给 agent，agent 用对应 flag 重跑）：'));
  hints.forEach((h, i) => {
    console.log(`     ${i + 1}) ${chalk.cyan(String(h.flag).padEnd(24))}${h.text}`);
  });
  console.log(chalk.gray('   都不传 => 再次停在同一个问题，不会静默取默认值。'));
  console.log(chalk.gray(`   决策标签：${awaiting.label}`));
}

export async function handleConfirmDialog(step, options, context) {
  if (step.params?.type !== 'confirm' || !step.params?.prompt) return false;

  // 1) 用户已经表过态：-S / --skip-sweep（sweep 专用）、--yes / --decline（通用）、
  //    --choice（序号或原文：1/跑、2/不跑）
  const rawChoice = choiceToConfirm(context?.choiceDecision ?? options?.choice);
  const typedChoice = context?.choiceDecision ?? options?.choice;
  if (rawChoice === undefined && typedChoice !== undefined && typedChoice !== '' && typedChoice !== true) {
    console.log(chalk.yellow(`  ⚠ --choice "${typedChoice}" 不是这个确认问题的选项（1/跑 或 2/不跑），忽略`));
  }
  const raw = context?.sweepDecision
    ?? sweepFlagDecision(options)
    ?? explicitConfirmDecision(options)
    ?? rawChoice
    // 步骤声明了 context_flag 且该 flag 已有值（例如 --brand 蕴含
    // user_confirmed_open_design）=> 这个值就是答案，不用再问一遍。
    // 「值存在即权威」与 plan 的 attestation_enabled 同一套约定。
    ?? declaredFlagAnswer(step, context);
  if (raw !== undefined) {
    setContextFlag(step, context, options, typeof raw === 'string' ? raw === 'run' : raw);
    return true;
  }

  // 2) 有人可问：真终端（含带 --auto 但标了 ask_even_in_auto 的步骤）
  if (!options.auto || shouldPromptInAuto(step)) {
    const answers = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: step.params.prompt, default: step.params.default || false },
    ]);
    setContextFlag(step, context, options, answers.confirm);
    return true;
  }

  // 3) 场景显式声明了 auto 模式下的取值（auto_default）——这是被人写进场景的决定，不是引擎猜的。
  if (step.params?.auto_default !== undefined) {
    setContextFlag(step, context, options, step.params.auto_default);
    return true;
  }

  // 4) 无人可问且没声明默认：交回 runStep 中止。
  // 静默按「不跑」处理过一轮，结果就是用户以为问过、实际没人问过。
  markAwaiting(context, step, {
    prompt: step.params.prompt,
    label: step.params.flag_label || step.params.context_flag || step.description || step.action,
    // 序号 1/2 必须和下面的顺序一致：--choice 1 = 跑，--choice 2 = 不跑
    hints: step.params.context_flag === 'withSweep'
      ? [
          { flag: '-S, --with-sweep', text: '答「跑」：现场执行 sweep（约 1~2 分钟，需工作区干净）' },
          { flag: '--skip-sweep', text: '答「不跑」：只读上一份自检记录' },
        ]
      : [
          { flag: '--yes', text: '答「是」' },
          { flag: '--decline', text: '答「否」' },
        ],
  });
  return true;
}

/** options 可能是字符串 / {id,label} / {label,description} 三种写法，统一成 {id,label,description} */
function toChoices(decl) {
  return (decl || []).map((o) => {
    if (typeof o === 'string') return { id: o, label: o, description: '' };
    const id = o.id ?? o.label;
    return { id, label: o.label ?? o.id ?? String(id), description: o.description || '' };
  });
}

/**
 * 单选步骤：choose / select / input。
 * 以前 --auto 下走 handleChoose/handleSelect 直接取 options[0] —— release 的版本类型
 * 第一个恰是 major，于是静默按大版本发布。现在只有三种合法来源：
 * 命令行的 --choice、场景显式声明的 auto_default、真终端现场选；都没有就中止去问人。
 */
export async function handleOptionSelection(step, options, context, sceneId) {
  const decl = Array.isArray(step.params?.options) ? step.params.options : null;
  const dynamicOpts = step.params?.dynamic_options;

  // 环境变量这类「填空」步骤：没值就等于没做，不能再写个空字符串报「已接收」。
  if (step.action === 'input') return gateInputStep(step, options, context);
  // 动态选项（如 rollback 的 recent_releases）没有取数实现：以前返回
  // 「无可用选项」还记 pass，等于回滚目标由空气决定。现在直接要人给。
  if (!decl || decl.length === 0) return gateDynamicOptions(step, options, context, dynamicOpts);

  const choices = toChoices(decl);
  const ids = choices.map(c => c.id).filter(Boolean);
  const apply = (selected) => {
    context.selectedOption = selected;
    context.choiceDecision = selected;
    if (sceneId === 'design') context.design_selected = selected;
    noteDecision(context, `selectedOption=${selected}`);
    console.log(chalk.green(`\n✅ 已选择：${selected}\n`));
  };

  // 1) 命令行显式指定
  if (applyRequestedChoice(step, options, context, choices, apply)) return true;

  // 2) 真终端现场选
  if (!options.auto) {
    const answers = await inquirer.prompt([{
      type: 'list',
      name: 'selectedOption',
      message: step.params?.message || step.description || '请选择：',
      choices: choices.map(c => ({ name: c.description ? `${c.label} — ${c.description}` : c.label, value: c.id })),
    }]);
    apply(answers.selectedOption);
    return true;
  }

  // 3) 场景显式声明的安全默认
  if (step.params?.auto_default !== undefined) {
    applyDeclaredDefault(step, choices, apply);
    return true;
  }

  // 4) 谁都没表态：中止，由调用方去问人
  markAwaiting(context, step, {
    prompt: renderPromptText(step.params?.message || step.description, context),
    label: step.description || step.action,
    hints: [{ flag: '--choice <值>', text: `可选：${ids.join(' / ')}` }],
  });
  return true;
}

/** 填空类步骤（缺环境变量）：非 auto 交给下层，auto 下没人可问就中止 */
function gateInputStep(step, options, context) {
  if (!options.auto || step.params?.default !== undefined) return false;
  markAwaiting(context, step, {
    prompt: renderPromptText(step.params?.message || step.description, context),
    label: step.description || step.action,
    hints: [{ flag: '（补齐后重跑）', text: '先把缺的值写进 .env / 环境变量，再重跑本场景' }],
  });
  return true;
}

/** 没有静态选项：要么不是选择类步骤（交给下层），要么是动态选项（要人给） */
function gateDynamicOptions(step, options, context, dynamicOpts) {
  if (!dynamicOpts) return handleModeSelection(step, options, context);
  // 闸门文案写着「--choice <目标> 手动指定该项」，那就得真的能指定 ——
  // 以前这里无条件中止，用户按提示传了 --choice 依旧停在原地，是句假话。
  const requested = context.choiceDecision ?? options.choice;
  const value = typeof requested === 'string' ? requested.trim() : '';
  if (value) {
    context.selectedOption = value;
    context.choiceDecision = value;
    noteDecision(context, `selectedOption=${value}（--choice 手动指定）`);
    console.log(chalk.green(`\n✅ 已选择：${value}（--choice 手动指定）\n`));
    return true;
  }
  markAwaiting(context, step, {
    prompt: `${renderPromptText(step.params?.message || step.description, context)}\n   （引擎不会自己取「${dynamicOpts}」列表，需要你直接给出目标）`,
    label: step.description || step.action,
    hints: [{ flag: '--choice <目标>', text: `手动指定该项（如 ${dynamicOpts === 'recent_releases' ? 'v1.2.0' : '具体值'}）` }],
  });
  return true;
}

/** --choice / 上下文里已写定的选择；传了不认识的值也不静默回落 */
function applyRequestedChoice(step, options, context, choices, apply) {
  const requested = context.choiceDecision ?? options.choice;
  if (requested === undefined || requested === '' || requested === true) return false;
  const override = resolveChoiceOverride({ params: { options: choices } }, requested);
  if (override.id) {
    apply(override.id);
    return true;
  }
  console.log(chalk.yellow(`  ⚠ ${override.warning}（不会静默取默认值）`));
  return false;
}

/** 场景自己声明了 auto_default（如 deps 的「安全更新」）才採用，并打印用了什么 */
function applyDeclaredDefault(step, choices, apply) {
  const override = resolveChoiceOverride({ params: { options: choices } }, step.params.auto_default);
  apply(override.id ?? String(step.params.auto_default));
  console.log(chalk.gray('   （按场景声明的 auto_default 取值）'));
}

/**
 * --mode 的解析：对标步骤里声明的选项 id 校验。
 * 认不出的 id 不静默忽略 —— 否则 `--mode full_audit`（写错字或用了旧名）
 * 会退到默认值，而用户以为指定了「全量审计」。
 * @returns {{valid: string[], invalid: string[], available: string[]}}
 */
export function resolveModeOverride(step, requested) {
  const available = (step.params?.options || [])
    .map(o => (typeof o === 'string' ? o : o.id))
    .filter(Boolean);
  const wanted = String(requested ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    valid: wanted.filter(w => available.includes(w)),
    invalid: wanted.filter(w => !available.includes(w)),
    available,
  };
}

async function handleModeSelection(step, options, context) {
  if (step.action !== 'selectModes' || !Array.isArray(step.params?.options)) return false;

  const withDefaults = step.params.options.map(o =>
    typeof o === 'string' ? { id: o, label: o, default: false } : o,
  );
  const override = resolveModeOverride(step, options.mode);
  if (override.invalid.length) {
    console.log(chalk.yellow(`  ⚠ --mode 里有认不出的模式：${override.invalid.join(', ')}（可用：${override.available.join(', ')}）`));
  }

  if (options.auto) {
    // 默认模式来自场景里逐项声明的 default:true（不是引擎猜的第一项），但要让它们可见：
    // 否则“本次审查到底跑了哪几套”只能靠翻 JSON 才知道。
    const picked = override.valid.length > 0
      ? override.valid
      : withDefaults.filter(o => o.default).map(o => o.id);
    context.selected_modes = picked;
    const source = override.valid.length > 0 ? '--mode' : '场景声明的默认值';
    console.log(chalk.gray(`\n⚙ ${step.description || '模式'}：按${source} → ${picked.join(', ') || '（无）'}`));
    noteDecision(context, `modes=${picked.join(',')}`);
    return true;
  }

  const answers = await inquirer.prompt([{
    type: 'checkbox',
    name: 'modes',
    message: step.params.prompt || step.description || '请选择：',
    choices: withDefaults.map(o => ({
      name: o.label,
      value: o.id,
      checked: override.valid.length > 0 ? override.valid.includes(o.id) : !!o.default,
    })),
  }]);
  context.selected_modes = answers.modes.length > 0
    ? answers.modes
    : withDefaults.filter(o => o.default).map(o => o.id);
  noteDecision(context, `modes=${context.selected_modes.join(',')}`);
  return true;
}

/**
 * 把 CLI 覆盖值（如 --kind monitor）对照步骤声明的 options 校验。
 * 识别不了时返回 id: null + 可用值清单，由调用方回落默认值 ——
 * 静默忽略用户传的参数比报错更难查。
 */
export function resolveChoiceOverride(step, requested) {
  const raw = String(requested || '').trim();
  if (!raw) return { id: null, warning: null };
  const ids = (step.params?.options || [])
    .map(o => (typeof o === 'string' ? o : o.id))
    .filter(Boolean);
  if (ids.includes(raw)) return { id: raw, warning: null };
  return { id: null, warning: `未知的分支 "${raw}"，可用: ${ids.join(' / ')}` };
}

/**
 * 单选分支器：把选中的 option id 写入 context[key]。
 * 用于 setup 场景的 e2e/monitor 二选一（两者流程同构，只差一个动作）。
 */
async function handleSingleChoice(step, options, context) {
  const actionMap = {
    selectSetupKind: 'setup_kind',
  };
  const contextKey = actionMap[step.action];
  if (!contextKey || !Array.isArray(step.params?.options)) return false;

  const opts = step.params.options.map(o =>
    typeof o === 'string' ? { id: o, label: o, default: false } : o,
  );
  // 以前 fallback = opts[0]：没写 default 就等于默认第一项，等于替用户拍板。
  // 现在只认场景显式声明的 default；没写就得人回答。
  const fallback = opts.find(o => o.default);

  // CLI 覆盖（--kind monitor）优先于默认值：pi 里的 agent 是非交互的，
  // 没有这条就只能永远拿到 default 那一支。
  const override = resolveChoiceOverride(step, options.kind);
  if (override.warning) {
    console.log(chalk.yellow(`  ⚠ ${override.warning}${fallback ? `（改用默认 ${fallback.id}）` : '（该步未声明默认值，需要人回答）'}`));
  }
  if (override.id) {
    context[contextKey] = override.id;
    noteDecision(context, `${contextKey}=${override.id}`);
    console.log(chalk.green(`
✅ 已选择：${override.id}
`));
    return true;
  }

  if (options.auto) {
    if (fallback) {
      context[contextKey] = fallback.id;
      noteDecision(context, `${contextKey}=${fallback.id}`);
      console.log(chalk.gray(`\n⏭ ${step.description || step.action}：按场景声明的默认值 ${fallback.id}`));
      return true;
    }
    markAwaiting(context, step, {
      prompt: step.params.prompt || step.description || '请选择：',
      label: step.description || step.action,
      hints: [{ flag: '--kind <值>', text: `可选：${opts.map(o => o.id).join(' / ')}` }],
    });
    return true;
  }

  const answers = await inquirer.prompt([{
    type: 'list',
    name: 'choice',
    message: step.params.prompt || step.description || '请选择：',
    choices: opts.map(o => ({ name: o.label, value: o.id })),
    default: fallback?.id,
  }]);
  context[contextKey] = answers.choice;
  noteDecision(context, `${contextKey}=${answers.choice}`);
  console.log(chalk.green(`\n✅ 已选择：${answers.choice}\n`));
  return true;
}

async function dispatchAction(sceneId, action, params, context) {
  const targetPath = context.targetPath || PROJECT_ROOT;
  const result = sceneId === 'ui-polish'
    ? executeUIPolish(action, params, context)
    : executeAction(sceneId, action, params, context, targetPath);
  return result instanceof Promise ? await result : result;
}

function applyPostStepContext(step, context, sceneId) {
  if (step.action === 'generateDesign' || step.action === 'generateLowFi' || step.action === 'generateHiFi') {
    context.open_design_executed = true;
  }
  if (step.action === 'generateLowFi') {
    context.lowFi_generated = true;
  }
  if (step.action === 'choose' && sceneId === 'design') {
    context.design_selected = context.selectedOption;
  }
  if (step.action === 'codeMetrics' || step.action === 'detectAntiPatterns') {
    const found = (context.codeMetricsFindings || 0) + (context.antiPatternFindings || 0);
    if (found > 0) {
      context.refactor_points = context.refactor_points || [];
      context.refactor_points.push(step.action);
    }
  }
}

/**
 * 把非 pass 步骤渲染成可核对的行。计数（fail: 1）不告诉你哪步不行，
 * 收尾摘要与报告都靠这个列表说清楚「到底哪里没过」。
 */
export function describeNotPassSteps(stepResults, limit = 12) {
  const list = (Array.isArray(stepResults) ? stepResults : [])
    .filter((r) => r && typeof r.status === 'string' && r.status !== 'pass');
  const lines = list.slice(0, limit).map((r) => `Step ${r.step ?? '?'} ${r.action} → ${r.status}`);
  return { lines, total: list.length };
}

function printSummary(sceneId, context = null) {
  console.log(chalk.dim(`\n${'─'.repeat(40)}`));
  const { pass, fail, skip, noop, warn } = LOG_SUMMARY;
  const failIcon = fail > 0 ? chalk.red(`  ✗ fail: ${fail}`) : chalk.green('  ✗ fail: 0');
  const warnIcon = warn > 0 ? chalk.yellow(`  ⚡ warn: ${warn}`) : chalk.green('  ⚡ warn: 0');
  const noopIcon = noop > 0 ? chalk.yellow(`  ⚠ noop: ${noop}`) : chalk.green('  ⚠ noop: 0');
  console.log(chalk.cyan(`  Scene: ${sceneId}  `) + chalk.green(`✓ pass: ${pass}  `) + failIcon + warnIcon + chalk.gray(`  ⏭ skip: ${skip}  `) + noopIcon);
  // skip 里混着两种东西：条件明确不满足，和「运行时键没人写过，根本没法判」。
  // 后者没跑 ≠ 不该跑，汇总里必须点名，否则就是静默跳过。
  const unjudged = context?._unjudgedSteps || [];
  if (unjudged.length > 0) {
    console.log(chalk.yellow(`  ⚠ ${unjudged.length} 个步骤因运行时状态未判定被跳过（没跑，不等于不该跑）：`));
    for (const item of unjudged.slice(0, 10)) {
      console.log(chalk.yellow(`     Step ${item.step} ${item.description}（缺 ${item.keys.join(', ')}）`));
    }
  }
  if (fail > 0 || noop > 0 || warn > 0 || unjudged.length > 0) {
    console.log(chalk.dim(`  日志: ${LOG_PATH}`));
  }
  // 计数不等于内容：block 收尾时用户最需要知道「具体哪几歩不行」。
  const { lines, total } = describeNotPassSteps(context?.stepResults);
  if (lines.length > 0) {
    console.log(chalk.yellow('  未通过 / 未执行的步骤：'));
    for (const line of lines) {
      console.log(chalk.yellow(`     ${line}`));
    }
    if (total > lines.length) {
      console.log(chalk.dim(`     …共 ${total} 步，完整列表见报告/日志`));
    }
  }
  console.log(chalk.dim('─'.repeat(40)));
  // Acceptance triple: bind delivery to a reviewed check, not handoff alone.
  console.log(chalk.cyan('  验收三元组（交付前必须报告）：'));
  console.log(chalk.gray('    1. 变更：本次修改的文件/内容'));
  console.log(chalk.gray('    2. 验证命令：实际跑过的 lint/test/build'));
  console.log(chalk.gray('    3. 验证结果：命令的通过/失败状态'));
  console.log(chalk.dim(`${'─'.repeat(40)}\n`));
}

async function handleStepError(step, context, sceneId, resolvedParams) {
  // 质量门禁里声明了 block_*（block_release / block_merge / block_critical）：
  // 这就是「失败即阻断」的承诺，不该再依赖场景有没有记得写 on_error。
  if (context.gateBlocked) {
    console.log(chalk.red(`\n✖ Step ${step.step} 质量门禁阻断（场景声明了 block_*），工作流中止`));
    printSummary(sceneId, context);
    process.exit(1);
  }
  if (!context.lastStepFailed || !step.on_error) return;

  if (step.on_error === 'abort') {
    console.log(chalk.red(`\n✖ Step ${step.step} 失败（on_error=abort），工作流中止`));
    printSummary(sceneId, context);
    process.exit(1);
  }
  if (step.on_error === 'fail_workflow') {
    console.log(chalk.red(`\n✖ Step ${step.step} 失败（on_error=fail_workflow），安全阻断，工作流中止`));
    printSummary(sceneId, context);
    process.exit(1);
  }
  if (step.on_error === 'retry') {
    for (let retry = 0; retry < 3 && context.lastStepFailed; retry++) {
      console.log(chalk.yellow(`\n🔄 Step ${step.step} 失败，第 ${retry + 1}/3 次重试...`));
      context.lastStepFailed = false;
      const retryResult = await dispatchAction(sceneId, step.action, resolvedParams, context);
      console.log(chalk.green(`   ${retryResult}`));
    }
    if (context.lastStepFailed) {
      context.fixFailedCount = (context.fixFailedCount || 0) + 1;
      console.log(chalk.red(`\n✖ Step ${step.step} 重试 3 次后仍失败（on_error=retry），工作流中止`));
      printSummary(sceneId, context);
      process.exit(1);
    }
  }
}

/** 去掉拖拽路径时带上的引号/变量符号 */
export function sanitizeTargetPath(p) {
  return p.replace(/["$`]/g, '');
}

/**
 * 非交互解析目标项目：--target 优先，否则 PROJECT_ROOT
 * （= $MIX_CODING_PROJECT_DIR || cwd）。
 */
export function defaultTargetPath(options) {
  if (options.target) return sanitizeTargetPath(options.target);
  return PROJECT_ROOT;
}

async function resolveTargetPath(options, context) {
  // 默认目标就是 PROJECT_ROOT，不能直接用 process.cwd()：那样
  // MIX_CODING_PROJECT_DIR 只影响 paths.js 的场景查找，实际动作却按
  // cwd 执行 —— 两套目录错位，动作会跑错项目。
  if (options.target || options.auto) {
    context.targetPath = defaultTargetPath(options);
    console.log(chalk.cyan(`\n📁 目标项目：${context.targetPath}\n`));
    return;
  }

  try {
    const { targetPath } = await inquirer.prompt([{
      type: 'input', name: 'targetPath',
      message: '请输入目标项目路径（或拖拽文件夹到此处）：',
      default: PROJECT_ROOT,
    }]);
    context.targetPath = sanitizeTargetPath(targetPath);
    console.log(chalk.cyan(`\n📁 目标项目：${targetPath}\n`));
  } catch {
    console.log(chalk.dim('  交互模式不可用，使用当前目录'));
    context.targetPath = PROJECT_ROOT;
  }
}

// ── Main exported functions ──

function loadScene(sceneId) {
  const filePath = resolveScenePath(sceneId);
  if (!filePath) {
    throw new Error(
      `未找到场景 "${sceneId}"。已搜索:\n${describePaths().sceneDirs.map(d => '  - ' + d).join('\n')}`,
    );
  }
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * 主题选择型确认步骤的三条出口：
 *   true  = 已选定/已拒绝，调用方直接返回
 *   false = 没选定，交回调用方继续（理论上不该发生）
 *   undefined 由调用方继续走普通确认逻辑（仅当用户显式拒绝时）
 */
function resolveThemeStep(step, options, context, shown) {
  const raw = context?.selectedTheme
    || resolveThemeChoice(context?.choiceDecision)
    || resolveThemeChoice(options?.choice)
    || resolveThemeChoice(options?.theme);
  if (raw && THEME_NAMES[raw]) {
    context.selectedTheme = raw;
    noteDecision(context, `theme=${raw}`);
    // --theme 在场景开头已经印过一次，别刷两遍
    if (!options?.theme) console.log(chalk.green(`✅ 已选择主题：${THEME_NAMES[raw]}`));
    return true;
  }
  if (options?.theme && !THEME_NAMES[String(options.theme).toLowerCase()]) {
    console.log(chalk.yellow(`  ⚠ --theme "${options.theme}" 不是已知主题，忽略`));
  }
  // 用户明确拒绝美化 → 走普通确认逻辑（记 user_confirmed=false）
  if (explicitConfirmDecision(options) === false) return;
  // 其余情况（没表态 / 只传了 --yes）：主题还没选，不能拿 --yes 当选定值。
  markAwaiting(context, step, {
    prompt: shown,
    label: '主题选择（ui-polish 6）',
    hints: THEME_CHOICES.map((c, i) => ({
      flag: `--theme ${c.value}`,
      text: `${i + 1}) ${c.label}`,
    })),
  });
  return true;
}

/** 带 options 的 confirm 实际是「选哪个」，不是「要不要」 */
function isChoiceConfirm(step) {
  return Array.isArray(step.params?.options) && step.params.options.length > 0;
}

/** 处理确认型步骤；返回 true 表示已完全处理，调用方应提前返回 */
export async function handleConfirmation(step, options, context) {
  const isConfirmationStep = step.action === 'confirm' || !!step.confirm_message;
  const confirmMsg = isConfirmationStep ? (step.confirm_message || step.params?.message) : null;
  if (!confirmMsg) return false;

  const shown = renderPromptText(confirmMsg, context);

  // mobile-release 4：「请选择版本升级类型」——文案问的是选择，却挂着 confirm 动作。
  // 以前一律渲染成「要不要继续」（只有 --yes/--decline），用户选的 major/minor
  // 从未被记录，下游 bumpVersion 于是静默按 patch 升版本。带 options 的 confirm
  // 交回选项选择器，--choice major 才能生效。
  if (isChoiceConfirm(step)) return false;

  // 0) 主题选择型确认（ui-polish 6）：这步问的是「选哪个主题」，不是「要不要继续」。
  //    以前非交互下给了 --yes/--decline 两个选项，问题本身没人能回答。
  if (step.params?.theme_selection) {
    const handled = resolveThemeStep(step, options, context, shown);
    if (handled !== undefined) return handled;
  }

  // 1) 命令行已明确表态：--yes 放行 / --decline 拒绝
  const decided = context.confirmDecision ?? explicitConfirmDecision(options);
  if (decided !== undefined) {
    context.user_confirmed = decided;
    noteDecision(context, `user_confirmed=${decided}`);
    console.log(chalk[decided ? 'green' : 'gray'](`\n${decided ? '✅ 已确认' : '⏭ 已拒绝'}（命令行显式表态）：${shown.split('\n')[0]}`));
    return step.action === 'confirm';
  }

  // 2) 有人可问：真终端
  if (!options.auto) {
    const answers = await inquirer.prompt([
      { type: 'confirm', name: 'proceed', message: shown, default: true },
    ]);
    context.user_confirmed = answers.proceed;
    if (!answers.proceed) {
      console.log(chalk.yellow(`  ⏭ 用户跳过 Step ${step.step}`));
      LOG_SUMMARY.total++;
      LOG_SUMMARY.skip++;
      appendLog({ step: step.step, action: step.action, status: 'skip', reason: 'user', time: new Date().toISOString() });
      context._stepAlreadyLogged = true;
      return true;
    }
    return step.action === 'confirm';
  }

  // 3) 场景显式声明 auto 下可自动放行（auto_confirm: true）才走这条
  if (step.params?.auto_confirm === true) {
    context.user_confirmed = true;
    noteDecision(context, 'user_confirmed=true（场景声明的 auto_confirm）');
    return step.action === 'confirm';
  }

  // 4) 没人可问：以前这里直接 user_confirmed = true —— 于是「是否提交代码 / 是否执行
  // 回滚 / 是否发布」在 --auto 下全部被自动点头，push_remote 也照旧。现在一律要人回答。
  markAwaiting(context, step, {
    prompt: shown,
    label: step.description || step.action,
    hints: [
      { flag: '--yes', text: '确认并继续（用户已看过上面的清单）' },
      { flag: '--decline', text: '不确认，跳过后续受 user_confirmed 控制的部分' },
    ],
  });
  return step.action === 'confirm';
}

// Runs the interactive (auto_execute === false) phase of a step.
// Returns true when the step was fully handled and runStep should return early.
export async function handleInteractiveStep(sceneId, step, context, options) {
  // selectModes 必须先把 selected_modes 写入 context，否则后续条件的
  // `selected_modes.includes(...)` 全为 false —— 该场景 25 步会全部被跳过。
  // 与 auto_execute 无关：它在 auto 模式走 default 选项，在交互模式走 checkbox。
  if (await handleModeSelection(step, options, context)) return true;
  if (await handleSingleChoice(step, options, context)) return true;

  if (step.auto_execute !== false) return false;

  if (await handleThemeSelection(step, options, context)) return true;
  if (await handleAwmBrandSelection(step, options, context)) return true;
  if (await handleConfirmDialog(step, options, context)) return true;
  if (await handleConfirmation(step, options, context)) return true;

  return handleOptionSelection(step, options, context, sceneId);
}

// Auto-detect no-op: tool unavailable / nothing to check / config missing
// eslint-disable-next-line sonarjs/super-linear-regex -- /no\s+.*?found/i 是原有兜底规则
const NOOP_RES = [/不可用/i, /未安装/, /未找到/, /not found/i, /not available/i, /已?跳过/, /no\s+.*?found/i];

// 「无 X 目录 / 无配置文件」＝没事可做。以前写成 `/无[^]*?[目录配置]/`：能跨 200 多字，
// 于是「无问题（扫描 215 个源码文件）」里只要有「无」+ 后面碰到目/录/配/置 任何一个字，
// 扫了一天的活儿就被记成 noop。这里用有界扫描替代正则（也让 sonar 的回溯告警消失）。
const NOTHING_TO_CHECK_WINDOW = 14;
function saysNothingToCheck(text) {
  let from = 0;
  for (;;) {
    const at = text.indexOf('无', from);
    if (at === -1) return false;
    const tail = text.slice(at + 1, at + 1 + NOTHING_TO_CHECK_WINDOW);
    if (tail.includes('目录') || tail.includes('配置')) return true;
    from = at + 1;
  }
}
// Auto-detect warn: passes but result indicates non-zero issues (aislop findings, vulnerabilities, etc.)
// 两个坑都踩过：
//   1. `\d+` 让「11 道检查完成: 0 个问题」被判成告警 —— 0 就是干净，得从 1 起算。
//   2. 「4 个后端均未重复写入」是去重的正常路径，只要命中「重复」就误报。
//   3. `\d+\s*(?:failed|failure)` 那条永远不会走到 —— `detectHandlerFailure` 的
//      `/失败|阻断|abort|FAIL/i` 先一步命中 "fail"，所以已删除。
const WARN_RES = [/\b[1-9]\d*\s*[个处类].{0,30}?(?:问题|漏洞|警告|气味|发现)/i];
const WARN_REPEAT_RE = /\b[1-9]\d*\s*[个处类].{0,30}?重复/;
const NEGATED_REPEAT_RE = /(?:未|无|不|没有)重复/;

function hasWarnResult(str) {
  if (WARN_RES.some((re) => re.test(str))) return true;
  return WARN_REPEAT_RE.test(str) && !NEGATED_REPEAT_RE.test(str);
}

function formatResultForDisplay(result) {
  if (typeof result === 'string') return result;
  // undefined/null 以前走 String() → 屏幕上真的打印出「undefined」，然后记 pass
  if (result === undefined || result === null) return '';
  if (typeof result === 'object') {
    if (typeof result.message === 'string') return result.message;
    // status:'interactive' 以前渲染成「步骤已完成（状态：interactive）」并记 pass ——
    // plan 的“收集需求/认证确认”在 CLI 下根本没发生，却看起来完了。
    if (result.status === 'interactive') {
      return `需人工回答（未执行）：${result.prompt ?? '该步骤需交互输入'}`;
    }
    return `步骤已完成（状态：${result.status ?? 'success'}）`;
  }
  return String(result);
}

/** 步骤状态 → ora 的输出通道：失败必须是 fail，不能一律 succeed。 */
export function spinnerMethodFor(stepStatus) {
  if (stepStatus === 'fail') return 'fail';
  if (stepStatus === 'warn' || stepStatus === 'noop') return 'warn';
  if (stepStatus === 'skip') return 'info';
  return 'succeed';
}

/** 状态对应的颜色/前缀，让逐行输出和最终汇总说的是同一件事。 */
export function paintByStatus(stepStatus, text) {
  if (stepStatus === 'fail') return chalk.red(`✖ ${text}`);
  if (stepStatus === 'warn') return chalk.yellow(`⚡ ${text}`);
  if (stepStatus === 'noop') return chalk.gray(`○ ${text}`);
  if (stepStatus === 'skip') return chalk.gray(`⏭ ${text}`);
  return chalk.green(text);
}

export function deriveStepStatus(result, context) {
  if (!context.lastStepFailed && detectHandlerFailure(result)) {
    context.lastStepFailed = true;
  }
  const resultStr = typeof result === 'string' ? result : formatResultForDisplay(result);
  if (context.lastStepFailed) return { resultStr, stepStatus: 'fail' };
  // 处理器可直接布状态（三态检查/跳过不再靠正则猜），正则启发式仅作兵底。
  const explicit = getExplicitStatus(result);
  if (explicit) return { resultStr, stepStatus: explicit };
  // 处理器什么都没返回（忘了 return / 走了空分支）时，以前落到默认那行记成 pass ——
  // 「步骤 ✓ 但一行输出都没有」是典型的静默失败。空结果一律先当 warn 让人看见。
  if (!String(resultStr ?? '').trim()) {
    return { resultStr: '（处理器没有返回任何结果，检查该动作是否真的执行了）', stepStatus: 'warn' };
  }
  const isNoop = NOOP_RES.some(re => re.test(resultStr)) || saysNothingToCheck(resultStr);
  const isWarn = !isNoop && hasWarnResult(resultStr);
  return { resultStr, stepStatus: isNoop ? 'noop' : (isWarn ? 'warn' : 'pass') };
}

const EXPLICIT_STATUSES = new Set(['pass', 'fail', 'skip', 'noop', 'warn']);

/**
 * 处理器自己的 status 词汇表（success/created/error/exists…）→ 引擎五态。
 * 以前只认五个值的白名单，其余全部掉进「拿 message 正则猜」：
 * `{ status: 'error', message: 'EACCES: permission denied' }` 里没有「失败」二字，
 * 于是被记成 ✓ pass —— 43 处 return 都踩在这条缝上。
 * 映射原则：只有「真的做了事」才 pass；「什么都不用做」= noop；
 * 「输入不在了」= skip；「有发现」= warn；「出错」= fail。
 */
const STATUS_ALIASES = new Map([
  ['success', 'pass'],
  ['ok', 'pass'],
  ['complete', 'pass'],
  ['completed', 'pass'],
  ['done', 'pass'],
  ['created', 'pass'],
  ['applied', 'pass'],
  ['failed', 'fail'],
  ['failure', 'fail'],
  ['error', 'fail'],
  ['skipped', 'skip'],
  ['not_found', 'skip'],
  ['notfound', 'skip'],
  ['missing', 'skip'],
  ['exists', 'noop'],
  ['already_exists', 'noop'],
  ['unchanged', 'noop'],
  ['warning', 'warn'],
  ['partial', 'warn'],
  ['issues', 'warn'],
]);

/** 认不出的 status 一律 warn（可见），绝不回落到正则把「没准确定状态」猜成 pass */
export function normalizeStepStatus(status) {
  if (typeof status !== 'string' || !status.trim()) return null;
  const key = status.trim().toLowerCase();
  if (EXPLICIT_STATUSES.has(key)) return key;
  return STATUS_ALIASES.get(key) ?? 'warn';
}

/** 处理器返回 { status, message } 时以 status 为准（不再被正则误判为 pass）。 */
function getExplicitStatus(result) {
  if (!result || typeof result !== 'object') return null;
  // 缺“交互层”的处理器（gatherRequirements / confirmAttestation）返回 interactive：
  // 没人回答就等于没做，记 skip 而不是 pass。
  if (result.status === 'interactive') return 'skip';
  return normalizeStepStatus(result.status);
}

function recordStepResult(step, stepNum, status, duration, resultStr, context) {
  LOG_SUMMARY.total++;
  switch (status) {
    case 'fail': LOG_SUMMARY.fail++; break;
    case 'noop': LOG_SUMMARY.noop++; break;
    case 'warn': LOG_SUMMARY.warn++; break;
    // 之前 'skip' 落进 default 记成 pass —— 处理器明确说「我没跑成」也被算作通过，
    // 汇总行就成了 pass: N 的假绿。
    case 'skip': LOG_SUMMARY.skip++; break;
    default: LOG_SUMMARY.pass++; break;
  }
  appendLog({ step: stepNum, action: step.action, status, iteration: context.iteration || 1, duration_ms: duration, result: resultStr.slice(0, 200), time: new Date().toISOString() });
  // Track per-step { action, status } for the acceptance reviewed-check gate.
  // step/detail 是给收尾摘要和报告看的：只有 action+status 时，事后看到
  // 「report → warn」也无法知道 warn 的是什么。
  if (!Array.isArray(context.stepResults)) context.stepResults = [];
  const detail = String(resultStr || '');
  context.stepResults.push({ step: stepNum, action: step.action, status, detail: detail.length > 120 ? `${detail.slice(0, 120)}…` : detail });
}

/**
 * 「该问而无人可问」的收尾：落 fail 记录、打印告示、然后中止（exit 2）。
 * 不写默认值、不装通过 —— 剩下的只能由调用方把问题转给人。
 */
function abortForAwaitingAnswer(sceneId, step, context) {
  const awaiting = context._awaitingAnswer;
  delete context._awaitingAnswer;
  LOG_SUMMARY.total++; LOG_SUMMARY.fail++;
  appendLog({ step: step.step, action: step.action, status: 'fail', reason: 'needs-answer', detail: awaiting.label, time: new Date().toISOString() });
  reportAwaitingAnswer(awaiting, step.step);
  printSummary(sceneId, context);
  process.exit(2);
}

/** 交互步骤「真拿到了决定」的标记；runStep 消费后清掉。没打标记 = 这步什么都没定 */
function noteDecision(context, detail) {
  context._stepDecision = detail || true;
}

/**
 * detail 里优先写 context_flag 的值，其次写决定摘要；不能只写「答过」，事后要能追问答了什么
 */
function decisionDetail(step, context, decided) {
  const flag = step.params?.context_flag;
  if (flag && context[flag] !== undefined) return `${flag}=${context[flag]}`;
  return typeof decided === 'string' ? decided : undefined;
}

/** 导出只为了可测：日志条目是这步到底做了什么的唯一证据 */
export function recordInteractiveStep(step, context) {
  const decided = context._stepDecision;
  delete context._stepDecision;
  const detail = decisionDetail(step, context, decided);
  const answered = Boolean(decided);
  LOG_SUMMARY.total++;
  LOG_SUMMARY[answered ? 'pass' : 'skip']++;
  const entry = {
    step: step.step,
    action: step.action,
    status: answered ? 'pass' : 'skip',
    reason: answered ? 'interactive-answered' : 'interactive',
    detail,
    time: new Date().toISOString(),
  };
  appendLog(entry);
  return entry;
}

/** 交互步骤的收尾：要么中止去问人，要么记下这步到底做了什么（处理器自己记过就不再记） */
function finishInteractiveStep(sceneId, step, context) {
  if (context._awaitingAnswer) abortForAwaitingAnswer(sceneId, step, context);
  if (context._stepAlreadyLogged) {
    delete context._stepAlreadyLogged;
    return;
  }
  recordInteractiveStep(step, context);
}

/**
 * 条件里的键从头到尾没人写过 → 这一步既不算「不满足」也不算跑过。
 * 单独抽出来，免得 runStep 的认知复杂度撞到 sonarjs 的 15 上限。
 */
function noteUnjudgedStep(step, stepNum, unknown, context, options) {
  const line = `  ❓ 未判定 Step ${stepNum}: ${step.description || step.action}（依赖运行时状态：${unknown.join(', ')}）`;
  console.log(options.dryRun ? chalk.gray(line) : chalk.yellow(line));
  context._unjudgedConditions = (context._unjudgedConditions || 0) + 1;
  context._unjudgedSteps = context._unjudgedSteps || [];
  context._unjudgedSteps.push({ step: stepNum, description: step.description || step.action, keys: unknown });
}

async function runStep(sceneId, step, context, options) {
  const stepNum = step.step;

  if (step.condition && !evaluateCondition(step.condition, context)) {
    const { unknown } = explainCondition(step.condition, context);
    if (unknown.length > 0) {
      // 真实执行里同样会出现：条件依赖的键从头到尾没人写过 —— 那一步就不会跑。
      // 以前一律灰色一行带过，汇总里只多一个 skip，看着像「条件不满足」。
      noteUnjudgedStep(step, stepNum, unknown, context, options);
    } else {
      console.log(chalk.gray(`  ⏭ 跳过 Step ${stepNum}: ${step.description || step.action}（条件不满足）`));
    }
    LOG_SUMMARY.total++; LOG_SUMMARY.skip++;
    appendLog({ step: stepNum, action: step.action, status: 'skip', reason: unknown.length > 0 ? 'unjudged' : 'condition', time: new Date().toISOString() });
    return;
  }

  if (await handleInteractiveStep(sceneId, step, context, options)) {
    finishInteractiveStep(sceneId, step, context);
    return;
  }

  const spinner = ora({ text: `执行中: ${step.action}...`, color: 'cyan' }).start();
  const resolvedParams = resolveParams(step.params, context);
  context.lastStepFailed = false;

  const stepStart = Date.now();
  const result = await dispatchAction(sceneId, step.action, resolvedParams, context);
  const duration = Date.now() - stepStart;

  // 处理器里也可能遇到「只有一个选项得问用户」（如 od-brand-pick 选品牌）：
  // 谁都能把问题写进 context._awaitingAnswer，这里统一中止去问，不替用户挑一个。
  if (context._awaitingAnswer) abortForAwaitingAnswer(sceneId, step, context);

  const { resultStr, stepStatus } = deriveStepStatus(result, context);
  recordStepResult(step, stepNum, stepStatus, duration, resultStr, context);

  // 以前无论状态如何都走 spinner.succeed + chalk.green —— 失败的步骤也打绿色 ✔，
  // 只有最后的汇总行才露出 ✗ fail，逐步输出全是假绿。
  const display = formatResultForDisplay(result);
  const { text: shown, folded } = foldOutput(display, {
    fold: options.fold !== false,
    stepStatus,
    fullLogPath: STEP_OUTPUT_PATH,
  });
  if (folded) appendStepOutput(stepNum, step.action, display);
  const method = spinnerMethodFor(stepStatus);
  const painted = paintByStatus(stepStatus, shown);
  switch (method) {
    case 'fail': spinner.fail(painted); break;
    case 'warn': spinner.warn(painted); break;
    case 'info': spinner.info(painted); break;
    default: spinner.succeed(painted);
  }

  if (shouldAbortOnEnclosure(context)) {
    console.log(chalk.red('\n✖ 圈地越界（--strict-enclosure）：边界超限即中止，不在破了的地界上继续施工'));
    console.log(chalk.yellow('   先 git status 看改动范围，必要时按围栏快照回滚（fenceRestore）'));
    printSummary(sceneId, context);
    process.exit(1);
  }

  applyPostStepContext(step, context, sceneId);

  await handleStepError(step, context, sceneId, resolvedParams);

  if (step.action.includes('deploy') && resultStr.includes('部署')) {
    console.log(chalk.yellow('⚠️  部署步骤已完成，请手动验证部署结果'));
  }

  context.completedSteps.push(stepNum);
}

/**
 * 圈地越界在 strict 模式下「一次都不许放过」：只要本轮量到越界就整体中止，
 * 不再往下走（继续走等于在破了的地界上施工）。默认模式只把该步骤判失败。
 */
export function shouldAbortOnEnclosure(context) {
  if (!context?.strictEnclosure) return false;
  return Array.isArray(context.boundaryViolations) && context.boundaryViolations.length > 0;
}

export function buildSceneContext(options) {
  const prompt = options.prompt || '';
  return {
    prompt,
    completedSteps: [],
    targetPath: options.target || '',
    // 圈地越界在默认模式下只判该步骤失败；strict 模式越界即整体中止。
    selectedTheme: options.theme || '',
    securityScanResult: {},
    selectedOption: options.option || '',
    refactor_points: [],
    database_required: /数据库|database|db|存储|数据|postgres|mysql|supabase|mongo/i.test(prompt),
    payment_required: /支付|付款|payment|stripe|订阅|billing/i.test(prompt),
    email_required: /邮件|email|邮箱|通知|发送|resend/i.test(prompt),
    strictEnclosure: Boolean(options.strictEnclosure),
    // --with-sweep：跳过询问，强制在审查前跑一次探测器自检
    sweepForced: Boolean(options.withSweep),
    // 交互步骤 2.68 会把它改成用户的当场选择；未传 -S 时必须留 undefined。
    // 以前写的是 Boolean(options.withSweep) —— flag 没传就等于「用户说了不要」，
    // 而 2.68 声明了 context_flag=withSweep，于是「值存在即权威」把 false 当成
    // 已答复，闸门根本不会再问（假绿：从没问过人却记 pass）。
    withSweep: options.withSweep === true ? true : undefined,
    // 用户是否已就 sweep 明确表态（-S 跑 / --skip-sweep 不跑）；undefined = 没表态
    sweepDecision: options.withSweep === true ? 'run' : (options.skipSweep === true ? 'skip' : undefined),
    // --brand：用户已指定品牌设计系统。只设 user_selected_brand 不够 ——
    // new-project 3.5 会再问一次「是否需要 Open Design」，3.551/3.55…3.79 与
    // ui-polish 6.3…7.15 的 condition 又都看 user_confirmed_open_design。
    // 于是 --brand 在非交互运行里几乎等于没传：先 exit 2，重跑后下游全被条件跳过。
    // 选了具体品牌 = 明确要用 Open Design；--brand skip = 明确不用。
    user_selected_brand: options.brand || undefined,
    user_confirmed_open_design: brandConsent(options.brand),
    // --attest true|false：plan 7 的 SHA256 认证表态；undefined = 没表态，会去问人
    attestation_enabled: parseAttestFlag(options.attest),
  };
}

/** --brand 蕴含的 Open Design 表态：具体品牌 = 用，skip = 不用，没传 = 没表态 */
export function brandConsent(brand) {
  if (brand === undefined || brand === null || brand === '') return;
  return String(brand).trim().toLowerCase() !== 'skip';
}

/** --attest 只接受 true/false（以及 1/0、yes/no）；别的一律当「没表态」，不猜 */
export function parseAttestFlag(raw) {
  if (raw === undefined || raw === null) return;
  if (raw === true) return true; // `--attest` 不带值
  const text = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', '是', '开'].includes(text)) return true;
  if (['false', '0', 'no', 'n', '否', '关'].includes(text)) return false;
}

/**
 * 一个 step 到底有没有落点：交互层由 handleInteractiveStep 拦，ui-polish 有自己一套表，
 * 其余必须能在 ACTION_REGISTRY 里找到处理器。
 */
function hasStepHandler(sceneId, step) {
  if (step.layer === 'interactive') return true;
  if (hasActionHandler(step.action)) return true;
  return sceneId === 'ui-polish' && Boolean(UI_POLISH_ACTIONS[step.action]);
}

function previewCondition(step, context) {
  if (!step.condition) return;
  const { met, unknown } = explainCondition(step.condition, context);
  const verdict = met
    ? chalk.green('满足')
    : (unknown.length > 0
      ? chalk.yellow(`未判定（运行时状态：${unknown.join(', ')}）`)
      : chalk.red('不满足'));
  console.log(chalk.gray(`     └─ 条件 [${step.condition}]: ${verdict}`));
  if (!met && unknown.length > 0) context._unjudgedConditions = (context._unjudgedConditions || 0) + 1;
}

function previewDryRunStep(step, context, options = {}, sceneId = '') {
  const icon = LAYER_ICONS[step.layer] || '📦';
  const stepIcon = step.auto_execute === false ? '⏸' : '▶';
  const autoLabel = step.auto_execute === false ? '需确认' : '自动';
  const desc = step.description || step.action;
  console.log(chalk.dim(`  ${stepIcon} Step ${step.step} [${autoLabel}] ${icon}`));
  console.log(chalk.gray(`     └─ ${desc}`));
  // 试运行以前只看条件，不看 action 有没有处理器 —— 名字写错/表里漏掉的步骤
  // 在预览里是「▶ Step N 自动」一行，跑起来也只是一行看不出问题的输出。
  if (!hasStepHandler(sceneId, step)) {
    console.log(chalk.red(`     └─ ✖ 这个 action 没有任何处理器（实跑只会记 warn，什么都没做）`));
  }
  previewCondition(step, context);
  if (step.action === 'selectSetupKind') {
    const override = resolveChoiceOverride(step, options.kind);
    if (override.warning) console.log(chalk.yellow(`     └─ ⚠ ${override.warning}`));
    else if (override.id) console.log(chalk.gray(`     └─ CLI 覆盖: ${override.id}`));
  }
  context.completedSteps.push(step.step);
}

function enforceAcceptanceGate(scene, context, sceneId) {
  // Hard acceptance gate: a change-bearing run must close with a reviewed-passing verify step.
  // Scenes that legitimately have no verify step declare allow_no_verify: true.
  const acceptance = checkAcceptance(scene.flow, context.completedSteps, scene.allow_no_verify, context.stepResults);
  if (acceptance.missingVerify) {
    console.log(chalk.red('  ✖ 验收阻断：本次工作流包含变更类步骤但未执行任何验证类步骤（lint/test/verify/build）。'));
    console.log(chalk.red('    交付前必须补跑验证并报告「变更 + 验证命令 + 验证结果」三元组。'));
    printSummary(sceneId, context);
    process.exit(1);
  }
  if (acceptance.unreviewedChange) {
    console.log(chalk.red('  ✖ 验收阻断：本次工作流有变更，但验证类步骤未通过（全部 fail/noop/skip）。'));
    console.log(chalk.red('    交付前必须让验证步骤 pass 或 warn（通过带发现），并报告「变更 + 验证命令 + 验证结果」三元组。'));
    printSummary(sceneId, context);
    process.exit(1);
  }
}

const MAX_ITERATIONS = 20;

/** `--iterations N`（或场景里声明的 iterations）。默认 1 = 与旧行为一致。 */
export function resolveIterations(options, scene) {
  const requested = options?.iterations ?? scene?.iterations ?? 1;
  const parsed = Number.parseInt(requested, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_ITERATIONS);
}

/**
 * 收敛判据：之前“循环 N 次”只是一句没人消费的 prompt 文本（引擎没有迭代概念）。
 * 本轮干净就停；发现数没下降也停，否则 N 轮都在同一批问题上空转。
 * `--force-iterations` 显式要求跑满轮数时，no-progress 只警告不停。
 */
export function shouldStopLooping({ iteration, max, prevFindings, findings, force = false }) {
  if (iteration >= max) return { stop: true, reason: 'max', message: `已跑满 ${max} 轮` };
  if (findings === 0) return { stop: true, reason: 'clean', message: '本轮无新发现，提前结束' };
  if (prevFindings !== null && findings >= prevFindings) {
    const message = `发现数未下降（${prevFindings} → ${findings}）`;
    if (force) return { stop: false, reason: 'no-progress-forced', message: `${message}，按 --force-iterations 继续` };
    return { stop: true, reason: 'no-progress', message: `${message}，停止空转` };
  }
  return { stop: false, reason: 'continue', message: '' };
}

function countFindings(context) {
  return (context.aislop_issue_count || 0) + (context.review_issue_count || 0);
}

async function runFlow(sceneId, scene, context, options) {
  for (const step of scene.flow) {
    if (options.dryRun) {
      previewDryRunStep(step, context, options, sceneId);
      continue;
    }
    await runStep(sceneId, step, context, options);
  }
}

async function runIterations(sceneId, scene, context, options) {
  const iterations = options.dryRun ? 1 : resolveIterations(options, scene);
  const force = Boolean(options.forceIterations);
  let prevFindings = null;
  for (let iteration = 1; iteration <= iterations; iteration++) {
    if (iterations > 1) console.log(chalk.cyan(`\n🔁 第 ${iteration}/${iterations} 轮`));
    context.iteration = iteration;
    // 每轮都重拍基线：边界量的是「本轮的改动」，上一轮的成果不占这一轮的额度。
    if (!options.dryRun) {
      context.codeguardianBaseline = captureBoundaryBaseline(context.targetPath);
    }
    await runFlow(sceneId, scene, context, options);
    if (options.dryRun) break;
    const findings = countFindings(context);
    if (iterations > 1) console.log(chalk.dim(`   本轮发现 ${findings} 处`));
    const decision = shouldStopLooping({ iteration, max: iterations, prevFindings, findings, force });
    if (decision.message && iterations > 1) {
      console.log(chalk.dim(`   ↳ ${decision.message}`));
    }
    if (decision.stop) break;
    prevFindings = findings;
  }
}

export async function startScene(sceneId, options) {
  let scene;
  try {
    scene = loadScene(sceneId);
  } catch {
    console.error(chalk.red(`\n✖ 场景 "${sceneId}" 未找到`));
    process.exit(1);
  }

  const context = buildSceneContext(options);

  await resolveTargetPath(options, context);

  context._sceneId = sceneId;
  // 工作区可能有未提交改动；拍快照后 CodeGuardian 只量本次运行新增的部分。
  if (!options.dryRun) {
    context.codeguardianBaseline = captureBoundaryBaseline(context.targetPath);
  }
  initLog(sceneId);
  await applyEnhancements(sceneId, context, options);

  if (options.theme) {
    console.log(chalk.green(`\n✅ 已选择主题：${THEME_NAMES[options.theme] || options.theme}\n`));
  }

  if (options.dryRun) {
    console.log(chalk.cyan('🔍 试运行模式 — 仅预览不执行'));
  }

  await runIterations(sceneId, scene, context, options);

  if (options.dryRun && context._unjudgedConditions > 0) {
    console.log(chalk.yellow(`\n⚠ ${context._unjudgedConditions} 个条件在试运行下无法判定（依赖运行时状态），真实执行结果可能不同。`));
  }
  // Post-execution: auto-save workflow context to memory (unless explicitly saved)
  if (!options.dryRun) {
    context._sceneId = sceneId;
    await executeAction(sceneId, 'autoRemember', {}, context, context.targetPath || PROJECT_ROOT);
    enforceAcceptanceGate(scene, context, sceneId);
    printSummary(sceneId, context);
  }
}
