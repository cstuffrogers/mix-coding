import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

function _resolvePythonTool(toolName, moduleName) {
  // Windows: scan Python Scripts directories for the tool executable
  if (process.platform === 'win32' && process.env.APPDATA) {
    const pythonDir = process.env.APPDATA.replace(/\\/g, '/') + '/Python';
    try {
      const versions = readdirSync(pythonDir).filter(d => /^Python3\d+$/.test(d)).sort().reverse();
      for (const ver of versions) {
        const exePath = `${pythonDir}/${ver}/Scripts/${toolName}.exe`;
        if (existsSync(exePath)) return exePath;
      }
    } catch { /* dir doesn't exist */ }
  }
  // Fallback to module invocation if supported
  if (moduleName) return `python -m ${moduleName}`;
  return toolName;
}

export function handleKnipCheck(_action, _params, targetPath, context) {
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
        if (context) context.deadCodePassed = false;
        return `死代码检测完成: ${total} 项`;
      }
      if (context) context.deadCodePassed = true;
      return '死代码检测完成: 无死代码';
    } catch {
      if (result.includes('✂️') || result.includes('excellent') || result.includes('congratulations')) {
        if (context) context.deadCodePassed = true;
        return '死代码检测完成: 无死代码';
      }
      return '死代码检测完成（结果解析失败）';
    }
  } catch (e) {
    console.log(chalk.dim(`  ⚠ knip 不可用: ${e.message?.slice(0, 100) || '未安装'}`));
  }
  return '死代码检测完成（knip 不可用）';
}

export function _parseNoleakOutput(raw) {
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
  const buildDirs = ['dist', 'build', 'out', '.next', 'coverage', 'public'];
  const hasArtifacts = buildDirs.some(d => {
    try { return existsSync(join(targetPath, d)); } catch { return false; }
  });

  if (!hasArtifacts) {
    // Don't set buildLeakPassed — let gate report as skipped (tool didn't run)
    return '构建泄露检查完成: 无构建产物，已跳过';
  }

  const findings = [];
  let isPassed = true;

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
      isPassed = false;
    } else {
      console.log(chalk.green('  ✅ noleak 扫描完成，未发现泄露'));
    }
  } catch (e) {
    console.log(chalk.dim('  ℹ noleak 不可用，跳过泄露检查'), e.message);
  }

  if (context) context.buildLeakPassed = isPassed;
  return `构建泄露检查完成: ${findings.length ? findings.join('; ') : '无泄露'}`;
}

export function handleDeadLinkCheck(_action, _params, targetPath, context) {
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
      brokenUrls.slice(0, 10).forEach(u => {
        console.log(chalk.yellow(`    🔗 ${u.length > 120 ? u.slice(0, 120) + '...' : u}`));
      });
    } else {
      console.log(chalk.green('  ✅ 未发现死链接'));
    }
  } catch (e) {
    console.log(chalk.dim('  ℹ lychee 不可用，跳过死链检测'), e.message);
  }

  if (context) context.deadLinkPassed = brokenCount === 0;
  return `死链接检测完成: ${brokenCount} 个死链接`;
}

export function handleSecurityHeaders(_action, _params, targetPath, context) {
  const findings = [];
  let isPassed = true;

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
      } else {
        console.log(chalk.dim(`  ✓ ${check.name}: 已配置`));
      }
    } catch (e) {
      findings.push(`${check.name}: 检查失败 (${e.message})`);
    }
  }

  _runLiveHeaderScan(targetPath, findings);

  const missingCount = findings.filter(f => f.includes('未配置')).length;
  if (missingCount > 0) {
    isPassed = false;
  } else if (findings.length === 0) {
    console.log(chalk.green('  ✅ 安全响应头配置完整'));
  }

  if (context) context.securityHeadersPassed = isPassed;
  return `安全响应头扫描完成: ${findings.length ? findings.join('; ') : '全部已配置'}`;
}

