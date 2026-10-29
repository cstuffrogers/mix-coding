import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';
import GATE_FLAGS from '../data/gate-flags.js';
import { isConversationMode } from '../lib/platform.js';
import { checkCePlugin } from './handler-verify.js';

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

export function handleConfirm(_action, params, _targetPath, _context) {
  if (params?.message) {
    console.log(chalk.dim(`  确认内容: ${params.message}`));
  }
  // 确认 = 有人说了「是」。交互层会先接这一步（handleConfirmation / handleConfirmDialog），
  // 真走到这里说明交互层没接管、也没人回答 —— 此时无条件写 user_confirmed=true，
  // 下游 condition(user_confirmed) 跟着假绿，等于引擎替用户点了头。
  return {
    status: 'fail',
    message: '确认步骤没拿到回答：需要人工确认（-y 表示是、--decline 表示否）',
  };
}

export function handleInstallDeps(_action, params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    // 没有 package.json 就什么都没装，以前也返回「依赖安装完成」。
    return { status: 'skip', message: '依赖安装跳过：目标项目没有 package.json' };
  }
  // frozen_lockfile（onboard 里写了 true）以前没人读：锁文件不一致时照样
  // `npm install` 把版本飘了。声明了就用 npm ci（严格按 lockfile，不一致直接失败）。
  const frozen = params?.frozen_lockfile === true;
  const cmd = frozen ? 'npm ci' : 'npm install';
  try {
    safeExec(cmd, targetPath, { stdio: 'inherit' });
    if (context) context.install_failed = false;
  } catch {
    if (context) context.install_failed = true;
    return { status: 'fail', message: `依赖安装失败（${cmd} 出错）` };
  }
  return frozen ? '依赖安装完成（npm ci，严格按 lockfile）' : '依赖安装完成';
}

export function handleDocsUpdate(_action, _params, targetPath) {
  const readmePath = join(targetPath, 'README.md');
  if (!existsSync(readmePath)) {
    return { status: 'skip', message: '文档更新跳过：目标项目没有 README.md' };
  }
  let readme = readFileSync(readmePath, 'utf-8');
  const date = new Date().toISOString().split('T', 1)[0];
  if (readme.includes('Last updated:')) {
    return { status: 'noop', message: '文档无需更新（README 已有 Last updated 行）' };
  }
  readme += `\n\n---\n\nLast updated: ${date}\n`;
  writeFileSync(readmePath, readme);
  return `文档更新完成（写入 Last updated: ${date}）`;
}

export function handleCheckEnvFile(_action, _params, targetPath, context) {
  const envPath = join(targetPath, '.env');
  const envExample = join(targetPath, '.env.example');
  if (existsSync(envPath)) {
    return '.env 文件已存在';
  }
  if (context) context.missing_env_vars_detected = true;
  // 这是「检查」步骤：检查结果就是发现了缺口。以前返回裸字符串，引擎把它判 ✓ pass ——
  // 「环境变量缺失」在报告里看起来是通过。发现缺口要看得见。
  if (existsSync(envExample)) {
    return { status: 'warn', message: '.env 缺失（可从 .env.example 生成）' };
  }
  return { status: 'warn', message: '.env 和 .env.example 均缺失：工程没有环境变量模板' };
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

export function handleStartDevServer(_action, params, targetPath, context) {
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    return { status: 'skip', message: '开发服务器未启动：目标项目没有 package.json' };
  }
  // port: "auto" | 数字 —— 指定端口。onboard#10 声明了 "auto"，以前没人读。
  const port = params?.port;
  const portArg = Number.isSafeInteger(port) || /^\d+$/.test(String(port ?? '')) ? ` -- --port ${Number(port)}` : '';
  // 不在这里真的跑 `npm run dev`：dev server 不会退出，engine 会卡死到超时，
  // 而以前外面还挂着 `|| true` + stdio:'inherit'，卡完再返回「已启动」。
  // 把命令交给 agent 在后台起，引擎只负责把「要跑什么」说清楚。
  if (context) context.dev_server_command = `npm run dev${portArg}`;
  return {
    status: 'noop',
    message: `开发服务器未由引擎启动（需在对话模式后台运行：npm run dev${portArg}）`,
  };
}

