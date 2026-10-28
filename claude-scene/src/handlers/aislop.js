import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';

// `aislop fix` 没有 --include/--changes 之类收窄参数，放它跑就会一次动几百个文件，
// 无人值守循环里没人复核。超过上限只落盘报警，交人工决定。
const SAFE_FIX_MAX_FINDINGS = 200;

/**
 * 能放心交给 `aislop fix` 的规则：只做机械重写，不删代码、不删注释、不改行为。
 * 其余全部视为危险（console-leftover / narrative-comment / dead-code 那类 fix = 删行）。
 */
const SAFE_FIX_RULES = new Set([
  'ai-slop/unused-import',
  'lint/ruff/F401',
  'lint/ruff/I001',
  'lint/ruff/F541',
  'lint/ruff/UP006',
  'lint/ruff/UP015',
  'lint/ruff/UP035',
  'lint/ruff/UP045',
  'format/python-formatting',
]);

function ruleIdOf(diagnostic) {
  const engine = String(diagnostic?.engine || '');
  const rule = String(diagnostic?.rule || '');
  if (!rule) return '';
  // ai-slop 的 rule 已自带前缀（ai-slop/console-leftover），lint/format 的没有（ruff/F401）
  if (engine && rule.startsWith(`${engine}/`)) return rule;
  return engine ? `${engine}/${rule}` : rule;
}

/**
 * `.aislop/config.yml` 里我们主动关掉的规则，`aislop fix` 是不认的（实测：
 * fix 仍按默认规则集跑）。所以这些规则必须显式当成危险项拦住，否则
 * 「关掉的规则」会被 fix 反手执行 —— 关 console 结果反而被删 console。
 */
export function readDisabledRules(targetPath) {
  const file = join(targetPath || '.', '.aislop', 'config.yml');
  if (!existsSync(file)) return new Set();
  const disabled = new Set();
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^\s+([\w-]+\/[\w/.-]+):\s*"?off"?\s*$/i);
    if (m) disabled.add(m[1]);
  }
  return disabled;
}

/**
 * 修复可行性的唯一判据。之前只看「可修复条数」，于是 543 处修复在 safe 模式下
 * 实际修 0 处；不带 safe 又会把 344 行注释整段删掉。现在按规则分类：
 * 只要涉及「删代码/删注释」类规则，就不自动修。
 */
export function planAutoFix(diagnostics = [], options = {}) {
  const {
    maxFindings = SAFE_FIX_MAX_FINDINGS,
    configDisabledRules = new Set(),
    allowRules = SAFE_FIX_RULES,
    declaredFixable = null,
  } = options;

  const counts = new Map();
  for (const d of diagnostics) {
    if (!d?.fixable) continue;
    const id = ruleIdOf(d);
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const fixable = counts.values().reduce((a, b) => a + b, 0);
  const rules = [...counts].map(([rule, count]) => ({ rule, count })).sort((a, b) => b.count - a.count);
  const risky = rules.filter((r) => !allowRules.has(r.rule));
  const disabled = [...configDisabledRules].map((rule) => ({ rule, count: counts.get(rule) || 0 }));
  const declared = Number(declaredFixable ?? fixable) || 0;

  if (fixable === 0 && declared === 0) return { ok: false, reason: 'nothing', fixable: 0, rules, disabled, risky };
  // fail-closed：拿不到逐条明细就无法判断哪些规则会「删行」，宁可不动
  if (rules.length === 0) return { ok: false, reason: 'unverifiable', fixable: declared, rules, disabled, risky };
  // `aislop fix` 不读 .aislop/config.yml（实测：关了 console 规则它照删 console）。
  // 所以只要项目里关过规则，跑 fix 就等于违反配置。
  if (disabled.length > 0) return { ok: false, reason: 'config-ignored', fixable, rules, disabled, risky };
  if (risky.length > 0) return { ok: false, reason: 'risky-rules', fixable, rules, disabled, risky };
  if (fixable > maxFindings) return { ok: false, reason: 'over-limit', fixable, rules, disabled, risky };
  return { ok: true, reason: 'ok', fixable, rules, disabled, risky };
}

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
    const rules = planAutoFix(json.diagnostics || []).rules;
    reportPath = writeAislopReport(targetPath, {
      generatedAt: new Date().toISOString(),
      scene: context?._sceneId || null,
      score: json.score ?? null,
      label: json.label ?? null,
      summary: json.summary ?? null,
      engines: json.engines ?? null,
      findingAssessment: json.findingAssessment ?? null,
      fixableRules: rules,
    });
  }
  // 空输出 = 工具没跑起来（未安装/执行失败），必须与「真的没问题」区分开：
  // 以前 raw 为空时文本兜底数出 0 处 → 报「未发现 AI 代码气味」并设 aislopPassed，
  // 于是门禁跟着假绿。扫描范围为空永远不等于通过。
  const ranOk = String(raw).trim() !== '';
  if (context) {
    context.aislopPassed = ranOk && total === 0;
    context.aislop_issue_count = total;
    context.aislop_fixable = fixable;
    if (reportPath) context.aislop_report_path = reportPath;
  }
  return { total, fixable, reportPath, raw, diagnostics: json?.diagnostics || [] };
}

function scanMessage({ total, fixable, reportPath, raw }) {
  if (String(raw ?? '').trim() === '') {
    return { status: 'warn', message: 'aislop 扫描未完成：npx aislop 没有任何输出（未安装或执行失败），本次没有结论' };
  }
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
  if (String(result.raw ?? '').trim() === '') console.log(chalk.yellow('  ⚠ aislop 没有输出，本次没有结论'));
  else if (result.total === 0) console.log(chalk.green('  ✅ aislop 未发现 AI 代码气味'));
  if (result.total > 0) console.log(chalk.yellow(`  ⚠ aislop: ${result.total} 处问题，报告 ${result.reportPath}`));
  return scanMessage(result);
}

function handleFix(targetPath, context, params) {
  const before = scanAndRecord(targetPath, context);
  const limit = Number(params?.maxFindings ?? SAFE_FIX_MAX_FINDINGS);
  const plan = planAutoFix(before.diagnostics, {
    maxFindings: limit,
    configDisabledRules: readDisabledRules(targetPath),
    declaredFixable: before.fixable,
  });

  if (context) context.aislop_fix_plan = { reason: plan.reason, fixable: plan.fixable, risky: plan.risky, disabled: plan.disabled };

  if (plan.reason === 'nothing') {
    console.log(chalk.dim(`  ℹ aislop: ${before.total} 处问题中无可自动修复项`));
    return scanMessage(before);
  }
  if (!plan.ok) {
    const detail = plan.reason === 'unverifiable'
      ? `扫描结果没有逐条规则明细（fixable=${plan.fixable}），无法判断是否会删代码`
      : plan.reason === 'config-ignored'
        ? `.aislop/config.yml 关了 ${plan.disabled.length} 条规则（${plan.disabled.map((r) => r.rule).join(', ')}），而 aislop fix 不认配置，跑它会违反配置`
        : plan.reason === 'risky-rules'
          ? `属于删代码/删注释类（${plan.risky.map((r) => `${r.rule}×${r.count}`).join(', ')}），不可无人值守执行`
          : `可修复 ${plan.fixable} 处，超过上限 ${limit}`;
    console.log(chalk.yellow(`  ⚠ ${detail} → 跳过自动修复`));
    return {
      status: 'warn',
      message: `aislop: ${before.total} 处问题，跳过自动修复（${detail}）→ 报告 ${before.reportPath || 'n/a'}`,
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
