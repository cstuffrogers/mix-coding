/**
 * context 旗标的「归属」记账。
 *
 * 为什么需要：处理器写 `context.testPassed = false` 这类旗标，条件（scene.condition）
 * 与后续步骤都拿它当证据。但 `--iterations N` 下每轮都重跑整条 flow：
 * 第 1 轮写下的 `testPassed=false`，第 2 轮若 test 那一步没跑（条件不满足/工具没了），
 * 后面读到的是**上一轮的旧值** —— 报告里看不出区别，行为却差一个分支。
 * 以前这个键连「谁写的」都不知道，只有一个布尔值。
 *
 * 这里只做记账（不解释、不改值）：
 *   - 每个步骤执行完，比对该步骤前后的 context 快照，变了的键打上 { step, iteration }；
 *   - 读者（lib/conditions.js）用 staleFlags() 判断「这个值是不是本轮测出来的」。
 * 记账只写 `__flagMeta`（下划线开头，报告/序列化会跳过）。
 */

export const FLAG_META_KEY = '__flagMeta';

/** 步骤执行前的浅快照：只需判断「这个键有没有被这一步动过」。 */
export function snapshotFlags(context) {
  const snap = new Map();
  if (!context || typeof context !== 'object') return snap;
  for (const [key, value] of Object.entries(context)) {
    if (key === FLAG_META_KEY || key === 'stepResults') continue;
    snap.set(key, value);
  }
  return snap;
}

/**
 * 把这一步动过的键记上轮次。返回动过的键名（测试与排障用）。
 * 新增的键、改值的键、被删掉的键都算「这一步写过」。
 */
export function stampFlagWrites(context, snapshot, { step, iteration } = {}) {
  if (!context || typeof context !== 'object') return [];
  const meta = { ...context[FLAG_META_KEY] };
  const where = { step: step ?? null, iteration: iteration || 1 };
  const touched = [];
  for (const [key, value] of Object.entries(context)) {
    if (key === FLAG_META_KEY || key === 'stepResults') continue;
    const before = snapshot?.get?.(key);
    const unchanged = snapshot?.has?.(key) === true && Object.is(before, value);
    if (unchanged) continue;
    meta[key] = where;
    touched.push(key);
  }
  if (snapshot?.keys) {
    for (const key of snapshot.keys()) {
      if (key in context) continue;
      meta[key] = where;
      touched.push(key);
    }
  }
  context[FLAG_META_KEY] = meta;
  return touched;
}

/** 键是在第几轮写的（没写过返回 null —— 「没人写过」和「第 1 轮写的」不是一回事）。 */
export function flagWrittenAt(context, key) {
  const entry = context?.[FLAG_META_KEY]?.[key];
  return typeof entry?.iteration === 'number' ? entry.iteration : null;
}

/**
 * 依赖「早前轮次」写下的键：值还在 context 上，但本轮没有任何步骤重新测量过。
 * 只在本轮 iteration 明确时才判（未知轮次不做假设）。
 */
export function staleFlagDetail(context) {
  const current = context?.iteration;
  if (typeof current !== 'number' || current < 2) return [];
  const meta = context?.[FLAG_META_KEY] || {};
  return Object.keys(meta)
    .filter((key) => typeof meta[key]?.iteration === 'number' && meta[key].iteration < current)
    .filter((key) => key in context)
    .map((key) => ({ key, iteration: meta[key].iteration, step: meta[key].step ?? null }));
}

/** 同上，但只要键名（条件求值用）。 */
export function staleFlags(context) {
  return staleFlagDetail(context).map((item) => item.key);
}
