import { describe, it, expect, vi, afterEach } from 'vitest';
import { showScene, collectModes } from './show.js';

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

  it('打印模式清单，默认模式标记出来', async () => {
    const { text } = capture();
    await showScene('ui-polish');
    const out = text();
    expect(out).toContain('模式:');
    expect(out).toContain('ui_polish(默认)');
    expect(out).toContain('landing_page');
  });

  it('声明了默认模式的场景必须提示 --mode 是替换语义', async () => {
    const { text } = capture();
    await showScene('ui-polish');
    expect(text()).toContain('替换语义');
  });

  it('没有 selectModes 步骤的场景不打印模式行', async () => {
    const { text } = capture();
    await showScene('loop');
    const out = text();
    expect(out).not.toContain('替换语义');
    expect(collectModes({ flow: [] })).toEqual([]);
  });

  it('collectModes 同时接受字符串与对象形式的选项', () => {
    const scene = { flow: [{ action: 'selectModes', params: { options: ['a', { id: 'b', default: true }, { label: '无 id' }] } }] };
    expect(collectModes(scene)).toEqual([{ id: 'a', isDefault: false }, { id: 'b', isDefault: true }]);
  });
});
