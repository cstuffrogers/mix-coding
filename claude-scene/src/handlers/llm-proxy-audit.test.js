import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 第十二轮维度A：差分测试没配凭证 = 没测。
// 以前写 `context.diffTestConfigured = false`（门禁 diff_test 的旗标）却返回
// 「差分测试: 未配置 API 凭证，跳过」→ 步骤记 pass、门禁记 failed，两处矛盾。
const { mockDetect } = vi.hoisted(() => ({ mockDetect: vi.fn() }));
// 「配置完成」和「测出结果」是两件事，中间那段真发网络请求 —— 测试里换掉，
// 不拿宿主网络当夹具。
vi.mock('../lib/llm-proxy-detector.js', () => ({ detectProxyTampering: mockDetect }));

const { handleDiffTest } = await import('./llm-proxy-audit.js');

const KEYS = ['LLM_DIRECT_API_URL', 'LLM_DIRECT_API_KEY', 'LLM_PROXY_API_URL', 'LLM_PROXY_API_KEY'];

beforeEach(() => {
  for (const k of KEYS) vi.stubEnv(k, '');
  mockDetect.mockReset();
  mockDetect.mockRejectedValue(new Error('detector exploded'));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('handleDiffTest：没配凭证 → skip，不写门禁旗标', () => {
  it('四个凭据都为空 → skip，diffTestConfigured / diffTestCompleted 都不写', async () => {
    const context = {};
    const result = await handleDiffTest('diffTest', {}, process.cwd(), context);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('没测，不是通过');
    expect(context.diffTestConfigured).toBeUndefined();
    expect(context.diffTestCompleted).toBeUndefined();
  });

  it('凭据齐了 → diffTestConfigured = true（真测量），检测器崩了才是 fail', async () => {
    vi.stubEnv('LLM_DIRECT_API_URL', 'https://direct.example/v1');
    vi.stubEnv('LLM_DIRECT_API_KEY', 'k1');
    vi.stubEnv('LLM_PROXY_API_URL', 'https://proxy.example/v1');
    vi.stubEnv('LLM_PROXY_API_KEY', 'k2');
    const context = {};
    const result = await handleDiffTest('diffTest', {}, process.cwd(), context);
    expect(context.diffTestConfigured).toBe(true);
    expect(context.diffTestCompleted).toBe(false);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('detector exploded');
  });
});
