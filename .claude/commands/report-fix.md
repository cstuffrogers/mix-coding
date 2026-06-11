---
description: Fix issues identified in a project report
argument-hint: "<@latest or report-MMDDyy-HHmmss>"
---

# /report-fix — Systematically Fix Report Issues

Read a project report and fix the identified issues, prioritized by severity.

## User Input

```text
$ARGUMENTS
```

Parse the argument to find the report file:
- If `@latest` — find the newest `report-*.md` file in `reports/`
- Otherwise — look for `reports/$ARGUMENTS.md` or `reports/$ARGUMENTS`

If the report file doesn't exist, tell the user and suggest running `jvn --report` first.

## Process

### 1. Read and Parse the Report

Read the report file. Extract actionable items from:
- **Weaknesses** (rated Critical/High/Medium/Low)
- **Threats** (security, outdated deps, scaling)
- **Opportunities** (quick wins first)

Skip Strengths — those are already good.

### 2. Prioritize

Order fixes by priority:

1. **Critical** — Security vulnerabilities, breaking issues, data integrity risks
2. **High** — Outdated deps with known issues, missing auth checks, missing tests for critical paths
3. **Medium** — Tech debt, DX improvements, performance optimizations
4. **Low** — Cosmetic issues, nice-to-haves

### 3. Execute Fixes

For each issue, choose the right approach:

**Quick fix** (< 5 minutes, isolated change):
- Fix directly — edit the file, add the test, update the dep
- Commit with descriptive message

**Medium fix** (touches multiple files, needs design):
- Use the `/spec` → `/design` → `/build` pipeline
- The spec should reference the report finding

**Dependency update**:
- Run the update command
- Verify tests still pass
- Check for breaking changes in changelog

### 4. User Approval Gates

**CRITICAL and HIGH priority items**: STOP and present the proposed fix to the user before executing. Wait for explicit approval (PROCEED / SKIP / MODIFY).

**MEDIUM and LOW items**: Fix and present a summary. User can undo with `/rewind` if needed.

### 5. Generate Fix Report

After all fixes, append a Fix Report section to the ORIGINAL report file:

```markdown
---

## Fix Report — [timestamp]

### Summary
Fixed [N] of [M] identified issues.

### Fixes Applied

| # | Issue | Priority | Action Taken | Status |
|---|-------|----------|-------------|--------|
| 1 | [issue from report] | Critical | [what was done] | ✓ Done |
| 2 | [issue from report] | High | [what was done] | ✓ Done |
| 3 | [issue from report] | Medium | Skipped (user) | ⊘ Skipped |

### Files Changed
[List of files modified with change type]

### Remaining Items
[Any issues that were not addressed and why]
```

### 6. Present Results

Tell the user:
- How many issues were fixed
- Which issues were skipped and why
- Suggest committing the changes
- Suggest running `jvn --report` again to verify improvements
