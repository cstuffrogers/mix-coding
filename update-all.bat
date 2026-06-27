@echo off
REM update-all.bat — Mix-Coding 一键全量更新
chcp 65001 >nul
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set CLAUDE_SCENE=%SCRIPT_DIR%claude-scene

echo.
echo ==============================================
echo  Mix-Coding Update All — 全量更新
echo ==============================================
echo.

REM ── 1. npm 包更新 ──
echo [1/5] npm 依赖更新...
cd /d "%CLAUDE_SCENE%"
call npm update --legacy-peer-deps 2>&1
if %errorlevel% equ 0 (
    echo   [OK] npm 依赖更新完成
) else (
    echo   [WARN] npm update 有错误，跳过
)

REM ── 2. Python 包更新 ──
echo.
echo [2/5] Python 工具更新...

where python >nul 2>&1
if %errorlevel% equ 0 (
    echo   更新 seraphim-audit...
    python -m pip install --upgrade -r "%SCRIPT_DIR%requirements.txt" 2>nul && echo   [OK] seraphim-audit || echo   [SKIP] seraphim-audit

    echo   更新 skillspector...
    python -m pip install --upgrade git+https://github.com/NVIDIA/skillspector.git 2>nul && echo   [OK] skillspector || echo   [SKIP] skillspector
) else (
    echo   [SKIP] Python 未安装
)

REM ── 3. Git 仓库更新 ──
echo.
echo [3/5] Git 仓库同步上游...

set REPO_COUNT=0
set UPDATED_COUNT=0

for %%R in (
    "open-design"
    ".mcp\resend-mcp"
    ".mcp\sentry-mcp"
    ".mcp\stripe-mcp"
    ".mcp\supabase-mcp"
    ".mcp\tavily-mcp"
) do (
    if exist "%SCRIPT_DIR%%%R\.git" (
        set /a REPO_COUNT+=1
        for /f "tokens=*" %%i in ('git -C "%SCRIPT_DIR%%%R" rev-parse HEAD 2^>nul') do set BEFORE=%%i
        git -C "%SCRIPT_DIR%%%R" pull --ff-only 2>nul
        if !errorlevel! equ 0 (
            for /f "tokens=*" %%i in ('git -C "%SCRIPT_DIR%%%R" rev-parse HEAD 2^>nul') do set AFTER=%%i
            if "!BEFORE!" neq "!AFTER!" (
                echo   [UPD] %%~R
                set /a UPDATED_COUNT+=1
            ) else (
                echo   [OK]  %%~R ^(已是最新^)
            )
        ) else (
            echo   [SKIP] %%~R ^(有本地修改^)
        )
    )
)

if %UPDATED_COUNT% gtr 0 (
    echo   %UPDATED_COUNT%/%REPO_COUNT% 个仓库已更新
) else (
    echo   所有仓库已是最新
)

REM ── 4. 二进制工具检查 ──
echo.
echo [4/5] 二进制工具版本检查...

where lychee >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('lychee --version 2^>^&1') do set LYCHEE_VER=%%i
    echo   [OK] lychee !LYCHEE_VER!
) else (
    echo   [--] lychee 未安装
)

where act >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('act --version 2^>^&1') do set ACT_VER=%%i
    echo   [OK] act !ACT_VER!
) else (
    echo   [--] act 未安装
)

where restic >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('restic version 2^>^&1') do set RESTIC_VER=%%i
    echo   [OK] restic !RESTIC_VER!
) else (
    echo   [--] restic 未安装
)

REM ── 5. npx 工具 ──
echo.
echo [5/5] npx 零安装工具 ^(aislop/dependency-cruiser/jscpd/size-limit/Stryker/Spectral/markdownlint/knip^)
echo   [OK] 每次执行自动拉最新版，无需手动更新

echo.
echo ==============================================
echo  全量更新完成！
echo ==============================================
echo.

pause
