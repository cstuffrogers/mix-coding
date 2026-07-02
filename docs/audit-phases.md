# Audit Scene Phase Breakdown

> 本文档拆分 `audit.json` (620 行) 为逻辑阶段，便于理解和维护。

## Phase 0: Pre-flight (steps 0.3–0.5)
- Load review checklist skill
- Recall security/audit/quality memory

## Phase 1: Core Security (steps 1–3.09)
- sec-bug-hunt: XSS/SQLi/CSRF/keys
- 5-layer code review (ESLint → Playwright → AI)
- npm audit / pip audit / cargo audit
- pa11y-ci (if frontend)
- i18n audit
- Open redirect scan
- Security headers scan
- ReDoS scan
- Log sanitization
- CORS check
- env var leak check

## Phase 2: Deep Analysis (steps 3.12–3.28)
- Sensitive file check
- Deprecated deps detection
- Handler verification (stub detection)
- SkillSpector AI skill security scan
- AI slop code smell scan
- Knip dead code
- Dependency-cruiser architecture
- actionlint + zizmor (GitHub Actions)
- jscpd copy-paste detection
- size-limit bundle budget
- Stryker mutation testing
- Spectral API lint
- markdownlint

## Phase 3: Performance & Metrics (steps 4–8.8)
- Performance static analysis
- Test coverage report
- Code complexity scan (cyclomatic, maintainability)
- Deps outdated check
- Git history secret scan
- Dead link check
- Build leak check
- Lighthouse CI performance gate

## Phase 4: Report & Follow-up (steps 9–15)
- Quality gate aggregation
- Audit report generation (docs/audit-report.md)
- Huashu infographic (optional)
- Architecture deep audit (optional)
- Interactive report + auto-fix
- Cost report
- CE compound knowledge save
- Memory save
- Notification
