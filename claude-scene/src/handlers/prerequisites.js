import { existsSync } from 'fs';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

function createCheckers(targetPath) {
  return {
    node: () => {
      const ver = safeExec('node --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    npm: () => {
      const ver = safeExec('npm --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    git: () => {
      const ver = safeExec('git --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    jdk: () => {
      const ver = safeExec('java -version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver.split('\n', 1)[0] };
    },
    xcode: () => {
      safeExec('xcodebuild -version 2>&1', targetPath, { stdio: 'pipe' });
      return { ok: true, detail: '已安装' };
    },
    android_studio: () => {
      const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (androidHome && existsSync(androidHome)) {
        return { ok: true, detail: androidHome };
      }
      safeExec('sdkmanager --version 2>&1', targetPath, { stdio: 'pipe' });
      return { ok: true, detail: 'sdkmanager 可用' };
    },
    ruby: () => {
      const ver = safeExec('ruby --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    cocoapods: () => {
      const ver = safeExec('pod --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
  };
}

const IOS_ONLY = new Set(['xcode', 'cocoapods']);

// Gate platform-specific checks: skip a check name when the active platform can't use it.
function isCheckApplicable(name, isIos, isAndroid) {
  if (IOS_ONLY.has(name) && !isIos) return false;
  if (name === 'android_studio' && !isAndroid) return false;
  if (name === 'ruby' && !isIos) return false;
  return true;
}

function runOneCheck(name, checkers) {
  if (!checkers[name]) return { ok: false, detail: '未知检查项' };
  try {
    const r = checkers[name]();
    return { ok: r.ok, detail: r.detail };
  } catch {
    return { ok: false, detail: '未安装' };
  }
}

function runChecks(names, platform, checkers) {
  const isIos = platform === 'ios' || platform === 'both';
  const isAndroid = platform === 'android' || platform === 'both';
  const results = {};
  const skipped = [];
  for (const name of names) {
    // 平台不明时不能悄悄跳过：mobile-onboard 要查 6 项，平台为空就只剩 2 项，
    // 却打印「✅ 所有前置条件满足」并把闸门标记为通过。
    if (!isCheckApplicable(name, isIos, isAndroid)) { skipped.push(name); continue; }
    results[name] = runOneCheck(name, checkers);
  }
  return { results, skipped };
}

/** 把检查结果翻译成结论文案；平台不明导致跳过时只能是 warn。 */
function summarizeChecks({ results, skipped }, requiredSet, platform) {
  const passed = Object.entries(results).filter(([, v]) => v.ok);
  const missingRequired = Object.keys(results).filter((k) => !results[k].ok && requiredSet.has(k));
  const missingOptional = Object.keys(results).filter((k) => !results[k].ok && !requiredSet.has(k));
  const head = missingRequired.length === 0
    ? `✅ 必需前置条件满足（${passed.length} 项可用）`
    : `⚠ ${missingRequired.length} 项必需缺失: ${missingRequired.join(', ')}`;

  console.log(chalk[missingRequired.length === 0 ? 'green' : 'yellow'](`  ${head}`));
  if (missingOptional.length) {
    console.log(chalk.yellow(`  ⚠ 可选未装: ${missingOptional.join(', ')}（不阻塞，但相关功能不可用）`));
  }

  const optTail = missingOptional.length ? `（可选缺失: ${missingOptional.join(', ')}）` : '';
  if (skipped.length === 0) {
    return {
      status: missingRequired.length === 0 ? 'pass' : 'fail',
      message: `${head}${optTail}`,
      missingRequired,
      passedCount: passed.length,
    };
  }

  const why = platform === 'unknown' ? '平台未识别（context.platform 为空）' : `当前平台 ${platform} 用不到`;
  if (platform === 'unknown') {
    return {
      status: 'warn',
      message: `前置条件检查不完整：${why}，${skipped.join(', ')} 无法判断`,
      missingRequired,
      passedCount: passed.length,
    };
  }
  const tail = missingOptional.length ? `；可选缺失: ${missingOptional.join(', ')}` : '';
  return {
    status: missingRequired.length === 0 ? 'pass' : 'fail',
    message: `${head}；跳过 ${skipped.join(', ')}（${why}）${tail}`,
    missingRequired,
    passedCount: passed.length,
  };
}

export function handleCheckPrerequisites(_action, params, targetPath, context) {
  // 场景里有的写 checks，有的写 required/optional（onboard 3 声明 docker/pnpm
  // 为可选）—— 只认 checks 的话，声明的 docker/pnpm 从来没被检查过。
  const required = params?.required ?? params?.checks ?? ['node', 'npm', 'git'];
  const optional = params?.optional ?? [];
  const requiredSet = new Set(required);
  const platform = context?.platform || 'unknown';

  const outcome = runChecks([...required, ...optional], platform, createCheckers(targetPath));
  const summary = summarizeChecks(outcome, requiredSet, platform);

  if (context) {
    // 有检查项因平台不明而跳过时，闸门不能算通过（没查 ≠ 通过）。
    context.envPrerequisitesPassed = summary.missingRequired.length === 0 && outcome.skipped.length === 0;
  }
  return { status: summary.status, message: summary.message };
}
