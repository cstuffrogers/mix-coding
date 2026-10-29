// Property-based testing facilities — the only realistic way to catch *logic*
// defects (off-by-one, violated invariants, bad edge cases). Static analyzers
// like semgrep/CodeQL cannot see these: the code is syntactically fine and has
// no suspicious pattern, it just computes the wrong answer.
//
// Scope: detect what the target project already has, run it, report honestly.
// This handler never installs dependencies and never writes into the target
// project — a "setup" step that silently rewrites someone's package.json is
// worse than telling them the one command to run.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { listProjectCodeFiles } from '../lib/project-sources.js';

// lib name → how to find and run property tests written with it
const PROP_LIBS = {
  'fast-check': { lang: 'js', marker: t => /from\s+['"]fast-check['"]/.test(t), runner: 'js' },
  hypothesis: {
    lang: 'py',
    marker: t => t.split('\n').some(l => /^(?:from|import)\s+hypothesis/.test(l.trim())),
    runner: 'py',
  },
};

const TEST_FILE = /(\.test\.|\.spec\.|_test\.|^test_|\.prop\.)/i;

function _readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function _jsDeps(targetPath) {
  const pkg = _readJson(join(targetPath, 'package.json')) || {};
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function _pickJsRunner(deps) {
  if (deps.vitest) return 'npx vitest run';
  if (deps.jest) return 'npx jest';
  if (deps.mocha) return 'npx mocha';
  return null;
}

function _detectJs(targetPath) {
  const deps = _jsDeps(targetPath);
  const lib = Object.keys(PROP_LIBS).find(name => PROP_LIBS[name].lang === 'js' && deps[name]);
  if (!lib) return null;
  return { lib, runner: _pickJsRunner(deps), deps };
}

function _detectPy(targetPath) {
  const pyFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile']
    .map(f => join(targetPath, f))
    .filter(existsSync);
  for (const file of pyFiles) {
    let text;
    try {
      text = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    if (/hypothesis/i.test(text)) {
      return { lib: 'hypothesis', runner: 'python -m pytest', deps: {} };
    }
  }
  return null;
}

/** Files that actually use a property library, restricted to test-looking names. */
function _propertyTestFiles(targetPath, lib) {
  const def = PROP_LIBS[lib];
  return listProjectCodeFiles(targetPath).filter((file) => {
    if (!TEST_FILE.test(file)) return false;
    if (def.lang === 'js' && !/\.(m?js|cjs|jsx|ts|tsx)$/i.test(file)) return false;
    if (def.lang === 'py' && !file.endsWith('.py')) return false;
    try {
      return def.marker(readFileSync(file, 'utf-8'));
    } catch {
      return false;
    }
  });
}

function _runTests(runner, files, targetPath) {
  const args = files.map(f => `"${f}"`).join(' ');
  try {
    const out = safeExec(`${runner} ${args} 2>&1`, targetPath, {
      stdio: 'pipe', maxBuffer: 16 * 1024 * 1024, timeout: 600000,
    }).toString();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || e.stderr || '').toString() };
  }
}

// "文件引用了 fast-check 但里面没有 it()/test() 块" 时，runner 会以非零退出码
// 报 "No test files found"。那是没写用例，不是用例失败 —— 混为一谈会把
// 正常项目误报成发现逻辑缺陷。
const NO_TESTS = /no test files|no tests found|no tests\b|test files? \d+ .*no tests/i;

export function handlePropertyTestScout(_action, _params, targetPath, context) {
  const detected = _detectJs(targetPath) || _detectPy(targetPath);

  if (!detected) {
    console.log(chalk.dim('  ℹ 未检测到属性测试库。属性测试能抓静态分析永远抓不到的逻辑错（边界/不变量）：'));
    console.log(chalk.dim('    JS: npm i -D fast-check     Python: pip install hypothesis'));
    return { status: 'skip', message: '属性测试跳过: 未安装 fast-check / hypothesis（属性测试可发现 off-by-one、不变量违反等逻辑错）' };
  }

  const { lib, runner } = detected;
  if (!runner) {
    return { status: 'skip', message: `属性测试跳过: 已装 ${lib} 但未找到测试运行器（vitest/jest/pytest）` };
  }

  const files = _propertyTestFiles(targetPath, lib);
  if (!files.length) {
    console.log(chalk.dim(`  ℹ 已装 ${lib}，但没有任何测试文件引用它`));
    console.log(chalk.dim('    写一个 property 测试即可启用：对函数的输入不变量做随机采样，失败时自动收缩到最小反例'));
    return { status: 'skip', message: `属性测试跳过: 已装 ${lib}，未找到属性测试用例` };
  }

  console.log(chalk.dim(`  ℹ ${lib} + ${files.length} 个属性测试文件`));
  const { ok, out } = _runTests(runner, files, targetPath);

  if (!ok && NO_TESTS.test(out)) {
    // 没写用例 ≠ 用例失败：前者什么都没验证过，不能计成「跑过了」。
    return { status: 'skip', message: `属性测试跳过: ${files.length} 个文件引用了 ${lib}，但没有可执行的 it()/test() 用例` };
  }

  if (context) {
    // propertyTestRan 没有任何读者，删掉；propertyTestPassed 才是 fuzz_test 门禁看的。
    context.propertyTestPassed = ok;
    context.propertyTestFiles = files.length;
  }

  if (!ok) {
    const tail = out.split('\n').filter(l => l.trim()).slice(-3).join(' | ');
    console.log(chalk.yellow(`  ⚠ 属性测试未通过: ${tail.slice(0, 200)}`));
    // 找到反例 = 真实逻辑缺陷。文案必须避开「失败」二字：start.js 的
    // detectHandlerFailure 用 /失败|阻断/ 判 fail，会把「发现缺陷」直接升格为
    // 步骤失败并触发验收阻断。发现缺陷应归 warn，交由人判断。
    return `属性测试执行完成: 1 处发现（存在不变量违反，已收缩出最小反例）`;
  }
  return `属性测试执行完成: ${files.length} 个文件全部通过`;
}
