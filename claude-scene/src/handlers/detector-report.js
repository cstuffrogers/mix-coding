import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SWEEP_SCRIPT = join(ENGINE_DIR, 'scripts', 'detector-sweep.cjs');
const SWEEP_TIMEOUT_MS = 900_000;

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
  // 类别在这里就该定下来：下面三种情况上游看到的只是 problem 文案，
  // 让上游按文案猜类别就是第四轮修掉的那种「靠正则猜结论」。
  if (!file) return { data: null, file: null, problem: `没有探测器自检记录（${REPORTS_DIR}/${PREFIX}<stamp>.json）`, reason: 'input-missing' };
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    const problem = checkShape(data);
    return problem ? { data: null, file, problem, reason: 'input-invalid' } : { data, file, problem: null };
  } catch {
    return { data: null, file, problem: '自检记录不是合法 JSON', reason: 'input-invalid' };
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

/**
 * 记录新鲜度：能证明「这份记录就是当前代码跑出来的」才算数。
 * 证明不了（git 不可用 / 记录里没 gitSha）= 没查过，不许当通过。
 */
function freshnessOf(data, head) {
  if (!head) return '无法确认自检记录是否对应当前代码（git 不可用）';
  if (!data.gitSha) return '自检记录里没有 gitSha，无法确认是否对应当前代码';
  if (head !== data.gitSha) return `自检记录来自 ${shortSha(data.gitSha)}，当前 HEAD 是 ${shortSha(head)} —— 记录已过期`;
  return null;
}

/** 按「严重 → 轻微」返回第一条该报的问题；没有则 null
 *
 * 第二十一轮：每条 warn 自己声明类别。以前它们全被打成「有发现」——「记录来自
 * abc123，当前 HEAD 是 def456」不是发现，是要人重跑一次自检；算成发现，
 * 读者会跑去报告里找那 0 条。判定权在处理器，不在引擎按文案猜。
 */
function verdictOf(data, { head, dirty }) {
  if (data.stale.length > 0) {
    return { status: 'warn', warnKind: 'findings', message: `${data.stale.length} 条用例的注入点已过期（守卫可能和代码脱节）：${data.stale.join('；')}` };
  }
  if (data.failed.length > 0) {
    return { status: 'warn', warnKind: 'findings', message: `${data.failed.length} 个守卫是空的（注入违规后仍然绿）：${data.failed.join('；')}` };
  }
  if (data.passed !== data.total) {
    return { status: 'warn', warnKind: 'inconsistent-evidence', message: `自检记录自相矛盾：passed=${data.passed} / total=${data.total}` };
  }
  if (dirty) {
    return { status: 'warn', warnKind: 'stale-evidence', message: `自检是在有未提交改动的工作区跑的（${data.passed}/${data.total} 有效），结论未必对应当前代码` };
  }
  const stale = freshnessOf(data, head);
  return stale ? { status: 'warn', warnKind: 'stale-evidence', message: stale } : null;
}

function workingTreeDirty(targetPath) {
  try {
    return safeExec('git status --porcelain', targetPath, { stdio: 'pipe' }).toString().trim() !== '';
  } catch {
    return true;
  }
}

/**
 * `--with-sweep` 时在审查**开始前**现场跑一次自检（跑完产物就是新的）。
 * 审查本体依然只读：注入式自检跑在它前面，不在它中间。
 * 工作区脏就不跑 —— 脏着跑出来的记录一样不可信，还会把工作区搅一下。
 */
function maybeRunSweep(root, context) {
  // 交互步骤 2.68 写 withSweep；--with-sweep 写 sweepForced（强制，不看交互结果）
  if (!context?.withSweep && !context?.sweepForced) return null;
  if (workingTreeDirty(root)) return 'skip-dirty';
  console.log('\n  ⏳ 正在现场自检（detector-sweep，约 1~2 分钟）…');
  try {
    // 非零退出 = 有守卫是空的，产物照写，交给 verdictOf 点名
    execFileSync(process.execPath, [SWEEP_SCRIPT], {
      cwd: ENGINE_DIR, stdio: 'pipe', encoding: 'utf8', timeout: SWEEP_TIMEOUT_MS,
    });
  } catch { /* 同上 */ }
  return 'ran';
}

export function handleDetectorReport(_action, _params, targetPath, context) {
  const root = targetPath ?? '.';
  const sweep = maybeRunSweep(root, context);

  if (sweep === 'skip-dirty') {
    return {
      status: 'warn',
      warnKind: 'stale-evidence',
      message: '工作区有未提交改动，跳过现场自检（脏着跑出来的记录一样不可信）—— 提交或 git stash 后重跑',
    };
  }

  const { data, problem, reason } = readReport(root);

  if (!data) {
    // 第十一轮：以前还写了 detectorSweepReported / detectorSweepProblem，两个键无人读
    // （与第十轮删掉的那批 verdict 旗标同一类负债），彻底删除。问题本身已经写进 message。
    //
    // 第十一轮补：本轮现场自检刚跑过却读不到产物 ≠ 从来没跑过。以前一律提示
    // 「跑 npm run detector:sweep 生成」—— 读者刚刚才让它跑过，等于把人绕回原地。
    if (sweep === 'ran') {
      return { status: 'skip', reason, message: `本轮现场自检没有产出可用记录：${problem} —— 看 detector-sweep 自己的输出；这不是通过` };
    }
    // --skip-sweep 是用户的明确表态：别再劝他跑一次，把表态说出来
    const skippedByUser = context?.sweepDecision === 'skip' ? '（本轮按 --skip-sweep 未跑自检）' : '';
    return { status: 'skip', reason, message: `${problem} —— 守卫是否真的会红，本轮未验（${HINT}）${skippedByUser}` };
  }

  const issue = verdictOf(data, {
    head: gitHead(root),
    dirty: data.workingTreeDirty === true,
  });

  if (context) {
    // 门禁旗标只允许布尔值。以前直接写 `data.passed`（数字 12），
    // 而 evalStandardGate 的新契约是「只有 === true 才算通过」—— 数字会被当成
    // 「有值但不是结论」。这里的布尔值就是 verdict 本身：没问题 → true。
    context.detectorSweepPassed = issue === null;
  }

  if (issue) return issue;

  return {
    status: 'pass',
    message: `探测器自检 ${data.passed}/${data.total} 有效（${shortSha(data.gitSha)}）${sweep === 'ran' ? '（本轮现场自检）' : ''}`,
  };
}
