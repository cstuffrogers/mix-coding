# Restic backup script for claude-scene
# Required env vars: RESTIC_REPOSITORY, RESTIC_PASSWORD
# Usage: .\backup.ps1

$ErrorActionPreference = "Stop"

if (-not $env:RESTIC_REPOSITORY) {
    Write-Host "ERROR: RESTIC_REPOSITORY not set. Source .restic-env first." -ForegroundColor Red
    exit 1
}

Write-Host "=== Initializing repo (if needed) ==="
restic init 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "Repo already initialized (ok)" }

Write-Host "=== Running backup ==="
restic backup "./src" --exclude-file="restic-exclude.txt" --verbose

Write-Host "=== Pruning old snapshots ==="
restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --keep-yearly 2

Write-Host "=== Checking repository ==="
restic check

Write-Host "=== Backup complete ==="
restic snapshots --latest 5
