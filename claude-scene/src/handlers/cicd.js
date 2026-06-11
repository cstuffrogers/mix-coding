import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

function checkActAvailable() {
  try {
    safeExec('act --version 2>&1', process.cwd(), { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function checkTaskAvailable() {
  try {
    safeExec('task --version 2>&1', process.cwd(), { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function validateWorkflow(workflowPath, actAvailable, targetPath) {
  if (actAvailable) {
    try {
      safeExec(`act --dryrun -W "${workflowPath}" 2>&1`, targetPath, { stdio: 'pipe' });
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e.stdout?.toString() || e.message };
    }
  }
  // Fallback: basic YAML structure check
  try {
    const content = readFileSync(workflowPath, 'utf-8');
    const hasOn = /^on:\s*/m.test(content);
    const hasJobs = /^jobs:\s*/m.test(content);
    if (!hasOn && !hasJobs) return { valid: false, error: 'missing required fields (on/jobs)' };
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function generateTaskfile(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  const scripts = {};
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      Object.assign(scripts, pkg.scripts || {});
    } catch { /* ignore */ }
  }

  const taskEntries = [];
  const added = new Set();

  for (const name of ['build', 'test', 'lint', 'dev', 'start', 'format']) {
    if (scripts[name] && !added.has(name)) {
      taskEntries.push(`  ${name}:\n    cmds:\n      - npm run ${name}\n    desc: ${name} the project`);
      added.add(name);
    }
  }

  if (taskEntries.length === 0) {
    taskEntries.push('  default:\n    cmds:\n      - echo "No scripts found in package.json"\n    desc: Default task');
  }

  return `version: '3'

tasks:
${taskEntries.join('\n\n')}
`;
}

function scanAndValidateWorkflows(targetPath, actAvailable) {
  const workflowsDir = join(targetPath, '.github', 'workflows');
  if (!existsSync(workflowsDir)) {
    console.log(chalk.yellow('  ⚠ .github/workflows/ 目录不存在'));
    return { found: 0, valid: 0 };
  }

  const entries = readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  console.log(chalk.dim(`  发现 ${entries.length} 个工作流文件`));

  let valid = 0;
  for (const entry of entries) {
    const wfPath = join(workflowsDir, entry);
    const result = validateWorkflow(wfPath, actAvailable, targetPath);
    if (result.valid) {
      valid++;
      console.log(chalk.green(`    ✅ ${entry}`));
    } else {
      console.log(chalk.yellow(`    ⚠ ${entry}: ${result.error}`));
    }
  }
  return { found: entries.length, valid };
}

function ensureTaskfile(targetPath, taskAvailable) {
  const taskfilePath = join(targetPath, 'Taskfile.yml');
  const exists = existsSync(taskfilePath) || existsSync(join(targetPath, 'Taskfile.yaml'));

  if (exists) {
    console.log(chalk.dim('  Taskfile.yml 已存在，跳过'));
    if (taskAvailable) {
      try {
        safeExec('task --list 2>&1', targetPath, { stdio: 'pipe' });
        return true;
      } catch { /* validation failed but file exists */ }
    }
    return true;
  }

  try {
    writeFileSync(taskfilePath, generateTaskfile(targetPath), 'utf-8');
    console.log(chalk.green('  ✅ Taskfile.yml 已生成'));
    return true;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 生成 Taskfile 失败: ${e.message}`));
    return false;
  }
}

export function handleSetupCI(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔧 正在配置 CI/CD...'));

  const actAvailable = checkActAvailable();
  const taskAvailable = checkTaskAvailable();
  console.log(chalk.dim(`  Act: ${actAvailable ? '可用' : '未安装'}`));
  console.log(chalk.dim(`  Task: ${taskAvailable ? '可用' : '未安装'}`));

  const { found, valid } = scanAndValidateWorkflows(targetPath, actAvailable);
  const taskfileGenerated = ensureTaskfile(targetPath, taskAvailable);

  if (context) {
    context.ciConfigured = found > 0 || taskfileGenerated;
    context.workflowsFound = found;
    context.workflowsValid = valid;
    context.taskfileGenerated = taskfileGenerated;
    context.actAvailable = actAvailable;
    context.taskAvailable = taskAvailable;
    if (!context.ciConfigured) context.lastStepFailed = true;
  }

  return context?.ciConfigured
    ? `CI/CD 配置完成（${valid}/${found} 工作流有效，Taskfile ${taskfileGenerated ? '已' : '未'}生成）`
    : 'CI/CD 配置部分完成（无工作流且 Taskfile 生成失败）';
}
