import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { safeExec } from '../lib/safe-exec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function extractObjectKeys(source, _objectName) {
  const sigRes = [/^[ \t]*'([^']+)'[ \t]*:/gm, /^[ \t]*"([^"]+)"[ \t]*:/gm, /^[ \t]*(\w+)[ \t]*:/gm];
  const keys = new Set();
  for (const sigRe of sigRes) {
  let m;
  while ((m = sigRe.exec(source)) !== null) {
    keys.add(m[1]);
  }
  }
  return keys;
}

function isInlineArrow(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*:\\s*(?:\\([\\s\\S]*?\\)|function)\\s*=>`);
  return re.test(source);
}

function collectContextFlags(handlersDir) {
  const flags = new Set();
  if (!existsSync(handlersDir)) return flags;
  for (const f of readdirSync(handlersDir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(handlersDir, f), 'utf-8');
    const re = /context\.(\w+)\s*=/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      if (name === 'lastStepFailed') continue;
      // Only flags that look like gate results
      if (/(?:Passed|Configured|Generated|Created)$/.test(name)) {
        flags.add(name);
      }
    }
  }
  return flags;
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c, i) => (i > 0 ? '_' : '') + c.toLowerCase());
}

// ── Check: smoke tests ──

export function handleCheckSmoke(_action, _params, targetPath, context) {
  // 三态：没装测试框架/没有测试文件 ≠ 测试失败。
  // 以前一律 catch 成「冒烟测试执行失败」，在空项目上等于谎报红。
  const record = (status, message) => {
    if (context) context.smokePassed = status === 'pass' ? true : (status === 'fail' ? false : undefined);
    return { status, message };
  };

  let raw;
  try {
    raw = safeExec('npx vitest run 2>&1', targetPath, { stdio: 'pipe', timeout: 180000 }).toString();
  } catch (error) {
    const detail = [
      error?.message || '',
      error?.stdout?.toString?.() || '',
      error?.stderr?.toString?.() || '',
    ].join('\n');
    const failed = detail.match(/(?<!\d)(\d+)\s+failed/);
    if (context) {
      context.smokeFailures = Number(failed?.[1] || 0);
      context.smokeOutput = detail.slice(-2000);
    }
    if (failed) {
      return record('fail', `冒烟测试: ${failed[1]} 个失败`);
    }
    if (/No test files found|Cannot find (?:module|package)|ERR_MODULE_NOT_FOUND|Missing script|npm ERR!/i.test(detail)) {
      return record('skip', '目标项目没有可跑的测试（未装 vitest 或无测试文件）');
    }
    return record('fail', `冒烟测试执行失败: ${detail.split('\n')[0].slice(0, 120)}`);
  }

  const passed = /All \d+ tests? passed/.test(raw) || /Tests\s+\d+ passed/.test(raw);
  const failedMatch = raw.match(/(?<!\d)(\d+)\s+failed/);
  const failedCount = failedMatch ? Number.parseInt(failedMatch[1], 10) : 0;
  if (context) {
    context.smokeFailures = failedCount;
    context.smokeOutput = raw.slice(-2000);
  }
  if (passed) return record('pass', '冒烟测试全部通过');
  if (/No test files found/i.test(raw)) return record('skip', '目标项目没有测试文件可跑');
  return record(failedCount > 0 ? 'fail' : 'warn', failedCount > 0 ? `冒烟测试: ${failedCount} 个失败` : '冒烟测试已执行但无明确通过/失败结论');
}

// ── Check: action messages ──

export function handleCheckActionMessages(_action, _params, targetPath, context) {
  const actionsFile = join(__dirname, '..', 'actions.js');
  const messagesFile = join(DATA_DIR, 'action-messages.js');

  if (!existsSync(actionsFile) || !existsSync(messagesFile)) {
    // 这几个分支以前返回裸字符串：既不含「跳过」也不含「不可用」，
    // 于是「引擎自己找不到自己的文件」在自检报告里是 ✓ pass —— 最讽刺的一种假绿。
    return { status: 'warn', message: 'action-messages 完整性检查未完成：找不到 actions.js 或 action-messages.js（引擎安装不完整）' };
  }

  const actionsSrc = readFileSync(actionsFile, 'utf-8');
  const messagesSrc = readFileSync(messagesFile, 'utf-8');

  // Extract ACTION_REGISTRY keys (only inside the ACTION_REGISTRY block)
  const registryBlock = actionsSrc.match(/export const ACTION_REGISTRY = \{([\s\S]*?)\n\};/);
  if (!registryBlock) {
    return { status: 'warn', message: 'action-messages 完整性检查未完成：actions.js 里解析不出 ACTION_REGISTRY 块（结构被改动过？）' };
  }

  const registryKeys = extractObjectKeys(registryBlock[1]);
  const messageKeys = extractObjectKeys(
    messagesSrc.slice(0, messagesSrc.indexOf('export function getActionMessage'))
  );

  const orphanKeys = [...registryKeys]
    .filter(k => !messageKeys.has(k))
    .filter(k => !isInlineArrow(registryBlock[1], k));

  if (context) {
    context.missingActionMessages = orphanKeys;
    context.missingActionMessageCount = orphanKeys.length;
  }

  if (orphanKeys.length === 0) {
    return 'action-messages 完整性检查通过';
  }

  return { status: 'warn', message: `发现 ${orphanKeys.length} 个缺少 action message 的 handler` };
}

// ── Check: gate flags ──

export function handleCheckGateFlags(_action, _params, targetPath, context) {
  const handlersDir = join(__dirname, '..', 'handlers');
  const gateFlagsFile = join(DATA_DIR, 'gate-flags.js');

  if (!existsSync(gateFlagsFile)) {
    return { status: 'warn', message: 'gate-flags 完整性检查未完成：找不到 data/gate-flags.js（引擎安装不完整）' };
  }

  const contextFlags = collectContextFlags(handlersDir);
  const gateSrc = readFileSync(gateFlagsFile, 'utf-8');

  // Extract flag names from gate-flags.js (right side of mappings)
  const flagRe = /'(\w+)'/g;
  const mappedFlags = new Set();
  let m;
  while ((m = flagRe.exec(gateSrc)) !== null) {
    if (!m[1].includes('Passed') && !m[1].includes('Configured')
      && !m[1].includes('Generated') && !m[1].includes('Created'))
      continue;
    mappedFlags.add(m[1]);
  }

  const orphanFlags = [...contextFlags].filter(f => !mappedFlags.has(f));

  if (context) {
    context.missingGateFlags = orphanFlags;
    context.missingGateFlagCount = orphanFlags.length;
  }

  if (orphanFlags.length === 0) {
    return 'gate-flags 完整性检查通过';
  }

  return { status: 'warn', message: `发现 ${orphanFlags.length} 个未映射的 context flag` };
}

// ── Fix: action messages ──

function inferMessage(key) {
  const messages = {
    codegraph_impact: 'CodeGraph 影响分析完成（对话模式）',
    codegraph_trace: 'CodeGraph 依赖追踪完成（对话模式）',
    codeguardian_optimize: 'CodeGuardian 代码优化完成（对话模式）',
  };
  if (messages[key]) return messages[key];
  // Generic fallback: convert kebab/snake to readable form
  const readable = key.replace(/[-_]/g, ' ');
  return `${readable} 检查完成`;
}

export function handleFixActionMessages(_action, _params, _targetPath, context) {
  const orphanKeys = context?.missingActionMessages;
  if (!orphanKeys || orphanKeys.length === 0) {
    return '无需修复：没有缺少 action message 的 handler';
  }

  const messagesFile = join(DATA_DIR, 'action-messages.js');
  let src = readFileSync(messagesFile, 'utf-8');

  // Double-check current state for idempotency
  const existingKeys = extractObjectKeys(
    src.slice(0, src.indexOf('export function getActionMessage'))
  );
  const stillMissing = orphanKeys.filter(k => !existingKeys.has(k));
  if (stillMissing.length === 0) {
    if (context) context.fixedActionMessages = 0;
    return '无需修复：action message 已存在（可能已被其他进程添加）';
  }

  // Generate entries and insert before closing };
  const insertIdx = src.lastIndexOf('};', src.indexOf('export function getActionMessage'));
  const quoteKey = (k) => /^[a-zA-Z_$][\w$]*$/.test(k) ? k : `'${k}'`;
  const entries = stillMissing.map(k => `  ${quoteKey(k)}: '${inferMessage(k)}',`);
  const indent = '  ';
  const insertion = `\n${indent}// Auto-generated by /check\n${indent}${entries.join(`\n${indent}`)}\n`;
  src = src.slice(0, insertIdx) + insertion + src.slice(insertIdx);

  writeFileSync(messagesFile, src, 'utf-8');
  if (context) context.fixedActionMessages = stillMissing.length;

  return `已修复 ${stillMissing.length} 个缺失的 action message`;
}

