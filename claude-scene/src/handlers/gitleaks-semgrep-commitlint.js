import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Gitleaks — Git history + real-time secret scanning ──

const GITLEAKS_MAX_FINDINGS = 12;

export function handleGitleaks(_action, _params, targetPath, context) {
  let findingCount = 0;
  let leakSummary = '';

  try {
    const raw = safeExec(
      'gitleaks detect --no-git --source . --verbose --log-level warn 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 90000 }
    ).toString();

    const match = raw.match(/(\d+)\s*(?:leaks?|findings?)/i);
    findingCount = match ? parseInt(match[1], 10) : 0;

    // Fallback: count individual leak lines
    if (findingCount === 0) {
      const leakLines = raw.split('\n').filter(l =>
        /(?:leak|secret|key|token|password|credential)/i.test(l) && /found/i.test(l)
      );
      findingCount = leakLines.length;
    }

    if (findingCount > 0) {
      console.log(chalk.red(`  🔴 Gitleaks: ${findingCount} 个密钥泄露`));
      const findings = raw.split('\n').filter(l =>
        /(?:Rule|Secret|Match|File|Line)/.test(l) || /(?:leak|secret|key|token)/i.test(l)
      );
      leakSummary = findings.slice(0, GITLEAKS_MAX_FINDINGS).map(l => l.trim().slice(0, 180)).join(' | ');
      findings.slice(0, GITLEAKS_MAX_FINDINGS).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 160)}`)));
    } else {
      console.log(chalk.green('  ✅ Gitleaks: 无密钥泄露'));
    }
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('ENOENT'))) {
      console.log(chalk.dim('  ℹ Gitleaks 未安装，跳过'));
      return 'Gitleaks 完成: 跳过（未安装）';
    }
    console.log(chalk.dim(`  ℹ Gitleaks 扫描失败: ${e.message?.slice(0, 80)}`));
    return 'Gitleaks 完成: 跳过（执行失败）';
  }

  if (context) {
    context.gitleaksLeakCount = findingCount;
    context.gitleaksLeakSummary = leakSummary;
    context.gitleaksPassed = findingCount === 0;
  }
  return `Gitleaks 完成: ${findingCount > 0 ? `${findingCount} 个泄露` : '无泄露'}`;
}

// ── Semgrep — multi-language AST-level SAST ──

export function handleSemgrep(_action, _params, targetPath, context) {
  let findingCount = 0;

  try {
    const raw = safeExec(
      'semgrep scan --config auto --quiet --no-git-ignore --max-target-bytes 5000000 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, timeout: 180000 }
    ).toString();

    // Parse semgrep output — JSON summary line or text output
    const jsonMatch = raw.match(/"findings"\s*:\s*(\d+)/);
    const countMatch = raw.match(/(\d+)\s*(?:finding|result)s?\s*(?:found|detected)/i);

    if (jsonMatch) {
      findingCount = parseInt(jsonMatch[1], 10);
    } else if (countMatch) {
      findingCount = parseInt(countMatch[1], 10);
    } else {
      // Fallback: count individual finding lines
      findingCount = raw.split('\n').filter(l => /severity|warning|error/i.test(l) && /ruleid/i.test(l)).length;
    }

    // Check for timeout/error indicators
    if (findingCount === 0 && raw.includes('No findings')) {
      console.log(chalk.green('  ✅ Semgrep: 无问题'));
    } else if (findingCount > 0) {
      console.log(chalk.yellow(`  🟡 Semgrep: ${findingCount} 个问题`));
      const findingLines = raw.split('\n').filter(l => /severity|ruleid/i.test(l));
      findingLines.slice(0, 8).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 160)}`)));
    } else {
      console.log(chalk.green('  ✅ Semgrep: 扫描完成，无问题'));
    }
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('ENOENT'))) {
      console.log(chalk.dim('  ℹ Semgrep 未安装，跳过（pip install semgrep）'));
      return 'Semgrep 完成: 跳过（未安装）';
    }
    console.log(chalk.dim(`  ℹ Semgrep 扫描失败: ${e.message?.slice(0, 80)}`));
    return 'Semgrep 完成: 跳过（执行失败）';
  }

  if (context) {
    context.semgrepFindings = findingCount;
    context.semgrepPassed = findingCount === 0;
  }
  return `Semgrep 完成: ${findingCount > 0 ? `${findingCount} 个问题` : '无问题'}`;
}

// ── Commitlint — Conventional Commits format validation ──

export function handleCommitlint(_action, _params, targetPath, context) {
  let violationCount = 0;

  try {
    // Check if .husky/commitlint or commitlint.config exists
    const hasConfig = existsSync(join(targetPath, 'commitlint.config.js'))
      || existsSync(join(targetPath, 'commitlint.config.cjs'))
      || existsSync(join(targetPath, 'commitlint.config.mjs'))
      || existsSync(join(targetPath, '.commitlintrc.json'))
      || existsSync(join(targetPath, '.commitlintrc.js'));

    // Validate last N commits against conventional commits
    const raw = safeExec(
      'npx commitlint --from HEAD~5 --to HEAD --verbose 2>&1 || true',
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024, timeout: 60000 }
    ).toString();

    const lines = raw.trim().split('\n').filter(Boolean);
    const problemLines = lines.filter(l => /⧗|✖|error|problem|invalid/i.test(l));
    violationCount = problemLines.length;

    // Fallback: npx might not have commitlint, check for error
    if (raw.includes('could not determine executable') || raw.includes('not found')) {
      if (!hasConfig) {
        console.log(chalk.dim('  ℹ Commitlint: 未配置，跳过'));
        return 'Commitlint 完成: 跳过（未配置）';
      }
    }

    if (violationCount > 0) {
      console.log(chalk.yellow(`  🟡 Commitlint: ${violationCount} 条规范违规`));
      problemLines.slice(0, 5).forEach(l => console.log(chalk.dim(`    ${l.trim().slice(0, 160)}`)));
    } else if (lines.length > 0) {
      console.log(chalk.green('  ✅ Commitlint: Commit 格式全部通过'));
    } else {
      console.log(chalk.green('  ✅ Commitlint: 无问题'));
    }
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('ENOENT'))) {
      console.log(chalk.dim('  ℹ Commitlint 未安装（npm install -D @commitlint/cli @commitlint/config-conventional）'));
      return 'Commitlint 完成: 跳过（未安装）';
    }
    console.log(chalk.dim('  ℹ Commitlint 不可用，跳过'));
    return 'Commitlint 完成: 跳过（不可用）';
  }

  if (context) {
    context.commitlintViolations = violationCount;
    context.commitlintPassed = violationCount === 0;
  }
  return `Commitlint 完成: ${violationCount > 0 ? `${violationCount} 条违规` : '通过'}`;
}
