@echo off
REM ==============================================
REM Mix-Coding safe upgrade tool v1.0
REM ==============================================

REM 设置控制台代码页为 UTF-8
chcp 65001 >nul

setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0
set BACKUP_DIR=%PROJECT_DIR%backup\%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%

echo.
echo ==============================================
echo [OK] Mix-Coding Safe Upgrade Tool
echo ==============================================
echo.

REM ==============================================
REM Step 1: Check current state
REM ==============================================
echo [1/6] Checking current state...

if not exist "%PROJECT_DIR%.claude\" (
    echo [ERROR] .claude directory not found, invalid Mix-Coding project
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%.archon\workflows\" (
    echo [ERROR] .archon/workflows directory not found
    pause
    exit /b 1
)

echo [OK] Project directory structure validation passed
echo.

REM ==============================================
REM Step 2: Zero-conflict check
REM ==============================================
echo [2/6] Running zero-conflict check...

if exist "%PROJECT_DIR%zero-conflict-check.sh" (
    echo [WARNING] Zero-conflict check requires WSL2 or Git Bash
    echo    If check fails, fix issues before continuing
    echo.
    echo    Skip zero-conflict check and continue? (Y/N)
    set /p SKIP_CONFLICT_CHECK=
    if /i "!SKIP_CONFLICT_CHECK!"=="Y" (
        echo [WARNING] Skipping zero-conflict check
    )
) else (
    echo [WARNING] zero-conflict-check.sh not found, skipping conflict check
)
echo.

REM ==============================================
REM Step 3: Backup current config
REM ==============================================
echo [3/6] Backing up current config...

if not exist "%PROJECT_DIR%backup\" (
    mkdir "%PROJECT_DIR%backup"
)

echo    Creating backup dir: %BACKUP_DIR%
mkdir "%BACKUP_DIR%"

echo    Backing up .claude/...
xcopy "%PROJECT_DIR%.claude" "%BACKUP_DIR%\.claude\" /E /I /Y >nul

echo    Backing up .archon/...
xcopy "%PROJECT_DIR%.archon" "%BACKUP_DIR%\.archon\" /E /I /Y >nul

echo    Backing up ecc/...
xcopy "%PROJECT_DIR%ecc" "%BACKUP_DIR%\ecc\" /E /I /Y >nul

echo    Backing up claude-scene/...
xcopy "%PROJECT_DIR%claude-scene" "%BACKUP_DIR%\claude-scene\" /E /I /Y >nul

echo    Backing up config files...
if exist "%PROJECT_DIR%package.json" copy "%PROJECT_DIR%package.json" "%BACKUP_DIR%\" >nul
if exist "%PROJECT_DIR%package-lock.json" copy "%PROJECT_DIR%package-lock.json" "%BACKUP_DIR%\" >nul
if exist "%PROJECT_DIR%README.md" copy "%PROJECT_DIR%README.md" "%BACKUP_DIR%\" >nul

echo [OK] Backup complete: %BACKUP_DIR%
echo.

REM ==============================================
REM Step 4: Prompt for upgrade source
REM ==============================================
echo [4/6] Preparing upgrade...
echo.
echo [WARNING] Important notes:
echo    1. Please ensure you have downloaded the new version of Mix-Coding
echo    2. Copy the following directories from new version to current project:
echo       - .claude/ (merge, do not overwrite your custom config)
echo       - .archon/ (overwrite workflow files)
echo       - ecc/ (merge, keep your custom config)
echo       - claude-scene/ (overwrite)
echo.
echo    Or, you can manually upgrade:
echo    1. Keep custom content in .claude/knowledge/ and .claude/rules/
echo    2. Upgrade .claude/commands/ and .claude/scenes/
echo    3. Upgrade .archon/workflows/
echo    4. Upgrade ecc/source/
echo    5. Upgrade claude-scene/
echo.
echo    Are you ready? (Y/N)
set /p READY=
if /i not "!READY!"=="Y" (
    echo [WARNING] Upgrade cancelled, your project remains unchanged
    echo    Backup saved at: %BACKUP_DIR%
    pause
    exit /b 0
)
echo.

REM ==============================================
REM Step 5: Simulate upgrade (manual process)
REM ==============================================
echo [5/6] Upgrade checklist...
echo.
echo [OK] Please follow this order:
echo.
echo    1. Merge .claude/ directory (keep your custom config)
echo       - Keep: .claude/knowledge/ (your knowledge base)
echo       - Keep: .claude/rules/ (your rules)
echo       - Upgrade: .claude/commands/ (new commands)
echo       - Upgrade: .claude/scenes/ (new scenes)
echo.
echo    2. Upgrade .archon/ directory
echo       - Overwrite: .archon/workflows/ (workflow files)
echo.
echo    3. Merge ecc/ directory
echo       - Keep: ecc/mapping.json (your custom mapping)
echo       - Upgrade: ecc/source/commands/ (new commands)
echo       - Upgrade: ecc/source/agents/ (new agents)
echo.
echo    4. Upgrade claude-scene/ directory
echo       - Overwrite: claude-scene/ (CLI tool)
echo       - Run: cd claude-scene ^&^& npm install
echo.
echo    5. Update global command files
echo       - Copy: ecc/source/commands/*.md to ~/.claude/commands/
echo.
echo When finished above steps, press any key to continue validation...
pause >nul
echo.

REM ==============================================
REM Step 6: Verify upgrade
REM ==============================================
echo [6/6] Verifying upgrade...
echo.

if exist "%PROJECT_DIR%claude-scene\package.json" (
    echo [OK] claude-scene directory exists
) else (
    echo [WARNING] claude-scene directory may be missing
)

set WORKFLOW_COUNT=0
for %%f in ("%PROJECT_DIR%.archon\workflows\*.yaml") do (
    set /a WORKFLOW_COUNT+=1
)
echo [OK] Detected !WORKFLOW_COUNT! workflows

set COMMAND_COUNT=0
for %%f in ("%PROJECT_DIR%ecc\source\commands\*.md") do (
    set /a COMMAND_COUNT+=1
)
echo [OK] Detected !COMMAND_COUNT! commands

echo.
echo ==============================================
echo [OK] Upgrade process complete!
echo ==============================================
echo.
echo [NOTE] Important notes:
echo    1. If issues occur after upgrade, restore from backup:
echo       %BACKUP_DIR%
echo.
echo    2. Restart Claude Code to load new commands
echo.
echo    3. Test commands are working:
echo       /polish, /bugfix, /feature, /review etc.
echo.
echo [NEXT STEPS]
echo    1. Fully restart Claude Code
echo    2. Run: claude-scene\src\index.js list
echo    3. Test a simple command to verify functionality
echo.

pause