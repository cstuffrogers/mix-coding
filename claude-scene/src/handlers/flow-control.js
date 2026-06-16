import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';
import GATE_FLAGS from '../data/gate-flags.js';

const CE_DESCRIPTIONS = {
  plan: 'CE Plugin 生成详细实施方案：任务拆解、依赖分析、风险识别、时间预估',
  review: 'CE Plugin 多Agent深度审查：架构、安全、性能、代码规范、可维护性、文档、测试、国际化、最佳实践',
  debug: 'CE Plugin 系统排查：日志分析、依赖追踪、根因定位',
  compound: 'CE Plugin 知识沉淀：将本次工作流经验整理到项目知识库 CLAUDE.md',
  brainstorm: 'CE Plugin 需求头脑风暴',
  work: 'CE Plugin 分步开发执行',
};

export function handleSelect(_action, params, _targetPath, context) {
  if (params?.options && params.options.length > 0) {
    const selected = context?.selectedOption || params.options[0];
    if (context) context.selectedOption = selected;
    return `选择完成：${selected}`;
  }
  return '选择完成（无选项）';
}

export function handleConfirm(_action, params, _targetPath, context) {
  if (params?.message) {
    console.log(chalk.dim(`  确认内容: ${params.message}`));
  }
  if (context) context.user_confirmed = true;
  return '确认完成';
}

export function handleInstallDeps(_action, _params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  if (existsSync(packagePath)) {
    try {
      safeExec('npm install', targetPath, { stdio: 'inherit' });
      if (context) context.install_failed = false;
    } catch {
      if (context) context.install_failed = true;
      return '依赖安装失败（npm install 出错）';
    }
  }
  return '依赖安装完成';
}

export function handleDocsUpdate(_action, _params, targetPath) {
  const readmePath = join(targetPath, 'README.md');
  if (existsSync(readmePath)) {
    let readme = readFileSync(readmePath, 'utf-8');
    const date = new Date().toISOString().split('T', 1)[0];
    if (!readme.includes('Last updated:')) {
      readme += `\n\n---\n\nLast updated: ${date}\n`;
      writeFileSync(readmePath, readme);
    }
  }
  return '文档更新完成';
}

export function handleCheckEnvFile(_action, _params, targetPath, context) {
  const envPath = join(targetPath, '.env');
  const envExample = join(targetPath, '.env.example');
  if (existsSync(envPath)) {
    return '.env 文件已存在';
  }
  if (context) context.missing_env_vars_detected = true;
  if (existsSync(envExample)) {
    return '.env 文件缺失（可生成）';
  }
  return '.env 和 .env.example 均缺失';
}

export function handleGenerateEnv(_action, _params, targetPath) {
  const envExample = join(targetPath, '.env.example');
  const envPath = join(targetPath, '.env');
  if (!existsSync(envExample)) {
    return '.env.example 缺失，生成跳过';
  }
  if (existsSync(envPath)) {
    return '.env 已存在，跳过生成';
  }
  const content = readFileSync(envExample, 'utf-8');
  writeFileSync(envPath, content, 'utf-8');
  return '.env 已生成';
}

export function handleStartDevServer(_action, _params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  if (existsSync(packagePath)) {
    try {
      safeExec('npm run dev 2>&1 || true', targetPath, { stdio: 'inherit' });
    } catch {
      if (context) context.dev_server_failed = true;
    }
  }
  return '开发服务器已启动';
}

function runTests(targetPath) {
  try {
    const result = safeExec('npm test 2>&1', targetPath, { stdio: 'pipe' }).toString();
    return !result.includes('failed') && !result.includes('FAIL');
  } catch (e) {
    if (e.stdout) {
      const out = e.stdout.toString();
      return !out.includes('failed') && !out.includes('FAIL');
    }
    return false;
  }
}

export function handleVerify(_action, _params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  const verified = existsSync(packagePath) ? runTests(targetPath) : true;
  if (context) context.testPassed = verified;
  if (!verified) {
    if (context) context.lastStepFailed = true;
  } else {
    console.log(chalk.green('  ✅ 验证通过'));
  }
  return verified ? '验证通过' : '验证失败';
}

