---
description: Build it — phase by phase with code review and your approval at each gate
argument-hint: "[feature-name] [--phase N]"
---

# /build — Implement the Feature

You are orchestrating the implementation phase. Follow these steps exactly.

## User Input

```text
$ARGUMENTS
```

Parse arguments:
- Feature name (or detect from git branch / most recent `specs/` directory)
- `--phase N` — execute specific phase only (optional)

## Prerequisites

Before starting, verify these files exist:
- `specs/{feature}/spec.md`
- `specs/{feature}/plan.md`
- `specs/{feature}/tasks.md`

If any are missing, tell the user which step to run first (`/spec`, `/design`).

## Phase Implementation Loop

For each phase in `specs/{feature}/tasks.md`:

### Step 1: Implement

Use the Skill tool to invoke spec-kit implementation for the current phase:

```
Skill(skill: "speckit-implement")
```

Tell it to follow TDD: write the failing test first, then implement the minimal code to pass.

### Step 2: Run Tests

Use the Skill tool to invoke webapp-testing for validation:

```
Skill(skill: "webapp-testing")
```

Run Playwright tests against the implementation. If tests fail, fix and re-run before proceeding.

### Step 3: Code Review

Use the Task tool to invoke the code-reviewer agent:

```
Task(subagent_type: "code-reviewer",
     description: "Review Phase N implementation",
     prompt: "Review the implementation changes for Phase N of {feature}.
     Check: correctness, TDD compliance, security, performance, maintainability.
     Use your preloaded review-checklist and test-driven-development skills.
     Provide your verdict: APPROVED / APPROVED WITH SUGGESTIONS / NEEDS REVISION.")
```

**If NEEDS REVISION**: Present the blockers to the user, fix the issues, then re-run the review.

### Step 4: User Validation Gate

**STOP. Present the following to the user and wait for their decision.**

```
## Phase N Validation

### Deliverables
- [x] [Deliverable 1] — [what was done]
- [x] [Deliverable 2] — [what was done]

### Files Changed
| File | Change | Lines |
|------|--------|-------|
| path | add/modify | ±N |

### Tests
- Unit: [PASS/FAIL]
- Integration: [PASS/FAIL]
- Build: [SUCCESS/FAIL]

### Code Review
- Verdict: [reviewer's verdict]
- Issues: [list or "none"]

**Your decision:**
- PASS — proceed to next phase
- CONDITIONAL PASS — note issues, proceed
- FAIL — fix issues before proceeding
```

Do NOT proceed without the user's explicit decision.

### Step 5: Update Progress

Mark completed tasks in `specs/{feature}/tasks.md` by checking their checkboxes.

## After All Phases Complete

### Final QA: Dogfood

Use the Skill tool to invoke dogfood for systematic QA:

```
Skill(skill: "dogfood")
```

This systematically explores the running application, finds issues, and generates a report with screenshot evidence. Present the findings to the user.

### Completion Report

```
## Implementation Complete

**Feature**: {feature-name}
**Phases**: {N} of {N} completed

### Summary
[What was built, key decisions made]

### Files Modified
[List with change types]

### Tests Added
[Test files and coverage]

### Next Steps
1. Create PR
2. Deploy to staging
3. Verify in staging
```

Prompt for `/compact` — this workflow consumed significant context.

## Critical Rules

1. **TDD is enforced** — test first, then code. The code-reviewer agent flags violations.
2. **User validation gate is mandatory** — NEVER skip Step 4. NEVER auto-proceed.
3. **Use Skill tool** for spec-kit and testing skills, **Task tool** for agents
4. If stuck for more than 2 attempts on any step, STOP and ask the user for guidance