// ── Fix: gate flags ──

function inferCheckName(flagName) {
  // context.lintPassed → lint
  // context.depCruiserPassed → depcruiser (but gate uses depcruise)
  // context.monitorConfigured → monitor
  const suffixPatterns = ['Passed', 'Configured', 'Generated', 'Created'];
  let base = flagName;
  for (const s of suffixPatterns) {
    if (base.endsWith(s)) {
      base = base.slice(0, -s.length);
      break;
    }
  }
  return camelToSnake(base);
}

export function handleFixGateFlags(_action, _params, _targetPath, context) {
  const orphanFlags = context?.missingGateFlags;
  if (!orphanFlags || orphanFlags.length === 0) {
    return '无需修复：没有未映射的 context flag';
  }

  const gateFlagsFile = join(DATA_DIR, 'gate-flags.js');
  let src = readFileSync(gateFlagsFile, 'utf-8');

  // Double-check for idempotency
  const existingMappings = new Set();
  const flagRe = /'(\w+)'/g;
  let m;
  while ((m = flagRe.exec(src)) !== null) existingMappings.add(m[1]);

  const stillMissing = orphanFlags.filter(f => !existingMappings.has(f));
  if (stillMissing.length === 0) {
    if (context) context.fixedGateFlags = 0;
    return '无需修复：gate flag 映射已存在';
  }

  // Insert before the closing });
  const insertIdx = src.lastIndexOf('});');
  const entries = stillMissing.map(f => `  ${inferCheckName(f)}: '${f}',`);
  const indent = '  ';
  const insertion = `\n${indent}// Auto-generated by /check\n${indent}${entries.join(`\n${indent}`)}\n`;
  src = src.slice(0, insertIdx) + insertion + src.slice(insertIdx);

  writeFileSync(gateFlagsFile, src, 'utf-8');
  if (context) {
    context.fixedGateFlags = stillMissing.length;
    context.fixedGateFlagDetails = stillMissing.map(f => `${inferCheckName(f)} → ${f}`);
  }

  return `已修复 ${stillMissing.length} 个缺失的 gate flag 映射`;
}

