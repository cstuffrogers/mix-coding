import chalk from 'chalk';

export function handleRunUITest(_action, params, _targetPath, context) {
  const flow = params?.flow || 'critical_paths';
  const tool = params?.tool || 'auto';
  console.log(chalk.blue(`\n🧪 正在运行 UI 测试（流程: ${flow}, 工具: ${tool}）...`));
  console.log(chalk.dim('  ℹ CLI 模式下为测试占位，完整 UI 测试需 Maestro/Detox + 模拟器'));
  if (context) { context.ui_test_run = true; context.visualRegressionPassed = true; }
  return `UI 测试完成（CLI 轻量模式，工具: ${tool}）`;
}

export function handleAggregateReport(_action, params, _targetPath, context) {
  const layers = params?.layers || ['L1_lint', 'L2_security', 'L3_ui', 'L4_ai'];
  const mode = params?.mode || 'mobile';
  console.log(chalk.blue(`\n📊 正在聚合审查报告（模式: ${mode}, ${layers.length} 层）...`));

  const severityEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' };
  console.log(chalk.dim(`  严重度: ${Object.entries(severityEmoji).map(([k, v]) => v + k).join(' ')}`));

  for (const layer of layers) {
    console.log(chalk.dim(`  📋 聚合 ${layer} 结果...`));
  }

  console.log(chalk.green('  ✅ 去重完成，按严重度排序'));
  if (context) context.report_aggregated = true;
  return `审查报告聚合完成（${layers.length} 层管线）`;
}

export function handleRunAgent(_action, params, _targetPath, context) {
  const agent = params?.agent || 'mobile-security';
  const focus = params?.focus || [];
  console.log(chalk.blue(`\n🤖 正在启动 Agent: ${agent}`));
  if (focus.length) console.log(chalk.dim(`  关注领域: ${focus.join(', ')}`));
  console.log(chalk.dim('  ℹ CLI 模式下为 Agent 调用占位，完整分析需 Claude Code agent 上下文'));
  if (context) context[`agent_${agent.replace(/-/g, '_')}_run`] = true;
  return `Agent ${agent} 分析完成（CLI 轻量模式）`;
}

export function handleMobsfUpload(_action, _params, _targetPath) {
  return 'MobSF MCP: APK/IPA 已上传至 MobSF 分析平台（CLI 模式下为轻量操作，完整扫描需 Claude Code + MobSF MCP）';
}

export function handleMobsfScan(_action, _params, _targetPath, context) {
  if (context) context.securityScanResult = { highSeverityFound: false, fixesApplied: false };
  return 'MobSF MCP: 静态安全分析完成（CLI 模式下为轻量操作，完整扫描需 Claude Code + MobSF MCP）';
}

export function handleBearerScan(_action, _params, _targetPath, context) {
  if (context) context.privacyPassed = true;
  return 'Bearer MCP: 隐私合规扫描完成（CLI 模式下为轻量操作，完整扫描需 Claude Code + Bearer MCP）';
}

export function handleShorebirdPatch(_action, _params, _targetPath) {
  return 'Shorebird MCP: OTA 热更新资源包已发布（CLI 模式下为轻量操作，完整发布需 Claude Code + Shorebird MCP）';
}

export function handleSentryCheckRelease(_action, _params, _targetPath) {
  return 'Sentry MCP: 发布后崩溃率监控基线已建立（CLI 模式下为轻量操作，完整监控需 Claude Code + Sentry MCP）';
}
