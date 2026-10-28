// Deep review tools — the "logic defect / IO validation" tier from
// docs/补充.md (open-code-review, CodeQL, AI Code Reviewer, Semgrep, Sonar).
//
// Reality check, verified on this machine rather than assumed:
//   semgrep          1.165.0 installed via pip   → real integration (offline rules)
//   codeql           not installed, ~1GB bundle  → detect + skip with hint
//   sonar-scanner    not installed, needs server → detect + skip with hint
//   open-code-review no npm/pip package at all   → conversation-mode guidance
//   ai-codereviewer  GitHub Action only          → conversation-mode guidance
//
// Design rules shared with the rest of the engine:
//   - A missing tool must report 「跳过」 so start.js classifies the step as
//     noop instead of pass. A security step that silently "passes" without
//     having run is worse than an honest skip.
//   - An empty scan target is a FAILURE (assertSources), never a pass.
import { existsSync, readdirSync } from 'fs';
import { delimiter, join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { assertSources, codeRoots, listProjectCodeFiles, loadScanIgnore } from '../lib/project-sources.js';
import { PACKAGE_ROOT } from '../lib/paths.js';

export const DEFAULT_RULE_PACK = join(PACKAGE_ROOT, 'src', 'rules', 'semgrep-logic-io.yml');

// Directories pip drops console scripts into on Windows. `pip install semgrep`
// succeeds but the Scripts dir is often absent from PATH, so a bare
// `semgrep --version` probe reports "not installed" on a working install.
function _windowsScriptDirs() {
  const roots = [
    process.env.APPDATA && join(process.env.APPDATA, 'Python'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'Python'),
  ].filter(Boolean);
  const dirs = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    try {
      for (const entry of readdirSync(root)) {
        if (/^Python3\d+$/i.test(entry)) dirs.push(join(root, entry, 'Scripts'));
      }
    } catch {
      /* 目录不可读就换下一个候选 */
    }
  }
  return dirs;
}

function _candidateCommands(tool) {
  // { command, extraPath } — extraPath is prepended to PATH for the call.
  // semgrep.exe on Windows is a thin shim that execs `pysemgrep` by name, so
  // resolving the absolute .exe is not enough: its own Scripts dir must be on
  // PATH or it dies with "executing pysemgrep failed".
  const out = [{ command: tool, extraPath: null }];
  if (process.platform !== 'win32') return out;
  for (const dir of _windowsScriptDirs()) {
    out.push({ command: `"${join(dir, `${tool}.exe`)}"`, extraPath: dir });
  }
  return out;
}

function _probeEnv(extraPath) {
  if (!extraPath) return process.env;
  const key = Object.keys(process.env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  return { ...process.env, [key]: `${extraPath}${delimiter}${process.env[key] || ''}` };
}

/**
 * Probe a CLI for a usable install.
 * @returns {{output: string, command: string, extraPath: string|null}|null}
 */
function _probeCommand(tool, cwd) {
  for (const candidate of _candidateCommands(tool)) {
    try {
      const output = safeExec(`${candidate.command} --version 2>&1`, cwd, {
        stdio: 'pipe', timeout: 90000, env: _probeEnv(candidate.extraPath),
      }).toString();
      // A version line contains at least one digit; banners/warnings do not
      // count on their own.
      if (/\d/.test(output)) return { output, ...candidate };
    } catch {
      /* 试下一个候选 */
    }
  }
  return null;
}

/**
 * Probe for a working semgrep binary.
 * @returns {{command: string, extraPath: string|null}|null}
 */
function resolveSemgrep() {
  const hit = _probeCommand('semgrep', process.cwd());
  return hit ? { command: hit.command, extraPath: hit.extraPath } : null;
}

/** Parse `semgrep --json` output into flat findings. Tolerates parse failures. */
export function parseSemgrepJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { findings: [], ruleErrors: [], parseErrors: [], parseFailed: true };
  }
  const findings = (parsed.results || []).map((r) => ({
    rule: String(r.check_id || '').split('.').pop(),
    file: r.path,
    line: r.start?.line ?? 0,
    severity: r.extra?.severity || 'WARNING',
    message: (r.extra?.message || '').split('\n')[0].slice(0, 160),
  }));
  // semgrep 的 errors 里混着两类完全不同的东西：
  //   1) 规则/配置没加载 → 扫出来的「0 处」不可信，必须当告警指出；
  //   2) 目标文件语法解析失败（.mjs/JSX 常见）→ 只是这部分内容没参与匹配。
  // 旧实现一律叫「N 条规则加载失败」并把 message 打出来，于是
  // 「Syntax error at line .agents/skills/.../detect-text.mjs:21」被读成规则坏了。
  const errors = (parsed.errors || []).map(e => ({
    ruleId: e.rule_id || '',
    type: typeof e.type === 'string' ? e.type : (Array.isArray(e.type) ? String(e.type[0] || '') : ''),
    path: e.path || '',
    message: e.message || '',
  }));
  const isParseError = e => /^Syntax error/i.test(e.message) || /PartialParsing/i.test(e.type);
  const ruleErrors = errors.filter(e => !isParseError(e)).map(e => e.ruleId || e.message || 'unknown');
  const parseErrors = errors.filter(e => isParseError(e)).map(e => e.path || e.message);
  return { findings, ruleErrors, parseErrors, parseFailed: false };
}