function runTests(targetPath) {
  // 以前用「输出里有没有 failed 字样」判成败：
  //   - `0 failed` 也匹配 → 真红的假象；
  //   - `2>&1` 把 stderr 混进来，弃用警告里带 fail 也红；
  // 退出码才是测试的真实结论。没脚本/没装依赖是「没跑成」，不是「失败」。
  try {
    safeExec('npm test', targetPath, { stdio: 'pipe' });
    return { verdict: 'pass' };
  } catch (error) {
    const text = [error?.message, error?.stdout?.toString?.(), error?.stderr?.toString?.()]
      .filter(Boolean).join(' ');
    if (/Missing script|ENOENT|Cannot find|No test files|not found/i.test(text)) {
      return { verdict: 'not-run', detail: '没有可运行的测试脚本' };
    }
    return { verdict: 'fail' };
  }
}

/** health_check：真的去敲一下服务地址，敲不到就不发通过结论 */
async function checkHealth(params, context) {
  const url = params?.url || context?.dev_server_url || context?.deploy_url;
  if (!url) {
    return { status: 'warn', message: '健康检查未执行：没有服务地址（context 里没有 dev_server_url / deploy_url，也没传 url 参数）' };
  }
  const attempts = Math.max(1, Number(params?.retry) || 1);
  const timeout = Number(params?.timeout) || 5000;
  let lastError = '';
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return { status: 'pass', message: `健康检查通过: ${url} → HTTP ${res.status}（第 ${i}/${attempts} 次）` };
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error?.name === 'AbortError' ? `超时 ${timeout}ms` : (error?.message || '请求失败');
    }
  }
  return { status: 'fail', message: `健康检查失败: ${url} → ${lastError}（重试 ${attempts} 次）` };
}

export async function handleVerify(_action, params, targetPath, context) {
  if ((params?.mode || 'smoke_test') === 'health_check') {
    return verifyHealthCheck(params, context);
  }
  return verifyByTestRun(params, targetPath, context);
}

async function verifyHealthCheck(params, context) {
  const result = await checkHealth(params, context);
  const label = params?.scope ? `${params.scope} 健康检查` : '健康检查';
  // 这里以前写 context.healthCheckPassed = true/false。没有任何门禁/条件读它，
  // 本步自己的 status 已经是结论 —— 多写一个无人读的 flag 只会让下一个审计
  // 把它当成「有测量」的证据（第九轮就因此误判过）。
  if (result.status === 'fail' && context) context.lastStepFailed = true;
  if (result.status === 'pass') {
    return `${label}通过: ${result.message.replace('健康检查通过: ', '')}`;
  }
  return result;
}

/** smoke_test / targeted / e2e 都落在「跑测试」上，区别只在跑哪一套。 */
function verifyByTestRun(params, targetPath, context) {
  const mode = params?.mode || 'smoke_test';
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    // 以前没有 package.json 直接算「验证通过」——什么都没验证。
    return { status: 'warn', message: '验证未执行：没有 package.json，没有可运行的东西（不是通过）' };
  }
  const { verdict, detail } = runTests(targetPath);
  if (verdict === 'not-run') {
    if (context) context.testPassed = undefined;
    return { status: 'warn', message: `验证未执行：${detail}` };
  }
  const verified = verdict === 'pass';
  if (context) context.testPassed = verified;
  if (!verified && context) context.lastStepFailed = true;
  const label = params?.scope ? `${params.scope}（${mode}）` : mode;
  if (!verified) return { status: 'fail', message: `验证失败: ${label} 测试未通过` };
  console.log(chalk.green('  ✅ 验证通过'));
  return `验证通过: ${label}`;
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
    } catch (error) {
      return { status: 'warn', message: `通知「${title}」打印了，但写入 ${join('.claude', 'notifications.log')} 失败: ${error.message}` };
    }
    return `通知已发送: ${title}（已写入通知日志）`;
  }

  return { status: 'warn', message: `通知「${title}」没有发送：没有项目目录，日志无处可写` };
}

export function handleNotify(_action, params, targetPath, context) {
  // 场景里两种写法都有：notify {message} 和 notify {title, content, level}，
  // 还有只写 type 的（success/info/error，当作日志级别用）。
  // 以前只认 message，于是 rollback#14 / setup#8 一句都不打印、日志也不写，
  // 却统一返回「任务完成通知已发送」—— 通知没发出去，步骤却是绿的。
  const level = (params?.level || params?.type || 'complete').toUpperCase();
  const title = params?.title;
  const message = params?.message || (params?.content ? `${title ? `${title}: ` : ''}${params.content}` : '');
  if (!message) {
    return { status: 'warn', message: '通知未发送：这一步没有 message / title+content，没什么可通知的' };
  }

  console.log(chalk.green(`  ${message}`));

  if (targetPath) {
    try {
      const notifLog = join(targetPath, '.claude', 'notifications.log');
      mkdirSync(dirname(notifLog), { recursive: true });
      writeFileSync(notifLog, `[${new Date().toISOString()}] [${level}] ${message}\n`, { flag: 'a' });
    } catch (error) {
      return { status: 'warn', message: `通知已打印，但写入通知日志失败: ${error.message}` };
    }
  }

  return notifyVerdict(context);
}

