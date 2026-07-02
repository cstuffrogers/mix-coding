#!/usr/bin/env bash
# start-claude.sh — 在项目目录中启动 Claude Code，带 init 检查
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== Mix-Coding System Launcher ==="
echo ""

# 运行 init 检查
if [ -f "init.sh" ]; then
  bash init.sh || echo "⚠️  Init check had warnings"
  echo ""
fi

claude
echo ""
echo "Claude Code 已退出"
