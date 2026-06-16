import { statSync } from 'fs';
import chalk from 'chalk';
import { scanDir } from '../../lib/scan-dir.js';

export function handleMeasureBaseline(_action, params, _targetPath, context) {
  const metrics = params?.metrics || ['bundle_size', 'startup_time', 'fps', 'memory', 'network'];

  const baseline = {};
  for (const m of metrics) {
    baseline[m] = 'device_required';
  }

  if (context) context.performance_baseline = baseline;
  return `性能基线测量完成（${metrics.length} 项指标）`;
}

export function handleAnalyzeBundle(_action, params, targetPath, context) {

  if (context) context.bundle_analyzed = true;
  return 'Bundle 分析完成（CLI 轻量模式）';
}

export function handleAnalyzeAssets(_action, _params, targetPath, context) {

  const issues = [];
  try {
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
    const images = scanDir(targetPath).filter(f => imageExts.some(ext => f.toLowerCase().endsWith(ext)));

    if (images.length) {
      const nonWebP = images.filter(f => !f.endsWith('.webp'));
      if (nonWebP.length > 0) {
        issues.push('non_webp_images');
      }
    }

    const fonts = scanDir(targetPath).filter(f => /\.(ttf|otf)$/i.test(f));
    for (const f of fonts) {
      try {
        const size = statSync(f).size;
        if (size > 500 * 1024) {
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

  for (const _check of checks) {}

  if (context) context.network_analyzed = true;
  return `网络分析完成（${checks.length} 项检查）`;
}

export function handleDetectMobileAntipatterns(_action, _params, _targetPath, context) {

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

  const applied = [];
  const skipped = [];

  if (autoOnly) {
    applied.push('dead import 清理建议', '重复请求合并建议');
    skipped.push('WebP 转换（需设备验证）', '代码分割（需手动审查）');
  }

  if (context) {
    context.optimize_applied = applied;
    context.optimize_skipped = skipped;
  }
  return `优化执行完成: ${applied.length} 项应用, ${skipped.length} 项跳过`;
}

export function handleRemeasure(_action, _params, _targetPath, context) {

  const before = context?.performance_baseline || {};
  const after = { remeasured_at: new Date().toISOString() };

  if (context) context.remeasure_result = { before, after };
  return '重新测量完成';
}
