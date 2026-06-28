import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── trivy — container / filesystem / IaC security scan ──

const TRIVY_SCANNERS = 'vuln,secret,misconfig';

export function handleTrivyScan(_action, _params, targetPath, context) {
  let criticalCount = 0;
  let highCount = 0;

  try {
    const raw = safeExec(
      `trivy fs --scanners ${TRIVY_SCANNERS} --severity HIGH,CRITICAL --no-progress --format table . 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 120000 }
    ).toString();

    const critMatch = raw.match(/CRITICAL:\s*(\d+)/i);
    const highMatch = raw.match(/HIGH:\s*(\d+)/i);
    criticalCount = critMatch ? parseInt(critMatch[1], 10) : 0;
    highCount = highMatch ? parseInt(highMatch[1], 10) : 0;
    const totalCount = criticalCount + highCount;

    if (totalCount > 0) {
      console.log(chalk.red(`  🔴 trivy: ${criticalCount} CRITICAL + ${highCount} HIGH`));
      const lines = raw.split('\n');
      const findingLines = lines.filter(l => /CRITICAL|HIGH/.test(l) && (l.includes('CVE-') || l.includes('AVD-')));
      findingLines.slice(0, 12).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 160)}`)));
    } else if (raw.includes('0 vulnerability') || raw.includes('No vulnerabilities')) {
      console.log(chalk.green('  ✅ trivy: 无 HIGH/CRITICAL 漏洞'));
    } else {
      console.log(chalk.green('  ✅ trivy: 扫描完成，无高危'));
    }
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('ENOENT'))) {
      console.log(chalk.dim('  ℹ trivy 未安装，跳过'));
      return 'trivy 扫描完成: 跳过（未安装）';
    }
    console.log(chalk.dim(`  ℹ trivy 扫描失败: ${e.message?.slice(0, 80)}`));
    return 'trivy 扫描完成: 跳过（执行失败）';
  }

  const total = criticalCount + highCount;
  if (context) {
    context.trivyHighCount = total;
    context.trivyCriticalCount = criticalCount;
    context.trivyPassed = total === 0;
  }
  return `trivy 扫描完成: ${total > 0 ? `${total} 个高危` : '无高危'}`;
}

// ── ShellCheck — shell script static analysis ──

export function handleShellCheck(_action, _params, targetPath, context) {
  let violationCount = 0;

  try {
    // Collect all shell scripts in the project
    const scripts = _findShellScripts(targetPath);
    if (scripts.length === 0) {
      console.log(chalk.dim('  ℹ ShellCheck: 未找到 shell 脚本'));
      if (context) context.shellCheckPassed = true;
      return 'ShellCheck 完成: 无 shell 脚本';
    }

    // Run shellcheck on all scripts at once
    const fileList = scripts.map(s => `"${s}"`).join(' ');
    const raw = safeExec(
      `shellcheck --format gcc ${fileList} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    const lines = raw.trim().split('\n').filter(Boolean);
    violationCount = lines.length;

    if (violationCount > 0) {
      console.log(chalk.yellow(`  🟡 ShellCheck: ${violationCount} 处问题`));
      lines.slice(0, 8).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 180)}`)));
    } else {
      console.log(chalk.green(`  ✅ ShellCheck: ${scripts.length} 个脚本全部通过`));
    }
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('ENOENT'))) {
      console.log(chalk.dim('  ℹ ShellCheck 未安装，跳过'));
      return 'ShellCheck 完成: 跳过（未安装）';
    }
    console.log(chalk.dim('  ℹ ShellCheck 不可用，跳过'));
    return 'ShellCheck 完成: 跳过（不可用）';
  }

  if (context) {
    context.shellCheckViolations = violationCount;
    context.shellCheckPassed = violationCount === 0;
  }
  return `ShellCheck 完成: ${violationCount > 0 ? `${violationCount} 处问题` : '通过'}`;
}

function _findShellScripts(rootDir) {
  const results = [];
  const excludeDirs = new Set(['node_modules', '.git', 'dist', 'coverage', '.next']);
  const shellExts = new Set(['.sh', '.bash', '.zsh']);

  function scan(dir, depth = 0) {
    if (depth > 4 || !existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!excludeDirs.has(entry.name)) scan(full, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (shellExts.has(ext)) {
            results.push(full);
          } else if (!ext) {
            // Check shebang for extensionless scripts
            try {
              const head = readFileSync(full, 'utf-8').slice(0, 50);
              if (/^#!.*\b(bash|sh|zsh)\b/.test(head)) results.push(full);
            } catch { /* binary file or permission */ }
          }
        }
      }
    } catch { /* permission */ }
  }

  scan(rootDir);
  return results;
}

// ── SQLFluff — SQL linter + formatter ──

