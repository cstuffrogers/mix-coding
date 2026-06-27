#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  Mix-Coding System — 完整安装脚本
#  https://github.com/TRAE-AI/mix-coding
#
#  用法:
#    chmod +x install.sh && ./install.sh
#    ./install.sh --skip-mcp        # 跳过 MCP 服务器安装
#    ./install.sh --skip-opendigger # 跳过 OpenDigger 安装
#    ./install.sh --skip-opendesign # 跳过 Open Design 安装
# ============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'

# ----- 参数解析 -----
SKIP_MCP=false; SKIP_OPENDIGGER=false; SKIP_OPENDESIGN=false; SKIP_ECC=false; SKIP_CODEGRAPH=false
for arg in "$@"; do
  case $arg in
    --skip-mcp) SKIP_MCP=true ;;
    --skip-opendigger) SKIP_OPENDIGGER=true ;;
    --skip-opendesign) SKIP_OPENDESIGN=true ;;
    --skip-ecc) SKIP_ECC=true ;;
    --skip-codegraph) SKIP_CODEGRAPH=true ;;
    --help|-h) echo "用法: ./install.sh [--skip-mcp] [--skip-opendigger] [--skip-opendesign] [--skip-ecc] [--skip-codegraph]"; exit 0 ;;
  esac
done

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_MIN=18

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  Mix-Coding System — 环境安装${NC}"
echo -e "${CYAN}  项目目录: ${PROJECT_DIR}${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# ============================================================
#  检测函数
# ============================================================
check_cmd() { command -v "$1" &>/dev/null; }
check_node_version() {
  check_cmd node || return 1
  local v; v=$(node -v | sed 's/v//' | cut -d. -f1)
  [ "$v" -ge "$NODE_MIN" ]
}

step_skip()  { echo -e "  ${DIM}⏭ $1 (已安装/跳过)${NC}"; }
step_ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
step_doing() { echo -e "  ${YELLOW}⏳${NC} $1"; }

# ============================================================
#  1. 系统包管理器检测
# ============================================================
echo -e "${CYAN}[1/11] 检测系统环境${NC}"

PKG_MGR=""
if check_cmd apt-get; then
  PKG_MGR="apt"
elif check_cmd brew; then
  PKG_MGR="brew"
elif check_cmd dnf; then
  PKG_MGR="dnf"
elif check_cmd yum; then
  PKG_MGR="yum"
elif check_cmd pacman; then
  PKG_MGR="pacman"
elif check_cmd apk; then
  PKG_MGR="apk"
fi

OS="$(uname -s)"
if [ "$PKG_MGR" = "" ]; then
  if [ "$OS" = "Darwin" ]; then PKG_MGR="brew"; else PKG_MGR="apt"; fi
  echo -e "  ${YELLOW}⚠ 未检测到包管理器，默认使用: $PKG_MGR${NC}"
else
  echo -e "  ${GREEN}✓${NC} 包管理器: $PKG_MGR | 系统: $OS"
fi

# ============================================================
#  2. Git
# ============================================================
echo ""
echo -e "${CYAN}[2/11] Git${NC}"

if check_cmd git; then
  step_skip "Git $(git --version | awk '{print $3}')"
else
  step_doing "安装 Git..."
  case $PKG_MGR in
    apt) sudo apt-get install -y git ;;
    brew) brew install git ;;
    dnf|yum) sudo $PKG_MGR install -y git ;;
    pacman) sudo pacman -S --noconfirm git ;;
    apk) sudo apk add git ;;
  esac
  step_ok "Git 安装完成"
fi

# ============================================================
#  3. Node.js (via nvm 或系统包)
# ============================================================
echo ""
echo -e "${CYAN}[3/11] Node.js (≥v${NODE_MIN})${NC}"

if check_node_version; then
  step_skip "Node.js $(node -v) | npm $(npm -v)"
else
  if check_cmd node; then
    echo -e "  ${YELLOW}⚠ Node.js $(node -v) 版本过低，需要 ≥v${NODE_MIN}${NC}"
  fi

  # 优先用 nvm
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    step_skip "nvm 已安装，正在安装 Node.js v22..."
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    step_ok "Node.js $(node -v)"
  elif [ -s "/usr/local/share/nvm/nvm.sh" ]; then
    step_skip "nvm (brew) 已安装"
    export NVM_DIR="/usr/local/share/nvm"
    . "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    step_ok "Node.js $(node -v)"
  else
    step_doing "安装 nvm + Node.js v22..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    step_ok "Node.js $(node -v) | npm $(npm -v)"
  fi
