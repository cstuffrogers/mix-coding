// 第二十一轮 ①：「reason」这一列到底是什么？
//
// 二十轮下来，同一个 `reason` 字段上挤了四种词汇：
//   1. 跳过原因（condition / tool-missing / …，词表值）；
//   2. 事件注解（retry / interactive-answered / needs-answer）；
//   3. 中止散文（「验收阻断：变更未通过验证」，中文长句）；
//   4. 循环停止原因（max / clean / no-progress，只活在内存里）。
// 事后读日志的人只有一列可看，于是「reason=retry 的步骤」和「reason=tool-missing
// 的步骤」被当成同一个维度统计 —— 分布行里混进根本不存在的类别。
//
// 本轮定契约并钉住它：
//   - 步骤行的 `reason` 只装 SKIP_REASONS 的词（或 null）；
//   - `warn_kind` / `noop_kind` 各自一列（三种维度不挤一列）；
//   - 其它注解一律 `event_reason`；
//   - 循环停止原因 STOPS_REASONS 显式成表，不进日志。
//
// 静态守卫只认字面量：动态值（meta.skipReason 等）由运行期测试负责。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WARN_KINDS, SKIP_REASONS, NOOP_REASONS, STOP_REASONS, isSkipReason, warnKindFrom, noopReasonFrom,
} from '../data/step-reasons.js';
import { deriveStepStatus, buildEndLogEntry, buildRetryLogEntry, recordInteractiveStep } from './start.js';

const START_SRC = join(import.meta.dirname, 'start.js');

