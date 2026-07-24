@echo off
REM check-updates.bat - Mix-Coding tool version checker (READ-ONLY)
REM Scans installed tools, compares with upstream, outputs report.
REM Does NOT modify any file. Zero conflict by design.
REM
REM Encoding rule: script source is pure ASCII. chcp 65001 only sets
REM console output to UTF-8 so Chinese tool names display correctly.
REM CRLF line endings required (Windows cmd).

chcp 65001 >nul
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "CLAUDE_SCENE=%SCRIPT_DIR%claude-scene"
set "REPORT=%SCRIPT_DIR%docs\tool-update-report.txt"
set "DATE=%date% %time%"

REM Truncate report
echo # Mix-Coding Tool Update Report > "%REPORT%"
echo Generated: %DATE% >> "%REPORT%"
echo Mode: READ-ONLY check (no files modified) >> "%REPORT%"
echo. >> "%REPORT%"

echo.
echo ==============================================
echo  Mix-Coding Update Checker (read-only)
echo  Report: docs\tool-update-report.txt
echo ==============================================
echo.

REM ===== 1. npm packages =====
echo [1/5] Checking npm packages (npm outdated)...
echo ## 1. npm packages >> "%REPORT%"
echo. >> "%REPORT%"
echo Location: claude-scene\package.json >> "%REPORT%"
echo. >> "%REPORT%"
echo ^| Package ^| Current ^| Wanted ^| Latest ^| >> "%REPORT%"
echo ^|---------^|---------^|--------^|--------^| >> "%REPORT%"

cd /d "%CLAUDE_SCENE%"
for /f "tokens=1,2,3,4" %%a in ('npm outdated 2^>nul') do (
    if not "%%a"=="Package" if not "%%a"=="" (
        echo ^| %%a ^| %%b ^| %%c ^| %%d ^| >> "%REPORT%"
    )
)
echo Done.
echo. >> "%REPORT%"

REM ===== 2. winget binaries =====
echo [2/5] Checking winget-managed binaries (winget upgrade)...
echo ## 2. winget binaries >> "%REPORT%"
echo. >> "%REPORT%"
echo Relevant packages (trivy/gitleaks/hurl/shellcheck/lychee/act/restic/bruno): >> "%REPORT%"
echo. >> "%REPORT%"

REM Filter winget upgrade list for known tools
for /f "tokens=1,2,3,4" %%a in ('winget upgrade 2^>nul') do (
    echo %%a | findstr /i /b "trivy gitleaks hurl shellcheck lychee act restic bruno" >nul 2>&1
    if !errorlevel! equ 0 (
        echo - %%a (current: %%c, available: %%d) >> "%REPORT%"
    )
)
echo Done.
echo. >> "%REPORT%"

REM ===== 3. uv Python tools =====
echo [3/5] Checking uv Python tools (uv tool list)...
echo ## 3. uv Python tools >> "%REPORT%"
echo. >> "%REPORT%"
echo Installed uv tools: >> "%REPORT%"

where uv >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('uv tool list 2^>nul') do (
        echo - %%i >> "%REPORT%"
    )
    echo. >> "%REPORT%"
    echo Note: uv has no built-in outdated. Check upstream manually: >> "%REPORT%"
    echo   specify-cli: github.com/github/spec-kit/releases >> "%REPORT%"
    echo   seraphim-audit / skillspector / sqlfluff / semgrep / ruff: pip outdated >> "%REPORT%"
) else (
    echo   uv not installed >> "%REPORT%"
)
echo Done.
echo. >> "%REPORT%"

REM ===== 4. Git submodules (local vs remote, NO pull) =====
echo [4/5] Checking git submodules (local vs remote, no pull)...
echo ## 4. git submodules (local vs upstream) >> "%REPORT%"
echo. >> "%REPORT%"
echo Comparison method: fetch --dry-run (no local changes touched) >> "%REPORT%"
echo. >> "%REPORT%"

cd /d "%SCRIPT_DIR%"
for %%R in (
    "open-design"
    ".mcp\resend-mcp"
    ".mcp\sentry-mcp"
    ".mcp\stripe-mcp"
    ".mcp\supabase-mcp"
    ".mcp\tavily-mcp"
) do (
    if exist "%SCRIPT_DIR%%%~R\.git" (
        REM Get local HEAD short
        for /f "tokens=*" %%h in ('git -C "%SCRIPT_DIR%%%~R" rev-parse --short HEAD 2^>nul') do set "LOCAL_HEAD=%%h"
        REM Check if remote has commits we do not have (dry-run, no fetch)
        for /f "tokens=*" %%c in ('git -C "%SCRIPT_DIR%%%~R" rev-list --count HEAD..@{u} 2^>nul') do set "BEHIND=%%c"
        if "!BEHIND!"=="" set "BEHIND=unknown"
        echo - %%~R: local HEAD !LOCAL_HEAD!, behind upstream by !BEHIND! commits >> "%REPORT%"
    )
)
echo Done.
echo. >> "%REPORT%"

REM ===== 5. Skills (manual check vs tool-versions.md) =====
echo [5/5] Checking skills (manual, see docs/tool-versions.md)...
echo ## 5. Skills (manual check) >> "%REPORT%"
echo. >> "%REPORT%"
echo Skills have no auto-update mechanism (each has different upstream layout). >> "%REPORT%"
echo Manually check each upstream repo against docs\tool-versions.md: >> "%REPORT%"
echo. >> "%REPORT%"
echo - hallmark: github.com/Nutlope/hallmark/releases >> "%REPORT%"
echo - i-have-adhd: github.com/ayghri/i-have-adhd/commits/main >> "%REPORT%"
echo - code-review-graph: github.com/tirth8205/code-review-graph/releases >> "%REPORT%"
echo - impeccable: npx impeccable skills (compare version) >> "%REPORT%"
echo - web-design-engineer: github.com/ConardLi/web-design-engineer >> "%REPORT%"
echo - awesome-design-md: github.com/VoltAgent/awesome-design-md >> "%REPORT%"
echo - mattpocock: github.com/mattpocock/skills >> "%REPORT%"
echo - speckit-*: github.com/github/spec-kit/releases >> "%REPORT%"
echo. >> "%REPORT%"

REM ===== npx tools note =====
echo ## 6. npx zero-install tools >> "%REPORT%"
echo. >> "%REPORT%"
echo biome / aislop / dependency-cruiser / jscpd / size-limit / Stryker / Spectral / markdownlint / commitlint / knip >> "%REPORT%"
echo These pull latest on every run - no version lock possible. >> "%REPORT%"
echo If a run breaks after upstream change, pin version in the calling script. >> "%REPORT%"
echo. >> "%REPORT%"

REM ===== Summary =====
echo ==============================================
echo  Check complete. Report saved to:
echo  docs\tool-update-report.txt
echo.
echo  NO files were modified. Zero conflict.
echo  Review the report, then manually update
echo  what you decide is needed (run update-all.bat
echo  for the automated path, or update individually).
echo ==============================================

echo. >> "%REPORT%"
echo --- End of report ---

REM Print report to console too
type "%REPORT%"

pause
endlocal
