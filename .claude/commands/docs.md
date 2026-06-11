---
description: Generate project documentation (API docs, architecture, changelog)
argument-hint: "[api|arch|changelog|all]"
---

# /docs — Generate Documentation

**Input**: $ARGUMENTS

---

## Your Mission

Generate project documentation based on the specified mode:

1. **API docs** (`api`) — Extract JSDoc from source, generate docs/api/
2. **Architecture** (`arch`) — Generate docs/architecture.md with structure and stack info
3. **Changelog** (`changelog`) — Parse conventional commits, update docs/CHANGELOG.md
4. **All** (`all`) — Run all three

Default: `all`

---

## Execution Steps

### Step 1: Parse mode from $ARGUMENTS

If empty, default to `all`.

### Step 2: Run documentation handlers

```bash
cd e:/auto-coding/claude-scene

# API docs
if [ "$MODE" = "api" ] || [ "$MODE" = "all" ]; then
  echo "=== Generating API Docs ==="
  node -e "
    const { handleApiDocs } = require('./src/handlers/docs.js');
    handleApiDocs('api-docs', { include: 'src' }, process.cwd(), {});
  "
fi

# Architecture docs
if [ "$MODE" = "arch" ] || [ "$MODE" = "all" ]; then
  echo "=== Generating Architecture Docs ==="
  node -e "
    const { handleDevDocs } = require('./src/handlers/docs.js');
    handleDevDocs('dev-docs', {}, process.cwd(), {});
  "
fi

# Changelog
if [ "$MODE" = "changelog" ] || [ "$MODE" = "all" ]; then
  echo "=== Generating Changelog ==="
  node -e "
    const { handleChangelog } = require('./src/handlers/docs.js');
    handleChangelog('changelog', {}, process.cwd(), {});
  "
fi
```

### Step 3: Report

Show summary of generated files in docs/ directory.

---

## Output

Files written to `docs/`:
- `docs/api/*.md` — Per-module API documentation
- `docs/architecture.md` — Project architecture overview
- `docs/CHANGELOG.md` — Conventional-commits changelog

**Guarantee**: This command only writes to the `docs/` directory. CLAUDE.md and .claude/rules/ are never touched.
