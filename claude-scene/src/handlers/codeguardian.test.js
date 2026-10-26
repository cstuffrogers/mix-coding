import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';
import { handleCodeGuardianOptimize, DEFAULT_LIMITS } from './codeguardian.js';

// 这条门禁以前是个纯桩（永远返回「仅对话模式可用」），可 refactor/optimize/loop
// 三个场景都挂着 on_error: abort —— 号称最关键防线，实际什么都没量。
describe('CodeGuardian 变更边界验证', () => {
  let root;

  const git = (args) => safeExec(`git ${args}`, root, { stdio: 'pipe', timeout: 30000 });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'guardian-'));
    git('init -q');
    git('config user.email t@t.t');
    git('config user.name t');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: { a: '1.0.0' } }));
    writeFileSync(join(root, 'a.js'), 'export const a = 1;\n');
    git('add -A');
    git('commit -q -m init');
  });

  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('小改动 + 无新依赖 → 通过并写上下文', () => {
    writeFileSync(join(root, 'a.js'), 'export const a = 2;\n');
    const ctx = {};
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, ctx);
    expect(msg).toContain('边界检查通过');
    expect(ctx.boundaryOk).toBe(true);
    expect(ctx.boundaryViolations).toEqual([]);
    expect(ctx.boundaryNewDeps).toEqual([]);
    expect(ctx.lastStepFailed).toBeUndefined();
  });

  it('超出 ±50 行 → 判定越界并置 lastStepFailed', () => {
    const big = Array.from({ length: 80 }, (_, i) => `export const v${i} = ${i};`).join('\n');
    writeFileSync(join(root, 'big.js'), big);
    const ctx = {};
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, ctx);
    expect(msg).toContain('边界超出');
    expect(msg).toContain(String(DEFAULT_LIMITS.maxLines));
    expect(ctx.boundaryOk).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('新增依赖 → 判定越界（max_deps 默认 0）', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: { a: '1.0.0', b: '2.0.0' } }));
    const ctx = {};
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, ctx);
    expect(msg).toContain('新增依赖');
    expect(ctx.boundaryNewDeps).toEqual(['b']);
    expect(ctx.boundaryOk).toBe(false);
  });

  it('阈值可由 params 覆盖', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: { a: '1.0.0', b: '2.0.0' } }));
    const ctx = {};
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', { max_deps: 5, max_lines: 500 }, root, ctx);
    expect(msg).toContain('边界检查通过');
    expect(ctx.boundaryOk).toBe(true);
  });

  it('非 git 目录 → 明确跳过，不冒充通过', () => {
    const plain = join(root, 'plain');
    mkdirSync(plain, { recursive: true });
    const ctx = {};
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, plain, ctx);
    expect(msg).toContain('跳过');
    expect(msg).toContain('无法量化');
    expect(ctx.boundaryOk).toBeUndefined();
  });
});
