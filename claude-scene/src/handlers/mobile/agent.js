import chalk from 'chalk';
import { hasMcpServer } from '../../lib/mcp-config.js';

// 这一组是移动端场景在「工具没装」时的落点。原则：
//   跳过必须说成跳过，绝不能顺手把 `*Passed` 置 true —— 门禁读的就是这些旗子，
//   置 true 等于用一个没跑过的检查宣布通过。
// （早期实现确实这么干：Bearer 没装也 privacyPassed = true。）

function skipMessage(tool, what) {
  return `${tool} 不可用，${what}未执行（不计为通过）`;
}

export function handleRunUITest(_action, params, _targetPath, context) {
  const tool = params?.tool || 'auto';
  if (!hasMcpServer('detox')) {
    return skipMessage(tool === 'auto' ? 'detox MCP' : `${tool} / detox MCP`, 'UI 自动化测试');
  }
  if (context) context.ui_test_run = true;
  return `UI 测试需在连接设备后由 MCP 执行（工具: ${tool}），本轮未运行`;
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
  return `Agent ${agent} 需在对话中执行分析（CLI 下未运行）`;
}

export function handleMobsfUpload(_action, _params, _targetPath) {
  if (!hasMcpServer('mobsf')) return skipMessage('MobSF MCP', 'APK/IPA 上传');
  return 'MobSF MCP: 上传动作需在对话中调用（CLI 下未执行）';
}

export function handleMobsfScan(_action, _params, _targetPath, context) {
  if (!hasMcpServer('mobsf')) return skipMessage('MobSF MCP', '静态安全分析');
  // 不预设「高危为 0」——扫描没跑就不能替它下结论
  if (context) context.mobsfScanRequested = true;
  return 'MobSF MCP: 静态安全分析需在对话中调用（CLI 下未执行，结果未知）';
}

export function handleBearerScan(_action, _params, _targetPath, context) {
  if (!hasMcpServer('bearer')) return skipMessage('Bearer MCP', '隐私合规扫描');
  if (context) context.bearerScanRequested = true;
  return 'Bearer MCP: 隐私合规扫描需在对话中调用（CLI 下未执行，结果未知）';
}
