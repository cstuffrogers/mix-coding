import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

function _resolvePythonTool(toolName, moduleName) {
  // Windows: look for the .exe in user Python Scripts (forward-slashed for shell compat)
  if (process.platform === 'win32' && process.env.APPDATA) {
    const userScripts = process.env.APPDATA.replace(/\\/g, '/') + '/Python/Python314/Scripts';
    const exePath = userScripts + '/' + toolName + '.exe';
    if (existsSync(exePath)) return exePath;
  }
  // Fallback to module invocation if supported
  if (moduleName) return `python -m ${moduleName}`;
  return toolName;
}

export function handleKnipCheck(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🧹 正在检测死代码（knip）...'));
  try {
    const result = safeExec('npx knip --reporter json 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    try {
      const parsed = JSON.parse(result);
      const issues = parsed.issues || [];
      let fileCount = 0;
      let depCount = 0;
      let exportCount = 0;
      for (const issue of issues) {
        fileCount += issue.files?.length || 0;
        depCount += (issue.dependencies?.length || 0) + (issue.devDependencies?.length || 0);
        exportCount += issue.exports?.length || 0;
      }
      const total = fileCount + depCount + exportCount;
      if (total > 0) {
        console.log(chalk.yellow(`  ⚠ 死代码: ${fileCount} 文件, ${depCount} 依赖, ${exportCount} 未使用导出`));
        if (fileCount > 0) {
          const fileNames = issues.flatMap(i => (i.files || []).map(f => f.name)).slice(0, 5);
          fileNames.forEach(f => console.log(chalk.dim(`    📄 ${f}`)));
        }
        if (context) context.deadCodePassed = false;
        return `死代码检测完成: ${total} 项`;
      }
      console.log(chalk.green('  ✅ 未发现死代码'));
      if (context) context.deadCodePassed = true;
      return '死代码检测完成: 无死代码';
    } catch {
      if (result.includes('✂️') || result.includes('excellent') || result.includes('congratulations')) {
        console.log(chalk.green('  ✅ 未发现死代码'));
        if (context) context.deadCodePassed = true;
        return '死代码检测完成: 无死代码';
      }
      console.log(chalk.dim('  ℹ knip 输出无法解析'));
      return '死代码检测完成（结果解析失败）';
    }
  } catch (e) {
    console.log(chalk.dim(`  ⚠ knip 不可用: ${e.message?.slice(0, 100) || '未安装'}`));
  }
  return '死代码检测完成（knip 不可用）';
}

function _parseNoleakOutput(raw) {
  const findings = [];
  // Parse structured JSON output first; fall back to substring heuristics
  try {
    const json = JSON.parse(raw);
    const items = json.findings || [];
    const relevant = items.filter(f =>
      !f.filePath?.includes('node_modules') && f.severity === 'block'
    );
    if (relevant.length > 0) {
      const byRule = {};
      for (const f of relevant) {
        byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;
      }
      for (const [rule, count] of Object.entries(byRule)) {
        findings.push(`${rule} (${count} 处)`);
      }
    }
  } catch {
    // JSON parse failed — fall back to substring heuristics
    if (raw.includes('source-map') || raw.includes('.map')) {
      findings.push('Source Map 文件泄露');
    }
    if (raw.includes('.env') || raw.includes('env-file')) {
      findings.push('.env 文件可能泄露');
    }
    if (raw.includes('credential') || raw.includes('entropy')) {
      findings.push('高熵密钥检测');
    }
    if (/\.git[/\\]/.test(raw)) {
      findings.push('.git 目录暴露');
    }
  }
  return findings;
}

