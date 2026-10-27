#!/usr/bin/env node
import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { evaluateCondition, explainCondition } from '../lib/conditions.js';
import { resolveParams } from '../lib/template.js';
import { executeAction } from '../actions.js';
import { executeUIPolish } from '../handlers/ui-polish.js';
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
  'liquid-glass': 'Liquid Glass（Apple 液态玻璃效果）',
};

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
      choices: [
        { name: '1. DaisyUI（35+专业主题）', value: 'daisyui' },
        { name: '2. Animal Island UI（自然、圆润风格）', value: 'animal-island' },
        { name: '3. Custom（自定义颜色）', value: 'custom' },
        { name: '4. Huashu 40 风格库', value: 'huashu' },
        { name: '5. Awesome Design MD 品牌', value: 'awm-brand' },
        { name: '6. Liquid Glass（Apple 液态玻璃效果，liquid-glass-react）', value: 'liquid-glass' },
      ],
    }]);
    context.selectedTheme = answers.theme;

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

function setContextFlag(step, context, options) {
  // Prefer structured context_flag param; fall back to description sniffing
  const flag = step.params?.context_flag;
  if (flag) {
    context[flag] = !options.auto ? context._confirmAnswer : true;
    console.log(chalk[context[flag] ? 'green' : 'gray'](`\n${context[flag] ? '✅ 已启用' : '⏭ 跳过'} ${flag}`));
    return true;
  }

  const stepDesc = step.description?.toLowerCase() || '';
  const enabled = !options.auto ? context._confirmAnswer : true;
  return applyDescriptionFlag(stepDesc, enabled, context);
}

async function handleConfirmDialog(step, options, context) {
  if (step.params?.type !== 'confirm' || !step.params?.prompt) return false;

  if (!options.auto) {
    const answers = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: step.params.prompt, default: step.params.default || false },
    ]);
    context._confirmAnswer = answers.confirm;
    setContextFlag(step, context, options);
  } else {
    setContextFlag(step, context, options);
  }
  return true;
}

async function handleOptionSelection(step, options, context, sceneId) {
  if (!step.params?.options || options.auto) return handleModeSelection(step, options, context);

  const choices = step.params.options.map(opt => {
    if (typeof opt === 'object' && opt.label) {
      return { name: opt.label, value: opt.label };
    }
    return { name: opt, value: opt };
  });
  const answers = await inquirer.prompt([{
    type: 'list', name: 'selectedOption', message: step.description || '请选择：',
    choices,
  }]);
  context.selectedOption = answers.selectedOption;
  if (sceneId === 'design') {
    context.design_selected = answers.selectedOption;
  }
  console.log(chalk.green(`\n✅ 已选择：${answers.selectedOption}\n`));
  return true;
}

