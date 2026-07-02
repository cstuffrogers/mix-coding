@echo off
REM setup-codex-global.bat - Deploy Mix-Coding System skills to Codex desktop (Windows)
REM Usage: setup-codex-global.bat           deploy
REM        setup-codex-global.bat --check  check only
REM Mirrors setup-codex-global.sh. Uses copy (not symlink).

setlocal enabledelayedexpansion

set CODEX_HOME=%USERPROFILE%\.codex
set DST_SKILLS=%CODEX_HOME%\skills\auto-coding
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
set SRC_SKILLS=%SCRIPT_DIR%\.agents\skills
set ERR=0

set CHECK_ONLY=0
if "%~1"=="--check" set CHECK_ONLY=1

echo.
echo === Codex Skills Deploy - Mix-Coding System ===
echo.

echo -- 1. Check source skills --
if not exist "%SRC_SKILLS%\scene-runner\SKILL.md" (
    echo   [FAIL] Source skills missing
    exit /b 1
)
echo   [OK] Source skills ready: .agents\skills\

echo.
echo -- 2. Check Codex home --
if not exist "%CODEX_HOME%" (
    echo   [FAIL] Codex home not found - install Codex desktop first
    exit /b 1
)
echo   [OK] Codex home exists: %CODEX_HOME%

if "%CHECK_ONLY%"=="1" (
    echo.
    echo --check mode, no deployment
    exit /b %ERR%
)

echo.
echo -- 3. Deploy skills to Codex global --
if not exist "%DST_SKILLS%" mkdir "%DST_SKILLS%"
xcopy /e /y /i /q "%SRC_SKILLS%" "%DST_SKILLS%" >nul
if errorlevel 1 (
    echo   [FAIL] Copy failed
    set ERR=1
    goto summary
)
echo   [OK] Skills copied to: %DST_SKILLS%

echo.
echo -- 4. Generate openai.yaml metadata --
set YAML_COUNT=0
for /d %%D in ("%DST_SKILLS%\*") do (
    set SKILL_NAME=%%~nxD
    set YAML_DIR=%%D\agents
    set YAML_FILE=!YAML_DIR!\openai.yaml
    if not exist "!YAML_FILE!" (
        if not exist "!YAML_DIR!" mkdir "!YAML_DIR!"
        echo skill: !SKILL_NAME!> "!YAML_FILE!"
        echo display_name: !SKILL_NAME!>> "!YAML_FILE!"
        echo short_description: Auto-coding skill>> "!YAML_FILE!"
        echo default_prompt: Use the !SKILL_NAME! skill to help with this task.>> "!YAML_FILE!"
        set /a YAML_COUNT+=1
    )
)
echo   [OK] openai.yaml metadata confirmed (%YAML_COUNT% new)

echo.
echo -- 5. Verify key skill --
if not exist "%DST_SKILLS%\scene-runner\SKILL.md" (
    echo   [FAIL] scene-runner skill missing
    set ERR=1
    goto summary
)
echo   [OK] scene-runner skill ready (maps /review /plan /refactor etc.)

:summary
echo.
if not "%ERR%"=="0" goto fail
echo === [DONE] Codex Skills Deploy Complete ===
echo Next:
echo   1. Restart Codex desktop
echo   2. Say /review or /plan in Codex
echo   3. scene-runner skill maps commands to engine CLI
echo.
echo Commands: /review /feature /bugfix /refactor /plan /optimize
echo            /ui-polish /hunt /release /deps /check /qa /loop etc.
echo Merged: /audit-^>/review /simplify-^>/refactor /design-^>/ui-polish
goto end
:fail
echo === [FAIL] %ERR% problem(s) found ===
:end
exit /b %ERR%