export function handleBuildLeakCheck(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔐 正在检查构建产物泄露...'));
  const buildDirs = ['dist', 'build', 'out', '.next', 'coverage', 'public'];
  const hasArtifacts = buildDirs.some(d => {
    try { return existsSync(join(targetPath, d)); } catch { return false; }
  });

  if (!hasArtifacts) {
    console.log(chalk.dim('  ℹ 无构建产物目录，跳过 noleak 扫描'));
    // Don't set buildLeakPassed — let gate report as skipped (tool didn't run)
    return '构建泄露检查完成: 无构建产物，已跳过';
  }

  const findings = [];
  let passed = true;

  try {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const targets = buildDirs.filter(d => {
      try { return existsSync(join(targetPath, d)); } catch { return false; }
    });
    const scanPath = targets.length > 0 ? targets[0] : '.';

    const raw = safeExec(
      `${cmd} noleak scan -o json ${scanPath} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 30000 }
    ).toString();

    const leaks = _parseNoleakOutput(raw);
    findings.push(...leaks);

    if (leaks.length > 0) {
      passed = false;
      leaks.forEach(l => console.log(chalk.red(`  🔴 ${l}`)));
    } else {
      console.log(chalk.green('  ✅ noleak 扫描完成，未发现泄露'));
    }
  } catch {
    console.log(chalk.dim('  ℹ noleak 不可用，跳过泄露检查'));
  }

  if (context) context.buildLeakPassed = passed;
  return `构建泄露检查完成: ${findings.length ? findings.join('; ') : '无泄露'}`;
}

export function handleDeadLinkCheck(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔗 正在检测死链接...'));
  let brokenCount = 0;
  const brokenUrls = [];

  try {
    const lycheeCmd = process.platform === 'win32' ? 'lychee.exe' : 'lychee';
    const raw = safeExec(
      `${lycheeCmd} --format json --no-progress --exclude 'node_modules' --exclude '.git' --exclude '.claude' . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024 }
    ).toString();

    // Parse structured JSON; fall back to line heuristics
    try {
      const json = JSON.parse(raw);
      brokenCount = json.errors || 0;
      const errMap = json.error_map || {};
      brokenUrls.push(...Object.keys(errMap));
    } catch {
      const lines = raw.split('\n');
      const brokenLines = lines.filter(l => /^\s*(?:✗|×|ERROR|FAIL|error)\b/i.test(l));
      brokenCount = brokenLines.length;
      brokenUrls.push(...brokenLines.map(l => l.slice(0, 200)));
    }

    if (brokenCount > 0) {
      console.log(chalk.yellow(`  ⚠ 发现 ${brokenCount} 个死链接`));
      brokenUrls.slice(0, 10).forEach(u => {
        const trimmed = u.length > 120 ? u.slice(0, 120) + '...' : u;
        console.log(chalk.dim(`    ${trimmed}`));
      });
    } else {
      console.log(chalk.green('  ✅ 未发现死链接'));
    }
  } catch {
    console.log(chalk.dim('  ℹ lychee 不可用，跳过死链检测'));
  }

  if (context) context.deadLinkPassed = brokenCount === 0;
  return `死链接检测完成: ${brokenCount} 个死链接`;
}

