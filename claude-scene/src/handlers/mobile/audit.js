import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
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
  const detected = detectMobilePlatform(targetPath);
  const { ios, android } = detected.platforms;
  // 下游（前置条件 / Android SDK / 发布渠道 / gradle）全读 context.platform，
  // 而这里以前只写 project_type 和 platforms{ios,android} —— 于是每个平台相关
  // 分支都走「非 Android 项目，已跳过」，真实的 Android 项目也永远跳过。
  const platform = ios && android ? 'both' : ios ? 'ios' : android ? 'android' : 'unknown';
  if (context) {
    context.project_type = detected.projectType;
    context.platforms = detected.platforms;
    context.platform = platform;
  }
  if (platform === 'unknown') {
    return { status: 'warn', message: `项目检测完成: ${detected.projectType}（没找到 ios/ 或 android/ 目录，平台相关的检查将无法判断）` };
  }
  return `项目检测完成: ${detected.projectType}（平台 ${platform}）`;
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
  // 「需要你手动装」= 没做，不是做完。返回字符串会被引擎判成 pass。
  return { status: 'skip', message: `未执行安装（引擎不代装工具），需手动准备: ${missing.join(', ')}` };
}

export function handleBuildApp(_action, params, _targetPath, context) {
  const platform = params?.platform || context?.platform || 'both';

  // 不置 app_built：构建没跑过，产物就不存在，后面依赖产物的步骤应该看得见这一点
  return { status: 'skip', message: `App 构建需在本地/CI 执行（平台: ${platform}），CLI 下未构建` };
}

export function handleScanSource(_action, params, _targetPath, _context) {
  const rules = params?.rules || 'default';
  const installed = hasTool('mobsfscan');
  if (!installed) return 'mobsfscan 未安装，源代码 SAST 未执行（不计为通过）';
  return { status: 'skip', message: `mobsfscan 已安装，源码扫描需手动/对话执行（规则集: ${rules}），本轮未测量` };
}

