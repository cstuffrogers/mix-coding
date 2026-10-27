import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  handleFenceCapture, handleFenceVerify, handleFenceRestore,
} from './fence.js';
import { readEvents } from '../lib/enclosure-ledger.js';

// 真 fs（临时目录），只 mock 进程执行 —— 围栏的核心是「逐条用例」，不需要模拟文件系统。
const NEWLINE = String.fromCodePoint(10);
const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
  escapeArg: (s) => s,
}));

/** vitest --reporter=json 的真实形状（只保留用到的字段）。 */
function vitestJson(entries) {
  return JSON.stringify({
    numTotalTests: entries.length,
    testResults: [
      {
        name: 'sample.test.js',
        assertionResults: entries.map(([fullName, status]) => ({ fullName, status })),
      },
    ],
  });
}

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fence-'));
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}', 'utf-8');
  mockSafeExec.mockReset();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('fenceCapture：动手前拍桩', () => {
  it('没有 package.json → skip（不冒充通过）', () => {
    const empty = mkdtempSync(join(tmpdir(), 'fence-empty-'));
    const result = handleFenceCapture('fenceCapture', {}, empty, {});
    expect(result.status).toBe('skip');
    rmSync(empty, { recursive: true, force: true });
  });

  it('runner 跑不起来 → skip，且不写快照', () => {
    mockSafeExec.mockImplementation(() => {
      const err = new Error('Command failed');
      err.stderr = 'No test files found, exiting with code 0';
      throw err;
    });
    const ctx = {};
    const result = handleFenceCapture('fenceCapture', {}, dir, ctx);
    expect(result.status).toBe('skip');
    expect(ctx.fenceCaptured).toBeUndefined();
    expect(existsSync(join(dir, '.claude', 'reports'))).toBe(false);
  });

  it('拿到逐条用例 → 落盘快照 + 写 context（含 git 快照 sha）', () => {
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('git stash create')) return 'abc123sha';
      return vitestJson([['a passes', 'passed'], ['b already broken', 'failed']]);
    });
    const ctx = {};
    const result = handleFenceCapture('fenceCapture', {}, dir, ctx);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('锁定 2 个用例');
    expect(ctx.fenceCaptured).toBe(true);
    expect(ctx.fenceTestCount).toBe(2);
    expect(ctx.fenceBaselineFailed).toBe(1);

    const saved = JSON.parse(readFileSync(ctx.fenceSnapshotPath, 'utf-8'));
    expect(saved.snapshotSha).toBe('abc123sha');
    expect(saved.tests).toEqual({ 'a passes': 'passed', 'b already broken': 'failed' });
    expect(ctx.fenceSnapshotPath).toContain('.claude');
  });

  it('输出里没有逐条用例 → skip（拿不到明细就不动手）', () => {
    mockSafeExec.mockReturnValue('{"numTotalTests":0,"testResults":[]}');
    const ctx = {};
    const result = handleFenceCapture('fenceCapture', {}, dir, ctx);
    expect(result.status).toBe('skip');
    expect(ctx.fenceCaptured).toBeUndefined();
  });
});

describe('fenceVerify：动完手比对', () => {
  function captureWith(entries) {
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('git stash create')) return 'sha1';
      return vitestJson(entries);
    });
    const ctx = {};
    handleFenceCapture('fenceCapture', {}, dir, ctx);
    return ctx;
  }

  it('没有快照 → skip', () => {
    const result = handleFenceVerify('fenceVerify', {}, dir, {});
    expect(result.status).toBe('skip');
  });

  it('原先通过的用例仍然通过 → pass', () => {
    const ctx = captureWith([['a', 'passed'], ['b', 'failed']]);
    mockSafeExec.mockReturnValue(vitestJson([['a', 'passed'], ['b', 'passed']]));
    const result = handleFenceVerify('fenceVerify', {}, dir, ctx);
    expect(result.status).toBe('pass');
    expect(ctx.fenceViolations).toBe(0);
  });

  it('原先通过的用例变失败 → fail 并点名（本来坏的不算越界）', () => {
    const ctx = captureWith([['a', 'passed'], ['b', 'passed'], ['c', 'failed']]);
    mockSafeExec.mockReturnValue(vitestJson([
      ['a', 'failed'], ['b', 'passed'], ['c', 'failed'],
    ]));
    const result = handleFenceVerify('fenceVerify', {}, dir, ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('a');
    expect(result.message).not.toContain('c');
    expect(ctx.fenceViolations).toBe(1);
  });

  it('原先通过的用例消失（被删/改名）→ 也算越界', () => {
    const ctx = captureWith([['a', 'passed'], ['b', 'passed']]);
    mockSafeExec.mockReturnValue(vitestJson([['a', 'passed']]));
    const result = handleFenceVerify('fenceVerify', {}, dir, ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('b');
  });

  it('第二次跑不起来 → skip（不默认通过）', () => {
    const ctx = captureWith([['a', 'passed']]);
    mockSafeExec.mockImplementation(() => {
      const err = new Error('Command failed');
      err.stderr = 'ERR_MODULE_NOT_FOUND: Cannot find package vitest';
      throw err;
    });
    const result = handleFenceVerify('fenceVerify', {}, dir, ctx);
    expect(result.status).toBe('skip');
  });
});

