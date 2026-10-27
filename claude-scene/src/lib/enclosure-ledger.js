import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── 围栏台账（enclosure ledger）──
//
// 围栏、影响域、回滚三类事件都往同一条 append-only JSONL 里追加一行。
// 为什么不按事件分文件：报告目录已经按 stamp 堆了一堆 fence-*.json，
// 再给每类事件开一个文件，聚合时要读几十个文件；一行一事件的 JSONL
// 既能追加（不重写历史），又能一次读完做统计。
//
// 事件形状（type 必填，其余按类型）：
//   { type: 'capture', stamp, testCount, passed, failed }
//   { type: 'verify',  stamp, violations, testCount }
//   { type: 'restore', stamp, restored, skipped }
//   { type: 'impact',  stamp, ok, riskLevel?, changedCount?, callerCount?, problem? }

const REPORTS_DIR = '.claude/reports';
const LEDGER_NAME = 'enclosure-events.jsonl';

function ledgerPath(targetPath) {
  return join(targetPath, REPORTS_DIR, LEDGER_NAME);
}

/** 追加一条事件。写不进去不该让主流程失败——记账是旁路。 */
export function appendEvent(targetPath, event) {
  if (!targetPath) return false;
  try {
    const file = ledgerPath(targetPath);
    mkdirSync(join(targetPath, REPORTS_DIR), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/** 读回全部事件。坏行跳过（手工编辑过的台账不该让统计崩掉）。 */
export function readEvents(targetPath) {
  const file = ledgerPath(targetPath);
  if (!existsSync(file)) return [];
  const events = [];
  for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.type === 'string') events.push(parsed);
    } catch {
      // 坏行跳过
    }
  }
  return events;
}
