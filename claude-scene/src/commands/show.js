import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { SCENES_DIR } from '../lib/paths.js';
const LAYER_ICONS = {
  capability: '⚙️',
  interactive: '💬',
  runtime: '🚀',
};
// eslint-disable-next-line sonarjs/cognitive-complexity
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

  if (scene.trigger_keywords && scene.trigger_keywords.length > 0) {
    console.log(chalk.bold('🔑 触发关键词:'));
    console.log(`   ${scene.trigger_keywords.join(', ')}`);
    console.log('');
  }
  if (scene.trigger_semantic) {
    console.log(chalk.bold('🧠 语义触发:'));
    console.log(`   ${scene.trigger_semantic}`);
    console.log('');
  }
  if (scene.priority) {
    console.log(chalk.bold('⭐ 优先级:'));
    console.log(`   ${scene.priority}`);
    console.log('');
  }
  if (scene.workflow) {
    console.log(chalk.bold('⚙️  工作流:'));
    console.log(`   ${scene.workflow}.yaml`);
    console.log('');
  }

  const steps = scene.flow || scene.steps || [];
  if (steps.length > 0) {
    console.log(chalk.bold(`📝 步骤 (${steps.length} 个):`));
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const idx = chalk.yellow(`${i + 1}`.padStart(2));
      const stepId = step.id || `step-${i}`;
      const stepDesc = step.description || step.prompt || '';
      const layerIcon = LAYER_ICONS[step.layer] || '';
      const autoBadge = step.auto_execute ? chalk.green('[自动]') : chalk.yellow('[需确认]');

      let line = `   ${idx}. ${stepId}`;
      if (layerIcon) line += ` ${layerIcon}`;
      line += ` ${autoBadge}`;
      console.log(line);

      if (stepDesc && stepDesc.length < 80) {
        console.log(`       ${chalk.dim(stepDesc)}`);
      }
      if (step.condition) {
        console.log(`       ${chalk.gray('条件:')} ${step.condition}`);
      }
      if (step.confirm_message) {
        console.log(`       ${chalk.gray('确认:')} ${step.confirm_message}`);
      }
      if (step.depends_on && step.depends_on.length > 0) {
        console.log(`       ${chalk.gray('依赖:')} ${step.depends_on.join(', ')}`);
      }
    }
    console.log('');
  }

  if (scene.mcp_servers && scene.mcp_servers.length > 0) {
    console.log(chalk.bold('🔌 MCP 服务:'));
    console.log(`   ${scene.mcp_servers.join(', ')}`);
    console.log('');
  }

  if (scene.guardrails && Object.keys(scene.guardrails).length > 0) {
    console.log(chalk.bold('🛡️  Guardrails:'));
    for (const [key, value] of Object.entries(scene.guardrails)) {
      console.log(`   ${key}: ${value}`);
    }
    console.log('');
  }
}