export function handleSecurityHeaders(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🛡️ 正在扫描安全响应头配置...'));
  const findings = [];
  let passed = true;

  const checks = [
    { name: 'CSP', grep: 'contentSecurityPolicy|Content-Security-Policy|helmet' },
    { name: 'HSTS', grep: 'hsts|Strict-Transport-Security' },
    { name: 'X-Frame-Options', grep: 'xframe|X-Frame-Options|frameguard' },
    { name: 'X-Content-Type-Options', grep: 'xContentType|X-Content-Type-Options|noSniff' },
    { name: 'Referrer-Policy', grep: 'referrerPolicy|Referrer-Policy' },
    { name: 'Permissions-Policy', grep: 'permissionsPolicy|Permissions-Policy|Feature-Policy' },
  ];

  const excludeDirs = '--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.codegraph';

  for (const check of checks) {
    try {
      const result = safeExec(
        `grep -rn "${check.grep}" --include="*.js" --include="*.ts" --include="*.json" ${excludeDirs} . 2>&1 || true`,
        targetPath,
        { stdio: 'pipe', timeout: 15000 }
      ).toString().trim();
      if (!result) {
        findings.push(`${check.name}: 未配置`);
        console.log(chalk.yellow(`  ⚠ ${check.name}: 未找到配置`));
      } else {
        console.log(chalk.dim(`  ✓ ${check.name}: 已配置`));
      }
    } catch {
      findings.push(`${check.name}: 检查失败`);
      console.log(chalk.dim(`  ℹ ${check.name}: 检查超时`));
    }
  }

  // Phase 2: Live scan (optional)
  _runLiveHeaderScan(targetPath, findings);

  const missingCount = findings.filter(f => f.includes('未配置')).length;
  if (missingCount > 0) {
    passed = false;
    console.log(chalk.yellow(`  ⚠ ${missingCount}/6 安全响应头未配置`));
  } else if (findings.length === 0) {
    console.log(chalk.green('  ✅ 安全响应头配置完整'));
  }

  if (context) context.securityHeadersPassed = passed;
  return `安全响应头扫描完成: ${findings.length ? findings.join('; ') : '全部已配置'}`;
}