/** 前面有步骤失败时不能报「任务完成」—— 通知文本与真实结果矛盾更容易误导 */
function notifyVerdict(context) {
  const failures = (Array.isArray(context?.stepResults) ? context.stepResults : [])
    .filter((r) => r.status === 'fail');
  if (!failures.length) return '任务完成通知已发送';
  const names = failures.slice(0, 3).map((f) => `Step ${f.step ?? '?'} ${f.action}`).join('、');
  return `通知已发送（本次有 ${failures.length} 个步骤失败：${names}）—— 不报「已完成」`;
}

export function handleCeAction(action, params, targetPath, context) {
  const ceAction = action.replace('ce-', '');
  const desc = CE_DESCRIPTIONS[ceAction];
  if (!desc) {
    return `CE ${ceAction}: 未知操作`;
  }
  // 场景给 CE 步骤带了意图参数（ce-plan: detail_level / risk_analysis /
  // tech_selection）。以前这些键没人读，等于把用户的要求吞了。这里是引导性
  // handler：把要求打到屏幕上，agent 才能照做。
  const preferences = describePreferences(params);
  // 之前这里自己拼了个 `targetPath/../.claude/plugins/…`：路径错一层，而且和
  // 条件系统的 plugin_ce_available / handler-verify 的 checkCePlugin 各问各的。
  // 统一问 checkCePlugin（问的是「目标项目装没装」）。
  const ceAvailable = checkCePlugin(targetPath);
  printCeBanner(ceAction, desc, ceAvailable, preferences);

  // 以前无条件写 `ce_<action>_executed = true` + `ce_planned/ce_reviewed/...`：
  // 这两个键全仓库无人读，而且 CE 插件没装时也是 true —— 写了就撒谎。
  // 现在只记「被要求过」和「真的交给了对话模式」，不写没意义的布尔值。
  if (context) {
    const executed = ceAvailable && isConversationMode();
    const bucket = executed ? 'ce_executed' : 'ce_requested';
    if (!Array.isArray(context[bucket])) context[bucket] = [];
    if (!context[bucket].includes(ceAction)) context[bucket].push(ceAction);
  }

  const base = ceAvailable && isConversationMode() ? 'CE Plugin 就绪（对话模式执行）' : ceAvailable ? 'CE Plugin 已安装但需对话模式' : '上下文已设置（CE Plugin 未安装）';
  return `CE ${ceAction}: ${base}${preferences ? `（要求: ${preferences}）` : ''}`;
}

function printCeBanner(ceAction, desc, ceAvailable, preferences) {
  const isInClaudeCode = isConversationMode();
  const paint = ceAvailable && isInClaudeCode ? chalk.cyan : chalk.yellow;
  console.log(paint(`\n🧠 CE ${ceAction}: ${desc}`));
  if (ceAvailable && isInClaudeCode) {
    console.log(chalk.dim('  → CE Plugin 已安装，对话模式中由 Claude Code 调用'));
  } else if (ceAvailable) {
    console.log(chalk.dim('  ⚠ CE Plugin 已安装但非对话模式，无法调用'));
  } else {
    console.log(chalk.dim('  ⚠ CE Plugin 未安装，操作仅设置上下文标志'));
  }
  if (preferences) console.log(chalk.dim(`  → 本次要求: ${preferences}`));
}

/** 把步骤声明的要求参数渲染成人话（true → 只写键名） */
function describePreferences(params) {
  if (!params || typeof params !== 'object') return '';
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => {
      if (value === true) return key;
      if (Array.isArray(value)) return `${key}=${value.join('/')}`;
      return `${key}=${String(value)}`;
    })
    .join('，');
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

