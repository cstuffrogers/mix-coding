import { describe, it, expect } from 'vitest';
import { handleExecuteOptimize, handleRemeasure, handleGenerateOptimizePlan } from './optimize.js';

// 这一组守的是「报告里写的话必须是真发生的事」：
// 以前 executeOptimize 凭空 push 两条字符串就报「2 项应用」，一行代码没改；
// remeasure 只塞一个时间戳就报「重新测量完成」，一个指标没测。
describe('handleExecuteOptimize：建议不许冒充「已应用」', () => {
  it('不写 optimize_applied 这种假旗子', () => {
    const ctx = {};
    handleExecuteOptimize('executeOptimize', { auto_fix_only: true }, '', ctx);
    expect(ctx.optimize_applied).toBeUndefined();
    expect(ctx.optimize_skipped).toBeUndefined();
  });

  it('显式 noop，文案里说清「没有修改任何代码」', () => {
    const ctx = {};
    const r = handleExecuteOptimize('executeOptimize', { auto_fix_only: true }, '', ctx);
    expect(r.status).toBe('noop');
    expect(r.message).toContain('没有修改任何代码');
    expect(r.message).not.toMatch(/执行完成|已应用/);
    expect(ctx.optimize_suggestions).toHaveLength(2);
    expect(ctx.optimize_needs_manual).toHaveLength(2);
  });

  it('auto_fix_only=false 时候选更多（列出全部待人工确认项）', () => {
    const ctx = {};
    const r = handleExecuteOptimize('executeOptimize', { auto_fix_only: false }, '', ctx);
    expect(ctx.optimize_suggestions).toHaveLength(4);
    expect(ctx.optimize_needs_manual).toEqual([]);
    expect(r.message).toContain('4 项待做建议');
  });
});

describe('handleRemeasure：没测就是没测', () => {
  it('基线全是 device_required 时 noop，并点名缺哪些指标', () => {
    const ctx = { performance_baseline: { bundle_size: 'device_required', fps: 'device_required' } };
    const r = handleRemeasure('remeasure', {}, '', ctx);
    expect(r.status).toBe('noop');
    expect(r.message).toContain('bundle_size');
    expect(r.message).not.toContain('重新测量完成');
    expect(ctx.remeasure_result.measured).toBe(false);
    expect(ctx.remeasure_result.missing).toEqual(['bundle_size', 'fps']);
  });

  it('没有基线时同样不发「完成」，说明无对比数据', () => {
    const r = handleRemeasure('remeasure', {}, '', {});
    expect(r.status).toBe('noop');
    expect(r.message).toContain('没有性能基线');
  });
});

describe('handleGenerateOptimizePlan：prioritize 真的进结论', () => {
  it('impact / effort 两种排序分别可读', () => {
    expect(handleGenerateOptimizePlan('generateOptimizePlan', { prioritize: 'impact' }, '', {})).toContain('按收益排序');
    expect(handleGenerateOptimizePlan('generateOptimizePlan', { prioritize: 'effort' }, '', {})).toContain('按成本排序');
  });
});
