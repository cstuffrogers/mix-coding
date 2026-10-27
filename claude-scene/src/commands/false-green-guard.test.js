import { describe, it, expect, vi } from 'vitest';
import { deriveStepStatus, spinnerMethodFor, paintByStatus } from './start.js';
import { executeAction } from '../actions.js';

/**
 * 假绿哨兵：这一类「看起来通过了，其实什么都没发生」的缺陷在本仓库出现过 4 种形态。
 * 前几轮都是逐条修实例；这个文件按**类**锁死，实例再冒出来就直接红。
 *
 *   1. 处理器忘了 return / 走了空分支 → 空结果默认记 pass
 *   2. 处理器明确说「我没跑成」→ 'skip' 落进 default 记 pass
 *   3. 未知动作 → 兜底文案 → ✓ pass
 *   4. 失败步骤 → spinner.succeed + 绿色 ✔
 */

describe('假绿哨兵', () => {
  describe('1. 空结果不得默认 pass', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['空字符串', ''],
      ['纯空白', '   \n\t '],
    ])('%s → warn 而非 pass', (_label, result) => {
      const { stepStatus, resultStr } = deriveStepStatus(result, {});
      expect(stepStatus).toBe('warn');
      expect(resultStr).toContain('没有返回任何结果');
    });

    it('正常文本仍然是 pass（别把守卫做成噪声）', () => {
      expect(deriveStepStatus('已安装 codegraph', {}).stepStatus).toBe('pass');
    });
  });

  describe("2. 处理器显式 'skip' 不被当成 pass", () => {
    it.each(['skip', 'noop', 'warn', 'fail', 'pass'])('显式 %s 原样透传', (status) => {
      expect(deriveStepStatus({ status, message: 'x' }, {}).stepStatus).toBe(status);
    });
  });

  describe('3. 未知动作必须留下痕迹', () => {
    it('既不在注册表也没有消息模板 → console.warn + context.unknownAction', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const context = {};
      await executeAction('loop', 'definitelyNotAnAction', {}, context, '.');
      expect(context.unknownAction).toBe('definitelyNotAnAction');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('未知动作'));
      warn.mockRestore();
    });
  });

  describe('4. 逐行输出跟随状态', () => {
    it('fail 用 spinner.fail（不能再 succeed 打绿勾）', () => {
      expect(spinnerMethodFor('fail')).toBe('fail');
      expect(spinnerMethodFor('pass')).toBe('succeed');
      expect(spinnerMethodFor('warn')).not.toBe('succeed');
      expect(spinnerMethodFor('noop')).not.toBe('succeed');
      // 跳过也不能打 ✔（否则「没跑」和「跑过且干净」在屏幕上一样）
      expect(spinnerMethodFor('skip')).toBe('info');
    });

    it('paintByStatus 给非通过状态加不同符号', () => {
      expect(paintByStatus('fail', 'x')).toContain('✖');
      expect(paintByStatus('warn', 'x')).toContain('⚡');
      expect(paintByStatus('noop', 'x')).toContain('○');
    });
  });
});
