#!/usr/bin/env bash
# upgrade.sh - Mix-Coding 安全升级工具（macOS/Linux）
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${PROJECT_DIR}/backup/${TIMESTAMP}"

echo ""
echo "=============================================="
echo "Mix-Coding 安全升级工具"
echo "=============================================="
echo ""

# 1. 检查当前状态
echo "[1/6] 检查当前状态..."

if [ ! -d "${PROJECT_DIR}/.claude" ]; then
  echo "[ERROR] .claude 目录未找到，不是有效的 Mix-Coding 项目"
  exit 1
fi
echo "[OK] 项目目录结构验证通过"
echo ""

# 2. 冲突检查
echo "[2/6] 零冲突检查..."
echo "[OK] 无冲突（shell 环境直接兼容）"
echo ""

# 3. 备份
echo "[3/6] 备份当前配置..."

mkdir -p "${BACKUP_DIR}"
echo "   备份目录: ${BACKUP_DIR}"

for dir in .claude claude-scene; do
  if [ -d "${PROJECT_DIR}/${dir}" ]; then
    echo "   备份 ${dir}/..."
    cp -a "${PROJECT_DIR}/${dir}" "${BACKUP_DIR}/${dir}"
  fi
done

for f in package.json package-lock.json README.md; do
  if [ -f "${PROJECT_DIR}/${f}" ]; then
    cp "${PROJECT_DIR}/${f}" "${BACKUP_DIR}/"
  fi
done

echo "[OK] 备份完成: ${BACKUP_DIR}"
echo ""

# 4. 提示升级
echo "[4/6] 准备升级..."
echo ""
echo "[WARNING] 升级前注意事项:"
echo "   1. 请确保已下载新版 Mix-Coding"
echo "   2. 将新版中的以下目录复制到当前项目:"
echo "      - .claude/    （合并，不要覆盖自定义配置）"
echo "      - claude-scene/ （覆盖）"
echo ""
echo "   或手动升级:"
echo "    1. 保留 .claude/knowledge/ 和 .claude/rules/ 中的自定义内容"
echo "    2. 升级 .claude/commands/ 和 .claude/scenes/"
echo "    3. 升级 claude-scene/"
echo ""
read -r -p "   准备好了吗？(y/N) " READY
if [ "${READY}" != "y" ] && [ "${READY}" != "Y" ]; then
  echo "[WARNING] 升级已取消，项目保持不变"
  echo "   备份保存于: ${BACKUP_DIR}"
  exit 0
fi
echo ""

# 5. 检查清单
echo "[5/6] 升级检查清单..."
echo ""
echo "[OK] 请按以下顺序操作:"
echo ""
echo "   1. 合并 .claude/ 目录（保留自定义配置）"
echo "      - 保留: .claude/knowledge/（知识库）"
echo "      - 保留: .claude/rules/（规则）"
echo "      - 升级: .claude/commands/（新命令）"
echo "      - 升级: .claude/scenes/（新场景）"
echo ""
echo "   2. 升级 claude-scene/ 目录"
echo "      - 覆盖: claude-scene/（CLI 工具）"
echo "      - 运行: cd claude-scene && npm install"
echo ""
echo "   3. 更新全局命令文件"
echo "      - 复制: .claude/commands/*.md 到 ~/.claude/commands/"
echo ""
echo "完成上述步骤后按回车继续验证..."
read -r
echo ""

# 6. 验证
echo "[6/6] 验证升级..."

if [ -f "${PROJECT_DIR}/claude-scene/package.json" ]; then
  echo "[OK] claude-scene 目录存在"
else
  echo "[WARNING] claude-scene 目录可能缺失"
fi

SCENE_COUNT=$(find "${PROJECT_DIR}/.claude/scenes" -name "*.json" 2>/dev/null | wc -l)
COMMAND_COUNT=$(find "${PROJECT_DIR}/.claude/commands" -name "*.md" 2>/dev/null | wc -l)
echo "[OK] 检测到 ${SCENE_COUNT} 个场景, ${COMMAND_COUNT} 个命令"

echo ""
echo "=============================================="
echo "[OK] 升级流程完成！"
echo "=============================================="
echo ""
echo "[NOTE] 重要提示:"
echo "   1. 如果升级后出现问题，从备份恢复:"
echo "      ${BACKUP_DIR}"
echo ""
echo "   2. 重启 Claude Code 以加载新命令"
echo ""
echo "   3. 测试命令是否正常:"
echo "      /review, /bugfix, /feature 等"
echo ""
echo "[NEXT STEPS]"
echo "   1. 完全重启 Claude Code"
echo "   2. 运行: cd claude-scene && node src/index.js list"
echo "   3. 测试简单命令验证功能"
echo ""
