import { describe, it, expect, vi, beforeEach } from 'vitest';

// 「没跑成」的步骤必须自己说出来，别指望引擎靠措辞去猜 —— 猜错的代价是绿色的假绿。
const PROJ = String.fromCodePoint(46);
const hasMcpServer = vi.fn(() => false);
vi.mock('../../lib/mcp-config.js', () => ({
  hasMcpServer: (...args) => hasMcpServer(...args),
}));

const { handleRunAgent, handleRunUITest, handleMobsfScan } = await import('./agent.js');

beforeEach(() => {
  hasMcpServer.mockReset();
  hasMcpServer.mockReturnValue(false);
});

describe('对话中才执行的步骤：CLI 一律 skip，不冒充 pass', () => {
  it('runAgent 返回 skip（子代理在对话里跑，CLI 没跑）', () => {
    const ctx = {};
    const result = handleRunAgent('runAgent', { agent: 'mobile-security' }, PROJ, ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('mobile-security');
    expect(result.message).toContain('未运行');
    // 旗子仍要登记：场景后面的门禁靠它判断「这个 agent 被要求过」
    expect(ctx.agent_mobile_security_run).toBe(true);
  });

  it('runAgent 不带 agent 参数时也有名字，不会打印 undefined', () => {
    const result = handleRunAgent('runAgent', {}, PROJ, {});
    expect(result.message).toContain('mobile-security');
    expect(result.message).not.toContain('undefined');
  });

  it('没装 detox → UI 测试 skip 并点名工具', () => {
    const result = handleRunUITest('runUITest', { tool: 'maestro' }, PROJ, {});
    expect(result.status).toBe('skip');
    expect(result.message).toContain('maestro');
    expect(result.message).toContain('未执行');
  });

  it('装了 detox 也只算 skip：真正执行发生在对话里', () => {
    hasMcpServer.mockReturnValue(true);
    const ctx = {};
    const result = handleRunUITest('runUITest', {}, PROJ, ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('本轮未运行');
    expect(ctx.ui_test_run).toBe(true);
  });

  it('MCP 扫描没跑时不说「0 个高危」', () => {
    const result = handleMobsfScan('mobsfScan', {}, PROJ, {});
    expect(result).toContain('未执行');
    expect(result).toContain('不计为通过');
    expect(result).not.toMatch(/0\s*个/);
  });
});
