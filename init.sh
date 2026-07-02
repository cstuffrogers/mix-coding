#!/bin/bash
# init.sh — Harness Initialization Script
# Run this at the beginning of EVERY agent session.

set -euo pipefail

ERR=0
echo "=== Harness Initialization: Mix-Coding System ==="
echo ""

# --- 1. Environment Check ---
echo "--- 1. Environment Check ---"
if command -v node &> /dev/null; then
  echo "✅ Node.js: $(node --version)"
else
  echo "❌ Node.js not found"; ERR=1
fi
git --version > /dev/null 2>&1 && echo "✅ Git: $(git --version)" || { echo "❌ Git not found"; ERR=1; }

# --- 2. Dependency Check ---
echo ""
echo "--- 2. Dependency Check ---"
if [ -f "package.json" ]; then
  if [ -d "node_modules" ]; then
    echo "✅ node_modules exists"
  else
    echo "⚠️  node_modules missing, running npm install..."
    npm install || { echo "❌ npm install failed"; ERR=1; }
  fi
fi

# --- 3. Git State Check ---
echo ""
echo "--- 3. Git State Check ---"
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "✅ Git repository initialized"
  CHANGED=$(git diff --name-only 2>/dev/null | wc -l)
  STAGED=$(git diff --staged --name-only 2>/dev/null | wc -l)
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)
  if [ "$CHANGED" -eq 0 ] && [ "$STAGED" -eq 0 ] && [ "$UNTRACKED" -eq 0 ]; then
    echo "✅ Working tree clean"
  else
    echo "⚠️  Uncommitted changes: $CHANGED modified, $STAGED staged, $UNTRACKED untracked"
  fi
  echo "✅ Current branch: $(git branch --show-current)"
fi

# --- 4. Harness Files Check ---
echo ""
echo "--- 4. Harness Files Check ---"
for file in "feature_list.json" "progress.md" "AGENTS.md" "DECISIONS.md"; do
  if [ -f "$file" ]; then
    echo "✅ $file exists"
  else
    echo "⚠️  $file missing (optional but recommended)"
  fi
done

# --- 5. Verification Check ---
echo ""
echo "--- 5. Verification Check ---"
if [ -f "package.json" ]; then
  if grep -q '"test"' package.json 2>/dev/null; then
    echo "Running tests..."
    if npm test 2>/dev/null; then
      echo "✅ Tests pass"
    else
      echo "⚠️  Tests failing (agent must fix before declaring done)"
    fi
  fi
fi

# --- Summary ---
echo ""
echo "=== Initialization Summary ==="
if [ $ERR -eq 0 ]; then
  echo "✅ Environment is healthy. Agent may proceed."
  echo ""
  echo "Next steps:"
  echo "  1. Read feature_list.json to confirm scope"
  echo "  2. Read progress.md for context"
  echo "  3. Work on ONE feature at a time (WIP = 1)"
  exit 0
else
  echo "❌ Environment issues detected. Please fix before proceeding."
  exit 1
fi
