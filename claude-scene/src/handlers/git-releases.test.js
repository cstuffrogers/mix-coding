import { describe, it, expect, vi, beforeEach } from 'vitest';

// 场景里 `rollback` 声明了 `limit: 10`，而命令里写死 `--limit 10` ——
// 改场景等于没改（第十三轮修的真静默失效）。这里断言声明的值真的进了命令。
const state = vi.hoisted(() => ({ calls: [] }));
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (cmd) => {
    state.calls.push(cmd);
    return { toString: () => 'v1.0.0' };
  },
  escapeArg: String,
}));

const { handleListReleases } = await import('./git.js');

beforeEach(() => {
  state.calls.length = 0;
});

describe('handleListReleases：声明的 limit 必须进命令', () => {
  it('参数缺省时用 10', () => {
    handleListReleases('listReleases', {}, 'proj');
    expect(state.calls[0]).toContain('--limit 10');
  });

  it('声明 limit=25 → 命令带 25', () => {
    handleListReleases('listReleases', { limit: 25 }, 'proj');
    expect(state.calls[0]).toContain('--limit 25');
  });

  it.each([0, -3, 'many', 1.5, null])('垃圾值 %s 回落到 10（不把非法值塞进命令）', (bad) => {
    handleListReleases('listReleases', { limit: bad }, 'proj');
    expect(state.calls[0]).toContain('--limit 10');
  });
});
