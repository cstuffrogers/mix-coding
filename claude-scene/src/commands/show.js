import { readFileSync } from 'fs';
import chalk from 'chalk';
import { resolveScenePath, describePaths } from '../lib/paths.js';

// 以前这些函数只写了 `if (!x) return;` 就结束 —— 场景的触发词、语义触发、优先级、
// 工作流名、MCP 依赖全被静默吞掉，`show` 只剩一串没有编号的描述。
function printHeader(scene) {
  const name = scene.name || scene.scene_id;
  console.log(`\n${chalk.bold(`📋 ${scene.scene_id}`)}${name && name !== scene.scene_id ? chalk.gray(` — ${name}`) : ''}`);
  if (scene.description) console.log(`   ${chalk.gray(scene.description)}`);
  const meta = [];
  if (scene.iterations) meta.push(`默认迭代: ${scene.iterations} 轮`);
  if (scene.status) meta.push(`状态: ${scene.status}`);
  if (meta.length > 0) console.log(`   ${chalk.gray(meta.join(' · '))}`);
}

function printTriggerKeywords(scene) {
  if (!scene.trigger_keywords?.length) return;
  console.log(`   ${chalk.gray('触发关键词:')} ${scene.trigger_keywords.join(', ')}`);
}

function printSemanticTrigger(scene) {
  if (!scene.trigger_semantic) return;
  const semantic = typeof scene.trigger_semantic === 'string'
    ? scene.trigger_semantic
    : JSON.stringify(scene.trigger_semantic);
  console.log(`   ${chalk.gray('语义触发:')} ${semantic}`);
}

function printPriority(scene) {
  if (scene.priority) console.log(`   ${chalk.gray('优先级:')} ${scene.priority}`);
}

function printWorkflow(scene) {
  if (!scene.workflow) return;
  const parts = [`工作流: ${scene.workflow}`];
  if (Array.isArray(scene.phases) && scene.phases.length > 0) parts.push(`阶段: ${scene.phases.length}`);
  console.log(`   ${chalk.gray(parts.join(' · '))}`);
}

function printConditionFlags(step) {
  const lines = [];
  if (step.condition) lines.push(`${chalk.gray('条件:')} ${step.condition}`);
  if (step.skip_if) lines.push(`${chalk.gray('跳过若:')} ${step.skip_if}`);
  if (step.confirm_message) lines.push(`${chalk.gray('确认:')} ${step.confirm_message}`);
  if (step.depends_on?.length > 0) lines.push(`${chalk.gray('依赖:')} ${step.depends_on.join(', ')}`);
  return lines;
}

function printStepDetail(step) {
  const desc = step.description || step.prompt || '';
  if (desc) {
    const short = desc.length > 100 ? `${desc.slice(0, 100)}…` : desc;
    console.log(`       ${chalk.dim(short)}`);
  }
  for (const line of printConditionFlags(step)) console.log(`       ${line}`);
  if (step.params && Object.keys(step.params).length > 0) {
    console.log(`       ${chalk.gray('参数:')} ${JSON.stringify(step.params)}`);
  }
}

function printLine(step, marker) {
  const id = step.step ?? step.id ?? '?';
  const layer = step.layer ? chalk.gray(`[${step.layer}]`) : '';
  const action = step.action ? chalk.cyan(step.action) : chalk.gray('(无 action)');
  console.log(`${marker} ${chalk.bold(`▶ ${id}`)} ${layer} ${action}`);
  printStepDetail(step);
  for (const sub of Array.isArray(step.steps) ? step.steps : []) {
    // 子步骤：缩进展示，避免 show 把层级结构压平
    const subId = sub.step ?? sub.id ?? '?';
    console.log(`     ${chalk.bold(`↳ ${subId}`)} ${sub.action ? chalk.cyan(sub.action) : ''}`);
    printStepDetail(sub);
  }
}

function printSteps(steps) {
  if (steps.length === 0) {
    console.log(`   ${chalk.yellow('（该场景没有步骤）')}`);
    return;
  }
  for (const step of steps) printLine(step, '  ');
}

function printMCPServers(scene) {
  if (!scene.mcp_servers?.length) return;
  const names = scene.mcp_servers.map((s) => (typeof s === 'string' ? s : s.name || JSON.stringify(s)));
  console.log(`   ${chalk.gray('MCP 依赖:')} ${names.join(', ')}`);
}

function printHooks(scene) {
  const hooks = scene.hooks;
  if (!hooks || Object.keys(hooks).length === 0) return;
  // 引擎不执行 hooks（那是 Claude Code 的机制）。以前连提示都没有，
  // 用户会以为「工具调用前注入规划上下文」这类承诺真的生效了。
  console.log(`   ${chalk.yellow('声明的 harness hooks（本引擎不执行）:')}`);
  for (const [event, spec] of Object.entries(hooks)) {
    const action = spec?.action || spec?.script || '';
    console.log(`     ${chalk.gray(event)} → ${action}${spec?.matcher ? chalk.gray(` (matcher: ${spec.matcher})`) : ''}`);
  }
}

function printGuardrails(scene) {
  const guards = scene.guardrails;
  if (!guards || Object.keys(guards).length === 0) return;
  for (const [key, value] of Object.entries(guards)) {
    console.log(`   ${chalk.gray(key)}: ${value}`);
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

  printHeader(scene);
  printTriggerKeywords(scene);
  printSemanticTrigger(scene);
  printPriority(scene);
  printWorkflow(scene);
  printMCPServers(scene);
  printHooks(scene);
  printGuardrails(scene);

  const steps = scene.flow || scene.steps || [];
  console.log(`\n   ${chalk.gray(`步骤 ${steps.length} 个:`)}`);
  printSteps(steps);
  console.log();
}
