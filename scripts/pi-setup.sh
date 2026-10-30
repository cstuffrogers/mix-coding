#!/bin/bash
# pi-setup.sh — pi / percho 一键接入 Mix-Coding System
#
# 用法:
#   bash scripts/pi-setup.sh           # 在项目根目录执行
#   bash scripts/pi-setup.sh --check   # 仅检查,不跑冒烟测试
#
# 前提:在 pi CLI 或 percho 桌面端打开本项目
#   - pi CLI 会注入 AI_AGENT=pi
#   - percho 会注入 PI_PACKAGE_DIR=<pi SDK 路径>
#
# 效果:
#   1. 验证 Node/Git/依赖就绪
#   2. 确认引擎平台识别层正确检测到 pi 宿主（含 percho）
#   3. 跑引擎自检场景(check)冒烟,确保工作流可用
#   4. 确认 .pi/ 接入文件就位
#
# 与 Claude Code 完全兼容:本脚本不修改任何 .claude/ 配置。

set -uo pipefail

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'
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
echo -e "${CYAN}║  pi / percho 一键接入 — Mix-Coding System ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

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

hdr "3. 引擎完整性"
ENGINE="claude-scene/src/index.js"
[ -f "$ENGINE" ] && ok "Scene 引擎入口存在 ($ENGINE)" || fail "Scene 引擎入口缺失: $ENGINE"
PLATFORM_LIB="claude-scene/src/lib/platform.js"
[ -f "$PLATFORM_LIB" ] && ok "平台识别层存在 ($PLATFORM_LIB)" || fail "平台识别层缺失: $PLATFORM_LIB"
SCENE_COUNT=$(ls .claude/scenes/*.json 2>/dev/null | wc -l | tr -d ' ')
[ "$SCENE_COUNT" -gt 0 ] && ok "场景定义: $SCENE_COUNT 个工作流" || fail ".claude/scenes/ 下无场景 JSON"

hdr "4. pi / percho 宿主识别"
if [ -n "${AI_AGENT:-}" ] && [ "$AI_AGENT" = "pi" ]; then
  ok "检测到 pi CLI 环境 (AI_AGENT=pi)"
elif [ -n "${PI_PACKAGE_DIR:-}" ]; then
  ok "检测到 percho 环境 (PI_PACKAGE_DIR=$PI_PACKAGE_DIR)"
else
  warn "未检测到 AI_AGENT=pi 或 PI_PACKAGE_DIR — 当前可能不在 pi/percho 会话中"
fi

HOST_RESULT=$(node -e "
import('./claude-scene/src/lib/platform.js').then(m => {
  console.log(m.getHostPlatform());
}).catch(e => { console.error('ERR:'+e.message); process.exit(1); });
" 2>&1)

if [ "$HOST_RESULT" = "pi" ]; then
  ok "引擎正确识别当前宿主: pi (对话模式已激活)"
elif [ "$HOST_RESULT" = "cli" ]; then
  warn "引擎识别为 'cli' 模式(非 pi 会话) — MCP/Skill 步骤将跳过"
else
  warn "引擎识别为 '$HOST_RESULT'(可能是其他宿主)"
fi

hdr "5. 接入文件确认"
[ -f ".pi/AGENTS.md" ] && ok ".pi/AGENTS.md 就位 (pi 专属入口指南)" || fail ".pi/AGENTS.md 缺失"
[ -d ".pi/skills" ] && ok ".pi/skills/ 就位 (pi Skills)" || warn ".pi/skills/ 缺失"
[ -d ".pi/prompts" ] && ok ".pi/prompts/ 就位 (pi Prompt Templates)" || warn ".pi/prompts/ 缺失"

# pi 的技能发现目录是 .agents/skills/（Claude Code 读 .claude/skills/）。
# .agents 被 git 忽略，所以要在这里补同步，否则新抄进来的技能不会进 pi 的清单。
VENDORED_SKILLS="property-based-testing variant-analysis sharp-edges insecure-defaults landing-page-design"
if [ -d ".agents/skills" ]; then
  synced=0
  for s in $VENDORED_SKILLS; do
    if [ -f ".claude/skills/$s/SKILL.md" ]; then
      mkdir -p ".agents/skills/$s"
      cp -R ".claude/skills/$s/." ".agents/skills/$s/" 2>/dev/null && synced=$((synced + 1))
    fi
  done
  ok "vendored 技能已同步到 .agents/skills ($synced/$(( $(echo $VENDORED_SKILLS | wc -w) )) — pi 可发现)"
else
  warn ".agents/skills/ 缺失 — pi 无法发现 vendored 技能"
fi
[ -f "AGENTS.md" ] && ok "根 AGENTS.md 就位" || warn "根 AGENTS.md 缺失"

# 全局安装检查：项目级斜杠命令只在 cd 到本仓库时可用
GLOBAL_PROMPTS="${PI_AGENT_DIR:-$HOME/.pi/agent}/prompts"
LOCAL_PROMPT_N=$(ls .pi/prompts/*.md 2>/dev/null | wc -l | tr -d ' ')
GLOBAL_PROMPT_N=$(ls "$GLOBAL_PROMPTS"/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$GLOBAL_PROMPT_N" -ge "$LOCAL_PROMPT_N" ] && [ "$LOCAL_PROMPT_N" -gt 0 ]; then
  ok "斜杠命令已全局安装 ($GLOBAL_PROMPT_N 个) — 任意目录可用"
else
  warn "斜杠命令未全局安装 ($GLOBAL_PROMPT_N/$LOCAL_PROMPT_N) — 仅本目录可用"
  dim_hint() { echo -e "     ${DIM}安装: bash scripts/install-global.sh${NC}"; }
  command -v claude-scene > /dev/null 2>&1 || echo -e "     ${DIM}先: cd claude-scene && npm link${NC}"
  dim_hint
fi

if [ "$SKIP_SMOKE" -eq 0 ]; then
  hdr "6. 自检冒烟 (check 场景 dry-run)"
  if node claude-scene/src/index.js start check --auto --dry-run > /dev/null 2>&1; then
    ok "check 场景 dry-run 通过 (引擎可正常编排)"
  else
    fail "check 场景 dry-run 失败 — 引擎可能存在问题"
  fi
else
  hdr "6. 自检冒烟 (--check 模式,已跳过)"
fi

echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
if [ "$ERR" -eq 0 ]; then
  echo -e "${GREEN}║  ✅ pi / percho 接入就绪                  ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════╣${NC}"
  echo -e "  下一步: 在 pi/percho 中对项目说"
  echo -e "    ${CYAN}\"/review\"${NC}  或  ${CYAN}\"运行 /check 自检\"${NC}"
  echo -e "  pi 会读取 .pi/AGENTS.md 并调用引擎。"
  [ "$HOST_RESULT" = "cli" ] && echo -e "\n  ${YELLOW}注意: 当前为 CLI 模式,建议在 pi/percho 应用内运行${NC}"
else
  echo -e "${RED}║  ❌ 接入检查发现 $ERR 个问题              ║${NC}"
fi
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

exit $ERR
