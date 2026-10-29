import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

// 「什么算真的跑完了」——必须能从输出里看到 dependency-cruiser 自己的报告。
// 以前只靠 safeExec 是否抛错判断，而抛错既可能是「查出违规」（工具正常退出 1），
// 也可能是「npx 下载失败 / 没有 src」，两种情况都落到 violationCount = 0，
// 于是「检查没做」被报成「✅ 验证通过」。
const RAN_MARKERS = [/no\s+violations?/i, /✔/, /modules?/i];
// dependency-cruiser 的 `-T err` 每行以严重级别开头（`error no-orphans: src/a.js`），
// 所以必须行首锚定。以前用 /error|violation/i 泛匹配，于是
// 「✔ no violations found」里的 violations 被数成 1 个违规（假红）。
const VIOLATION_LINE = /^[ \t]*(?:error|warn)\b/i;

function looksLikeReport(output) {
  return RAN_MARKERS.some((re) => re.test(output));
}

function runDepcruise(configPath, hasConfig, targetPath) {
  const args = hasConfig ? `-c "${configPath}" src -T err` : 'src -T err --no-config';
  try {
    safeExec(`npx dependency-cruiser ${args} 2>&1`, targetPath, {
      stdio: 'pipe',
      timeout: 120000,
    });
    // 退出码 0 = 真的跑完了且没有违规
    return { ran: true, violationCount: 0, output: '' };
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    const lines = output.split('\n').filter((line) => VIOLATION_LINE.test(line));
    const violationCount = lines.length;
    // 有违规行本身就是结论；否则要看输出里有没有 dependency-cruiser 的报告抬头
    const ran = violationCount > 0 || looksLikeReport(output);
    return { ran, violationCount, output, lines };
  }
}

function reportOutcome({ ran, violationCount, output, lines = [] }) {
  if (violationCount > 0) {
    console.log(chalk.red(`  ❌ 依赖架构发现 ${violationCount} 个违规`));
    lines.slice(0, 8).forEach((line) => console.log(chalk.dim(`    ${line.trim().slice(0, 150)}`)));
    return;
  }
  if (ran) {
    console.log(chalk.green('  ✅ 依赖架构验证通过'));
    return;
  }
  const firstLine = String(output).trim().split('\n')[0]?.slice(0, 100) || '无输出';
  console.log(chalk.yellow(`  ⚠ dependency-cruiser 没跑起来: ${firstLine}`));
}

function writeCallGraph(targetPath) {
  try {
    const reportsDir = join(targetPath, '.claude', 'reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    const callGraphPath = join(reportsDir, `depgraph-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.svg`);
    safeExec(
      `npx dependency-cruiser src -T dot -f - 2>&1 | npx graphviz --format svg -o "${callGraphPath}" 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 60000 }
    );
    return callGraphPath;
  } catch {
    // 调用图是可选产物，生成失败不影响依赖架构检查的结论
    return null;
  }
}

function resolveConfigPath(params, targetPath) {
  // 场景声明了 `params.rules: ".dependency-cruiser.js"`，以前没人读：配置路径是写死的
  // （还多拼了一层 `..`，指向仓库外）。现在按参数读，没声明才用默认位置。
  const declared = typeof params?.rules === 'string' && params.rules.trim() ? params.rules.trim() : '.dependency-cruiser.js';
  const candidates = [
    join(targetPath, declared),
    join(targetPath, '..', declared), // 历史行为：配置文件放在仓库上一级
  ];
  const configPath = candidates.find((p) => existsSync(p));
  console.log(chalk.dim(configPath ? `  → 使用项目 ${declared} 规则` : '  → 使用默认规则（禁止循环依赖、检测孤儿模块）'));
  return { declared, configPath, hasConfig: Boolean(configPath) };
}

export function handleDepcruiseArchitecture(_action, params, targetPath, context) {
  const { configPath, hasConfig } = resolveConfigPath(params, targetPath);
  const outcome = runDepcruise(configPath, hasConfig, targetPath);
  reportOutcome(outcome);

  const callGraphPath = writeCallGraph(targetPath);
  const graphWritten = Boolean(callGraphPath) && existsSync(callGraphPath);

  if (context) {
    // 没跑成就不写 verdict，让门禁如实记 skipped
    if (outcome.ran) {
      context.depCruiserPassed = outcome.violationCount === 0;
      context.depcruise_violations = outcome.violationCount;
    }
    if (graphWritten) {
      context.depgraph_path = callGraphPath;
    }
  }

  if (!outcome.ran) {
    return { status: 'skip', message: '依赖架构检查未完成：dependency-cruiser 没跑起来（不是通过）' };
  }
  return outcome.violationCount > 0
    ? `依赖架构检查完成: ${outcome.violationCount} 个违规`
    : '依赖架构检查完成: 无问题';
}