fi

# ============================================================
#  4. Claude Code CLI
# ============================================================
echo ""
echo -e "${CYAN}[4/11] Claude Code CLI${NC}"

if check_cmd claude; then
  step_skip "Claude Code $(claude --version 2>/dev/null || echo 'OK')"
else
  step_doing "安装 Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code 2>/dev/null || \
    npm install -g claude-code 2>/dev/null || \
    echo -e "  ${YELLOW}⚠ Claude Code 安装失败，请手动安装: npm install -g @anthropic-ai/claude-code${NC}"
  if check_cmd claude; then
    step_ok "Claude Code 安装完成"
  fi
fi

# ============================================================
#  5. CodeGraph (代码知识图谱)
# ============================================================
echo ""
echo -e "${CYAN}[5/11] CodeGraph (代码索引引擎)${NC}"

if [ "$SKIP_CODEGRAPH" = true ]; then
  step_skip "已通过 --skip-codegraph 跳过"
elif [ -d "$PROJECT_DIR/codegraph-win32-x64" ] || check_cmd codegraph; then
  step_skip "CodeGraph 已存在"
else
  step_doing "下载 CodeGraph..."
  CODECRAPH_URL="https://github.com/anthropics/codegraph/releases/latest/download/codegraph-linux-x64.zip"
  # macOS
  if [ "$OS" = "Darwin" ]; then
    CODECRAPH_URL="https://github.com/anthropics/codegraph/releases/latest/download/codegraph-darwin-x64.zip"
  fi
  curl -L -o /tmp/codegraph.zip "$CODECRAPH_URL" 2>/dev/null && \
    unzip -o /tmp/codegraph.zip -d "$PROJECT_DIR/codegraph" && \
    rm /tmp/codegraph.zip && \
    step_ok "CodeGraph 安装完成" || \
    echo -e "  ${YELLOW}⚠ CodeGraph 下载失败，可稍后手动安装${NC}"
fi

# ============================================================
#  6. 全局 npm 工具 (eslint, typescript, vitest, playwright)
# ============================================================
echo ""
echo -e "${CYAN}[6/11] 全局开发工具${NC}"

GLOBAL_TOOLS=("eslint" "typescript" "vitest" "playwright")
for tool in "${GLOBAL_TOOLS[@]}"; do
  case $tool in
    eslint)
      if check_cmd npx && npx eslint --version &>/dev/null; then step_skip "eslint"; else
        step_doing "安装 eslint..."
        npm install -g eslint && step_ok "eslint"
      fi
      ;;
    typescript)
      if check_cmd tsc; then step_skip "TypeScript $(tsc --version | awk '{print $2}')"; else
        step_doing "安装 TypeScript..."
        npm install -g typescript && step_ok "TypeScript"
      fi
      ;;
    vitest)
      if check_cmd vitest; then step_skip "vitest"; else
        step_doing "安装 vitest..."
        npm install -g vitest && step_ok "vitest"
      fi
      ;;
    playwright)
      if check_cmd playwright; then step_skip "playwright"; else
        step_doing "安装 Playwright (含浏览器)..."
        npm install -g @playwright/test && npx playwright install --with-deps chromium 2>/dev/null || \
          echo -e "  ${YELLOW}⚠ Playwright 浏览器安装失败，可稍后执行: npx playwright install${NC}"
        step_ok "playwright"
      fi
      ;;
  esac
done

# ============================================================
#  7. 项目 npm 依赖
# ============================================================
echo ""
echo -e "${CYAN}[7/11] 项目依赖${NC}"

install_npm_if_needed() {
  local dir="$1"; local label="$2"
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    if [ -d "$dir/node_modules" ]; then
      step_skip "$label (node_modules 已存在)"
    else
      step_doing "安装 $label..."
      (cd "$dir" && npm install --legacy-peer-deps 2>&1 | tail -1) && step_ok "$label"
    fi
  fi
}

install_npm_if_needed "$PROJECT_DIR" "根项目"
install_npm_if_needed "$PROJECT_DIR/claude-scene" "claude-scene"
install_npm_if_needed "$PROJECT_DIR/open-design" "open-design"
install_npm_if_needed "$PROJECT_DIR/open-digger" "open-digger"
install_npm_if_needed "$PROJECT_DIR/ecc/source" "ecc"

