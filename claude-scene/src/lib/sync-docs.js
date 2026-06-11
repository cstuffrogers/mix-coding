import { readdirSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import chalk from 'chalk';

// ── Config ──────────────────────────────────────────────────────

const PROMPT_SCENES = new Set([
  'feature', 'bugfix', 'refactor', 'new-project', 'design', 'analyze', 'prototype',
]);

const THEME_SCENES = new Set(['ui-polish']);

const SKIP_ENHANCEMENT = new Set([
  'bugfix', 'hunt', 'analyze', 'loop', 'simplify', 'optimize', 'design',
  'deps', 'monitor', 'cicd', 'backup', 'incident', 'e2e', 'docker',
  'changelog', 'sbom', 'log', 'prototype', 'rollback', 'onboard',
  'migration', 'loadtest',
]);

// Scenes with natural-language trigger detail (maintained manually)
const SCENE_LABELS = {
  'ui-polish': '前端美化',
  bugfix: 'Bug 修复',
  feature: '新增功能',
  review: '代码审查',
  refactor: '代码重构',
  optimize: '性能优化',
  simplify: '代码简化',
  hunt: '安全扫描',
  analyze: '竞品分析',
  design: 'AI 设计',
  loop: '自动迭代',
  'new-project': '新项目创建',
  release: '发布部署',
  audit: '全面健康检查',
  prototype: '快速原型',
  deps: '依赖更新',
  rollback: '紧急回滚',
  onboard: '环境搭建',
  monitor: '网站监控配置',
  cicd: 'CI/CD 配置',
  backup: '备份配置',
  incident: '事故响应',
  e2e: 'E2E 测试配置',
  docker: 'Docker 容器化',
  changelog: '变更日志',
  sbom: 'SBOM 许可证合规',
  log: '日志聚合',
  migration: '数据库迁移审查',
  loadtest: '负载测试',
};

// ── Scene loading ───────────────────────────────────────────────

function loadScenes(scenesDir) {
  const files = readdirSync(scenesDir).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => {
      try {
        const raw = readFileSync(join(scenesDir, f), 'utf-8');
        return JSON.parse(raw);
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.scene_id.localeCompare(b.scene_id));
}

function detectArchonSupport(sceneId, archonDir) {
  return existsSync(join(archonDir, `${sceneId}.yaml`));
}

function getStepCount(scene) {
  return scene.flow ? scene.flow.length : '?';
}

function getSceneCliArgs(sceneId) {
  if (THEME_SCENES.has(sceneId)) return '--theme <主题> --target <路径>';
  if (PROMPT_SCENES.has(sceneId)) return '--prompt "<描述>"';
  return '';
}

function getSceneArgsHint(sceneId) {
  if (sceneId === 'ui-polish') return '<主题> <路径>';
  if (sceneId === 'loadtest') return '[模式]';
  if (sceneId === 'analyze') return '[项目名]';
  if (PROMPT_SCENES.has(sceneId)) return '描述';
  return '';
}

function getSceneCommand(sceneId) {
  const hint = getSceneArgsHint(sceneId);
  return hint ? `\`/${sceneId} ${hint}\`` : `\`/${sceneId}\``;
}

function getInvocation(sceneId) {
  const hint = getSceneArgsHint(sceneId);
  return hint ? `> /${sceneId} ${hint}` : `> /${sceneId}`;
}

function getArchonCommand(sceneId, archonSupport) {
  if (!archonSupport) return '—';
  const hint = getSceneArgsHint(sceneId);
  return hint
    ? `\`bun run cli workflow run auto-coding-${sceneId} "<${hint}>"\``
    : `\`bun run cli workflow run auto-coding-${sceneId}\``;
}

// ── Content generators ──────────────────────────────────────────

function generateWorkflowTable(scenes) {
  const rows = scenes.map((s) => {
    const cmd = getInvocation(s.scene_id);
    const steps = `${getStepCount(s)}步`;
    return `| \`/${s.scene_id}\` | \`${cmd}\` | ${steps} | ${s.description} |`;
  });
  return rows.join('\n');
}

function generateCommandTable(scenes, archonDir) {
  const rows = scenes.map((s) => {
    const archon = detectArchonSupport(s.scene_id, archonDir);
    const args = getSceneCliArgs(s.scene_id);
    const sceneCmd = args
      ? `\`node src/index.js start ${s.scene_id} --auto ${args}\``
      : `\`node src/index.js start ${s.scene_id} --auto\``;
    const archonCmd = getArchonCommand(s.scene_id, archon);
    const archonIcon = archon ? '✅' : '❌';
    return `| \`/${s.scene_id}\` | \`${s.scene_id}\` | ${archonIcon} | ${sceneCmd} | ${archonCmd} |`;
  });
  return rows.join('\n');
}

function generateSkipEnhancementList(_scenes) {
  const ids = [...SKIP_ENHANCEMENT].sort();
  // Split into two groups for readability
  const group1 = ids.filter((id) =>
    ['bugfix', 'hunt', 'analyze', 'loop', 'simplify', 'optimize', 'design',
      'deps', 'monitor', 'cicd', 'backup', 'incident', 'e2e', 'docker',
      'changelog', 'sbom', 'log'].includes(id),
  );
  const group2 = ids.filter((id) =>
    ['migration', 'loadtest', 'onboard', 'prototype', 'rollback'].includes(id),
  );

  const line1 = `以下场景无可选增强，直接执行核心工作流：${group1.map((id) => `\`${id}\``).join('、')}`;
  const line2 = `以下场景无可选增强，直接执行核心工作流：${group2.map((id) => `\`${id}\``).join('、')}`;
  const allLine = `以下场景无可选增强，直接执行核心工作流：${ids.map((id) => `\`${id}\``).join('、')}`;
  return { line1, line2, allLine };
}

function generateSceneTable(scenes) {
  const rows = scenes.map((s) => {
    const cmd = getSceneCommand(s.scene_id);
    return `| \`${s.scene_id}\` | ${cmd} | ${s.description} |`;
  });
  return rows.join('\n');
}

// ── Section merger for trigger sections ─────────────────────────

function mergeTriggerSections(existingContent, scenes) {
  // Extract existing per-scene sections to preserve hand-written content
  const existingSections = {};
  const sectionRe = /### \d{1,3}\. [^\n]{1,200} — `(\w[\w-]{0,80})`\n([\s\S]{0,5000}?)(?=\n### \d{1,3}\.|\n*$)/g;
  let m;
  while ((m = sectionRe.exec(existingContent)) !== null) {
    existingSections[m[1]] = m[2];
  }

  return scenes
    .map((s, i) => {
      const label = SCENE_LABELS[s.scene_id] || s.name;
      if (existingSections[s.scene_id]) {
        // Preserve existing hand-written content, update only number and label
        const body = existingSections[s.scene_id];
        return `### ${i + 1}. ${label} — \`${s.scene_id}\`\n${body.trimEnd()}`;
      }
      // New scene: generate template
      const keywords = (s.trigger_keywords || []).join('、');
      const args = getSceneCliArgs(s.scene_id);
      const cliCmd = args
        ? `node src/index.js start ${s.scene_id} --auto ${args}`
        : `node src/index.js start ${s.scene_id} --auto`;

      return `### ${i + 1}. ${label} — \`${s.scene_id}\`
**触发词**：${keywords}
**自然语言示例**：
- "（请根据实际场景补充示例）"

**CLI 命令**：
\`\`\`bash
${cliCmd}
\`\`\`

**参数处理规则**：
- （请根据实际场景补充参数规则）`;
    })
    .join('\n\n');
}

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

  // Update the count in workflows.md natural language section header
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
