@echo off
set "PROJECT_DIR=%~dp0"
chcp 65001 >nul
cd /d "%PROJECT_DIR%"
claude
echo.
echo Claude Code exited
pause