/** Pick the config to run: a project-local rule file wins over the shipped pack. */
export function resolveSemgrepConfig(targetPath) {
  for (const name of ['.semgrep.yml', '.semgrep.yaml', 'semgrep.yml']) {
    const candidate = join(targetPath, name);
    if (existsSync(candidate)) return { config: candidate, source: 'project' };
  }
  return { config: DEFAULT_RULE_PACK, source: 'engine' };
}

// Semgrep scans whatever paths it is given, so handing it "." re-includes the
// directories listProjectCodeFiles just filtered out (coverage reports, vendored
// UMD bundles, nested repos with their own .git). Scanning "." produced 12
// findings in this repo, all in generated or vendored files, and 0 in real code.
// Scan the same roots the source list came from, and exclude the noise dirs.
const NOISE_DIRS = [
  'node_modules', 'dist', 'build', 'coverage', '.git', '.claude', '.codegraph',
  'android', 'ios', '__pycache__', 'vendor', 'venv', '.venv', 'target', '.next',
  '.vite', 'test-results', 'playwright-report',
];

// Directories at the top level that carry their own .git = vendored/nested
// repos. listProjectCodeFiles drops their files, but when a root-level config
// file makes "." a scan root, semgrep would walk back into them.
function _nestedRepoDirs(targetPath) {
  try {
    return readdirSync(targetPath, { withFileTypes: true })
      .filter(e => e.isDirectory() && existsSync(join(targetPath, e.name, '.git')))
      .map(e => e.name);
  } catch {
    return [];
  }
}

/** Scan targets + exclude flags aligned with listProjectCodeFiles(). */
export function buildSemgrepTargets(targetPath, files) {
  const excludes = [...NOISE_DIRS, ...loadScanIgnore(targetPath), ..._nestedRepoDirs(targetPath)]
    .map(d => `--exclude "${d}"`)
    .join(' ');
  const roots = codeRoots(targetPath, files).map(r => `"${r}"`).join(' ');
  return { targets: roots || '.', excludes };
}

function _runSemgrep(semgrep, config, targetPath, scan) {
  return safeExec(
    `${semgrep.command} --config "${config}" --json --quiet --metrics=off `
    + `--no-git-ignore --max-target-bytes 2000000 ${scan.excludes} ${scan.targets} 2>&1 || true`,
    targetPath,
    {
      stdio: 'pipe',
      maxBuffer: 32 * 1024 * 1024,
      timeout: 600000,
      // PYTHONUTF8: Windows Python defaults to GBK and fails decoding
      // rule/config files that contain any non-ASCII byte.
      env: { ..._probeEnv(semgrep.extraPath), PYTHONUTF8: '1' },
    },
  ).toString();
}

