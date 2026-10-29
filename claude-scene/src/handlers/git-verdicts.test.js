import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 第十三轮维度1：git 系列 handler 的「没做成」曾经都写成「跳过」：
//   · push 被拒 / pre-commit hook 挂掉 → `提交跳过: …` → 引擎判 noop（假绿）
//   · 非 git 目录 → `Git diff 跳过` 并且顺手 `lastStepFailed = false`（把上一个
//     步骤的失败擦掉），下游 `has_frontend_changes = false` 于是静默跳过 QA
// 现在：真的失败 = fail；没查成 = skip，且不许替别人擦失败。
const state = vi.hoisted(() => ({ calls: [], fail: null }));

vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (cmd) => {
    state.calls.push(cmd);
    if (state.fail) throw state.fail;
    return { toString: () => '' };
  },
  escapeArg: String,
}));

const { handleCommitPush, handleRollback, handleGitDiffNameOnly } = await import('./git.js');

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'git-verdict-'));
  state.calls.length = 0;
  state.fail = null;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('handleCommitPush：提交/推送失败不是「无变更可提交」', () => {
  it('push 被拒 → fail', () => {
    const err = new Error('Command failed: git push origin HEAD');
    err.stderr = { toString: () => 'remote: Permission denied (403)' };
    state.fail = err;
    const result = handleCommitPush('commitPush', { push_remote: true }, root);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('403');
  });

  it('hook 拦下（没有 no changes 字样）→ fail，不许落成跳过', () => {
    const err = new Error('Command failed: git commit');
    err.stderr = { toString: () => 'husky - pre-commit hook exited with code 1' };
    state.fail = err;
    const result = handleCommitPush('commitPush', {}, root);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('pre-commit');
  });

  it('真的没有变更 → noop', () => {
    const err = new Error('Command failed: git commit');
    err.stderr = { toString: () => 'nothing to commit, working tree clean' };
    state.fail = err;
    const result = handleCommitPush('commitPush', {}, root);
    expect(result.status).toBe('noop');
  });
});

describe('handleRollback / handleGitDiffNameOnly', () => {
  it('回滚失败 → fail', () => {
    state.fail = new Error('error: could not revert');
    const result = handleRollback('rollback', {}, root);
    expect(result.status).toBe('fail');
  });

  it('非 git 目录 → skip，且不许把 lastStepFailed 擦成 false', () => {
    state.fail = new Error('fatal: not a git repository');
    const context = { lastStepFailed: true };
    const result = handleGitDiffNameOnly('gitDiff', {}, root, context);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('不是通过');
    // 「上一个步骤失败了」是事实，diff 没查成不构成翻案理由
    expect(context.lastStepFailed).toBe(true);
    expect(context.has_frontend_changes).toBe(false);
  });
});
