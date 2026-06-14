import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PROMPT_SCENES, THEME_SCENES, SKIP_ENHANCEMENT, SCENE_LABELS } from '../data/sync-docs-config.js';

// ── Scene loading ───────────────────────────────────────────────

export function loadScenes(scenesDir) {
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

export function generateWorkflowTable(scenes) {
  const rows = scenes.map((s) => {
    const cmd = getInvocation(s.scene_id);
    const steps = `${getStepCount(s)}步`;
    return `| \`/${s.scene_id}\` | \`${cmd}\` | ${steps} | ${s.description} |`;
  });
  return rows.join('\n');
}

export function generateCommandTable(scenes, archonDir) {
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

export function generateSkipEnhancementList(_scenes) {
  const ids = [...SKIP_ENHANCEMENT].sort();
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

export function generateSceneTable(scenes) {
  const rows = scenes.map((s) => {
    const cmd = getSceneCommand(s.scene_id);
    return `| \`${s.scene_id}\` | ${cmd} | ${s.description} |`;
  });
  return rows.join('\n');
}

// ── Section merger for trigger sections ─────────────────────────

export function mergeTriggerSections(existingContent, scenes) {
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
        const body = existingSections[s.scene_id];
        return `### ${i + 1}. ${label} — \`${s.scene_id}\`\n${body.trimEnd()}`;
      }
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