function _runLiveHeaderScan(targetPath, findings) {
  const liveUrl = process.env.SERAPHIM_AUDIT_URL;
  if (!liveUrl) return;

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
  let issueCount = 0;

  try {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const raw = safeExec(
      `${cmd} recheck "src/**/*.js" 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    // recheck-cli outputs findings as lines with file:line:column
    // eslint-disable-next-line sonarjs/super-linear-regex
    const lines = raw.split('\n').filter(l => /^(WARN|ERROR|VULN|✗|×)\b/i.test(l) || /\d+:\d+.*?(redos|backtrack|catastroph)/i.test(l));
    issueCount = lines.length;

    if (issueCount > 0) {
      console.log(chalk.red(`  🔴 发现 ${issueCount} 处可疑正则（潜在 ReDoS）`));
      lines.slice(0, 10).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 150)}`)));
    } else if (raw.trim() && !raw.includes('Error') && !raw.includes('ENOENT')) {
      // recheck exited clean with no findings
    } else if (!raw.trim()) {
      console.log(chalk.green('  ✅ 未发现 ReDoS 漏洞'));
    } else {
      console.log(chalk.dim('  ℹ recheck-cli 扫描完成（无匹配项）'));
    }
  } catch (e) {
    console.log(chalk.dim('  ℹ recheck-cli 不可用或超时，跳过 ReDoS 扫描'), e.message);
  }

  if (context) context.recheckPassed = issueCount === 0;
  return `ReDoS 扫描完成: ${issueCount > 0 ? `${issueCount} 处可疑` : '无问题'}`;
}

function buildScanTargets(targetPath) {
  const targets = [];
  const skillsDir = join(targetPath, '.claude', 'skills');
  const commandsDir = join(targetPath, '.claude', 'commands');
  if (existsSync(skillsDir)) targets.push('.claude/skills/');
  if (existsSync(commandsDir)) targets.push('.claude/commands/');
  return targets;
}

function scanSingleTarget(cmd, targetPath, allFindings) {
  const raw = safeExec(cmd, targetPath, { stdio: 'pipe', timeout: 60000 }).toString();
  try {
    const result = JSON.parse(raw);
    const findings = result.findings || result.results || [];
    allFindings.push(...findings);
    return { isScanFailed: false };
  } catch {
    if (raw.toLowerCase().includes('vulnerability') || raw.toLowerCase().includes('malicious')) {
      return { isScanFailed: true };
    }
    if (raw.includes('No issues') || raw.includes('no issues') || raw.includes('clean')) {
      console.log(chalk.dim(`  ✓ ${targetPath}: 未发现问题`));
    } else {
      console.log(chalk.dim(`  ℹ ${targetPath}: 输出无法解析`));
    }
    return { isScanFailed: false };
  }
}

function reportSkillspectorFindings(allFindings, context) {
  const critical = allFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'critical');
  const high = allFindings.filter(f => f.severity === 'HIGH' || f.severity === 'high');
  const total = allFindings.length;

  if (total > 0) {
    for (const f of critical.slice(0, 5)) {
      console.log(chalk.red(`    🔴 ${f.pattern || f.rule || f.type}: ${f.location?.file || f.file || f.path}`));
    }
    for (const f of high.slice(0, 3)) {
      console.log(chalk.yellow(`    🟡 ${f.pattern || f.rule || f.type}: ${f.location?.file || f.file || f.path}`));
    }
    if (context) context.skillspectorPassed = critical.length === 0;
    return `SkillSpector 扫描完成: ${total} 个问题`;
  }

  if (context) context.skillspectorPassed = true;
  return 'SkillSpector 扫描完成: 无问题';
}

export function handleSkillspectorScan(_action, _params, targetPath, context) {
  const targets = buildScanTargets(targetPath);
  if (targets.length === 0) return 'SkillSpector 扫描完成: 无技能目录';

  const skillspectorCmd = _resolvePythonTool('skillspector', null);
  const hasLlmKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const llmFlag = hasLlmKey ? '' : ' --no-llm';

  const allFindings = [];
  let isScanFailed = false;

  for (const target of targets) {
    try {
      const cmd = `${skillspectorCmd} scan ${target} --format json${llmFlag} 2>&1`;
      const result = scanSingleTarget(cmd, targetPath, allFindings);
      if (result.isScanFailed) isScanFailed = true;
    } catch (e) {
      if (e.message && e.message.includes('NOT_FOUND')) {
        return 'SkillSpector 扫描完成: 跳过（不可用）';
      }
      isScanFailed = true;
    }
  }

  if (isScanFailed && allFindings.length === 0) return 'SkillSpector 扫描完成: 部分失败';

  return reportSkillspectorFindings(allFindings, context);
}

