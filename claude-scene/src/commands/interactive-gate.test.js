import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));

const { default: inquirer } = await import('inquirer');
const {
  handleConfirmation, handleOptionSelection, renderPromptText, deriveStepStatus,
  handleConfirmDialog, choiceToConfirm,
} = await import('./start.js');
const { handleChoose, handleAskUser } = await import('../handlers/flow-control.js');
const { handleDesignInput } = await import('../handlers/design.js');

/**
 * 「--auto 静默替用户拍板」的哨兵（第二批）。
 *
 * review 的 2.68 修好之后，同类坑还有 5 处，且后果更重：
 *   - release 6 选版本类型：`handleChoose` 取 options[0] === major → 静默大版本发布 + 打 tag
 *   - rollback 5 二次确认：`handleConfirmation` auto 下 user_confirmed = true → 回滚照做
 *   - feature 9 「是否提交代码」：同上 → commitPush(push_remote: true) 直接推远程
 *   - optimize 7/10、refactor 12、ui-polish 6、mobile-release 4：同上
 *   - deps 5 / optimize 4：单选步骤静默取第一项
 *
 * 统一约束：没有真终端、命令行也没表态时，一律记 _awaitingAnswer 交给 runStep 中止（exit 2），
 * 不写默认值、不装通过、也不静默取第一项。
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCENES = join(SRC, '..', 'scenes');


beforeEach(() => {
  inquirer.prompt.mockReset();
});

describe('handleConfirmation：--auto 下不再自动「点头」', () => {
  const step = {
    step: 9,
    action: 'confirm',
    auto_execute: false,
    description: '确认后提交代码',
    params: { message: '是否提交代码？' },
  };

  it('--auto 且没表态 → 不设 user_confirmed，记 awaiting', async () => {
    const context = {};
    expect(await handleConfirmation(step, { auto: true }, context)).toBe(true);

    expect(context.user_confirmed).toBeUndefined();
    expect(context._awaitingAnswer).toEqual(expect.objectContaining({
      prompt: '是否提交代码？',
      label: '确认后提交代码',
    }));
  });

  it('--yes → 确认（紧接着的 commitPush 才会执行）', async () => {
    const context = {};
    await handleConfirmation(step, { auto: true, yes: true }, context);
    expect(context.user_confirmed).toBe(true);
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('--decline → 拒绝，且不会误设成 true', async () => {
    const context = {};
    await handleConfirmation(step, { auto: true, decline: true }, context);
    expect(context.user_confirmed).toBe(false);
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('场景显式声明 auto_confirm: true 时才允许自动放行', async () => {
    const context = {};
    await handleConfirmation(
      { ...step, params: { ...step.params, auto_confirm: true } },
      { auto: true },
      context,
    );
    expect(context.user_confirmed).toBe(true);
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('真终端（无 --auto）照问不误', async () => {
    inquirer.prompt.mockResolvedValue({ proceed: true });
    const context = {};
    await handleConfirmation(step, {}, context);
    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    expect(context.user_confirmed).toBe(true);
  });

  it('模板变量会被渲染，用户看到的是真实内容而不是 ${selected_version}', async () => {
    const context = { selected_version: 'v1.2.0' };
    await handleConfirmation(
      { step: 5, action: 'confirm', params: { message: '确认回滚到 ${selected_version}？' } },
      { auto: true },
      context,
    );
    expect(context._awaitingAnswer.prompt).toBe('确认回滚到 v1.2.0？');
  });
});

describe('handleOptionSelection：不再默认取第一项', () => {
  const releaseStep = {
    step: 6,
    action: 'choose',
    auto_execute: false,
    description: '选择语义化版本升级类型',
    params: {
      message: '请选择版本升级类型：',
      options: [{ label: 'major' }, { label: 'minor' }, { label: 'patch' }],
    },
  };

  it('--auto 且没表态 → 不写 selectedOption，记 awaiting（旧行为是 major）', async () => {
    const context = {};
    expect(await handleOptionSelection(releaseStep, { auto: true }, context, 'release')).toBe(true);

    expect(context.selectedOption).toBeUndefined();
    expect(context._awaitingAnswer).toEqual(expect.objectContaining({ step: 6 }));
    expect(context._awaitingAnswer.hints[0].text).toContain('minor');
  });

  it('--choice minor → 用命令行给的值', async () => {
    const context = {};
    await handleOptionSelection(releaseStep, { auto: true, choice: 'minor' }, context, 'release');
    expect(context.selectedOption).toBe('minor');
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('--choice 传了不认识的值 → 不静默回落默认，仍然中止', async () => {
    const context = {};
    await handleOptionSelection(releaseStep, { auto: true, choice: 'mega' }, context, 'release');
    expect(context.selectedOption).toBeUndefined();
    expect(context._awaitingAnswer).toBeDefined();
  });

  it('场景声明的 auto_default 才会被采用（deps 的「安全更新」）', async () => {
    const context = {};
    await handleOptionSelection(
      {
        step: 5,
        action: 'choose',
        auto_execute: false,
        params: {
          message: '选择更新策略：',
          options: [{ label: '安全更新' }, { label: '全量更新' }],
          auto_default: '安全更新',
        },
      },
      { auto: true },
      context,
      'deps',
    );
    expect(context.selectedOption).toBe('安全更新');
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('动态选项（rollback 的 recent_releases）→ 要人给目标，不再「无可用选项」通过', async () => {
    const context = {};
    await handleOptionSelection(
      {
        step: 3,
        action: 'choose',
        auto_execute: false,
        description: '选择回滚目标版本',
        params: { message: '请选择要回滚到的版本：', options: [], dynamic_options: 'recent_releases' },
      },
      { auto: true },
      context,
      'rollback',
    );
    expect(context._awaitingAnswer.prompt).toContain('recent_releases');
    expect(context._awaitingAnswer.hints[0].flag).toContain('--choice');
  });

  it('真终端（无 --auto）走 inquirer list', async () => {
    inquirer.prompt.mockResolvedValue({ selectedOption: 'patch' });
    const context = {};
    await handleOptionSelection(releaseStep, {}, context, 'release');
    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    expect(context.selectedOption).toBe('patch');
  });
});

describe('假绿修复：没做的事不许记 pass', () => {
  function statusOf(result, context = {}) {
    return deriveStepStatus(result, { lastStepFailed: false, ...context });
  }

  it('status:"interactive" → skip（以前渲染成「步骤已完成」记 pass）', () => {
    const { stepStatus, resultStr } = statusOf({ status: 'interactive', prompt: '请提供任务目标' });
    expect(stepStatus).toBe('skip');
    expect(resultStr).toContain('请提供任务目标');
  });

  it('handleDesignInput 没拿到值 → warn', () => {
    const context = {};
    const r = handleDesignInput('input', { key: 'missing_env_vars' }, '/tmp', context);
    expect(r.status).toBe('warn');
    expect('missing_env_vars' in context).toBe(false);
  });

  it('handleChoose 没有答案 → fail（不是 pass）', () => {
    const { stepStatus } = statusOf(handleChoose('choose', { options: ['a', 'b'] }, '/tmp', {}));
    expect(stepStatus).toBe('fail');
  });

  it('handleAskUser 永远要人回答 → fail', () => {
    const { stepStatus } = statusOf(handleAskUser('askUser', { prompt: '确认？' }, '/tmp', {}));
    expect(stepStatus).toBe('fail');
  });
});

describe('renderPromptText', () => {
  it('渲染已知变量，保留未知变量原样', () => {
    expect(renderPromptText('回滚到 ${v} / ${unknown}', { v: 'v1.0.0' }))
      .toBe('回滚到 v1.0.0 / ${unknown}');
  });
});

/**
 * 闸门输出必须长得像「选项」，不是一串 flag。
 * 用户原话：「怎么还是没有 sweep 的选项」—— 旧文案把 -S 和 --skip-sweep 并成
 * 一行「sweep 专用表态」，看的人根本分不出哪个是「跑」哪个是「不跑」。
 */
