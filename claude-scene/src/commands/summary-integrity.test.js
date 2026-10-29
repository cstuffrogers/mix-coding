import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitCodeForSummary, summaryMismatch, buildEndLogEntry } from './start.js';

// 维度：收尾的两件事 —— 汇总自洽 + 退出码说实话。
//
// ① 「一个步骤不该在汇总里出现两行」以前只能靠眼睛：total 与分项合计没人核对，
//    重试路径漏减一次就永久静默。
// ② 更严重的是退出码：`startScene` 收尾只打印汇总、从不设退出码，
//    于是 fail: 3 的工作流 exit 0 —— CI 和 agent 都把「跑完了」读成「全绿」。
//    我们自己的规矩是「退出码是权威，文案不是」，那就不能让权威说谎。
//
// ③ 中止路径必须自称中止：gateBlocked / abort / 验收阻断以前都打印一行绿色的
//    「✓ pass: N ✗ fail: 0」再退出，最后一眼看到的是全绿。

const START_SRC = join(dirname(fileURLToPath(import.meta.url)), 'start.js');

describe('summaryMismatch：total 与分项合计必须对齐', () => {
  it('对齐 → null', () => {
    expect(summaryMismatch({ total: 5, pass: 2, fail: 1, skip: 1, noop: 1, warn: 0 })).toBeNull();
  });

  it('有步骤被记了两次 → 报出差额', () => {
    // 重试路径重复 total++ 却没进桶（或反之）时的形状
    expect(summaryMismatch({ total: 6, pass: 2, fail: 1, skip: 1, noop: 1, warn: 0 })).toEqual({ total: 6, sum: 5, diff: 1 });
    expect(summaryMismatch({ total: 4, pass: 2, fail: 1, skip: 1, noop: 1, warn: 0 })).toEqual({ total: 4, sum: 5, diff: -1 });
  });

  it('缺字段按 0 处理；非对象 → null（不炸）', () => {
    expect(summaryMismatch({ total: 2, pass: 2 })).toBeNull();
    expect(summaryMismatch(null)).toBeNull();
    expect(summaryMismatch()).toBeNull();
  });
});

describe('exitCodeForSummary：失败步骤数决定退出码', () => {
  it('有失败 → 1，哪怕流程跑完了', () => {
    expect(exitCodeForSummary({ fail: 3, pass: 10 })).toBe(1);
    expect(exitCodeForSummary({ fail: 1 })).toBe(1);
  });

  it('没有失败 → 0（warn / skip / noop 不算失败）', () => {
    expect(exitCodeForSummary({ fail: 0, warn: 4, skip: 9, noop: 6 })).toBe(0);
    expect(exitCodeForSummary({ pass: 3 })).toBe(0);
    expect(exitCodeForSummary()).toBe(0);
  });
});

describe('中止路径必须自称中止（不是打印一行绿色计数就退出）', () => {
  const src = readFileSync(START_SRC, 'utf-8');

  // 极窄的判据：紧跟着 printSummary 的 exit 就是「中止但不说中止」。
  // 逐行扫而不是正则：`printSummary(...)` 里包含括号和反引号，
  // 一把正则要么漏要么回溯爆炸（sonarjs super-linear-regex）。
  const exitAfterSummary = (text) => {
    const lines = text.split('\n');
    const calls = [];
    lines.forEach((line, i) => {
      if (!line.includes('printSummary(')) return;
      if (!(lines[i + 1] || '').trimStart().startsWith('process.exit')) return;
      calls.push(line.trim());
    });
    return calls;
  };

  it('没有任何「打印汇总后直接 process.exit」的中止点缺 aborted 说明', () => {
    const calls = exitAfterSummary(src);
    const offenders = calls.filter((call) => !call.includes('aborted'));
    expect(calls.length).toBeGreaterThanOrEqual(6);
    expect(offenders, `这些中止路径没告诉读者「这条运行没跑完」：\n${offenders.join('\n')}`).toEqual([]);
  });

  it('中止判据真的能失败（不是空转）', () => {
    // 合成一段「只说计数、不说中止」的收尾，判据必须点名它
    const fake = '    printSummary(sceneId, context);\n    process.exit(1);\n';
    const calls = exitAfterSummary(fake);
    expect(calls).toHaveLength(1);
    expect(calls.filter((call) => !call.includes('aborted'))).toHaveLength(1);
    // 真实源码上：中止标记与文案都在
    expect(src).toContain('⛔ 工作流已中止');
    expect(src).toContain('上面的计数只是中止前的部分结果');
  });
});

// 维度：中止不能把「已经跑成的步骤」一起吞了。
// 日志以前只有一条 start 事件，事后读它分不清「中止在这」和「日志被截断」；
// 屏幕上的中止汇总又只列未通过的步骤，读者无法知道哪些成果可以复用。
describe('中止的证据：日志有终点，屏幕有已完成的步骤', () => {
  const src = readFileSync(START_SRC, 'utf-8');

  it('终点事件带状态与原因，中止时实话实说', () => {
    const aborted = buildEndLogEntry({ aborted: '验收阻断：变更未通过验证', context: { completedSteps: [1, 2, 3] } });
    expect(aborted.event).toBe('end');
    expect(aborted.status).toBe('aborted');
    // 第二十一轮：`reason` 只装 SKIP_REASONS 的词（「这步为什么不是 pass」）；
    // 中止原因是中文散文，混进去会让「reason 必须出自词表」这条不变量失效。
    expect(aborted.event_reason).toContain('验收阻断');
    expect(aborted.reason).toBeUndefined();
    expect(aborted.completed_steps).toBe(3);
    expect(aborted.summary).toMatchObject({ total: expect.any(Number), pass: expect.any(Number) });
    const done = buildEndLogEntry({ context: null });
    expect(done.status).toBe('completed');
    expect(done.event_reason).toBeNull();
    expect(done.completed_steps).toBe(0);
    expect(done.iterations_planned).toBe(1);
  });

  it('printSummary 是唯一终点，且它真的写终点事件', () => {
    // 静态判据：写出终点的事件必须在 printSummary 里，否则总有退出路径漏记
    expect(src).toContain('appendLog(buildEndLogEntry({ aborted, context }))');
    const summaryFn = src.slice(src.indexOf('function printSummary('));
    const body = summaryFn.slice(0, summaryFn.indexOf('\n}\n'));
    expect(body).toContain('buildEndLogEntry');
    expect(body).toContain('printCompletedSteps(context)');
  });

  it('中止时一律给日志路径（屏幕只是一半）', () => {
    // 以前只在 fail/noop/warn/未判定 时才打印 LOG_PATH，awaiting-answer 这类中止
    // 可能一条 fail 都没有 → 用户手上没有任何可核对的全量记录。
    expect(/fail > 0[^\n]*\|\| aborted\s*\)/.test(src)).toBe(true);
  });
});
