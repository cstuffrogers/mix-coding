#!/usr/bin/env node
import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { evaluateCondition } from '../lib/conditions.js';
import { resolveParams } from '../lib/template.js';
import { executeAction } from '../actions.js';
import { executeUIPolish } from '../handlers/ui-polish.js';
import { applyEnhancements } from '../lib/enhancements.js';
import { PROJECT_ROOT, resolveScenePath, describePaths } from '../lib/paths.js';
import { detectHandlerFailure } from '../lib/failure-detection.js';
import { checkAcceptance } from '../lib/acceptance-check.js';

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
let LOG_RUN_ID = null;
let LOG_SUMMARY = { total: 0, pass: 0, fail: 0, skip: 0, noop: 0, warn: 0 };

function initLog(sceneId) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  LOG_RUN_ID = `${ts}-${randomBytes(3).toString('hex')}`;
  const logDir = join(PROJECT_ROOT, '.claude', 'logs');
  mkdirSync(logDir, { recursive: true });
  LOG_PATH = join(logDir, `workflow-${sceneId}-${ts}-${LOG_RUN_ID.slice(-6)}.log`);
  LOG_SUMMARY = { total: 0, pass: 0, fail: 0, skip: 0, noop: 0, warn: 0 };
  const header = JSON.stringify({ event: 'start', scene: sceneId, run_id: LOG_RUN_ID, time: new Date().toISOString() });
  appendFileSync(LOG_PATH, header + '\n');
}

function appendLog(entry) {
  if (!LOG_PATH) return;
  appendFileSync(LOG_PATH, JSON.stringify({ run_id: LOG_RUN_ID, ...entry }) + '\n');
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
// eslint-disable-next-line sonarjs/super-linear-regex
const WARN_RES = [/\d+\s*[个处类].{0,30}?(?:问题|漏洞|警告|气味|发现|重复)/i, /\d+\s*(?:failed|failure)/i];

function formatResultForDisplay(result) {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    if (typeof result.message === 'string') return result.message;
    return `步骤已完成（状态：${result.status ?? 'success'}）`;
  }
  return String(result);
}

function deriveStepStatus(result, context) {
  if (!context.lastStepFailed && detectHandlerFailure(result)) {
    context.lastStepFailed = true;
  }
  const resultStr = typeof result === 'string' ? result : '';
  const isNoop = !context.lastStepFailed && NOOP_RES.some(re => re.test(resultStr));
  const isWarn = !context.lastStepFailed && !isNoop && WARN_RES.some(re => re.test(resultStr));
  return { resultStr, stepStatus: context.lastStepFailed ? 'fail' : (isNoop ? 'noop' : (isWarn ? 'warn' : 'pass')) };
}

function recordStepResult(step, stepNum, status, duration, resultStr, context) {
  LOG_SUMMARY.total++;
  switch (status) {
    case 'fail': LOG_SUMMARY.fail++; break;
    case 'noop': LOG_SUMMARY.noop++; break;
    case 'warn': LOG_SUMMARY.warn++; break;
    default: LOG_SUMMARY.pass++; break;
  }
  appendLog({ step: stepNum, action: step.action, status, duration_ms: duration, result: resultStr.slice(0, 200), time: new Date().toISOString() });
  // Track per-step { action, status } for the acceptance reviewed-check gate.
  if (!Array.isArray(context.stepResults)) context.stepResults = [];
  context.stepResults.push({ action: step.action, status });
}

async function runStep(sceneId, step, context, options) {
  const stepNum = step.step;

  if (step.condition && !evaluateCondition(step.condition, context)) {
    console.log(chalk.gray(`  ⏭ 跳过 Step ${stepNum}: ${step.description || step.action}（条件不满足）`));
    LOG_SUMMARY.total++; LOG_SUMMARY.skip++;
    appendLog({ step: stepNum, action: step.action, status: 'skip', reason: 'condition', time: new Date().toISOString() });
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

  spinner.succeed(chalk.green(formatResultForDisplay(result)));

  applyPostStepContext(step, context, sceneId);

  await handleStepError(step, context, sceneId, resolvedParams);

  if (step.action.includes('deploy') && result.includes('部署')) {
    console.log(chalk.yellow('⚠️  部署步骤已完成，请手动验证部署结果'));
  }

  context.completedSteps.push(stepNum);
}

function buildSceneContext(options) {
  const prompt = options.prompt || '';
  return {
    prompt,
    completedSteps: [],
    targetPath: options.target || '',
    selectedTheme: options.theme || '',
    securityScanResult: {},
    selectedOption: options.option || '',
    refactor_points: [],
    database_required: /数据库|database|db|存储|数据|postgres|mysql|supabase|mongo/i.test(prompt),
    payment_required: /支付|付款|payment|stripe|订阅|billing/i.test(prompt),
    email_required: /邮件|email|邮箱|通知|发送|resend/i.test(prompt),
  };
}

function previewDryRunStep(step, context) {
  const icon = LAYER_ICONS[step.layer] || '📦';
  const stepIcon = step.auto_execute === false ? '⏸' : '▶';
  const autoLabel = step.auto_execute === false ? '需确认' : '自动';
  const desc = step.description || step.action;
  console.log(chalk.dim(`  ${stepIcon} Step ${step.step} [${autoLabel}] ${icon}`));
  console.log(chalk.gray(`     └─ ${desc}`));
  if (step.condition) {
    const condMet = evaluateCondition(step.condition, context);
    console.log(chalk.gray(`     └─ 条件 [${step.condition}]: ${condMet ? chalk.green('满足') : chalk.red('跳过')}`));
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
  initLog(sceneId);
  await applyEnhancements(sceneId, context, options);

  if (options.theme) {
    console.log(chalk.green(`\n✅ 已选择主题：${THEME_NAMES[options.theme] || options.theme}\n`));
  }

  if (options.dryRun) {
    console.log(chalk.cyan('🔍 试运行模式 — 仅预览不执行'));
  }

  for (const step of scene.flow) {
    if (options.dryRun) {
      previewDryRunStep(step, context);
      continue;
    }
    await runStep(sceneId, step, context, options);
  }

  // Post-execution: auto-save workflow context to memory (unless explicitly saved)
  if (!options.dryRun) {
    context._sceneId = sceneId;
    await executeAction(sceneId, 'autoRemember', {}, context, context.targetPath || PROJECT_ROOT);
    enforceAcceptanceGate(scene, context, sceneId);
    printSummary(sceneId);
  }
}
