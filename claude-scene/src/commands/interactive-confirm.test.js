import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));

const { default: inquirer } = await import('inquirer');
const { handleConfirmDialog, shouldPromptInAuto } = await import('./start.js');
const { resolveScenePath } = await import('../lib/paths.js');

/**
 * 「--auto 静默吞掉提问」的哨兵。
 *
 * 现场踩到的形态：`start review --auto` 时 Step 2.68（要不要现场跑 detector-sweep）
 * 被无声取成「不跑」，只在控制台打一行 `⏭ 跳过 withSweep`，日志里连记录都没有，
 * 用户看到的是 2.7 报「自检记录已过期」却完全不知道自己没被问过。
 *
 * 两条约束同时成立才算修好：
 *   1. 真终端里要问（否则用户得自己记得加 -S）
 *   2. 没有 TTY 时绝不能问（inquirer 在 CI / agent 子进程里会挂死或抛错）
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEW_SCENE = join(HERE, '..', '..', 'scenes', 'review.json');

const askStep = { step: 2.68, params: { type: 'confirm', ask_even_in_auto: true } };

describe('shouldPromptInAuto（--auto 下的交互步骤）', () => {
  it('标记了 ask_even_in_auto + 真终端 → 要问', () => {
    expect(shouldPromptInAuto(askStep, { isTTY: true })).toBe(true);
  });

  it('没有 TTY（CI / agent 子进程）→ 不问，交给闸门中止', () => {
    expect(shouldPromptInAuto(askStep, { isTTY: false })).toBe(false);
  });

  it('未标记的步骤保持 --auto 不打断的语义', () => {
    expect(shouldPromptInAuto({ params: { type: 'confirm' } }, { isTTY: true })).toBe(false);
  });

  it('params 缺失也不炸', () => {
    expect(shouldPromptInAuto(undefined, { isTTY: true })).toBe(false);
    expect(shouldPromptInAuto({}, { isTTY: true })).toBe(false);
  });
});

describe('review 场景 Step 2.68 契约', () => {
  const scene = JSON.parse(readFileSync(REVIEW_SCENE, 'utf8'));
  const step = scene.flow.find(s => s.step === 2.68);

  it('存在，且是交互层需要确认的步骤', () => {
    expect(step).toBeDefined();
    expect(step.auto_execute).toBe(false);
    expect(step.params.type).toBe('confirm');
  });

  it('带 ask_even_in_auto（真终端问），且不再声明 auto_default（没 TTY 就必须中止）', () => {
    expect(step.params.ask_even_in_auto).toBe(true);
    expect(step.params.auto_default).toBeUndefined();
    expect(step.params.context_flag).toBe('withSweep');
  });

  it('有 flag_label，不再把裸 flag 名打给用户', () => {
    expect(typeof step.params.flag_label).toBe('string');
    expect(step.params.flag_label.length).toBeGreaterThan(0);
  });
});

/**
 * 上面测的是「随包分发」那份。真正跑起来的是 resolveScenePath 解析出的那一份 ——
 * 项目级 .claude/scenes/review.json 优先级更高。上一轮就踩到：改内置那份，
 * 运行时用的却是未同步的项目覆盖层，改动静默失效。
 */
describe('生效的 review 场景（项目覆盖层优先）', () => {
  const effectivePath = resolveScenePath('review');
  const effective = JSON.parse(readFileSync(effectivePath, 'utf8'));
  const step = effective.flow.find(s => s.step === 2.68);

  it('实际会执行的那份，2.68 同样带 ask_even_in_auto', () => {
    expect(effectivePath).toBeTruthy();
    expect(step?.params?.ask_even_in_auto).toBe(true);
    expect(step?.params?.auto_default).toBeUndefined();
    expect(step?.params?.context_flag).toBe('withSweep');
  });
});

/** 临时改写 process.stdin.isTTY —— 这就是「用户是不是坐在终端前」的判据 */
function stubTTY(value) {
  const desc = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { value, configurable: true, writable: true });
  return () => {
    if (desc) Object.defineProperty(process.stdin, 'isTTY', desc);
    else delete process.stdin.isTTY;
  };
}

const CONFIRM_STEP = {
  step: 2.68,
  action: 'askUser',
  auto_execute: false,
  params: {
    type: 'confirm',
    prompt: '是否现在现场跑一次探测器自检？',
    default: false,
    context_flag: 'withSweep',
    flag_label: '探测器自检 sweep',
    ask_even_in_auto: true,
  },
};

describe('handleConfirmDialog：--auto 下也要真的问，且答案生效', () => {
  let restoreTTY;
  beforeEach(() => {
    inquirer.prompt.mockReset();
  });
  afterEach(() => {
    restoreTTY?.();
    restoreTTY = undefined;
  });

  it('--auto + 真终端：弹确认；答 yes → withSweep=true（以前 auto 会丢弃答案）', async () => {
    restoreTTY = stubTTY(true);
    inquirer.prompt.mockResolvedValue({ confirm: true });
    const context = {};
    await handleConfirmDialog(CONFIRM_STEP, { auto: true }, context);

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    expect(inquirer.prompt.mock.calls[0][0][0].message).toBe(CONFIRM_STEP.params.prompt);
    expect(context.withSweep).toBe(true);
  });

  it('--auto + 真终端：答 no → withSweep=false', async () => {
    restoreTTY = stubTTY(true);
    inquirer.prompt.mockResolvedValue({ confirm: false });
    const context = {};
    await handleConfirmDialog(CONFIRM_STEP, { auto: true }, context);

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    expect(context.withSweep).toBe(false);
  });

  it('--auto + 无 TTY + 未表态：不提问、也不替你猜（留待中止）', async () => {
    restoreTTY = stubTTY(false);
    const context = {};
    await handleConfirmDialog(CONFIRM_STEP, { auto: true }, context);

    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(context.withSweep).toBeUndefined();
    expect(context._awaitingAnswer).toEqual(expect.objectContaining({ step: 2.68 }));
  });

  it('--auto + 无 TTY + --skip-sweep：明确不跑，不提问', async () => {
    restoreTTY = stubTTY(false);
    const context = {};
    await handleConfirmDialog(CONFIRM_STEP, { auto: true, skipSweep: true }, context);

    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(context.withSweep).toBe(false);
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('--auto + 无 TTY + -S：用户已表态，直接跑，不提问', async () => {
    restoreTTY = stubTTY(false);
    const context = {};
    await handleConfirmDialog(CONFIRM_STEP, { auto: true, withSweep: true }, context);

    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(context.withSweep).toBe(true);
    expect(context._awaitingAnswer).toBeUndefined();
  });

  it('context 里已有的决策优先（交互里选过的不会重问）', async () => {
    restoreTTY = stubTTY(false);
    const context = { sweepDecision: 'run' };
    await handleConfirmDialog(CONFIRM_STEP, { auto: true }, context);

    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(context.withSweep).toBe(true);
  });

  it('交互模式（无 --auto）保持原样：照问不误', async () => {
    restoreTTY = stubTTY(false);
    inquirer.prompt.mockResolvedValue({ confirm: true });
    const context = {};
    await handleConfirmDialog(CONFIRM_STEP, {}, context);

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    expect(context.withSweep).toBe(true);
  });
});
