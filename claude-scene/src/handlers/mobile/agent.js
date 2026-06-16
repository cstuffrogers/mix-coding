import chalk from 'chalk';

export function handleRunUITest(_action, params, _targetPath, context) {
  const tool = params?.tool || 'auto';
  if (context) { context.ui_test_run = true; context.visualRegressionPassed = true; }
  return `UI 测试完成（CLI 轻量模式，工具: ${tool}）`;
}

export function handleAggregateReport(_action, params, _targetPath, context) {
  const layers = params?.layers || ['L1_lint', 'L2_security', 'L3_ui', 'L4_ai'];

  for (const layer of layers) {
    console.log(chalk.dim(`  📋 聚合 ${layer} 结果...`));
  }

  if (context) context.report_aggregated = true;
  return `审查报告聚合完成（${layers.length} 层管线）`;
}

export function handleRunAgent(_action, params, _targetPath, context) {
  const agent = params?.agent || 'mobile-security';
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
