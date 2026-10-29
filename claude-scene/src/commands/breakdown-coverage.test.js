// 第二十一轮 ③：屏幕上的分布必须覆盖计数行说的那些步骤。
//
// 第二十轮加了「⚡ warn 细分 / ⏭ skip 细分」两行，可它统计的是
// `context.stepResults` —— 而条件跳过、交互跳过、需要人回答这三条路径
// 走 appendLog 而**不是** recordStepResult。真实 review 跑下来：
// 计数行写 `skip: 19`，细分行只解释得清 3 步。同一个屏幕上两条线对不上账，
// 比不给细分更糟：读者会把「没列出来的 16 步」当成没问题。
//
// 这一轮的修法不是在内存里再存一份账（内存和日志会各自跑偏），而是**直接读日志**：
// 屏幕上的事要能从日志里核出来，那日志就该是唯一真相。
//
// 同时守 ③-b：中止分支也不许把分布吞掉 —— 中止时最需要诊断信息。
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { breakdownCoverageGap, describeStatusBreakdown, loggedStepRows } from './start.js';
import { SKIP_REASONS, STOP_REASONS } from '../data/step-reasons.js';

let dir;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

function writeLog(lines) {
  dir = mkdtempSync(join(tmpdir(), 'log-schema-'));
  const path = join(dir, 'workflow.log');
  writeFileSync(path, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');
  return path;
}

describe('loggedStepRows：分布来自日志，不是内存里的第二份账', () => {
  it('条件跳过 / 交互跳过这些「不进 stepResults」的行也算进来', () => {
    const path = writeLog([
      { event: 'start', scene: 'review' },
      { step: 1, action: 'recall', status: 'pass', iteration: 1 },
      { step: 2, action: 'askUser', status: 'skip', reason: 'interactive' },
      { step: 3, action: 'runSuite', status: 'skip', reason: 'condition' },
    ]);
    const rows = loggedStepRows(path);
    expect(rows.map((r) => r.step)).toEqual([1, 2, 3]);
    const b = describeStatusBreakdown(rows);
    expect(b.skip).toEqual(['需要人回答但没人可问 1', '条件不满足 1']);
    expect(b.counted).toBe(2);
  });

  it('重试尝试行和终态事件不算「一步」：同一 step 取最后一行（终态）', () => {
    const path = writeLog([
      { step: 7, action: 'runSuite', status: 'fail', attempt: 1, event_reason: 'retry', iteration: 1 },
      { step: 7, action: 'runSuite', status: 'fail', attempt: 2, event_reason: 'retry', iteration: 1 },
      { step: 7, action: 'runSuite', status: 'pass', iteration: 1 },
      { event: 'end', status: 'completed' },
    ]);
    const rows = loggedStepRows(path);
    expect(rows).toEqual([{ step: 7, action: 'runSuite', status: 'pass', warnKind: undefined, skipReason: undefined, noopReason: undefined, iteration: 1 }]);
  });

  it('warn_kind / reason / noop_kind 三列各回各位', () => {
    const path = writeLog([
      { step: 1, action: 'a', status: 'warn', warn_kind: 'stale-evidence' },
      { step: 2, action: 'b', status: 'skip', reason: 'tool-missing' },
      { step: 3, action: 'c', status: 'noop', noop_kind: 'already-done' },
    ]);
    const b = describeStatusBreakdown(loggedStepRows(path));
    expect(b.warn).toEqual(['证据过期（对不上当前代码） 1']);
    expect(b.skip).toEqual(['缺工具或依赖 1']);
    expect(b.noop).toEqual(['已经是最新 / 已存在，不用再做 1']);
  });

  it('半截行 / 没有日志文件时不编造（返回空，调用方回退）', () => {
    const path = writeLog(['{"step": 1, "status": "pass"}', '{"step": 2, "stat']);
    expect(loggedStepRows(path).map((r) => r.step)).toEqual([1]);
    expect(loggedStepRows(join(dir, 'nope.log'))).toEqual([]);
    expect(loggedStepRows(null)).toEqual([]);
  });
});

describe('覆盖差：分布少了行必须说出来', () => {
  it('全覆盖 → 不吭声', () => {
    const rows = [
      { status: 'skip', skipReason: 'condition' },
      { status: 'warn', warnKind: 'findings' },
    ];
    expect(breakdownCoverageGap(describeStatusBreakdown(rows), { warn: 1, skip: 1, noop: 0 })).toBeNull();
  });

  it('计数 19 / 分布 3 → 点名差额（这就是第二十轮的真实形状）', () => {
    const rows = [{ status: 'skip', skipReason: 'handler-skip' }, { status: 'skip', skipReason: 'handler-skip' }, { status: 'skip', skipReason: 'handler-skip' }];
    const gap = breakdownCoverageGap(describeStatusBreakdown(rows), { warn: 0, skip: 19, noop: 0 });
    expect(gap).toContain('3/19');
    expect(gap).toContain('以计数行为准');
  });

  it('三项都是 0 → 不打印（没有可解释的东西，不是「覆盖不足」）', () => {
    expect(breakdownCoverageGap(describeStatusBreakdown([]), { warn: 0, skip: 0, noop: 0 })).toBeNull();
    expect(breakdownCoverageGap(null, { warn: 2 })).toContain('0/2');
  });
});

describe('中止分支不许吞掉诊断信息', () => {
  const code = readFileSync(join(import.meta.dirname, 'start.js'), 'utf-8');
  const body = code.slice(code.indexOf('function printSummary('));

  /** 从 `if (aborted) {` 的 { 开始，按花括号深度找出该块结束位置 */
  const abortedBlockEnd = () => {
    const start = body.indexOf('if (aborted) {');
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = body.indexOf('{', start); i < body.length; i += 1) {
      if (body[i] === '{') depth += 1;
      else if (body[i] === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    throw new Error('aborted 块没闭合');
  };

  it('分布行打在中止块之外（中止时也能看到为什么）', () => {
    const end = abortedBlockEnd();
    for (const needle of ['⚡ warn 细分', '⏭ skip 细分', '○ noop 细分']) {
      const at = body.indexOf(needle);
      expect(at, `printSummary 里找不到 ${needle}`).toBeGreaterThan(-1);
      expect(at, `${needle} 被包进了 if (aborted) 块，非中止运行就看不到了`).toBeGreaterThan(end);
    }
  });

  it('中止块里没有 return / process.exit（不会把后面的分布截掉）', () => {
    const end = abortedBlockEnd();
    expect(body.slice(0, end)).not.toContain('process.exit');
    const abortedPart = body.slice(body.indexOf('if (aborted) {'), end);
    expect(abortedPart).not.toContain('return');
  });
});

describe('停止原因不进日志（第四种词汇表）', () => {
  it('STOP_REASONS 与 SKIP_REASONS 互不重叠', () => {
    expect(STOP_REASONS.size).toBeGreaterThanOrEqual(6);
    for (const key of STOP_REASONS.keys()) expect(SKIP_REASONS.has(key)).toBe(false);
  });
});
