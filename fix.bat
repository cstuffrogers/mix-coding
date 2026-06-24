# fix.bat - Windows批处理修复脚本
# 用于避免所有PowerShell语法问题，最简单的批处理脚本

@echo off

cls

echo 正在准备修复Mix-Coding组件...
echo ==============================================================
echo.

:: 设置项目目录
set PROJECT_ROOT=%~dp0
cd /d %PROJECT_ROOT%

echo 项目目录: %PROJECT_ROOT%
echo.

:: 第一步：创建claude目录结构
@echo off & echo 创建claude目录结构... & echo.

:: 使用内置Windows命令创建目录
if not exist ".claude" mkdir ".claude"
if not exist ".claude\skills" mkdir ".claude\skills"
if not exist ".claude\commands" mkdir ".claude\commands"
if not exist ".claude\mcp" mkdir ".claude\mcp"

echo ✅ claude目录结构创建完成
echo   - .claude/
echo   - .claude/skills/
echo   - .claude/commands/
echo   - .claude/mcp/
echo.

:: 第二步：验证目录创建结果
if exist ".claude\skills" (
    echo ✅ 目录创建成功
) else (
    echo ❌ 目录创建失败 - 请手动检查权限问题
)

echo.

:: 第三步：显示操作说明而不是自动安装
@echo off & echo 下一步安装步骤说明:
echo --------------------------------------------------------------
echo 1. 安装Claude官方技能包 (官方推荐方法):
echo   npm install -g @anthropic-ai/skills --legacy-peer-deps
echo   可以使用 yarn 代替: yarn global add @anthropic-ai/skills
echo.
echo 2. 安装claude-mem记忆技能:
echo   curl -fsSL https://gist.githubusercontent.com/anthropic-ai/claude-skills/main/claude-mem/claude-mem.skill -o .claude/skills/claude-mem.skill
echo.
echo 3. 安装MCP服务器:
echo   npm install -g @anthropic-ai/claude-code-mcp
echo   claude mcp init --quiet
echo.
echo 4. 验证和激活:
echo   claude skills list
necho   claude skills install all
necho   claude code %PROJECT_ROOT%


echo 您现在可以:
echo a) 按照上述说明手动运行安装命令
necho b) 使用claude skills list在安装后激活技能
echo c) 运行claude code e:\\auto-coding 启动Claude编码
echo.
echo 安装源文件位于: %PROJECT_ROOT%\fix_components.sh (如果需要调试)
echo 成功安装后应该可以看到以下文件:
echo   - .claude/skills/claude-mem.skill

echo.
echo 重要提示:
echo 如果claude命令不可用，需要先安装Claude AI:
echo Windows: irm https://claude.ai/install.ps1 ^| iex
pause

