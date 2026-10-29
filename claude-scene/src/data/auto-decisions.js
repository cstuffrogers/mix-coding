// --auto 下的「自主决定」清单。
//
// --auto 的语义是「别打断我」，不是「替我选」。两者的分界只在一条：**这个选择事后能不能被看见**。
// 以前它没法被看见 —— 路径、主题、模式、确认题、跳过 sweep，全是 `if (options.auto)` 里
// 悄悄取的值，屏幕上最多一行灰字，日志里什么都没留。用户看到的是一次「跑通了」，
// 而实际发生了四五次「没人问过」。这不是效率，是把责任推给默认值。
//
// 所以这里登记：每个自主决定叫什么、怎么覆盖、为什么是这个值。代码里真正做到的地方
// 必须调 noteAutoDecision()，收尾统一打印 + 逐条落日志（event: 'auto-decision'）。
// 守卫测试会扫 start.js 的每个函数：提到 options.auto 就必须属于三类之一 ——
// 披露（调了 noteAutoDecision）、问人（inquirer.prompt / markAwaiting）、
// 或纯判定（本文件 ALLOWED_AS_GATE_ONLY 明确列出并给理由）。
export const AUTO_DECISIONS = new Map([
  ['target-path', {
    label: '目标项目路径',
    override: '--target <路径>（不带则用 $MIX_CODING_PROJECT_DIR 或 cwd）',
  }],
  ['theme', {
    label: 'UI 主题',
    override: '--theme <主题 id>',
  }],
  ['brand', {
    label: '设计品牌',
    override: '--brand <品牌名>',
  }],
  ['modes', {
    label: '审查模式组合',
    override: '--mode <id,id>（不带则用场景逐项声明的 default:true）',
  }],
  ['option', {
    label: '单选步骤的取值',
    override: '--choice <选项 id>',
  }],
  ['kind', {
    label: '类型选择（--kind）',
    override: '--kind <选项 id>',
  }],
  ['context-flag', {
    label: '交互步骤写下的 context_flag',
    override: '--yes / --decline / --choice 1|2，或场景声明的 auto_default',
  }],
  ['confirm-answer', {
    label: '确认题的回答',
    override: '--yes / --decline / --choice 1|2',
  }],
  ['sweep', {
    label: '探测器自检是否执行',
    override: '-S, --with-sweep（跑）/ --skip-sweep（不跑）',
  }],
  ['iterations', {
    label: '迭代轮数',
    override: '--iterations <N>',
  }],
]);

/**
 * 允许在提到 options.auto 但既不披露也不问人的函数（纯判定/纯转发）。
 * 键是函数名，值是「为什么这里不需要披露」—— 写不出理由的名字，就不该在这张表里。
 */
export const ALLOWED_AS_GATE_ONLY = new Map([
  ['shouldPromptInAuto', '纯判定：只回答「这个步骤在 --auto 下要不要问」，取值在调用方披露'],
]);

export function autoDecisionLabel(id) {
  return AUTO_DECISIONS.get(id)?.label || `未登记的自主决定（${id}）`;
}

export function autoDecisionOverride(id) {
  return AUTO_DECISIONS.get(id)?.override || '没有声明覆盖方式';
}

export function isAutoDecisionId(id) {
  return typeof id === 'string' && AUTO_DECISIONS.has(id);
}