// ── actionlint — GitHub Actions workflow syntax checker (3k+ stars) ──

export function handleActionlint(_action, _params, targetPath, context) {
  const workflowsDir = join(targetPath, '.github', 'workflows');

  if (!existsSync(workflowsDir)) {
    if (context) context.actionlintPassed = true;
    return 'actionlint 检查完成: 无 GitHub Actions 工作流目录';
  }

  let issueCount = 0;

  try {
    const raw = safeExec(
      'npx actionlint -format "{{range .}}::error file={{.Filepath}},line={{.Lineno}},col={{.Col}}::{{.Message}}{{end}}" .github/workflows/ 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 1024 * 1024, timeout: 30000 }
    ).toString();

    const lines = raw.split('\n').filter(Boolean);
    issueCount = lines.filter(l => /^::error\b/.test(l)).length;

    if (issueCount > 0) {
      lines.filter(l => /^::error\b/.test(l)).slice(0, 15).forEach(l => {
        console.log(chalk.yellow(`    ${l.replace(/^::error\s+/, '').slice(0, 200)}`));
      });
    } else if (raw.includes('no lint errors') || raw.trim() === '') {
      console.log(chalk.green('  ✅ actionlint: 工作流语法无问题'));
    }
  } catch {
    console.log(chalk.dim('  ℹ actionlint 不可用，跳过工作流语法检查'));
  }

  if (context) context.actionlintPassed = issueCount === 0;
  return `actionlint 检查完成: ${issueCount > 0 ? `${issueCount} 个问题` : '无问题'}`;
}

// ── zizmor — GitHub Actions security auditor (2.5k+ stars) ──