// ── Report ──

export function handleSelfCheckReport(_action, _params, _targetPath, context) {
  const lines = [
    '═══════════════════════════════════════',
    '  🔍 引擎自检报告',
    '═══════════════════════════════════════',
    '',
  ];

  // Smoke tests：三态。undefined = 没跑（无测试可跑），不能一律抳成「❌ 失败」。
  const smokeOk = context?.smokePassed;
  const smokeText = smokeOk === true ? '✅ 通过' : (smokeOk === false ? '❌ 失败' : '⏭ 未执行（无测试可跑）');
  lines.push(`  冒烟测试:     ${smokeText}`);
  if (smokeOk === false && context?.smokeFailures) {
    lines.push(`    失败数:     ${context.smokeFailures}`);
  }

  // Action messages
  const msgMissing = context?.missingActionMessageCount ?? '?';
  const msgFixed = context?.fixedActionMessages ?? 0;
  lines.push(`  Action 消息:  ${msgMissing === 0 ? '✅ 完整' : `⚠ ${msgMissing} 缺失`}`);
  if (msgFixed > 0) lines.push(`    已修复:     ${msgFixed} 个`);

  // Gate flags
  const flagMissing = context?.missingGateFlagCount ?? '?';
  const flagFixed = context?.fixedGateFlags ?? 0;
  lines.push(`  Gate 映射:    ${flagMissing === 0 ? '✅ 完整' : `⚠ ${flagMissing} 缺失`}`);
  if (flagFixed > 0) lines.push(`    已修复:     ${flagFixed} 个`);

  lines.push('');
  lines.push('═══════════════════════════════════════');

  const report = lines.join('\n');

  if (context) context.checkReport = report;
  // 报告本身不是检查：把显式状态带上，否则正文里的「❌ 失败」会被当成
  // 本步骤自己的失败（假红，而且和 check-smoke 重复计数）。
  // 但「什么都没跑」（smokePassed undefined）也不能记 pass——摘要里写着
  // 「⏭ 未执行」，汇总却给一个绿勾，等于让没验证过的东西看起来通过了。
  return {
    status: smokeOk === true ? 'pass' : 'warn',
    message: report,
  };
}
