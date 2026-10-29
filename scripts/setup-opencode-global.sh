#!/usr/bin/env sh
# setup-opencode-global.sh — 一键配置 opencode 全局命令 + MCP + Provider
#
# 数字一律由 .opencode/deploy-global.cjs 现场生成后统计（不再写死在注释和面板里：
# 以前这里写「108 命令 + MCP(17) + Provider(4) + 38 工作流对齐」，四个数字里有三个是错的，
# 而且面板里的「命令数」是用 `grep -c '"description"'` 数的 —— 数的是描述行不是命令）。
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
# 效果: 写入 ~/.config/opencode/opencode.json（命令/MCP/Provider 数量以生成结果为准）
#       命令由 .claude/commands/*.md 与 scripts/generate-opencode-config.cjs 的手写表合成，
#       其中引用本地 .md 的命令条数也在生成后统计（--json 可自行核对）

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
# 直接从生成出来的配置里数：command / mcp / provider 的键数，以及「模板引用了本地 .md」的条数。
# 以前这里用 `grep -c '"description"'` 数命令 —— 数到的是描述行，不是命令（110 ≠ 106）。
read -r CMD_COUNT MCP_COUNT PROV_COUNT MD_REF_COUNT <<EOF
$(node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const n = (o) => Object.keys(o || {}).length;
const mdRefs = Object.values(c.command || {}).filter((v) => v.template && v.template.includes('.claude/commands')).length;
console.log([n(c.command), n(c.mcp), n(c.provider), mdRefs].join(' '));
" "$CONFIG_FILE")
EOF

echo ""
echo "  opencode 全局配置部署完成："
echo "    命令: ${CMD_COUNT} 个（其中 ${MD_REF_COUNT} 个直接引用本仓库 .claude/commands/*.md）"
echo "    MCP: ${MCP_COUNT} 个 · Provider: ${PROV_COUNT} 个"
echo "    重启 opencode 后生效"
echo ""
echo "  提示: 未设置 API Key 的 MCP 服务器默认禁用"
echo "  启用方式: 设置对应环境变量后重新运行本脚本"
echo "  或手动编辑 ~/.config/opencode/opencode.json 改 \"enabled\": true"
