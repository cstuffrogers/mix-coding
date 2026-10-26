#!/bin/bash
# install-global.sh — 把 Mix-Coding 的斜杠命令装到用户级，任意项目目录可用
#
# 用法:
#   bash scripts/install-global.sh              # 安装
#   bash scripts/install-global.sh --dry-run    # 只看会做什么
#   bash scripts/install-global.sh --check      # 只检查现状
#   bash scripts/install-global.sh --uninstall  # 卸载（只删本脚本装的）
#   bash scripts/install-global.sh --force      # 覆盖用户已有同名文件
#
# 装到哪里:
#   ~/.pi/agent/prompts/     pi / percho 的 /review 等命令（个人模板目录）
#   ~/.pi/agent/skills/      scene-runner skill（告诉 agent 怎么用场景引擎）
#   ~/.claude/commands/      Claude Code 的 /review 等命令
#
# 可用环境变量覆盖目标目录:
#   PI_AGENT_DIR      默认 ~/.pi/agent
#   CLAUDE_CONFIG_DIR 默认 ~/.claude
#
# 前提: claude-scene 已在 PATH（scripts/../claude-scene 下执行 npm link）

set -uo pipefail

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC}  $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; ERR=$((ERR+1)); }
hdr()  { echo -e "\n${CYAN}── $1 ──${NC}"; }
dim()  { echo -e "  ${DIM}$1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR" || { echo "无法进入项目目录"; exit 1; }

PI_AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PI_PROMPTS_DST="$PI_AGENT_DIR/prompts"
PI_SKILLS_DST="$PI_AGENT_DIR/skills"
CLAUDE_CMDS_DST="$CLAUDE_DIR/commands"

MODE="install"; FORCE=0; ERR=0
case "${1:-}" in
  --dry-run)   MODE="dry" ;;
  --check)     MODE="check" ;;
  --uninstall) MODE="uninstall" ;;
  --force)     FORCE=1 ;;
  "")          ;;
  *) echo "未知参数: $1（见脚本头部用法）"; exit 2 ;;
esac

SRC_PROMPTS=".pi/prompts"
SRC_SKILLS=".pi/skills"
SRC_CLAUDE_CMDS=".claude/commands"
# 引擎技能（review-checklist、vendored 的 Trail of Bits 等）。全局安装（npm i -g）
# 时包内不含 .claude/skills（它在仓库根，不在 claude-scene/ 里），所以必须装到
# ~/.mix-coding/.claude/skills —— 那是 skill-runner 的最后一级候选目录。
SRC_ENGINE_SKILLS=".claude/skills"
MIX_HOME="${MIX_CODING_HOME:-$HOME/.mix-coding}"
ENGINE_SKILLS_DST="$MIX_HOME/.claude/skills"

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Mix-Coding 斜杠命令 — 用户级安装（任意目录可用）  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"

# ── 1. 引擎是否全局可调用 ──
hdr "1. 引擎"
if command -v claude-scene &> /dev/null; then
  ok "claude-scene 在 PATH: $(command -v claude-scene)"
  SCENE_VER=$(claude-scene --version 2>/dev/null || echo "?")
  dim "版本 $SCENE_VER"
else
  fail "claude-scene 不在 PATH — 斜杠命令会执行失败"
  dim "先执行: cd $PROJECT_DIR/claude-scene && npm link"
fi

