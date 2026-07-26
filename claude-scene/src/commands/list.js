import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { SCENES_DIR } from '../lib/paths.js';
const SCENE_META = {
  'new-project':   { icon: '🚀', description: '从零开始新项目' },
  'feature':       { icon: '✨', description: '已有项目加功能' },
  'bugfix':        { icon: '🐛', description: '线上故障排查修复' },
  'refactor':      { icon: '🔧', description: '代码重构优化' },
  'design':        { icon: '🎨', description: 'UI/UX 设计改版' },
  'analyze':       { icon: '📊', description: '竞品分析与技术选型' },
  'loop':          { icon: '🔄', description: '无人值守自动迭代' },
  'review':        { icon: '📋', description: '全面代码质量审查' },
  'hunt':          { icon: '🔒', description: '代码安全漏洞扫描与修复' },
  'ui-polish':     { icon: '💅', description: '前端美化（DaisyUI + Animate.css）' },
  'simplify':      { icon: '🧹', description: '代码简化（可读性优先）' },
  'optimize':      { icon: '⚡', description: '性能优化（测量优先）' },
};
function loadScene(id) {
  try {
    const filePath = join(SCENES_DIR, `${id}.json`);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function getAllSceneIds() {
  try {
    const files = readdirSync(SCENES_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort();
  } catch {
    return Object.keys(SCENE_META);
  }
}
 
export async function listScenes(options) {
  const ids = getAllSceneIds();
  const sceneList = ids.map(id => {
    const scene = loadScene(id);
    const meta = SCENE_META[id] || { icon: '📦', description: '' };
    const description = scene?.description || meta.description;
    return { id, scene, meta, description };
  }).filter(s => s.scene !== null);

  console.log(chalk.bold('可用场景:'));
  for (const { id, scene, meta, description } of sceneList) {
    console.log(`  ${meta.icon} ${chalk.cyan(id.padEnd(16))} ${description}`);
    if (options.verbose) {
      if (scene.trigger_keywords && scene.trigger_keywords.length > 0) {
        console.log(`      ${chalk.gray('触发关键词:')} ${scene.trigger_keywords.join(', ')}`);
      }
      if (scene.workflow) {
        console.log(`      ${chalk.gray('工作流:')} ${scene.workflow}`);
      }
    }
  }
  console.log(`\n共 ${sceneList.length} 个场景，使用 ${chalk.cyan('claude-scene show <id>')} 查看详情`);
}