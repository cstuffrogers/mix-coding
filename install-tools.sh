#!/usr/bin/env bash
# ==============================================
# Mix-Coding 外部工具一键安装 v1.2
# ==============================================

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_SCENE="$SCRIPT_DIR/claude-scene"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "=============================================="
echo -e "${GREEN}[OK]${NC} Mix-Coding External Tools Installer"
echo "=============================================="
echo ""

# ── Step 1: Check prerequisites ──
echo -e "${BLUE}[1/4]${NC} Checking prerequisites..."

if ! command -v node &>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is required but not found in PATH"
    echo "   Download: https://nodejs.org/"
    exit 1
fi
echo -e "  ${GREEN}[OK]${NC} Node.js $(node -v)"

if ! command -v npm &>/dev/null; then
    echo -e "${RED}[ERROR]${NC} npm is required but not found"
    exit 1
fi
echo -e "  ${GREEN}[OK]${NC} npm $(npm -v)"

PYTHON_MISSING=0
# On Windows, python3 is often a Store stub — prefer python
PY_CMD=""
if command -v python &>/dev/null; then
    PY_CMD="python"
elif command -v python3 &>/dev/null; then
    PY_CMD="python3"
else
    echo -e "${YELLOW}[WARNING]${NC} Python not found — seraphim-audit will be skipped"
    echo "   Download: https://www.python.org/"
    PYTHON_MISSING=1
fi

if [ "$PYTHON_MISSING" -eq 0 ]; then
    echo -e "  ${GREEN}[OK]${NC} $($PY_CMD --version 2>&1)"
fi

echo ""

# ── Step 2: Install npm tools ──
echo -e "${BLUE}[2/4]${NC} Installing npm tools in claude-scene..."
echo ""

if [ ! -d "$CLAUDE_SCENE" ]; then
    echo -e "${RED}[ERROR]${NC} claude-scene directory not found: $CLAUDE_SCENE"
    exit 1
fi

cd "$CLAUDE_SCENE"

# Check if package.json dependencies are already installed
NEEDS_NPM_INSTALL=0
for pkg in @lhci/cli knip; do
    if [ ! -d "node_modules/$pkg" ]; then
        NEEDS_NPM_INSTALL=1
        break
    fi
done

if [ "$NEEDS_NPM_INSTALL" -eq 0 ]; then
    echo "   [SKIP] package.json dependencies already installed"
else
    echo "   Running: npm install --legacy-peer-deps"
    PUPPETEER_SKIP_DOWNLOAD=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --legacy-peer-deps || echo -e "${YELLOW}[WARNING]${NC} npm install had errors — continuing..."
fi

echo ""

# Additional tools (noleak, pa11y-ci, recheck-cli)
ADDITIONAL_TOOLS="noleak pa11y-ci recheck-cli"
ALL_ADDITIONAL_PRESENT=1
for pkg in $ADDITIONAL_TOOLS; do
    if [ ! -d "node_modules/$pkg" ]; then
        ALL_ADDITIONAL_PRESENT=0
        break
    fi
done

if [ "$ALL_ADDITIONAL_PRESENT" -eq 1 ]; then
    echo "   [SKIP] Additional tools (noleak, pa11y-ci, recheck-cli) already installed"
else
    echo "   Installing additional tools (noleak, pa11y-ci, recheck-cli)..."
    PUPPETEER_SKIP_DOWNLOAD=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -D noleak pa11y-ci recheck-cli --legacy-peer-deps 2>/dev/null || \
        echo -e "${YELLOW}[WARNING]${NC} Some additional tools may not have installed — continuing..."
fi

echo ""
echo "   Verifying installed tools..."
for pkg in @lhci/cli knip noleak pa11y-ci recheck-cli; do
    if [ -d "node_modules/$pkg" ]; then
        echo -e "     ${GREEN}[OK]${NC} $pkg"
    else
        echo -e "     ${YELLOW}[--]${NC} $pkg (not found, may use npx on demand)"
    fi
done
echo ""

# ── Step 3: Install Python tools ──
echo -e "${BLUE}[3/4]${NC} Installing Python tools..."
echo ""

