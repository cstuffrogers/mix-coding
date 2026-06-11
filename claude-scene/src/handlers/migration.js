import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

const MIGRATION_DIRS = ['migrations', 'prisma', 'drizzle', 'supabase/migrations'];

const DANGEROUS_PATTERNS = [
  { name: 'NOT NULL without DEFAULT', regex: /ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\s+\w+\s+\w+\s+NOT\s+NULL(?!.*\bDEFAULT\b)/i, severity: 'CRITICAL' },
  { name: 'DROP TABLE', regex: /DROP\s+TABLE\s+/i, severity: 'CRITICAL' },
  { name: 'DROP COLUMN', regex: /ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN\s+/i, severity: 'HIGH' },
  { name: 'RENAME COLUMN', regex: /ALTER\s+TABLE\s+\w+\s+RENAME\s+COLUMN\s+/i, severity: 'MEDIUM' },
  { name: 'Change column type', regex: /ALTER\s+TABLE\s+\w+\s+ALTER\s+COLUMN\s+\w+\s+TYPE\s+/i, severity: 'HIGH' },
  { name: 'DROP INDEX (may cause lock)', regex: /DROP\s+INDEX\s+/i, severity: 'MEDIUM' },
  { name: 'TRUNCATE TABLE', regex: /TRUNCATE\s+TABLE\s+/i, severity: 'CRITICAL' },
  { name: 'ADD FOREIGN KEY without validation', regex: /ALTER\s+TABLE\s+\w+\s+ADD\s+CONSTRAINT\s+\w+\s+FOREIGN\s+KEY/i, severity: 'MEDIUM' },
];

function findMigrationFiles(targetPath) {
  const files = [];
  for (const dir of MIGRATION_DIRS) {
    const dirPath = join(targetPath, dir);
    if (!existsSync(dirPath)) continue;
    try {
      for (const entry of readdirSync(dirPath)) {
        if (entry.endsWith('.sql') || entry.endsWith('.ts') || entry.endsWith('.js')) {
          files.push(join(dirPath, entry));
        }
      }
    } catch { /* skip unreadable */ }
  }
  return files;
}

function scanMigrationFile(filePath) {
  const findings = [];
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push({ file: filePath, pattern: pattern.name, severity: pattern.severity });
      }
    }
  } catch { /* skip unreadable */ }
  return findings;
}

function runGuardian(targetPath) {
  try {
    const result = safeExec('npx db-scalability-guardian analyze 2>&1', targetPath, { stdio: 'pipe' }).toString();
    return { ran: true, output: result };
  } catch {
    return { ran: false };
  }
}

function runBuiltinScan(migrationFiles) {
  let allFindings = [];
  for (const file of migrationFiles) {
    allFindings = [...allFindings, ...scanMigrationFile(file)];
  }

  for (const f of allFindings) {
    const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : '🟡';
    console.log(chalk.dim(`  ${icon} [${f.severity}] ${f.pattern}: ${f.file}`));
  }

  const highOrAbove = allFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
  return { allFindings, highOrAbove };
}

function setMigrationContext(context, findings, highOrAbove) {
  if (!context) return;
  context.migrationFindings = findings;
  context.migrationHighCount = highOrAbove;
  context.migrationReviewPassed = highOrAbove === 0;
  if (highOrAbove > 0) context.lastStepFailed = true;
}

export function handleMigrationReview(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🗄️ 正在审查数据库迁移...'));

  const migrationFiles = findMigrationFiles(targetPath);

  if (migrationFiles.length === 0) {
    console.log(chalk.dim('  未发现迁移文件，跳过'));
    if (context) context.migrationReviewPassed = true;
    return '迁移审查完成（无迁移文件）';
  }

  console.log(chalk.dim(`  发现 ${migrationFiles.length} 个迁移文件`));

  const guardian = runGuardian(targetPath);
  let findings, highOrAbove;

  if (guardian.ran) {
    console.log(chalk.dim('  已运行 db-scalability-guardian'));
    const criticalMatch = guardian.output.match(/CRITICAL|critical/i);
    const highMatch = guardian.output.match(/HIGH|high/i);
    highOrAbove = (criticalMatch?.length || 0) + (highMatch?.length || 0);
    findings = guardian.output;
    if (highOrAbove > 0) console.log(chalk.red(`  ⚠ 发现 ${highOrAbove} 个 HIGH/CRITICAL 问题`));
  } else {
    console.log(chalk.dim('  db-scalability-guardian 未安装，使用内置规则扫描'));
    const result = runBuiltinScan(migrationFiles);
    findings = result.allFindings;
    highOrAbove = result.highOrAbove;
  }

  setMigrationContext(context, findings, highOrAbove);

  if (highOrAbove === 0) {
    console.log(chalk.green('  ✅ 迁移审查通过'));
    return '迁移审查完成（通过）';
  }
  console.log(chalk.red(`  🚫 迁移审查阻断: ${highOrAbove} 个 HIGH/CRITICAL 问题`));
  return `迁移审查完成（${highOrAbove} 个 HIGH/CRITICAL 问题）`;
}
