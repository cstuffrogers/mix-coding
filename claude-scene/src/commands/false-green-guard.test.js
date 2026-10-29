import { describe, it, expect, vi } from 'vitest';
import { deriveStepStatus, spinnerMethodFor, paintByStatus } from './start.js';
import { executeAction } from '../actions.js';
import { checkAcceptance } from '../lib/acceptance-check.js';

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

    it('显式 fail 必须置 lastStepFailed（否则 on_error=abort 白写）', () => {
      // handleStepError 的入口是 `if (!context.lastStepFailed) return` ——
      // 以前 lastStepFailed 只由文案正则置位，{ status: 'fail' } 又不会被正则看上
      // （非字符串），于是「显式报失败」的步骤被「on_error: abort」默默放过。
      const context = {};
      expect(deriveStepStatus({ status: 'fail', message: '单元测试存在失败用例' }, context).stepStatus).toBe('fail');
      expect(context.lastStepFailed).toBe(true);
      // 反向：别名 'error' / 'failed' 归一到 fail 时同样要置位
      const context2 = {};
      expect(deriveStepStatus({ status: 'error', message: 'EACCES: permission denied' }, context2).stepStatus).toBe('fail');
      expect(context2.lastStepFailed).toBe(true);
      // 非 fail 状态不许误置（warn/skip/noop/pass 都不是「失败即中止」的由头）
      for (const status of ['pass', 'warn', 'skip', 'noop']) {
        const ctx = {};
        deriveStepStatus({ status, message: 'x' }, ctx);
        expect(ctx.lastStepFailed).toBeUndefined();
      }
    });
  });

  describe('3. 未知动作必须留下痕迹', () => {
    it('ACTION_REGISTRY 里没有 → console.warn + 显式 skip（不许报「完成」/「warn」）', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const result = await executeAction('loop', 'definitelyNotAnAction', {}, {}, '.');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('未知动作'));
        // 第十七轮：状态从 warn 改成 skip —— warn 会被验收门禁当成「已审阅」，
        // 于是 `verify` 手滑写成 `verifyy` 也能 exit 0（实测假绿）。
        expect(result).toMatchObject({ status: 'skip' });
        // 文案里的承诺必须与事实一致：没处理器 = 没执行
        expect(result.message).toContain('没有执行');
        expect(result.message).toContain('不是通过');
        expect(result.message).not.toMatch(/完成|已/);
      } finally {
        warn.mockRestore();
      }
    });

    it('未知的验证动作不能把验收门禁逗过去（skip 不是已审阅）', async () => {
      // 实测过的假绿：`verify` 手滑成 `verifyy` → 以前回 warn → PASSING_RE 命中 →
      // 写了一堆东西也拿得到 exit 0。这里把两个模块接起来钉住。
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const result = await executeAction('loop', 'verifyy', {}, {}, '.');
        const { stepStatus } = deriveStepStatus(result, {});
        const flow = [
          { step: 1, action: 'writeFile' },
          { step: 2, action: 'verifyy' },
        ];
        const acceptance = checkAcceptance(flow, [1, 2], false, [
          { action: 'writeFile', status: 'warn' },
          { action: 'verifyy', status: stepStatus },
        ]);
        expect(acceptance.hasPassingVerify).toBe(false);
        expect(acceptance.unreviewedChange).toBe(true);
      } finally {
        warn.mockRestore();
      }
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
      expect(paintByStatus('skip', 'x')).toContain('⏭');
    });

    it('五种显式状态逐层透传：没有任何一种被洗成 pass/succeed', () => {
      const statuses = ['pass', 'warn', 'fail', 'skip', 'noop'];
      const seenSymbols = new Set();
      for (const status of statuses) {
        expect(deriveStepStatus({ status, message: 'x' }, {}).stepStatus).toBe(status);
        if (status !== 'pass') expect(spinnerMethodFor(status)).not.toBe('succeed');
        seenSymbols.add(paintByStatus(status, 'x').replace('x', ''));
      }
      // 防空跑：五种状态必须拿到五种不同的符号，不能有哪种混进别的颜色
      expect(seenSymbols.size).toBe(5);
    });
  });
});
