import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import chalk from 'chalk';
import { loadScenes, generateWorkflowTable, generateCommandTable, generateSkipEnhancementList, generateSceneTable, mergeTriggerSections } from './doc-generators.js';

// ── File syncer ─────────────────────────────────────────────────

function syncSection(filePath, sectionName, newContent) {
  const startTag = `<!-- AUTO-SYNC:${sectionName}-START -->`;
  const endTag = `<!-- AUTO-SYNC:${sectionName}-END -->`;

  if (!existsSync(filePath)) {
    console.log(chalk.yellow(`  ⚠ 文件不存在，跳过: ${filePath}`));
    return false;
  }

  let content = readFileSync(filePath, 'utf-8');
  const sectionRe = new RegExp(
    `${startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?\\n${endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g',
  );

  const replacement = `${startTag}\n${newContent}\n${endTag}`;

  if (sectionRe.test(content)) {
    content = content.replace(sectionRe, replacement);
  } else {
    console.log(chalk.yellow(`  ⚠ 未找到标记 ${sectionName} in ${basename(filePath)}，跳过`));
    return false;
  }

  writeFileSync(filePath, content, 'utf-8');
  console.log(chalk.green(`  ✅ ${basename(filePath)}:${sectionName}`));
  return true;
}

function syncTriggerSections(filePath, scenes) {
  const sectionName = 'TRIGGER-SECTIONS';
  const startTag = `<!-- AUTO-SYNC:${sectionName}-START -->`;
  const endTag = `<!-- AUTO-SYNC:${sectionName}-END -->`;

  if (!existsSync(filePath)) {
    console.log(chalk.yellow(`  ⚠ 文件不存在，跳过: ${filePath}`));
    return false;
  }

  let content = readFileSync(filePath, 'utf-8');
  const sectionRe = new RegExp(
    `${startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)\\n${endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g',
  );

  const match = sectionRe.exec(content);
  if (!match) {
    console.log(chalk.yellow(`  ⚠ 未找到标记 ${sectionName} in ${basename(filePath)}，跳过`));
    return false;
  }

  const existingContent = match[1];
  const newContent = mergeTriggerSections(existingContent, scenes);
  content = content.replace(sectionRe, `${startTag}\n${newContent}\n${endTag}`);

  writeFileSync(filePath, content, 'utf-8');
  console.log(chalk.green(`  ✅ ${basename(filePath)}:${sectionName} (保留已有手写内容)`));
  return true;
}

function updateSceneCounts(filePath, count) {
  if (!existsSync(filePath)) return;

  let content = readFileSync(filePath, 'utf-8');
  const oldCount = (content.match(/\d{1,5} 个场景/g) || [])[0];
  if (oldCount) {
    const num = parseInt(oldCount, 10);
    if (num !== count) {
      content = content.replace(/\d{1,5} 个场景/g, `${count} 个场景`);
      content = content.replace(/（\d{1,5} 个 \.md）/g, `（${count} 个 .md）`);
      writeFileSync(filePath, content, 'utf-8');
      console.log(chalk.green(`  ✅ ${basename(filePath)}: ${oldCount} → ${count} 个场景`));
    }
  }
}

// ── Main entry ──────────────────────────────────────────────────

export function syncAllDocs(projectRoot) {
  console.log(chalk.blue('\n📄 正在同步文档...'));

  const scenesDir = join(projectRoot, '.claude', 'scenes');
  const archonDir = join(projectRoot, '.archon', 'workflows');

  if (!existsSync(scenesDir)) {
    console.log(chalk.red('  ❌ 未找到 .claude/scenes/ 目录'));
    return;
  }

  const scenes = loadScenes(scenesDir);
  console.log(chalk.dim(`  加载 ${scenes.length} 个场景`));

  // 1. CLAUDE.md — workflow table
  syncSection(
    join(projectRoot, 'CLAUDE.md'),
    'WORKFLOW-TABLE',
    generateWorkflowTable(scenes),
  );

  // 2. CLAUDE.md — skip-enhancement list
  const skipLists = generateSkipEnhancementList(scenes);
  syncSection(
    join(projectRoot, 'CLAUDE.md'),
    'SKIP-ENHANCEMENT-LIST',
    `${skipLists.line1}\n${skipLists.line2}`,
  );

  // 3. workflows.md — command table
  syncSection(
    join(projectRoot, '.claude', 'rules', 'workflows.md'),
    'COMMAND-TABLE',
    generateCommandTable(scenes, archonDir),
  );

  // 4. workflows.md — skip-enhancement list
  syncSection(
    join(projectRoot, '.claude', 'rules', 'workflows.md'),
    'SKIP-ENHANCEMENT-LIST',
    skipLists.allLine,
  );

  // 5. workflows.md — trigger sections (merge with existing)
  syncTriggerSections(
    join(projectRoot, '.claude', 'rules', 'workflows.md'),
    scenes,
  );

  // 6. scenes/README.md — scene table
  syncSection(
    join(projectRoot, '.claude', 'scenes', 'README.md'),
    'SCENE-TABLE',
    generateSceneTable(scenes),
  );

  // 7. Update scene counts
  updateSceneCounts(
    join(projectRoot, '.claude', 'scenes', 'README.md'),
    scenes.length,
  );
  updateSceneCounts(
    join(projectRoot, 'docs', 'tools-inventory.md'),
    scenes.length,
  );

  const workflowsPath = join(projectRoot, '.claude', 'rules', 'workflows.md');
  if (existsSync(workflowsPath)) {
    let wfContent = readFileSync(workflowsPath, 'utf-8');
    const oldWfCount = wfContent.match(/以下是完整的 \d+ 个工作流/);
    if (oldWfCount) {
      wfContent = wfContent.replace(/以下是完整的 \d+ 个工作流/, `以下是完整的 ${scenes.length} 个工作流`);
      writeFileSync(workflowsPath, wfContent, 'utf-8');
    }
  }

  console.log(chalk.green(`\n✅ 文档同步完成 (${scenes.length} 个场景)`));
}
