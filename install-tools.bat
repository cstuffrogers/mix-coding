@echo off
REM ==============================================
REM Mix-Coding 外部工具一键安装 v1.2
REM ==============================================

REM Set console codepage to UTF-8
chcp 65001 >nul

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set CLAUDE_SCENE=%SCRIPT_DIR%claude-scene

echo.
echo ==============================================
echo [OK] Mix-Coding External Tools Installer
echo ==============================================
echo.

REM ==============================================
REM Step 1: Check prerequisites
REM ==============================================
echo [1/4] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required but not found in PATH
    echo    Download: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is required but not found
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [OK] npm %NPM_VER%

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Python not found - seraphim-audit will be skipped
    echo    Download: https://www.python.org/
    set PYTHON_MISSING=1
) else (
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PY_VER=%%i
    echo [OK] %PY_VER%
)

echo.

REM ==============================================
REM Step 2: Install npm tools (claude-scene devDependencies)
REM ==============================================
echo [2/4] Installing npm tools in claude-scene...
echo.

cd /d "%CLAUDE_SCENE%"
if %errorlevel% neq 0 (
    echo [ERROR] claude-scene directory not found: %CLAUDE_SCENE%
    pause
    exit /b 1
)

REM Check if package.json dependencies are already installed
set NEEDS_NPM_INSTALL=0
for %%t in (@lhci/cli knip) do (
    if not exist "node_modules\%%t" set NEEDS_NPM_INSTALL=1
)

if %NEEDS_NPM_INSTALL%==0 (
    echo    [SKIP] package.json dependencies already installed
) else (
    echo    Running: npm install --legacy-peer-deps
    set PUPPETEER_SKIP_DOWNLOAD=true
    set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    call npm install --legacy-peer-deps 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] npm install had errors - continuing...
    ) else (
        echo [OK] npm install complete
    )
)

echo.

REM Check additional tools (noleak, pa11y-ci, recheck-cli)
set ALL_ADDITIONAL_PRESENT=1
for %%t in (noleak pa11y-ci recheck-cli) do (
    if not exist "node_modules\%%t" set ALL_ADDITIONAL_PRESENT=0
)

if %ALL_ADDITIONAL_PRESENT%==1 (
    echo    [SKIP] Additional tools (noleak, pa11y-ci, recheck-cli) already installed
) else (
    echo    Installing additional tools (noleak, pa11y-ci, recheck-cli)...
    set PUPPETEER_SKIP_DOWNLOAD=true
    set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    call npm install -D noleak pa11y-ci recheck-cli --legacy-peer-deps 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Some tools may not have installed - continuing...
    )
)
echo.

REM Verify key tools
echo    Verifying installed tools...
for %%t in (@lhci/cli knip noleak pa11y-ci recheck-cli) do (
    if exist "node_modules\%%t" (
        echo      [OK] %%t
    ) else (
        echo      [--] %%t (not found, may use npx on demand)
    )
)
echo.

REM ==============================================
REM Step 3: Install Python tools
REM ==============================================
echo [3/4] Installing Python tools...
echo.

if "%PYTHON_MISSING%"=="1" (
    echo    [SKIP] Python not found - seraphim-audit not installed
    echo    Manual install: pip install git+https://github.com/seraphimhub/seraphim-audit.git
    goto :step4
)

REM Check if seraphim-audit already installed
python -m pip list 2>nul | findstr /i "seraphim-audit" >nul
if %errorlevel%==0 (
    echo    [SKIP] seraphim-audit already installed
    goto :step4
)

echo    Installing seraphim-audit (via requirements.txt)...
python -m pip install -r "%SCRIPT_DIR%requirements.txt" 2>&1
if %errorlevel% neq 0 (
    echo    [WARNING] seraphim-audit install failed
    echo    Try manually: pip install -r requirements.txt
) else (
    echo    [OK] seraphim-audit installed
)
echo.

:step4
REM ==============================================
REM Step 4: Install binary tools
REM ==============================================
echo [4/4] Installing binary tools...
echo.

REM --- lychee ---
where lychee >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('lychee --version 2^>^&1') do set LYCHEE_VER=%%i
    echo    [SKIP] lychee already installed (!LYCHEE_VER!)
) else (
    echo    [--] lychee not found in PATH
    echo    Install: https://github.com/lycheeverse/lychee/releases
    echo.
)

REM --- act ---
where act >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('act --version 2^>^&1') do set ACT_VER=%%i
    echo    [SKIP] act already installed (!ACT_VER!)
) else (
    where winget >nul 2>&1
    if %errorlevel%==0 (
        echo    Installing act via winget...
        winget install nektos.act --accept-package-agreements --accept-source-agreements 2>&1
        if %errorlevel% neq 0 (
            echo    [--] act install failed
            echo    Download: https://github.com/nektos/act/releases
        ) else (
            echo    [OK] act installed
        )
    ) else (
        echo    [--] act not found
        echo    Download: https://github.com/nektos/act/releases
    )
    echo.
)

REM --- restic ---
where restic >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('restic version 2^>^&1') do set RESTIC_VER=%%i
    echo    [SKIP] restic already installed (!RESTIC_VER!)
) else (
    where winget >nul 2>&1
    if %errorlevel%==0 (
        echo    Installing restic via winget...
        winget install restic.restic --accept-package-agreements --accept-source-agreements 2>&1
        if %errorlevel% neq 0 (
            echo    [--] restic install failed
            echo    Download: https://github.com/restic/restic/releases
        ) else (
            echo    [OK] restic installed
        )
    ) else (
        echo    [--] restic not found
        echo    Download: https://github.com/restic/restic/releases
    )
    echo.
)

echo.
echo ==============================================
echo [OK] Installation complete!
echo ==============================================
echo.
echo Installed tools:
echo   npm (claude-scene/devDependencies):
echo     - @lhci/cli         (Lighthouse CI performance gate)
echo     - knip              (dead code detection)
echo     - noleak            (build leak detection)
echo     - pa11y-ci           (WCAG 2.1 AA accessibility)
echo     - recheck-cli        (ReDoS detection)
echo.
if "%PYTHON_MISSING%"=="1" (
    echo   Python: [SKIPPED] seraphim-audit not installed
) else (
    echo   Python:
    echo     - seraphim-audit  (security header scanning)
)
echo.
echo   Binary:
echo     - lychee            (dead link checker)
echo     - act               (local GitHub Actions runner)
echo     - restic            (encrypted deduplicated backup)
echo.
echo Next steps:
echo   1. Verify: cd claude-scene ^&^& npx vitest run
echo   2. Test a workflow: node src/index.js start audit --auto --dry-run
echo.

pause
