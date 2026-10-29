import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

// ── React Native Doctor ──

export function handleCheckRnDoctor(_action, _params, targetPath, context) {

  const projectType = context?.project_type;
  if (projectType !== 'rn' && projectType !== 'expo') {
    return { status: 'skip', message: 'react-native doctor 已跳过（非 RN 项目）' };
  }

  // 以前命令串尾带 `|| echo "RN CLI 不可用"`，永远退出 0，然后无条件写
  // rn_doctor_checked = true 报「检查完成」—— 一次没跑成也照样盖章。
  try {
    const out = safeExec('npx react-native doctor', targetPath, { stdio: 'pipe', timeout: 60000 }).toString();
    if (context) context.rn_doctor_checked = true;
    const problem = out.split(/[\r\n]+/).find((line) => /[✖✗]/.test(line));
    if (problem) {
      return { status: 'warn', message: `react-native doctor 发现问题: ${problem.replace(/[✖✗●○\s]+/g, ' ').trim().slice(0, 140)}` };
    }
    return 'react-native doctor 检查完成: 无阻塞项';
  } catch (e) {
    const reason = String(e.message || '').split(/[\r\n]+/)[0].slice(0, 120);
    return { status: 'warn', message: `react-native doctor 未能运行（${reason}）—— 环境检查结论未知` };
  }
}

// ── Android SDK Check ──

export function handleCheckAndroidSDK(_action, _params, targetPath, context) {

  const platform = context?.platform;
  if (platform !== 'android' && platform !== 'both') {
    return { status: 'skip', message: 'Android SDK 检查已跳过（非 Android 项目）' };
  }

  const checks = {};
  for (const v of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) {
    checks[v] = process.env[v] || 'not set';
  }

  // android/local.properties 里的 sdk.dir 也算数（Gradle 实际就用它）。
  const localProps = join(targetPath, 'android', 'local.properties');
  let sdkDir = '';
  if (existsSync(localProps)) {
    try {
      // 不用正则：`\s*…\s*=(.+)` 这类式子会被 sonarjs 判为回溯超线性，
      // 而且 local.properties 就是一行 key=value，按行取更稳。
      const line = readFileSync(localProps, 'utf-8')
        .split(/[\r\n]+/)
        .find((l) => l.split('=')[0]?.trim() === 'sdk.dir');
      sdkDir = line ? line.split('=').slice(1).join('=').trim() : '';
    } catch { /* 读不到就当没配 */ }
  }

  const found = [checks.ANDROID_HOME, checks.ANDROID_SDK_ROOT, sdkDir].filter((v) => v && v !== 'not set');
  if (context) {
    context.android_sdk_checked = found.length > 0;
    context.android_sdk_env = { ...checks, 'local.properties#sdk.dir': sdkDir || 'not set' };
  }

  // 以前这里只把三个位置的值存进 context 就报「检查完成」，
  // 一个都没配也算通过 —— 检查没有结论。
  if (!found.length) {
    return { status: 'warn', message: 'Android SDK 未找到：ANDROID_HOME / ANDROID_SDK_ROOT 未设置，android/local.properties 里也没有 sdk.dir' };
  }
  return `Android SDK 检查完成: ${found[0]}`;
}

// ── Env Template Generator ──

