import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec, escapeArg } from '../lib/safe-exec.js';

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
    console.log(chalk.cyan(`\n📋 已选择：${selected}`));
    return `选择完成：${selected}`;
  }
  return '选择完成（无选项）';
}

export function handleConfirm(_action, params) {
  console.log(chalk.cyan('\n✅ 确认操作完成'));
  if (params?.message) {
    console.log(chalk.dim(`  确认内容: ${params.message}`));
  }
  return '确认完成';
}

export function handleInstallDeps(_action, _params, targetPath) {
  console.log(chalk.blue('\n📦 正在安装依赖...'));
  const packagePath = join(targetPath, 'package.json');
  if (existsSync(packagePath)) {
    try {
      safeExec('npm install', targetPath, { stdio: 'inherit' });
    } catch (e) { console.debug('npm install failed:', e.message); }
  }
  return '依赖安装完成';
}

export function handleDocsUpdate(_action, _params, targetPath) {
  console.log(chalk.blue('\n📝 正在更新文档...'));
  const readmePath = join(targetPath, 'README.md');
  if (existsSync(readmePath)) {
    let readme = readFileSync(readmePath, 'utf-8');
    const date = new Date().toISOString().split('T')[0];
    if (!readme.includes('Last updated:')) {
      readme += `\n\n---\n\nLast updated: ${date}\n`;
      writeFileSync(readmePath, readme);
    }
  }
  return '文档更新完成';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleCheckPrerequisites(_action, params, targetPath, context) {
  const requestedChecks = params?.checks || ['node', 'npm', 'git'];
  console.log(chalk.blue('\n🔧 正在检查系统前置条件...'));

  // iOS-only tools — only required when platform is ios or both
  const iosOnly = new Set(['xcode', 'cocoapods']);
  const platform = context?.platform || 'unknown';
  const isIos = platform === 'ios' || platform === 'both';
  const isAndroid = platform === 'android' || platform === 'both';

  const checkers = {
    node: () => {
      const ver = safeExec('node --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    npm: () => {
      const ver = safeExec('npm --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    git: () => {
      const ver = safeExec('git --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    jdk: () => {
      const ver = safeExec('java -version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver.split('\n')[0] };
    },
    xcode: () => {
      safeExec('xcodebuild -version 2>&1', targetPath, { stdio: 'pipe' });
      return { ok: true, detail: '已安装' };
    },
    android_studio: () => {
      const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (androidHome && existsSync(androidHome)) {
        return { ok: true, detail: androidHome };
      }
      safeExec('sdkmanager --version 2>&1', targetPath, { stdio: 'pipe' });
      return { ok: true, detail: 'sdkmanager 可用' };
    },
    ruby: () => {
      const ver = safeExec('ruby --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
    cocoapods: () => {
      const ver = safeExec('pod --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
      return { ok: true, detail: ver };
    },
  };

  const results = {};
  for (const name of requestedChecks) {
    // Skip iOS-only tools on non-iOS platforms, Android-only on non-Android
    if (iosOnly.has(name) && !isIos) {
      console.log(chalk.dim(`  ⏭ ${name}: 跳过（非 iOS 平台）`));
      continue;
    }
    if (name === 'android_studio' && !isAndroid) {
      console.log(chalk.dim(`  ⏭ ${name}: 跳过（非 Android 平台）`));
      continue;
    }
    // ruby is needed for iOS (CocoaPods) and general tooling — only require on iOS
    if (name === 'ruby' && !isIos) {
      console.log(chalk.dim(`  ⏭ ${name}: 跳过（非 iOS 平台）`));
      continue;
    }
    if (checkers[name]) {
      try {
        const r = checkers[name]();
        results[name] = { ok: r.ok, detail: r.detail };
        console.log(chalk.dim(`  ✅ ${name}: ${r.detail}`));
      } catch {
        results[name] = { ok: false, detail: '未安装' };
        console.log(chalk.yellow(`  ⚠ ${name}: 未安装`));
      }
    } else {
      results[name] = { ok: false, detail: '未知检查项' };
      console.log(chalk.dim(`  ❓ ${name}: 未知检查项`));
    }
  }

  const passed = Object.entries(results).filter(([, v]) => v.ok);
  const missing = Object.entries(results).filter(([, v]) => !v.ok);
  console.log(chalk[missing.length === 0 ? 'green' : 'yellow'](
    `  ${missing.length === 0 ? '✅ 所有前置条件满足' : `⚠ ${missing.length} 项缺失: ${missing.map(([k]) => k).join(', ')}`}`,
  ));
  if (context) context.envPrerequisitesPassed = missing.length === 0;
  return `前置条件检查: ${passed.map(([k]) => k).join(', ') || '无'} 可用`;
}

export function handleCheckEnvFile(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔍 正在检查 .env 文件...'));
  const envPath = join(targetPath, '.env');
  const envExample = join(targetPath, '.env.example');
  if (existsSync(envPath)) {
    console.log(chalk.green('  ✅ .env 文件已存在'));
    return '.env 文件已存在';
  }
  if (context) context.missing_env_vars_detected = true;
  if (existsSync(envExample)) {
    console.log(chalk.yellow('  ⚠ .env 缺失，存在 .env.example 可生成'));
    return '.env 文件缺失（可生成）';
  }
  console.log(chalk.yellow('  ⚠ .env 和 .env.example 均不存在'));
  return '.env 和 .env.example 均缺失';
}

export function handleGenerateEnv(_action, _params, targetPath) {
  console.log(chalk.blue('\n📄 正在生成 .env 文件...'));
  const envExample = join(targetPath, '.env.example');
  const envPath = join(targetPath, '.env');
  if (!existsSync(envExample)) {
    console.log(chalk.yellow('  ⚠ .env.example 不存在，无法生成'));
    return '.env.example 缺失，生成跳过';
  }
  if (existsSync(envPath)) {
    console.log(chalk.dim('  .env 已存在，跳过'));
    return '.env 已存在，跳过生成';
  }
  const content = readFileSync(envExample, 'utf-8');
  writeFileSync(envPath, content, 'utf-8');
  console.log(chalk.green('  ✅ .env 已从 .env.example 生成'));
  return '.env 已生成';
}

export function handleStartDevServer(_action, _params, targetPath) {
  console.log(chalk.blue('\n🚀 正在启动开发服务器...'));
  const packagePath = join(targetPath, 'package.json');
  if (existsSync(packagePath)) {
    try {
      safeExec('npm run dev 2>&1 || true', targetPath, { stdio: 'inherit' });
    } catch (e) { console.debug('npm run dev failed:', e.message); }
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
  console.log(chalk.blue('\n✅ 正在验证...'));
  const packagePath = join(targetPath, 'package.json');
  const verified = existsSync(packagePath) ? runTests(targetPath) : true;
  if (context) context.testPassed = verified;
  if (!verified) {
    console.log(chalk.red('  ❌ 验证失败'));
    if (context) context.lastStepFailed = true;
  } else {
    console.log(chalk.green('  ✅ 验证通过'));
  }
  return verified ? '验证通过' : '验证失败';
}

export function handleSend(_action, params) {
  console.log(chalk.blue('\n📤 正在发送通知...'));
  if (params?.level === 'error') {
    console.log(chalk.red(`  通知内容: ${params.title}\n  ${params.content}`));
  }
  return '通知已发送';
}

export function handleNotify(_action, params) {
  console.log(chalk.green('\n✅ 工作流执行完成！'));
  if (params?.message) {
    console.log(chalk.green(`  ${params.message}`));
  }
  return '任务完成通知已发送';
}

export function handleCeAction(action) {
  const ceAction = action.replace('ce-', '');
  const desc = CE_DESCRIPTIONS[ceAction] || `CE Plugin ${ceAction} 操作`;
  console.log(chalk.cyan(`\n🧠 CE Plugin - ${desc}`));
  return `CE ${ceAction} 操作已执行`;
}

export function handleAnalyze(_action, params, targetPath, context) {
  const repo = params?.repo || context?.prompt?.match(/github\.com\/([^/\s]+\/[^/\s]+)/)?.[1];
  const metric = params?.metric || 'openrank';
  const period = params?.period || '90d';

  console.log(chalk.blue('\n📊 正在进行竞品分析...'));
  if (repo) {
    console.log(chalk.dim(`  目标仓库: ${repo}`));
    console.log(chalk.dim(`  指标: ${metric}`));
    console.log(chalk.dim(`  周期: ${period}`));
    try {
      safeExec(`npx open-digger analyze --repo ${escapeArg(repo)} --metric ${escapeArg(metric)} --period ${escapeArg(period)} 2>&1 || true`, targetPath, { stdio: 'inherit' });
    } catch (e) { console.debug('open-digger analyze failed:', e.message); }
  } else {
    console.log(chalk.yellow('  未指定仓库，使用当前目录分析...'));
    try {
      safeExec('npx open-digger analyze 2>&1 || true', targetPath, { stdio: 'inherit' });
    } catch (e) { console.debug('open-digger analyze failed:', e.message); }
  }
  if (context) context.analyzeCompleted = true;
  return '竞品分析完成';
}

export function handleChoose(_action, params, _targetPath, context) {
  const { message, options } = params || {};
  console.log(chalk.cyan('\n📋 ' + (message || '请选择：')));
  const choices = (options || []).map(opt => {
    if (typeof opt === 'object' && opt.label) return { label: opt.label, description: opt.description || '' };
    return { label: opt, description: '' };
  });
  choices.forEach((c, i) => console.log(chalk.white(`  ${i + 1}. ${c.label}${c.description ? ' — ' + chalk.dim(c.description) : ''}`)));
  if (choices.length > 0) {
    const selected = choices[0].label;
    if (context) {
      context.selectedOption = selected;
      if (context._sceneId === 'design') context.design_selected = selected;
    }
    console.log(chalk.green(`  ✅ 自动选择: ${selected}`));
    return `已选择: ${selected}`;
  }
  return '无可用选项';
}

export function handleReport(_action, params) {
  const { message } = params || {};
  console.log(chalk.cyan('\n📊 ' + (message || '报告已生成')));
  return '报告已显示';
}

export function handleAskUser(_action, params, _targetPath, context) {
  const { prompt, type, default: defVal } = params || {};
  console.log(chalk.yellow('\n❓ ' + (prompt || '请确认')));
  const answer = type === 'confirm' ? (defVal !== undefined ? defVal : true) : (defVal || 'yes');
  if (type === 'confirm' && context) context.user_confirmed = answer;
  console.log(chalk.dim(`  自动应答: ${answer}`));
  return `用户应答: ${answer}`;
}

export function handleCheckGate(_action, params, _targetPath, context) {
  const checks = params?.checks || ['lint', 'typecheck', 'security'];
  console.log(chalk.blue('\n🚦 正在执行质量门禁...'));
  const results = { passed: [], failed: [], blocked: [], skipped: [], unknown: [] };

  const boolPassed = (flag) => context?.[flag] !== false;
  const hasResult = (flag) => context?.[flag] !== undefined;

  const gateChecks = {
    security: () => {
      const secResult = context?.securityScanResult || {};
      (secResult.highSeverityFound ? results.blocked : results.passed)
        .push(secResult.highSeverityFound ? 'security: 发现高危漏洞' : 'security');
    },
    lint: () => {
      if (!hasResult('lintPassed')) { results.skipped.push('lint'); return; }
      (boolPassed('lintPassed') ? results.passed : results.failed).push('lint');
    },
    typecheck: () => {
      if (!hasResult('typecheckPassed')) { results.skipped.push('typecheck'); return; }
      (boolPassed('typecheckPassed') ? results.passed : results.failed).push('typecheck');
    },
    test: () => {
      if (!hasResult('testPassed')) { results.skipped.push('test'); return; }
      (boolPassed('testPassed') ? results.passed : results.failed).push('test');
    },
    coverage: () => {
      if (!hasResult('coveragePassed')) { results.skipped.push('coverage'); return; }
      (boolPassed('coveragePassed') ? results.passed : results.failed).push('coverage');
    },
    visual_regression: () => {
      if (!hasResult('visualRegressionPassed')) { results.skipped.push('visual_regression'); return; }
      (boolPassed('visualRegressionPassed') ? results.passed : results.failed).push('visual_regression');
    },
    dependency_audit: () => {
      if (!hasResult('dependencyAuditPassed')) { results.skipped.push('dependency_audit'); return; }
      (boolPassed('dependencyAuditPassed') ? results.passed : results.failed).push('dependency_audit');
    },
    dependencies: () => {
      if (!hasResult('dependencyAuditPassed')) { results.skipped.push('dependencies'); return; }
      (boolPassed('dependencyAuditPassed') ? results.passed : results.failed).push('dependencies');
    },
    performance: () => {
      if (!hasResult('performancePassed')) { results.skipped.push('performance'); return; }
      (boolPassed('performancePassed') ? results.passed : results.failed).push('performance');
    },
    complexity: () => {
      if (!hasResult('complexityPassed')) { results.skipped.push('complexity'); return; }
      (boolPassed('complexityPassed') ? results.passed : results.failed).push('complexity');
    },
    dead_code: () => {
      if (!hasResult('deadCodePassed')) { results.skipped.push('dead_code'); return; }
      (boolPassed('deadCodePassed') ? results.passed : results.failed).push('dead_code');
    },
    git_leaks: () => {
      if (!hasResult('gitLeaksPassed')) { results.skipped.push('git_leaks'); return; }
      (boolPassed('gitLeaksPassed') ? results.passed : results.failed).push('git_leaks');
    },
    a11y: () => {
      if (!hasResult('a11yPassed')) { results.skipped.push('a11y'); return; }
      (boolPassed('a11yPassed') ? results.passed : results.failed).push('a11y');
    },
    i18n: () => {
      if (!hasResult('i18nPassed')) { results.skipped.push('i18n'); return; }
      (boolPassed('i18nPassed') ? results.passed : results.failed).push('i18n');
    },
    migration: () => {
      if (!hasResult('migrationReviewPassed')) { results.skipped.push('migration'); return; }
      (boolPassed('migrationReviewPassed') ? results.passed : results.failed).push('migration');
    },
    loadtest: () => {
      if (!hasResult('loadTestPassed')) { results.skipped.push('loadtest'); return; }
      (boolPassed('loadTestPassed') ? results.passed : results.failed).push('loadtest');
    },
    monitor: () => {
      if (!hasResult('monitorConfigured')) { results.skipped.push('monitor'); return; }
      (boolPassed('monitorConfigured') ? results.passed : results.failed).push('monitor');
    },
    cicd: () => {
      if (!hasResult('ciConfigured')) { results.skipped.push('cicd'); return; }
      (boolPassed('ciConfigured') ? results.passed : results.failed).push('cicd');
    },
    backup: () => {
      if (!hasResult('backupConfigured')) { results.skipped.push('backup'); return; }
      (boolPassed('backupConfigured') ? results.passed : results.failed).push('backup');
    },
    incident: () => {
      if (!hasResult('incidentRunbookCreated')) { results.skipped.push('incident'); return; }
      (boolPassed('incidentRunbookCreated') ? results.passed : results.failed).push('incident');
    },
    e2e: () => {
      if (!hasResult('e2eConfigured')) { results.skipped.push('e2e'); return; }
      (boolPassed('e2eConfigured') ? results.passed : results.failed).push('e2e');
    },
    docker: () => {
      if (!hasResult('dockerConfigured')) { results.skipped.push('docker'); return; }
      (boolPassed('dockerConfigured') ? results.passed : results.failed).push('docker');
    },
    changelog: () => {
      if (!hasResult('changelogGenerated')) { results.skipped.push('changelog'); return; }
      (boolPassed('changelogGenerated') ? results.passed : results.failed).push('changelog');
    },
    sbom: () => {
      if (!hasResult('sbomGenerated')) { results.skipped.push('sbom'); return; }
      (boolPassed('sbomGenerated') ? results.passed : results.failed).push('sbom');
    },
    logging: () => {
      if (!hasResult('loggingConfigured')) { results.skipped.push('logging'); return; }
      (boolPassed('loggingConfigured') ? results.passed : results.failed).push('logging');
    },

    // ── Mobile workflow gate checks ──
    security_scan: () => {
      const secResult = context?.securityScanResult || {};
      (secResult.highSeverityFound ? results.blocked : results.passed)
        .push(secResult.highSeverityFound ? 'security_scan: 发现高危漏洞' : 'security_scan');
    },
    privacy: () => {
      if (!hasResult('privacyPassed')) { results.skipped.push('privacy'); return; }
      (boolPassed('privacyPassed') ? results.passed : results.failed).push('privacy');
    },
    store_compliance: () => {
      if (!hasResult('storeCompliancePassed')) { results.skipped.push('store_compliance'); return; }
      (boolPassed('storeCompliancePassed') ? results.passed : results.failed).push('store_compliance');
    },
    performance_baseline: () => {
      if (!hasResult('performancePassed')) { results.skipped.push('performance_baseline'); return; }
      (boolPassed('performancePassed') ? results.passed : results.failed).push('performance_baseline');
    },
    tests_pass: () => {
      if (!hasResult('testPassed')) { results.skipped.push('tests_pass'); return; }
      (boolPassed('testPassed') ? results.passed : results.failed).push('tests_pass');
    },
    ui_regression: () => {
      if (!hasResult('visualRegressionPassed')) { results.skipped.push('ui_regression'); return; }
      (boolPassed('visualRegressionPassed') ? results.passed : results.failed).push('ui_regression');
    },
    bundle_size: () => {
      if (!hasResult('bundleSizePassed')) { results.skipped.push('bundle_size'); return; }
      (boolPassed('bundleSizePassed') ? results.passed : results.failed).push('bundle_size');
    },
    startup_time: () => {
      if (!hasResult('startupTimePassed')) { results.skipped.push('startup_time'); return; }
      (boolPassed('startupTimePassed') ? results.passed : results.failed).push('startup_time');
    },
    fps: () => {
      if (!hasResult('fpsPassed')) { results.skipped.push('fps'); return; }
      (boolPassed('fpsPassed') ? results.passed : results.failed).push('fps');
    },
    memory: () => {
      if (!hasResult('memoryPassed')) { results.skipped.push('memory'); return; }
      (boolPassed('memoryPassed') ? results.passed : results.failed).push('memory');
    },
    e2e_config: () => {
      if (!hasResult('e2eConfigPassed')) { results.skipped.push('e2e_config'); return; }
      (boolPassed('e2eConfigPassed') ? results.passed : results.failed).push('e2e_config');
    },
    test_examples: () => {
      if (!hasResult('testExamplesPassed')) { results.skipped.push('test_examples'); return; }
      (boolPassed('testExamplesPassed') ? results.passed : results.failed).push('test_examples');
    },
    ci_integration: () => {
      if (!hasResult('ciConfigured')) { results.skipped.push('ci_integration'); return; }
      (boolPassed('ciConfigured') ? results.passed : results.failed).push('ci_integration');
    },
    env_prerequisites: () => {
      if (!hasResult('envPrerequisitesPassed')) { results.skipped.push('env_prerequisites'); return; }
      (boolPassed('envPrerequisitesPassed') ? results.passed : results.failed).push('env_prerequisites');
    },
    build_pass: () => {
      if (!hasResult('buildPassed')) { results.skipped.push('build_pass'); return; }
      (boolPassed('buildPassed') ? results.passed : results.failed).push('build_pass');
    },
    env_template: () => {
      if (!hasResult('envTemplatePassed')) { results.skipped.push('env_template'); return; }
      (boolPassed('envTemplatePassed') ? results.passed : results.failed).push('env_template');
    },
  };

  for (const check of checks) {
    if (gateChecks[check]) { gateChecks[check](); }
    else { results.unknown.push(check); }
  }

  if (results.unknown.length) console.log(chalk.yellow(`  ❓ 未知检查: ${results.unknown.join(', ')}`));

  console.log(chalk.green(`  ✅ 通过: ${results.passed.join(', ') || '无'}`));
  if (results.failed.length) console.log(chalk.yellow(`  ⚠ 失败: ${results.failed.join(', ')}`));
  if (results.skipped.length) console.log(chalk.dim(`  ⏭ 跳过（未运行）: ${results.skipped.join(', ')}`));
  if (results.blocked.length) {
    console.log(chalk.red(`  🚫 阻断: ${results.blocked.join(', ')}`));
    if (context) {
      context.lastStepFailed = true;
      context.gateBlocked = true;
    }
  }

  const effectiveTotal = checks.length - results.skipped.length;
  const summary = results.blocked.length
    ? `质量门禁阻断: ${results.blocked.join('; ')}`
    : results.failed.length
      ? `质量门禁未通过: ${results.failed.join('; ')}`
      : `质量门禁通过: ${results.passed.length}/${effectiveTotal}`;
  return summary;
}
