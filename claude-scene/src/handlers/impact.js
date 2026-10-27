import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── 影响域产物（impact report）──
//
// 引擎没法直接调 codegraph MCP（`codegraph_impact` 在本仓库是个桩，永远返回
// 「未配置 codegraph MCP」）。真正的图查询由 Claude Code 侧的 agent 用
// mcp__codegraph__* 完成，然后把结果落盘成产物；引擎这侧只**消费产物**并记账。
//
// 产物契约（.claude/reports/impact-<stamp>.json）：
//   { changedFiles: string[], callers: string[], riskLevel: 'low'|'medium'|'high' }
//
// 缺产物时既不是 pass 也不是 fail：warn —— 「修复范围未评估」。

const REPORTS_DIR = '.claude/reports';
const IMPACT_PREFIX = 'impact-';
const RISK_LEVELS = new Set(['low', 'medium', 'high']);

function latestImpactFile(targetPath) {
  const dir = join(targetPath, REPORTS_DIR);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => name.startsWith(IMPACT_PREFIX) && name.endsWith('.json'))
    .sort();
  return files.length > 0 ? join(dir, files.at(-1)) : null;
}

function checkShape(data) {
  if (!Array.isArray(data?.changedFiles) || data.changedFiles.length === 0) return '产物缺 changedFiles';
  if (!Array.isArray(data?.callers)) return '产物缺 callers';
  if (!RISK_LEVELS.has(data?.riskLevel)) return '产物 riskLevel 不合法';
  return null;
}

function readImpact(targetPath) {
  const file = latestImpactFile(targetPath);
  if (!file) return { data: null, problem: '没有影响域产物' };
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return { data: null, problem: '产物不是合法 JSON' };
  }
  const problem = checkShape(data);
  return problem ? { data: null, problem } : { data, problem: null };
}

export function handleImpactReport(_action, _params, targetPath, context) {
  const { data, problem } = readImpact(targetPath ?? '.');

  if (!data) {
    if (context) {
      context.impactReported = false;
      context.impactProblem = problem;
    }
    return {
      status: 'warn',
      message: `${problem}（${REPORTS_DIR}/${IMPACT_PREFIX}<stamp>.json）—— 修复范围未评估，记账不阻断`,
    };
  }

  const high = data.riskLevel === 'high';
  if (context) {
    context.impactReported = true;
    context.impactRiskLevel = data.riskLevel;
    context.impactChangedCount = data.changedFiles.length;
    context.impactCallerCount = data.callers.length;
  }

  const head = `影响域：改 ${data.changedFiles.length} 个文件 / ${data.callers.length} 处调用方，风险 ${data.riskLevel}`;
  return {
    status: high ? 'warn' : 'pass',
    message: high ? `${head}（高风险：修完必须重点复核调用方）` : head,
  };
}
