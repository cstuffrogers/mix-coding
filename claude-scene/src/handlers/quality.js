import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleBuild(_action, params, targetPath) {
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    return { status: 'skip', message: '构建跳过：目标项目没有 package.json' };
  }
  // optimize: true（release#8 / rollback#7）—— 优化构建单独一个 script。以前没人读：
  // 「优化构建」和「普通构建」跑的是同一条命令。
  const script = params?.optimize === true ? 'build:optimize' : 'build';
  try {
    safeExec(`npm run ${script} 2>&1`, targetPath, { stdio: 'inherit' });
  } catch (e) {
    // 以前只打一行黄字，然后返回「构建完成」—— 构建挂了也记 ✓ pass。
    return { status: 'fail', message: `构建失败：npm run ${script} 退出码非 0（${e.message?.slice(0, 120) || '见输出'}）` };
  }
  return `构建完成${params?.optimize === true ? '（优化档 build:optimize）' : ''}`;
}

export function handleApplyTemplate(_action, params, targetPath) {
  const template = params?.template || 'component';
  const templatesDir = join(targetPath, '.claude', 'harness-templates');
  if (existsSync(templatesDir)) {
    readdirSync(templatesDir).filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.tsx'));
  } else {
    console.log(chalk.dim('  无模板目录，模板应用需 Claude Code 对话上下文'));
  }
  return { status: 'noop', message: `模板 ${template} 未应用（CLI 不执行，需在对话模式由 agent 完成）` };
}

export function handleImplementLogic(_action, _params, _targetPath, _context) {
  // 消息说「未实现」，旗标就不能叫 logic_implemented —— 下游条件会照它做决定。
  return { status: 'noop', message: '核心逻辑未实现（CLI 不执行，需在对话模式由 agent 完成）' };
}

function cleanNodeModules(targetPath, cleaned) {
  const nmPath = join(targetPath, 'node_modules');
  if (!existsSync(nmPath)) return;
  rmSync(nmPath, { recursive: true, force: true });
  cleaned.push('node_modules');
}

function cleanBuildDirs(targetPath, cleaned) {
  for (const dir of ['dist', 'build', '.next', '.turbo', '.cache']) {
    const dirPath = join(targetPath, dir);
    if (!existsSync(dirPath)) continue;
    rmSync(dirPath, { recursive: true, force: true });
    cleaned.push(dir);
  }
}

export function handleCleanup(_action, params, targetPath, context) {
  const tasks = params?.cleanup || ['temp_files', 'build_cache'];

  const cleaned = [];
  for (const task of tasks) {
    try {
      const isNodeModules = task === 'node_modules';
      if (isNodeModules) cleanNodeModules(targetPath, cleaned);
      const isDist = task === 'dist';
      if (isDist) cleanBuildDirs(targetPath, cleaned);
    } catch (e) {
      console.log(chalk.dim(`  ⚠ ${task} 清理失败: ${e.message?.slice(0, 80)}`));
    }
  }

  if (cleaned.length) {
    console.log(chalk.green(`  ✅ 已清理: ${cleaned.join(', ')}`));
  } else {
    console.log(chalk.dim('  ℹ 无需清理'));
  }
  if (context) context.cleanup_done = true;
  return `清理完成: ${cleaned.length ? cleaned.join(', ') : '无需清理'}`;
}

export function handleAutoFix(_action, params, targetPath, context) {
  const include = params?.include || ['lint', 'security'];
  const fixed = [];
  if (include.includes('lint') || include.includes('complexity')) {
    const label = tryEslintFix(targetPath, params?.maxAttempts);
    if (label) fixed.push(label);
  }
  if (include.includes('security')) {
    try {
      safeExec('npm audit fix 2>&1 || true', targetPath, { stdio: 'pipe' });
      fixed.push('npm-audit');
    } catch { /* npm audit not available */ }
  }
  if (fixed.length && context) context.fixApplied = true;
  return fixed.length ? `自动修复完成: ${fixed.join(', ')}` : '无需修复';
}