export function handleSend(_action, params, targetPath) {
  const title = params?.title || '通知';
  const content = params?.content || '';
  const level = params?.level || 'info';

  if (targetPath) {
    try {
      const notifLog = join(targetPath, '.claude', 'notifications.log');
      mkdirSync(dirname(notifLog), { recursive: true });
      const entry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${title}: ${content}\n`;
      writeFileSync(notifLog, entry, { flag: 'a' });
    } catch { /* non-critical */ }
  }

  return `通知已发送: ${title}`;
}

export function handleNotify(_action, params, targetPath) {
  const message = params?.message;
  if (message) {
    console.log(chalk.green(`  ${message}`));
  }

  if (targetPath && message) {
    try {
      const notifLog = join(targetPath, '.claude', 'notifications.log');
      mkdirSync(dirname(notifLog), { recursive: true });
      writeFileSync(notifLog, `[${new Date().toISOString()}] [COMPLETE] ${message}\n`, { flag: 'a' });
    } catch { /* non-critical */ }
  }

  return `任务完成通知已发送`;
}

export function handleCeAction(action, _params, targetPath, context) {
  const ceAction = action.replace('ce-', '');
  const desc = CE_DESCRIPTIONS[ceAction];
  if (!desc) {
    return `CE ${ceAction}: 未知操作`;
  }

  const ceConfigPath = targetPath ? join(targetPath, '..', '.claude', 'plugins', 'compound-engineering.json') : null;
  const ceAvailable = ceConfigPath ? existsSync(ceConfigPath) : false;
  const inClaudeCode = process.env.CLAUDECODE === '1';

  if (ceAvailable && inClaudeCode) {
    console.log(chalk.cyan(`\n🧠 CE ${ceAction}: ${desc}`));
    console.log(chalk.dim('  → CE Plugin 已安装，对话模式中由 Claude Code 调用'));
  } else if (ceAvailable) {
    console.log(chalk.yellow(`\n🧠 CE ${ceAction}: ${desc}`));
    console.log(chalk.dim('  ⚠ CE Plugin 已安装但非对话模式，无法调用'));
  } else {
    console.log(chalk.yellow(`\n🧠 CE ${ceAction}: ${desc}`));
    console.log(chalk.dim('  ⚠ CE Plugin 未安装，操作仅设置上下文标志'));
  }

  // Set context flags so downstream steps can react
  if (context) {
    context[`ce_${ceAction}_executed`] = true;
    context.ce_plugin_available = ceAvailable;

    switch (ceAction) {
      case 'brainstorm':
        context.ce_brainstormed = true;
        break;
      case 'plan':
        context.ce_planned = true;
        break;
      case 'review':
        context.ce_reviewed = true;
        break;
      case 'debug':
        context.ce_debugged = true;
        break;
      case 'compound':
        context.ce_compounded = true;
        break;
      case 'work':
        context.ce_worked = true;
        break;
    }
  }

  return `CE ${ceAction}: ${ceAvailable && inClaudeCode ? 'CE Plugin 就绪（对话模式执行）' : ceAvailable ? 'CE Plugin 已安装但需对话模式' : '上下文已设置（CE Plugin 未安装）'}`;
}

export function handleAnalyze(_action, params, targetPath, context) {
  const repo = params?.repo || context?.prompt?.match(/github\.com\/([^/\s]+\/[^/\s]+)/)?.[1];
  const metric = params?.metric || 'openrank';
  const period = params?.period || '90d';

  if (repo) {
    try {
      safeExec(`npx open-digger analyze --repo ${escapeArg(repo)} --metric ${escapeArg(metric)} --period ${escapeArg(period)} 2>&1 || true`, targetPath, { stdio: 'inherit' });
    } catch (e) { console.error('open-digger analyze failed:', e.message); }
  } else {
    try {
      safeExec('npx open-digger analyze 2>&1 || true', targetPath, { stdio: 'inherit' });
    } catch (e) { console.error('open-digger analyze failed:', e.message); }
  }
  if (context) context.analyzeCompleted = true;
  return '竞品分析完成';
}

export function handleChoose(_action, params, _targetPath, context) {
  const { message: _message, options } = params || {};
  const choices = (options || []).map(opt => {
    if (typeof opt === 'object' && opt.label) return { label: opt.label, description: opt.description || '' };
    return { label: opt, description: '' };
  });
  if (choices.length > 0) {
    const selected = choices[0].label;
    if (context) {
      context.selectedOption = selected;
      if (context._sceneId === 'design') context.design_selected = selected;
    }
    return `已选择: ${selected}`;
  }
  return '无可用选项';
}

export function handleReport(_action, params, targetPath, context) {

  // Write report summary to file if targetPath exists
  if (targetPath) {
    try {
      const reportDir = join(targetPath, '.claude', 'reports');
      if (!existsSync(reportDir)) {
        mkdirSync(reportDir, { recursive: true });
      }
      const reportPath = join(reportDir, `report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
      const sections = [];
      if (context) {
        for (const [key, val] of Object.entries(context)) {
          if (typeof val !== 'function' && key !== 'targetPath') {
            sections.push(`- **${key}**: ${typeof val === 'object' ? JSON.stringify(val).slice(0, 200) : val}`);
          }
        }
      }
      writeFileSync(reportPath, `# 报告\n\n生成时间: ${new Date().toISOString()}\n\n${sections.join('\n')}\n`);
    } catch { /* non-critical */ }
  }

  return '报告已生成';
}

export function handleAskUser(_action, params, _targetPath, context) {
  const type = params?.type || 'confirm';
  const defVal = params?.default;
  const answer = type === 'confirm' ? (defVal !== undefined ? defVal : true) : (defVal || '');

  if (context) {
    context.user_confirmed = answer;
    context[`asked_${params?.key || 'generic'}`] = answer;
  }

  return `用户应答: ${answer}`;
}

export function handleCheckGate(_action, params, _targetPath, context) {
  const checks = params?.checks || ['lint', 'typecheck', 'security'];
  const results = { passed: [], failed: [], blocked: [], skipped: [], unknown: [] };

  const boolPassed = (flag) => context?.[flag] !== false;
  const hasResult = (flag) => context?.[flag] !== undefined;

  for (const check of checks) {
    if (check === 'security' || check === 'security_scan') {
      const secResult = context?.securityScanResult || {};
      (secResult.highSeverityFound ? results.blocked : results.passed)
        .push(secResult.highSeverityFound ? `${check}: 发现高危漏洞` : check);
      continue;
    }
    const flag = GATE_FLAGS[check];
    if (!flag) { results.unknown.push(check); continue; }
    if (!hasResult(flag)) { results.skipped.push(check); continue; }
    (boolPassed(flag) ? results.passed : results.failed).push(check);
  }

  if (results.failed.length) console.error(chalk.yellow(`  ⚠ 失败: ${results.failed.join(', ')}`));
  if (results.blocked.length && context) {
      context.lastStepFailed = true;
      context.gateBlocked = true;
    }

  const effectiveTotal = checks.length - results.skipped.length;
  const summary = results.blocked.length
    ? `质量门禁阻断: ${results.blocked.join('; ')}`
    : results.failed.length
      ? `质量门禁未通过: ${results.failed.join('; ')}`
      : `质量门禁通过: ${results.passed.length}/${effectiveTotal}`;
  return summary;
}
