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
