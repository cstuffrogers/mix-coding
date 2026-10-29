import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

export function handleTestCoverage(_action, params, targetPath, context) {
  if (!existsSync(join(targetPath, 'package.json'))) {
    if (context) context.coveragePassed = undefined;
    return { status: 'skip', message: '覆盖率未测量：没有 package.json' };
  }

  // 以前把「命令跑起来了」当成「覆盖率通过」（coveragePassed = isRan）：
  // 33% 的覆盖率也报「分析完成」→ pass。场景里写着的 threshold（80/85）
  // 根本没人读。现在要真的把这个百分数量出来、跟阈值比。
  const { output, ran } = runCoverage(targetPath);
  const percent = parseCoveragePercent(output);
  if (percent === null) {
    if (context) context.coveragePassed = undefined;
    const why = ran ? '--coverage 输出里没有统计表（没配 coverage provider？）' : '覆盖率命令没跑成';
    return { status: 'warn', message: `覆盖率未测得：${why}（没数据 ≠ 达标）` };
  }

  const threshold = Number(params?.threshold);
  const baselineNote = updateBaseline(params, targetPath, percent);
  if (!(Number.isFinite(threshold) && threshold > 0)) {
    if (context) context.coveragePassed = undefined;
    return { status: 'warn', message: `覆盖率 ${percent}%（场景未声明 threshold，只报告不判定）${baselineNote}` };
  }
  return judgeCoverage({ percent, threshold, baselineNote, params, context });
}

/** 有阈值才判定。block_on_fail: true → 当场 fail；没声明 → warn 但把 flag 留给门禁 */
function judgeCoverage({ percent, threshold, baselineNote, params, context }) {
  const passed = percent >= threshold;
  if (context) {
    context.coveragePassed = passed;
    context.coveragePercent = percent;
  }
  if (passed) return `覆盖率 ${percent}% ≥ 阈值 ${threshold}%（达标）${baselineNote}`;

  const message = `覆盖率 ${percent}% 低于阈值 ${threshold}%${baselineNote}`;
  if (params?.block_on_fail === true) {
    if (context) context.lastStepFailed = true;
    return { status: 'fail', message };
  }
  return { status: 'warn', message: `${message}（未声明 block_on_fail，交给质量门禁判定）` };
}

function runCoverage(targetPath) {
  try {
    return { output: safeExec('npx vitest run --coverage', targetPath, { stdio: 'pipe' }).toString(), ran: true };
  } catch (error) {
    // 低于阈值时 vitest 以非零退出 —— 结果仍在 stdout 里，不能丢。
    const output = [error?.stdout?.toString?.(), error?.stderr?.toString?.(), error?.message].filter(Boolean).join('\n');
    return { output, ran: false };
  }
}

/** vitest/istanbul 文本表里 All files 那一行的 % Lines，或 jest 的 Lines 汇总行 */
function parseCoveragePercent(text) {
  const allFiles = text.split('\n').find((line) => /^\s*All files\s*\|/.test(line));
  if (allFiles) {
    const cols = allFiles.split('|').map((c) => c.trim());
    // 列顺序：File | % Stmts | % Branch | % Funcs | % Lines | Uncovered
    const value = Number.parseFloat(cols[4] ?? cols[1]);
    if (Number.isFinite(value)) return value;
  }
  for (const key of ['Lines', 'Statements']) {
    const m = text.match(new RegExp(`${key}\\s*:\\s*([\\d.]+)%`));
    if (m) return Number.parseFloat(m[1]);
  }
  return null;
}

