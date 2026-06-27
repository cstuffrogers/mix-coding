#!/usr/bin/env node
/**
 * audit-proxy.js — 单端 LLM 代理注入检测
 *
 * 不需要直连 API Key，只对中转站发请求即可检测 tool call 注入。
 *
 * 用法:
 *   # 方式 1: 环境变量
 *   export PROXY_URL="https://your-proxy.com/v1/messages"
 *   export PROXY_KEY="sk-xxx"
 *   export PROXY_MODEL="claude-sonnet-4-6"   # 可选
 *   node src/scripts/audit-proxy.js
 *
 *   # 方式 2: 命令行参数
 *   node src/scripts/audit-proxy.js --url https://proxy.com/v1/messages --key sk-xxx
 *
 *   # 方式 3: 指定模型和提供商
 *   node src/scripts/audit-proxy.js --url https://api.openai.com/v1/chat/completions --key sk-xxx --provider openai --model gpt-4o
 *
 *   # 指定测试提示词
 *   node src/scripts/audit-proxy.js --prompts simple_list,read_config
 */

import { auditSingleEndpoint } from '../lib/llm-single-audit.js';
import chalk from 'chalk';

// ── Parse CLI args ──

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) { opts.url = args[++i]; continue; }
    if (args[i] === '--key' && args[i + 1]) { opts.key = args[++i]; continue; }
    if (args[i] === '--model' && args[i + 1]) { opts.model = args[++i]; continue; }
    if (args[i] === '--provider' && args[i + 1]) { opts.provider = args[++i]; continue; }
    if (args[i] === '--prompts' && args[i + 1]) { opts.prompts = args[++i]; continue; }
    if (args[i] === '--help' || args[i] === '-h') { opts.help = true; }
  }
  return opts;
}

function printHelp() {
  console.log(`
${chalk.bold.cyan('audit-proxy.js — LLM 代理注入检测')}

${chalk.bold('用法:')}
  node src/scripts/audit-proxy.js --url <URL> --key <API_KEY> [选项]

${chalk.bold('选项:')}
  --url <URL>        中转站 API 端点 (必需)
  --key <API_KEY>    中转站 API Key (必需)
  --model <MODEL>    模型名称 (默认: claude-sonnet-4-6)
  --provider <PROV>  提供商 anthropic|openai (默认: anthropic)
  --prompts <IDS>    指定提示词, 逗号分隔 (simple_list,read_config,data_analysis)
  -h, --help         显示此帮助

${chalk.bold('环境变量:')}
  PROXY_URL, PROXY_KEY, PROXY_MODEL, PROXY_PROVIDER

${chalk.bold('检测原理:')}
  1. 混入 5 个蜜罐假工具到请求中
  2. 发送 3 种不同类型的测试提示词
  3. 检查返回结果:
     • 是否调用了蜜罐工具 → 确认注入
     • 是否返回了不在请求列表里的工具名 → 确认注入
     • 参数是否包含可疑 URL/外发/泄露模式 → 高度可疑
`);
}

// ── Main ──

const cli = parseArgs();

if (cli.help) {
  printHelp();
  process.exit(0);
}

const proxyUrl = cli.url || process.env.PROXY_URL;
const proxyKey = cli.key || process.env.PROXY_KEY;

if (!proxyUrl || !proxyKey) {
  console.error(chalk.red('\n  ❌ 缺少必需参数: --url 和 --key (或设置 PROXY_URL / PROXY_KEY 环境变量)\n'));
  console.error(chalk.gray('  使用 --help 查看完整用法\n'));
  process.exit(1);
}

const config = {
  proxyUrl,
  proxyKey,
  model: cli.model || process.env.PROXY_MODEL || 'claude-sonnet-4-6',
  provider: cli.provider || process.env.PROXY_PROVIDER || 'anthropic',
  promptIds: cli.prompts ? cli.prompts.split(',').map(s => s.trim()).filter(Boolean) : undefined,
};

console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════╗'));
console.log(chalk.bold.cyan('║    LLM 代理注入检测 — 单端审计模式       ║'));
console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝\n'));

console.log(chalk.gray(`  端点:    ${config.proxyUrl}`));
console.log(chalk.gray(`  模型:    ${config.model}`));
console.log(chalk.gray(`  提供商:  ${config.provider}`));
console.log(chalk.gray(`  提示词:  ${config.promptIds ? config.promptIds.join(', ') : '全部 3 个'}`));
console.log(chalk.gray(`  蜜罐:    5 个\n`));

console.log(chalk.cyan('  🔍 正在测试...\n'));

try {
  const report = await auditSingleEndpoint(config);

  // ── 逐项输出 ──
  for (const f of report.findings) {
    const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟡' : '⚪';
    const cat = chalk.dim(`[${f.category}]`);
    console.log(`  ${icon} ${cat} ${f.description.slice(0, 200)}`);
  }

  // ── 结论 ──
  console.log(chalk.bold(`\n  📊 结论: ${
    report.verdict === 'CLEAN'
      ? chalk.green(report.verdict)
      : report.verdict === 'SUSPICIOUS'
        ? chalk.yellow(report.verdict)
        : chalk.red(report.verdict)
  }`));
  console.log(chalk.white(`  ${report.summary}`));

  // 统计
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, INFO: 0 };
  for (const f of report.findings) counts[f.severity]++;
  if (report.findings.length > 0) {
    console.log(chalk.gray(`\n  详细: ${counts.CRITICAL} CRITICAL, ${counts.HIGH} HIGH, ${counts.MEDIUM} MEDIUM`));
  }

  console.log('');
  process.exit(report.injectionDetected ? 1 : 0);

} catch (err) {
  console.error(chalk.red(`\n  ❌ 审计失败: ${err.message}\n`));
  process.exit(2);
}
