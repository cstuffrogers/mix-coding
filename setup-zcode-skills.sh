#!/usr/bin/env bash
# setup-zcode-skills.sh — 部署 Mix-Coding System 的 auto-coding plugin 到 ZCode 桌面版
#
# 用法:
#   bash setup-zcode-skills.sh           # 部署并注册
#   bash setup-zcode-skills.sh --check   # 仅检查当前状态
#
# 效果:
#   1. 将项目 .zcode/plugins/auto-coding/ 复制到 ZCode 全局 plugin cache
#   2. 在 marketplace.json 注册 auto-coding plugin
#   3. ZCode 桌面版重启后可识别 scene-runner skill，支持 /review /plan 等命令
#
# 与 Codex 的 setup-codex-global.sh 对称。本脚本不修改 .claude/ 配置。

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

ZCODE_HOME="$HOME/.zcode"
CACHE_DIR="$ZCODE_HOME/cli/plugins/cache/zcode-plugins-official"
MARKETPLACE="$ZCODE_HOME/cli/plugins/marketplaces/zcode-plugins-official/marketplace.json"
PLUGIN_NAME="auto-coding"
PLUGIN_VERSION="0.1.0"
SRC_PLUGIN="$PROJECT_DIR/.zcode/plugins/$PLUGIN_NAME/$PLUGIN_VERSION"
DST_PLUGIN="$CACHE_DIR/$PLUGIN_NAME/$PLUGIN_VERSION"

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ZCode Skills 部署 — Mix-Coding System    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

# ── 1. 检查项目源 ──
hdr "1. 检查项目源 plugin"
if [ -f "$SRC_PLUGIN/.zcode-plugin/plugin.json" ] && [ -f "$SRC_PLUGIN/skills/scene-runner/SKILL.md" ]; then
  ok "项目源 plugin 就绪: .zcode/plugins/$PLUGIN_NAME/$PLUGIN_VERSION"
else
  fail "项目源 plugin 缺失 (.zcode/plugins/$PLUGIN_NAME/$PLUGIN_VERSION/.zcode-plugin/plugin.json 或 skills/scene-runner/SKILL.md)"
  exit 1
fi

# ── 2. 检查 ZCode 全局目录 ──
hdr "2. 检查 ZCode 全局目录"
if [ -d "$ZCODE_HOME" ]; then
  ok "ZCode 全局目录存在: $ZCODE_HOME"
else
  fail "ZCode 全局目录不存在 ($ZCODE_HOME) — 请先安装并启动 ZCode 桌面版"
  exit 1
fi

if [ -d "$CACHE_DIR" ]; then
  ok "plugin cache 目录存在"
else
  warn "plugin cache 目录不存在，将创建"
  [ "$CHECK_ONLY" -eq 0 ] && mkdir -p "$CACHE_DIR"
fi

[ "$CHECK_ONLY" -eq 1 ] && { echo -e "\n${YELLOW}--check 模式，仅检查，不部署${NC}"; exit $ERR; }

# ── 3. 部署 plugin 文件 ──
hdr "3. 部署 plugin 文件到 ZCode cache"
mkdir -p "$DST_PLUGIN/.zcode-plugin" "$DST_PLUGIN/skills/scene-runner"
cp "$SRC_PLUGIN/.zcode-plugin/plugin.json" "$DST_PLUGIN/.zcode-plugin/plugin.json"
cp "$SRC_PLUGIN/.zcode-plugin-seed.json" "$DST_PLUGIN/.zcode-plugin-seed.json"
cp "$SRC_PLUGIN/package.json" "$DST_PLUGIN/package.json"
cp "$SRC_PLUGIN/skills/scene-runner/SKILL.md" "$DST_PLUGIN/skills/scene-runner/SKILL.md"
ok "plugin 文件已复制到: $DST_PLUGIN"

# ── 4. 注册到 marketplace.json ──
hdr "4. 注册到 marketplace.json"
if [ ! -f "$MARKETPLACE" ]; then
  fail "marketplace.json 不存在: $MARKETPLACE"
  exit 1
fi

# 检查是否已注册
if grep -q "\"name\": \"$PLUGIN_NAME\"" "$MARKETPLACE"; then
  ok "marketplace.json 已包含 $PLUGIN_NAME，跳过注册"
else
  # 用 node 脚本安全插入（避免 sed 转义问题）
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
    const entry = {
      cachePath: process.argv[2].replace(/\//g, '\\\\'),
      name: '$PLUGIN_NAME',
      source: 'filesystem',
      version: '$PLUGIN_VERSION'
    };
    // 按字母序插入
    const plugins = data.plugins || [];
    const idx = plugins.findIndex(p => p.name > '$PLUGIN_NAME');
    if (idx === -1) plugins.push(entry); else plugins.splice(idx, 0, entry);
    data.plugins = plugins;
    fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log('已注册 $PLUGIN_NAME');
  " "$MARKETPLACE" "$DST_PLUGIN"
  ok "已注册 $PLUGIN_NAME 到 marketplace.json"
fi

# ── 5. 结果汇总 ──
echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
if [ "$ERR" -eq 0 ]; then
  echo -e "${GREEN}║  ✅ ZCode Skills 部署完成                 ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════╣${NC}"
  echo -e "  下一步:"
  echo -e "    1. ${CYAN}重启 ZCode 桌面版${NC}（加载新 plugin）"
  echo -e "    2. 在 ZCode 中对项目说 ${CYAN}\"/review\"${NC} 或 ${CYAN}\"/plan\"${NC}"
  echo -e "    3. scene-runner skill 会映射命令到引擎 CLI"
  echo -e ""
  echo -e "  可用命令: /review /feature /bugfix /refactor /plan /optimize"
  echo -e "           /ui-polish /hunt /release /deps /check /qa /loop 等"
  echo -e "  已合并命令: /audit→/review /simplify→/refactor /design→/ui-polish"
else
  echo -e "${RED}║  ❌ 部署发现 $ERR 个问题                   ║${NC}"
fi
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

exit $ERR
