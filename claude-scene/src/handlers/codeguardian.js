import { existsSync, readFileSync, realpathSync } from 'fs';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';

/**
 * CodeGuardian 变更边界验证。
 *
 * 之前这里是个纯桩：`return 'CodeGuardian 优化仅对话模式可用（需 codeguardian MCP），CLI 模式跳过'`。
 * 但 refactor/optimize/loop 三个场景把它标成「最关键防线」并挂了 `on_error: abort`，
 * 也就是说这条门禁号称会拦截过度膨胀，实际什么都没测。
 *
 * 现在真的量两个可以离线测的维度：
 *   - 变更行数（git diff --numstat + 未跟踪文件，相对 base）
 *   - 新增依赖数（package.json 的 dependencies/devDependencies 键集合差）
 * 复杂度没有可靠的离线工具，不猜，明说未测量。
 */

export const DEFAULT_LIMITS = {
  maxLines: 50,      // ±50 行
  maxDeps: 0,        // 0 个新依赖
  maxComplexityPct: 130,
};

const UNTRACKED_FILE_CAP = 500;

function git(targetPath, args) {
  try {
    const out = safeExec(`git ${args}`, targetPath, { stdio: 'pipe', timeout: 30000 });
    return out === undefined || out === null ? '' : String(out);
  } catch {
    return null;
  }
}

function normPath(p) {
  // realpath 是必需的：mkdtemp 给的路径可能带 8.3 短名（ADMINI~1），而 git 回报
  // 完整名（Administrator），不比 realpath 就会永远不相等。
  let real = p;
  try { real = realpathSync.native(p); } catch { /* 不存在就按原样比 */ }
  let out = real.replaceAll('\\', '/');
  while (out.endsWith('/')) out = out.slice(0, -1);
  return out.toLowerCase();
}

// 引擎自己产出的文件（报告/日志/记忆/备份）不是业务变更，把它们算进 ±50 边界
// 就等于自己把自己 abort 掉（实测：aislop 报告落盘后立刻多出 64 行“变更”）。
const GENERATED_PREFIXES = ['.claude/reports/', '.claude/logs/', '.claude/memory/', '.claude/backups/'];

function isGeneratedArtifact(relPath) {
  const normalized = String(relPath || '').replaceAll('\\', '/');
  return GENERATED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function changedLines(targetPath, base) {
  const numstat = git(targetPath, `diff --numstat ${base}`);
  if (numstat === null) return null;

  let added = 0;
  let removed = 0;
  let files = 0;
  for (const line of numstat.split('\n')) {
    // 二进制文件是 "-  -  path"，数字位不是整数，自然被跳过
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) continue;
    if (isGeneratedArtifact(parts.slice(2).join(' '))) continue;
    added += Number(parts[0]);
    removed += Number(parts[1]);
    files++;
  }

  // git diff 看不到新建的未跟踪文件，而重构/优化经常新增文件 —— 漏掉就会把
  // 「加了 300 行新文件」判成「变更 0 行」。
  const listed = git(targetPath, 'ls-files --others --exclude-standard') || '';
  let untrackedLines = 0;
  for (const rel of listed.split('\n').slice(0, UNTRACKED_FILE_CAP)) {
    const name = rel.trim();
    if (!name || isGeneratedArtifact(name)) continue;
    try {
      untrackedLines += readFileSync(join(targetPath, name), 'utf-8').split('\n').length;
      files++;
    } catch { /* 二进制/不可读，不计量 */ }
  }

  return { added, removed, total: added + removed + untrackedLines, files };
}

function depSet(pkgJson) {
  if (!pkgJson) return new Set();
  try {
    const parsed = JSON.parse(pkgJson);
    return new Set([
      ...Object.keys(parsed.dependencies || {}),
      ...Object.keys(parsed.devDependencies || {}),
    ]);
  } catch {
    return new Set();
  }
}

