import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 只 mock 命令执行；文件系统用真实临时目录，才能真验 tsconfig 探测。
const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
}));

import { findTsconfigs, handleRunReview } from './review.js';

const output = (s) => ({ toString: () => s });

const dirs = [];
function makeProject({ tsconfig = false, subTsconfig = null, scripts = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'review-ts-'));
  dirs.push(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', scripts }));
  if (tsconfig) writeFileSync(join(root, 'tsconfig.json'), '{}');
  if (subTsconfig) {
    mkdirSync(join(root, subTsconfig), { recursive: true });
    writeFileSync(join(root, subTsconfig, 'tsconfig.json'), '{}');
  }
  return root;
}

afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  // 默认：所有诊断命令都干净通过
  mockSafeExec.mockImplementation(() => output(''));
});

describe('findTsconfigs', () => {
  it('根目录有 tsconfig.json 时只用根', () => {
    const root = makeProject({ tsconfig: true, subTsconfig: 'claude-scene' });
    expect(findTsconfigs(root)).toEqual([root]);
  });

  it('根没有时向下探一层，找到子项目 tsconfig', () => {
    const root = makeProject({ subTsconfig: 'claude-scene' });
    expect(findTsconfigs(root)).toEqual([join(root, 'claude-scene')]);
  });

  it('根和子目录都没有时返回空数组', () => {
    const root = makeProject({ subTsconfig: 'node_modules/pkg' });
    expect(findTsconfigs(root)).toEqual([]);
  });
});

// 回归：根目录无 tsconfig.json 时 `npx tsc --noEmit` 打印帮助并退出 1，
// 旧实现命中 /error|Error/（帮助里有 --noEmitOnError）就跳过，上层却报 pass。
describe('handleRunReview 三态', () => {
  it('类型检查没跑成时报 warn 并注明未执行，而不是「无问题」pass', () => {
    const root = makeProject();
    const result = handleRunReview('runReview', { mode: 'full' }, root, {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('typescript:skip');
    expect(result.message).toContain('部分检查未执行');
  });

  it('子项目 tsconfig 被探测到并用 -p 指定，两者都干净时 pass', () => {
    const root = makeProject({ subTsconfig: 'claude-scene' });
    const result = handleRunReview('runReview', { mode: 'full' }, root, {});

    const cmds = mockSafeExec.mock.calls.map(c => c[0]);
    expect(cmds.some(c => c.includes('tsc --noEmit -p'))).toBe(true);
    expect(cmds.some(c => c.includes('claude-scene'))).toBe(true);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('eslint:pass / typescript:pass');
  });

  it('tsc 报真实类型错误时计入 issues', () => {
    const root = makeProject({ tsconfig: true });
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('tsc')) return output("src/a.ts(1,7): error TS2322: Type 'x' is not assignable");
      return output('');
    });
    const context = {};
    const result = handleRunReview('runReview', { mode: 'full' }, root, context);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('发现问题');
    expect(context.typecheckPassed).toBe(false);
    expect(context.review_issue_count).toBe(1);
  });

  it('ESLint 报 file:line:col 时计入 issues', () => {
    const root = makeProject({ tsconfig: true });
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('eslint')) return output('src/a.js:3:5  error  no-unused-vars');
      return output('');
    });
    const result = handleRunReview('runReview', { mode: 'full' }, root, {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('eslint');
  });
});