/** 去注释再去匹配：注释里提到 `reason: 'retry'` 不该被当成真代码 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

const literalsOf = (text, key) => [...text.matchAll(new RegExp(String.raw`\b${key}:\s*'([^']*)'`, 'g'))].map((m) => m[1]);

describe('reason 只装跳过原因（不再混事件注解/中止散文/停止原因）', () => {
  const code = stripComments(readFileSync(START_SRC, 'utf-8'));

  it('start.js 里 reason 的字符串字面量都在词表内（跳过原因 ∪ 停止原因）', () => {
    const found = literalsOf(code, 'reason');
    // 空跑自检：一个都没扫到说明扫描器坏了，这条测试就成了永远绿。
    expect(found.length).toBeGreaterThanOrEqual(6);
    const stray = found.filter((value) => !isSkipReason(value) && !STOP_REASONS.has(value));
    expect(stray, `reason 上出现了词表外的值：${JSON.stringify(stray)}`).toEqual([]);
  });

  it('事件注解落在 event_reason（重试 / 答过 / 需要人回答 / 中止）', () => {
    const events = literalsOf(code, 'event_reason');
    expect(events.length).toBeGreaterThanOrEqual(2);
    // 事件注解允许自由文本（中止原因是中文散文），只要求它别回到 reason 上。
    expect(events).toContain('retry');
    expect(events).toContain('interactive-answered');
    expect(events).toContain('needs-answer');
  });

  it('同一条日志不同时写 reason 和 event_reason（否则读者不知道该信哪个）', () => {
    // 判据只看单行：多行对象里两个键分居不同行，不属同一条记录；
    // 三元里两个分支互斥（answered ? {event_reason} : {reason}），也不属同一条。
    const offenders = code.split('\n')
      .filter((line) => /[{,]\s*reason:/.test(line) && /[{,]\s*event_reason:/.test(line))
      .filter((line) => !line.includes('?'));
    expect(offenders).toEqual([]);
  });
});

const BOGUS_KIND = ['kind-of', 'bad'].join('-');

describe('warnKind / noopReason：判定权在处理器，词表在引擎', () => {
  it('处理器声明的 warnKind 照抄（证据过期不是「有发现」）', () => {
    const r = deriveStepStatus({ status: 'warn', warnKind: 'stale-evidence', message: '记录来自 abc，当前 HEAD 是 def' }, {});
    expect(r.stepStatus).toBe('warn');
    expect(r.warnKind).toBe('stale-evidence');
  });

  it('声明的词不在词表里 → unknown-declared，不悄悄当「有发现」', () => {
    const declared = warnKindFrom({ status: 'warn', warnKind: BOGUS_KIND });
    expect(declared.kind).toBe('unknown-declared');
    expect(declared.unknownDeclared).toBe(BOGUS_KIND);
    expect(deriveStepStatus({ status: 'warn', warnKind: BOGUS_KIND, message: 'x' }, {}).warnKind).toBe('unknown-declared');
  });

  it('没声明 warnKind 时保持原语义：warn/warning/partial/issues = 有发现', () => {
    expect(deriveStepStatus({ status: 'warn', message: 'x' }, {}).warnKind).toBe('findings');
  });

  it('noop 必须说得出为什么无事可做', () => {
    expect(deriveStepStatus({ status: 'noop', message: '无需重复' }, {}).noopReason).toBe('undeclared');
    expect(deriveStepStatus({ status: 'noop', reason: 'already-done', message: '已是最新' }, {}).noopReason).toBe('already-done');
    expect(noopReasonFrom({ status: 'noop', reason: 'nope' })).toEqual({ reason: 'undeclared', unknownDeclared: 'nope' });
  });

  it('正则分支猜出的 noop 敢标「猜的」，猜不出具体种类就写 heuristic', () => {
    expect(deriveStepStatus('未安装 mobsfscan，跳过', {}).noopReason).toBe('tool-missing');
    expect(deriveStepStatus('已存在，跳过', {}).noopReason).toBe('already-done');
    expect(deriveStepStatus('无 .claude 配置目录', {}).noopReason).toBe('nothing-to-do');
    expect(deriveStepStatus('已跳过', {}).noopReason).toBe('heuristic');
  });

  it('词表非空且 warn / skip 互不混用；noop 复用的词必须同义', () => {
    expect(WARN_KINDS.size).toBeGreaterThanOrEqual(5);
    expect(SKIP_REASONS.size).toBeGreaterThanOrEqual(10);
    expect(NOOP_REASONS.size).toBeGreaterThanOrEqual(4);
    for (const key of WARN_KINDS.keys()) expect(SKIP_REASONS.has(key)).toBe(false);
    // noop 可以借 skip 的词（缺工具在两种状态里是同一件事），
    // 但同一个键在两表里的标签必须一致，否则同一个词在两个行上读起来是两回事。
    for (const [key, label] of NOOP_REASONS) {
      if (SKIP_REASONS.has(key)) expect(label).toBe(SKIP_REASONS.get(key));
    }
  });
});

describe('运行期形状：三种注解各走各的列', () => {
  it('重试行 / 终点事件写 event_reason，不写 reason', () => {
    const retry = buildRetryLogEntry({ step: { step: 1, action: 'a' }, status: 'fail', attempt: 1, context: {} });
    expect(retry.event_reason).toBe('retry');
    expect(retry.reason).toBeUndefined();
    const end = buildEndLogEntry({ aborted: '验收阻断：变更未通过验证' });
    expect(end.event_reason).toContain('验收阻断');
    expect(end.reason).toBeUndefined();
  });

  it('交互步骤：答过 → event_reason，没答 → reason（跳过原因）', () => {
    const answered = recordInteractiveStep({ step: 1, action: 'ask', params: {} }, { _stepDecision: 'ok' });
    expect(answered.event_reason).toBe('interactive-answered');
    expect(answered.reason).toBeUndefined();
    const skipped = recordInteractiveStep({ step: 2, action: 'ask', params: {} }, {});
    expect(skipped.reason).toBe('interactive');
    expect(isSkipReason(skipped.reason)).toBe(true);
    expect(skipped.event_reason).toBeUndefined();
  });
});

// 维度②的半边：词表在引擎里，声明在处理器里。只钉引擎一侧的话，
// 处理器可以随手写 `reason: 'whatever'`，运行期被悄悄降级成 undeclared ——
// 屏幕上一片「没声明原因」，而代码里明明写了。所以这里把处理器也扫一遍。
const HANDLERS_DIR = join(import.meta.dirname, '..', 'handlers');

function handlerFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) handlerFiles(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('处理器声明的 noop 原因必须在词表里', () => {
  it("status: 'noop' 旁边的 reason 字面量 ∈ NOOP_REASONS", () => {
    // 不写字面 '\n'：这个文件被脚本改过几次，转义容易被折成真换行。
    const NL = String.fromCodePoint(10);
    const files = handlerFiles(HANDLERS_DIR);
    // 空跑自检：目录扫空了，这条测试就成了永远绿。
    expect(files.length).toBeGreaterThan(60);
    const offenders = [];
    let declared = 0;
    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf-8')).split(NL);
      for (const [i, line] of lines.entries()) {
        if (!line.includes("status: 'noop'")) continue;
        // 对象可能跨行（status 一行、reason 下一行），看这一段内有没有 reason。
        const window = lines.slice(i, i + 4).join(NL);
        const at = window.indexOf("reason: '");
        if (at === -1) continue;
        const value = window.slice(at + 9, window.indexOf("'", at + 9));
        declared += 1;
        if (!NOOP_REASONS.has(value)) offenders.push(`${basename(file)}: ${value}`);
      }
    }
    // 全仓一处声明都没有也算失败：那说明只加了词表、没往处理器布线。
    expect(declared).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