describe('fenceRestore：越界时按快照退回', () => {
  function captureWithSha(sha) {
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('git stash create')) return sha;
      return vitestJson([['a', 'passed']]);
    });
    const ctx = {};
    handleFenceCapture('fenceCapture', {}, dir, ctx);
    return ctx;
  }

  it('拿不到 git 基准（不是 git 仓库）→ skip', () => {
    const ctx = {};
    // git 不是仓库：拍桩时拿不到 sha，回滚也没基准
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.startsWith('git')) throw new Error('fatal: not a git repository');
      return vitestJson([['a', 'passed']]);
    });
    handleFenceCapture('fenceCapture', {}, dir, ctx);
    const result = handleFenceRestore('fenceRestore', {}, dir, ctx);
    expect(result.status).toBe('skip');
  });

  it('工作区干净时用 HEAD 当回滚基准（不是拿空 sha 摆烂）', () => {
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('git stash create')) return '';
      if (cmd.includes('git rev-parse HEAD')) return 'headsha123';
      return vitestJson([['a', 'passed']]);
    });
    const ctx = {};
    handleFenceCapture('fenceCapture', {}, dir, ctx);
    const saved = JSON.parse(readFileSync(ctx.fenceSnapshotPath, 'utf-8'));
    expect(saved.snapshotSha).toBe('headsha123');
    expect(saved.restoreBase).toBe('head');
  });

  it('有快照 + 有改动 → 只回滚改动过的已跟踪文件', () => {
    const ctx = captureWithSha('deadbeefsha');
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.startsWith('git status --porcelain')) return [' M src/a.js', '?? src/b.js', ' M .claude/reports/fence-x.json', ''].join(NEWLINE);
      if (cmd.startsWith('git cat-file')) return '';
      return '';
    });
    const result = handleFenceRestore('fenceRestore', {}, dir, ctx);
    expect(result.status).toBe('pass');
    expect(ctx.fenceRestored).toBe(1);
    const cmd = mockSafeExec.mock.calls.at(-1)[0];
    expect(cmd).toContain('git checkout deadbeefsha -- src/a.js');
    // 未跟踪文件与引擎报告不能被回滚顺手删掉/checkout
    expect(cmd).not.toContain('src/b.js');
    expect(cmd).not.toContain('.claude/reports');
  });

  it('改动文件不在快照里 → skip 而不是硬 checkout 报错', () => {
    const ctx = captureWithSha('sha');
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.startsWith('git status --porcelain')) return [' M src/new.js', ''].join(NEWLINE);
      if (cmd.startsWith('git cat-file')) throw new Error('fatal: path does not exist');
      return '';
    });
    const result = handleFenceRestore('fenceRestore', {}, dir, ctx);
    expect(result.status).toBe('skip');
  });

  it('回滚命令失败 → warn（不谎报成功）', () => {
    const ctx = captureWithSha('sha');
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.startsWith('git status --porcelain')) return [' M src/a.js', ''].join(NEWLINE);
      if (cmd.startsWith('git cat-file')) return '';
      const err = new Error('pathspec did not match');
      throw err;
    });
    const result = handleFenceRestore('fenceRestore', {}, dir, ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('回滚失败');
  });

});

describe('围栏台账：每次拍桩/比对/回滚都留一行事件', () => {
  it('capture 追加 capture 事件（含用例数与通过数）', () => {
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.startsWith('git')) return '';
      return vitestJson([['a', 'passed'], ['b', 'failed']]);
    });
    handleFenceCapture('fenceCapture', {}, dir, {});
    const events = readEvents(dir);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'capture', testCount: 2, passed: 1, failed: 1 });
  });

  it('verify 无论越界与否都追加 verify 事件（violations 如实记）', () => {
    const ctx = {};
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.startsWith('git')) return '';
      return vitestJson([['a', 'passed']]);
    });
    handleFenceCapture('fenceCapture', {}, dir, ctx);
    mockSafeExec.mockImplementation(() => vitestJson([['a', 'failed']]));
    handleFenceVerify('fenceVerify', {}, dir, ctx);
    const events = readEvents(dir).filter((e) => e.type === 'verify');
    expect(events).toHaveLength(1);
    expect(events[0].violations).toBe(1);
  });

  it('restore 成功追加 restore 事件（restored/skipped 分开记）', () => {
    const ctx = {};
    mockSafeExec.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse')) return 'sha123';
      if (cmd.startsWith('git') && !cmd.startsWith('git status')) return '';
      if (cmd.startsWith('git status')) return [' M a.js', '?? b.js', ''].join(NEWLINE);
      return vitestJson([['a', 'passed']]);
    });
    handleFenceCapture('fenceCapture', {}, dir, ctx);
    handleFenceRestore('fenceRestore', {}, dir, ctx);
    const events = readEvents(dir).filter((e) => e.type === 'restore');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ restored: 1, skipped: 0 });
  });
});
