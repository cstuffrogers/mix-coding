#!/usr/bin/env node
import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { evaluateCondition } from '../lib/conditions.js';
import { resolveParams } from '../lib/template.js';
import { executeAction } from '../actions.js';
import { executeUIPolish } from '../handlers/ui-polish.js';
import { applyEnhancements } from '../lib/enhancements.js';
import { SCENES_DIR, PROJECT_ROOT } from '../lib/paths.js';

const LAYER_ICONS = {
  interactive: '💬',
  capability: '⚙️',
  runtime: '🚀',
};

const THEME_NAMES = {
  daisyui: 'DaisyUI',
  'animal-island': 'Animal Island UI',
  custom: 'Custom',
};

// ── Execution logging ──

let LOG_PATH = null;
let LOG_SUMMARY = { total: 0, pass: 0, fail: 0, skip: 0, noop: 0, warn: 0 };

function initLog(sceneId) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const logDir = join(PROJECT_ROOT, '.claude', 'logs');
  mkdirSync(logDir, { recursive: true });
  LOG_PATH = join(logDir, `workflow-${sceneId}-${ts}.log`);
  LOG_SUMMARY = { total: 0, pass: 0, fail: 0, skip: 0, noop: 0, warn: 0 };
  const header = JSON.stringify({ event: 'start', scene: sceneId, time: new Date().toISOString() });
  appendFileSync(LOG_PATH, header + '\n');
}

