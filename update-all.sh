#!/usr/bin/env bash
# update-all.sh — Mix-Coding 一键全量更新
# 用法: ./update-all.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "=============================================="
echo " Mix-Coding Update All — 全量更新"
echo "=============================================="
echo ""

# ── 1. npm 包更新 ──
echo -e "${CYAN}[1/7]${NC} npm 依赖更新..."
cd "$SCRIPT_DIR/claude-scene"
npm update --legacy-peer-deps 2>&1 && echo -e "  ${GREEN}[OK]${NC} claude-scene npm 依赖更新完成" || echo -e "  ${YELLOW}[WARN]${NC} npm update 有错误，跳过"

echo -e "${CYAN}[2/7]${NC} 项目根依赖安装 (Stagehand + zod)..."
cd "$SCRIPT_DIR"
npm install --legacy-peer-deps 2>&1 && echo -e "  ${GREEN}[OK]${NC} 根依赖安装完成" || echo -e "  ${YELLOW}[WARN]${NC} 根依赖安装有错误"

echo -e "${CYAN}[3/7]${NC} mythos-agent 安装/更新..."
if command -v mythos-agent &>/dev/null; then
    npm update -g mythos-agent 2>&1 && echo -e "  ${GREEN}[OK]${NC} mythos-agent 已更新" || echo -e "  ${GREEN}[OK]${NC} mythos-agent 保持当前版本"
else
    npm install -g mythos-agent 2>&1 && echo -e "  ${GREEN}[OK]${NC} mythos-agent 安装完成" || echo -e "  ${YELLOW}[WARN]${NC} mythos-agent 安装失败"
fi

# ── 2. Python 包更新 ──
echo ""
echo -e "${CYAN}[4/7]${NC} Python 工具更新..."

if command -v python &>/dev/null; then
    PY_CMD="python"
elif command -v python3 &>/dev/null; then
    PY_CMD="python3"
else
    PY_CMD=""
fi

if [ -n "$PY_CMD" ]; then
    # seraphim-audit
    echo "  更新 seraphim-audit..."
    $PY_CMD -m pip install --upgrade -r "$SCRIPT_DIR/requirements.txt" 2>&1 && echo -e "  ${GREEN}[OK]${NC} seraphim-audit" || echo -e "  ${YELLOW}[SKIP]${NC} seraphim-audit"

    # skillspector
    echo "  更新 skillspector..."
    $PY_CMD -m pip install --upgrade git+https://github.com/NVIDIA/skillspector.git 2>&1 && echo -e "  ${GREEN}[OK]${NC} skillspector" || echo -e "  ${YELLOW}[SKIP]${NC} skillspector (npx 备选)"

    # GEPA
    echo "  更新 GEPA..."
    $PY_CMD -m pip install --upgrade gepa 2>&1 && echo -e "  ${GREEN}[OK]${NC} gepa" || echo -e "  ${YELLOW}[SKIP]${NC} gepa"
else
    echo -e "  ${YELLOW}[SKIP]${NC} Python 未安装"
fi

# ── 3. Git 仓库更新 ──
echo ""
echo -e "${CYAN}[5/7]${NC} Git 仓库同步上游..."

GIT_REPOS=(
    "$SCRIPT_DIR/open-design"
    "$SCRIPT_DIR/.mcp/resend-mcp"
    "$SCRIPT_DIR/.mcp/sentry-mcp"
    "$SCRIPT_DIR/.mcp/stripe-mcp"
    "$SCRIPT_DIR/.mcp/supabase-mcp"
    "$SCRIPT_DIR/.mcp/tavily-mcp"
)

for repo in "${GIT_REPOS[@]}"; do
    if [ -d "$repo/.git" ]; then
        echo -n "  $(basename "$repo") ... "
        cd "$repo"
        BEFORE=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
        git pull --ff-only 2>&1 > /dev/null && {
            AFTER=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
            if [ "$BEFORE" != "$AFTER" ]; then
                echo -e "${GREEN}已更新${NC}"
            else
                echo -e "${GREEN}已是最新${NC}"
            fi
        } || echo -e "${YELLOW}跳过（有本地修改）${NC}"
    fi
done

# ── 4. 二进制工具检查 ──
echo ""
echo -e "${CYAN}[6/7]${NC} 二进制工具版本检查..."

check_bin() {
    local name=$1
    local cmd=$2
    if command -v "$name" &>/dev/null; then
        local ver
        ver=$($cmd 2>&1 | head -1 | cut -c1-60)
        echo -e "  ${GREEN}[OK]${NC} $ver"
    else
        echo -e "  ${YELLOW}[--]${NC} $name 未安装"
    fi
}

check_bin "lychee" "lychee --version"
check_bin "act" "act --version"
check_bin "restic" "restic version"

# ── 5. npx 工具（无需操作）──
echo ""
echo -e "${CYAN}[7/7]${NC} npx 零安装工具（aislop/dependency-cruiser/jscpd/size-limit/Stryker/Spectral/markdownlint/knip）"
echo -e "  ${GREEN}[OK]${NC} 每次执行自动拉最新版，无需手动更新"

echo ""
echo "=============================================="
echo -e "${GREEN} 全量更新完成！${NC}"
echo "=============================================="
echo ""
echo "下次建议执行: $(date -d '+1 month' '+%Y-%m-%d' 2>/dev/null || echo '一个月后')"
echo ""
