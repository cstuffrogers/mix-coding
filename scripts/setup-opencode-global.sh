#!/usr/bin/env sh
# setup-opencode-global.sh — 一键配置 opencode 全局命令(108) + MCP(17) + Provider(4)
#
# 用法:
#   chmod +x scripts/setup-opencode-global.sh
#   ./scripts/setup-opencode-global.sh
#
# 环境变量:
#   GITHUB_TOKEN          GitHub Personal Access Token
#   TAVILY_API_KEY        Tavily Search API Key
#   CONTEXT7_API_KEY      Context7 API Key
#   SENTRY_AUTH_TOKEN     Sentry Auth Token
#   SUPABASE_ACCESS_TOKEN Supabase Access Token
#   STRIPE_SECRET_KEY     Stripe Secret Key
#   RESEND_API_KEY        Resend API Key
#   MOBSF_URL             MobSF URL (e.g. http://localhost:8000)
#   MOBSF_API_KEY         MobSF API Key
#   BEARER_API_KEY        Bearer API Key
#   PENCIL_PATH           Pencil MCP 可执行文件路径 (默认: 自动检测)
#
# 效果: 写入 ~/.config/opencode/opencode.json
#       108 命令 · 17 MCP · 4 Provider · 38 工作流与 Claude Code 完全对齐

set -e

CONFIG_DIR="${HOME:-$USERPROFILE}/.config/opencode"
CONFIG_FILE="${CONFIG_DIR}/opencode.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

mkdir -p "$CONFIG_DIR"

# ---------- 通过 Node.js 生成器生成配置 ----------
node "${PROJECT_DIR}/.opencode/deploy-global.cjs"

# ---------- 注入 API Key (占位符替换) ----------
inject_key() {
  local placeholder="$1" value="$2"
  if [ -n "$value" ]; then
    if [ "$(uname)" = "Darwin" ]; then
      sed -i '' "s|\${${placeholder}}|$value|g" "$CONFIG_FILE"
    else
      sed -i "s|\${${placeholder}}|$value|g" "$CONFIG_FILE"
    fi
    echo "  ✅ ${placeholder} injected"
  fi
}

inject_key "GITHUB_PERSONAL_ACCESS_TOKEN" "${GITHUB_TOKEN}"
inject_key "TAVILY_API_KEY"               "${TAVILY_API_KEY}"
inject_key "CONTEXT7_API_KEY"             "${CONTEXT7_API_KEY}"
inject_key "SENTRY_AUTH_TOKEN"            "${SENTRY_AUTH_TOKEN}"
inject_key "SUPABASE_ACCESS_TOKEN"        "${SUPABASE_ACCESS_TOKEN}"
inject_key "STRIPE_SECRET_KEY"            "${STRIPE_SECRET_KEY}"
inject_key "RESEND_API_KEY"               "${RESEND_API_KEY}"
inject_key "MOBSF_URL"                    "${MOBSF_URL}"
inject_key "MOBSF_API_KEY"                "${MOBSF_API_KEY}"
inject_key "BEARER_API_KEY"               "${BEARER_API_KEY}"

# ---------- 报告 ----------
CMD_COUNT=$(grep -c '"description"' "$CONFIG_FILE" 2>/dev/null || node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(Object.keys(c.command).length)}catch(e){console.log(0)}")
MCP_COUNT=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(Object.keys(c.mcp).length)}catch(e){console.log(0)}")

echo ""
echo "  ┌────────────────────────────────────────────┐"
echo "  │  opencode 全局配置部署完成                  │"
echo "  │  命令: ${CMD_COUNT}个 · MCP: ${MCP_COUNT}个 · 38 工作流对齐  │"
echo "  │  重启 opencode 后生效                        │"
echo "  └────────────────────────────────────────────┘"
echo ""
echo "  提示: 未设置 API Key 的 MCP 服务器默认禁用"
echo "  启用方式: 设置对应环境变量后重新运行本脚本"
echo "  或手动编辑 ~/.config/opencode/opencode.json 改 \"enabled\": true"
