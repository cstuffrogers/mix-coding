import { describe, it, expect, vi, afterEach } from 'vitest';
import { showScene } from './show.js';

// `show` 曾经是一批空函数：触发词/优先级/MCP/hooks 全被静默吞掉，
// 只留下一串没有编号的描述。这些断言就是防止它再退化回去。
function capture() {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  return { spy, text: () => spy.mock.calls.map((c) => c.join(' ')).join('\n') };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('show 命令', () => {
  it('打印步骤编号与 action（不再只有描述）', async () => {
    const { text } = capture();
    await showScene('loop');
    const out = text();
    expect(out).toContain('📋 loop');
    expect(out).toMatch(/▶ \d/);
    expect(out).toContain('步骤');
  });

  it('打印触发关键词与默认迭代轮数', async () => {
    const { text } = capture();
    await showScene('loop');
    const out = text();
    expect(out).toContain('触发关键词');
    expect(out).toContain('默认迭代');
  });

  it('声明了 hooks 的场景要明说引擎不执行它们', async () => {
    const { text } = capture();
    await showScene('plan');
    const out = text();
    expect(out).toContain('harness hooks');
    expect(out).toContain('本引擎不执行');
    expect(out).toContain('pre_tool_use');
  });
});