/** setup 场景声明了 maxAttempts: 3。以前没人读，`--fix` 只跑一轮。 */
function tryEslintFix(targetPath, rawAttempts) {
  if (!existsSync(join(targetPath, 'eslint.config.js'))) return null;
  const maxAttempts = Math.max(1, Number.parseInt(rawAttempts, 10) || 1);
  let clean = false;
  for (let attempt = 0; attempt < maxAttempts && !clean; attempt += 1) {
    try {
      // 不带 `|| true`：退出码 0 才代表「没有剩下的可修问题了」，可以停
      safeExec('npx eslint . --fix --quiet', targetPath, { stdio: 'pipe' });
      clean = true;
    } catch { /* 还有剩余问题：下一轮再试 */ }
  }
  const suffix = clean ? '' : `，${maxAttempts} 轮后仍有问题`;
  return maxAttempts > 1 ? `ESLint（最多 ${maxAttempts} 轮${suffix}）` : `ESLint${suffix}`;
}

export function handleGenerateRefactorPlan(_action, params, _targetPath, _context) {
  // 以前这里写 context.refactor_plan_generated = true —— 计划根本没生成，
  // 却给下游留了一个「已生成」的旗子（而且这个旗子全仓库没人读）。
  const testsNote = params?.include_tests === true ? '（要求包含测试改造）' : '';
  return { status: 'noop', message: `重构计划未生成（CLI 不执行，需在对话模式由 agent 完成）${testsNote}` };
}

export function handleApplyTransformations(_action, params, _targetPath, _context) {
  const transformations = params?.transformations || [];
  const guard = params?.preserve_behavior === true ? '（要求保持行为不变，后续回归测试必须全绿）' : '';
  return { status: 'noop', message: `重构变换未应用（CLI 不执行，需在对话模式由 agent 完成）: ${transformations.join(', ')}${guard}` };
}

export function handleAnalyzeInterface(_action, _params, _targetPath, _context) {
  // 同上：没分析过就别留「已分析」的旗子。
  return { status: 'noop', message: '接口设计未分析（CLI 不执行，需在对话模式由 agent 完成）' };
}

// 从清单文件推到语言。场景用 detect 指明「还要看哪些文件」，这里只负责「那是什么语言」
// —— 词典不全就写「未知（文件名）」，不猜成 JS。
const LANG_BY_MANIFEST = {
  'pubspec.yaml': 'Dart/Flutter',
  'build.gradle': 'Kotlin/Android',
  'CMakeLists.txt': 'C/C++',
  'go.mod': 'Go',
  'Cargo.toml': 'Rust',
};

/**
 * 纯函数：把清单列表里「磁盘上真存在」的语言按顺序收齐。
 * 带 `*` 的清单（*.csproj）按后缀扫一遍根目录。
 */
function detectPresentManifests(indicators, targetPath) {
  const detected = [];
  let rootEntries;
  for (const { lang, file } of indicators) {
    if (file.includes('*')) {
      if (rootEntries === undefined) {
        try {
          rootEntries = readdirSync(targetPath);
        } catch {
          rootEntries = [];
        }
      }
      if (rootEntries.some((e) => e.endsWith(file.replace('*', '')))) detected.push(lang);
    } else if (existsSync(join(targetPath, file)) && !detected.includes(lang)) {
      detected.push(lang);
    }
  }
  return detected;
}

