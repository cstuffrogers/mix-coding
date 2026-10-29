// 发现数必须带「哪一轮写的」。
//
// 多轮（--iterations N）里 context 是跨轮共享的：某一轮的条件把扫描步骤跳过了，
// 计数器上还留着上一轮的值。此时 countFindings 读到的数字既不是「这一轮查了、没变」，
// 也不是「这一轮查了、变少了」—— 它根本没有来源。两种「没测」都要归 null：
//   1. 从没人写过计数器；
//   2. 计数器是上一轮的旧值。
// 否则收敛判断会拿一个不存在于本轮的结论当依据（实测：第 2 轮跳过扫描，
// 汇总照样报「发现数未下降（5 → 5），停止空转」——「5」是第 1 轮的）。

/** 记录发现数，并标注它属于哪一轮（context.iteration 由 runIterations 维护）。 */
export function recordFindingCount(context, key, value) {
  if (!context || typeof key !== 'string') return value;
  context[key] = value;
  const round = context.iteration || 1;
  if (!context._findingRounds || typeof context._findingRounds !== 'object') context._findingRounds = {};
  context._findingRounds[key] = round;
  return value;
}

/**
 * 本轮真的测过的发现数合计；一个都没在本轮写过 → null（= 没测）。
 * null 和 0 在收敛判断里方向相反，不许混。
 */
export function countMeasuredFindings(context, keys = ['aislop_issue_count', 'review_issue_count']) {
  const round = context?.iteration || 1;
  const rounds = context?._findingRounds;
  if (!rounds || typeof rounds !== 'object') return null;
  let total = 0;
  let measured = false;
  for (const key of keys) {
    if (rounds[key] !== round) continue;
    measured = true;
    total += Number(context[key]) || 0;
  }
  return measured ? total : null;
}
