import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeExec } from '../lib/safe-exec.js';

// ── 围栏（fence）──
//
// 「先建围栏再施工」的工程化最小实现：不生成新测试，而是把**现有测试集的通过集合**
// 冻结成地界桩，改完之后逐条比对。原先通过的用例变成失败/消失，就是越界。
//
// 三个动作分工：
//   fenceCapture —— 动手前拍桩（写 .claude/reports/fence-<stamp>.json）
//   fenceVerify  —— 动完手比对，越界即 fail 并点名用例
//   fenceRestore —— 越界时按快照把改动过的文件退回去（git stash create 的快照，不动工作区）

const NOT_RUN_MARKERS = [
  'No test files found', 'not supported', 'ERR_MODULE_NOT_FOUND',
  'npm ERR!', 'Missing script', 'Cannot find module', 'Cannot find package',
];

const REPORTS_DIR = '.claude/reports';

function reportsDir(targetPath) {
  return join(targetPath, REPORTS_DIR);
}

function hasPackageJson(targetPath) {
  return existsSync(join(targetPath, 'package.json'));
}


/** 从 vitest --reporter=json 的输出里切出 JSON（前后可能有日志）。 */
function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 把 vitest JSON 结果摊平成 { 完整用例名: status }。 */
function flattenResults(report) {
  const tests = {};
  for (const file of report?.testResults || []) {
    for (const item of file?.assertionResults || []) {
      const name = item.fullName || item.title || item.name;
      if (!name) continue;
      tests[name] = item.status;
    }
  }
  return tests;
}

function runSuite(targetPath) {
  let raw;
  try {
    raw = safeExec('npx vitest run --reporter=json', targetPath, { stdio: 'pipe' }).toString();
  } catch (error) {
    raw = [error?.stdout?.toString?.(), error?.stderr?.toString?.(), error?.message]
      .filter(Boolean)
      .join(' | ');
  }

  // 先看有没有逐条明细。有就只信明细——JSON 里本来就可能出现
  // "Cannot find module" 这类被测试断言的字符串，按文本判「跑没跑成」会误判。
  const tests = flattenResults(extractJson(raw));
  if (Object.keys(tests).length > 0) return { tests, runnable: true };

  const notRun = NOT_RUN_MARKERS.some((m) => raw.includes(m));
  return { tests, runnable: false, reason: notRun ? 'runner 不可用' : '没有逐条用例' };
}

function latestFenceFile(targetPath) {
  const dir = reportsDir(targetPath);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.startsWith('fence-') && f.endsWith('.json')).sort();
  return files.length > 0 ? join(dir, files.at(-1)) : null;
}

function readSnapshot(targetPath, snapshotPath) {
  const file = snapshotPath && existsSync(snapshotPath) ? snapshotPath : latestFenceFile(targetPath);
  if (!file) return null;
  try {
    return { path: file, data: JSON.parse(readFileSync(file, 'utf-8')) };
  } catch {
    return null;
  }
}

// 围栏回滚只关心「被改动过的已跟踪文件」。
// 冒头的两类噪声必须排除，否则 git checkout 会 pathspec 报错把整个回滚拖坏：
//   - 未跟踪文件（??）：快照里没有它们，删不删都不该由回滚擅自决定
//   - 引擎自产报告（.claude/reports/*）与依赖目录
const RESTORE_IGNORE_PREFIXES = ['node_modules/', '.claude/reports/', '.git/'];

function changedFiles(targetPath) {
  try {
    const out = safeExec('git status --porcelain', targetPath, { stdio: 'pipe' }).toString();
    return out
      .split(/\r?\n/)
      .map((line) => ({ code: line.slice(0, 2), path: line.slice(3).trim() }))
      .filter((entry) => entry.path && !entry.code.includes('?') && !entry.code.includes('!'))
      .filter((entry) => RESTORE_IGNORE_PREFIXES.every((p) => !entry.path.startsWith(p)))
      .map((entry) => entry.path);
  } catch {
    return [];
  }
}

