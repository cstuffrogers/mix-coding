---
description: Check for active loops, long-running processes, and wedged states in the current project.
argument-hint: "[--watch]"
---

# Loop Status Command

Inspect the current project for active loops, long-running processes, and potential wedged states.

## Usage

`/loop-status [--watch]`

## What to Check

### 1. Long-Running Processes

Detect processes that may indicate an active or stuck loop:

```bash
# Node processes running > 5 minutes
ps -eo pid,etime,comm,args | grep -E "node|npm|npx" | grep -v grep

# Python processes running > 5 minutes
ps -eo pid,etime,comm,args | grep -E "python" | grep -v grep

# Build/watch processes
ps -eo pid,etime,comm,args | grep -E "vite|webpack|turbopack|esbuild" | grep -v grep
```

On Windows:
```powershell
Get-Process | Where-Object { $_.ProcessName -match "node|python|vite" -and $_.StartTime -lt (Get-Date).AddMinutes(-5) } | Select-Object Name, Id, StartTime, @{N='MinutesRunning';E={[math]::Round(((Get-Date)-$_.StartTime).TotalMinutes)}}
```

### 2. Git State Checks

Detect interrupted git operations that may leave the repo in a wedged state:

```bash
git status --porcelain
git rebase --show-current-patch 2>/dev/null && echo "REBASE IN PROGRESS"
ls .git/rebase-merge 2>/dev/null && echo "REBASE MERGE DIR EXISTS"
ls .git/rebase-apply 2>/dev/null && echo "REBASE APPLY DIR EXISTS"
ls .git/MERGE_HEAD 2>/dev/null && echo "MERGE IN PROGRESS"
ls .git/CHERRY_PICK_HEAD 2>/dev/null && echo "CHERRY-PICK IN PROGRESS"
ls .git/REVERT_HEAD 2>/dev/null && echo "REVERT IN PROGRESS"
ls .git/BISECT_LOG 2>/dev/null && echo "BISECT IN PROGRESS"
```

### 3. Lock / Temp Files

Look for lock files that may indicate incomplete operations:

```bash
find . -maxdepth 3 -name "*.lock" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -name "package-lock.json" -not -name "yarn.lock" -not -name "pnpm-lock.yaml" -not -name "Cargo.lock" -not -name "Gemfile.lock" -not -name "poetry.lock"
find . -maxdepth 3 -name ".*.swp" -o -name ".*.tmp" -o -name "*.tmp" 2>/dev/null | grep -v node_modules | head -20
```

On Windows:
```powershell
Get-ChildItem -Recurse -Filter "*.tmp" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.git" } | Select-Object FullName, LastWriteTime -First 20
```

### 4. Stale Editor / IDE Files

```bash
find . -maxdepth 3 -name ".vscode" -type d
find . -maxdepth 4 -name ".idea" -type d
find . -maxdepth 4 -name "*.pid" 2>/dev/null | grep -v node_modules
```

### 5. Recent Crash / Error Signals

Check recent terminal history or log files for repeated errors:

```bash
# Look for recent crash dumps or error logs
ls -lt *.log 2>/dev/null | head -5
ls -lt .npm/_logs/*.log 2>/dev/null | head -3
ls -lt logs/*.log 2>/dev/null | head -3
```

## Report Format

Report findings in this structure:

```
============================================================
  LOOP STATUS — <project-name>
  Checked at: <timestamp>
============================================================

Long-running processes: <count>
  [List or "None detected"]

Git state: <clean | wedged>
  [Details if wedged: rebase/merge/cherry-pick in progress]

Lock/temp files: <count>
  [List or "None detected"]

Active IDE/workspace files: <count>

Recommendation: <continue | pause | investigate | abort-git-operation>
```

## Interventions

| Condition | Recommendation |
|---|---|
| REBASE/merge in progress with conflicts | Abort or complete the rebase/merge |
| Process running > 30 min unexpectedly | Investigate or terminate if stale |
| Multiple .tmp or .swp files found | Clean up stale temp files |
| No anomalies detected | Continue working |
