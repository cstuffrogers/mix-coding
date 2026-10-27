import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';
import { handleCodeGuardianOptimize, DEFAULT_LIMITS, captureBoundaryBaseline } from './codeguardian.js';

const NEWLINE = String.fromCodePoint(10);

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

  it('越界文案随 --strict-enclosure 变化（默认记账 / strict 整体中止）', () => {
    const big = Array.from({ length: 80 }, (_, i) => `export const v${i} = ${i};`).join(NEWLINE);
    writeFileSync(join(root, 'big.js'), big);
    const plain = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, {});
    expect(plain).toContain('记账模式');
    expect(plain).not.toContain('越界立即中止');

    const strict = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, { strictEnclosure: true });
    expect(strict).toContain('越界立即中止');
    expect(strict).not.toContain('记账模式');
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

// 回归：loop/refactor 这类场景里，上一轮的成果会让工作区一直是脏的，
// `git diff HEAD` 把旧改动也量进来，第二轮就被自己顶到 ±50 边界直接 abort。
describe('CodeGuardian 以运行前快照为基准', () => {
  let root;

  const git = (args) => safeExec(`git ${args}`, root, { stdio: 'pipe', timeout: 30000 });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'guardian-base-'));
    git('init -q');
    git('config user.email t@t.t');
    git('config user.name t');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: { a: '1.0.0' } }));
    writeFileSync(join(root, 'a.js'), 'export const a = 1;\n');
    git('add -A');
    git('commit -q -m init');
  });

  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('运行前已有的 60 行未提交改动不再算作本轮变更', () => {
    const dirty = Array.from({ length: 60 }, (_, i) => `// legacy ${i}`).join('\n');
    writeFileSync(join(root, 'a.js'), `export const a = 1;\n${dirty}\n`);
    const ctx = { codeguardianBaseline: captureBoundaryBaseline(root) };

    writeFileSync(join(root, 'a.js'), 'export const a = 2;\n');
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, ctx);

    expect(msg).toContain('边界检查通过');
    expect(msg).toContain('（第 1 轮）');
    expect(ctx.boundaryOk).toBe(true);
  });

  it('快照之后真改 80 行仍然越界', () => {
    const ctx = { codeguardianBaseline: captureBoundaryBaseline(root) };
    const big = Array.from({ length: 80 }, (_, i) => `export const v${i} = ${i};`).join('\n');
    writeFileSync(join(root, 'a.js'), `${big}\n`);
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, ctx);
    expect(msg).toContain('边界超出');
    expect(ctx.boundaryOk).toBe(false);
  });

  it('快照之后新增的依赖才算新增', () => {
    const ctx = { codeguardianBaseline: captureBoundaryBaseline(root) };
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: { a: '1.0.0', b: '2.0.0' } }));
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, ctx);
    expect(ctx.boundaryNewDeps).toEqual(['b']);
    expect(msg).toContain('边界超出');
  });

  it('引擎自己落盘的报告/日志不计入边界', () => {
    const ctx = { codeguardianBaseline: captureBoundaryBaseline(root) };
    mkdirSync(join(root, '.claude', 'reports'), { recursive: true });
    writeFileSync(join(root, '.claude', 'reports', 'aislop-x.json'), JSON.stringify({ pad: 'x'.repeat(5000) }));
    mkdirSync(join(root, '.claude', 'logs'), { recursive: true });
    writeFileSync(join(root, '.claude', 'logs', 'workflow.log'), 'line\n'.repeat(200));
    const msg = handleCodeGuardianOptimize('codeguardian_optimize', {}, root, ctx);
    expect(msg).toContain('边界检查通过');
    expect(ctx.boundaryOk).toBe(true);
  });

  it('非 git 目录拿不到快照，回落为 null 不抛错', () => {
    const plain = mkdtempSync(join(tmpdir(), 'guardian-plain-'));
    expect(captureBoundaryBaseline(plain)).toBeNull();
    rmSync(plain, { recursive: true, force: true });
  });
});
