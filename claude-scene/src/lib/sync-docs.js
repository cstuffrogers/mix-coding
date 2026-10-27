import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from "path";
import { loadScenes, generateWorkflowTable, generateCommandTable, generateSkipEnhancementList, generateSceneTable, mergeTriggerSections } from './doc-generators.js';

// ── File syncer ─────────────────────────────────────────────────

function syncSection(filePath, sectionName, newContent) {
  const startTag = `<!-- AUTO-SYNC:${sectionName}-START -->`;
  const endTag = `<!-- AUTO-SYNC:${sectionName}-END -->`;

  if (!existsSync(filePath)) {
    return 'missing-file';
  }

  let content = readFileSync(filePath, 'utf-8');
  const sectionRe = new RegExp(
    `${startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?\\n${endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g',
  );

  const replacement = `${startTag}\n${newContent}\n${endTag}`;

  if (!sectionRe.test(content)) {
    return 'missing-marker';
  }
  const next = content.replace(sectionRe, replacement);
  if (next === content) return 'unchanged';
  writeFileSync(filePath, next, 'utf-8');
  return 'updated';
}

function syncTriggerSections(filePath, scenes) {
  const sectionName = 'TRIGGER-SECTIONS';
  const startTag = `<!-- AUTO-SYNC:${sectionName}-START -->`;
  const endTag = `<!-- AUTO-SYNC:${sectionName}-END -->`;

  if (!existsSync(filePath)) {
    return 'missing-file';
  }

  let content = readFileSync(filePath, 'utf-8');
  const sectionRe = new RegExp(
    `${startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)\\n${endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g',
  );

  const match = sectionRe.exec(content);
  if (!match) {
    return 'missing-marker';
  }

  const existingContent = match[1];
  const newContent = mergeTriggerSections(existingContent, scenes);
  const next = content.replace(sectionRe, `${startTag}\n${newContent}\n${endTag}`);
  if (next === content) return 'unchanged';
  writeFileSync(filePath, next, 'utf-8');
  return 'updated';
}

function updateSceneCounts(filePath, count) {
  if (!existsSync(filePath)) return [];

  let content = readFileSync(filePath, 'utf-8');
  const oldCount = (content.match(/\d{1,5} 个场景/g) || [])[0];
  if (!oldCount) return [];
  if (parseInt(oldCount, 10) === count) return [];

  const next = content
    .replace(/\d{1,5} 个场景/g, `${count} 个场景`)
    .replace(/（\d{1,5} 个 \.md）/g, `（${count} 个 .md）`);
  if (next === content) return [];
  writeFileSync(filePath, next, 'utf-8');
  return [`${filePath.split(String.fromCodePoint(92)).slice(-1)[0]}#场景计数`];
}

// ── Main entry ──────────────────────────────────────────────────

export function syncAllDocs(projectRoot) {
  const scenesDir = join(projectRoot, '.claude', 'scenes');
  const archonDir = join(projectRoot, '.archon', 'workflows');

  // 以前这里把每个 syncSection 的返回值直接丢掉、自己也不返回任何东西，
  // CLI 跑完一个字都不打印 —— 「同步了什么」和「什么都没干」长得一模一样。
  const report = { updated: [], unchanged: [], missingMarker: [], missingFile: [] };
  const rel = (file) => file.replace(projectRoot, '').split(String.fromCodePoint(92)).join('/');
  const run = (file, section, content, status) => {
    const result = status || syncSection(file, section, content);
    const bucket = result === 'updated' ? 'updated'
      : result === 'unchanged' ? 'unchanged'
        : result === 'missing-marker' ? 'missingMarker' : 'missingFile';
    report[bucket].push(`${rel(file)}#${section}`);
  };

  if (!existsSync(scenesDir)) {
    report.missingFile.push('.claude/scenes');
    return report;
  }

  const scenes = loadScenes(scenesDir);

  // 1. CLAUDE.md — workflow table
  run(join(projectRoot, 'CLAUDE.md'), 'WORKFLOW-TABLE', generateWorkflowTable(scenes));

  // 2. CLAUDE.md — skip-enhancement list
  const skipLists = generateSkipEnhancementList(scenes);
  run(
    join(projectRoot, 'CLAUDE.md'),
    'SKIP-ENHANCEMENT-LIST',
    `${skipLists.line1}
${skipLists.line2}`,
  );

  // 3. workflows.md — command table
  run(join(projectRoot, '.claude', 'rules', 'workflows.md'), 'COMMAND-TABLE', generateCommandTable(scenes, archonDir));

  // 4. workflows.md — skip-enhancement list
  run(join(projectRoot, '.claude', 'rules', 'workflows.md'), 'SKIP-ENHANCEMENT-LIST', skipLists.allLine);

  // 5. workflows.md — trigger sections (merge with existing)
  const wfPath = join(projectRoot, '.claude', 'rules', 'workflows.md');
  run(wfPath, 'TRIGGER-SECTIONS', null, syncTriggerSections(wfPath, scenes));

  // 6. scenes/README.md — scene table
  run(join(projectRoot, '.claude', 'scenes', 'README.md'), 'SCENE-TABLE', generateSceneTable(scenes));

  // 7. Update scene counts
  report.updated.push(...updateSceneCounts(join(projectRoot, '.claude', 'scenes', 'README.md'), scenes.length));
  report.updated.push(...updateSceneCounts(join(projectRoot, 'docs', 'tools-inventory.md'), scenes.length));

  if (existsSync(wfPath)) {
    let wfContent = readFileSync(wfPath, 'utf-8');
    if (wfContent.match(/以下是完整的 d+ 个工作流/)) {
      const next = wfContent.replace(/以下是完整的 d+ 个工作流/, `以下是完整的 ${scenes.length} 个工作流`);
      if (next !== wfContent) {
        writeFileSync(wfPath, next, 'utf-8');
        report.updated.push('.claude/rules/workflows.md#工作流计数');
      }
    }
  }

  return report;
}