if [ "$PYTHON_MISSING" -eq 1 ]; then
    echo -e "  ${YELLOW}[SKIP]${NC} Python not found — seraphim-audit not installed"
    echo "  Manual install: pip install git+https://github.com/seraphimhub/seraphim-audit.git"
else
    PIP_LIST=$($PY_CMD -m pip list 2>/dev/null || true)
    if echo "$PIP_LIST" | grep -qi "seraphim-audit"; then
        echo -e "  ${GREEN}[SKIP]${NC} seraphim-audit already installed"
    else
        echo "   Installing seraphim-audit (via requirements.txt)..."
        $PY_CMD -m pip install -r "$SCRIPT_DIR/requirements.txt" 2>&1 || \
            echo -e "  ${YELLOW}[WARNING]${NC} seraphim-audit install failed — try: pip install -r requirements.txt"
    fi
    echo ""
fi

# ── Step 4: Install binary tools ──
echo -e "${BLUE}[4/4]${NC} Installing binary tools..."
echo ""

# lychee
if command -v lychee &>/dev/null; then
    echo -e "  ${GREEN}[SKIP]${NC} lychee already installed ($(lychee --version 2>&1))"
elif command -v brew &>/dev/null; then
    echo "   Installing lychee via Homebrew..."
    brew install lychee && echo -e "  ${GREEN}[OK]${NC} lychee installed"
elif command -v cargo &>/dev/null; then
    echo "   Installing lychee via Cargo..."
    cargo install lychee && echo -e "  ${GREEN}[OK]${NC} lychee installed"
else
    echo -e "  ${YELLOW}[--]${NC} lychee not found in PATH"
    echo "   Install: https://github.com/lycheeverse/lychee/releases"
    echo ""
fi

# act
if command -v act &>/dev/null; then
    echo -e "  ${GREEN}[SKIP]${NC} act already installed ($(act --version 2>&1))"
elif command -v winget &>/dev/null; then
    echo "   Installing act via winget..."
    winget install nektos.act --accept-package-agreements --accept-source-agreements 2>&1 || \
        echo -e "  ${YELLOW}[--]${NC} act install failed — download: https://github.com/nektos/act/releases"
else
    echo -e "  ${YELLOW}[--]${NC} act not found — download: https://github.com/nektos/act/releases"
    echo ""
fi

# restic
if command -v restic &>/dev/null; then
    echo -e "  ${GREEN}[SKIP]${NC} restic already installed ($(restic version 2>&1 | head -1))"
elif command -v winget &>/dev/null; then
    echo "   Installing restic via winget..."
    winget install restic.restic --accept-package-agreements --accept-source-agreements 2>&1 || \
        echo -e "  ${YELLOW}[--]${NC} restic install failed — download: https://github.com/restic/restic/releases"
else
    echo -e "  ${YELLOW}[--]${NC} restic not found — download: https://github.com/restic/restic/releases"
    echo ""
fi

echo ""
echo "=============================================="
echo -e "${GREEN}[OK]${NC} Installation complete!"
echo "=============================================="
echo ""
echo "Installed tools:"
echo "  npm (claude-scene/devDependencies):"
echo "    - @lhci/cli         (Lighthouse CI performance gate)"
echo "    - knip              (dead code detection)"
echo "    - noleak            (build leak detection)"
echo "    - pa11y-ci          (WCAG 2.1 AA accessibility)"
echo "    - recheck-cli       (ReDoS detection)"
echo ""
if [ "$PYTHON_MISSING" -eq 1 ]; then
    echo "  Python: [SKIPPED] seraphim-audit not installed"
else
    echo "  Python:"
    echo "    - seraphim-audit   (security header scanning)"
fi
echo ""
echo "  Binary:"
echo "    - lychee           (dead link checker)"
echo "    - act              (local GitHub Actions runner)"
echo "    - restic           (encrypted deduplicated backup)"
echo ""
echo "Next steps:"
echo "  1. Verify: cd claude-scene && npx vitest run"
echo "  2. Test a workflow: node src/index.js start audit --auto --dry-run"
echo ""
