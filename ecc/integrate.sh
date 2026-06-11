#!/usr/bin/env bash
set -euo pipefail

ECC_REPO="https://github.com/affaan-m/everything-claude-code.git"
ECC_DIR="ecc/source"
KNOWLEDGE_DIR=".claude/knowledge"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[ECC]${NC} $1"; }
warn() { echo -e "${YELLOW}[ECC]${NC} $1"; }
err()  { echo -e "${RED}[ECC]${NC} $1"; }

cleanup() {
  log "清理临时文件..."
  rm -rf "$ECC_DIR/.git"
}

trap cleanup EXIT

log "===== ECC (everything-claude-code) 集成脚本 ====="
log "版本: 1.0.0"
log "策略: 命名空间隔离 + 持续学习系统为核心"
echo ""

mkdir -p "$KNOWLEDGE_DIR"

if [ -d "$ECC_DIR" ]; then
  warn "ECC 目录已存在，跳过克隆。如需重新克隆请先删除 ecc/source/"
else
  log "克隆 ECC 仓库 (shallow clone)..."
  git clone --depth 1 "$ECC_REPO" "$ECC_DIR" 2>&1 || {
    err "克隆失败，请检查网络连接。"
    err "手动克隆: git clone --depth 1 $ECC_REPO $ECC_DIR"
    exit 1
  }
  log "克隆完成"
fi

log "处理命名空间冲突..."

if [ -f "$ECC_DIR/.claude/commands/code-review.md" ]; then
  mv "$ECC_DIR/.claude/commands/code-review.md" \
     "$ECC_DIR/.claude/commands/ecc-code-review.md"
  log "重命名: code-review → ecc-code-review"
fi

if [ -f "$ECC_DIR/.claude/commands/security-scan.md" ]; then
  mv "$ECC_DIR/.claude/commands/security-scan.md" \
     "$ECC_DIR/.claude/commands/ecc-security-scan.md"
  log "重命名: security-scan → ecc-security-scan"
fi

if [ -f "$ECC_DIR/.claude/commands/e2e.md" ]; then
  mv "$ECC_DIR/.claude/commands/e2e.md" \
     "$ECC_DIR/.claude/commands/ecc-e2e.md"
  log "重命名: e2e → ecc-e2e"
fi

log "过滤框架专属 Skills (Django/SpringBoot/Go/Swift)..."
if [ -d "$ECC_DIR/.claude/skills" ]; then
  for skill_dir in "$ECC_DIR/.claude/skills"/*; do
    name=$(basename "$skill_dir")
    case "$name" in
      django-*|springboot-*|golang-*|swift-*)
        warn "跳过: $name (框架不匹配)"
        rm -rf "$skill_dir"
        ;;
    esac
  done
fi

log "初始化持续学习知识库..."
cat > "$KNOWLEDGE_DIR/.gitkeep" << 'EOF'
ECC 持续学习知识库

本目录存储跨会话的学习数据:
- learn/   : 从会话中提取的模式和经验
- evolve/  : 演化为可复用 Skill/Rule 的知识
- patterns/: 识别出的编码模式

触发命令:
  /learn   : 从当前会话提取知识
  /evolve  : 将知识演化为 Skill
EOF

echo "{}" > "$KNOWLEDGE_DIR/index.json"

cat > ".claude/scenes/ecc-learn.json" << 'SCENE'
{
  "id": "ecc-learn",
  "name": "ECC 持续学习",
  "description": "从当前会话提取模式、错误和经验，存入知识库",
  "steps": [
    { "id": "analyze-session", "type": "command", "command": "learn", "prompt": "分析当前会话中的所有代码变更、错误修复记录和决策过程" },
    { "id": "extract-patterns", "type": "command", "command": "learn", "prompt": "提取可复用的编码模式、常见错误模式和最佳实践" },
    { "id": "store-knowledge", "type": "command", "command": "learn", "prompt": "将提取的知识结构化存入 .claude/knowledge/ 目录" },
    { "id": "suggest-skills", "type": "command", "command": "learn", "prompt": "评估是否有可演化为 Skill 的知识，给出建议" }
  ]
}
SCENE

cat > "ecc/scenes/ecc-evolve.json" << 'SCENE'
{
  "id": "ecc-evolve",
  "name": "ECC 知识演化",
  "description": "将累积的知识演化为可复用的 Skill",
  "steps": [
    { "id": "load-knowledge", "type": "command", "command": "evolve", "prompt": "加载 .claude/knowledge/ 中的累积知识" },
    { "id": "evaluate-readiness", "type": "command", "command": "evolve", "prompt": "评估哪些知识已经足够成熟可以演化为 Skill" },
    { "id": "generate-skill", "type": "command", "command": "evolve", "prompt": "将成熟的知识转化为可复用的 Skill 文件" },
    { "id": "validate-skill", "type": "command", "command": "evolve", "prompt": "验证新生成的 Skill 的质量和一致性" }
  ]
}
SCENE

log "创建 ECC Agent → Archon 工作流集成..."

cat > "ecc/workflows/ecc-tdd.yaml" << 'YAML'
name: ecc-tdd
version: "1.0"
description: ECC TDD 引导 — 集成到 feature 工作流中
integrated_into: feature
trigger: feature 工作流中 tdd-enforce 节点
steps:
  - id: write-failing-test
    command: prompt
    prompt: |
      按照 TDD 原则：
      1. 先为当前功能编写一个会失败的测试
      2. 确保测试覆盖了边界情况和错误路径
      3. 运行测试确认它确实失败（红阶段）
  - id: write-minimal-code
    command: prompt
    prompt: |
      编写最小量的代码使测试通过（绿阶段）：
      1. 只写足够让测试通过的代码
      2. 不要过度设计
      3. 运行测试确认通过
  - id: refactor
    command: prompt
    prompt: |
      重构阶段：
      1. 在测试保护下优化代码结构
      2. 消除重复、提高可读性
      3. 确保所有测试仍通过
YAML

log ""
log "===== 集成完成 ====="
log "下一步:"
log "  1. 检查 ecc/source/ 中的 ECC 文件"
log "  2. 在 Claude Code 中使用 /ecc-plan, /ecc-tdd, /ecc-code-review 等命令"
log "  3. 使用 /learn 和 /evolve 启动持续学习"
log "  4. 查看 ecc/mapping.json 了解完整映射关系"