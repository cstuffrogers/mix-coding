import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
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
  try {
    const content = readFileSync(filePath, 'utf-8');
    const findings = [];
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push({ file: filePath, pattern: pattern.name, severity: pattern.severity });
      }
    }
    return { findings, readable: true };
  } catch {
    // 读不出来的迁移文件 = 没审过。以前静默返回 0 findings，于是
    // migrationReviewPassed = (highOrAbove === 0) 把它当成「审查通过」（假绿）。
    return { findings: [], readable: false };
  }
}

function runGuardian(targetPath) {
  try {
    const output = safeExec('npx db-scalability-guardian analyze 2>&1', targetPath, { stdio: 'pipe' }).toString();
    return { ran: true, exitOk: true, output };
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : undefined;
    const output = error?.stdout ? error.stdout.toString() : '';
    // execSync 只在非零退出时抛错。127 / 9009 / 无 status 都意味着它根本没跑起来；
    // 其余状态码说明它跑了并报了问题 —— 这两种情况结论完全不同，不能混。
    const invoked = status !== undefined && status !== 127 && status !== 9009;
    return { ran: invoked, exitOk: false, output };
  }
}

function runBuiltinScan(migrationFiles) {
  const allFindings = [];
  const unreadable = [];
  for (const file of migrationFiles) {
    const { findings, readable } = scanMigrationFile(file);
    allFindings.push(...findings);
    if (!readable) unreadable.push(file);
  }

  const highOrAbove = allFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
  return { allFindings, highOrAbove, unreadable };
}

function setMigrationContext(context, findings, highOrAbove) {
  if (!context) return;
  context.migrationFindings = findings;
  // 以前还写了个 migrationHighCount，唯一的读者是 conditions.js 里一个没人引用的
  // 谓词（`migrationHighCount > 0`）—— 两边一起删了：门禁看 migrationReviewPassed，
  // 明细看 migrationFindings，多存一个计数只会让人以为它在驱动什么。
  context.migrationReviewPassed = highOrAbove === 0;
  if (highOrAbove > 0) context.lastStepFailed = true;
}

export function handleMigrationReview(_action, _params, targetPath, context) {

  const migrationFiles = findMigrationFiles(targetPath);

  if (migrationFiles.length === 0) {
    // Don't set Passed — let gate report as skipped (no migrations to review)
    return { status: 'skip', message: '迁移审查跳过：无迁移文件' };
  }

  const guardian = runGuardian(targetPath);
  // 不再用 `guardian.output.match(/CRITICAL|HIGH/i)` 数出现次数：输出里写
  // 「No critical issues」也会被数成 1 个 CRITICAL（假红），而真正报出问题时
  // guardian 是非零退出（走过 catch），反而一个都不数。内置规则扫描是确定性的，
  // 以它为准；guardian 只当额外信号。
  const builtin = runBuiltinScan(migrationFiles);

  if (builtin.highOrAbove > 0) {
    setMigrationContext(context, builtin.allFindings, builtin.highOrAbove);
    return `迁移审查完成（${builtin.highOrAbove} 个 HIGH/CRITICAL 问题）`;
  }

  if (builtin.unreadable.length > 0) {
    // 有文件没读出来 = 没审过。以前静默当 0 findings，于是「读不出来」被报成
    // 「审查通过」。不发通过结论，让门禁如实记 skipped。
    if (context) context.migrationFindings = builtin.allFindings;
    const names = builtin.unreadable.map((f) => relative(targetPath, f) || f).join('、');
    return { status: 'skip', message: `迁移审查未完成：${builtin.unreadable.length} 个迁移文件读不出来（${names}）—— 不是通过` };
  }

  if (guardian.ran && !guardian.exitOk) {
    // guardian 跑了但非零退出（它报了问题），而内置规则没扫出 HIGH/CRITICAL。
    // 它没给出可解析的结论，所以不能算通过。
    return { status: 'warn', message: '迁移审查未完成：db-scalability-guardian 非零退出，但它没有给出可解析的结论，内置规则也没发现问题 —— 不能算通过' };
  }

  setMigrationContext(context, builtin.allFindings, 0);
  return '迁移审查完成（通过）';
}
