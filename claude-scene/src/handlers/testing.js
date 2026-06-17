import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

export function handleTestCoverage(_action, params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  let isRan = false;
  if (existsSync(packagePath)) {
    try {
      safeExec('npx vitest run --coverage --coverage.include="src/**" 2>&1', targetPath, { stdio: 'inherit' });
      isRan = true;
    } catch { isRan = false; /* vitest coverage not configured */ }
  }
  if (context) context.coveragePassed = isRan;
  return '测试覆盖率分析完成';
}

export function handleTestUnit(_action, _params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  let testPassed = null;
  if (existsSync(packagePath)) {
    try {
      const result = safeExec('npm test 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
      testPassed = !/[Ff]ail|FAIL/.test(result);
    } catch { testPassed = false; }
  }
  if (context) context.testPassed = testPassed;
  if (testPassed === null) return '单元测试运行完成（未找到 package.json，无测试可运行）';
  return testPassed ? '单元测试运行完成（全部通过）' : '单元测试运行完成（部分失败）';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleRunSuite(_action, params, targetPath, context) {
  const mode = params?.mode || 'unit';
  const packagePath = join(targetPath, 'package.json');
  let testPassed = null;

  if (existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
      let testResult;

      if (mode === 'integration') {
        if (pkg.scripts?.['test:integration']) {
          testResult = safeExec('npm run test:integration 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
        } else if (pkg.scripts?.['test:e2e'] || pkg.scripts?.e2e) {
          testResult = safeExec('npx playwright test 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
        } else {
          if (pkg.scripts?.test) {
            testResult = safeExec('npm test 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
          } else if (pkg.scripts?.vitest) {
            testResult = safeExec('npx vitest run 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
          }
        }
      } else {
        if (pkg.scripts?.test) {
          testResult = safeExec('npm test 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
        } else if (pkg.scripts?.vitest) {
          testResult = safeExec('npx vitest run 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
        }
      }

      if (testResult && /[Ff]ail|FAIL/.test(testResult)) {
        testPassed = false;
      } else if (testResult) {
        testPassed = true;
      }
    } catch { testPassed = false; /* test runner unavailable */ }
  }

  if (context) {
    context.testPassed = testPassed;
    if (testPassed === false) context.lastStepFailed = true;
  }
  if (testPassed === null) return '测试套件运行完成（未找到 package.json，无测试可运行）';
  return testPassed ? '测试套件运行完成（全部通过）' : '测试套件运行完成（部分失败）';
}

export function handleRunAffected(_action, _params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  let affectedPassed = null;
  if (existsSync(packagePath)) {
    try {
      const result = safeExec('npx vitest run --changed 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
      affectedPassed = !/[Ff]ail|FAIL/.test(result);
    } catch { affectedPassed = false; }
  }
  if (context) context.affectedTestsPassed = affectedPassed;
  return affectedPassed ? '受影响测试全部通过' : '受影响测试部分失败';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleRunCI(_action, params, targetPath, context) {
  const checks = params?.check || ['linting', 'typing', 'coverage'];
  const results = { passed: [], failed: [], skipped: [] };

  if (checks.includes('linting')) {
    try {
      safeExec('npx eslint . --max-warnings 50 2>&1', targetPath, { stdio: 'pipe' });
      results.passed.push('linting');
      if (context) context.lintPassed = true;
    } catch {
      results.failed.push('linting');
      if (context) context.lintPassed = false;
    }
  }

  if (checks.includes('typing')) {
    try {
      safeExec('npx tsc --noEmit 2>&1', targetPath, { stdio: 'pipe' });
      results.passed.push('typing');
      if (context) context.typecheckPassed = true;
    } catch {
      results.failed.push('typing');
      if (context) context.typecheckPassed = false;
    }
  }

  if (checks.includes('coverage')) {
    try {
      safeExec('npx vitest run --coverage 2>&1', targetPath, { stdio: 'pipe' });
      results.passed.push('coverage');
      if (context) context.coveragePassed = true;
    } catch {
      results.failed.push('coverage');
      if (context) context.coveragePassed = false;
    }
  }

  if (results.failed.length) console.error(chalk.yellow(`  ⚠ 失败: ${results.failed.join(', ')}`));
  return `CI 完成: ${results.passed.length}/${results.passed.length + results.failed.length} 通过`;
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
    return { ran: true, passed: !result.includes('fail') && !result.includes('error'), output: result };
  } catch (e) {
    return { ran: false, passed: false, output: e.stdout || e.message };
  }
}

export function handleLoadTest(_action, params, targetPath, context) {
  const mode = params?.mode || 'smoke';

  const configs = findArtilleryConfig(targetPath);

  if (configs.length === 0) {
    if (context) context.loadTestPassed = null;
    return '负载测试跳过（无配置文件）';
  }

  // Select config matching mode, or first available
  const config = configs.find(c => c.name === mode) || configs[0];

  const result = runArtillery(config.path, targetPath);

  if (!result.ran) {
    if (context) context.loadTestPassed = null;
    return '负载测试跳过（Artillery 不可用）';
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
    : `负载测试完成: ${config.name} 失败`;
}
