import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));

const { default: inquirer } = await import('inquirer');
const {
  handleConfirmation, handleOptionSelection, renderPromptText, deriveStepStatus,
  handleConfirmDialog, choiceToConfirm, handleInteractiveStep, recordInteractiveStep,
  resolveThemeChoice, brandConsent, buildSceneContext, resolveModeOverride,
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

/**
 * 全场景巡检：每个「要人回答」的步骤，在 --auto 且命令行没有任何表态时，
 * 只允许三种结局，绝不允许第四种（什么都不发生却被记 pass/skip）：
 *   A 抛出问题（_awaitingAnswer → runStep exit 2）
 *   B 用场景里**显式声明**的默认值（并存进 context，屏幕上也打印出来）
 *   C 交给自动处理器（返回 false，如 prompt 框架载入、跑测试这类不需要拍板的步骤）
 * 以前 review 2.68 的静默默认就是「哪种都不是」，只在日志里写一行 skip。
 */
describe('全场景交互步骤：不替用户拍板', () => {
  const SCENE_DIR = join(SRC, '..', 'scenes');
  const files = readdirSync(SCENE_DIR).filter((f) => f.endsWith('.json'));

  const declaredDefaultOf = (step) => {
    const opts = step.params?.options;
    const hasOptDefault = Array.isArray(opts)
      && opts.some((o) => typeof o === 'object' && o.default !== undefined && o.default !== false);
    return step.params?.auto_default !== undefined || hasOptDefault;
  };

  for (const file of files) {
    const scene = JSON.parse(readFileSync(join(SCENE_DIR, file), 'utf8'));
    const sceneId = scene.scene_id || file.replace('.json', '');
    const interactive = (scene.flow || []).filter((s) => s.auto_execute === false || s.layer === 'interactive');
    if (interactive.length === 0) continue;

    it(`${file}：${interactive.length} 个交互步骤都有明确结局`, async () => {
      const problems = [];
      for (const step of interactive) {
        const context = { selected_modes: [], targetPath: SRC };
        const handled = await handleInteractiveStep(sceneId, step, context, { auto: true });
        if (handled === false) continue; // C 交给处理器
        if (context._awaitingAnswer) continue; // A 问了
        if (context._stepDecision) {
          // B 用了默认值 —— 但必须是场景里写明的默认，不能是引擎猜的
          if (!declaredDefaultOf(step)) {
            problems.push(`Step ${step.step} ${step.action}: 用了未声明的默认值 ${context._stepDecision}`);
          }
          continue;
        }
        problems.push(`Step ${step.step} ${step.action}: 没问人、也没落地决定（会被记成 skip 混过去）`);
      }
      expect(problems).toEqual([]);
    });
  }
});

/**
 * 日志不许反向失真：答过的步骤记 pass，没答的记 skip。
 * （review 2.68 用户答了「跑」、sweep 也跑了，日志却写 skip。）
 */
describe('recordInteractiveStep：答过 ≠ 跳过', () => {
  it('答过 → pass / interactive-answered，detail 写 context_flag 的值', () => {
    const context = { withSweep: true, _stepDecision: 'run' };
    const entry = recordInteractiveStep({ step: 2.68, action: 'askUser', params: { context_flag: 'withSweep' } }, context);
    expect(entry.status).toBe('pass');
    expect(entry.reason).toBe('interactive-answered');
    expect(entry.detail).toBe('withSweep=true');
    expect(context._stepDecision).toBeUndefined();
  });

  it('没答 → skip / interactive', () => {
    const context = {};
    const entry = recordInteractiveStep({ step: 3, action: 'select', params: {} }, context);
    expect(entry.status).toBe('skip');
    expect(entry.reason).toBe('interactive');
  });

  it('detail 没有 flag 时退回决定摘要（事后能追问答了什么）', () => {
    const context = { _stepDecision: 'selectedOption=安全更新' };
    const entry = recordInteractiveStep({ step: 5, action: 'choose', params: {} }, context);
    expect(entry.detail).toBe('selectedOption=安全更新');
  });
});

/**
 * 第三批：flag 的答案必须真的落到 context 上。
 *
 * 旧 `setContextFlag` 写的是 `const enabled = !options.auto ? answer : true` ——
 * 带 `--auto` 时答案一律被覆盖成「是」。于是 `--decline` / `--choice 2` 在没声明
 * context_flag 的确认步骤上被吞掉，屏幕上还印「✅ 已启用」，flag 与结果相反。
 */
describe('确认答案不再被 --auto 覆盖', () => {
  // new-project 3.5：是否使用 Open Design（已声明 context_flag）
  const odStep = {
    step: 3.5,
    action: 'askUser',
    auto_execute: false,
    description: '询问用户是否需要 Open Design AI 设计',
    params: {
      prompt: '是否需要使用 Open Design 开发 UI 界面？',
      type: 'confirm',
      default: false,
      context_flag: 'user_confirmed_open_design',
      flag_label: 'Open Design AI 设计',
    },
  };

  it('--decline + --auto → 明确记为「不用」，不是「已启用」', async () => {
    const context = {};
    expect(await handleConfirmDialog(odStep, { auto: true, decline: true }, context)).toBe(true);
    expect(context.user_confirmed_open_design).toBe(false);
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('--choice 2 同样算「不用」', async () => {
    const context = {};
    await handleConfirmDialog(odStep, { auto: true, choice: '2' }, context);
    expect(context.user_confirmed_open_design).toBe(false);
  });

  it('--yes → 「用」', async () => {
    const context = {};
    await handleConfirmDialog(odStep, { auto: true, yes: true }, context);
    expect(context.user_confirmed_open_design).toBe(true);
  });

  it('--brand 已经蕴含表态时不再问一遍（值存在即权威）', async () => {
    const context = { user_confirmed_open_design: true };
    await handleConfirmDialog(odStep, { auto: true, brand: 'vercel' }, context);
    expect(context.user_confirmed_open_design).toBe(true);
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('--brand skip 不会因为 auto 被反转成启用', async () => {
    const context = { user_confirmed_open_design: false };
    await handleConfirmDialog(odStep, { auto: true, brand: 'skip' }, context);
    expect(context.user_confirmed_open_design).toBe(false);
  });

  it('没有任何表态 → 停在闸门，不写默认值', async () => {
    const context = {};
    await handleConfirmDialog(odStep, { auto: true }, context);
    expect(context.user_confirmed_open_design).toBeUndefined();
    expect(context._awaitingAnswer).toEqual(expect.objectContaining({
      prompt: '是否需要使用 Open Design 开发 UI 界面？',
      label: 'Open Design AI 设计',
    }));
  });

  it('没声明 context_flag 的确认步骤，--decline 也不再被反转', async () => {
    const step = {
      step: 6,
      action: 'confirm',
      auto_execute: false,
      description: '确认后美化前端（ui 相关）',
      params: { prompt: '开始美化？', type: 'confirm' },
    };
    const context = {};
    await handleConfirmDialog(step, { auto: true, decline: true }, context);
    // 描述里带 ui → 落到 user_confirmed_open_design；关键是值是 false
    expect(context.user_confirmed_open_design).toBe(false);
  });
});

/**
 * 第四批：问题问的和能回答的不是一回事。
 *
 * ui-polish 6 的 message 是「请输入数字选择主题：1. DaisyUI … 6. Liquid Glass」，
 * 但闸门以前只给 --yes / --decline。用户回「2」→ choiceToConfirm('2') === false
 * → 被当成「拒绝美化」。现在主题型确认给 --theme（也接受 --choice <序号>）。
 */
describe('主题选择型确认：给能回答这个问题的选项', () => {
  const themeStep = {
    step: 6,
    action: 'confirm',
    auto_execute: false,
    description: '生成美化方案，选择主题并人工确认',
    params: {
      message: '已生成美化方案，请选择主题并确认：\n\n1. DaisyUI\n2. Animal Island UI\n…',
      theme_selection: true,
    },
  };

  it('--theme huashu → 记下主题，不再问', async () => {
    const context = {};
    expect(await handleConfirmation(themeStep, { auto: true, theme: 'huashu' }, context)).toBe(true);
    expect(context.selectedTheme).toBe('huashu');
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('--choice 4 按序号映射到第 4 个主题（不是「拒绝」）', async () => {
    const context = {};
    await handleConfirmation(themeStep, { auto: true, choice: '4' }, context);
    expect(context.selectedTheme).toBe('huashu');
  });

  it('--choice 6 → liquid-glass', async () => {
    const context = {};
    await handleConfirmation(themeStep, { auto: true, choice: '6' }, context);
    expect(context.selectedTheme).toBe('liquid-glass');
  });

  it('只给 --yes → 停在闸门，选项是 --theme 而不是 --yes', async () => {
    const context = {};
    await handleConfirmation(themeStep, { auto: true, yes: true }, context);
    expect(context.selectedTheme).toBeUndefined();
    const awaiting = context._awaitingAnswer;
    expect(awaiting).toBeTruthy();
    expect(awaiting.hints.map(h => h.flag)).toEqual([
      '--theme daisyui', '--theme animal-island', '--theme custom',
      '--theme huashu', '--theme awm-brand', '--theme liquid-glass',
    ]);
  });

  it('--decline 仍然表示「不做美化」，不逼人选主题', async () => {
    const context = {};
    await handleConfirmation(themeStep, { auto: true, decline: true }, context);
    expect(context.user_confirmed).toBe(false);
    expect(context.selectedTheme).toBeUndefined();
  });

  it('认不出的 --theme 不被当有效值', async () => {
    const context = {};
    await handleConfirmation(themeStep, { auto: true, theme: 'neon-nonsense' }, context);
    expect(context.selectedTheme).toBeUndefined();
    expect(context._awaitingAnswer).toBeTruthy();
  });

  it('resolveThemeChoice：序号/名称/大小写都认，垃圾值返回 undefined', async () => {
    expect(resolveThemeChoice(1)).toBe('daisyui');
    expect(resolveThemeChoice('6')).toBe('liquid-glass');
    expect(resolveThemeChoice('DaisyUI')).toBe('daisyui');
    expect(resolveThemeChoice('animal-island')).toBe('animal-island');
    expect(resolveThemeChoice('7')).toBeUndefined();
    expect(resolveThemeChoice('whatever')).toBeUndefined();
    expect(resolveThemeChoice()).toBeUndefined();
  });
});

/**
 * 第五批：--brand 得真的把 Open Design 流程打开。
 *
 * 3.55…3.79 与 ui-polish 6.3…7.15 的 condition 全是 user_confirmed_open_design，
 * 以前只有 TTY 里回答 3.5 才写这个值，`--brand` 只写 user_selected_brand：
 * 于是「品牌选了，下游全被当条件不满足跳过」，屏幕上一步绿都没有。
 */
describe('--brand 蕴含 Open Design 表态', () => {
  it('brandConsent：品牌 = 用，skip = 不用，没传 = 没表态', () => {
    expect(brandConsent('vercel')).toBe(true);
    expect(brandConsent('SKIP')).toBe(false);
    expect(brandConsent()).toBeUndefined();
    expect(brandConsent('')).toBeUndefined();
  });

  it('od-brand-pick 选中品牌后打开下游条件', async () => {
    const { handleOdBrandPick } = await import('../handlers/design.js');
    const context = { od_available_brands: ['vercel'], user_selected_brand: 'vercel' };
    const result = handleOdBrandPick('od-brand-pick', {}, '.', context);
    expect(context.user_confirmed_open_design).toBe(true);
    expect(String(result)).toContain('brand 选为 vercel');
  });

  it('精选列表为空且没人指定品牌 → skip，不再谎称「回退到自动选择」', async () => {
    const { handleOdBrandPick } = await import('../handlers/design.js');
    const context = { od_available_brands: [] };
    const result = handleOdBrandPick('od-brand-pick', {}, '.', context);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('没有 open-design 品牌目录');
  });

  it('指定了品牌但目录缺失 → warn（用户点了，没做到）', async () => {
    const { handleOdBrandPick } = await import('../handlers/design.js');
    const context = { od_available_brands: [], user_selected_brand: 'vercel' };
    const result = handleOdBrandPick('od-brand-pick', {}, '.', context);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('--brand vercel');
  });
});

/**
 * 第六批：导出设计资源不许「文件是真的、设计是假的」。
 */
describe('exportAssets 的 token 来源要分清', () => {
  it('没有品牌 token 时写的是内置默认值 → warn', async () => {
    const { handleExportAssets } = await import('../handlers/design.js');
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'export-assets-'));
    const result = handleExportAssets('exportAssets', {}, dir, {});
    expect(result.status).toBe('warn');
    expect(result.message).toContain('默认值');
  });

  it('有品牌 CSS 时如实报告来源', async () => {
    const { handleExportAssets } = await import('../handlers/design.js');
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'export-assets-'));
    const result = handleExportAssets('exportAssets', {}, dir, { od_brand_css: ':root{--a:1}' });
    expect(typeof result).toBe('string');
    expect(result).toContain('品牌设计系统');
  });
});

/**
 * 第七批：没传的 flag 不许变成「用户说不要」。
 *
 * `buildSceneContext` 曾经把 withSweep 写成 `Boolean(options.withSweep)`：没传 = false。
 * 2.68 又刚好声明了 `context_flag: withSweep`，「值存在即权威」就把这个 false 当成
 * 已答复 —— 闸门不再提问、日志记 pass(reason=interactive-answered)，用户从没被问过。
 * 这是「假绿」最隐蔽的一种：不是没人问，而是引擎认为自己已经问过了。
 */
describe('未传的 flag 不能被实例化成 false', () => {
  it('不传 -S / --skip-sweep → withSweep 与 sweepDecision 都是 undefined', () => {
    const context = buildSceneContext({ auto: true });
    expect(context.withSweep).toBeUndefined();
    expect(context.sweepDecision).toBeUndefined();
  });

  it('-S → withSweep=true 且 sweepDecision=run', () => {
    const context = buildSceneContext({ auto: true, withSweep: true });
    expect(context.withSweep).toBe(true);
    expect(context.sweepDecision).toBe('run');
  });

  it('--skip-sweep → sweepDecision=skip（而不是靠 withSweep=false 表达）', () => {
    const context = buildSceneContext({ auto: true, skipSweep: true });
    expect(context.sweepDecision).toBe('skip');
    expect(context.withSweep).toBeUndefined();
  });

  it('review 2.68：没表态时仍然停在闸门（带 context_flag 也一样）', async () => {
    const context = buildSceneContext({ auto: true });
    const step = {
      step: 2.68,
      action: 'askUser',
      auto_execute: false,
      description: '询问是否在审查前现场跑一次探测器自检',
      params: {
        type: 'confirm',
        prompt: '是否现在现场跑一次探测器自检？',
        default: false,
        context_flag: 'withSweep',
        flag_label: '探测器自检 sweep（现场跑，约 1~2 分钟）',
        ask_even_in_auto: true,
      },
    };
    await handleConfirmDialog(step, { auto: true }, context);
    expect(context._awaitingAnswer).toBeTruthy();
    expect(context.withSweep).toBeUndefined();
  });

  it('--skip-sweep 之下同一个步骤直接被答掉', async () => {
    const context = buildSceneContext({ auto: true, skipSweep: true });
    const step = {
      step: 2.68, action: 'askUser', auto_execute: false, description: '询问 sweep',
      params: { type: 'confirm', prompt: '是否现在现场跑一次探测器自检？', context_flag: 'withSweep' },
    };
    await handleConfirmDialog(step, { auto: true, skipSweep: true }, context);
    expect(context._awaitingAnswer).toBeUndefined();
    expect(context.withSweep).toBe(false);
  });
});

/**
 * `--mode`：review/refactor/ui-polish 的模式勾选。
 *
 * 这些步骤的提示里一直写着「--mode 可覆盖」，但 index.js 从来没注册这个 flag ——
 * 用户按提示传 `--mode full_audit` 会被 commander 忽略，引擎照旧跑默认模式，
 * 报告看起来「按你的要求跑了」。要么实现，要么删文案；本轮实现它。
 */
describe('--mode 覆盖模式勾选', () => {
  const step = {
    step: 0, action: 'selectModes', description: '选择审查模式',
    params: { options: [{ id: 'code_review', default: true }, { id: 'full_audit' }, { id: 'security_deep' }] },
  };

  it('认得出的模式原样返回', () => {
    expect(resolveModeOverride(step, 'full_audit,security_deep'))
      .toMatchObject({ valid: ['full_audit', 'security_deep'], invalid: [] });
  });

  it('认不出的模式单独列出来，不静默丢弃', () => {
    const r = resolveModeOverride(step, 'full_audit,full_audti');
    expect(r.valid).toEqual(['full_audit']);
    expect(r.invalid).toEqual(['full_audti']);
    expect(r.available).toEqual(['code_review', 'full_audit', 'security_deep']);
  });

  it('没传 --mode 时 valid/invalid 都为空（交给场景默认值）', () => {
    expect(resolveModeOverride(step)).toMatchObject({ valid: [], invalid: [] });
  });
});

/**
 * 闸门文案不许说谎：写在 hints 里的参数必须真的能用。
 *   - rollback 3 的 hint 写着「--choice <目标> 手动指定该项」，但以前无条件中止。
 *   - mobile-release 4 的文案问「请选择版本升级类型」，却按「要不要继续」渲染成
 *     --yes/--decline，选中的 major/minor 从未落地，下游静默按 patch 升版本。
 */
describe('闸门承诺的参数必须真的生效', () => {
  const SCENE_DIR = join(SRC, '..', 'scenes');
  const stepOf = (scene, stepNo) => {
    const flow = JSON.parse(readFileSync(join(SCENE_DIR, `${scene}.json`), 'utf8')).flow;
    return flow.find((s) => s.step === stepNo);
  };

  it('rollback 3：--choice 给了回滚目标就不再停在闸门', async () => {
    const step = stepOf('rollback', 3);
    const context = buildSceneContext({ auto: true, choice: 'v1.4.2' });
    await handleInteractiveStep('rollback', step, context, { auto: true, choice: 'v1.4.2' });
    expect(context._awaitingAnswer).toBeUndefined();
    expect(context.selectedOption).toBe('v1.4.2');
  });

  it('rollback 3：没给目标时仍然要人回答（不猜版本）', async () => {
    const step = stepOf('rollback', 3);
    const context = buildSceneContext({ auto: true });
    await handleInteractiveStep('rollback', step, context, { auto: true });
    expect(context._awaitingAnswer).toBeTruthy();
    expect(context.selectedOption).toBeFalsy();          // buildSceneContext 里是空串
  });

  it('mobile-release 4：问的是升级类型，--choice major 要能落地', async () => {
    const step = stepOf('mobile-release', 4);
    const context = buildSceneContext({ auto: true, choice: 'major' });
    await handleInteractiveStep('mobile-release', step, context, { auto: true, choice: 'major' });
    expect(context.selectedOption).toBe('major');
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('mobile-release 4：没人回答时闸门提示的是 --choice，不是 --yes/--decline', async () => {
    const step = stepOf('mobile-release', 4);
    const context = buildSceneContext({ auto: true });
    await handleInteractiveStep('mobile-release', step, context, { auto: true });
    const hints = context._awaitingAnswer.hints.map((h) => h.flag).join(' ');
    expect(hints).toContain('--choice');
    expect(hints).not.toContain('--yes');
    expect(context.selectedOption).toBeFalsy();          // 空串 = 没人选过
  });
});