describe('confirm 闸门：sweep 必须作为两个可选项出现', () => {
  const sweepStep = {
    step: 2.68,
    action: 'askUser',
    description: '询问是否在审查前现场跑一次探测器自检',
    params: {
      type: 'confirm',
      prompt: '是否现在现场跑一次探测器自检？',
      context_flag: 'withSweep',
      flag_label: '探测器自检 sweep',
      ask_even_in_auto: true,
    },
  };

  it('hints[0] 是「跑」(-S/--with-sweep)，hints[1] 是「不跑」(--skip-sweep)', async () => {
    const context = {};
    await handleConfirmDialog(sweepStep, { auto: true }, context);
    const hints = context._awaitingAnswer.hints;
    expect(hints).toHaveLength(2);
    expect(hints[0].flag).toContain('--with-sweep');
    expect(hints[0].text).toContain('跑');
    expect(hints[1].flag).toContain('--skip-sweep');
    expect(hints[1].text).toContain('不跑');
  });

  it('非 sweep 的普通确认步骤不搮 sweep 专用 flag', async () => {
    const step = {
      step: 9,
      action: 'confirm',
      description: '是否提交代码',
      params: { type: 'confirm', prompt: '是否提交代码并推远程？', context_flag: 'commitCode' },
    };
    const context = {};
    await handleConfirmDialog(step, { auto: true }, context);
    const flags = context._awaitingAnswer.hints.map((h) => h.flag).join(' ');
    expect(flags).not.toContain('sweep');
    expect(flags).toContain('--yes');
    expect(flags).toContain('--decline');
  });

  it('--choice 1 = 跑，--choice 2 = 不跑（用户按序号回答就能重跑）', async () => {
    const runCtx = {};
    await handleConfirmDialog(sweepStep, { auto: true, choice: '1' }, runCtx);
    expect(runCtx.withSweep).toBe(true);
    expect(runCtx._awaitingAnswer).toBeUndefined();

    const skipCtx = {};
    await handleConfirmDialog(sweepStep, { auto: true, choice: '2' }, skipCtx);
    expect(skipCtx.withSweep).toBe(false);
    expect(skipCtx._awaitingAnswer).toBeUndefined();
  });

  it('--choice 给了不懂的值：不静默取默认，仍然停在闸门', async () => {
    const context = {};
    await handleConfirmDialog(sweepStep, { auto: true, choice: 'maybe' }, context);
    expect(context.withSweep).toBeUndefined();
    expect(context._awaitingAnswer.step).toBe(sweepStep.step);
  });

  it('choiceToConfirm 认序号与原文，不认一律 undefined', () => {
    expect(choiceToConfirm('1')).toBe(true);
    expect(choiceToConfirm('跑')).toBe(true);
    expect(choiceToConfirm('2')).toBe(false);
    expect(choiceToConfirm('不跑')).toBe(false);
    expect(choiceToConfirm('')).toBeUndefined();
    expect(choiceToConfirm('maybe')).toBeUndefined();
  });
});