/** 某个路径在快照里是否存在（不存在就没法 checkout 回来）。 */
function existsInSnapshot(targetPath, sha, file) {
  try {
    safeExec(`git cat-file -e ${sha}:${file}`, targetPath, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function handleFenceCapture(_action, _params, targetPath, context) {
  if (!hasPackageJson(targetPath)) {
    return { status: 'skip', message: '没有 package.json，无法建立围栏（未测量）' };
  }

  const { tests, runnable, reason } = runSuite(targetPath);
  if (!runnable) {
    return { status: 'skip', message: `围栏未建立：${reason}（结果未知，不冒充通过）` };
  }

  // 回滚基准：工作区脏就用 stash 快照（含你的未提交改动），干净就用 HEAD。
  // 只靠 stash create 会踩坑——干净工作区返回空串，越界后反而回滚不了。
  const runGit = (cmd) => {
    try { return safeExec(cmd, targetPath, { stdio: 'pipe' }).toString().trim(); } catch { return ''; }
  };
  const stashed = runGit('git stash create');
  const restoreSha = stashed || runGit('git rev-parse HEAD');
  const restoreBase = stashed ? 'stash' : (restoreSha ? 'head' : '');

  const passed = Object.values(tests).filter((s) => s === 'passed').length;
  const failed = Object.values(tests).filter((s) => s === 'failed').length;
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const snapshot = {
    stamp,
    targetPath,
    snapshotSha: restoreSha,
    restoreBase,
    testCount: Object.keys(tests).length,
    passed,
    failed,
    tests,
  };

  const dir = reportsDir(targetPath);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `fence-${stamp}.json`);
  writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf-8');

  if (context) {
    context.fenceCaptured = true;
    context.fenceSnapshotPath = file;
    context.fenceTestCount = snapshot.testCount;
    context.fenceBaselineFailed = failed;
  }
  return {
    status: 'pass',
    message: `围栏已建立：锁定 ${snapshot.testCount} 个用例（当前 ${passed} 通过 / ${failed} 失败）`,
  };
}

export function handleFenceVerify(_action, _params, targetPath, context) {
  const snapshot = readSnapshot(targetPath, context?.fenceSnapshotPath);
  if (!snapshot) {
    return { status: 'skip', message: '没有围栏快照，跳过越界比对（先跑 fenceCapture）' };
  }

  const { tests, runnable, reason } = runSuite(targetPath);
  if (!runnable) {
    if (context) context.fenceViolations = 0;
    return { status: 'skip', message: `越界比对未执行：${reason}（结果未知）` };
  }

  const current = tests;
  const baselinePassed = Object.entries(snapshot.data.tests || {})
    .filter(([, status]) => status === 'passed')
    .map(([name]) => name);

  const regressions = baselinePassed.filter((name) => current[name] !== 'passed');
  if (context) {
    context.fenceViolations = regressions.length;
    context.fenceRegressionNames = regressions.slice(0, 10);
  }

  if (regressions.length > 0) {
    const shown = regressions.slice(0, 5).join('、');
    return {
      status: 'fail',
      message: `越界 ${regressions.length} 个用例：${shown}${regressions.length > 5 ? ' …' : ''}`,
    };
  }
  return {
    status: 'pass',
    message: `未越界：围栏内 ${baselinePassed.length} 个用例仍全部通过`,
  };
}

export function handleFenceRestore(_action, _params, targetPath, context) {
  const snapshot = readSnapshot(targetPath, context?.fenceSnapshotPath);
  if (!snapshot) {
    return { status: 'skip', message: '没有围栏快照，无法回滚' };
  }
  const sha = snapshot.data.snapshotSha;
  if (!sha) {
    return { status: 'skip', message: '拍桩时拿不到 git 基准（不是 git 仓库？），无法回滚' };
  }

  const files = changedFiles(targetPath);
  if (files.length === 0) {
    return { status: 'skip', message: '没有可回滚的已跟踪改动（未跟踪文件不会被回滚删除）' };
  }

  const restorable = files.filter((f) => existsInSnapshot(targetPath, sha, f));
  const skipped = files.filter((f) => !restorable.includes(f));
  if (restorable.length === 0) {
    return { status: 'skip', message: `改动都不在快照里（${files.length} 个），未回滚` };
  }

  try {
    safeExec(`git checkout ${sha} -- ${restorable.join(' ')}`, targetPath, { stdio: 'pipe' });
  } catch (error) {
    return { status: 'warn', message: `回滚失败：${error.message}` };
  }

  if (context) context.fenceRestored = restorable.length;
  const tail = skipped.length > 0 ? `（${skipped.length} 个新增文件不在快照里，保留原样）` : '';
  return {
    status: 'pass',
    message: `已回滚 ${restorable.length} 个文件到围栏快照（${sha.slice(0, 8)}）${tail}`,
  };
}
