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

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleCheckPrerequisites(_action, params, targetPath, context) {
  const requestedChecks = params?.checks || ['node', 'npm', 'git'];
  console.log(chalk.blue('\n🔧 正在检查系统前置条件...'));

  const platform = context?.platform || 'unknown';
  const isIos = platform === 'ios' || platform === 'both';
  const isAndroid = platform === 'android' || platform === 'both';
  const checkers = createCheckers(targetPath);

  const results = {};
  for (const name of requestedChecks) {
    if (IOS_ONLY.has(name) && !isIos) {
      console.log(chalk.dim(`  ⏭ ${name}: 跳过（非 iOS 平台）`));
      continue;
    }
    if (name === 'android_studio' && !isAndroid) {
      console.log(chalk.dim(`  ⏭ ${name}: 跳过（非 Android 平台）`));
      continue;
    }
    if (name === 'ruby' && !isIos) {
      console.log(chalk.dim(`  ⏭ ${name}: 跳过（非 iOS 平台）`));
      continue;
    }
    if (checkers[name]) {
      try {
        const r = checkers[name]();
        results[name] = { ok: r.ok, detail: r.detail };
        console.log(chalk.dim(`  ✅ ${name}: ${r.detail}`));
      } catch {
        results[name] = { ok: false, detail: '未安装' };
        console.log(chalk.yellow(`  ⚠ ${name}: 未安装`));
      }
    } else {
      results[name] = { ok: false, detail: '未知检查项' };
      console.log(chalk.dim(`  ❓ ${name}: 未知检查项`));
    }
  }

  const passed = Object.entries(results).filter(([, v]) => v.ok);
  const missing = Object.entries(results).filter(([, v]) => !v.ok);
  console.log(chalk[missing.length === 0 ? 'green' : 'yellow'](
    `  ${missing.length === 0 ? '✅ 所有前置条件满足' : `⚠ ${missing.length} 项缺失: ${missing.map(([k]) => k).join(', ')}`}`,
  ));
  if (context) context.envPrerequisitesPassed = missing.length === 0;
  return `前置条件检查: ${passed.map(([k]) => k).join(', ') || '无'} 可用`;
}
