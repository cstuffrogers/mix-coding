import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { safeExec } from '../lib/safe-exec.js';

// ── 探测器自检产物（detector sweep report）──
//
// review 场景**不能**直接跑 detector-sweep：那东西会临时改写工作区文件，
// 只在人工/CI 里跑一次把结论落盘才对。引擎这侧只消费产物，和影响域（impact）
// 一个套路：缺产物既不是 pass 也不是 fail，而是 skip「没有自检记录」——
// 把「没验」洗成「验过了」才是这里最该防的假绿。

const REPORTS_DIR = '.claude/reports';
const PREFIX = 'detector-sweep-';
const HINT = '跑 npm run detector:sweep 生成';

function latestReportFile(targetPath) {
  const dir = join(targetPath, REPORTS_DIR);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith('.json'))
    .sort();
  return files.length > 0 ? join(dir, files.at(-1)) : null;
}

/** 产物形状不对就等于没有产物：宁可 skip，也不拿半截数据当结论 */
function checkShape(data) {
  if (typeof data?.total !== 'number' || typeof data?.passed !== 'number') return '产物缺 total/passed';
  if (!Array.isArray(data?.failed) || !Array.isArray(data?.stale)) return '产物缺 failed/stale 明细';
  return null;
}

function readReport(targetPath) {
  const file = latestReportFile(reportBase(targetPath));
  if (!file) return { data: null, file: null, problem: `没有探测器自检记录（${REPORTS_DIR}/${PREFIX}<stamp>.json）` };
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    const problem = checkShape(data);
    return problem ? { data: null, file, problem } : { data, file, problem: null };
  } catch {
    return { data: null, file, problem: '自检记录不是合法 JSON' };
  }
}

function gitHead(targetPath) {
  try {
    return safeExec('git rev-parse HEAD', targetPath, { stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

/**
 * 产物一定落在仓库根的 .claude/reports/：swep 从引擎仓库根开跑，但 review 可能在
 * claude-scene/ 子目录下被调起（cwd 即 targetPath）。只按 targetPath 找会误报「没有记录」。
 */
function reportBase(targetPath) {
  try {
    const top = safeExec('git rev-parse --show-toplevel', targetPath, { stdio: 'pipe' }).toString().trim();
    return top === '' ? targetPath : top;
  } catch {
    return targetPath;
  }
}

const shortSha = (sha) => (typeof sha === 'string' && sha.length >= 7 ? sha.slice(0, 7) : '未知');

/** 按「严重 → 轻微」返回第一条该报的问题；没有则 null */
function verdictOf(data, { head, dirty }) {
  if (data.stale.length > 0) {
    return { status: 'warn', message: `${data.stale.length} 条用例的注入点已过期（守卫可能和代码脱节）：${data.stale.join('；')}` };
  }
  if (data.failed.length > 0) {
    return { status: 'warn', message: `${data.failed.length} 个守卫是空的（注入违规后仍然绿）：${data.failed.join('；')}` };
  }
  if (data.passed !== data.total) {
    return { status: 'warn', message: `自检记录自相矛盾：passed=${data.passed} / total=${data.total}` };
  }
  if (dirty) {
    return { status: 'warn', message: `自检是在有未提交改动的工作区跑的（${data.passed}/${data.total} 有效），结论未必对应当前代码` };
  }
  if (head && data.gitSha && head !== data.gitSha) {
    return { status: 'warn', message: `自检记录来自 ${shortSha(data.gitSha)}，当前 HEAD 是 ${shortSha(head)} —— 记录已过期` };
  }
  return null;
}

export function handleDetectorReport(_action, _params, targetPath, context) {
  const root = targetPath ?? '.';
  const { data, problem } = readReport(root);

  if (!data) {
    if (context) {
      context.detectorSweepReported = false;
      context.detectorSweepProblem = problem;
    }
    return { status: 'skip', message: `${problem} —— 守卫是否真的会红，本轮未验（${HINT}）` };
  }

  if (context) {
    context.detectorSweepReported = true;
    context.detectorSweepPassed = data.passed;
    context.detectorSweepTotal = data.total;
  }

  const issue = verdictOf(data, {
    head: gitHead(root),
    dirty: data.workingTreeDirty === true,
  });
  if (issue) return issue;

  return { status: 'pass', message: `探测器自检 ${data.passed}/${data.total} 有效（${shortSha(data.gitSha)}）` };
}
