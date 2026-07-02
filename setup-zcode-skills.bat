@echo off
REM setup-zcode-skills.bat - Deploy Mix-Coding System plugin to ZCode desktop (Windows)
REM Usage: setup-zcode-skills.bat           deploy
REM        setup-zcode-skills.bat --check  check only
REM Mirrors setup-zcode-skills.sh.

setlocal enabledelayedexpansion

set ZCODE_HOME=%USERPROFILE%\.zcode
set CACHE_DIR=%ZCODE_HOME%\cli\plugins\cache\zcode-plugins-official
set MARKETPLACE=%ZCODE_HOME%\cli\plugins\marketplaces\zcode-plugins-official\marketplace.json
set PLUGIN_NAME=auto-coding
set PLUGIN_VERSION=0.1.0
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
set SRC_PLUGIN=%SCRIPT_DIR%\.zcode\plugins\%PLUGIN_NAME%\%PLUGIN_VERSION%
set DST_PLUGIN=%CACHE_DIR%\%PLUGIN_NAME%\%PLUGIN_VERSION%
set ERR=0

set CHECK_ONLY=0
if "%~1"=="--check" set CHECK_ONLY=1

echo.
echo === ZCode Skills Deploy - Mix-Coding System ===
echo.

echo -- 1. Check source plugin --
if not exist "%SRC_PLUGIN%\.zcode-plugin\plugin.json" (
    echo   [FAIL] plugin.json missing
    exit /b 1
)
if not exist "%SRC_PLUGIN%\skills\scene-runner\SKILL.md" (
    echo   [FAIL] scene-runner SKILL.md missing
    exit /b 1
)
echo   [OK] Source plugin ready: .zcode\plugins\%PLUGIN_NAME%\%PLUGIN_VERSION%

echo.
echo -- 2. Check ZCode home --
if not exist "%ZCODE_HOME%" (
    echo   [FAIL] ZCode home not found - install ZCode desktop first
    exit /b 1
)
echo   [OK] ZCode home exists: %ZCODE_HOME%

if "%CHECK_ONLY%"=="1" (
    echo.
    echo --check mode, no deployment
    exit /b %ERR%
)

echo.
echo -- 3. Deploy plugin files to ZCode cache --
if not exist "%DST_PLUGIN%\.zcode-plugin" mkdir "%DST_PLUGIN%\.zcode-plugin"
if not exist "%DST_PLUGIN%\skills\scene-runner" mkdir "%DST_PLUGIN%\skills\scene-runner"
copy /y "%SRC_PLUGIN%\.zcode-plugin\plugin.json" "%DST_PLUGIN%\.zcode-plugin\plugin.json" >nul
copy /y "%SRC_PLUGIN%\.zcode-plugin-seed.json" "%DST_PLUGIN%\.zcode-plugin-seed.json" >nul
copy /y "%SRC_PLUGIN%\package.json" "%DST_PLUGIN%\package.json" >nul
copy /y "%SRC_PLUGIN%\skills\scene-runner\SKILL.md" "%DST_PLUGIN%\skills\scene-runner\SKILL.md" >nul
echo   [OK] Plugin files copied to: %DST_PLUGIN%

echo.
echo -- 4. Register in marketplace.json --
if not exist "%MARKETPLACE%" (
    echo   [FAIL] marketplace.json not found: %MARKETPLACE%
    set ERR=1
    goto summary
)
findstr /c:"auto-coding" "%MARKETPLACE%" >nul 2>&1
if errorlevel 1 (
    echo   [INFO] Registering %PLUGIN_NAME% via node...
    node -e "const fs=require('fs');const p=process.argv[1];const d=JSON.parse(fs.readFileSync(p,'utf-8'));const dst=process.argv[2].replace(/\//g,'\\\\');const e={cachePath:dst,name:'%PLUGIN_NAME%',source:'filesystem',version:'%PLUGIN_VERSION%'};const pl=d.plugins||[];const i=pl.findIndex(x=>x.name>'%PLUGIN_NAME%');if(i===-1)pl.push(e);else pl.splice(i,0,e);d.plugins=pl;fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');console.log('  [OK] Registered %PLUGIN_NAME%');" "%MARKETPLACE%" "%DST_PLUGIN%"
) else (
    echo   [OK] marketplace.json already contains %PLUGIN_NAME%
)

:summary
echo.
if not "%ERR%"=="0" goto fail
echo === [DONE] ZCode Skills Deploy Complete ===
echo Next:
echo   1. Restart ZCode desktop
echo   2. Say /review or /plan in ZCode
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
