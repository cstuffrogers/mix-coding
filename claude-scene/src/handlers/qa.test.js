import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  handleMapRoutes, handleTestInteractions, handleClassifyBugs,
} from './qa.js';

// 这一组守的是「QA 步骤不许把登记当成检测」：
// 以前 testInteractions 报「2 个流程已识别」（其实只是场景里抄的名字）、
// classifyBugs 报「Bug 分类完成: N 条」（一条缺陷都没有）、
// mapRoutes 读的是 context.targetPath 而把形参丢掉 —— 目标项目不是 cwd 时永远扫到 0 个页面。
describe('qa handlers 的真实性', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'qa-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('mapRoutes 用形参 targetPath 找页面（不是 cwd）', () => {
    mkdirSync(join(root, 'src', 'pages'), { recursive: true });
    writeFileSync(join(root, 'src', 'pages', 'dashboard.tsx'), 'export default 1');
    writeFileSync(join(root, 'src', 'pages', 'index.tsx'), 'export default 1');
    const ctx = {};
    const r = handleMapRoutes('mapRoutes', { source: 'git_diff' }, root, ctx);
    expect(r.status).toBe('pass');
    expect(ctx.routePages).toEqual(['/dashboard']);
  });

  it('mapRoutes 未指定 source 时 skip，不是 pass', () => {
    expect(handleMapRoutes('mapRoutes', {}, root, {}).status).toBe('skip');
  });

  it('testInteractions 只登记待测流程 → noop，不说「已识别」', () => {
    const ctx = { has_frontend_changes: true };
    const r = handleTestInteractions('testInteractions', { flows: ['form-submit'] }, root, ctx);
    expect(r.status).toBe('noop');
    expect(r.message).toContain('未检测');
    expect(r.message).not.toContain('已识别');
    expect(ctx.interactionFlows).toEqual(['form-submit']);
  });

  it('classifyBugs 没有缺陷数据时 noop，不报「分类完成」', () => {
    const r = handleClassifyBugs('classifyBugs', {}, root, { has_frontend_changes: true });
    expect(r.status).toBe('noop');
    expect(r.message).toContain('未执行');
    expect(r.message).not.toContain('Bug 分类完成');
  });
});