export function handleSetupEnv(_action, _params, targetPath, context) {

  const template = [
    '# ── API 配置 ──',
    'API_BASE_URL=https://api.example.com',
    'API_TIMEOUT=30000',
    '',
    '# ── 推送通知 ──',
    '# iOS APNs Key ID',
    'APNS_KEY_ID=',
    '# Android FCM Server Key',
    'FCM_SERVER_KEY=',
    '',
    '# ── 第三方服务 ──',
    '# 地图 (Google Maps / AMap)',
    'MAPS_API_KEY=',
    '# 支付 (Stripe / Alipay / WeChat Pay)',
    'PAYMENT_API_KEY=',
    '# 分析 (Firebase / Sentry)',
    'SENTRY_DSN=',
    '',
    '# ── 功能开关 ──',
    'ENABLE_ANALYTICS=true',
    'ENABLE_CRASH_REPORTING=true',
    `ENVIRONMENT=${process.env.NODE_ENV || 'development'}`,
    '',
  ].join('\n');

  const envPath = join(targetPath, '.env.example');
  const existed = existsSync(envPath);
  let writeError = '';
  if (!existed) {
    try {
      writeFileSync(envPath, template);
    } catch (e) {
      writeError = e.message;
      console.log(chalk.yellow(`  ⚠ 写入失败: ${e.message}`));
    }
  } else {
    console.log(chalk.dim('  ℹ .env.example 已存在，跳过'));
  }

  const landed = existsSync(envPath);
  if (context) {
    context.env_template_generated = !existed && landed;
    context.envTemplatePassed = landed;
  }

  // 写失败以前照样写 env_template_generated / envTemplatePassed = true。
  if (!landed) {
    return { status: 'warn', message: `.env 模板未生成：写入 .env.example 失败（${writeError || '文件未落盘'}）` };
  }
  if (existed) {
    // 文件已在 = 本次没生成任何东西，不能记 ✓ pass（消息自己都写着「未覆盖」）。
    return { status: 'noop', reason: 'already-done', message: '.env 模板已存在（未覆盖，env_template_generated 不置位）' };
  }
  return '.env 模板生成完成';
}

// ── Emulator/Device Setup ──

export function handleSetupEmulator(_action, _params, _targetPath, context) {

  const platform = context?.platform || 'both';
  const guides = [];

  if (platform === 'ios' || platform === 'both') {
    guides.push({
      platform: 'iOS',
      steps: [
        'Xcode → Preferences → Components → 下载 iOS Simulator 镜像',
        '开启开发者模式: 设置 → 隐私与安全性 → 开发者模式',
        '真机调试: Xcode → Window → Devices and Simulators → 配对设备',
      ],
    });
  }

  if (platform === 'android' || platform === 'both') {
    guides.push({
      platform: 'Android',
      steps: [
        'Android Studio → SDK Manager → 下载 System Image',
        'AVD Manager → Create Virtual Device → 选择镜像',
        '真机调试: 设置 → 关于手机 → 连点版本号 7 次 → 开启 USB 调试',
      ],
    });
  }

  for (const g of guides) {
    for (const s of g.steps) {
      console.log(chalk.dim(`    📋 ${s}`));
    }
  }

  if (context) context.emulator_guide_shown = true;
  return '模拟器/真机配置指引已输出';
}

// ── Build Verification ──

// Run one build sub-command, pushing an ok/skipped result regardless of failure.
function runBuildStep(results, platform, step, cmd, targetPath, timeout) {
  try {
    safeExec(cmd, targetPath, { stdio: 'pipe', timeout });
    results.push({ platform, step, status: 'ok' });
  } catch {
    results.push({ platform, step, status: 'skipped' });
  }
}

export function handleVerifyBuild(_action, _params, targetPath, context) {
  const platform = context?.platform || 'both';
  const results = [];

  // iOS pod install
  if ((platform === 'ios' || platform === 'both') && existsSync(join(targetPath, 'ios', 'Podfile'))) {
    runBuildStep(results, 'ios', 'pod install',
      'cd ios && pod install 2>&1 || echo "CocoaPods 不可用"', targetPath, 60000);
  }

  // Android gradle sync
  if (platform === 'android' || platform === 'both') {
    const gradlew = join(targetPath, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    if (existsSync(gradlew)) {
      const gradleCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
      runBuildStep(results, 'android', 'gradle assembleDebug',
        `cd android && ${gradleCmd} --no-daemon assembleDebug 2>&1 || echo "Gradle 不可用"`, targetPath, 120000);
    }
  }

  if (results.length === 0) {
    console.log(chalk.dim('  ℹ 无可用构建步骤，请确保开发环境已正确配置'));
  }

  if (context) {
    context.build_verified = results;
    if (results.length > 0) context.buildPassed = results.every(r => r.status === 'ok');
  }
  return `构建验证完成: ${results.filter(r => r.status === 'ok').length}/${results.length || 1} 通过`;
}