# ── 2. 源文件清点 ──
hdr "2. 源模板"
PROMPT_N=$(ls "$SRC_PROMPTS"/*.md 2>/dev/null | wc -l | tr -d ' ')
SKILL_N=$(find "$SRC_SKILLS" -name SKILL.md 2>/dev/null | wc -l | tr -d ' ')
CMD_N=$(ls "$SRC_CLAUDE_CMDS"/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$PROMPT_N" -gt 0 ] && ok "pi 命令模板: $PROMPT_N 个 ($SRC_PROMPTS)" || fail "$SRC_PROMPTS 无 .md"
[ "$SKILL_N" -gt 0 ]  && ok "pi skills: $SKILL_N 个 ($SRC_SKILLS)"        || warn "$SRC_SKILLS 无 SKILL.md"
[ "$CMD_N" -gt 0 ]    && ok "Claude Code 命令: $CMD_N 个 ($SRC_CLAUDE_CMDS)" || warn "$SRC_CLAUDE_CMDS 无 .md"

# 硬编码绝对路径会破坏可移植性 —— 装到用户级后必须靠 PATH
if grep -rls "E:/auto-coding" "$SRC_PROMPTS" "$SRC_CLAUDE_CMDS" 2>/dev/null | head -1 | grep -q .; then
  fail "模板中仍有硬编码 E:/auto-coding 路径，装到别处会失效"
  grep -rls "E:/auto-coding" "$SRC_PROMPTS" "$SRC_CLAUDE_CMDS" 2>/dev/null | sed 's/^/      /' | head -5
else
  ok "模板无硬编码绝对路径（依赖 PATH 上的 claude-scene）"
fi

# ── 装一个文件（幂等：内容相同则跳过）──
# $1 源 $2 目标目录
copy_one() {
  local src="$1" dst_dir="$2" base
  base="$(basename "$src")"
  local dst="$dst_dir/$base"
  if [ -f "$dst" ] && cmp -s "$src" "$dst"; then
    SKIPPED=$((SKIPPED+1)); return 0
  fi
  if [ -f "$dst" ] && [ "$FORCE" -ne 1 ]; then
    warn "已存在，跳过: $dst ${DIM}(用 --force 覆盖)${NC}"; CONFLICT=$((CONFLICT+1)); return 0
  fi
  [ "$MODE" = "dry" ] && { dim "将写入 $dst"; WRITTEN=$((WRITTEN+1)); return 0; }
  mkdir -p "$dst_dir" && cp "$src" "$dst" && WRITTEN=$((WRITTEN+1))
}

install_tree() {
  local src_dir="$1" dst_dir="$2" pattern="$3"
  local f
  while IFS= read -r -d '' f; do copy_one "$f" "$dst_dir"; done \
    < <(find "$src_dir" -name "$pattern" -type f -print0 2>/dev/null)
}

WRITTEN=0; SKIPPED=0; CONFLICT=0; REMOVED=0

if [ "$MODE" = "uninstall" ]; then
  hdr "3. 卸载"
  for f in "$SRC_PROMPTS"/*.md; do
    [ -f "$f" ] || continue
    dst="$PI_PROMPTS_DST/$(basename "$f")"
    [ -f "$dst" ] && rm -f "$dst" && REMOVED=$((REMOVED+1))
  done
  for f in "$SRC_CLAUDE_CMDS"/*.md; do
    [ -f "$f" ] || continue
    dst="$CLAUDE_CMDS_DST/$(basename "$f")"
    [ -f "$dst" ] && rm -f "$dst" && REMOVED=$((REMOVED+1))
  done
  while IFS= read -r -d '' f; do
    rel="${f#"$SRC_SKILLS"/}"
    dst="$PI_SKILLS_DST/$rel"
    [ -f "$dst" ] && rm -f "$dst" && REMOVED=$((REMOVED+1))
  done < <(find "$SRC_SKILLS" -name SKILL.md -type f -print0 2>/dev/null)
  while IFS= read -r -d '' f; do
    rel="${f#"$SRC_ENGINE_SKILLS"/}"
    dst="$ENGINE_SKILLS_DST/$rel"
    [ -f "$dst" ] && rm -f "$dst" && REMOVED=$((REMOVED+1))
  done < <(find "$SRC_ENGINE_SKILLS" -name '*.md' -type f -print0 2>/dev/null)
  ok "已删除 $REMOVED 个文件（用户自有文件未触碰）"
else
  if [ "$MODE" = "check" ]; then
    hdr "3. 现状"
    HAVE_P=$([ -d "$PI_PROMPTS_DST" ] && ls "$PI_PROMPTS_DST"/*.md 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    HAVE_C=$([ -d "$CLAUDE_CMDS_DST" ] && ls "$CLAUDE_CMDS_DST"/*.md 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    echo "  pi 个人模板   $PI_PROMPTS_DST: $HAVE_P 个（源 $PROMPT_N）"
    echo "  pi skills     $PI_SKILLS_DST: $([ -d "$PI_SKILLS_DST" ] && echo 存在 || echo 缺失)"
    echo "  Claude 全局   $CLAUDE_CMDS_DST: $HAVE_C 个（源 $CMD_N）"
    [ "$HAVE_P" -ge "$PROMPT_N" ] && ok "pi 命令已全局可用" || warn "pi 命令未全部安装 — 执行 bash scripts/install-global.sh"
  else
    hdr "3. 安装 pi / percho 命令模板"
    [ "$MODE" = "dry" ] && dim "目标: $PI_PROMPTS_DST"
    install_tree "$SRC_PROMPTS" "$PI_PROMPTS_DST" "*.md"
    ok "$PROMPT_N 个模板 → $PI_PROMPTS_DST"

    hdr "4. 安装 pi skills"
    if [ "$SKILL_N" -gt 0 ]; then
      while IFS= read -r -d '' f; do
        rel="${f#"$SRC_SKILLS"/}"
        dst_dir="$PI_SKILLS_DST/$(dirname "$rel")"
        copy_one "$f" "$dst_dir"
      done < <(find "$SRC_SKILLS" -name SKILL.md -type f -print0 2>/dev/null)
      ok "$SKILL_N 个 skill → $PI_SKILLS_DST"
    fi

    hdr "5. 安装 Claude Code 命令"
    if command -v claude &> /dev/null; then
      [ "$CMD_N" -gt 0 ] && install_tree "$SRC_CLAUDE_CMDS" "$CLAUDE_CMDS_DST" "*.md"
      ok "$CMD_N 个命令 → $CLAUDE_CMDS_DST"
    else
      # 没装 Claude Code 时不要凭空造一个 ~/.claude/commands —— pi/percho 走的是
      # ~/.pi/agent/prompts，这条路径只会变成无人读取的死目录。
      dim "未检测到 claude CLI（Claude Code 未安装）—— 跳过，不创建 $CLAUDE_CMDS_DST"
    fi

    hdr "6. 安装引擎技能"
    ENGINE_N=$(find "$SRC_ENGINE_SKILLS" -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$ENGINE_N" -gt 0 ]; then
      while IFS= read -r -d '' f; do
        rel="${f#"$SRC_ENGINE_SKILLS"/}"
        copy_one "$f" "$ENGINE_SKILLS_DST/$(dirname "$rel")"
      done < <(find "$SRC_ENGINE_SKILLS" -name '*.md' -type f -print0 2>/dev/null)
      ok "$ENGINE_N 个技能文件 → $ENGINE_SKILLS_DST"
      dim "invokeSkill 步骤在任意项目目录下都能找到这些技能"
    else
      warn "$SRC_ENGINE_SKILLS 无 .md —— invokeSkill 步骤会退化为 noop"
    fi
  fi
fi

# ── 汇总 ──
echo -e "\n${CYAN}╔══════════════════════════════════════════════════╗${NC}"
printf "  写入 %s · 已是最新 %s · 冲突跳过 %s\n" "$WRITTEN" "$SKIPPED" "$CONFLICT"
if [ "$MODE" = "uninstall" ]; then
  echo -e "${CYAN}║  已卸载                                        ║${NC}"
elif [ "$ERR" -eq 0 ]; then
  echo -e "${GREEN}║  ✅ 完成 — 任意项目目录都能用 / 命令             ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════════╣${NC}"
  echo -e "  ${YELLOW}生效方式：${NC}"
  echo -e "    pi / percho → 执行 ${CYAN}/reload${NC}（或重开窗口）"
  echo -e "    Claude Code → 重启会话"
  echo -e "  然后在${CYAN}任意项目${NC}试: ${CYAN}/review${NC}"
else
  echo -e "${RED}║  ❌ 有 $ERR 个问题需先处理                      ║${NC}"
fi
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"

exit $ERR
