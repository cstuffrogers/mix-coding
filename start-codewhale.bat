@echo off
REM Codewhale (DeepSeek TUI) Launcher

echo.
echo ==============================================
echo [OK] CodeWhale / DeepSeek TUI Launcher
echo ==============================================
echo.

where codewhale >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] codewhale not found
    echo Please install: npm install -g codewhale
    pause
    exit /b 1
)

echo [OK] codewhale v0.8.47 found
echo.
echo Starting codewhale...
echo.

if "%~1" neq "" (
    cd /d "%~1"
)
echo Work dir: %CD%
echo.

codewhale

echo.
echo codewhale exited with code: %errorlevel%
echo.
pause