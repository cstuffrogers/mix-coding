@echo off
rem ============================================================
rem  install-percho.bat — Mix-Coding System 一键安装（pi / percho）
rem  编码: GBK（中文 Windows cmd 原生解析，无需 chcp）
rem
rem  用法（双击或命令行）:
rem    install-percho.bat              安装（幂等，可重复执行）
rem    install-percho.bat --check      只检查现状，不改任何文件
rem    install-percho.bat --uninstall  卸载（只删本脚本装的文件）
rem    install-percho.bat --no-pause   安装完不暂停（CI 用）
rem
rem  做什么:
rem    1. 环境检查（Node 20+ / Git / npm）
rem    2. 安装项目依赖（node_modules 缺失时）
rem    3. claude-scene 引擎 npm link → 全局 PATH 可调用
rem    4. 32 个斜杠命令  → %USERPROFILE%\.pi\agent\prompts\
rem    5. scene-runner skill → %USERPROFILE%\.pi\agent\skills\
rem    6. 33 个 Claude Code 命令 → %USERPROFILE%\.claude\commands\
rem    7. 冒烟测试：引擎 list 场景
rem
rem  之后在 percho 里执行 /reload（或重开窗口），
rem  任意项目目录都能直接用 /review /feature /bugfix ...
rem ============================================================

setlocal EnableExtensions
set "PROJECT="
for %%i in ("%~dp0..") do set "PROJECT=%%~fi"
set "PI_DIR=%USERPROFILE%\.pi\agent"
set "CLAUDE_DIR=%USERPROFILE%\.claude"
set "ENGINE_DIR=%PROJECT%\claude-scene"
set "ENGINE=%ENGINE_DIR%\src\index.js"
set "ERR=0"
set "MODE=install"
set "PAUSE=1"

if /i "%~1"=="--check"     set "MODE=check"
if /i "%~1"=="--uninstall" set "MODE=uninstall"
if /i "%~1"=="--no-pause"  set "PAUSE=0"
if /i "%~2"=="--no-pause"  set "PAUSE=0"
if /i "%~3"=="--no-pause"  set "PAUSE=0"
if /i "%~4"=="--no-pause"  set "PAUSE=0"
if /i "%~1"=="--help"      goto :usage
if /i "%~1"=="-h"          goto :usage

pushd "%PROJECT%" || (echo [X] 无法进入项目目录 %PROJECT% & goto :end_fail)

echo.
echo  ==============================================================
echo    Mix-Coding System — pi / percho 一键安装
echo    模式: %MODE%
echo  ==============================================================

rem ============ 1. 环境检查 ============
echo.
echo  -- 1/6 环境检查 --
set "NODE_MAJOR="
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%v"
if "%NODE_MAJOR%"=="" goto :node_missing
if %NODE_MAJOR% LSS 20 goto :node_old
for /f "delims=" %%v in ('node --version') do echo    [OK] Node.js %%v
where git >nul 2>&1
if %errorlevel% EQU 0 (
    for /f "tokens=3 delims= " %%g in ('git --version') do echo    [OK] Git %%g
) else (
    echo    [!] Git 未安装，引擎可用，但工作流中的 git 步骤会降级
)
where npm >nul 2>&1
if %errorlevel% NEQ 0 (
    echo    [X] npm 未安装
    goto :end_fail
)

rem ============ 2. 引擎完整性 ============
echo.
echo  -- 2/6 引擎完整性 --
if exist "%ENGINE%" (echo    [OK] Scene 引擎入口 claude-scene\src\index.js) else (
    echo    [X] 引擎入口缺失: %ENGINE%
    set /a ERR+=1
    goto :end_fail
)
set "SCENE_N=0"
for /f "delims=" %%f in ('dir /b "%PROJECT%\.claude\scenes\*.json" 2^>nul') do set /a SCENE_N+=1
if %SCENE_N% GTR 0 (echo    [OK] 场景定义 %SCENE_N% 个工作流) else (
    echo    [X] .claude\scenes\ 下无场景 JSON
    set /a ERR+=1
)