export function handleDetectLanguage(_action, params, targetPath, context) {
  // detect: ["pubspec.yaml", …] —— 场景补的清单文件。feature/bugfix/refactor/onboard
  // 都声明了它（含 Go / Rust / Flutter / Gradle / CMake），以前没人读：一个 Flutter
  // 项目最终落到兜底的「JavaScript/TypeScript」，后续跑 npm run build。
  const indicators = [
    { lang: 'JavaScript/TypeScript', file: 'package.json' },
    { lang: 'Python', file: 'requirements.txt' },
    { lang: 'Python', file: 'pyproject.toml' },
    { lang: 'Go', file: 'go.mod' },
    { lang: 'Rust', file: 'Cargo.toml' },
    { lang: 'Java', file: 'pom.xml' },
    { lang: 'Java', file: 'build.gradle' },
    { lang: 'Ruby', file: 'Gemfile' },
    { lang: 'PHP', file: 'composer.json' },
    { lang: 'C#', file: '*.csproj' },
  ];
  const extra = Array.isArray(params?.detect) ? params.detect.filter((f) => typeof f === 'string' && f) : [];
  for (const file of extra) {
    if (indicators.some((i) => i.file === file)) continue;
    indicators.push({ lang: LANG_BY_MANIFEST[file] || `未知（${file}）`, file });
  }
  const detected = detectPresentManifests(indicators, targetPath);
  if (detected.length) {
    console.log(chalk.green(`  ✅ 检测到: ${detected.join(', ')}`));
  } else {
    // 一个清单文件都没有 → 以前直接兜底成「JavaScript/TypeScript」，
    // 于是后面拿 npm 去跑一个空白目录。没检测到就是没检测到。
    if (context) {
      context.detectedLanguage = undefined;
      context.non_js_project_detected = false;
    }
    return { status: 'warn', message: '语言检测未完成：没找到任何已知的清单文件（package.json / go.mod / Cargo.toml …）' };
  }
  if (context) {
    context.detectedLanguage = detected[0];
    context.non_js_project_detected = detected[0] !== 'JavaScript/TypeScript';
  }
  return `语言检测完成: ${detected[0]}`;
}

export function handleLanguageBuild(_action, _params, targetPath, context) {
  const lang = context?.detectedLanguage || 'JavaScript/TypeScript';
  const buildCommands = {
    'JavaScript/TypeScript': 'npm run build 2>&1',
    'Python': 'python -m build 2>&1',
    'Go': 'go build ./... 2>&1',
    'Rust': 'cargo build 2>&1',
    'Java': 'mvn compile 2>&1',
    'Ruby': 'bundle install 2>&1',
    'PHP': 'composer install 2>&1',
    'Dart/Flutter': 'flutter build 2>&1',
    'Kotlin/Android': './gradlew assembleDebug 2>&1',
  };
  const cmd = buildCommands[lang];
  if (!cmd) {
    // 以前一律兜底 `npm run build`：一个 CMake 项目也会去跑 npm。没实现就是没实现。
    return { status: 'skip', message: `构建跳过：引擎没有为 ${lang} 定义构建命令` };
  }
  try {
    safeExec(cmd, targetPath, { stdio: 'inherit' });
  } catch (e) {
    // 以前只打一行黄字，然后仍然返回「构建完成」—— 构建失败也记 ✓ pass。
    return { status: 'fail', message: `构建失败 (${lang})：${cmd.replace(' 2>&1', '')} 退出码非 0（${e.message?.slice(0, 100) || '见输出'}）` };
  }
  return `构建完成 (${lang})`;
}

export function handleLanguageTest(_action, _params, targetPath, context) {
  const lang = context?.detectedLanguage || 'JavaScript/TypeScript';
  const testCommands = {
    'JavaScript/TypeScript': 'npm test 2>&1',
    'Python': 'python -m pytest 2>&1',
    'Go': 'go test ./... 2>&1',
    'Rust': 'cargo test 2>&1',
    'Java': 'mvn test 2>&1',
    'Ruby': 'bundle exec rspec 2>&1',
    'PHP': 'php vendor/bin/phpunit 2>&1',
    'Dart/Flutter': 'flutter test 2>&1',
    'Kotlin/Android': './gradlew test 2>&1',
  };
  const cmd = testCommands[lang];
  if (!cmd) {
    return { status: 'skip', message: `测试跳过：引擎没有为 ${lang} 定义测试命令` };
  }
  try {
    safeExec(cmd, targetPath, { stdio: 'inherit' });
  } catch (e) {
    // 同上：以前失败也返回「测试完成」。
    return { status: 'fail', message: `测试失败 (${lang})：${cmd.replace(' 2>&1', '')} 退出码非 0（${e.message?.slice(0, 100) || '见输出'}）` };
  }
  return `测试完成 (${lang})`;
}
