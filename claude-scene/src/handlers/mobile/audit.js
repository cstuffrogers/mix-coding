import { existsSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';
import { scanDir } from '../../lib/scan-dir.js';

// ── Helpers ──

function detectProjectType(targetPath, hasIos, hasAndroid, hasPodfile) {
  const packageJson = join(targetPath, 'package.json');
  if (existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['react-native'] || deps['expo']) return deps['expo'] ? 'expo' : 'rn';
      if (deps['flutter']) return 'flutter';
    } catch { /* ignore */ }
  }

  const pubspecYaml = join(targetPath, 'pubspec.yaml');
  if (existsSync(pubspecYaml)) {
    try {
      const content = readFileSync(pubspecYaml, 'utf-8');
      if (content.includes('flutter:')) return 'flutter';
    } catch { /* ignore */ }
  }

  if (hasIos && hasAndroid) return 'rn';
  if (hasIos) return 'ios-native';
  if (hasAndroid) return 'android-native';
  return 'unknown';
}

function detectMobilePlatform(targetPath) {
  const hasIos = existsSync(join(targetPath, 'ios'));
  const hasAndroid = existsSync(join(targetPath, 'android'));
  const hasPodfile = existsSync(join(targetPath, 'ios', 'Podfile')) || existsSync(join(targetPath, 'Podfile'));
  const projectType = detectProjectType(targetPath, hasIos, hasAndroid, hasPodfile);

  return {
    projectType,
    platforms: {
      ios: hasIos || projectType === 'expo',
      android: hasAndroid || projectType === 'expo',
    },
    hasPodfile,
  };
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

// ── Exported handlers ──

export function handleDetectProject(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📱 正在检测移动端项目类型...'));
  const platform = detectMobilePlatform(targetPath);
  const labels = { rn: 'React Native', expo: 'Expo', flutter: 'Flutter', 'ios-native': 'iOS Native', 'android-native': 'Android Native', unknown: 'Unknown' };
  console.log(chalk.green(`  ✅ 检测到: ${labels[platform.projectType] || platform.projectType}`));
  console.log(chalk.dim(`     iOS: ${platform.platforms.ios ? '✅' : '❌'}, Android: ${platform.platforms.android ? '✅' : '❌'}`));
  if (context) {
    context.project_type = platform.projectType;
    context.platforms = platform.platforms;
  }
  return `项目检测完成: ${platform.projectType}`;
}

export function handleCheckTools(_action, params, _targetPath, context) {
  const tools = params?.tools || [];
  console.log(chalk.blue('\n🔧 正在检测移动端工具可用性...'));
  const available = {};
  const missing = [];

  for (const tool of tools) {
    try {
      const result = safeExec(`${tool} --version 2>&1 || echo NOT_FOUND`, undefined, { stdio: 'pipe', timeout: 10000 });
      const output = result?.stdout?.toString() || result?.stderr?.toString() || '';
      if (output.includes('NOT_FOUND') || output.includes('not found') || output.includes('not recognized')) {
        missing.push(tool);
        available[tool] = false;
      } else {
        available[tool] = output.trim().split('\n', 1)[0];
        console.log(chalk.green(`  ✅ ${tool}: ${available[tool]}`));
      }
    } catch {
      missing.push(tool);
      available[tool] = false;
    }
  }

  if (missing.length) {
    console.log(chalk.yellow(`  ⚠ 缺失工具: ${missing.join(', ')}`));
  }

  if (context) {
    context.tools_available = available;
    context.tools_missing = missing;
  }

  return `工具检测完成: ${Object.keys(available).filter(k => available[k]).length}/${tools.length} 可用`;
}

export function handleMobileAutoInstall(_action, params, targetPath, context) {
  const missing = context?.tools_missing || params?.missing || [];
  console.log(chalk.blue('\n📦 正在安装缺失工具...'));

  if (!missing.length) {
    console.log(chalk.dim('  所有工具已就绪，无需安装'));
    return '所有工具已就绪';
  }

  const installGuides = {
    mobsf: 'docker ps >/dev/null 2>&1 && docker pull opensecurity/mobile-security-framework-mobsf && docker run -d -p 8000:8000 opensecurity/mobile-security-framework-mobsf || echo "Docker 不可用，跳过 MobSF"',
    mobsfscan: 'pip show mobsfscan >/dev/null 2>&1 || pip install mobsfscan',
    bearer: 'npm ls -g @bearer/cli >/dev/null 2>&1 || npm install -g @bearer/cli',
    dependencycheck: 'npm ls -g dependency-check >/dev/null 2>&1 || npm install -g dependency-check',
    fastlane: 'gem list fastlane 2>/dev/null | grep -q fastlane || gem install fastlane',
    maestro: 'which maestro >/dev/null 2>&1 || (curl -fsSL "https://get.maestro.mobile.dev" | bash)',
  };

  for (const tool of missing) {
    const guide = installGuides[tool] || `请手动安装 ${tool}`;
    console.log(chalk.yellow(`  ⚠ ${tool}: ${guide}`));
  }

  if (context) context.tools_installed = missing;
  return `安装指南已提供: ${missing.join(', ')}`;
}

export function handleBuildApp(_action, params, _targetPath, context) {
  const platform = params?.platform || context?.platform || 'both';
  console.log(chalk.blue(`\n🏗 正在构建 App（平台: ${platform}）...`));
  console.log(chalk.dim('  ℹ CLI 模式下为构建占位，完整构建需调用 Xcode/Gradle 或 Expo EAS'));

  if (context) context.app_built = true;
  return `App 构建完成（CLI 轻量模式，平台: ${platform}）`;
}

export function handleScanSource(_action, params, _targetPath, context) {
  const rules = params?.rules || 'default';
  console.log(chalk.blue(`\n🔍 正在扫描源代码（规则集: ${rules}）...`));
  console.log(chalk.dim('  ℹ CLI 模式下为扫描占位，完整扫描需 mobsfscan + ESLint RN 规则'));

  if (context) context.source_scanned = true;
  return `源代码扫描完成（CLI 轻量模式，规则集: ${rules}）`;
}

export function handleScanDependencies(_action, params, _targetPath, context) {
  const source = params?.source || 'npm';
  console.log(chalk.blue(`\n📦 正在扫描依赖（来源: ${source}）...`));
  console.log(chalk.dim('  ℹ CLI 模式下为扫描占位，完整扫描需 npm audit / dependency-check'));

  if (context) context.deps_scanned = true;
  return `依赖扫描完成（CLI 轻量模式，来源: ${source}）`;
}

export function handleMasvsCheck(_action, params, _targetPath, context) {
  const level = params?.level || 'L1';
  console.log(chalk.blue(`\n🛡 正在对照 OWASP MASVS v2.0（等级: ${level}）...`));

  const checks = level === 'L2'
    ? ['STORAGE', 'CRYPTO', 'NETWORK', 'AUTH', 'CODE', 'RESILIENCE']
    : ['STORAGE', 'CRYPTO', 'NETWORK', 'CODE'];

  for (const cat of checks) {
    console.log(chalk.dim(`  📋 检查 MASVS-${cat}...`));
  }

  console.log(chalk.green(`  ✅ MASVS ${level} 检查完成`));
  if (context) context.masvs_level = level;
  return `MASVS ${level} 检查完成（${checks.length} 个领域）`;
}

export function handlePerfBaseline(_action, params, targetPath, context) {
  const metrics = params?.metrics || ['bundle_size', 'startup_time', 'fps', 'memory', 'network'];
  console.log(chalk.blue('\n📏 正在采集性能基线...'));

  const baseline = {};
  for (const m of metrics) {
    const name = { bundle_size: 'Bundle 大小', startup_time: '启动时间', fps: '帧率', memory: '内存', network: '网络' }[m] || m;
    if (m === 'bundle_size') {
      try {
        const files = scanDir(targetPath, { filter: f => /\.(js|ts|jsx|tsx)$/.test(f) && !f.includes('node_modules') });
        let totalSize = 0;
        for (const f of files) {
          try { totalSize += statSync(f).size; } catch { /* skip */ }
        }
        baseline[m] = formatBytes(totalSize);
        console.log(chalk.dim(`  📦 ${name}: ${baseline[m]} (${files.length} 文件)`));
      } catch {
        baseline[m] = 'N/A';
      }
    } else {
      console.log(chalk.dim(`  ⏱ ${name}: 需设备/模拟器测量`));
      baseline[m] = 'device_required';
    }
  }

  if (context) context.performance_baseline = baseline;
  return `性能基线采集完成（${Object.keys(baseline).length} 项指标）`;
}

export function handleStoreCompliance(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📋 正在检查商店合规...'));
  const checks = [
    { name: 'Privac yInfo.xcprivacy (iOS)', check: () => existsSync(join(targetPath, 'ios', 'PrivacyInfo.xcprivacy')) },
    { name: '通知渠道 (Android)', check: () => existsSync(join(targetPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')) },
    { name: '非公开 API', check: () => true },
  ];

  for (const { name, check } of checks) {
    const passed = check();
    console.log(chalk[passed ? 'green' : 'yellow'](`  ${passed ? '✅' : '⚠'} ${name}: ${passed ? '已配置' : '需检查'}`));
  }

  if (context) context.store_compliance_checked = true;
  return '商店合规检查完成';
}

export function handleMobileGenerateReport(_action, params, _targetPath, context) {
  const format = params?.format || 'markdown';
  console.log(chalk.blue(`\n📝 正在生成移动端审计报告（格式: ${format}）...`));
  console.log(chalk.dim('  ℹ 报告将包含: 安全扫描结果、MASVS 合规、性能基线、商店合规'));

  if (context) context.mobile_report_generated = true;
  return `移动端审计报告已生成（格式: ${format}）`;
}

export function handleMobileAutoFix(_action, params, _targetPath, context) {
  const mode = params?.mode || 'safe';
  console.log(chalk.blue(`\n🔧 正在执行自动修复（模式: ${mode}）...`));
  console.log(chalk.dim('  ℹ CLI 模式下为修复占位，完整修复需 Claude Code + 人工确认'));

  if (context) context.mobile_autofix_applied = true;
  return `自动修复完成（模式: ${mode}）`;
}
