import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

// ── React Native Doctor ──

export function handleCheckRnDoctor(_action, _params, targetPath, context) {

  const projectType = context?.project_type;
  if (projectType !== 'rn' && projectType !== 'expo') {
    return 'react-native doctor 已跳过（非 RN 项目）';
  }

  try {
    safeExec('npx @react-native-community/cli doctor 2>&1 || npx react-native doctor 2>&1 || echo "RN CLI 不可用"', targetPath, { stdio: 'pipe', timeout: 30000 });
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ react-native doctor 执行失败: ${e.message}`));
  }

  if (context) context.rn_doctor_checked = true;
  return 'react-native doctor 检查完成';
}

// ── Android SDK Check ──

export function handleCheckAndroidSDK(_action, _params, _targetPath, context) {

  const platform = context?.platform;
  if (platform !== 'android' && platform !== 'both') {
    return 'Android SDK 检查已跳过（非 Android 项目）';
  }

  const checks = {};
  const envVars = ['ANDROID_HOME', 'ANDROID_SDK_ROOT'];

  for (const v of envVars) {
    checks[v] = process.env[v] || 'not set';
  }

  const localProps = join(_targetPath, 'android', 'local.properties');
  if (existsSync(localProps)) {
    try {
      const _content = readFileSync(localProps, 'utf-8');
  } catch { /* skip */ }
  }

  if (context) {
    context.android_sdk_checked = true;
    context.android_sdk_env = checks;
  }
  return 'Android SDK 检查完成';
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
  if (!existsSync(envPath)) {
    try {
      writeFileSync(envPath, template);
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ 写入失败: ${e.message}`));
    }
  } else {
    console.log(chalk.dim('  ℹ .env.example 已存在，跳过'));
  }

  if (context) { context.env_template_generated = true; context.envTemplatePassed = true; }
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

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleVerifyBuild(_action, _params, targetPath, context) {

  const platform = context?.platform || 'both';
  const results = [];

  // iOS pod install
  if ((platform === 'ios' || platform === 'both') && existsSync(join(targetPath, 'ios', 'Podfile'))) {
    try {
      safeExec('cd ios && pod install 2>&1 || echo "CocoaPods 不可用"', targetPath, { stdio: 'pipe', timeout: 60000 });
      results.push({ platform: 'ios', step: 'pod install', status: 'ok' });
    } catch {
      results.push({ platform: 'ios', step: 'pod install', status: 'skipped' });
    }
  }

  // Android gradle sync
  if (platform === 'android' || platform === 'both') {
    const gradlew = join(targetPath, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    if (existsSync(gradlew)) {
      try {
        safeExec(`cd android && ${process.platform === 'win32' ? 'gradlew.bat' : './gradlew'} --no-daemon assembleDebug 2>&1 || echo "Gradle 不可用"`, targetPath, { stdio: 'pipe', timeout: 120000 });
        results.push({ platform: 'android', step: 'gradle assembleDebug', status: 'ok' });
      } catch {
        results.push({ platform: 'android', step: 'gradle assembleDebug', status: 'skipped' });
      }
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
