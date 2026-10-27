import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PROMPT_SCENES, SKIP_ENHANCEMENT } from '../data/sync-docs-config.js';

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

function getStepCount(scene) {
  return scene.flow ? scene.flow.length : '?';
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

// ── Content generators ──────────────────────────────────────────

export function generateWorkflowTable(scenes) {
  const rows = scenes.map((s) => {
    const cmd = getInvocation(s.scene_id);
    const steps = `${getStepCount(s)}步`;
    return `| \`/${s.scene_id}\` | \`${cmd}\` | ${steps} | ${s.description} |`;
  });
  return rows.join('\n');
}

export function generateSkipEnhancementList(_scenes) {
  const ids = [...SKIP_ENHANCEMENT].sort();
  const group1 = ids.filter((id) =>
    ['bugfix', 'loop', 'optimize',
      'deps', 'setup', 'cicd', 'backup', 'incident', 'docker',
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
