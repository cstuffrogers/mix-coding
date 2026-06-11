@echo off
REM ==============================================
REM Claude Code 启动脚本
REM ==============================================

REM 设置控制台代码页为 UTF-8
chcp 65001 >nul

echo.
echo ==============================================
echo [OK] Claude Code launcher (Mix-Coding project)
echo ==============================================
echo Working dir: E:\auto-coding
echo Commands: /polish /bugfix /feature /review /design /analyze /hunt /loop /optimize /refactor /simplify /new-project
echo ==============================================
echo.

cd /d E:\auto-coding
claude

echo.
echo Claude Code exited
echo.
pause