function appendLog(entry) {
  if (!LOG_PATH) return;
  appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
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

// eslint-disable-next-line sonarjs/cognitive-complexity
function setContextFlag(step, context, options) {
  // Prefer structured context_flag param; fall back to description sniffing
  const flag = step.params?.context_flag;
  if (flag) {
    context[flag] = !options.auto ? context._confirmAnswer : true;
    console.log(chalk[context[flag] ? 'green' : 'gray'](`\n${context[flag] ? '✅ 已启用' : '⏭ 跳过'} ${flag}`));
    return true;
  }

  const stepDesc = step.description?.toLowerCase() || '';
  const isDesign = stepDesc.includes('open design') || stepDesc.includes('ui');
  const isRefactor = stepDesc.includes('重构') || stepDesc.includes('refactor');

  if (!isDesign && !isRefactor) return false;

  const enabled = !options.auto
    ? context._confirmAnswer
    : true;

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
  if (!step.params?.options || options.auto) return false;

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
  const { total, pass, fail, skip, noop, warn } = LOG_SUMMARY;
  const failIcon = fail > 0 ? chalk.red(`  ✗ fail: ${fail}`) : chalk.green('  ✗ fail: 0');
  const warnIcon = warn > 0 ? chalk.yellow(`  ⚡ warn: ${warn}`) : chalk.green('  ⚡ warn: 0');
  const noopIcon = noop > 0 ? chalk.yellow(`  ⚠ noop: ${noop}`) : chalk.green('  ⚠ noop: 0');
  console.log(chalk.cyan(`  Scene: ${sceneId}  `) + chalk.green(`✓ pass: ${pass}  `) + failIcon + warnIcon + chalk.gray(`  ⏭ skip: ${skip}  `) + noopIcon);
  if (fail > 0 || noop > 0 || warn > 0) {
    console.log(chalk.dim(`  日志: ${LOG_PATH}`));
  }
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

async function resolveTargetPath(options, context) {
  const sanitizePath = (p) => p.replace(/["$`]/g, '');

  if (options.target) {
    context.targetPath = sanitizePath(options.target);
    console.log(chalk.cyan(`\n📁 目标项目：${context.targetPath}\n`));
  } else if (options.auto) {
    context.targetPath = sanitizePath(process.cwd());
    console.log(chalk.cyan(`\n📁 目标项目：${context.targetPath}\n`));
  } else {
    try {
      const { targetPath } = await inquirer.prompt([{
        type: 'input', name: 'targetPath',
        message: '请输入目标项目路径（或拖拽文件夹到此处）：',
        default: process.cwd(),
      }]);
      context.targetPath = sanitizePath(targetPath);
      console.log(chalk.cyan(`\n📁 目标项目：${targetPath}\n`));
    } catch {
      console.log(chalk.dim('  交互模式不可用，使用当前目录'));
      context.targetPath = process.cwd();
    }
  }
}

// ── Main exported functions ──

function loadScene(sceneId) {
  const filePath = join(SCENES_DIR, `${sceneId}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function runStep(sceneId, step, context, options) {
  const stepNum = step.step;

  if (step.condition && !evaluateCondition(step.condition, context)) {
    console.log(chalk.gray(`  ⏭ 跳过 Step ${stepNum}: ${step.description || step.action}（条件不满足）`));
    LOG_SUMMARY.total++; LOG_SUMMARY.skip++;
    appendLog({ step: stepNum, action: step.action, status: 'skip', reason: 'condition', time: new Date().toISOString() });
    return;
  }

  if (step.auto_execute === false) {
    if (await handleThemeSelection(step, options, context)) return;

    if (await handleAwmBrandSelection(step, options, context)) return;

    if (await handleConfirmDialog(step, options, context)) return;

    const isConfirmationStep = step.action === 'confirm' || !!step.confirm_message;
    const confirmMsg = isConfirmationStep ? (step.confirm_message || step.params?.message) : null;
    if (confirmMsg) {
      if (!options.auto) {
        const answers = await inquirer.prompt([
          { type: 'confirm', name: 'proceed', message: confirmMsg, default: true },
        ]);
        context.user_confirmed = answers.proceed;
        if (!answers.proceed) {
          console.log(chalk.yellow(`  ⏭ 用户跳过 Step ${stepNum}`));
          LOG_SUMMARY.total++; LOG_SUMMARY.skip++;
          appendLog({ step: stepNum, action: step.action, status: 'skip', reason: 'user', time: new Date().toISOString() });
          return;
        }
      } else {
        context.user_confirmed = true;
      }
      if (step.action === 'confirm') return;
    }

    if (await handleOptionSelection(step, options, context, sceneId)) return;
  }

  const spinner = ora({ text: `执行中: ${step.action}...`, color: 'cyan' }).start();
  const resolvedParams = resolveParams(step.params, context);
  context.lastStepFailed = false;

  const stepStart = Date.now();
  const result = await dispatchAction(sceneId, step.action, resolvedParams, context);
  const duration = Date.now() - stepStart;

  // Auto-detect failure from result string when handler forgot to set lastStepFailed.
  // Only flags unambiguous failures, not partial/expected ones.
  if (!context.lastStepFailed && typeof result === 'string') {
    const isFailure = /(失败|阻断|abort|FAIL)/i.test(result) &&
                      !/(部分|跳过|继续|非致命|fallback|降级|通知已发送|已保存|已记录|已?通知)/i.test(result);
    if (isFailure) context.lastStepFailed = true;
  }

  // Auto-detect no-op steps: tool unavailable / nothing to check / config missing
  const resultStr = typeof result === 'string' ? result : '';
  const isNoop = !context.lastStepFailed &&
    /(不可用|无.*?[目录配置文件]|未安装|未找到|not found|not available|已?跳过|no .*?found)/i.test(resultStr);

  // Auto-detect warn: passes but result indicates non-zero issues (aislop findings, vulnerabilities, etc.)
  const isWarn = !context.lastStepFailed && !isNoop &&
    /[1-9]\d*\s*([个处类].{0,30}?(问题|漏洞|警告|气味|发现|重复)|failed|failures?)/i.test(resultStr);

  LOG_SUMMARY.total++;
  const stepStatus = context.lastStepFailed ? 'fail' : (isNoop ? 'noop' : (isWarn ? 'warn' : 'pass'));
  if (context.lastStepFailed) LOG_SUMMARY.fail++;
  else if (isNoop) LOG_SUMMARY.noop++;
  else if (isWarn) LOG_SUMMARY.warn++;
  else LOG_SUMMARY.pass++;
  appendLog({ step: stepNum, action: step.action, status: stepStatus, duration_ms: duration, result: resultStr.slice(0, 200), time: new Date().toISOString() });

  spinner.succeed(chalk.green(result));

  applyPostStepContext(step, context, sceneId);

  await handleStepError(step, context, sceneId, resolvedParams);

  if (step.action.includes('deploy') && result.includes('部署')) {
    console.log(chalk.yellow('⚠️  部署步骤已完成，请手动验证部署结果'));
  }

  context.completedSteps.push(stepNum);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function startScene(sceneId, options) {
  let scene;
  try {
    scene = loadScene(sceneId);
  } catch {
    console.error(chalk.red(`\n✖ 场景 "${sceneId}" 未找到`));
    process.exit(1);
  }

  const context = {
    prompt: options.prompt || '',
    completedSteps: [],
    targetPath: options.target || '',
    selectedTheme: options.theme || '',
    securityScanResult: {},
    selectedOption: options.option || '',
    refactor_points: [],
    database_required: /数据库|database|db|存储|数据|postgres|mysql|supabase|mongo/i.test(options.prompt || ''),
    payment_required: /支付|付款|payment|stripe|订阅|billing/i.test(options.prompt || ''),
    email_required: /邮件|email|邮箱|通知|发送|resend/i.test(options.prompt || ''),
  };

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
      continue;
    }
    await runStep(sceneId, step, context, options);
  }

  // Post-execution: auto-save workflow context to memory (unless explicitly saved)
  if (!options.dryRun) {
    context._sceneId = sceneId;
    await executeAction(sceneId, 'autoRemember', {}, context, context.targetPath || PROJECT_ROOT);

    // Print execution summary
    printSummary(sceneId);
  }
}
