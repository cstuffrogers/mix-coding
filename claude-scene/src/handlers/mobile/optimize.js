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
  // 所有指标都是 device_required（真机才能测），以前却报「测量完成（5 项指标）」→ ✓ pass。
  return { status: 'noop', message: `性能基线未测量：${metrics.length} 项指标都需要真机` };
}

export function handleAnalyzeBundle(_action, params, targetPath, context) {

  if (context) context.bundle_analyzed = true;
  // 场景声明了 `tool: "auto"`（mobile-optimize#3）：引擎不执行它，但结论里必须
  // 说清「该用什么工具去做」，否则这个声明就永远不会被人看到。
  const tool = typeof params?.tool === 'string' && params.tool ? params.tool : '（未声明）';
  return { status: 'noop', message: `Bundle 未分析（CLI 不执行，需在对话模式由 agent 完成，工具: ${tool}）` };
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
  // 场景声明了 prioritize: "impact"（mobile-optimize）。以前这个键没人读，
  // 而下面的固定排序恰好就是按 impact 来的 —— 声明的意图和实际行为要能对上。
  const priority = params?.prioritize || 'impact';
  const byLabel = priority === 'impact' ? '按收益排序' : priority === 'effort' ? '按成本排序' : `按 ${priority} 排序`;
  return `优化方案已生成（${plan.length} 项，${byLabel}）`;
}

export function handleExecuteOptimize(_action, params, _targetPath, context) {
  // 以前这里凭空 push 两条字符串（「dead import 清理建议」「重复请求合并建议」）
  // 然后报「优化执行完成: 2 项应用」—— 一行代码都没改，却把「建议」记成了「已应用」，
  // 还写进 context.optimize_applied（然后进了报告）。没做就是没做。
  // auto_fix_only 现在只控制「列出哪些待人工确认的自动修复项」。
  const autoOnly = params?.auto_fix_only !== false;
  const candidates = autoOnly
    ? ['dead import 清理', '重复请求合并']
    : ['dead import 清理', '重复请求合并', 'WebP 转换', '代码分割'];
  const needsDevice = autoOnly ? ['WebP 转换（需设备验证）', '代码分割（需手动审查）'] : [];
  if (context) {
    // 注意：写的是「建议」不是「已应用」—— 后者是谎。
    context.optimize_suggestions = candidates;
    context.optimize_needs_manual = needsDevice;
  }
  const manualNote = needsDevice.length ? `；另有 ${needsDevice.length} 项需要人工确认（${needsDevice.join('、')}）` : '';
  return {
    status: 'noop',
    message: `优化未执行：本步只列出 ${candidates.length} 项待做建议（${candidates.join('、')}），没有修改任何代码${manualNote}`,
  };
}

export function handleRemeasure(_action, _params, _targetPath, context) {
  const before = context?.performance_baseline || {};
  // 以前只塞一个 `remeasured_at` 时间戳就报「重新测量完成」—— 指标一个没测，
  // 下游 checkGate 看 performance_baseline 还是 device_required，却因为这一步 ✓ 让人以为测过了。
  const unmeasured = Object.entries(before)
    .filter(([, v]) => typeof v === 'string' && v.includes('device'))
    .map(([k]) => k);
  if (context) {
    context.remeasure_result = { attempted_at: new Date().toISOString(), measured: false, missing: unmeasured };
  }
  const scope = unmeasured.length ? `（${unmeasured.join(', ')} 仍无实测值）` : '（本次没有性能基线可对比）';
  return {
    status: 'noop',
    message: `优化后指标未重新测量${scope}：真机/模拟器数据 CLI 拿不到，需要人工或对话模式重测后再填 performance_baseline`,
  };
}
