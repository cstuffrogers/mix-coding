@echo off
REM Restart Claude Code (kills existing + verifies MCP config)
chcp 65001 >nul

echo ==========================================
echo   Restart Claude Code
echo ==========================================
echo.

REM Step 1: Kill existing Claude processes
echo [1/3] Killing existing Claude processes...
taskkill /F /IM "claude.exe" 2>nul
timeout /t 2 >nul

REM Step 2: Verify .mcp.json
echo.
echo [2/3] Verifying .mcp.json...
findstr /C:"mcpServers" ".mcp.json" >nul
if %errorlevel%==0 (
    findstr /C:"command" ".mcp.json" | find /C "command"
    echo MCP config OK
) else (
    echo WARNING: .mcp.json missing or invalid
)

REM Step 3: Restart Claude
echo.
echo [3/3] Starting Claude Code...
cd /d "%~dp0"
claude
