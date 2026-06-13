import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { SCENES_DIR } from '../lib/paths.js';

const LAYER_ICONS = {
  capability: '⚙️',
  interactive: '💬',
  runtime: '🚀',
};

function printTriggerKeywords(scene) {
  if (!scene.trigger_keywords?.length) return;
  console.log(chalk.bold('🔑 触发关键词:'));
  console.log(`   ${scene.trigger_keywords.join(', ')}`);
  console.log('');
}

function printSemanticTrigger(scene) {
  if (!scene.trigger_semantic) return;
  console.log(chalk.bold('🧠 语义触发:'));
  console.log(`   ${scene.trigger_semantic}`);
  console.log('');
}

function printPriority(scene) {
  if (!scene.priority) return;
  console.log(chalk.bold('⭐ 优先级:'));
  console.log(`   ${scene.priority}`);
  console.log('');
}

function printWorkflow(scene) {
  if (!scene.workflow) return;
  console.log(chalk.bold('⚙️  工作流:'));
  console.log(`   ${scene.workflow}.yaml`);
  console.log('');
}

function printStepDetail(step) {
  const desc = step.description || step.prompt || '';
  if (desc && desc.length < 80) {
    console.log(`       ${chalk.dim(desc)}`);
  }
  if (step.condition) {
    console.log(`       ${chalk.gray('条件:')} ${step.condition}`);
  }
  if (step.confirm_message) {
    console.log(`       ${chalk.gray('确认:')} ${step.confirm_message}`);
  }
  if (step.depends_on?.length > 0) {
    console.log(`       ${chalk.gray('依赖:')} ${step.depends_on.join(', ')}`);
  }
}

function printSteps(steps) {
  if (steps.length === 0) return;
  console.log(chalk.bold(`📝 步骤 (${steps.length} 个):`));
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const idx = chalk.yellow(`${i + 1}`.padStart(2));
    const stepId = step.id || `step-${i}`;
    const layerIcon = LAYER_ICONS[step.layer] || '';
    const autoBadge = step.auto_execute ? chalk.green('[自动]') : chalk.yellow('[需确认]');

    let line = `   ${idx}. ${stepId}`;
    if (layerIcon) line += ` ${layerIcon}`;
    line += ` ${autoBadge}`;
    console.log(line);
    printStepDetail(step);
  }
  console.log('');
}

function printMCPServers(scene) {
  if (!scene.mcp_servers?.length) return;
  console.log(chalk.bold('🔌 MCP 服务:'));
  console.log(`   ${scene.mcp_servers.join(', ')}`);
  console.log('');
}

function printGuardrails(scene) {
  const guards = scene.guardrails;
  if (!guards || Object.keys(guards).length === 0) return;
  console.log(chalk.bold('🛡️  Guardrails:'));
  for (const [key, value] of Object.entries(guards)) {
    console.log(`   ${key}: ${value}`);
  }
  console.log('');
}

export async function showScene(sceneId) {
  const filePath = join(SCENES_DIR, `${sceneId}.json`);
  let scene;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    scene = JSON.parse(raw);
  } catch {
    console.error(chalk.red(`\n✖ 场景 "${sceneId}" 未找到`));
    process.exit(1);
  }

  const name = scene.name || sceneId;
  const desc = scene.description || '';

  console.log(chalk.bold.cyan(`\n📋 场景: ${name}`));
  console.log(chalk.gray(`   ID: ${sceneId}`));
  if (desc) console.log(chalk.dim(`   ${desc}`));
  console.log('');

  printTriggerKeywords(scene);
  printSemanticTrigger(scene);
  printPriority(scene);
  printWorkflow(scene);

  const steps = scene.flow || scene.steps || [];
  printSteps(steps);

  printMCPServers(scene);
  printGuardrails(scene);
}