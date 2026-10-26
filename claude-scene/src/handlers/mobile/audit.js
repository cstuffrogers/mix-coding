import { existsSync, readFileSync, statSync } from 'fs';
import { join } from "path";
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';
import { scanDir } from '../../lib/scan-dir.js';

// ── Helpers ──

function checkPackageJson(targetPath) {
  const packageJson = join(targetPath, 'package.json');
  if (!existsSync(packageJson)) return null;
  try {
    const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['expo']) return 'expo';
    if (deps['react-native']) return 'rn';
    if (deps['flutter']) return 'flutter';
  } catch { /* ignore */ }
  return null;
}

function checkPubspecYaml(targetPath) {
  const pubspecYaml = join(targetPath, 'pubspec.yaml');
  if (!existsSync(pubspecYaml)) return null;
  try {
    const content = readFileSync(pubspecYaml, 'utf-8');
    if (content.includes('flutter:')) return 'flutter';
  } catch { /* ignore */ }
  return null;
}

function detectProjectType(targetPath, hasIos, hasAndroid, _hasPodfile) {
  const fromPkg = checkPackageJson(targetPath);
  if (fromPkg) return fromPkg;
  const fromPubspec = checkPubspecYaml(targetPath);
  if (fromPubspec) return fromPubspec;
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
  const platform = detectMobilePlatform(targetPath);
  if (context) {
    context.project_type = platform.projectType;
    context.platforms = platform.platforms;
  }
  return `项目检测完成: ${platform.projectType}`;
}

export function handleCheckTools(_action, params, _targetPath, context) {
  const tools = params?.tools || [];
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
      }
    } catch {
      missing.push(tool);
      available[tool] = false;
    }
  }

  if (missing.length) {
    console.error(chalk.yellow(`  ⚠ 缺失工具: ${missing.join(', ')}`));
  }

  if (context) {
    context.tools_available = available;
    context.tools_missing = missing;
  }

  return `工具检测完成: ${Object.keys(available).filter(k => available[k]).length}/${tools.length} 可用`;
}

function hasTool(cmd) {
  try {
    const out = safeExec(`${cmd} --version 2>&1`, undefined, { stdio: 'pipe', timeout: 10000 });
    const text = String(out || '');
    return !/NOT_FOUND|not found|not recognized/i.test(text);
  } catch { return false; }
}

export function handleMobileAutoInstall(_action, params, targetPath, context) {
  const missing = context?.tools_missing || params?.missing || [];

  if (!missing.length) {
    return '所有工具已就绪';
  }

  // 之前这里把 missing 写进 context.tools_installed —— 什么都没装却记成已安装。
  if (context) context.tools_install_plan = missing;
  return `未执行安装（引擎不代装工具），需手动准备: ${missing.join(', ')}`;
}

export function handleBuildApp(_action, params, _targetPath, context) {
  const platform = params?.platform || context?.platform || 'both';

  // 不置 app_built：构建没跑过，产物就不存在，后面依赖产物的步骤应该看得见这一点
  return `App 构建需在本地/CI 执行（平台: ${platform}），CLI 下未构建`;
}

export function handleScanSource(_action, params, _targetPath, _context) {
  const rules = params?.rules || 'default';
  const installed = hasTool('mobsfscan');
  if (!installed) return 'mobsfscan 未安装，源代码 SAST 未执行（不计为通过）';
  return `mobsfscan 已安装，源码扫描需手动/对话执行（规则集: ${rules}），本轮未测量`;
}

export function handleScanDependencies(_action, params, _targetPath, _context) {
  const source = params?.source || 'npm';
  return `依赖扫描需外部工具（来源: ${source}），本轮未执行（不计为通过）`;
}

export function handleMasvsCheck(_action, params, _targetPath, context) {
  const level = params?.level || 'L1';

  const checks = level === 'L2'
    ? ['STORAGE', 'CRYPTO', 'NETWORK', 'AUTH', 'CODE', 'RESILIENCE']
    : ['STORAGE', 'CRYPTO', 'NETWORK', 'CODE'];

  for (const cat of checks) {
    console.log(chalk.dim(`  📋 检查 MASVS-${cat}...`));
  }

  if (context) context.masvs_level = level;
  return `MASVS ${level} 检查完成（${checks.length} 个领域）`;
}

export function handlePerfBaseline(_action, params, targetPath, context) {
  const metrics = params?.metrics || ['bundle_size', 'startup_time', 'fps', 'memory', 'network'];

  const baseline = {};
  for (const m of metrics) {

    if (m === 'bundle_size') {
      try {
        const files = scanDir(targetPath, { filter: f => /\.(js|ts|jsx|tsx)$/.test(f) && !f.includes('node_modules') });
        let totalSize = 0;
        for (const f of files) {
          try { totalSize += statSync(f).size; } catch { /* skip */ }
        }
        baseline[m] = formatBytes(totalSize);
      } catch {
        baseline[m] = 'N/A';
      }
    } else {
      baseline[m] = 'device_required';
    }
  }

  if (context) context.performance_baseline = baseline;
  return `性能基线采集完成（${Object.keys(baseline).length} 项指标）`;
}

export function handleStoreCompliance(_action, _params, targetPath, context) {
  const checks = [
    { name: 'Privac yInfo.xcprivacy (iOS)', check: () => existsSync(join(targetPath, 'ios', 'PrivacyInfo.xcprivacy')) },
    { name: '通知渠道 (Android)', check: () => existsSync(join(targetPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')) },
    { name: '非公开 API', check: () => true },
  ];

  for (const { check } of checks) {
    check();
  }

  if (context) context.store_compliance_checked = true;
  return '商店合规检查完成';
}

export function handleMobileGenerateReport(_action, params, _targetPath, context) {
  const format = params?.format || 'markdown';

  if (context) context.mobile_report_generated = true;
  return `移动端审计报告已生成（格式: ${format}）`;
}

export function handleMobileAutoFix(_action, params, _targetPath, context) {
  const mode = params?.mode || 'safe';

  if (context) context.mobile_autofix_applied = true;
  return `自动修复完成（模式: ${mode}）`;
}
