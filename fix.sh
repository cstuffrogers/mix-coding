#!/usr/bin/env bash
# fix.sh - Mix-Coding 项目修复/初始化脚本（macOS/Linux）
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "Mix-Coding 项目初始化"
echo "=============================================================="
echo ""
echo "项目目录: $PROJECT_ROOT"
echo ""

# 创建 .claude 目录结构
echo "创建 .claude 目录结构..."
mkdir -p .claude/skills .claude/commands .claude/mcp
echo "  ✅ .claude/ 目录结构创建完成"
echo ""

# 验证
if [ -d ".claude/skills" ]; then
  echo "✅ 目录创建成功"
else
  echo "❌ 目录创建失败 - 请检查权限"
  exit 1
fi
echo ""

# 安装说明
echo "下一步安装步骤说明:"
echo "--------------------------------------------------------------"
echo "1. 安装 Node.js 依赖:"
echo "   cd claude-scene && npm install"
echo ""
echo "2. 安装外部工具（可选）:"
echo "   bash install-tools.sh"
echo ""
echo "3. 安装 MCP 服务器:"
echo "   claude mcp init --quiet"
echo ""
echo "4. 验证:"
echo "   claude skills list"
echo ""
echo "现在可以运行:"
echo "  a) 手动执行上述命令"
echo "  b) cd $PROJECT_ROOT && claude 启动 Claude Code"
echo ""
echo "重要提示:"
echo "  如果 claude 命令不可用，请先安装 Claude Code:"
echo "  macOS:  brew install --cask claude-code"
echo '  Linux:  curl -fsSL https://claude.ai/install.sh | bash'
