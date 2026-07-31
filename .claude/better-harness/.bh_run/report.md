# Better Harness Task-Loop Report

## At a Glance

- Loop Effectiveness: 54/100 (changes only after comparable later task outcomes)
- Asset Health / Repair Progress: 0/100 (0 verified, 0 partial, 6 pending)
- Demonstrated autonomy radius: not observed (not observed; not observed confidence)
- Strongest loop: Not enough evidence difference to name one.
- Largest observed leak: Use the priority moves; no single loop is uniquely weakest.
- Top expected gain: No priority benefit is available in this evidence boundary.

## What You Can Rely On Today

- No reliable user outcome has been demonstrated in this evidence boundary yet.

## What You Gain Next

- No priority Harness move is available in this evidence boundary.



### Why these moves matter

### Engine pass/fail decision relies on an untested regex over free-text handler returns
- Priority: Medium · Evidence: not observed in this boundary
- Reason: In claude-scene/src/commands/start.js, runStep infers lastStepFailed/noop/warn by regex-matching Chinese/English substrings in handler return values (lines 327-345), with explicit suppressions and a 200-char truncation. The retry/abort/fail_workflow loop it feeds (lines 214-241) has no focused test; flow-control.test.js covers handleCheckGate but not runStep's detector or its exit paths. Fact: the detector and loop are untested. Inference: a soft failure or non-string result can silently pass or trigger wrong on_error behavior. Owner: claude-scene/src/commands/start.js. Provider: claude. Uncertainty: the regex is documented as flagging only unambiguous failures, so some suppression is intentional, but the boundary between partial and fail is not testable without invoking the full orchestrator.
- Expected Output:
  1. A focused test that exercises runStep's failure-detection regex, the retry/abort loop, and the abort/fail_workflow exit paths, so the engine's core pass/fail boundary is no longer verified only indirectly.

### Five highest-churn handlers have no focused tests, so path-specific drift is undetectable
- Priority: Medium · Evidence: not observed in this boundary
- Reason: The five highest-churn handler files (ui-tools.js ~1332 lines churn 4076, design.js ~891 churn 1523, external-tool-checks.js ~851 churn 1469, handler-verify.js ~828 churn 1428, review.js ~495 churn 901) have no focused test files; only the breadth smoke test touches them with default args and asserts a non-empty return. Fact: focused test inventory vs churn ranking. Inference: path-specific regressions in the most-edited parts of the engine are caught only when a scene breaks at runtime. Owner: claude-scene/src/handlers/{ui-tools,external-tool-checks,design,handler-verify,review}.js. Provider: claude. Uncertainty: some handlers may be thin dispatchers covered indirectly via scene-level runs, but no scene-level integration test was found in the inventory; churn and length are risk leads, not proof of defect.
- Expected Output:
  1. Focused tests for the five highest-churn handlers that cover path-specific and failure-path behavior beyond the default-args smoke test.

### Declared change-safety boundaries (line/complexity/auto-rollback) are not mechanically enforced
- Priority: Medium · Evidence: not observed in this boundary
- Reason: core-rules.md declares ±50-line, 0-new-dependency, ≤130% complexity, and test-fail-auto-rollback boundaries. Inspection of eslint.config.js shows no-unused-vars and no-undef downgraded to warn, several sonarjs rules turned off, and no sonarjs/cognitive-complexity error threshold; the orchestrator disables cognitive-complexity per-file (start.js lines 107, 276, 365; conditions.js line 120). .husky/pre-commit runs eslint with --max-warnings 500, so lint findings do not block. Fact: the declared governing requirement exists; mechanical enforcement is absent. Inference: the codebase can accumulate lint findings and exceed declared complexity/size boundaries without a blocking signal. Owner: eslint.config.js and .husky/pre-commit. Provider: claude. Uncertainty: the codeguardian MCP named in core-rules.md may enforce via a separate path not visible in static config, and the ±50-line boundary may be enforced at human PR review; both are unverified.
- Expected Output:
  1. An eslint/pre-commit configuration that mechanically enforces the declared complexity and warning-ceiling boundaries instead of tolerating them, so declared change-safety rules produce a blocking signal.

