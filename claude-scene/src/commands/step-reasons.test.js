// 第二十轮 ①②：「为什么不是 pass」必须说得出来。
//
// 前十九轮解决的是「状态对不对」，这一轮解决「原因说没说」：
//   - warn 一个数字混了五种来源（有发现 / 没说结论 / 一个字没返回 /
//     status 词不认识 / 正则猜的），读者分不出哪个要读报告、哪个要改处理器；
//   - skip 只有引擎自己判的那几种带 reason，处理器返回 { status:'skip' }
//     的那一百多处一个字原因都没有。
//
// 这里守两件事：① 类别由**声明**得出，不按文案猜；② 词表与代码里的字面量一致。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WARN_KINDS, SKIP_REASONS, warnKindLabel, skipReasonLabel, skipReasonFrom } from '../data/step-reasons.js';
import { deriveStepStatus, describeStatusBreakdown, describeNotPassSteps } from './start.js';

const SRC = join(import.meta.dirname, '..');

describe('warn 的来源分类', () => {
  it('处理器自己说有发现 → findings', () => {
    expect(deriveStepStatus({ status: 'warn', message: '发现 3 处' }, {}).warnKind).toBe('findings');
  });

  it('同义词 warning / partial / issues 也是「有发现」，不是「不认识」', () => {
    for (const status of ['warning', 'partial', 'issues']) {
      expect(deriveStepStatus({ status, message: 'x' }, {}).warnKind).toBe('findings');
    }
  });

  it('status 词不在词表里 → unknown-status（要人去改处理器，不是去读报告）', () => {
    expect(deriveStepStatus({ status: 'meh', message: 'x' }, {}).warnKind).toBe('unknown-status');
  });

  it('对象没布 status → contract', () => {
    const r = deriveStepStatus({ found: 3 }, {});
    expect(r.stepStatus).toBe('warn');
    expect(r.warnKind).toBe('contract');
  });

  it('处理器什么都没返回 → silent', () => {
    expect(deriveStepStatus(null, {}).warnKind).toBe('silent');
    expect(deriveStepStatus(' '.repeat(3), {}).warnKind).toBe('silent');
  });

  it('文案正则判出来的 warn → heuristic（引擎自己承认这是猜的）', () => {
    const r = deriveStepStatus('⚠ 发现 3 个问题', {});
    expect(r.stepStatus).toBe('warn');
    expect(r.warnKind).toBe('heuristic');
  });

  it('pass 不带类别 —— 没有原因可讲', () => {
    expect(deriveStepStatus('已安装 codegraph', {}).warnKind).toBeUndefined();
  });
});

describe('skip 的原因分类', () => {
  it('处理器没说原因 → handler-skip（明写「没说」，不是「其它」）', () => {
    expect(deriveStepStatus({ status: 'skip', message: '跳过' }, {}).skipReason).toBe('handler-skip');
  });

  it('处理器声明了词表内的原因 → 照抄', () => {
    expect(deriveStepStatus({ status: 'skip', reason: 'tool-missing', message: '没装 mobsfscan' }, {}).skipReason)
      .toBe('tool-missing');
    expect(deriveStepStatus({ status: 'skip', reason: ' permission ', message: 'x' }, {}).skipReason).toBe('permission');
  });

  it('处理器声明了词表外的原因 → 仍记 handler-skip，但原词不丢', () => {
    const r = skipReasonFrom({ status: 'skip', reason: 'no-tools' });
    expect(r.reason).toBe('handler-skip');
    expect(r.unknownDeclared).toBe('no-tools');
    expect(deriveStepStatus({ status: 'skip', reason: 'no-tools' }, {}).skipReason).toBe('handler-skip');
  });

  it('非 skip 状态不会被塞原因（避免把 fail 说成「跳过」）', () => {
    expect(deriveStepStatus({ status: 'fail', reason: 'tool-missing', message: 'x' }, {}).skipReason).toBeUndefined();
  });

  it('裸字符串 skip 判定（无 status 字段）不猜原因', () => {
    expect(deriveStepStatus('跳过：没有 pyproject.toml', {}).skipReason).toBeUndefined();
  });
});