describe('场景数据：危险默认不再存在', () => {
  const load = (name) => JSON.parse(readFileSync(join(SCENES, `${name}.json`), 'utf8'));
  const stepOf = (name, num) => load(name).flow.find((s) => s.step === num);

  it('release 6（版本类型）不声明 auto_default —— 大版本发布必须人定', () => {
    expect(stepOf('release', 6).params.auto_default).toBeUndefined();
  });

  it('rollback 5（二次确认）不声明 auto_confirm', () => {
    const step = stepOf('rollback', 5);
    expect(step.params.auto_confirm).toBeUndefined();
    expect(step.params.validation.required_ack).toBe(true);
  });

  it('feature 9（是否提交代码）不声明 auto_confirm', () => {
    expect(stepOf('feature', 9).params.auto_confirm).toBeUndefined();
  });

  it('deps 5 的默认是显式声明的「安全更新」', () => {
    expect(stepOf('deps', 5).params.auto_default).toBe('安全更新');
  });
});

/**
 * 项目覆盖层（.claude/scenes）与随包分发层（claude-scene/scenes）是两份拷贝：
 * 改动只写一边就等于没改（2.68 那轮就踩过）。这里用测试把两者钉在一起。
 */
describe('overlay 与 packaged 场景不许漂移', () => {
  const OVERLAY = join(SRC, '..', '..', '.claude', 'scenes');

  for (const file of readdirSync(OVERLAY).filter((f) => f.endsWith('.json'))) {
    it(`${file} 两份内容一致`, () => {
      const overlay = JSON.parse(readFileSync(join(OVERLAY, file), 'utf8'));
      const packaged = JSON.parse(readFileSync(join(SCENES, file), 'utf8'));
      expect(overlay).toEqual(packaged);
    });
  }
});