### Session validation rarely closes on a reviewed check relevant to the final change
- Priority: Medium · Evidence: not observed in this boundary
- Reason: Across the 30-day reviewed window, population withReviewedRelevantCheck=0 and observation withReviewedRelevantCheck=0; every emitted candidate's check has relation no-change-context and closure no-change-observed or changed-without-check, and the one change-bearing episode ran no check. Acceptance is uniformly assistant-handoff (withStructuredCompletion=0, withUserCorrection=0). Fact: session-core-facts envelope, 40 of 40 eligible sessions analyzed. Inference: delivery is being asserted by handoff rather than confirmed by a reviewed check tied to the final change. Owner: project validation/acceptance practice (scene engine + review workflow). Provider: claude. Uncertainty: the emitted portfolio is truncated (candidateBudget=91 omitted) and diverges from the population, but the population-level withReviewedRelevantCheck=0 is the defensible signal; handoff may be appropriate for some work types.
- Expected Output:
  1. A change-bearing acceptance route that binds the final change to a reviewed relevant check result rather than asserting delivery by handoff alone.

### Execution logs lack a per-run correlation id, so same-minute runs cannot be reliably joined
- Priority: Low · Evidence: not observed in this boundary
- Reason: initLog (claude-scene/src/commands/start.js lines 31-39) names files workflow-<sceneId>-<YYYYMMDDTHHMMSS>.log; log lines carry scene and step but no run_id/trace_id. Two concurrent or same-minute runs of the same scene share a timestamp-derived filename and their step records cannot be reliably joined for diagnosis. Fact: logging implementation inspected. Inference: AI-debug correlation is partial. Owner: claude-scene/src/commands/start.js (initLog/appendLog). Provider: claude. Uncertainty: the engine is primarily single-user interactive so concurrency may be rare, but --auto batch use and /loop scheduling make same-minute collisions plausible.
- Expected Output:
  1. A per-run id emitted on every log line so concurrent or same-minute runs of the same scene remain correlatable for diagnosis.

### hallmark SKILL.md references three local files that do not exist at their resolved paths
- Priority: Low · Evidence: not observed in this boundary
- Reason: The agent-lint envelope reports skill-missing-local-reference errors at .claude/skills/hallmark/SKILL.md lines 282, 390, and 391. Corroboration against the canonical file: line 282 links ../../site/css/tokens.css inside active theme-axis guidance; lines 390 and 391 link ../../docs/recipes.md and ../../docs/study-examples.md under a heading marked Human-only (do NOT auto-load). Filesystem check confirms none of the three resolved targets exist under .claude/ (no site/ or docs/ directory at that level; repo-wide recipes.md has zero matches). Fact: deterministic lint errors with targets confirmed absent. Inference: the references are broken links. Owner: .claude/skills/hallmark/SKILL.md. Provider: claude. Uncertainty: two of three references are explicitly designated human-only/non-auto-loaded, so their runtime impact on the Skill's executable workflow is likely lower than line 282's, which sits in auto-loadable procedural text; severity, repair, and release-admission are the lead's call.
- Expected Output:
  1. hallmark SKILL.md with no missing local references, verified by re-running the skill-local-reference lint check.

## Five Lifecycle Dimensions

| Dimension | What the evidence proves | Evidence boundary | Summary | Boundary / blocker |
| --- | --- | --- | --- | --- |
| Task Understanding | Not observed yet | not observed in this boundary | Scoped AGENTS.md and declarative scene/condition maps make the task boundary clear, but per-scene failure/next-step routing is encoded in handler return strings rather than a queryable risk map. | not observed |
| Controlled Execution | Not observed yet | not observed in this boundary | Supported start/list/show/fork entries and --dry-run are wired and smoke-tested, but there is no explicit doctor command and destructive-git guardrails are user-stated, not mechanically enforced. | not observed |
| Change Validation | Not observed yet | not observed in this boundary | Lint+test+deadcode run on every change, but the orchestrator's failure detection is an untested regex, the highest-churn handlers have no focused tests, and session evidence shows no reviewed check tied to a final change. | not observed |
| Reliable Delivery | Not observed yet | not observed in this boundary | CI gates main and a rollback scene exists, but acceptance is uniformly assistant-handoff with no structured-completion or user-correction signal in the reviewed window, and branch protection/CODEOWNERS are unverified. | not observed |
| Learning Capture | Not observed yet | not observed in this boundary | A bounded Learning Capture review was completed; no comparable later outcome has validated a reusable improvement, and session resume/review demand has no observed durable owner exercised this window. | not observed |

## The 15 Small Checks

| Dimension | Small check | What the evidence proves | Evidence boundary |
| --- | --- | --- | --- |


## Evidence and Boundaries

- Episode coverage: 0 episodes, 0 edited, 0 closed, 0 repaired-and-passed
- Model: agent-work-loop-v4
- Session selection: not observed; 0 sessions analyzed of 0 eligible sessions; not observed confidence
- Delivery grades observed: not observed
- Source gaps: not observed
- Learning comparison: Not observed; 0 declared intervention(s)
