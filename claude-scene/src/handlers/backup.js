import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

const EXCLUDE_PATTERNS = [
  'node_modules/', '.git/', 'dist/', 'build/', 'coverage/', '.next/',
  '.cache/', 'tmp/', 'temp/', '*.log', '.env', '.env.local', '*.pyc',
  '__pycache__/', '.DS_Store', 'Thumbs.db',
];

const SOURCE_DIRS = ['src', 'lib', 'data', 'public', 'config', 'app', 'pages', 'components', 'utils'];

function checkRestic() {
  try {
    const out = safeExec('restic version 2>&1', process.cwd(), { stdio: 'pipe' }).toString().trim();
    return { available: true, version: out.split('\n', 1)[0] };
  } catch { return { available: false, version: '' }; }
}

function detectSourceDirs(targetPath) {
  return SOURCE_DIRS.filter(dir => existsSync(join(targetPath, dir)));
}

function generateExcludeFile(targetPath) {
  const content = EXCLUDE_PATTERNS.join('\n') + '\n';
  const excludePath = join(targetPath, 'restic-exclude.txt');
  writeFileSync(excludePath, content, 'utf-8');
  return excludePath;
}

function generateBackupScript(targetPath, sourceDirs, isWindows) {
  const repoName = targetPath.split(/[/\\]/).pop() || 'project';
  const sources = sourceDirs.map(d => `"./${d}"`).join(' ');

  if (isWindows) {
    const script = `# Restic backup script for ${repoName}
# Required env vars: RESTIC_REPOSITORY, RESTIC_PASSWORD
# Usage: .\\backup.ps1

$ErrorActionPreference = "Stop"

if (-not $env:RESTIC_REPOSITORY) {
    Write-Host "ERROR: RESTIC_REPOSITORY not set. Source .restic-env first." -ForegroundColor Red
    exit 1
}

Write-Host "=== Initializing repo (if needed) ==="
restic init 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "Repo already initialized (ok)" }

Write-Host "=== Running backup ==="
restic backup ${sources} --exclude-file="restic-exclude.txt" --verbose

Write-Host "=== Pruning old snapshots ==="
restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --keep-yearly 2

Write-Host "=== Checking repository ==="
restic check

Write-Host "=== Backup complete ==="
restic snapshots --latest 5
`;
    return { script, path: join(targetPath, 'backup.ps1') };
  }

  const script = `#!/usr/bin/env bash
# Restic backup script for ${repoName}
# Required env vars: RESTIC_REPOSITORY, RESTIC_PASSWORD
# Usage: source .restic-env && ./backup.sh
set -euo pipefail

if [ -z "\${RESTIC_REPOSITORY:-}" ]; then
    echo "ERROR: RESTIC_REPOSITORY not set. Source .restic-env first."
    exit 1
fi

echo "=== Initializing repo (if needed) ==="
restic init 2>/dev/null || echo "Repo already initialized (ok)"

echo "=== Running backup ==="
restic backup ${sources} --exclude-file="restic-exclude.txt" --verbose

echo "=== Pruning old snapshots ==="
restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --keep-yearly 2

echo "=== Checking repository ==="
restic check

echo "=== Backup complete ==="
restic snapshots --latest 5
`;
  return { script, path: join(targetPath, 'backup.sh') };
}

function generateEnvExample(targetPath, _sourceDirs) {
  const repoName = targetPath.split(/[/\\]/).pop() || 'project';
  const content = `# Restic backup configuration for ${repoName}
# Copy to .restic-env and fill in your values:
#   cp .restic-env.example .restic-env

# Repository location (local path, s3, sftp, etc.)
# RESTIC_REPOSITORY=/mnt/backups/${repoName}
# RESTIC_REPOSITORY=s3:s3.amazonaws.com/my-bucket/${repoName}
RESTIC_REPOSITORY=

# Repository password (generate with: openssl rand -base64 32)
RESTIC_PASSWORD=

# Optional: AWS credentials for S3 backends
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=

# Optional: SFTP credentials
# RESTIC_REPOSITORY=sftp:user@host:/backups/${repoName}
`;
  const envPath = join(targetPath, '.restic-env.example');
  writeFileSync(envPath, content, 'utf-8');
  return envPath;
}

export function handleSetupBackup(_action, _params, targetPath, context) {

  const isWindows = process.platform === 'win32';
  const restic = checkRestic();

  if (restic.available) {
    console.log(chalk.dim(`  Restic: ${restic.version}`));
  } else {
    console.log(chalk.yellow('  ⚠ Restic 未安装，仍会生成备份脚本'));
  }

  const sourceDirs = detectSourceDirs(targetPath);

  let scriptPath = '';
  let ok = true;

  try {
    generateExcludeFile(targetPath);
  } catch {
    ok = false;
  }

  try {
    const { script, path } = generateBackupScript(targetPath, sourceDirs, isWindows);
    writeFileSync(path, script, 'utf-8');
    if (!isWindows) {
      try { safeExec(`chmod +x "${path}" 2>/dev/null || true`, targetPath, { stdio: 'pipe' }); } catch { /* ok */ }
    }
    scriptPath = path;
  } catch {
    ok = false;
  }

  try {
    generateEnvExample(targetPath, sourceDirs);
  } catch {
    ok = false;
  }

  if (context) {
    context.backupConfigured = ok;
    context.backupScriptPath = scriptPath;
    context.resticAvailable = restic.available;
    if (!ok) context.lastStepFailed = true;
  }

  return ok
    ? 'Restic 备份配置完成'
    : 'Restic 备份配置部分完成（检查警告）';
}
