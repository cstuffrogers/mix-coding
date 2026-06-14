import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleDepcruiseArchitecture(_action, params, targetPath, context) {
  const configPath = join(targetPath, '..', '.dependency-cruiser.js');
  const hasConfig = existsSync(configPath);

  console.log(chalk.blue('\n📐 正在验证依赖架构（dependency-cruiser）...'));
  if (hasConfig) {
    console.log(chalk.dim('  → 使用项目 .dependency-cruiser.js 规则'));
  } else {
    console.log(chalk.dim('  → 使用默认规则（禁止循环依赖、检测孤儿模块）'));
  }

  let violationCount = 0;
  let callGraphPath = null;

  // Step 1: Architecture validation
  try {
    const args = hasConfig
      ? `-c "${configPath}" src -T err`
      : 'src -T err --no-config';
    safeExec(`npx dependency-cruiser ${args} 2>&1`, targetPath, {
      stdio: 'pipe',
      timeout: 120000,
    });
  } catch (e) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    const violations = output.split('\n').filter(l => /error|warn|violation|cruiser/i.test(l));
    violationCount = violations.length;

    if (violationCount > 0) {
      console.log(chalk.red(`  ❌ 依赖架构发现 ${violationCount} 个违规`));
      violations.slice(0, 8).forEach(v => console.log(chalk.dim(`    ${v.trim().slice(0, 150)}`)));
    } else {
      console.log(chalk.green('  ✅ 依赖架构验证通过'));
    }
  }

  // Step 2: Generate call graph for archiving
  try {
    const reportsDir = join(targetPath, '.claude', 'reports');
    if (!existsSync(reportsDir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(reportsDir, { recursive: true });
    }
    callGraphPath = join(reportsDir, `depgraph-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.svg`);
    safeExec(
      `npx dependency-cruiser src -T dot -f - 2>&1 | npx graphviz --format svg -o "${callGraphPath}" 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', timeout: 60000 }
    );
  } catch {
    // Call graph generation is optional
    console.log(chalk.dim('  ℹ 调用图生成跳过（graphviz 不可用）'));
  }

  if (context) {
    context.depcruisePassed = violationCount === 0;
    context.depcruise_violations = violationCount;
    if (callGraphPath && existsSync(callGraphPath)) {
      context.depgraph_path = callGraphPath;
    }
  }

  return violationCount > 0
    ? `依赖架构检查完成: ${violationCount} 个违规`
    : '依赖架构检查完成: 无问题';
}
