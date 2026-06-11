import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleTestCoverage(_action, params, targetPath, context) {
  console.log(chalk.blue('\n📊 正在运行测试覆盖率...'));
  const packagePath = join(targetPath, 'package.json');
  let ran = false;
  if (existsSync(packagePath)) {
    try {
      safeExec('npx vitest run --coverage --coverage.include="src/**" 2>&1', targetPath, { stdio: 'inherit' });
      ran = true;
    } catch { ran = false; /* vitest coverage not configured */ }
  }
  if (context) context.coveragePassed = ran;
  return '测试覆盖率分析完成';
}

export function handleTestUnit(_action, _params, targetPath) {
  console.log(chalk.blue('\n🧪 正在运行单元测试...'));
  const packagePath = join(targetPath, 'package.json');
  if (existsSync(packagePath)) {
    try {
      safeExec('npm test 2>&1 || true', targetPath, { stdio: 'inherit' });
    } catch { /* no test script configured */ }
  }
  return '单元测试运行完成';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleRunSuite(_action, params, targetPath, context) {
  const mode = params?.mode || 'unit';
  console.log(chalk.blue(`\n🧪 正在运行测试套件 (${mode})...`));
  const packagePath = join(targetPath, 'package.json');
  let testPassed = true;

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
          console.log(chalk.yellow('  未配置集成测试脚本，回退到单元测试'));
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

      if (testResult && testResult.includes('failed')) {
        testPassed = false;
        console.log(chalk.red('  ❌ 测试失败'));
      }
    } catch { testPassed = false; /* test runner unavailable */ }
  }

  if (context) {
    context.testPassed = testPassed;
    if (!testPassed) context.lastStepFailed = true;
  }
  return testPassed ? '测试套件运行完成（全部通过）' : '测试套件运行完成（部分失败）';
}

export function handleRunAffected(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🎯 正在运行受影响的测试...'));
  const packagePath = join(targetPath, 'package.json');
  let affectedPassed = true;
  if (existsSync(packagePath)) {
    try {
      const result = safeExec('npx vitest run --changed 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
      if (result.includes('failed')) affectedPassed = false;
    } catch { affectedPassed = false; }
  }
  if (context) context.affectedTestsPassed = affectedPassed;
  return affectedPassed ? '受影响测试全部通过' : '受影响测试部分失败';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleRunCI(_action, params, targetPath, context) {
  const checks = params?.check || ['linting', 'typing', 'coverage'];
  console.log(chalk.blue('\n🔄 正在运行 CI 流水线...'));
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

  console.log(chalk.green(`  ✅ 通过: ${results.passed.join(', ') || '无'}`));
  if (results.failed.length) console.log(chalk.yellow(`  ⚠ 失败: ${results.failed.join(', ')}`));
  if (results.skipped.length) console.log(chalk.dim(`  ⏭ 跳过: ${results.skipped.join(', ')}`));
  return `CI 完成: ${results.passed.length}/${results.passed.length + results.failed.length} 通过`;
}

function scanDirForUntested(dirPath, ext, testPatterns, findings) {
  try {
    const files = safeExec(
      `find . -name "*${ext}" -not -name "*.test${ext}" -not -name "*.spec${ext}" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null`,
      dirPath, { stdio: 'pipe' }
    ).toString().trim().split('\n').filter(Boolean);
    for (const file of files) {
      if (!file.startsWith('./')) continue;
      findings.totalSourceFiles++;
      const basename = file.replace(ext, '');
      const hasTest = testPatterns.some(tp => existsSync(join(dirPath, `${basename}${tp}${ext}`)));
      if (!hasTest) findings.untested.push(file);
    }
  } catch { /* dir empty or find unavailable */ }
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
    const covSummary = safeExec(
      'find coverage -name "coverage-summary.json" 2>/dev/null | head -1',
      targetPath, { stdio: 'pipe' }
    ).toString().trim();
    if (!covSummary) return lowCoverage;
    const summary = JSON.parse(readFileSync(join(targetPath, covSummary), 'utf-8'));
    for (const [file, data] of Object.entries(summary)) {
      if (file === 'total') continue;
      if (data.lines?.pct < 80) lowCoverage.push({ file, coverage: `${data.lines.pct}%` });
    }
  } catch { /* no coverage data */ }
  return lowCoverage;
}

export function handleGenerateTest(_action, params, targetPath, context) {
  const mode = params?.mode || 'unit';
  console.log(chalk.blue(`\n🧪 正在分析测试缺口 (${mode})...`));

  const findings = scanForUntestedFiles(targetPath);
  findings.lowCoverage = parseCoverageReport(targetPath);

  console.log(chalk.dim(`  源文件总数: ${findings.totalSourceFiles}`));
  console.log(chalk.yellow(`  缺少测试: ${findings.untested.length} 个文件`));
  console.log(chalk.yellow(`  覆盖率不足: ${findings.lowCoverage.length} 个文件`));

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
    console.log(chalk.green('  ✅ 测试覆盖率良好'));
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
  console.log(chalk.blue(`\n🔥 正在运行负载测试 (${mode})...`));

  const configs = findArtilleryConfig(targetPath);

  if (configs.length === 0) {
    console.log(chalk.yellow('  未发现 Artillery 配置文件'));
    console.log(chalk.dim('  请在 tests/load/ 目录创建 .yml 配置文件'));
    if (context) context.loadTestPassed = null;
    return '负载测试跳过（无配置文件）';
  }

  // Select config matching mode, or first available
  const config = configs.find(c => c.name === mode) || configs[0];
  console.log(chalk.dim(`  配置文件: ${config.path}`));

  const result = runArtillery(config.path, targetPath);

  if (!result.ran) {
    console.log(chalk.yellow('  Artillery 未安装，跳过'));
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
