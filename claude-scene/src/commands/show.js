import { readFileSync } from 'fs';
import chalk from 'chalk';
import { resolveScenePath, describePaths } from '../lib/paths.js';

function printTriggerKeywords(scene) {
  if (!scene.trigger_keywords?.length) return;
}

function printSemanticTrigger(scene) {
  if (!scene.trigger_semantic) return;
}

function printPriority(scene) {
  if (!scene.priority) return;
}

function printWorkflow(scene) {
  if (!scene.workflow) return;
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
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    printStepDetail(step);
  }
}

function printMCPServers(scene) {
  if (!scene.mcp_servers?.length) return;
}

function printGuardrails(scene) {
  const guards = scene.guardrails;
  if (!guards || Object.keys(guards).length === 0) return;
  for (const [key, value] of Object.entries(guards)) {
    console.log(`   ${key}: ${value}`);
  }
}

export async function showScene(sceneId) {
  const filePath = resolveScenePath(sceneId);
  let scene;
  try {
    if (!filePath) throw new Error('not found');
    const raw = readFileSync(filePath, 'utf-8');
    scene = JSON.parse(raw);
  } catch {
    console.error(chalk.red(`\n✖ 场景 "${sceneId}" 未找到`));
    console.error(chalk.gray('已搜索:'));
    for (const d of describePaths().sceneDirs) console.error(chalk.gray(`  - ${d}`));
    process.exit(1);
  }

  printTriggerKeywords(scene);
  printSemanticTrigger(scene);
  printPriority(scene);
  printWorkflow(scene);

  const steps = scene.flow || scene.steps || [];
  printSteps(steps);

  printMCPServers(scene);
  printGuardrails(scene);
}