function currentDeps(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  if (!existsSync(pkgPath)) return new Set();
  try {
    return depSet(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return new Set();
  }
}

/**
 * 工作区脏的时候，`git diff HEAD` 会把上一轮/别人未提交的改动也算进来，
 * 无人值守循环第二步就被自己上一轮的成果顶到 ±50 边界上 abort。
 * 运行开始前拍一张快照，之后只量本次运行新增的部分。
 */
export function captureBoundaryBaseline(targetPath, base = 'HEAD') {
  if (!targetPath || !existsSync(targetPath)) return null;
  const lines = changedLines(targetPath, base);
  if (lines === null) return null;
  return { lines, deps: [...currentDeps(targetPath)] };
}

function subtractLines(now, before) {
  const delta = (key) => Math.max((now?.[key] || 0) - (before?.[key] || 0), 0);
  return { added: delta('added'), removed: delta('removed'), total: delta('total'), files: delta('files') };
}

/** 越界时的处置说明：默认记账，strict 模式整体中止（文案随开关走，不写死在两处）。 */
function violationHint(context) {
  return context?.strictEnclosure
    ? '（--strict-enclosure：越界立即中止整个工作流）'
    : '（记账模式：本步骤判失败、工作流继续；加 --strict-enclosure 可整体中止）';
}

export function handleCodeGuardianOptimize(_action, params = {}, targetPath, context) {
  const limits = {
    maxLines: Number(params.max_lines ?? params.maxLines ?? DEFAULT_LIMITS.maxLines),
    maxDeps: Number(params.max_deps ?? params.maxDeps ?? DEFAULT_LIMITS.maxDeps),
  };
  const base = params.base || 'HEAD';

  if (!targetPath || !existsSync(targetPath)) {
    return { status: 'skip', message: 'CodeGuardian 边界检查跳过：未指定目标目录（不是通过）' };
  }

  const toplevel = git(targetPath, 'rev-parse --show-toplevel');
  if (toplevel === null || normPath(toplevel.trim()) !== normPath(targetPath)) {
    // 子目录也「在仓库里」，但统计会混进别的目录，宁可不量。
    return { status: 'skip', message: 'CodeGuardian 边界检查跳过：目标目录不是 git 仓库根，无法量化变更（不是通过）' };
  }

  const current = changedLines(targetPath, base);
  if (current === null) {
    return { status: 'skip', message: `CodeGuardian 边界检查跳过：无法读取 ${base} 的 diff（不是通过）` };
  }
  const baseline = context?.codeguardianBaseline || null;
  // 有快照：只量本轮新增的变更；没快照（单跑）：维持相对 HEAD 的旧行为。
  const lines = baseline ? subtractLines(current, baseline.lines) : current;
  const baselineDeps = baseline ? new Set(baseline.deps) : depSet(git(targetPath, `show ${base}:package.json`));
  const newDeps = [...currentDeps(targetPath)].filter((d) => !baselineDeps.has(d));
  const scope = baseline ? `（第 ${context?.iteration || 1} 轮）` : '';
  const runTotal = context ? (context.boundaryRunLines || 0) + lines.total : 0;
  const scopeTotal = baseline && context?.iteration > 1 ? `，前几轮累计 ${runTotal - lines.total} 行` : '';

  const violations = [];
  if (lines.total > limits.maxLines) {
    violations.push(`变更 ${lines.total} 行（+${lines.added}/-${lines.removed}）超过上限 ${limits.maxLines}`);
  }
  if (newDeps.length > limits.maxDeps) {
    violations.push(`新增依赖 ${newDeps.length} 个（${newDeps.join(', ')}）超过上限 ${limits.maxDeps}`);
  }

  if (context) {
    context.boundaryChecked = true;
    context.boundaryLinesChanged = lines.total;
    context.boundaryNewDeps = newDeps;
    context.boundaryViolations = violations;
    context.boundaryOk = violations.length === 0;
    context.boundaryRunLines = runTotal;
    if (violations.length > 0) context.lastStepFailed = true;
  }

  const measured = `变更${scope} ${lines.total} 行 / ${lines.files} 个文件（上限 ${limits.maxLines}），新增依赖 ${newDeps.length} 个（上限 ${limits.maxDeps}），复杂度未测量${scopeTotal}`;
  if (violations.length > 0) {
    return `CodeGuardian 边界超出：${violations.join('；')}。${measured}。请缩小改动范围，超出部分应回滚。${violationHint(context)}`;
  }
  return `CodeGuardian 边界检查通过：${measured}`;
}
