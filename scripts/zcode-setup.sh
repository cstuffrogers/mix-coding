#!/usr/bin/env bash
# zcode-setup.sh — ZCode 一键接入 Mix-Coding System
#
# 用法:
#   bash scripts/zcode-setup.sh           # 在项目根目录执行
#   bash scripts/zcode-setup.sh --check   # 仅检查,不跑冒烟测试
#
# 前提:已在 ZCode 桌面应用中打开本项目(ZCode 会自动注入 ZCODE_APP_VERSION 等环境变量)
#
# 效果:
#   1. 验证 Node/Git/依赖就绪
#   2. 确认引擎平台识别层正确检测到 ZCode 宿主
#   3. 跑引擎自检场景(check)冒烟,确保工作流可用
#   4. 确认 .zcode/AGENTS.md 与 .mcp.json 接入文件就位
#
# 与 Claude Code 完全兼容:本脚本不修改任何 .claude/ 配置,不改变引擎对 Claude 的行为。

set -uo pipefail

# ── 颜色 ──
GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC}  $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; ERR=$((ERR+1)); }
hdr()  { echo -e "\n${CYAN}── $1 ──${NC}"; }

ERR=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR" || { echo "无法进入项目目录"; exit 1; }

SKIP_SMOKE=0
[ "${1:-}" = "--check" ] && SKIP_SMOKE=1

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ZCode 一键接入 — Mix-Coding System      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

# ── 1. 环境检查 ──
hdr "1. 环境检查"

if command -v node &> /dev/null; then
  NODE_VER=$(node --version)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    ok "Node.js $NODE_VER (≥ 20.x)"
  else
    fail "Node.js $NODE_VER 版本过低,需 ≥ 20.x"
  fi
else
  fail "Node.js 未安装"
fi

git --version > /dev/null 2>&1 && ok "Git $(git --version | awk '{print $3}')" || fail "Git 未安装"

# ── 2. 依赖检查 ──
hdr "2. 依赖检查"

if [ -f "package.json" ]; then
  ok "package.json 存在"
  if [ -d "node_modules" ]; then
    ok "node_modules 就绪"
  else
    warn "node_modules 缺失,执行 npm install..."
    npm install > /dev/null 2>&1 && ok "依赖安装完成" || fail "npm install 失败"
  fi
else
  fail "package.json 不存在,请在项目根目录执行"
fi

# ── 3. 引擎完整性 ──
hdr "3. 引擎完整性"

ENGINE="claude-scene/src/index.js"
if [ -f "$ENGINE" ]; then
  ok "Scene 引擎入口存在 ($ENGINE)"
else
  fail "Scene 引擎入口缺失: $ENGINE"
fi

PLATFORM_LIB="claude-scene/src/lib/platform.js"
if [ -f "$PLATFORM_LIB" ]; then
  ok "平台识别层存在 ($PLATFORM_LIB)"
else
  fail "平台识别层缺失: $PLATFORM_LIB — 这是 ZCode 接入的核心依赖"
fi

# 场景数量
SCENE_COUNT=$(ls .claude/scenes/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$SCENE_COUNT" -gt 0 ]; then
  ok "场景定义: $SCENE_COUNT 个工作流"
else
  fail ".claude/scenes/ 下无场景 JSON"
fi

# ── 4. ZCode 宿主识别 ──
hdr "4. ZCode 宿主识别"

# ZCode 桌面应用注入的环境变量(实测自 ZCode 3.2.1)
if [ -n "${ZCODE_APP_VERSION:-}" ]; then
  ok "检测到 ZCode 环境 (ZCODE_APP_VERSION=$ZCODE_APP_VERSION)"
else
  warn "未检测到 ZCODE_APP_VERSION — 当前可能不在 ZCode 会话中"
  warn "  (脚本仍可运行,但平台识别测试将显示 'cli' 模式)"
fi

# 用引擎的 platform.js 验证识别结果
echo -e "  ${CYAN}→ 调用引擎验证宿主识别...${NC}"
HOST_RESULT=$(node -e "
import('./claude-scene/src/lib/platform.js').then(m => {
  console.log(m.getHostPlatform());
}).catch(e => { console.error('ERR:'+e.message); process.exit(1); });
" 2>&1)

if [ "$HOST_RESULT" = "zcode" ]; then
  ok "引擎正确识别当前宿主: zcode (对话模式已激活)"
elif [ "$HOST_RESULT" = "cli" ]; then
  warn "引擎识别为 'cli' 模式(非 ZCode 会话) — MCP/Skill 步骤将跳过"
  warn "  在 ZCode 桌面应用中打开本项目后重新运行可激活对话模式"
elif echo "$HOST_RESULT" | grep -q "^ERR:"; then
  fail "平台识别层执行错误: $HOST_RESULT"
else
  warn "引擎识别为 '$HOST_RESULT'(可能是其他宿主)"
fi

# ── 5. 接入文件确认 ──
hdr "5. 接入文件确认"

[ -f ".zcode/AGENTS.md" ] && ok ".zcode/AGENTS.md 就位 (ZCode 专属入口指南)" || fail ".zcode/AGENTS.md 缺失"
[ -f ".mcp.json" ] && ok ".mcp.json 就位 (MCP 服务器配置)" || warn ".mcp.json 缺失 (MCP 工具将不可用)"
[ -f "AGENTS.md" ] && ok "根 AGENTS.md 就位 (通用操作手册)" || warn "根 AGENTS.md 缺失"

# ── 6. 自检冒烟 ──
if [ "$SKIP_SMOKE" -eq 0 ]; then
  hdr "6. 自检冒烟 (check 场景 dry-run)"

  echo -e "  ${CYAN}→ 预览 check 工作流步骤...${NC}"
  if node claude-scene/src/index.js start check --auto --dry-run > /dev/null 2>&1; then
    ok "check 场景 dry-run 通过 (引擎可正常编排)"
  else
    fail "check 场景 dry-run 失败 — 引擎可能存在问题"
    echo -e "  ${YELLOW}  运行 'node claude-scene/src/index.js start check --auto --dry-run' 查看详情${NC}"
  fi
else
  hdr "6. 自检冒烟 (--check 模式,已跳过)"
fi

# ── 结果汇总 ──
echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
if [ "$ERR" -eq 0 ]; then
  echo -e "${GREEN}║  ✅ ZCode 接入就绪                       ║${NC}"
  echo -e "${GREEN}║  29 个工作流可用,引擎与 Claude 共享资源   ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════╣${NC}"
  echo -e "  下一步: 在 ZCode 中对项目说"
  echo -e "    ${CYAN}\"运行 /check 自检\"${NC}  或  ${CYAN}\"运行 /feature <需求>\"${NC}"
  echo -e "  ZCode 会读取 .zcode/AGENTS.md 并调用引擎。"
  [ "$HOST_RESULT" = "cli" ] && echo -e "\n  ${YELLOW}注意: 当前为 CLI 模式,建议在 ZCode 应用内运行${NC}"
else
  echo -e "${RED}║  ❌ 接入检查发现 $ERR 个问题              ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════╣${NC}"
  echo -e "  请修复上述 ❌ 项后重新运行本脚本。"
fi
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

exit $ERR
