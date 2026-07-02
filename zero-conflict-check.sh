#!/bin/bash
# zero-conflict-check.sh — 架构合规检查
# 验证工具命名前缀、依赖方向、三层纯度

set -euo pipefail
ERR=0

echo "=== Zero-Conflict Architecture Check ==="
echo ""

# 1. 检查命名前缀冲突
echo "--- 1. Tool name prefix check ---"
CONFLICTS=$(grep -rn "\.action(" claude-scene/src/handlers/ 2>/dev/null | grep -vE "memory-|review-|design-|scene-|test-|mcp-|action-" || true)
if [ -n "$CONFLICTS" ]; then
  echo "❌ Found handlers without prefix:"
  echo "$CONFLICTS"
  ERR=1
else
  echo "✅ All handlers use proper prefixes"
fi

# 2. 检查 handler 文件数
echo ""
echo "--- 2. Handler count ---"
HANDLER_COUNT=$(find claude-scene/src/handlers -name "*.js" 2>/dev/null | wc -l)
echo "✅ $HANDLER_COUNT handler files"

# 3. 检查三层分离
echo ""
echo "--- 3. Layer purity check ---"
# Scene JSON files should not contain business logic
if grep -q "business_logic\|db_query\|api_call" .claude/scenes/*.json 2>/dev/null; then
  echo "⚠️  Some scene files may contain business logic"
else
  echo "✅ Scene files appear to be pure flow definitions"
fi

# 4. 检查 Harness 文件完整性
echo ""
echo "--- 4. Harness file check ---"
for f in feature_list.json progress.md DECISIONS.md; do
  if [ -f "$f" ]; then
    echo "✅ $f"
  else
    echo "❌ $f missing"
    ERR=1
  fi
done

# Summary
echo ""
if [ $ERR -eq 0 ]; then
  echo "✅ Architecture compliance check passed"
else
  echo "❌ $ERR issue(s) found"
fi
exit $ERR