describe('分布统计按最终状态现算', () => {
  it('把 warn / skip 拆开，并给出每种的数量', () => {
    const rows = [
      { status: 'pass' },
      { status: 'warn', warnKind: 'findings' },
      { status: 'warn', warnKind: 'findings' },
      { status: 'warn', warnKind: 'contract' },
      { status: 'skip', skipReason: 'condition' },
      { status: 'skip', skipReason: 'handler-skip' },
      { status: 'skip', skipReason: 'handler-skip' },
      { status: 'noop' },
    ];
    const b = describeStatusBreakdown(rows);
    expect(b.warn).toEqual(['有发现 2', '返回对象没布 status 1']);
    expect(b.skip).toEqual(['条件不满足 1', '处理器判为跳过但没声明原因 2']);
    // 第二十一轮新增 noop 桶：没布 noopReason 的老记录标「未分类」。
    expect(b.noop).toEqual(['未分类 1']);
    // counted = 落进桶的行数（warn 3 + skip 3 + noop 1），调用方拿它和计数行对账。
    expect(b.counted).toBe(7);
  });

  it('noop 也要说得出为什么无事可做', () => {
    const rows = [
      { status: 'noop', noopReason: 'already-done' },
      { status: 'noop', noopReason: 'tool-missing' },
      { status: 'noop', noopReason: 'tool-missing' },
    ];
    expect(describeStatusBreakdown(rows).noop).toEqual(['已经是最新 / 已存在，不用再做 1', '缺工具或依赖 2']);
  });

  it('重试把 warn 改成 pass 后，分布跟着变（不用减不回来的计数器）', () => {
    const rows = [{ status: 'pass', retried: true }];
    expect(describeStatusBreakdown(rows).warn).toEqual([]);
  });

  it('老记录没有类别 → 「未分类」，不假装知道', () => {
    expect(describeStatusBreakdown([{ status: 'warn' }]).warn).toEqual(['未分类 1']);
  });

  it('没有 warn / skip / noop 时给空数组（调用方据此决定打不打这行）', () => {
    expect(describeStatusBreakdown([{ status: 'pass' }])).toEqual({ warn: [], skip: [], noop: [], counted: 0 });
    expect(describeStatusBreakdown(null)).toEqual({ warn: [], skip: [], noop: [], counted: 0 });
  });
});

describe('未通过清单带原因', () => {
  it('warn 行写清是哪种 warn，skip 行写清为什么跳过', () => {
    const { lines } = describeNotPassSteps([
      { step: 4, action: 'aislop-scan', status: 'warn', warnKind: 'heuristic' },
      { step: 5, action: 'runAgent', status: 'skip', skipReason: 'tool-missing' },
      { step: 6, action: 'notify', status: 'pass' },
    ]);
    expect(lines).toEqual([
      'Step 4 aislop-scan → warn（文案像有发现（正则猜的））',
      'Step 5 runAgent → skip（缺工具或依赖）',
    ]);
  });

  it('没类别时行尾不加括号（宁缺不编）', () => {
    const { lines } = describeNotPassSteps([{ step: 1, action: 'x', status: 'fail' }]);
    expect(lines).toEqual(['Step 1 x → fail']);
  });
});

describe('词表与实际代码一致（防手滑写错类别）', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(SRC);
  const sources = files.map((f) => readFileSync(f, 'utf-8'));

  it('扫描范围非空（防「空跑变绿」）', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('代码里出现的 warnKind 字面量都在词表里', () => {
    const used = new Set();
    for (const text of sources) {
      for (const m of text.matchAll(/warnKind:\s*'([^']+)'/g)) used.add(m[1]);
    }
    // 至少要有 contract / silent / heuristic / unknown-status / findings 这几处
    expect(used.size).toBeGreaterThanOrEqual(4);
    const unknown = [...used].filter((k) => !WARN_KINDS.has(k));
    expect(unknown).toEqual([]);
  });

  it('代码里出现的 skip 原因字面量都在词表里', () => {
    const used = new Set();
    for (const text of sources) {
      for (const m of text.matchAll(/skipReason:\s*'([^']+)'/g)) used.add(m[1]);
      for (const m of text.matchAll(/reason:\s*'(condition|unjudged|user|engine-disabled|not-applicable|tool-missing|permission|input-missing|input-invalid|handler-skip)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThanOrEqual(2);
    const unknown = [...used].filter((k) => !SKIP_REASONS.has(k));
    expect(unknown).toEqual([]);
  });

  it('词表本身没有重复或空标签', () => {
    for (const map of [WARN_KINDS, SKIP_REASONS]) {
      expect(map.size).toBeGreaterThan(0);
      for (const [key, label] of map) {
        expect(key.trim()).toBe(key);
        expect(label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('标签函数对未知值出力而不是静默空串', () => {
    expect(warnKindLabel('zzz')).toContain('zzz');
    expect(skipReasonLabel('zzz')).toContain('zzz');
    expect(warnKindLabel()).toBe('');
    expect(skipReasonLabel(null)).toBe('');
  });
});