function _printSemgrepFindings(findings, blocking) {
  if (!findings.length) {
    console.log(chalk.green('  ✅ Semgrep: 未命中逻辑/IO 缺陷模式'));
    return;
  }
  console.log(chalk.yellow(`  ⚠ 语义缺陷 ${findings.length} 处（高危 ${blocking.length} 处）:`));
  for (const f of findings.slice(0, 15)) {
    console.log(chalk.yellow(`    [${f.severity}] ${f.rule} ${f.file}:${f.line} ${f.message}`));
  }
  if (findings.length > 15) console.log(chalk.dim(`    …还有 ${findings.length - 15} 处`));
}

function _reportSemgrepErrors(ruleErrors, parseErrors, context) {
  if (ruleErrors.length) {
    // 规则没加载 = 本次匹配范围不完整，不能只看 findings 数量说「没问题」
    console.log(chalk.yellow(`  ⚠ ${ruleErrors.length} 条规则/配置加载失败（本次语义扫描不完整）: ${ruleErrors.slice(0, 3).join(', ')}`));
    if (context) context.semgrepRuleErrors = ruleErrors;
  }
  if (parseErrors.length) {
    console.log(chalk.dim(`  ℹ ${parseErrors.length} 个文件未能解析（已跳过）: ${parseErrors.slice(0, 2).join(', ')}`));
  }
}

export function handleSemgrepScan(_action, _params, targetPath, context) {
  const files = listProjectCodeFiles(targetPath);
  if (!files.length) {
    assertSources(files, context, 'Semgrep 逻辑/IO 扫描');
    return 'Semgrep 扫描失败: 扫描范围为 0 个源码文件，结果不可信';
  }

  const semgrep = resolveSemgrep();
  if (!semgrep) {
    console.log(chalk.dim('  ℹ semgrep 不可用（pip install semgrep），跳过逻辑/IO 缺陷扫描'));
    if (context) context.semgrepSkipped = true;
    return 'Semgrep 跳过: 未安装（pip install semgrep 后可启用逻辑/IO 缺陷扫描）';
  }

  const { config, source } = resolveSemgrepConfig(targetPath);
  console.log(chalk.dim(`  ℹ 规则: ${source === 'project' ? '项目自带 .semgrep.yml' : '引擎内置 logic-io 规则包'}`));

  let raw;
  try {
    raw = _runSemgrep(semgrep, config, targetPath, buildSemgrepTargets(targetPath, files));
  } catch (e) {
    console.log(chalk.dim(`  ⚠ semgrep 执行失败: ${String(e.message).slice(0, 120)}`));
    if (context) context.semgrepSkipped = true;
    // 工具装上但跑不起来 ≠ 没什么可查，以前和「未安装」一样当跳过，实际是扫描缺席。
    return { status: 'warn', message: `Semgrep 未完成：执行失败（${String(e.message).slice(0, 80)}）` };
  }

  const { findings, ruleErrors, parseErrors, parseFailed } = parseSemgrepJson(raw);
  if (parseFailed) {
    if (context) context.semgrepSkipped = true;
    return 'Semgrep 跳过: 输出无法解析';
  }
  _reportSemgrepErrors(ruleErrors, parseErrors, context);

  const blocking = findings.filter(f => f.severity === 'ERROR');
  _printSemgrepFindings(findings, blocking);

  if (context) {
    context.semgrepPassed = blocking.length === 0;
    context.semgrepFindings = findings;
  }
  return findings.length
    // 文案必须包含「N 处发现」，start.js 的 WARN_RES 才会把该步归为 warn。
    // 写成「N 处候选」会被当成 pass——扫描出阻断级缺陷却报通过。
    ? `Semgrep 逻辑/IO 扫描完成: ${findings.length} 处发现（高危 ${blocking.length} 处）`
    : 'Semgrep 逻辑/IO 扫描完成: 无发现';
}
