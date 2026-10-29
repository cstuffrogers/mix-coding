// 「为什么不是 pass」的词汇表。
//
// 为什么需要：`⚡ warn: 3` 这一行至少混了五种来源 —— 处理器说有发现、处理器返回了
// 对象却没布 status、处理器一个字都没返回、status 词引擎不认识、文案正则觉得像有发现。
// 五种东西对读者的要求完全不同（前一种要去看报告，后四种要去看代码），打成一个数字
// 等于把「哪来的」这件事抹掉。skip 同病：引擎自己判的几种带 reason，处理器返回
// `{ status: 'skip' }` 那一百多处连一个字的原因都没有。
//
// 规矩：
//   1. 类别只能由**处理器自己声明**（`reason` 字段）或**引擎自己的判定分支**给出；
//   2. 绝不按文案猜类别 —— 猜出来的类别和猜出来的状态一样不可信；
//   3. 没声明就是 `handler-skip`（明写「没说原因」），不是「其它」也不是沉默。

/**
 * warn 的来源分类。键即日志里的 warn_kind 值。
 *
 * 第二十一轮补两类「不是发现」的 warn：证据过期 / 证据自相矛盾。
 * detectorReport 的「记录来自 abc123，当前 HEAD 是 def456」以前被算成
 * 「有发现」—— 读者会跑去读报告找那 0 条发现，真正要做的是重跑自检。
 */
export const WARN_KINDS = new Map([
  ['findings', '有发现'],
  ['contract', '返回对象没布 status'],
  ['silent', '处理器没返回任何结果'],
  ['unknown-status', 'status 词引擎不认识'],
  ['heuristic', '文案像有发现（正则猜的）'],
  ['stale-evidence', '证据过期（对不上当前代码）'],
  ['inconsistent-evidence', '证据自相矛盾'],
  ['unknown-declared', '处理器声明的 warn 类别不在词表里'],
]);

/** 跳过的原因分类。键即日志里的 reason 值。 */
export const SKIP_REASONS = new Map([
  ['condition', '条件不满足'],
  ['unjudged', '条件依赖的键本轮没人测过'],
  ['user', '用户选择跳过'],
  ['interactive', '需要人回答但没人可问'],
  ['not-applicable', '本环境没有可作用的对象'],
  ['tool-missing', '缺工具或依赖'],
  ['permission', '没有权限'],
  ['input-missing', '缺输入（参数/文件/配置）'],
  ['input-invalid', '输入不合法'],
  ['engine-disabled', '被开关关掉'],
  ['handler-skip', '处理器判为跳过但没声明原因'],
]);

/**
 * 无事可做的原因分类。键即日志里的 noop_kind 值。
 *
 * 以前 noop 只是一个数字：`⚠ noop: 6` 里混着「真没有对象」「东西已经是最新」
 * 「要对话模式才能做」「缺工具」—— 四种对读者的要求完全不同。
 */
export const NOOP_REASONS = new Map([
  ['already-done', '已经是最新 / 已存在，不用再做'],
  ['nothing-to-do', '没有可处理的对象（无改动 / 无 PR / 无匹配文件）'],
  ['conversation-mode', '需要对话模式才能执行（CLI 下只能供料）'],
  ['delegated', '交给对话模式的 agent / 别的步骤执行'],
  ['tool-missing', '缺工具或依赖'],
  ['undeclared', '处理器判为无事可做但没声明原因'],
  ['heuristic', '文案像「没什么可做」（正则猜的）'],
]);

/**
 * 循环停止原因。**不进日志**，只出现在 `shouldStopLooping` 的返回值和控制台里。
 * 单列不是为了美：`reason` 这列上曾同时挂着跳过原因（词表值）、重试注解、
 * 中止散文和停止原因 —— 第四种词汇表必须显式存在，否则「reason 只装词表值」
 * 这条不变量无法被测试盯住（只能把整个 start.js 的 `reason:` 字面量一律放过）。
 */
export const STOP_REASONS = new Map([
  ['max', '已跑满轮数'],
  ['clean', '本轮无新发现'],
  ['unmeasured', '本轮没有可数的发现（没测）'],
  ['no-progress', '发现数未下降'],
  ['no-progress-forced', '未下降但按 --force-iterations 继续'],
  ['continue', '继续下一轮'],
]);

export function warnKindLabel(kind) {
  if (!kind) return '';
  return WARN_KINDS.get(kind) || `未登记的 warn 类别（${kind}）`;
}

export function skipReasonLabel(reason) {
  if (!reason) return '';
  return SKIP_REASONS.get(reason) || `未登记的跳过原因（${reason}）`;
}

export function isWarnKind(kind) {
  return typeof kind === 'string' && WARN_KINDS.has(kind);
}

export function isSkipReason(reason) {
  return typeof reason === 'string' && SKIP_REASONS.has(reason);
}

export function noopReasonLabel(reason) {
  if (!reason) return '';
  return NOOP_REASONS.get(reason) || `未登记的空转原因（${reason}）`;
}

export function isNoopReason(reason) {
  return typeof reason === 'string' && NOOP_REASONS.has(reason);
}

/**
 * 「处理器布了 warn，但它声明的类别是什么？」
 *
 * 判定权归处理器：它能说清「这是发现」还是「这是我的证据过期了」，就不用引擎
 * 按 status 词反推。声明的词必须在词表里 —— 词表外的值记 `unknown-declared` 并
 * 保留原词，这样「写错词」和「没声明」不会被混成一件事。
 */
export function warnKindFrom(result) {
  const declared = result && typeof result === 'object' && typeof result.warnKind === 'string' && result.warnKind.trim()
    ? result.warnKind.trim()
    : null;
  if (!declared) return { kind: null, unknownDeclared: null };
  if (isWarnKind(declared)) return { kind: declared, unknownDeclared: null };
  return { kind: 'unknown-declared', unknownDeclared: declared };
}

/**
 * 处理器布了 noop 时它的原因；没声明（或声明了词表外的值）就是 undeclared。
 * 不复用 skip 的 handler-skip：同一个键在两个行上标签不同，grep 起来是两回事。
 * 与 skipReasonFrom 同构：`noop` 也要说得出来「为什么没有事可做」。
 */
export function noopReasonFrom(result) {
  const declared = result && typeof result === 'object' && typeof result.reason === 'string' && result.reason.trim()
    ? result.reason.trim()
    : null;
  if (isNoopReason(declared)) return { reason: declared, unknownDeclared: null };
  return { reason: 'undeclared', unknownDeclared: declared };
}

/**
 * 处理器说「我跳过了」时它的原因；没声明（或声明了词表外的值）就是 handler-skip。
 * 词表外的值不静默通过：`unknownDeclared` 带着原词，调用方才能把「写错了词」说出来。
 */
export function skipReasonFrom(result) {
  const declared = result && typeof result === 'object' && typeof result.reason === 'string' && result.reason.trim()
    ? result.reason.trim()
    : null;
  if (isSkipReason(declared)) return { reason: declared, unknownDeclared: null };
  return { reason: 'handler-skip', unknownDeclared: declared };
}
