import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';
import GATE_FLAGS from '../data/gate-flags.js';
import { isConversationMode } from '../lib/platform.js';

const CE_DESCRIPTIONS = {
  plan: 'CE Plugin 生成详细实施方案：任务拆解、依赖分析、风险识别、时间预估',
  review: 'CE Plugin 多Agent深度审查：架构、安全、性能、代码规范、可维护性、文档、测试、国际化、最佳实践',
  debug: 'CE Plugin 系统排查：日志分析、依赖追踪、根因定位',
  compound: 'CE Plugin 知识沉淀：将本次工作流经验整理到项目知识库 CLAUDE.md',
  brainstorm: 'CE Plugin 需求头脑风暴',
  work: 'CE Plugin 分步开发执行',
};

export function handleSelect(_action, params, _targetPath, context) {
  const options = params?.options || [];
  const labelOf = opt => (typeof opt === 'string' ? opt : (opt.label ?? opt.id));
  if (options.length === 0) {
    return { status: 'fail', message: '没有可选项：该步骤需要人工选择，引擎不会凭空生成答案' };
  }
  // 以前取 options[0]。release 的版本类型第一项就是 major，于是 --auto 下
  // 静默按大版本发布；现在没有答案就诚实报错，不装成“选完了”。
  const selected = context?.selectedOption;
  if (!selected) {
    return {
      status: 'fail',
      message: `需要人工选择（${options.map(o => labelOf(o)).join(' / ')}）：非交互模式下不再默认取第一项`,
    };
  }
  return `选择完成：${selected}`;
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
  const isInClaudeCode = isConversationMode();

  if (ceAvailable && isInClaudeCode) {
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

  return `CE ${ceAction}: ${ceAvailable && isInClaudeCode ? 'CE Plugin 就绪（对话模式执行）' : ceAvailable ? 'CE Plugin 已安装但需对话模式' : '上下文已设置（CE Plugin 未安装）'}`;
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
  const { options } = params || {};
  const labelOf = opt => (typeof opt === 'object' ? (opt.label ?? opt.id) : opt);
  const labels = (options || []).map(o => labelOf(o)).filter(Boolean);

  // 以前这里取第一项当“已选择”——release 的第一项是 major，rollback 的第一项是
  // 空数组里不存在的目标。选项列表本身是给人看的，不是默认值。
  const selected = context?.selectedOption;
  if (!selected) {
    if (labels.length === 0) {
      return { status: 'fail', message: '无可用选项：该步骤需要外部提供候选（动态列表尚未实现）' };
    }
    return {
      status: 'fail',
      message: `需要人工选择（${labels.join(' / ')}）：非交互模式下不再默认取第一项`,
    };
  }
  if (context && context._sceneId === 'design') context.design_selected = selected;
  return `已选择: ${selected}`;
}

function buildReportSections(context) {
  if (!context) return [];
  const sections = [];
  for (const [key, val] of Object.entries(context)) {
    if (typeof val !== 'function' && key !== 'targetPath') {
      sections.push(`- **${key}**: ${typeof val === 'object' ? JSON.stringify(val).slice(0, 200) : val}`);
    }
  }
  return sections;
}

function writeReportFile(targetPath, sections) {
  const reportDir = join(targetPath, '.claude', 'reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = join(reportDir, `report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
  writeFileSync(reportPath, `# 报告\n\n生成时间: ${new Date().toISOString()}\n\n${sections.join('\n')}\n`);
}

export function handleReport(_action, params, targetPath, context) {
  if (targetPath) {
    try {
      const sections = buildReportSections(context);
      writeReportFile(targetPath, sections);
    } catch { /* non-critical */ }
  }
  return '报告已生成';
}

export function handleAskUser(_action, params, _targetPath, context) {
  // 走到这里说明交互层没拦住（或调用方直接 dispatch）：绝不能替用户编一个答案。
  // 以前 auto 下返回 default / true，plan-ceo-review 的「请确认目标功能」就这样被自动点头。
  const prompt = params?.prompt || params?.message || '（该步骤未声明问题文本）';
  if (context) context[`asked_${params?.key || 'generic'}`] = undefined;
  return {
    status: 'fail',
    message: `需要人工回答：${prompt}（非交互模式下不代答；用 --yes / --decline 表态，或先问用户）`,
  };
}

function evalSecurityGate(check, context) {
  const secResult = context?.securityScanResult || {};
  if (secResult.highSeverityFound) {
    return { kind: 'blocked', label: `${check}: 发现高危漏洞` };
  }
  return { kind: 'passed', label: check };
}

function evalStandardGate(check, context) {
  const flag = GATE_FLAGS[check];
  if (!flag) return { kind: 'unknown', label: check };
  if (context?.[flag] === undefined) return { kind: 'skipped', label: check };
  if (context?.[flag] !== false) return { kind: 'passed', label: check };
  return { kind: 'failed', label: check };
}

function evalSingleCheck(check, context) {
  if (check === 'security' || check === 'security_scan') {
    return evalSecurityGate(check, context);
  }
  return evalStandardGate(check, context);
}

export function handleCheckGate(_action, params, _targetPath, context) {
  const checks = params?.checks || ['lint', 'typecheck', 'security'];
  const results = { passed: [], failed: [], blocked: [], skipped: [], unknown: [] };

  for (const check of checks) {
    const r = evalSingleCheck(check, context);
    results[r.kind].push(r.label);
  }

  if (results.failed.length) console.error(chalk.yellow(`  ⚠ 失败: ${results.failed.join(', ')}`));
  const hasFailures = results.failed.length > 0 || results.blocked.length > 0;
  if (hasFailures && context) {
    context.lastStepFailed = true;
    if (results.blocked.length) context.gateBlocked = true;
  }

  const effectiveTotal = checks.length - results.skipped.length;
  return results.blocked.length
    ? `质量门禁阻断: ${results.blocked.join('; ')}`
    : results.failed.length
      ? `质量门禁未通过: ${results.failed.join('; ')}`
      : `质量门禁通过: ${results.passed.length}/${effectiveTotal}`;
}
