import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readEvents } from '../lib/enclosure-ledger.js';

// ── 围栏台账汇总（P2）──
//
// 「问题越修越少」需要能看见趋势，否则每轮只看到一堆逐行输出。
// 这里把 .claude/reports/enclosure-events.jsonl 聚合成一次快照：
//   captures    拍了几次桩
//   verifies    比了几次对
//   violations  越界总次数 / 越界率
//   restores    回滚次数
//   impactMissing  影响域产物缺失次数（= 有多少轮是「未评估就动手」）
//
// 三态：没有任何事件 → skip（没数据不等于全零/没越界）；
//       有事件但越界率或缺失率高 → warn；其余 → pass。

const REPORTS_DIR = '.claude/reports';

function countBy(events, type) {
  return events.filter((e) => e.type === type).length;
}

function sumBy(events, type, field) {
  return events
    .filter((e) => e.type === type)
    .reduce((acc, e) => acc + (Number(e[field]) || 0), 0);
}

export function summarizeEnclosure(events) {
  const captures = countBy(events, 'capture');
  const verifies = countBy(events, 'verify');
  const violations = sumBy(events, 'verify', 'violations');
  const restoreEvents = events.filter((e) => e.type === 'restore');
  // 回滚失败必须单独记：把失败算进「回滚次数」等于谎报「已退回」
  const restores = restoreEvents.filter((e) => e.failed !== true).length;
  const restoreFailures = restoreEvents.filter((e) => e.failed === true).length;
  const impactOk = events.filter((e) => e.type === 'impact' && e.ok === true).length;
  const impactMissing = events.filter((e) => e.type === 'impact' && e.ok === false).length;

  return {
    captures,
    verifies,
    violations,
    restores,
    restoreFailures,
    // 越界率以「比对次数」为分母：没比对过就没有分母，给 null 而不是 0
    violationRate: verifies > 0 ? Number((violations / verifies).toFixed(3)) : null,
    impactOk,
    impactMissing,
    impactMissingRate: (impactOk + impactMissing) > 0
      ? Number((impactMissing / (impactOk + impactMissing)).toFixed(3))
      : null,
    lastEventTime: events.at(-1)?.time ?? null,
  };
}

/** 判读：这次汇总该报什么状态。阈值写在这里，别散落在打印里。 */
export function verdictOf(summary, { maxViolationRate = 0.5, maxMissingRate = 0.5 } = {}) {
  if (summary.verifies === 0 && summary.captures === 0) {
    return { status: 'skip', reason: '台账里没有围栏事件' };
  }
  // 建了围栏却从没比对 = 围栏形同虚设（假绿的经典形态），必须点名
  if (summary.captures > 0 && summary.verifies === 0) {
    return { status: 'warn', reason: `围栏建了 ${summary.captures} 次但从未比对` };
  }
  const bad = [];
  if (summary.restoreFailures > 0) bad.push(`回滚失败 ${summary.restoreFailures} 次`);
  if (summary.violationRate !== null && summary.violationRate > maxViolationRate) {
    bad.push(`越界率 ${summary.violationRate}`);
  }
  if (summary.impactMissingRate !== null && summary.impactMissingRate > maxMissingRate) {
    bad.push(`影响域缺失率 ${summary.impactMissingRate}`);
  }
  return bad.length > 0
    ? { status: 'warn', reason: bad.join('、') }
    : { status: 'pass', reason: '' };
}

function formatSummary(summary) {
  const rate = summary.violationRate === null ? '未测量' : `${(summary.violationRate * 100).toFixed(0)}%`;
  const missing = summary.impactMissingRate === null ? '未测量' : `${(summary.impactMissingRate * 100).toFixed(0)}%`;
  return [
    `拍桩 ${summary.captures} 次`,
    `比对 ${summary.verifies} 次`,
    `越界 ${summary.violations} 次（${rate}）`,
    `回滚 ${summary.restores} 次${summary.restoreFailures > 0 ? `（失败 ${summary.restoreFailures} 次）` : ''}`,
    `影响域缺失 ${summary.impactMissing} 次（${missing}）`,
  ].join(' / ');
}

export function handleEnclosureMetrics(_action, _params, targetPath, context) {
  const root = targetPath ?? '.';
  const events = readEvents(root);
  const summary = summarizeEnclosure(events);
  const verdict = verdictOf(summary);

  if (verdict.status === 'skip') {
    return { status: 'skip', message: `${verdict.reason}（没有数据不等于零越界）` };
  }

  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  try {
    mkdirSync(join(root, REPORTS_DIR), { recursive: true });
    const file = join(root, REPORTS_DIR, `enclosure-metrics-${stamp}.json`);
    writeFileSync(file, JSON.stringify({ stamp, summary, verdict }, null, 2), 'utf-8');
  } catch {
    // 落盘失败不影响汇总输出
  }

  if (context) {
    context.enclosureMetrics = summary;
    context.enclosureVerdict = verdict.status;
  }

  const text = formatSummary(summary);
  if (verdict.status === 'warn') {
    return { status: 'warn', message: `${text} —— ${verdict.reason}（值得复盘）` };
  }
  return { status: 'pass', message: text };
}