export function handleSqlFluff(_action, _params, targetPath, context) {
  let violationCount = 0;

  try {
    // Find SQL migration files
    const sqlFiles = _findSqlFiles(targetPath);
    if (sqlFiles.length === 0) {
      console.log(chalk.dim('  ℹ SQLFluff: 未找到 SQL 文件'));
      if (context) context.sqlFluffPassed = true;
      return 'SQLFluff 完成: 无 SQL 文件';
    }

    const fileList = sqlFiles.map(f => `"${f}"`).join(' ');
    const raw = safeExec(
      `sqlfluff lint ${fileList} --format human 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    // Parse violations — sqlfluff outputs one line per violation starting with "L:"
    const violationLines = raw.split('\n').filter(l => /^\s*L:/.test(l) || /\b(FAIL|VIOLATION)\b/i.test(l));
    violationCount = violationLines.length;

    if (violationCount > 0) {
      console.log(chalk.yellow(`  🟡 SQLFluff: ${violationCount} 处 lint 问题`));
      violationLines.slice(0, 8).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 160)}`)));
    } else {
      console.log(chalk.green(`  ✅ SQLFluff: ${sqlFiles.length} 个 SQL 文件通过`));
    }
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('ENOENT'))) {
      console.log(chalk.dim('  ℹ SQLFluff 未安装，跳过（pip install sqlfluff）'));
      return 'SQLFluff 完成: 跳过（未安装）';
    }
    console.log(chalk.dim('  ℹ SQLFluff 不可用，跳过'));
    return 'SQLFluff 完成: 跳过（不可用）';
  }

  if (context) {
    context.sqlFluffViolations = violationCount;
    context.sqlFluffPassed = violationCount === 0;
  }
  return `SQLFluff 完成: ${violationCount > 0 ? `${violationCount} 处问题` : '通过'}`;
}

function _findSqlFiles(rootDir) {
  const results = [];
  const excludeDirs = new Set(['node_modules', '.git', 'dist', 'coverage']);

  function scan(dir, depth = 0) {
    if (depth > 5 || !existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!excludeDirs.has(entry.name)) scan(full, depth + 1);
        } else if (entry.isFile() && entry.name.endsWith('.sql')) {
          results.push(full);
        }
      }
    } catch { /* permission */ }
  }

  scan(rootDir);
  return results;
}

// ── Bruno — API interaction testing ──

export function handleBrunoRun(_action, _params, targetPath, context) {
  let passed = 0;
  let failed = 0;

  try {
    // Find bruno collection directories (contain a bruno.json)
    const collections = _findBrunoCollections(targetPath);
    if (collections.length === 0) {
      console.log(chalk.dim('  ℹ Bruno: 未找到 API 测试集合（bruno.json）'));
      return 'Bruno 完成: 无测试集合';
    }

    for (const col of collections) {
      try {
        const raw = safeExec(
          `bru run --env-var "base_url=http://localhost:3000" "${col}" 2>&1 || true`,
          targetPath,
          { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 120000 }
        ).toString();

        const reqMatch = raw.match(/Requests:\s*(\d+)/);
        const passMatch = raw.match(/(?:✓|PASS|passed|success):\s*(\d+)/i);
        const failMatch = raw.match(/(?:✗|✕|FAIL|failed|error):\s*(\d+)/i);

        if (passMatch) passed += parseInt(passMatch[1], 10);
        if (failMatch) failed += parseInt(failMatch[1], 10);

        // Fallback: count individual request lines
        if (!passMatch && !failMatch) {
          const reqCount = reqMatch ? parseInt(reqMatch[1], 10) : 0;
          const errLines = raw.split('\n').filter(l => /error|fail/i.test(l)).length;
          passed += Math.max(0, reqCount - errLines);
          failed += errLines;
        }

        console.log(chalk.dim(`    ${col}: ${passed}/${passed + failed} 通过`));
      } catch (e) {
        failed++;
        console.log(chalk.dim(`    ${col}: 失败 — ${e.message?.slice(0, 80)}`));
      }
    }
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('ENOENT'))) {
      console.log(chalk.dim('  ℹ Bruno CLI 未安装，跳过（npm install -g @usebruno/cli）'));
      return 'Bruno 完成: 跳过（未安装）';
    }
    console.log(chalk.dim('  ℹ Bruno 不可用，跳过'));
    return 'Bruno 完成: 跳过（不可用）';
  }

  if (context) {
    context.brunoPassed = passed;
    context.brunoFailed = failed;
  }

  if (failed > 0) {
    console.log(chalk.red(`  🔴 Bruno: ${passed}/${passed + failed} 通过 (${failed} 失败)`));
  } else if (passed > 0) {
    console.log(chalk.green(`  ✅ Bruno: ${passed}/${passed} 全部通过`));
  }

  return `Bruno 完成: ${passed}/${passed + failed} 通过${failed > 0 ? ` (${failed} 失败)` : ''}`;
}

function _findBrunoCollections(rootDir) {
  const results = [];
  const excludeDirs = new Set(['node_modules', '.git']);

  function scan(dir, depth = 0) {
    if (depth > 4 || !existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') && entry.name !== '.bruno') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!excludeDirs.has(entry.name)) scan(full, depth + 1);
        } else if (entry.isFile() && entry.name === 'bruno.json') {
          results.push(dir);
        }
      }
    } catch { /* permission */ }
  }

  scan(rootDir);
  return results;
}
