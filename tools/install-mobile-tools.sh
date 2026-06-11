#!/bin/bash
# 移动端工作流 — 一键安装所有工具
# 用法: bash install-mobile-tools.sh
# 支持: Windows (Git Bash/WSL) / macOS / Linux

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[SKIP]${NC} $1"; }
err()   { echo -e "${RED}[FAIL]${NC} $1"; }

echo "========================================="
echo "  移动端工作流工具安装"
echo "========================================="
echo ""

# ==========================================
# 1. Python 工具
# ==========================================
echo "--- Python 工具 ---"

# mobsfscan: 源码级 SAST
if pip install mobsfscan 2>/dev/null; then
  info "mobsfscan $(mobsfscan --version 2>&1 | head -1)"
else
  err "mobsfscan 安装失败"
fi

# ==========================================
# 2. Node.js 全局工具
# ==========================================
echo ""
echo "--- Node.js 全局工具 ---"

# Bearer CLI: PII/GDPR 隐私扫描
if npm install -g @bearer/cli 2>/dev/null; then
  info "bearer $(bearer version 2>&1 | head -1)"
else
  err "bearer CLI 安装失败"
fi

# Detox CLI: RN E2E
if npm install -g detox-cli 2>/dev/null; then
  info "detox-cli installed"
else
  err "detox-cli 安装失败"
fi

# react-native-community/cli: RN 环境检查
if npm install -g @react-native-community/cli 2>/dev/null; then
  info "react-native-community/cli installed"
else
  err "@react-native-community/cli 安装失败"
fi

# bundle-visualizer: JS Bundle 分析
if npm install -g react-native-bundle-visualizer 2>/dev/null; then
  info "react-native-bundle-visualizer installed"
else
  err "bundle-visualizer 安装失败"
fi

# ==========================================
# 3. Ruby 工具 (macOS/Linux only)
# ==========================================
echo ""
echo "--- Ruby 工具 ---"

if command -v ruby &>/dev/null; then
  if gem install fastlane 2>/dev/null; then
    info "fastlane $(fastlane --version 2>&1 | head -1)"
  else
    err "fastlane 安装失败"
  fi

  if [[ "$(uname)" == "Darwin" ]]; then
    if gem install cocoapods 2>/dev/null; then
      info "cocoapods $(pod --version 2>&1)"
    else
      err "cocoapods 安装失败"
    fi
  fi
else
  warn "Ruby 未安装 — fastlane/CocoaPods 不可用（需 macOS）"
fi

# ==========================================
# 4. Docker 工具
# ==========================================
echo ""
echo "--- Docker 工具 ---"

if docker ps &>/dev/null 2>&1; then
  if docker pull opensecurity/mobile-security-framework-mobsf:latest 2>/dev/null; then
    info "MobSF Docker image ready"
  else
    err "MobSF Docker 拉取失败"
  fi
else
  warn "Docker 未运行 — MobSF 不可用。手动启动 Docker Desktop 后重试"
fi

# ==========================================
# 5. Dart/Flutter 工具
# ==========================================
echo ""
echo "--- Dart/Flutter 工具 ---"

if command -v dart &>/dev/null; then
  if dart pub global activate shorebird_cli 2>/dev/null; then
    info "shorebird CLI installed"
  else
    err "shorebird CLI 安装失败"
  fi
else
  warn "Dart SDK 未安装 — Shorebird 不可用（需 Flutter SDK）"
fi

# ==========================================
# 6. Maestro (macOS/Linux only)
# ==========================================
echo ""
echo "--- Maestro ---"

if [[ "$(uname)" != "MINGW"* && "$(uname)" != "MSYS"* ]]; then
  if curl -Ls "https://get.maestro.mobile.dev" | bash 2>/dev/null; then
    info "Maestro installed"
  else
    err "Maestro 安装失败"
  fi
else
  warn "Windows 不支持 Maestro 原生安装 — 请在 WSL 中安装"
fi

# ==========================================
# 7. Java 工具
# ==========================================
echo ""
echo "--- Java 工具 ---"

if command -v java &>/dev/null; then
  DC_VERSION="11.1.1"
  DC_DIR="$HOME/.local/share/dependency-check"
  if [ ! -f "$DC_DIR/dependency-check/bin/dependency-check.sh" ]; then
    mkdir -p "$DC_DIR"
    curl -L -o /tmp/dc.zip "https://github.com/jeremylong/DependencyCheck/releases/download/v${DC_VERSION}/dependency-check-${DC_VERSION}-release.zip" 2>/dev/null && \
    unzip -qo /tmp/dc.zip -d "$DC_DIR" && \
    rm /tmp/dc.zip && \
    info "DependencyCheck v${DC_VERSION}" || \
    err "DependencyCheck 下载失败"
  else
    info "DependencyCheck already installed"
  fi
else
  warn "Java 未安装 — DependencyCheck 不可用"
fi

# ==========================================
# 8. Go 工具
# ==========================================
echo ""
echo "--- Go 工具 ---"

if command -v go &>/dev/null; then
  if go install github.com/Shopify/toxiproxy/v2/cmd/toxiproxy@latest 2>/dev/null; then
    info "toxiproxy installed"
  else
    err "toxiproxy 安装失败"
  fi
else
  warn "Go 未安装 — Toxiproxy 不可用"
fi

# ==========================================
echo ""
echo "========================================="
echo "  安装完成"
echo "========================================="

# 最终状态汇总
echo ""
echo "状态汇总:"
for tool in mobsfscan bearer detox npx fastlane pod docker dart shorebird maestro java go; do
  case $tool in
    mobsfscan) command -v mobsfscan &>/dev/null && info "mobsfscan" || warn "mobsfscan" ;;
    bearer)    command -v bearer &>/dev/null && info "bearer" || warn "bearer" ;;
    detox)    command -v detox &>/dev/null && info "detox" || warn "detox" ;;
    npx)      command -v npx &>/dev/null && info "react-native-doctor (via @react-native-community/cli)" || warn "npx" ;;
    fastlane) command -v fastlane &>/dev/null && info "fastlane" || warn "fastlane (macOS only)" ;;
    pod)      command -v pod &>/dev/null && info "cocoapods" || warn "cocoapods (macOS only)" ;;
    docker)   docker ps &>/dev/null 2>&1 && info "MobSF (Docker)" || warn "MobSF (Docker not running)" ;;
    dart)     command -v dart &>/dev/null && info "shorebird" || warn "shorebird (Dart required)" ;;
    maestro)  command -v maestro &>/dev/null && info "maestro" || warn "maestro (macOS/Linux/WSL)" ;;
    java)     command -v java &>/dev/null && info "dependencycheck" || warn "dependencycheck (Java required)" ;;
    go)       command -v toxiproxy-server &>/dev/null 2>&1 && info "toxiproxy" || warn "toxiproxy (Go required)" ;;
  esac
done