async function handleModeSelection(step, options, context) {
  if (step.action !== 'selectModes' || !Array.isArray(step.params?.options)) return false;

  const withDefaults = step.params.options.map(o =>
    typeof o === 'string' ? { id: o, label: o, default: false } : o,
  );

  if (options.auto) {
    context.selected_modes = withDefaults.filter(o => o.default).map(o => o.id);
    return true;
  }

  const answers = await inquirer.prompt([{
    type: 'checkbox',
    name: 'modes',
    message: step.params.prompt || step.description || '请选择：',
    choices: withDefaults.map(o => ({ name: o.label, value: o.id, checked: !!o.default })),
  }]);
  context.selected_modes = answers.modes.length > 0
    ? answers.modes
    : withDefaults.filter(o => o.default).map(o => o.id);
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
  const fallback = opts.find(o => o.default) ?? opts[0];

  // CLI 覆盖（--kind monitor）优先于默认值：pi 里的 agent 是非交互的，
  // 没有这条就只能永远拿到 default 那一支。
  const override = resolveChoiceOverride(step, options.kind);
  if (override.warning) {
    console.log(chalk.yellow(`  ⚠ ${override.warning}（改用默认 ${fallback?.id}）`));
  }
  if (override.id) {
    context[contextKey] = override.id;
    console.log(chalk.green(`
✅ 已选择：${override.id}
`));
    return true;
  }

  if (options.auto) {
    context[contextKey] = fallback?.id;
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

function printSummary(sceneId) {
  console.log(chalk.dim(`\n${'─'.repeat(40)}`));
  const { pass, fail, skip, noop, warn } = LOG_SUMMARY;
  const failIcon = fail > 0 ? chalk.red(`  ✗ fail: ${fail}`) : chalk.green('  ✗ fail: 0');
  const warnIcon = warn > 0 ? chalk.yellow(`  ⚡ warn: ${warn}`) : chalk.green('  ⚡ warn: 0');
  const noopIcon = noop > 0 ? chalk.yellow(`  ⚠ noop: ${noop}`) : chalk.green('  ⚠ noop: 0');
  console.log(chalk.cyan(`  Scene: ${sceneId}  `) + chalk.green(`✓ pass: ${pass}  `) + failIcon + warnIcon + chalk.gray(`  ⏭ skip: ${skip}  `) + noopIcon);
  if (fail > 0 || noop > 0 || warn > 0) {
    console.log(chalk.dim(`  日志: ${LOG_PATH}`));
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
  if (!context.lastStepFailed || !step.on_error) return;

  if (step.on_error === 'abort') {
    console.log(chalk.red(`\n✖ Step ${step.step} 失败（on_error=abort），工作流中止`));
    printSummary(sceneId);
    process.exit(1);
  }
  if (step.on_error === 'fail_workflow') {
    console.log(chalk.red(`\n✖ Step ${step.step} 失败（on_error=fail_workflow），安全阻断，工作流中止`));
    printSummary(sceneId);
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
      printSummary(sceneId);
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

/** 处理确认型步骤；返回 true 表示已完全处理，调用方应提前返回 */
async function handleConfirmation(step, options, context) {
  const isConfirmationStep = step.action === 'confirm' || !!step.confirm_message;
  const confirmMsg = isConfirmationStep ? (step.confirm_message || step.params?.message) : null;
  if (!confirmMsg) return false;

  if (options.auto) {
    context.user_confirmed = true;
    return step.action === 'confirm';
  }

  const answers = await inquirer.prompt([
    { type: 'confirm', name: 'proceed', message: confirmMsg, default: true },
  ]);
  context.user_confirmed = answers.proceed;
  if (!answers.proceed) {
    console.log(chalk.yellow(`  ⏭ 用户跳过 Step ${step.step}`));
    LOG_SUMMARY.total++;
    LOG_SUMMARY.skip++;
    appendLog({ step: step.step, action: step.action, status: 'skip', reason: 'user', time: new Date().toISOString() });
    return true;
  }
  return step.action === 'confirm';
}

// Runs the interactive (auto_execute === false) phase of a step.
// Returns true when the step was fully handled and runStep should return early.
async function handleInteractiveStep(sceneId, step, context, options) {
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
// eslint-disable-next-line sonarjs/super-linear-regex
const NOOP_RES = [/不可用/i, /无[^]*?[目录配置]/, /未安装/, /未找到/, /not found/i, /not available/i, /已?跳过/, /no\s+.*?found/i];
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
  const isNoop = NOOP_RES.some(re => re.test(resultStr));
  const isWarn = !isNoop && hasWarnResult(resultStr);
  return { resultStr, stepStatus: isNoop ? 'noop' : (isWarn ? 'warn' : 'pass') };
}

const EXPLICIT_STATUSES = new Set(['pass', 'fail', 'skip', 'noop', 'warn']);

/** 处理器返回 { status, message } 时以 status 为准（不再被正则误判为 pass）。 */
function getExplicitStatus(result) {
  if (!result || typeof result !== 'object') return null;
  return EXPLICIT_STATUSES.has(result.status) ? result.status : null;
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
  if (!Array.isArray(context.stepResults)) context.stepResults = [];
  context.stepResults.push({ action: step.action, status });
}

async function runStep(sceneId, step, context, options) {
  const stepNum = step.step;

  if (step.condition && !evaluateCondition(step.condition, context)) {
    const { unknown } = explainCondition(step.condition, context);
    if (unknown.length > 0) {
      // 试运行不执行步骤，这些键要等前面的步骤跑完才有 —— 不能报「条件不满足」。
      console.log(chalk.gray(`  ❓ 未判定 Step ${stepNum}: ${step.description || step.action}（依赖运行时状态：${unknown.join(', ')}）`));
      context._unjudgedConditions = (context._unjudgedConditions || 0) + 1;
    } else {
      console.log(chalk.gray(`  ⏭ 跳过 Step ${stepNum}: ${step.description || step.action}（条件不满足）`));
    }
    LOG_SUMMARY.total++; LOG_SUMMARY.skip++;
    appendLog({ step: stepNum, action: step.action, status: 'skip', reason: unknown.length > 0 ? 'unjudged' : 'condition', time: new Date().toISOString() });
    return;
  }

  if (await handleInteractiveStep(sceneId, step, context, options)) return;

  const spinner = ora({ text: `执行中: ${step.action}...`, color: 'cyan' }).start();
  const resolvedParams = resolveParams(step.params, context);
  context.lastStepFailed = false;

  const stepStart = Date.now();
  const result = await dispatchAction(sceneId, step.action, resolvedParams, context);
  const duration = Date.now() - stepStart;

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
    printSummary(sceneId);
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

function buildSceneContext(options) {
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
    // --with-sweep：让 detectorReport 步骤在审查开始前现场跑一次自检
    withSweep: Boolean(options.withSweep),
  };
}

function previewDryRunStep(step, context, options = {}) {
  const icon = LAYER_ICONS[step.layer] || '📦';
  const stepIcon = step.auto_execute === false ? '⏸' : '▶';
  const autoLabel = step.auto_execute === false ? '需确认' : '自动';
  const desc = step.description || step.action;
  console.log(chalk.dim(`  ${stepIcon} Step ${step.step} [${autoLabel}] ${icon}`));
  console.log(chalk.gray(`     └─ ${desc}`));
  if (step.condition) {
    const { met, unknown } = explainCondition(step.condition, context);
    const verdict = met
      ? chalk.green('满足')
      : (unknown.length > 0
        ? chalk.yellow(`未判定（运行时状态：${unknown.join(', ')}）`)
        : chalk.red('不满足'));
    console.log(chalk.gray(`     └─ 条件 [${step.condition}]: ${verdict}`));
    if (!met && unknown.length > 0) context._unjudgedConditions = (context._unjudgedConditions || 0) + 1;
  }
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
    printSummary(sceneId);
    process.exit(1);
  }
  if (acceptance.unreviewedChange) {
    console.log(chalk.red('  ✖ 验收阻断：本次工作流有变更，但验证类步骤未通过（全部 fail/noop/skip）。'));
    console.log(chalk.red('    交付前必须让验证步骤 pass 或 warn（通过带发现），并报告「变更 + 验证命令 + 验证结果」三元组。'));
    printSummary(sceneId);
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
      previewDryRunStep(step, context, options);
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
    printSummary(sceneId);
  }
}
