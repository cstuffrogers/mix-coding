import { describe, it, expect } from 'vitest';
import { handleAnalyzeBundle } from './optimize.js';

// Bundle 分析在 CLI 下不执行（noop），但场景里声明的 `tool: "auto"` 必须被读到：
// 第十三轮之前这个键属于「写了没人读」，agent 拿到 noop 后完全不知道用什么工具做。
describe('handleAnalyzeBundle：不执行也要把声明的工具说清楚', () => {
  it('透传场景声明的 tool', () => {
    const result = handleAnalyzeBundle('analyzeBundle', { tool: 'webpack-bundle-analyzer' }, '', {});
    expect(result.status).toBe('noop');
    expect(result.message).toContain('webpack-bundle-analyzer');
  });

  it('没声明 tool 时明说未声明，不猜一个假工具名', () => {
    const result = handleAnalyzeBundle('analyzeBundle', {}, '', {});
    expect(result.message).toContain('未声明');
  });

  it('仍然只登记旗标，不冒充已测量', () => {
    const ctx = {};
    const result = handleAnalyzeBundle('analyzeBundle', { tool: 'auto' }, '', ctx);
    expect(ctx.bundle_analyzed).toBe(true);
    expect(result.status).toBe('noop');
    expect(result.message).not.toMatch(/分析完成|已分析/);
  });
});