function buildStepSection(steps) {
  const counts = {};
  for (const r of steps) counts[r.status] = (counts[r.status] || 0) + 1;
  const countLine = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' / ');
  const lines = ['## 步骤结果', '', `共 ${steps.length} 步（${countLine}）`, ''];
  const notPass = steps.filter((r) => r.status !== 'pass');
  if (notPass.length === 0) return lines;
  lines.push('| 步骤 | action | 状态 | 说明 |', '| --- | --- | --- | --- |');
  for (const r of notPass) {
    lines.push(`| ${r.step ?? '?'} | ${r.action} | ${r.status} | ${String(r.detail || '').replace(/\|/g, '/')} |`);
  }
  lines.push('');
  return lines;
}

function buildContextSection(context) {
  const lines = ['## 上下文', ''];
  let unset = 0;
  for (const [key, val] of Object.entries(context)) {
    if (typeof val === 'function' || REPORT_INTERNAL_KEYS.has(key) || key.startsWith('_')) continue;
    // `undefined` 插值进模板就是字符串 "undefined"：报告里一列「未设置」比不给更误导。
    if (val === undefined) {
      unset += 1;
      continue;
    }
    lines.push(`- **${key}**: ${typeof val === 'object' ? JSON.stringify(val).slice(0, 200) : val}`);
  }
  if (unset > 0) lines.push('', `（另有 ${unset} 个键本次未设置，没写进报告）`);
  return lines;
}

function buildReportSections(context) {
  if (!context) return [];
  // 报告以前就是一个 context 原文 dump：既没有「哪步没通过」的摘要，又把
  // _awaitingAnswer / completedSteps 这类引擎内部键一起写进给人看的文件。
  const steps = Array.isArray(context.stepResults) ? context.stepResults : [];
  const stepSection = steps.length ? buildStepSection(steps) : [];
  return [...stepSection, ...buildContextSection(context)];
}

/** 不往报告里写的键：要么已经在「步骤结果」里总结过，要么是引擎内部状态 */
const REPORT_INTERNAL_KEYS = new Set(['stepResults', 'completedSteps', 'targetPath']);

