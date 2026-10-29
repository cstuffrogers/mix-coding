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

/** warn 的来源分类。键即日志里的 warn_kind 值。 */
export const WARN_KINDS = new Map([
  ['findings', '有发现'],
  ['contract', '返回对象没布 status'],
  ['silent', '处理器没返回任何结果'],
  ['unknown-status', 'status 词引擎不认识'],
  ['heuristic', '文案像有发现（正则猜的）'],
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