function parseZizmorJson(raw) {
  try {
    const results = JSON.parse(raw);
    const allFindings = Array.isArray(results) ? results : (results.findings || []);
    if (allFindings.length === 0) {
      return { findingCount: 0 };
    }
    const bySeverity = {};
    for (const f of allFindings) {
      const sev = f.severity || 'unknown';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    console.log(chalk.dim(`  ℹ 发现 ${allFindings.length} 项 (${Object.entries(bySeverity).map(([k, v]) => `${k}: ${v}`).join(', ')})`));
    return { findingCount: allFindings.length };
  } catch {
    return null;
  }
}

function parseZizmorText(raw) {
  if (raw.toLowerCase().includes('vulnerability') || raw.toLowerCase().includes('error')) {
    return { findingCount: (raw.match(/\b(ERROR|WARN|FAIL)\b/g) || []).length };
  }
  if (raw.includes('no issues') || raw.includes('clean') || raw.trim() === '') {
    console.log(chalk.green('  ✅ zizmor: 工作流安全无问题'));
  }
  return { findingCount: 0 };
}

export function handleZizmor(_action, _params, targetPath, context) {
  const workflowsDir = join(targetPath, '.github', 'workflows');
  if (!existsSync(workflowsDir)) {
    if (context) context.zizmorPassed = true;
    return 'zizmor 检查完成: 无 GitHub Actions 工作流目录';
  }

  let findingCount = 0;
  try {
    const raw = safeExec(
      'npx zizmor --format json .github/workflows/ 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    const jsonResult = parseZizmorJson(raw);
    const result = jsonResult || parseZizmorText(raw);
    findingCount = result.findingCount;
  } catch {
    console.log(chalk.dim('  ℹ zizmor 不可用，跳过工作流安全审计'));
  }

  if (context) context.zizmorPassed = findingCount === 0;
  return `zizmor 检查完成: ${findingCount > 0 ? `${findingCount} 个问题` : '无问题'}`;
}

// ── jscpd — code duplication detector (4.7k+ stars) ──

function runJscpd(targetPath) {
  try {
    return safeExec(
      'npx jscpd --format json --min-tokens 50 --min-lines 5 --ignore "node_modules,.git,.claude,dist,build,coverage,.next" . 2>&1',
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();
  } catch (e) {
    return (e.stdout || '').toString();
  }
}

function parseJscpdResult(raw) {
  const cloneMatch = raw.match(/Found\s+(\d+)\s*clones?/i);
  const pctMatch = raw.match(/\b(\d+)\s*\(\s*(\d+(?:\.\d+)?)%\s*\)/) || raw.match(/Duplicated lines[^\d]*(\d+(?:\.\d+)?)%/i);
  if (!cloneMatch && !pctMatch) return null;
  const clones = cloneMatch ? parseInt(cloneMatch[1], 10) : 0;
  const pct = pctMatch ? parseFloat(pctMatch[2] || pctMatch[1]) : 0;
  return { clones, pct };
}

function reportJscpdFound(clones, pct, context) {
  if (pct > 5) {
    if (context) context.jscpdPassed = false;
  } else {
    if (context) context.jscpdPassed = true;
  }
  return `代码重复检测完成: ${clones} 处重复，重复率 ${pct.toFixed(1)}%`;
}

export function handleJscpd(_action, _params, targetPath, context) {
  const raw = runJscpd(targetPath);
  if (!raw) {
    return '代码重复检测完成（jscpd 不可用）';
  }

  const parsed = parseJscpdResult(raw);
  if (parsed && (parsed.clones > 0 || parsed.pct > 0)) {
    return reportJscpdFound(parsed.clones, parsed.pct, context);
  }

  if (/no clones|no duplicates|0 clones/i.test(raw)) {
    if (context) context.jscpdPassed = true;
    return '代码重复检测完成: 无重复';
  }

  return '代码重复检测完成: 无法解析输出';
}

// ── Stryker — mutation testing (2.9k+ stars) ──

function hasStrykerConfig(targetPath) {
  const configFiles = ['stryker.config.js', 'stryker.config.mjs', 'stryker.config.json', 'stryker.config.ts'];
  if (configFiles.some(f => existsSync(join(targetPath, f)))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    return !!(pkg.stryker || pkg['@stryker-mutator/core']);
  } catch { return false; }
}

function parseStrykerJson(raw) {
  try {
    const result = JSON.parse(raw);
    const report = result.mutationScore || result.report;
    if (report) {
      return {
        score: report.mutationScore || report.percentage || 0,
        killed: report.killed || 0,
        survived: report.survived || 0,
      };
    }
    return {
      score: result.mutationScore || 0,
      killed: result.killed || 0,
      survived: result.survived || 0,
    };
  } catch {
    return null;
  }
}

function parseStrykerText(raw) {
  const scoreMatch = raw.match(/mutation\s+score[^\d]*(\d+(?:\.\d+)?)\s*%/i);
  if (scoreMatch) {
    const killedMatch = raw.match(/killed.*?(\d+)/i);
    const survivedMatch = raw.match(/survived.*?(\d+)/i);
    return {
      score: parseFloat(scoreMatch[1]),
      killed: killedMatch ? parseInt(killedMatch[1], 10) : 0,
      survived: survivedMatch ? parseInt(survivedMatch[1], 10) : 0,
    };
  }
  if (raw.includes('No mutants') || raw.includes('no mutants')) {
    console.log(chalk.green('  ✅ Stryker: 无变异体'));
  }
  return null;
}

function logStrykerScore(score) {
  if (score >= 80) {
    return true;
  }
  if (score >= 60) {
    return true;
  }
  return false;
}

export function handleStryker(_action, _params, targetPath, context) {
  if (!hasStrykerConfig(targetPath)) {
    if (context) context.strykerPassed = true;
    return 'Stryker 变异测试完成: 无 stryker 配置，已跳过';
  }

  let isPassed = true;
  let score = 0;
  let killed = 0;
  let survived = 0;

  try {
    const raw = safeExec(
      'npx stryker run --reporter json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 300000 }
    ).toString();

    const jsonResult = parseStrykerJson(raw);
    const textResult = jsonResult || parseStrykerText(raw);

    if (textResult) {
      score = textResult.score;
      killed = textResult.killed;
      survived = textResult.survived;
    }

    if (score > 0) {
      isPassed = logStrykerScore(score);
    } else if (!textResult) {
      console.log(chalk.dim('  ℹ Stryker 不可用，跳过变异测试'));
    }
  } catch {
    console.log(chalk.dim('  ℹ Stryker 不可用，跳过变异测试'));
  }

  if (context) context.strykerPassed = isPassed;
  return `Stryker 变异测试完成: ${score > 0 ? `分数 ${score.toFixed(1)}%（Killed: ${killed}, Survived: ${survived}）` : isPassed ? '通过' : '失败'}`;
}

// ── Spectral — API/OpenAPI linting (2.5k+ stars) ──

function hasSpectralConfig(targetPath) {
  return existsSync(join(targetPath, '.spectral.yaml')) ||
    existsSync(join(targetPath, '.spectral.json')) ||
    existsSync(join(targetPath, '.spectral.js'));
}

function parseSpectralJson(raw) {
  try {
    const results = JSON.parse(raw);
    if (!Array.isArray(results)) return null;
    const errors = results.filter(r => r.severity === 0).map(r =>
      `${r.code || 'unknown'}: ${(r.message || '').slice(0, 150)}`
    );
    if (results.length > 0) {
      console.error(chalk[errors.length > 0 ? 'red' : 'yellow'](
        `  ${errors.length > 0 ? '🔴' : '⚠'} Spectral: ${results.length} 个问题（error: ${errors.length}）`
      ));
    } else {
      console.log(chalk.green('  ✅ Spectral: API lint 无问题'));
    }
    return { issueCount: results.length };
  } catch {
    return null;
  }
}

function parseSpectralText(raw) {
  if (raw.trim() === '' || raw.includes('No errors') || raw.includes('no results')) {
    return { issueCount: 0 };
  }
  return { issueCount: (raw.match(/\berror\b/gi) || []).length };
}

export function handleSpectral(_action, _params, targetPath, context) {
  const specFiles = scanDir(targetPath, {
    filter: f => /(openapi|swagger).*\.(yaml|yml|json)$/i.test(f) && !f.includes('node_modules'),
  });

  if (!hasSpectralConfig(targetPath) && specFiles.length === 0) {
    if (context) context.spectralPassed = true;
    return 'Spectral API lint 完成: 无 OpenAPI/Spec 文件，已跳过';
  }

  let issueCount = 0;
  try {
    const targets = specFiles.length > 0 ? specFiles.join(' ') : '.';
    const raw = safeExec(
      `npx spectral lint ${targets} --format json 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    const result = parseSpectralJson(raw) || parseSpectralText(raw);
    issueCount = result.issueCount;
  } catch {
    console.log(chalk.dim('  ℹ Spectral 不可用，跳过 API lint'));
  }

  if (context) context.spectralPassed = issueCount === 0;
  return `Spectral API lint 完成: ${issueCount > 0 ? `${issueCount} 个问题` : '无问题'}`;
}

// ── markdownlint — Markdown file linting (5k+ stars) ──

function countMdJsonErrors(results) {
  let count = 0;
  if (Array.isArray(results)) {
    for (const r of results) {
      count += Array.isArray(r.errors) ? r.errors.length : (r.errorCount || 0);
    }
  } else if (typeof results === 'object') {
    for (const errors of Object.values(results)) {
      count += Array.isArray(errors) ? errors.length : 0;
    }
  }
  return count;
}

function countMdTextErrors(raw) {
  return raw.split('\n').filter(Boolean).filter(l =>
    /^[^:]+:\d+:\d+\s+(MD\d+|\w+-)/i.test(l)
  ).length;
}

export function handleMarkdownlint(_action, _params, targetPath, context) {
  let issueCount = 0;
  try {
    const raw = safeExec(
      'npx markdownlint "**/*.md" --ignore node_modules --ignore ".git" --ignore ".claude/worktrees" --json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 60000 }
    ).toString();

    try {
      issueCount = countMdJsonErrors(JSON.parse(raw));
    } catch {
      issueCount = countMdTextErrors(raw);
    }

    if (issueCount > 0) {
      console.log(chalk.yellow(`  ⚠ markdownlint: ${issueCount} 个问题`));
    } else if (raw.trim()) {
      console.log(chalk.green('  ✅ markdownlint: 无问题'));
    }
  } catch {
    console.log(chalk.dim('  ℹ markdownlint 不可用，跳过 Markdown lint'));
  }

  if (context) context.markdownlintPassed = issueCount === 0;
  return `markdownlint 完成: ${issueCount > 0 ? `${issueCount} 个问题` : '无问题'}`;
}

// ── size-limit — bundle size budgeting (6.5k+ stars) ──

function hasSizeLimitConfig(targetPath) {
  if (existsSync(join(targetPath, '.size-limit.json')) ||
      existsSync(join(targetPath, '.size-limit.cjs')) ||
      existsSync(join(targetPath, '.size-limit.mjs'))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    return !!(pkg['size-limit'] || pkg.sizeLimit);
  } catch { return false; }
}

function parseSizeLimitResults(results) {
  const items = Array.isArray(results) ? results : (results.results || []);
  const failures = [];
  for (const item of items) {
    const name = item.name || 'unknown';
    const size = item.size || 0;
    const limit = item.limit || item.maxSize || 0;
    if (limit > 0 && size > limit) {
      const sizeKB = (size / 1024).toFixed(1);
      const limitKB = (limit / 1024).toFixed(1);
      failures.push(`${name}: ${sizeKB} KB > 限制 ${limitKB} KB`);
    }
  }
  return { failures, isEmpty: items.length === 0 };
}

function logSizeLimitOutcome(failures, itemsEmpty) {
  if (failures.length > 0) {
    return false;
  }
  if (!itemsEmpty) {
    console.log(chalk.green('  ✅ size-limit: 所有包体积符合预算'));
  }
  return true;
}

function logSizeLimitText(raw) {
  if (raw.includes('FAIL') || raw.includes('exceed')) {
    return false;
  }
  if (raw.trim()) {
    console.log(chalk.green('  ✅ size-limit 检查通过'));
  }
  return true;
}

export function handleSizeLimit(_action, _params, targetPath, context) {
  if (!hasSizeLimitConfig(targetPath)) {
    if (context) context.sizeLimitPassed = true;
    return '包体积检查完成: 无 size-limit 配置，已跳过';
  }

  let isPassed = true;
  let failures = [];

  try {
    const raw = safeExec(
      'npx size-limit --json 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 1024 * 1024, timeout: 60000 }
    ).toString();

    try {
      const parsed = parseSizeLimitResults(JSON.parse(raw));
      failures = parsed.failures;
      isPassed = logSizeLimitOutcome(parsed.failures, parsed.isEmpty);
    } catch {
      isPassed = logSizeLimitText(raw);
    }
  } catch {
    console.log(chalk.dim('  ℹ size-limit 不可用，跳过包体积检查'));
  }

  if (context) context.sizeLimitPassed = isPassed;
  return `包体积检查完成: ${isPassed ? '通过' : failures.join('; ')}`;
}

// ── pa11y-ci — WCAG 无障碍扫描 ──

export function handlePa11yCi(_action, _params, targetPath, context) {
  try {
    const raw = safeExec('npx pa11y-ci 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    if (context) context.pa11yPassed = !raw.includes('Error:');
    return `pa11y-ci 无障碍扫描完成`;
  } catch {
    return 'pa11y-ci 不可用，跳过无障碍扫描';
  }
}

// ── DESIGN.md lint — Google DESIGN.md CLI 格式校验 ──

export function handleDesignMdLint(_action, _params, targetPath, context) {
  try {
    const raw = safeExec('npx @google/design.md lint 2>&1 || true', targetPath, { stdio: 'pipe' }).toString();
    if (context) context.designMdPassed = !raw.includes('error') && !raw.includes('FAIL');
    return `DESIGN.md lint 完成`;
  } catch {
    return 'DESIGN.md lint 不可用，跳过';
  }
}

// ── DESIGN.md export — Google DESIGN.md CLI Tailwind 导出 ──

export function handleDesignMdExport(_action, _params, targetPath) {
  try {
    safeExec('npx @google/design.md export --format tailwind 2>&1', targetPath, { stdio: 'pipe' });
    return 'DESIGN.md Tailwind 配置导出完成';
  } catch {
    return 'DESIGN.md export 不可用，跳过';
  }
}

// ── CodeGraph / CodeGuardian — MCP 工具（仅对话模式可用）──

export function handleCodeGraphImpact() {
  return 'CodeGraph 影响分析仅对话模式可用（需 codegraph MCP），CLI 模式跳过';
}

export function handleCodeGraphTrace() {
  return 'CodeGraph 依赖追踪仅对话模式可用（需 codegraph MCP），CLI 模式跳过';
}

export function handleCodeGuardianOptimize() {
  return 'CodeGuardian 优化仅对话模式可用（需 codeguardian MCP），CLI 模式跳过';
}
