#!/usr/bin/env bash
# setup-codex-global.sh — 部署 Mix-Coding System skills 到 Codex 桌面版
#
# 用法:
#   bash setup-codex-global.sh           # 部署 skills
#   bash setup-codex-global.sh --check   # 仅检查当前状态
#
# 效果:
#   1. 将项目 .agents/skills/ 复制到 Codex 全局 ~/.codex/skills/auto-coding/
#   2. Codex 桌面版重启后加载 scene-runner 等 skill，支持 /review /plan 等命令
#
# 用复制方案（非软链）：Windows 软链需管理员，复制更可靠。
# 对称于 setup-zcode-skills.sh。

set -uo pipefail

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC}  $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; ERR=$((ERR+1)); }
hdr()  { echo -e "\n${CYAN}── $1 ──${NC}"; }

ERR=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
cd "$PROJECT_DIR" || { echo "无法进入项目目录"; exit 1; }

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

CODEX_HOME="$HOME/.codex"
DST_SKILLS="$CODEX_HOME/skills/auto-coding"
SRC_SKILLS="$PROJECT_DIR/.agents/skills"

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Codex Skills 部署 — Mix-Coding System    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

# ── 1. 检查项目源 ──
hdr "1. 检查项目源 skills"
if [ -d "$SRC_SKILLS" ] && [ -f "$SRC_SKILLS/scene-runner/SKILL.md" ]; then
  SKILL_COUNT=$(find "$SRC_SKILLS" -name "SKILL.md" | wc -l)
  ok "项目源 skills 就绪: .agents/skills/ ($SKILL_COUNT 个 skill)"
else
  fail "项目源 skills 缺失 (.agents/skills/scene-runner/SKILL.md)"
  exit 1
fi

# ── 2. 检查 Codex 全局目录 ──
hdr "2. 检查 Codex 全局目录"
if [ -d "$CODEX_HOME" ]; then
  ok "Codex 全局目录存在: $CODEX_HOME"
else
  fail "Codex 全局目录不存在 ($CODEX_HOME) — 请先安装并启动 Codex 桌面版"
  exit 1
fi

[ "$CHECK_ONLY" -eq 1 ] && { echo -e "\n${YELLOW}--check 模式，仅检查，不部署${NC}"; exit $ERR; }

# ── 3. 部署 skills（复制方案）──
hdr "3. 部署 skills 到 Codex 全局"
mkdir -p "$DST_SKILLS"

# 用 rsync 优先（保持同步），回退到 cp -r
if command -v rsync &> /dev/null; then
  rsync -a --delete "$SRC_SKILLS/" "$DST_SKILLS/" 2>/dev/null && ok "skills 已同步 (rsync)" || {
    cp -r "$SRC_SKILLS"/* "$DST_SKILLS/" && ok "skills 已复制 (cp)"
  }
else
  # Windows Git Bash 无 rsync，用 cp
  cp -rf "$SRC_SKILLS"/* "$DST_SKILLS/" && ok "skills 已复制 (cp)"
fi

# 生成 agents/openai.yaml（Codex skill 元数据）
hdr "4. 生成 openai.yaml 元数据"
YAML_COUNT=0
for skill_dir in "$DST_SKILLS"/*/; do
  skill_name=$(basename "$skill_dir")
  yaml_dir="$skill_dir/agents"
  yaml_file="$yaml_dir/openai.yaml"
  mkdir -p "$yaml_dir"
  if [ ! -f "$yaml_file" ]; then
    cat > "$yaml_file" <<EOF
skill: $skill_name
display_name: $skill_name
short_description: Auto-coding skill
default_prompt: Use the $skill_name skill to help with this task.
EOF
    YAML_COUNT=$((YAML_COUNT+1))
  fi
done
ok "openai.yaml 元数据已生成/确认 ($YAML_COUNT 个新增)"

# ── 5. 验证关键 skill ──
hdr "5. 验证关键 skill"
if [ -f "$DST_SKILLS/scene-runner/SKILL.md" ]; then
  ok "scene-runner skill 就绪（命令映射 /review /plan /refactor 等）"
else
  fail "scene-runner skill 缺失"
fi

# ── 6. 结果汇总 ──
echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
if [ "$ERR" -eq 0 ]; then
  echo -e "${GREEN}║  ✅ Codex Skills 部署完成                  ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════╣${NC}"
  echo -e "  下一步:"
  echo -e "    1. ${CYAN}重启 Codex 桌面版${NC}（加载新 skills）"
  echo -e "    2. 在 Codex 中对项目说 ${CYAN}\"/review\"${NC} 或 ${CYAN}\"/plan\"${NC}"
  echo -e "    3. scene-runner skill 会映射命令到引擎 CLI"
  echo -e ""
  echo -e "  可用命令: /review /feature /bugfix /refactor /plan /optimize"
  echo -e "           /ui-polish /hunt /release /deps /check /qa /loop 等"
  echo -e "  已合并命令: /audit→/review /simplify→/refactor /design→/ui-polish"
  echo -e ""
  echo -e "  引擎 (在项目根执行): node claude-scene/src/index.js start <scene> --auto"
else
  echo -e "${RED}║  ❌ 部署发现 $ERR 个问题                      ║${NC}"
fi
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

exit $ERR