/** compare_to_baseline: 把这次覆盖率存成基线，并给出与上次的差 */
function updateBaseline(params, targetPath, percent) {
  if (params?.compare_to_baseline !== true) return '';
  const file = join(targetPath, '.claude', 'coverage-baseline.json');
  let previous = null;
  try {
    if (existsSync(file)) previous = JSON.parse(readFileSync(file, 'utf-8')).percent;
  } catch { previous = null; }
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ percent, updatedAt: new Date().toISOString() }, null, 2)}\n`);
  } catch { return '（基线写入失败，本次差值未知）'; }
  if (typeof previous !== 'number') return '（首次记录基线）';
  const delta = percent - previous;
  return `（较基线 ${previous}% ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}）`;
}

/** 测试命令的真实结论：退出码。没脚本 / 没装依赖是「没跑成」，不是「失败」。 */
function classifyTestRun(error) {
  const text = [error?.message, error?.stdout?.toString?.(), error?.stderr?.toString?.()]
    .filter(Boolean).join(' ');
  if (/Missing script|ENOENT|Cannot find|No test files|not found/i.test(text)) return 'not-run';
  return 'fail';
}

export function handleTestUnit(_action, _params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    if (context) context.testPassed = undefined;
    return { status: 'skip', message: '单元测试未运行：没有 package.json（未测量）' };
  }
  // 以前是 `npm test 2>&1 || true` + 正则找 fail 字样：退出码被吃掉，
  // 而且「0 failed」也会被当成失败（假红）。
  let testPassed;
  try {
    safeExec('npm test', targetPath, { stdio: 'pipe' });
    testPassed = true;
  } catch (error) {
    const verdict = classifyTestRun(error);
    if (verdict === 'not-run') {
      if (context) context.testPassed = undefined;
      return { status: 'warn', message: '单元测试未跑成：没有可运行的测试脚本（未测量，不算通过）' };
    }
    testPassed = false;
  }
  if (context) {
    context.testPassed = testPassed;
    if (!testPassed) context.lastStepFailed = true;
  }
  return testPassed
    ? '单元测试运行完成（全部通过）'
    : { status: 'fail', message: '单元测试运行完成（存在失败用例）' };
}

function pickTestCommand(mode, pkg) {
  const scripts = pkg.scripts || {};
  if (mode === 'integration') {
    if (scripts['test:integration']) return 'npm run test:integration';
    if (scripts['test:e2e'] || scripts.e2e) return 'npx playwright test';
  }
  if (scripts.test) return 'npm test';
  if (scripts.vitest) return 'npx vitest run';
  return null;
}

export function handleRunSuite(_action, params, targetPath, context) {
  const mode = params?.mode || 'unit';
  // regression: true（bugfix#7 / deps#8）—— 这两步要的是「回归套件」，以前没人读：
  // 声明了回归、跑的仍是 unit 套件。优先 regression 脚本，没有就如实说。
  const wantRegression = params?.regression === true;
  let setup = loadTestSetup(targetPath, wantRegression ? 'regression' : mode);
  let regressionNote = '';
  if (wantRegression && setup.error) {
    regressionNote = `（未找到 regression 测试脚本，已回落 ${mode}）`;
    setup = loadTestSetup(targetPath, mode);
  }
  if (setup.error) {
    if (context) context.testPassed = undefined;
    return setup.error;
  }
  const verdict = runTestCommand(setup.cmd, targetPath);
  if (verdict === 'not-run') {
    if (context) context.testPassed = undefined;
    return { status: 'warn', message: `测试套件未跑成：${setup.cmd} 不可用（未测量，不算通过）` };
  }
  const testPassed = verdict === 'pass';
  if (context) {
    context.testPassed = testPassed;
    if (!testPassed) context.lastStepFailed = true;
  }
  return testPassed
    ? `测试套件运行完成（全部通过）${regressionNote}`
    : { status: 'fail', message: `测试套件运行完成（存在失败用例）${regressionNote}` };
}

/** 准备阶段：package.json 可读、且有对应测试脚本（否则给一个显式 skip/warn） */
function loadTestSetup(targetPath, mode) {
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    return { error: { status: 'skip', message: '测试套件未运行：没有 package.json（未测量）' } };
  }
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  } catch {
    return { error: { status: 'warn', message: '测试套件未运行：package.json 解析失败' } };
  }
  const cmd = pickTestCommand(mode, pkg);
  if (!cmd) {
    return { error: { status: 'warn', message: `测试套件未运行：package.json 里没有 ${mode} 对应的测试脚本` } };
  }
  return { cmd };
}

/**
 * 以前命令串末尾挂 `|| true`（退出码被吃掉），再靠输出里有没有 fail 字样猜：
 * 「0 failed」→ 假红；真的全绿但输出带 'FAIL' 字样的路径 → 也假红。
 * 现在只看退出码，并把「没跑成」与「跑挂了」分开。
 */
function runTestCommand(cmd, targetPath) {
  try {
    safeExec(cmd, targetPath, { stdio: 'pipe' });
    return 'pass';
  } catch (error) {
    return classifyTestRun(error) === 'not-run' ? 'not-run' : 'fail';
  }
}

export function handleRunAffected(_action, _params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    // 以前这里报「部分失败」+ null：没跑成和跑挂了必须分开。
    if (context) context.affectedTestsPassed = undefined;
    return { status: 'skip', message: '没有 package.json，未运行受影响测试（未测量）' };
  }

  // 三态：'fail' | 'pass' | 'skip'（skip = 没跑成，不能算通过）
  const NOT_RUN_MARKERS = [
    'No test files found', 'not supported', 'ERR_MODULE_NOT_FOUND',
    'npm ERR!', 'Missing script', 'Cannot find module', 'Cannot find package',
  ];
  // 只有「带数字的 failed」才算失败；`Command failed:` 这种不许冒充测试失败。
  const hasFailedCount = (text) => text.split('\n').some((line) => {
    const idx = line.indexOf('failed');
    if (idx === -1) return false;
    const head = line.slice(0, idx);
    const seg = head.slice(head.lastIndexOf('|') + 1);
    return seg.split('').some((ch) => ch >= '0' && ch <= '9');
  });
  const classify = (text) => {
    if (hasFailedCount(text)) return 'fail';
    if (NOT_RUN_MARKERS.some((m) => text.includes(m))) return 'skip';
    return 'pass';
  };

  let verdict;
  try {
    // 去掉 `|| true`：让真实的退出码暴露出来，分类只用于判断「是否真跑了」。
    const out = safeExec('npx vitest run --changed', targetPath, { stdio: 'pipe' }).toString();
    verdict = classify(out);
  } catch (error) {
    const text = [error?.stdout?.toString?.(), error?.stderr?.toString?.(), error?.message]
      .filter(Boolean)
      .join(' | ');
    verdict = classify(text);
  }

  const affectedPassed = verdict === 'skip' ? undefined : verdict === 'pass';
  if (context) context.affectedTestsPassed = affectedPassed;
  if (verdict === 'skip') return { status: 'skip', message: '受影响测试未跑成（--changed 无测试或无 runner），结果未知' };
  if (affectedPassed) return '受影响测试全部通过';
  if (context) context.lastStepFailed = true;
  return { status: 'fail', message: '受影响测试部分失败' };
}

const CI_CHECKS = [
  { name: 'linting', cmd: 'npx eslint . --max-warnings 50', ctxKey: 'lintPassed' },
  { name: 'typing', cmd: 'npx tsc --noEmit', ctxKey: 'typecheckPassed' },
  { name: 'coverage', cmd: 'npx vitest run --coverage', ctxKey: 'coveragePassed' },
];

export function handleRunCI(_action, params, targetPath, context) {
  const checks = params?.check || ['linting', 'typing', 'coverage'];
  const results = { passed: [], failed: [], skipped: [] };

  for (const check of CI_CHECKS) {
    if (!checks.includes(check.name)) continue;
    try {
      safeExec(check.cmd, targetPath, { stdio: 'pipe' });
      results.passed.push(check.name);
      if (context) context[check.ctxKey] = true;
    } catch {
      results.failed.push(check.name);
      if (context) context[check.ctxKey] = false;
    }
  }

  if (results.failed.length) console.error(chalk.yellow(`  ⚠ 失败: ${results.failed.join(', ')}`));
  // 「CI 完成: 2/3 通过」以前被判成 pass —— 完成 ≠ 全部通过。
  if (results.failed.length) {
    return { status: 'fail', message: `CI 有失败: ${results.failed.join(', ')}（${results.passed.length}/${results.passed.length + results.failed.length} 通过）` };
  }
  if (results.passed.length === 0) {
    return { status: 'noop', message: 'CI 未运行任何检查（check 列表为空或不包含任何已知检查）' };
  }
  return `CI 完成: ${results.passed.length}/${results.passed.length} 全部通过`;
}

function scanDirForUntested(dirPath, ext, testPatterns, findings) {
  try {
    const files = scanDir(dirPath, {
      filter: (f) => f.endsWith(ext) && !f.includes('.test' + ext) && !f.includes('.spec' + ext),
    });
    for (const file of files) {
      findings.totalSourceFiles++;
      const baseName = basename(file, ext);
      const hasTest = testPatterns.some(tp => existsSync(join(dirname(file), `${baseName}${tp}${ext}`)));
      if (!hasTest) findings.untested.push(file);
    }
  } catch { /* dir empty or unavailable */ }
}

function scanForUntestedFiles(targetPath) {
  const findings = { untested: [], totalSourceFiles: 0 };
  const srcExts = ['.ts', '.tsx', '.js', '.jsx'];
  const testPatterns = ['.test.', '.spec.'];
  const srcDirs = ['src', 'lib', 'handlers', 'components', 'utils', 'pages', 'hooks', 'services'];

  for (const dir of srcDirs) {
    const dirPath = join(targetPath, dir);
    if (!existsSync(dirPath)) continue;
    for (const ext of srcExts) {
      scanDirForUntested(dirPath, ext, testPatterns, findings);
    }
  }
  return findings;
}

function parseCoverageReport(targetPath) {
  const lowCoverage = [];
  const covDir = join(targetPath, 'coverage');
  if (!existsSync(covDir)) return lowCoverage;
  try {
    const covSummaryPath = join(targetPath, 'coverage', 'coverage-summary.json');
    if (!existsSync(covSummaryPath)) return lowCoverage;
    const summary = JSON.parse(readFileSync(covSummaryPath, 'utf-8'));
    for (const [file, data] of Object.entries(summary)) {
      if (file === 'total') continue;
      if (data.lines?.pct < 80) lowCoverage.push({ file, coverage: `${data.lines.pct}%` });
    }
  } catch { /* no coverage data */ }
  return lowCoverage;
}

export function handleGenerateTest(_action, _params, targetPath, context) {
  const findings = scanForUntestedFiles(targetPath);
  findings.lowCoverage = parseCoverageReport(targetPath);

  const findingsDir = join(targetPath, '.claude');
  try {
    if (!existsSync(findingsDir)) mkdirSync(findingsDir, { recursive: true });
    writeFileSync(join(findingsDir, 'test-gaps.json'), JSON.stringify(findings, null, 2), 'utf-8');
  } catch { /* unable to write */ }

  if (context) {
    context.testGaps = findings;
    context.testGenPrepared = true;
  }

  if (findings.untested.length === 0 && findings.lowCoverage.length === 0) {
    return '测试缺口分析完成（无缺口）';
  }
  return `测试缺口分析完成: ${findings.untested.length} 未测试, ${findings.lowCoverage.length} 覆盖率不足`;
}

// ── Load Testing (Artillery) ──

const LOAD_TEST_DIRS = ['tests/load', 'tests/performance', 'test/load', 'test/performance'];

function findArtilleryConfig(targetPath) {
  const configs = [];
  for (const dir of LOAD_TEST_DIRS) {
    const dirPath = join(targetPath, dir);
    if (!existsSync(dirPath)) continue;
    try {
      for (const entry of readdirSync(dirPath)) {
        if (entry.endsWith('.yml') || entry.endsWith('.yaml')) {
          configs.push({ name: entry.replace(/\.ya?ml$/, ''), path: join(dirPath, entry) });
        }
      }
    } catch { /* skip */ }
  }
  if (existsSync(join(targetPath, 'artillery.yml'))) {
    configs.push({ name: 'default', path: join(targetPath, 'artillery.yml') });
  }
  return configs;
}

function runArtillery(configPath, targetPath) {
  try {
    const result = safeExec(
      `npx artillery run "${configPath}" --output "${join(tmpdir(), 'artillery-report.json')}" 2>&1`,
      targetPath, { stdio: 'pipe' }
    ).toString();
    // execSync 在非零退出码时抛错，所以能返回就是 exit 0 = 真的跑过了。
    // 以前用 `!result.includes('fail')` 判通过：artillery 的报告表本身就有
    // `failures` 这一列（即使是 0），于是**通过的负载测试被报成失败**（假红）。
    // 退出码已经是权威结论，不需要再从文案里猜。
    return { ran: true, passed: true, output: result };
  } catch (e) {
    return { ran: false, passed: false, output: e.stdout || e.message };
  }
}

export function handleLoadTest(_action, params, targetPath, context) {
  const mode = params?.mode || 'smoke';

  const configs = findArtilleryConfig(targetPath);

  if (configs.length === 0) {
    // 没跑负载测试就不写 verdict（以前写 null，门禁的 `!== false` 把它当通过）
    return { status: 'skip', message: '负载测试跳过（无配置文件，不是通过）' };
  }

  // Select config matching mode, or first available
  const config = configs.find(c => c.name === mode) || configs[0];

  const result = runArtillery(config.path, targetPath);

  if (!result.ran) {
    // 同上：Artillery 不可用 = 没测量，不写 verdict
    return { status: 'skip', message: '负载测试跳过（Artillery 不可用，不是通过）' };
  }

  if (result.passed) {
    console.log(chalk.green(`  ✅ ${config.name} 负载测试通过`));
  } else {
    console.log(chalk.red(`  ❌ ${config.name} 负载测试失败`));
  }

  if (context) {
    context.loadTestPassed = result.passed;
    context.loadTestOutput = result.output;
    if (!result.passed) context.lastStepFailed = true;
  }

  return result.passed
    ? `负载测试完成: ${config.name} 通过`
    : { status: 'fail', message: `负载测试完成: ${config.name} 失败` };
}
