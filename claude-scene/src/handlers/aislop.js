import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';

// `aislop fix` 没有 --include/--changes 之类收窄参数，放它跑就会一次动几百个文件，
// 无人值守循环里没人复核。超过上限只落盘报警，交人工决定。
export const SAFE_FIX_MAX_FINDINGS = 200;

/**
 * `aislop ci` 现在默认输出 JSON，旧实现只认 `N issues` 文本，于是退化成「逐行数
 * json 里的 issue 字样」——同一份仓库报 994，实际 summary 是 93 errors + 846 warnings。
 * JSON 优先，文本兜底。
 */
export function parseAislopOutput(rawOutput) {
  const raw = String(rawOutput || '').trim();
  if (!raw) return { total: 0, fixable: 0, json: null };
  try {
    const json = JSON.parse(raw);
    const errors = json.summary?.errors ?? 0;
    const warnings = json.summary?.warnings ?? 0;
    return { total: errors + warnings, fixable: json.summary?.fixable ?? 0, json };
  } catch {
    // 非 JSON（--human 输出或老版本 CLI），走文本兜底
  }
  const countMatch = raw.match(/(?<!\d)(\d+)\s+(?:issues?|problems?)/i);
  const total = countMatch
    ? Number.parseInt(countMatch[1], 10)
    : raw.split('\n').filter(l =>
      /error|warning|issue|problem/i.test(l) && !/no (issues|problems|findings)/i.test(l)
    ).length;
  return { total, fixable: 0, json: null };
}

/** 扫描结果落盘：之前 994 条发现只活在 stdout 一行里，跑完即丢。 */
export function writeAislopReport(targetPath, payload) {
  const dir = join(targetPath, '.claude', 'reports');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(dir, `aislop-${stamp}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function runAislopCi(targetPath) {
  try {
    return safeExec('npx aislop ci . 2>&1', targetPath, {
      stdio: 'pipe',
      timeout: 60000,
    }).toString();
  } catch (e) {
    return e.stdout?.toString() || e.stderr?.toString() || '';
  }
}

function runAislopFix(targetPath) {
  try {
    return { ok: true, output: safeExec('npx aislop fix --safe . 2>&1', targetPath, { stdio: 'pipe', timeout: 300000 }).toString() };
  } catch (e) {
    return { ok: false, output: e.stdout?.toString() || e.stderr?.toString() || '' };
  }
}

/** 扫一次 + 落盘 + 回写 context，scan/fix 两条路径共用。 */
function scanAndRecord(targetPath, context) {
  const raw = runAislopCi(targetPath);
  const { total, fixable, json } = parseAislopOutput(raw);
  let reportPath = null;
  if (json) {
    reportPath = writeAislopReport(targetPath, {
      generatedAt: new Date().toISOString(),
      scene: context?._sceneId || null,
      score: json.score ?? null,
      label: json.label ?? null,
      summary: json.summary ?? null,
      engines: json.engines ?? null,
      findingAssessment: json.findingAssessment ?? null,
    });
  }
  if (context) {
    context.aislopPassed = total === 0;
    context.aislop_issue_count = total;
    context.aislop_fixable = fixable;
    if (reportPath) context.aislop_report_path = reportPath;
  }
  return { total, fixable, reportPath, raw };
}

function scanMessage({ total, fixable, reportPath }) {
  if (total === 0) {
    return { status: 'pass', message: `aislop 扫描完成: 未发现 AI 代码气味${reportPath ? `（报告: ${reportPath}）` : ''}` };
  }
  return {
    status: 'warn',
    message: `aislop 扫描完成: ${total} 处问题（可自动修复 ${fixable}）→ 报告 ${reportPath || 'n/a'}`,
  };
}

function handleScan(targetPath, context) {
  const result = scanAndRecord(targetPath, context);
  if (result.total === 0) console.log(chalk.green('  ✅ aislop 未发现 AI 代码气味'));
  if (result.total > 0) console.log(chalk.yellow(`  ⚠ aislop: ${result.total} 处问题，报告 ${result.reportPath}`));
  return scanMessage(result);
}

function handleFix(targetPath, context, params) {
  const before = scanAndRecord(targetPath, context);
  const limit = Number(params?.maxFindings ?? SAFE_FIX_MAX_FINDINGS);

  if (before.fixable === 0) {
    console.log(chalk.dim(`  ℹ aislop: ${before.total} 处问题中无可自动修复项`));
    return scanMessage(before);
  }
  if (before.fixable > limit) {
    console.log(chalk.yellow(`  ⚠ 可自动修复 ${before.fixable} 处 > 上限 ${limit}，跳过自动修复（需人工复核）`));
    return {
      status: 'warn',
      message: `aislop: ${before.total} 处问题，可修复 ${before.fixable} 超过上限 ${limit}，已跳过自动修复 → 报告 ${before.reportPath || 'n/a'}`,
    };
  }

  const fix = runAislopFix(targetPath);
  if (!fix.ok) {
    console.log(chalk.red('  ❌ aislop fix 执行失败'));
    return { status: 'warn', message: `aislop fix 执行失败（${fix.output.split('\n')[0]?.slice(0, 120) || '无输出'}）` };
  }
  const after = scanAndRecord(targetPath, context);
  const fixed = Math.max(before.total - after.total, 0);
  if (context) context.aislop_fixed_count = fixed;
  console.log(chalk.green(`  ✅ aislop fix: ${before.total} → ${after.total}（修复/消除 ${fixed} 处）`));
  return {
    status: after.total === 0 ? 'pass' : 'warn',
    message: `aislop fix 完成: ${before.total} → ${after.total}，消除 ${fixed} 处 → 报告 ${after.reportPath || 'n/a'}`,
  };
}

export function handleAislopScan(_action, params, targetPath, context) {
  if (params?.mode === 'fix') return handleFix(targetPath, context, params);
  return handleScan(targetPath, context);
}
