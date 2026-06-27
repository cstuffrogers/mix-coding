#!/usr/bin/env bash
# start-claude.sh - 在项目目录中启动 Claude Code
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
claude
echo ""
echo "Claude Code 已退出"
