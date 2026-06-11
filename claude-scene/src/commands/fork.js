import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { SCENES_DIR } from '../lib/paths.js';
export async function forkScene(sourceSceneId, options) {
  const sourcePath = join(SCENES_DIR, `${sourceSceneId}.json`);
  if (!existsSync(sourcePath)) {
    console.error(chalk.red(`\n✖ 源场景 "${sourceSceneId}" 未找到`));
    process.exit(1);
  }
  const raw = readFileSync(sourcePath, 'utf-8');
  let scene;
  try {
    scene = JSON.parse(raw);
  } catch {
    console.error(chalk.red(`\n✖ 场景文件格式错误: ${sourceSceneId}.json\n`));
    process.exit(1);
  }

  const sceneId = scene.scene_id || scene.id;
  const newName = options.name || `${sceneId}-fork`;
  const outputPath = options.output || join(SCENES_DIR, `${newName}.json`);
  const forked = {
    scene_id: newName.replace(/\.json$/, ''),
    name: `${scene.name} ( Fork )`,
    description: `${scene.description}\n基于 ${sceneId} Fork 自定义`,
    originalScene: sceneId,
    trigger_keywords: scene.trigger_keywords || [],
    flow: scene.flow.map(s => ({ ...s })),
  };

  if (options.dryRun) {
    console.log(chalk.cyan(`\n🔍 试运行模式 — 将创建场景:"${forked.scene_id}"`));
    console.log(chalk.dim(`   输出路径: ${outputPath}`));
    console.log(chalk.dim(`   包含 ${forked.flow.length} 个步骤`));
    console.log(chalk.gray(JSON.stringify(forked, null, 2)));
    return;
  }

  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  writeFileSync(outputPath, JSON.stringify(forked, null, 2), 'utf-8');
  console.log(chalk.green(`\n✅ Fork 完成: ${outputPath}`));
}