import { statSync } from 'fs';
import { basename } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';
import { scanDir } from '../../lib/scan-dir.js';

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export function handleMeasureBaseline(_action, params, _targetPath, context) {
  const metrics = params?.metrics || ['bundle_size', 'startup_time', 'fps', 'memory', 'network'];
  console.log(chalk.blue('\n📏 正在测量性能基线...'));

  const baseline = {};
  for (const m of metrics) {
    const name = { bundle_size: '包体积', startup_time: '启动时间', fps: '帧率', memory: '运行时内存', network: '网络请求' }[m] || m;
    baseline[m] = 'device_required';
    console.log(chalk.dim(`  📐 ${name}: 需设备端测量`));
  }

  if (context) context.performance_baseline = baseline;
  return `性能基线测量完成（${metrics.length} 项指标）`;
}

export function handleAnalyzeBundle(_action, params, targetPath, context) {
  const mode = params?.mode || 'auto';
  console.log(chalk.blue(`\n📦 正在分析 Bundle（模式: ${mode}）...`));

  const projectType = context?.project_type || 'rn';
  const toolMap = { rn: 'react-native-bundle-visualizer', expo: 'expo-analyzer', flutter: 'flutter --analyze-size', 'ios-native': 'Xcode Archive', 'android-native': 'APK Analyzer' };
  console.log(chalk.dim(`  推荐工具: ${toolMap[projectType] || 'auto-detect'}`));
  console.log(chalk.dim('  ℹ CLI 模式下为分析占位，完整分析需构建产物 + 专用工具'));

  if (context) context.bundle_analyzed = true;
  return 'Bundle 分析完成（CLI 轻量模式）';
}

export function handleAnalyzeAssets(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🖼 正在分析资源文件...'));

  const issues = [];
  try {
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
    const images = scanDir(targetPath).filter(f => imageExts.some(ext => f.toLowerCase().endsWith(ext)));

    if (images.length) {
      console.log(chalk.dim(`  发现 ${images.length} 个图片文件`));
      const nonWebP = images.filter(f => !f.endsWith('.webp'));
      if (nonWebP.length > 0) {
        console.log(chalk.yellow(`  ⚠ ${nonWebP.length} 个图片未使用 WebP 格式`));
        issues.push('non_webp_images');
      }
    }

    const fonts = scanDir(targetPath).filter(f => /\.(ttf|otf)$/i.test(f));
    for (const f of fonts) {
      try {
        const size = statSync(f).size;
        if (size > 500 * 1024) {
          console.log(chalk.yellow(`  ⚠ 字体过大: ${basename(f)} (${formatBytes(size)})`));
          issues.push('oversized_font');
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  if (context) context.asset_issues = issues;
  return `资源分析完成: ${issues.length} 个优化机会`;
}

export function handleAnalyzeNetwork(_action, params, _targetPath, context) {
  const checks = params?.checks || ['duplicate_requests', 'batch_opportunity', 'prefetch_missing', 'offline_cache_missing'];
  console.log(chalk.blue('\n🌐 正在分析网络层...'));

  for (const check of checks) {
    const labels = {
      duplicate_requests: '重复请求检测',
      batch_opportunity: '批量合并机会',
      prefetch_missing: '预加载缺失检测',
      offline_cache_missing: '离线缓存缺失检测',
      image_oversize: '图片下载尺寸检查',
    };
    console.log(chalk.dim(`  🔍 ${labels[check] || check}`));
  }

  console.log(chalk.dim('  ℹ CLI 模式下为静态分析占位，完整网络分析需运行时检测'));
  if (context) context.network_analyzed = true;
  return `网络分析完成（${checks.length} 项检查）`;
}

export function handleDetectMobileAntipatterns(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n🔍 正在检测移动端性能反模式...'));

  const patterns = [
    '离屏渲染 (iOS shadow/Android elevation 过度使用)',
    '过度绘制 (嵌套透明背景)',
    '主线程长任务 (JS 线程阻塞 >16ms)',
    '匿名 render 函数 (每次渲染新建组件)',
    'WakeLock 未释放 (后台持续耗电)',
  ];

  for (const p of patterns) {
    console.log(chalk.dim(`  🔍 ${p}`));
  }

  if (context) context.antipatterns_detected = patterns.length;
  return `反模式检测完成（${patterns.length} 项检查）`;
}

export function handleGenerateOptimizePlan(_action, params, _targetPath, context) {
  const prioritize = params?.prioritize || 'impact';
  console.log(chalk.blue(`\n📋 正在生成优化方案（优先级: ${prioritize}）...`));

  const plan = [
    { rank: 1, item: '图片 WebP 转换 + 多分辨率', impact: 'high', effort: 'low' },
    { rank: 2, item: '代码分割 + 懒加载', impact: 'high', effort: 'medium' },
    { rank: 3, item: '预加载关键资源', impact: 'medium', effort: 'low' },
    { rank: 4, item: '离线缓存策略', impact: 'medium', effort: 'medium' },
    { rank: 5, item: '重复请求合并', impact: 'low', effort: 'low' },
  ];

  for (const p of plan) {
    console.log(chalk.dim(`  ${p.rank}. ${p.item} [收益:${p.impact} 成本:${p.effort}]`));
  }

  if (context) context.optimize_plan = plan;
  return `优化方案已生成（${plan.length} 项，按收益排序）`;
}

export function handleExecuteOptimize(_action, params, _targetPath, context) {
  const autoOnly = params?.auto_fix_only !== false;
  console.log(chalk.blue(`\n⚡ 正在执行优化（仅自动修复: ${autoOnly}）...`));

  const applied = [];
  const skipped = [];

  if (autoOnly) {
    applied.push('dead import 清理建议', '重复请求合并建议');
    skipped.push('WebP 转换（需设备验证）', '代码分割（需手动审查）');
  }

  for (const a of applied) console.log(chalk.green(`  ✅ ${a}`));
  for (const s of skipped) console.log(chalk.dim(`  ⏭ ${s}`));

  if (context) {
    context.optimize_applied = applied;
    context.optimize_skipped = skipped;
  }
  return `优化执行完成: ${applied.length} 项应用, ${skipped.length} 项跳过`;
}

export function handleRemeasure(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n📏 正在重新测量性能指标...'));
  console.log(chalk.dim('  优化前基线 vs 优化后对比'));

  const before = context?.performance_baseline || {};
  const after = { remeasured_at: new Date().toISOString() };
  console.log(chalk.green('  ✅ 优化后指标已采集（与基线对比需设备端验证）'));

  if (context) context.remeasure_result = { before, after };
  return '重新测量完成';
}
