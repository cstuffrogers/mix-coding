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
echo [1/7] npm 依赖更新...
cd /d "%CLAUDE_SCENE%"
call npm update --legacy-peer-deps 2>&1
if %errorlevel% equ 0 (
    echo   [OK] claude-scene npm 依赖更新完成
) else (
    echo   [WARN] npm update 有错误，跳过
)

echo   [2/7] 项目根依赖安装 (Stagehand + zod)...
cd /d "%SCRIPT_DIR%"
call npm install --legacy-peer-deps 2>&1
if %errorlevel% equ 0 (
    echo   [OK] 根依赖安装完成
) else (
    echo   [WARN] 根依赖安装有错误
)

echo   [3/7] mythos-agent 安装/更新...
where mythos-agent >nul 2>&1
if %errorlevel% equ 0 (
    call npm update -g mythos-agent 2>&1 && echo   [OK] mythos-agent 已更新 || echo   [OK] mythos-agent 保持当前版本
) else (
    call npm install -g mythos-agent 2>&1 && echo   [OK] mythos-agent 安装完成 || echo   [WARN] mythos-agent 安装失败
)

REM ── 2. Python 包更新 ──
echo.
echo [4/7] Python 工具更新...

where python >nul 2>&1
if %errorlevel% equ 0 (
    echo   更新 seraphim-audit...
    python -m pip install --upgrade -r "%SCRIPT_DIR%requirements.txt" 2>nul && echo   [OK] seraphim-audit || echo   [SKIP] seraphim-audit

    echo   更新 skillspector...
    python -m pip install --upgrade git+https://github.com/NVIDIA/skillspector.git 2>nul && echo   [OK] skillspector || echo   [SKIP] skillspector

    echo   更新 GEPA...
    python -m pip install --upgrade gepa 2>nul && echo   [OK] gepa || echo   [SKIP] gepa
) else (
    echo   [SKIP] Python 未安装
)

REM ── 3. Git 仓库更新 ──
echo.
echo [5/7] Git 仓库同步上游...

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
echo [6/7] 二进制工具版本检查...

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
echo [7/7] npx 零安装工具 ^(aislop/dependency-cruiser/jscpd/size-limit/Stryker/Spectral/markdownlint/knip^)
echo   [OK] 每次执行自动拉最新版，无需手动更新

echo.
echo ==============================================
echo  全量更新完成！
echo ==============================================
echo.

pause