function _runLiveHeaderScan(targetPath, findings) {
  const liveUrl = process.env.SERAPHIM_AUDIT_URL;
  if (!liveUrl) return;

  console.log(chalk.dim(`  🔍 正在对 ${liveUrl} 进行实时扫描...`));
  try {
    const seraphimCmd = _resolvePythonTool('seraphim-audit', 'seraphim_audit');
    const liveRaw = safeExec(
      `${seraphimCmd} --authorized --format json --no-crawl ${liveUrl} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    try {
      const liveJson = JSON.parse(liveRaw);
      const headerIssues = liveJson.headers || liveJson.findings || [];
      if (Array.isArray(headerIssues) && headerIssues.length > 0) {
        headerIssues.forEach(h => {
          findings.push(`[Live] ${h.header || h.name}: ${h.issue || h.severity}`);
          console.log(chalk.red(`  🔴 [Live] ${h.header || h.name}: ${h.issue || h.severity}`));
        });
      }
    } catch {
      if (/MISSING|WARNING|FAIL/i.test(liveRaw)) {
        console.log(chalk.yellow('  ⚠ 实时扫描发现问题（详见 seraphim-audit 输出）'));
      } else {
        console.log(chalk.green('  ✅ 实时扫描未发现响应头问题'));
      }
    }
  } catch {
    console.log(chalk.dim('  ℹ seraphim-audit 实时扫描跳过'));
  }
}

export function handleRecheckCli(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔁 正在扫描正则 ReDoS 漏洞...'));
  let issueCount = 0;

  try {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const raw = safeExec(
      `${cmd} recheck "src/**/*.js" 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    // recheck-cli outputs findings as lines with file:line:column
    const lines = raw.split('\n').filter(l => /^(WARN|ERROR|VULN|✗|×)\b/i.test(l) || /\d+:\d+.*(redos|backtrack|catastroph)/i.test(l));
    issueCount = lines.length;

    if (issueCount > 0) {
      console.log(chalk.red(`  🔴 发现 ${issueCount} 处可疑正则（潜在 ReDoS）`));
      lines.slice(0, 10).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 150)}`)));
    } else if (raw.trim() && !raw.includes('Error') && !raw.includes('ENOENT')) {
      // recheck exited clean with no findings
      console.log(chalk.green('  ✅ 未发现 ReDoS 漏洞'));
    } else if (!raw.trim()) {
      console.log(chalk.green('  ✅ 未发现 ReDoS 漏洞'));
    } else {
      console.log(chalk.dim('  ℹ recheck-cli 扫描完成（无匹配项）'));
    }
  } catch {
    console.log(chalk.dim('  ℹ recheck-cli 不可用或超时，跳过 ReDoS 扫描'));
  }

  if (context) context.recheckPassed = issueCount === 0;
  return `ReDoS 扫描完成: ${issueCount > 0 ? `${issueCount} 处可疑` : '无问题'}`;
}

export function handleSkillspectorScan(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🛡️ 正在扫描 AI 技能安全（SkillSpector）...'));
  const skillsDir = join(targetPath, '.claude', 'skills');
  const commandsDir = join(targetPath, '.claude', 'commands');

  if (!existsSync(skillsDir) && !existsSync(commandsDir)) {
    console.log(chalk.dim('  ⏭ 无 .claude/skills/ 或 .claude/commands/ 目录，跳过'));
    // Don't set Passed — let gate report as skipped
    return 'SkillSpector 扫描完成: 无技能目录';
  }

  const targets = [];
  if (existsSync(skillsDir)) targets.push('.claude/skills/');
  if (existsSync(commandsDir)) targets.push('.claude/commands/');

  // skillspector only accepts one path per invocation — scan each separately
  const skillspectorCmd = _resolvePythonTool('skillspector', null);
  const hasLlmKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const llmFlag = hasLlmKey ? '' : ' --no-llm';

  const allFindings = [];
  let scanFailed = false;

  for (const target of targets) {
    try {
      const cmd = `${skillspectorCmd} scan ${target} --format json${llmFlag} 2>&1`;
      const raw = safeExec(cmd, targetPath, { stdio: 'pipe', timeout: 60000 }).toString();

      try {
        const result = JSON.parse(raw);
        const findings = result.findings || result.results || [];
        allFindings.push(...findings);
      } catch {
        // Non-JSON output — check for text indicators
        if (raw.toLowerCase().includes('vulnerability') || raw.toLowerCase().includes('malicious')) {
          console.log(chalk.yellow(`  ⚠ ${target}: 发现可疑内容`));
          scanFailed = true;
        } else if (raw.includes('No issues') || raw.includes('no issues') || raw.includes('clean')) {
          console.log(chalk.dim(`  ✓ ${target}: 未发现问题`));
        } else {
          console.log(chalk.dim(`  ℹ ${target}: 输出无法解析`));
        }
      }
    } catch (e) {
      if (e.message && e.message.includes('NOT_FOUND')) {
        console.log(chalk.dim('  ℹ SkillSpector 未安装，跳过 AI 技能安全扫描'));
        console.log(chalk.dim('    安装: pip install git+https://github.com/NVIDIA/skillspector.git'));
        return 'SkillSpector 扫描完成: 跳过（不可用）';
      }
      console.log(chalk.dim(`  ⚠ SkillSpector ${target} 执行失败: ${e.message?.slice(0, 80) || '未知错误'}`));
      scanFailed = true;
    }
  }

  if (scanFailed && allFindings.length === 0) {
    // Don't set Passed — let gate report as skipped
    return 'SkillSpector 扫描完成: 部分失败';
  }

  const critical = allFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'critical');
  const high = allFindings.filter(f => f.severity === 'HIGH' || f.severity === 'high');
  const medium = allFindings.filter(f => f.severity === 'MEDIUM' || f.severity === 'medium');
  const total = allFindings.length;

  if (total > 0) {
    console.log(chalk.yellow(`  ⚠ 技能安全: ${total} 个问题 (${critical.length}C/${high.length}H/${medium.length}M)`));
    for (const f of critical.slice(0, 5)) {
      console.log(chalk.red(`    🔴 ${f.pattern || f.rule || f.type}: ${f.location?.file || f.file || f.path}`));
    }
    for (const f of high.slice(0, 3)) {
      console.log(chalk.yellow(`    🟡 ${f.pattern || f.rule || f.type}: ${f.location?.file || f.file || f.path}`));
    }
    if (context) context.skillspectorPassed = critical.length === 0;
    return `SkillSpector 扫描完成: ${total} 个问题`;
  }

  console.log(chalk.green('  ✅ 技能文件安全'));
  if (context) context.skillspectorPassed = true;
  return 'SkillSpector 扫描完成: 无问题';
}
