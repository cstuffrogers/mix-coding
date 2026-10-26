import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { classifyAction, checkAcceptance } from './acceptance-check.js';

// 场景本身也要守验收三元组的约定：有变更动作就必须有验证动作，
// 否则跑到结尾会被 enforceAcceptanceGate 直接 exit 1（干活干到最后一步才炸）。
// 这里用引擎自己的 classifyAction 判，不用第二套正则 ——
// scripts/audit-scenes.mjs 之前就是自己写了一份窄正则，把 15 个场景全误报成
// 「无验证步骤」，而那些场景其实都有 runLint / smoke / verifyHandlers。
const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = dirname(dirname(LIB_DIR)); // .../claude-scene
const REPO_ROOT = dirname(ENGINE_DIR);
const SCENES_DIR = join(ENGINE_DIR, 'scenes');

const sceneFiles = readdirSync(SCENES_DIR).filter((f) => f.endsWith('.json'));

describe('场景验收三元组约定', () => {
  it('找到场景文件', () => {
    expect(sceneFiles.length).toBeGreaterThan(20);
  });

  it('每个有变更动作的场景都带验证动作（除非声明 allow_no_verify）', () => {
    const offenders = [];
    for (const file of sceneFiles) {
      const scene = JSON.parse(readFileSync(join(SCENES_DIR, file), 'utf-8'));
      const flow = scene.flow || [];
      const steps = flow.map((s) => s.step);
      const r = checkAcceptance(flow, steps, scene.allow_no_verify === true);
      if (r.missingVerify) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('审计脚本不另立一套分类正则（必须复用引擎的 classifyAction）', () => {
    const src = readFileSync(join(REPO_ROOT, 'scripts', 'audit-scenes.mjs'), 'utf-8');
    expect(src).toContain('classifyAction');
    // 旧的「自己写一份分类正则」写法不能再出现
    expect(src).not.toContain('implement|apply|write|create|generate|fix|refactor');
    expect(src).not.toContain('lint|test|build|typecheck|verify|runTests|verifyBuild');
  });

  it('classifyAction 认得场景里真实用到的验证动作', () => {
    const verifyActions = ['runLint', 'runTests', 'runBuild', 'smoke', 'verifyHandlers',
      'typecheck', 'auditDependencies', 'validateSchema', 'regressionSuite', 'reviewDiff'];
    for (const action of verifyActions) {
      expect(classifyAction(action), action).toBe('verify');
    }
  });
});

// 场景存在 ≠ 用户能调到。pi 里唯一的入口是 .pi/prompts/，而 /setup 曾经
// 「AGENTS.md 写了、场景引擎里有、提示词却没有」，等于文档骗人 + 敲不出来。
describe('场景 ↔ 提示词一致性', () => {
  const PROMPTS_DIR = join(REPO_ROOT, '.pi', 'prompts');
  const promptFiles = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith('.md'));
  const sceneIds = sceneFiles.map((f) => {
    const scene = JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf-8'));
    return scene.scene_id || f.replace(/\.json$/, '');
  });

  it('每个场景都有对应提示词', () => {
    const prompted = new Set(promptFiles.map((f) => f.slice(0, -3)));
    expect(sceneIds.filter((id) => !prompted.has(id))).toEqual([]);
  });

  it('提示词里引用的场景都存在（防止指向已删除的场景）', () => {
    const bad = [];
    for (const file of promptFiles) {
      const body = readFileSync(join(PROMPTS_DIR, file), 'utf-8');
      for (const m of body.matchAll(/claude-scene\s+start\s+([\w-]+)/g)) {
        if (!sceneIds.includes(m[1])) bad.push(`${file} -> ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('setup 提示词写全了引擎声明的每种 kind', () => {
    const scene = JSON.parse(readFileSync(join(SCENES_DIR, 'setup.json'), 'utf-8'));
    const selector = (scene.flow || []).find((s) => s.action === 'selectSetupKind');
    const kinds = (selector?.params?.options || []).map((o) => o.id);
    const body = readFileSync(join(PROMPTS_DIR, 'setup.md'), 'utf-8');
    expect(body).toContain('--kind');
    for (const k of kinds) expect(body, k).toContain(k);
  });
});
