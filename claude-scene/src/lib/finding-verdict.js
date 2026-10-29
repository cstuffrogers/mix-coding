/**
 * 「外部工具报出 N 个发现」→ 步骤状态。
 *
 * 契约只在这里写一次，免得每个 handler 各编一套（以前就是这么烂的：
 * knip 找到 27 项死代码仍返回「死代码检测完成: 27 项」，步骤记 pass、
 * 门禁旗标写 false —— 汇总里一行 pass 一行 failed，谁也不知道该信哪个）。
 *
 * 三档：
 *   severity = critical | error  → fail（工具自己的最高档：语法错误、泄露、高危）
 *   severity = warning（默认）    → warn（真实问题，但没有「硬错误」的含义）
 *   没有发现（count = 0）         → pass
 *
 * 关键不变量：**只有返回 'pass' 的调用方才配写 `<flag>Passed = true`**，
 * 返回 fail / warn 的一律写 false。状态与旗标必须同源。
 *
 * 「工具没跑通」不走这里 —— 那是 skip / warn 且不写旗标，见各 handler。
 */

const SEVERITIES = new Set(['critical', 'error', 'warning', 'info', 'note']);

export function statusForFindings(count, { severity = 'warning' } = {}) {
  // 未识别的契约取值必须出声：悄悄当 warning 处理，等于替工具改了严重级别
  if (!SEVERITIES.has(severity)) {
    throw new TypeError(`statusForFindings: 未知 severity "${severity}"（只认 ${[...SEVERITIES].join('/')}）`);
  }
  // 数量必须是真实的非负整数：NaN / 负数说明解析没拿到结果，不能拿它当「没有问题」
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new TypeError(`statusForFindings: count 必须是 ≥0 的整数，收到 ${JSON.stringify(count)}`);
  }
  if (count === 0) return 'pass';
  return severity === 'critical' || severity === 'error' ? 'fail' : 'warn';
}