# ============================================================
#  8. OpenDigger CLI (竞品分析)
# ============================================================
echo ""
echo -e "${CYAN}[9/11] OpenDigger (竞品分析引擎)${NC}"

if [ "$SKIP_OPENDIGGER" = true ]; then
  step_skip "已通过 --skip-opendigger 跳过"
elif [ -d "$PROJECT_DIR/open-digger" ]; then
  step_skip "OpenDigger 已存在"
elif check_cmd npx && npx open-digger --version &>/dev/null; then
  step_skip "OpenDigger CLI 已全局安装"
else
  step_doing "安装 OpenDigger..."
  npm install -g open-digger 2>/dev/null && step_ok "OpenDigger" || \
    echo -e "  ${YELLOW}⚠ OpenDigger 安装失败（非关键组件）${NC}"
fi

# ============================================================
#  9. Open Design (AI 设计引擎)
# ============================================================
echo ""
echo -e "${CYAN}[10/11] Open Design (UI 设计引擎)${NC}"

if [ "$SKIP_OPENDESIGN" = true ]; then
  step_skip "已通过 --skip-opendesign 跳过"
elif [ -d "$PROJECT_DIR/open-design" ]; then
  if [ -f "$PROJECT_DIR/open-design/node_modules/.package-lock.json" ] || \
     [ -d "$PROJECT_DIR/open-design/node_modules" ]; then
    step_skip "Open Design 已安装"
  else
    step_doing "安装 Open Design 依赖..."
    (cd "$PROJECT_DIR/open-design" && pnpm install 2>/dev/null || npm install --legacy-peer-deps) && \
      step_ok "Open Design" || \
      echo -e "  ${YELLOW}⚠ Open Design 依赖安装失败（非关键组件）${NC}"
  fi
else
  step_skip "Open Design 目录不存在，跳过"
fi

# ============================================================
#  10. MCP 服务器 (可选)
# ============================================================
echo ""
echo -e "${CYAN}[11/11] MCP 服务器${NC}"

if [ "$SKIP_MCP" = true ]; then
  step_skip "已通过 --skip-mcp 跳过"
else
  MCP_DIR="$PROJECT_DIR/.mcp"
  MCP_INSTALLED=0
  for mcp in resend-mcp sentry-mcp supabase-mcp tavily-mcp stripe-mcp; do
    if [ -f "$MCP_DIR/$mcp/package.json" ]; then
      if [ -d "$MCP_DIR/$mcp/node_modules" ]; then
        step_skip "$mcp"
        ((MCP_INSTALLED++)) || true
      else
        step_doing "安装 $mcp..."
        (cd "$MCP_DIR/$mcp" && npm install --legacy-peer-deps 2>&1 | tail -1) && \
          { step_ok "$mcp"; ((MCP_INSTALLED++)) || true; } || \
          echo -e "  ${YELLOW}⚠ $mcp 安装失败（非关键）${NC}"
      fi
    fi
  done
  if [ "$MCP_INSTALLED" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} 共 $MCP_INSTALLED 个 MCP 服务器就绪"
  fi
fi

# ============================================================
#  完成
# ============================================================
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}  安装完成！${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
echo -e "  项目目录: ${GREEN}$PROJECT_DIR${NC}"
echo ""
echo -e "  已验证的环境:"
echo -e "    Git:          $(git --version 2>/dev/null | head -1 || echo '未安装')"
echo -e "    Node.js:      $(node -v 2>/dev/null || echo '未安装')"
echo -e "    npm:          $(npm -v 2>/dev/null || echo '未安装')"
echo -e "    Claude Code:  $(claude --version 2>/dev/null || echo '未安装')"
echo -e "    TypeScript:   $(tsc --version 2>/dev/null || echo '未安装')"
echo -e "    ESLint:       $(npx eslint --version 2>/dev/null || echo '未安装')"
echo -e "    Playwright:   $(npx playwright --version 2>/dev/null || echo '未安装')"
echo ""
echo -e "  启动方式:"
echo -e "    ${YELLOW}claude-scene list${NC}          # 查看所有工作流"
echo -e "    ${YELLOW}claude-scene start <场景>${NC}   # 启动指定工作流"
echo ""
echo -e "  如需安装 CodeGraph 索引:"
echo -e "    ${YELLOW}cd $PROJECT_DIR && codegraph index${NC}"
echo ""