rem ============ 3. 依赖与全局链接 ============
echo.
echo  -- 3/6 依赖与全局链接 --
if not exist "%PROJECT%\node_modules" (
    echo    根目录 node_modules 缺失，执行 npm install ...
    call npm install --no-fund --no-audit >nul 2>&1
    if %errorlevel% NEQ 0 (
        echo    [X] 根目录 npm install 失败，手动执行: cd /d "%PROJECT%" 再 npm install
        set /a ERR+=1
    ) else (
        echo    [OK] 根目录依赖就绪
    )
) else (
    echo    [OK] 根目录依赖就绪
)
if not exist "%ENGINE_DIR%\node_modules" (
    echo    引擎依赖缺失，执行 npm install ...
    pushd "%ENGINE_DIR%"
    call npm install --no-fund --no-audit >nul 2>&1
    if %errorlevel% NEQ 0 (
        echo    [X] claude-scene npm install 失败
        set /a ERR+=1
    )
    popd
) else (
    echo    [OK] 引擎依赖就绪
)
where claude-scene >nul 2>&1
if %errorlevel% NEQ 0 (
    echo    claude-scene 不在 PATH，执行 npm link ...
    pushd "%ENGINE_DIR%"
    call npm link >nul 2>&1
    popd
)
where claude-scene >nul 2>&1
if %errorlevel% EQU 0 (
    echo    [OK] claude-scene 已全局可调用
) else (
    echo    [X] npm link 后仍找不到 claude-scene，手动执行:
    echo        cd /d "%ENGINE_DIR%" 再 npm link
    set /a ERR+=1
    goto :end_fail
)

rem ============ 4. 源模板清点 ============
set "PROMPT_N=0"
set "SKILL_N=0"
set "CMD_N=0"
for /f "delims=" %%f in ('dir /b "%PROJECT%\.pi\prompts\*.md" 2^>nul') do set /a PROMPT_N+=1
for /f "delims=" %%f in ('dir /b /s "%PROJECT%\.pi\skills\SKILL.md" 2^>nul') do set /a SKILL_N+=1
for /f "delims=" %%f in ('dir /b "%PROJECT%\.claude\commands\*.md" 2^>nul') do set /a CMD_N+=1
echo.
echo  -- 4/6 源模板 --
echo    pi 命令模板   : %PROMPT_N% 个  (.pi\prompts)
echo    pi skills     : %SKILL_N% 个  (.pi\skills)
echo    Claude 命令   : %CMD_N% 个  (.claude\commands)
findstr /s /m /i /c:"E:/auto-coding" /c:"E:\\auto-coding" "%PROJECT%\.pi\prompts\*.md" "%PROJECT%\.claude\commands\*.md" >nul 2>&1
if %errorlevel% EQU 0 (
    echo    [X] 模板中存在硬编码绝对路径，装到别处会失效，请先修复
    set /a ERR+=1
    goto :end_fail
)
echo    [OK] 模板无硬编码绝对路径

rem ============ 5. 分发 ============
if "%MODE%"=="uninstall" goto :do_uninstall
if "%MODE%"=="check"     goto :do_check
goto :do_install

:do_install
echo.
echo  -- 5/6 安装到用户目录 --
echo    目标: %PI_DIR%
rem 模板同步 = 拷 + 删。仓库里退役的命令名（如 /hunt 已并入 /review）不会自己消失，
rem 只拷不删的话它们会在用户机上永远活着 —— 所以交给 scripts/sync-prompts.mjs。
rem --quiet 只打 ASCII：本文件是 GBK 且不 chcp，node 的 UTF-8 中文会是乱码
node "%PROJECT%\scripts\sync-prompts.mjs" --src "%PROJECT%\.pi\prompts" --dst "%PI_DIR%\prompts" --quiet
if errorlevel 1 (
    echo    [X] pi 命令模板同步失败
    set /a ERR+=1
) else (
    echo    [OK] pi 命令模板 -^> %PI_DIR%\prompts  ^(含退役清理^)
)
robocopy "%PROJECT%\.pi\skills" "%PI_DIR%\skills" /E /NFL /NDL /NJH /NJS /NP >nul
call :robocopy_step "scene-runner skill → %PI_DIR%\skills"
where claude >nul 2>&1
if errorlevel 1 (
    echo     [SKIP] Claude Code not installed - %CLAUDE_DIR%\commands not created
) else (
    robocopy "%PROJECT%\.claude\commands" "%CLAUDE_DIR%\commands" *.md /NFL /NDL /NJH /NJS /NP >nul
    call :robocopy_step "Claude   %CLAUDE_DIR%\commands"
)
echo    （同名文件会被更新；幂等可重复执行）
goto :smoke