function writeReportFile(targetPath, sections) {
  const reportDir = join(targetPath, '.claude', 'reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = join(reportDir, `report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
  writeFileSync(reportPath, `# 报告\n\n生成时间: ${new Date().toISOString()}\n\n${sections.join('\n')}\n`);
  return reportPath;
}

export function handleReport(_action, _params, targetPath, context) {
  if (!targetPath) {
    return { status: 'skip', message: '报告未生成：没有目标目录（不是「已生成」）' };
  }
  let reportPath;
  try {
    reportPath = writeReportFile(targetPath, buildReportSections(context));
  } catch (error) {
    return { status: 'warn', message: `报告写入失败: ${error.message}` };
  }
  // 「写了文件才算生成」：以前 catch 把异常吞掉，照样报「报告已生成」。
  if (!reportPath || !existsSync(reportPath)) {
    return { status: 'warn', message: `报告写入后找不到文件（${reportPath || '无路径'}），不发「已生成」` };
  }
  const steps = Array.isArray(context?.stepResults) ? context.stepResults.length : 0;
  return `报告已生成: ${reportPath}（含 ${steps} 步结果摘要）`;
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

/** 引擎自己特判的检查项（不走 GATE_FLAGS 映射） */
const SPECIAL_CHECKS = new Set(['security', 'security_scan']);
// 具名门禁（`checkGate: { gate: "setup_config" }`）。往这个集合里加名字，
// 必须同时在 evalNamedGate 里写出它到底查什么 —— 只加名字等于凭空造门禁。
const NAMED_GATES = new Set(['setup_config']);

/** 门禁是否真的实现了 —— 场景声明了什么、引擎就得有什么，这里只回答「认不认识」。 */
export function isKnownCheck(name) {
  return SPECIAL_CHECKS.has(name) || NAMED_GATES.has(name) || Object.hasOwn(GATE_FLAGS, name);
}

function evalSecurityGate(check, context) {
  const secResult = context?.securityScanResult;
  // 没跑过安全扫描（highSeverityFound 未定义）不能算通过 —— 以前只要 context 里有个
  // 空对象 `{}` 就放行，于是「没有高危漏洞」变成「没人查过」。
  if (!secResult || secResult.highSeverityFound === undefined) {
    return { kind: 'skipped', label: check };
  }
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
  if (SPECIAL_CHECKS.has(check)) {
    return evalSecurityGate(check, context);
  }
  return evalStandardGate(check, context);
}

/** 场景声明的具名门禁（`gate: "setup_config"`） */
function evalNamedGate(name, context) {
  if (!NAMED_GATES.has(name)) return { kind: 'unknown', label: name };
  // 设施是否真的搭出来了：e2e / monitor 各自的 handler 会写 flag，
  // property 那支不落文件，靠这三个键判断是否有人表过态。
  const flags = ['setupConfigured', 'e2eConfigured', 'monitorConfigured'].map((k) => context?.[k]);
  if (flags.every((v) => v === undefined)) return { kind: 'skipped', label: name };
  return flags.includes(true) ? { kind: 'passed', label: name } : { kind: 'failed', label: name };
}

export function handleCheckGate(_action, params, _targetPath, context) {
  // 场景里要么写 checks 列表，要么写 gate: "<具名门禁>"。
  // 以前后者没人读，于是 setup#3 的「配置质量门禁」实际在查 lint/typecheck/security ——
  // 门禁名字是装饰，查的是另一回事。
  const named = params?.gate ? evalNamedGate(params.gate, context) : null;
  if (named?.kind === 'unknown') {
    return { status: 'warn', message: `质量门禁 "${params.gate}" 未实现：引擎不认识这个门禁名（没拿默认检查项冒充）` };
  }
  const checks = named ? [params.gate] : (params?.checks || ['lint', 'typecheck', 'security']);
  const results = { passed: [], failed: [], blocked: [], skipped: [], unknown: [] };

  if (named) results[named.kind].push(named.label);
  for (const check of named ? [] : checks) {
    const r = evalSingleCheck(check, context);
    results[r.kind].push(r.label);
  }

  if (results.failed.length) console.error(chalk.yellow(`  ⚠ 失败: ${results.failed.join(', ')}`));
  const hasFailures = results.failed.length > 0 || results.blocked.length > 0;
  // block_release / block_merge / block_critical：场景声明了「这项失败就阻断」，
  // 以前这些键没人读，阻断全靠 step.on_error。这里把它变成真信号，
  // 引擎（handleStepError）会读 gateBlocked 中止工作流。
  const blockKeys = Object.keys(params || {}).filter((k) => k.startsWith('block_') && params[k]);
  if (hasFailures && context) {
    context.lastStepFailed = true;
    if (results.blocked.length || blockKeys.length) context.gateBlocked = true;
  }

  return gateVerdict(results, checks, params, blockKeys);
}

/** 把各项检查结果收成一个显式结论（没结论的时候绝不报「通过」） */
function gateVerdict(results, checks, params, blockKeys) {
  const effectiveTotal = checks.length - results.skipped.length;
  // 全部检查项都没有结果时以前报「质量门禁通过: 0/0」→ 一个检查都没跑却记 ✓ pass。
  // 没执行不是通过；认不出的检查名也不能被默默吞掉。
  if (effectiveTotal === 0) {
    return {
      status: 'skip',
      message: `质量门禁未执行：${checks.join(', ')} 都没有结果（对应步骤未跑或未记录）`,
    };
  }
  if (results.unknown.length) {
    return {
      status: 'warn',
      message: `质量门禁部分无法判定：${results.unknown.join(', ')} 不是已知检查项（已执行：${results.passed.length}/${effectiveTotal}）`,
    };
  }
  // 阻断/未通过直接给显式 fail：以前只靠 lastStepFailed + 「未通过」文案，
  // 而「未通过」不含「失败」，任何一个调用方忘了看 lastStepFailed 就成假绿。
  const blockNote = blockKeys.length ? `（已声明 ${blockKeys.join(', ')}，工作流阻断）` : '';
  if (results.blocked.length) {
    return { status: 'fail', message: `质量门禁阻断: ${results.blocked.join('; ')}${blockNote}` };
  }
  if (results.failed.length) {
    return { status: 'fail', message: `质量门禁未通过: ${results.failed.join('; ')}${blockNote}` };
  }
  // mode: strict —— 有检查项根本没跑过时不许发「通过」：
  // 以前跳过项从分母里扣掉，5 项只跑了 2 项也报「通过 2/2」。
  if (params?.mode === 'strict' && results.skipped.length > 0) {
    return {
      status: 'warn',
      message: `质量门禁严格模式：${results.skipped.length} 项没有结果（${results.skipped.join(', ')}），通过 ${results.passed.length}/${checks.length}，不发通过结论`,
    };
  }
  return `质量门禁通过: ${results.passed.length}/${effectiveTotal}`;
}
