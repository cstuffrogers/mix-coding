---
description: Start an iterative optimization loop with analyze → plan → implement → verify → repeat cycles.
argument-hint: "[迭代次数]"
---

# /loop - Iterative Optimization Loop

Start an iterative optimization loop: analyze the problem, plan a fix, implement it, verify the result, and repeat until satisfied.

## Usage

```text
/loop                # Run 3 iterations (default)
/loop 5              # Run 5 iterations
/loop "fix lint"  5  # Run 5 iterations focused on lint issues
```

## Workflow

### Phase 1: Analyze

1. Read `$ARGUMENTS` for the task description and iteration count
2. Use `Grep`, `Glob`, and `Read` to understand the current state
3. Identify the problems to fix or improvements to make
4. Score current quality (0-10) as a baseline

### Phase 2: Plan

1. Create a plan for this iteration:
   - What to change
   - Expected impact
   - How to verify
2. Write the plan to `.claude/plan/loop-plan.md`

### Phase 3: Implement

Execute the plan:
- Make the changes using `Edit` or `Write`
- Keep each iteration focused on ONE area at a time
- Commit changes after each iteration: `git add -A && git commit -m "loop: iteration N - [what changed]"`

### Phase 4: Verify

After implementing:
1. Run relevant tests to verify changes didn't break anything
2. Run linters and formatters to check quality
3. Score current quality and compare to baseline
4. If score improved: continue to next iteration
5. If score didn't improve or max iterations reached: stop

### Phase 5: Report

```
Loop Report
===========
Iterations completed: N / M
Baseline score: X.X
Final score: Y.Y
Improvement: +Z.Z

Changes made:
1. Iteration 1: [description] — score: X.X → Y.Y
2. Iteration 2: [description] — score: Y.Y → Z.Z
...

Files modified: N
Commits: N
```

## Safety Rules

- Do NOT make destructive changes without creating a `git stash` first
- Run tests after each iteration before proceeding
- If two consecutive iterations show no improvement, stop and report
- Maximum 10 iterations regardless of user input (safety cap)