:do_check
echo.
echo  -- 5/6 现状检查 --
set "HAVE_P=0"
set "HAVE_C=0"
for /f "delims=" %%f in ('dir /b "%PI_DIR%\prompts\*.md" 2^>nul') do set /a HAVE_P+=1
for /f "delims=" %%f in ('dir /b "%CLAUDE_DIR%\commands\*.md" 2^>nul') do set /a HAVE_C+=1
echo    pi 个人模板 %PI_DIR%\prompts : %HAVE_P% 个（源 %PROMPT_N%）
echo    Claude 全局 %CLAUDE_DIR%\commands : %HAVE_C% 个（源 %CMD_N%）
rem 一致与否只看退出码（--check 只打 ASCII，本文件是 GBK 且不 chcp）
node "%PROJECT%\scripts\sync-prompts.mjs" --src "%PROJECT%\.pi\prompts" --dst "%PI_DIR%\prompts" --check
if errorlevel 1 (
    echo    [!] pi 模板与仓库不一致 ^(或存在退役残留^) - 执行 install-percho.bat
) else (
    echo    [OK] pi 命令已全局可用，且无退役残留
)
goto :smoke

:do_uninstall
echo.
echo  -- 5/6 卸载（只删本脚本装的文件） --
set /a REMOVED=0
for %%f in ("%PROJECT%\.pi\prompts\*.md") do (
    if exist "%PI_DIR%\prompts\%%~nxf" del /q "%PI_DIR%\prompts\%%~nxf" && set /a REMOVED+=1
)
rem 同步清单也一并清掉，否则下次安装会以为这些模板是「上一轮自己装的」
if exist "%PI_DIR%\prompts\.mix-coding-installed.json" del /q "%PI_DIR%\prompts\.mix-coding-installed.json"
for %%f in ("%PROJECT%\.claude\commands\*.md") do (
    if exist "%CLAUDE_DIR%\commands\%%~nxf" del /q "%CLAUDE_DIR%\commands\%%~nxf" && set /a REMOVED+=1
)
for /d %%d in ("%PROJECT%\.pi\skills\*") do (
    if exist "%PI_DIR%\skills\%%~nxd\SKILL.md" del /q "%PI_DIR%\skills\%%~nxd\SKILL.md" && set /a REMOVED+=1
)
echo    已删除 %REMOVED% 个文件（用户自有文件未触碰）
echo    如需撤销 npm link: cd /d "%ENGINE_DIR%" 再 npm unlink -g
goto :finish

rem robocopy 返回码: 0-7 成功, >=8 失败。独立子过程避免复合语句解析问题。
:robocopy_step
if %errorlevel% GEQ 8 (
    echo    [X] 复制失败 ^(robocopy rc=%errorlevel%^)
    set /a ERR+=1
) else (
    echo    [OK] %~1
)
exit /b 0

rem ============ 6. 冒烟测试 ============
:smoke
echo.
echo  -- 6/6 引擎冒烟测试 --
set "SMOKE_N=0"
for /f "delims=" %%f in ('node "%ENGINE%" list 2^>nul') do set /a SMOKE_N+=1
if %SMOKE_N% GEQ 10 (
    echo    [OK] 引擎正常，可列出 %SMOKE_N% 行场景清单
) else (
    echo    [X] 引擎 list 输出异常（%SMOKE_N% 行），检查: node "%ENGINE%" list
    set /a ERR+=1
)

:finish
popd
echo.
echo  ==============================================================
if "%MODE%"=="uninstall" goto :summary_uninstalled
if not "%ERR%"=="0" goto :summary_err
echo    [OK] 完成 — 任意项目目录都能用斜杠命令
echo    ----------------------------------------------------------
echo    生效方式（percho / pi）: 执行 /reload 或重开窗口
echo    然后在任意项目里输入:  /review  /feature  /bugfix ...
echo    场景引擎直跑:          claude-scene start review --auto
goto :summary_end
:summary_uninstalled
echo    已卸载。
goto :summary_end
:summary_err
echo    [X] 有 %ERR% 个问题需先处理（见上方 [X] 标记）
:summary_end
echo  ==============================================================
if "%PAUSE%"=="1" pause
exit /b %ERR%

:node_missing
echo    [X] Node.js 未安装（https://nodejs.org）
set /a ERR+=1
goto :end_fail

:node_old
echo    [X] Node.js 版本过低（主版本 %NODE_MAJOR%，需 20 以上）
set /a ERR+=1
goto :end_fail

:end_fail
popd 2>nul
echo.
echo  ==============================================================
echo    [X] 安装中止 — 有 %ERR% 个致命问题
echo  ==============================================================
if "%PAUSE%"=="1" pause
exit /b %ERR%

:usage
echo.
echo  用法: install-percho.bat [--check^|--uninstall^|--no-pause^|--help]
echo    （默认）安装并验证，幂等可重复执行
echo    --check      只检查现状，不改文件
echo    --uninstall  卸载本脚本装的文件
echo    --no-pause   结束不暂停（CI/脚本调用）
exit /b 0
