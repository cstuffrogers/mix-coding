---
description: Five-layer code review: static analysis, runtime patterns, visual regression, AI semantic, aggregate report.
argument-hint: "[--mode pr|full|commit] [--base main] [--layers static,react,visual,ai]"
---

# /review - Five-Layer Code Review

Five-layer review pipeline: static analysis → runtime patterns → visual regression → AI semantic → aggregate report.

## Usage

```text
/review                          # Review uncommitted changes
/review --mode pr                # Review current PR branch
/review --mode full              # Full project review
/review --mode commit            # Review HEAD commit
/review --base main              # Review against base branch
/review --layers static,ai       # Run only selected layers
```

## Layers

### Layer 1: Static Analysis

Run project-appropriate linters based on detected tech stack:

| Tech Stack | Tools |
|------------|-------|
| TypeScript/React | `npx eslint` + `npx tsc --noEmit` |
| Python | `ruff check` + `mypy` |
| Rust | `cargo clippy` + `cargo check` |
| Go | `go vet` + `staticcheck` |
| Kotlin | `./gradlew ktlintCheck` + `detekt` |

Execute the relevant tools. Capture warnings and errors.

### Layer 2: Runtime Pattern Check (optional)

For React projects:
- Check for common anti-patterns: missing `key` props, state update after unmount, dependency array issues
- Use `Grep` to find: `useEffect` without deps, `setState` in render, direct DOM manipulation

### Layer 3: Visual Regression (optional)

If Playwright is configured:
```bash
npx playwright test --grep "visual"
```
Otherwise skip this layer and note it.

### Layer 4: AI Semantic Review

Analyze code for:
- **Design**: Does the code follow project conventions and patterns?
- **Safety**: Any error swallowing, unhandled promises, missing null checks?
- **Performance**: N+1 queries, missing memoization, large bundles?
- **Readability**: Confusing naming, deeply nested logic, magic numbers?

### Layer 5: Aggregate Report

Combine findings from all layers:

```
Review Report
=============
Mode: pr
Base: main
Files changed: N

Layers Run:
- static: N issues found
- react: N anti-patterns found
- visual: N regressions / skipped
- ai: N semantic issues found

Critical Issues (must fix):
1. File:line — Description → Fix

Important Issues:
1. File:line — Description → Fix

Advisory:
1. Suggestion
```