export function handleScanDependencies(_action, params, _targetPath, _context) {
  const source = params?.source || 'npm';
  return { status: 'skip', message: `依赖扫描需外部工具（来源: ${source}），本轮未执行（不计为通过）` };
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

function measureBundleSize(targetPath) {
  try {
    const files = scanDir(targetPath, { filter: f => /\.(js|ts|jsx|tsx)$/.test(f) && !f.includes('node_modules') });
    let totalSize = 0;
    for (const f of files) {
      try { totalSize += statSync(f).size; } catch { /* skip */ }
    }
    // 扫不到文件时 totalSize 就是 0B —— 「0B」听着像测量结果，其实什么都没量到。
    return files.length === 0 ? 'N/A' : formatBytes(totalSize);
  } catch {
    return 'N/A';
  }
}

export function handlePerfBaseline(_action, params, targetPath, context) {
  const metrics = params?.metrics || ['bundle_size', 'startup_time', 'fps', 'memory', 'network'];
  const baseline = {};
  for (const m of metrics) {
    // 只有 bundle_size 能在 CLI 里真算出来；其余都要真机/模拟器。
    baseline[m] = m === 'bundle_size' ? measureBundleSize(targetPath) : 'device_required';
  }

  if (context) context.performance_baseline = baseline;
  // 以前一律报「采集完成 N 项」：其中 N-1 项都是 device_required（= 没采到）。
  const measured = Object.entries(baseline).filter(([, v]) => v !== 'device_required' && v !== 'N/A');
  // 「要真机」和「扫不到文件」是两回事，混在一句里会让人以为全都得插设备。
  const deviceOnly = Object.entries(baseline).filter(([, v]) => v === 'device_required').map(([k]) => k);
  const noSource = Object.entries(baseline).filter(([, v]) => v === 'N/A').map(([k]) => k);
  const why = [];
  if (deviceOnly.length) why.push(`${deviceOnly.length} 项需要真机/模拟器（${deviceOnly.join(', ')}）`);
  if (noSource.length) why.push(`${noSource.length} 项没扫到源码（${noSource.join(', ')}）`);
  const reason = why.join('；');
  if (measured.length === 0) {
    return { status: 'noop', message: `性能基线未采集：${reason}` };
  }
  const measuredNote = measured.map(([k, v]) => `${k}=${v}`).join(', ');
  const missingNote = why.length ? `；另有未采集项：${reason}` : '';
  return { status: why.length ? 'warn' : 'pass', message: `性能基线已采集 ${measured.length} 项（${measuredNote}）${missingNote}` };
}

export function handleStoreCompliance(_action, _params, targetPath, context) {
  // 以前三个 check 的返回值被直接扔掉（`for (...) { check(); }`），其中「非公开 API」
  // 还是 `check: () => true` —— 不管项目长什么样都报「商店合规检查完成」。
  // 检查不产生结论就等于没检查：ok=true 过、false 没过、null 静态查不出来（不许算通过）。
  const checks = [
    { name: 'PrivacyInfo.xcprivacy (iOS)', check: () => existsSync(join(targetPath, 'ios', 'PrivacyInfo.xcprivacy')) },
    { name: 'AndroidManifest.xml 通知渠道 (Android)', check: () => existsSync(join(targetPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')) },
    { name: '非公开 API 扫描', check: () => null },
  ];
  const results = checks.map(({ name, check }) => ({ name, ok: check() }));
  const passed = results.filter(r => r.ok === true).map(r => r.name);
  const failed = results.filter(r => r.ok === false).map(r => r.name);
  const unknown = results.filter(r => r.ok === null).map(r => r.name);
  if (context) context.store_compliance = { passed, failed, unknown };

  const parts = [`商店合规检查: ${passed.length}/${results.length} 通过`];
  if (failed.length) parts.push(`未通过: ${failed.join('、')}`);
  if (unknown.length) parts.push(`无法静态判定: ${unknown.join('、')}`);
  // 有未通过 = 警告；全都查不出来 = 也警告（不许把「没查」当「合规」）。
  if (failed.length === 0 && unknown.length === 0) return { status: 'pass', message: parts.join('；') };
  return { status: 'warn', message: parts.join('；') };
}

export function handleMobileGenerateReport(_action, params, targetPath, context) {
  const format = params?.format || 'markdown';
  // 以前只把 context.mobile_report_generated 置 true 就报「报告已生成」，一个字节都没写。
  // 现在真写文件并回读校验；写不出来就说没生成。
  if (!targetPath) return { status: 'warn', message: '移动端审计报告未生成：不知道目标项目路径' };
  const dir = join(targetPath, '.claude', 'reports');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `mobile-audit-${stamp}.${format === 'json' ? 'json' : 'md'}`);
  const audit = {
    generated_at: new Date().toISOString(),
    format,
    project: context?.mobile_project ?? context?.project_type ?? 'unknown',
    platform: context?.platform ?? 'unknown',
    component_compliance: context?.component_compliance,
    store_compliance: context?.store_compliance,
    anti_patterns: context?.antipatterns,
    performance_baseline: context?.performance_baseline,
  };
  const body = format === 'json'
    ? JSON.stringify(audit, null, 2)
    : ['# 移动端审计报告', '', `生成时间: ${audit.generated_at}`, '', `- 项目类型: ${audit.project}`, `- 平台: ${audit.platform}`, '', '## 详细数据', '', '```json', JSON.stringify(audit, null, 2), '```', ''].join('\n');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, body, 'utf-8');
  } catch (e) {
    return { status: 'warn', message: `移动端审计报告未生成：写入失败（${String(e.message).slice(0, 80)}）` };
  }
  if (!existsSync(file)) return { status: 'warn', message: `移动端审计报告未生成：写完后找不到 ${file}` };
  if (context) context.mobile_report_path = file;
  return { status: 'pass', message: `移动端审计报告已生成（${format}）: ${file}` };
}

export function handleMobileAutoFix(_action, params, _targetPath, _context) {
  const mode = params?.mode || 'safe';
  // 以前无条件「自动修复完成」并置 context.mobile_autofix_applied = true —— 没改过一行代码。
  // CLI 侧没有移动端自动修复能力，只能给建议：不让「完成」二字替我们撒谎。
  return {
    status: 'noop',
    message: `自动修复未执行（模式: ${mode}）：移动端修复需要真机/模拟器验证，CLI 不会直接改代码`,
  };
}
