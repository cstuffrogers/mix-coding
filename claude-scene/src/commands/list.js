import { readFileSync } from 'fs';
import chalk from 'chalk';
import { resolveScenePath, listSceneIds } from '../lib/paths.js';
const SCENE_META = {
  'new-project':   { icon: '🚀', description: '从零开始新项目' },
  'feature':       { icon: '✨', description: '已有项目加功能' },
  'bugfix':        { icon: '🐛', description: '线上故障排查修复' },
  'refactor':      { icon: '🔧', description: '代码重构/简化' },
  'loop':          { icon: '🔄', description: '无人值守自动迭代' },
  'review':        { icon: '📋', description: '代码审查 + 安全审计（全量/安全/质量/设计模式）' },
  'ui-polish':     { icon: '💅', description: '前端美化与 AI 设计' },
  'optimize':      { icon: '⚡', description: '性能优化（测量优先）' },
  'setup':         { icon: '🔧', description: 'E2E 测试 / 网站监控设施搭建' },
  'check':         { icon: '🩺', description: '引擎自检与自愈' },
  'plan':          { icon: '🗺️', description: '持久化规划（spec/plan/tasks）' },
  'update':        { icon: '⬆️', description: '系统资源更新' },
};
function loadScene(id) {
  try {
    const filePath = resolveScenePath(id);
    if (!filePath) return null;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function getAllSceneIds() {
  try {
    return listSceneIds();
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