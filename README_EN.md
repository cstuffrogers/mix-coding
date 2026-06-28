# 🚀 Mix-Coding System — Quick Start Guide

Get started with the fully automated code development system in 5 minutes.
Designed for non-technical users — integrates the hottest GitHub projects with zero conflicts.

---

## 📦 System Overview

A **three-layer architecture + Scene engine** intelligent development system:

- ✅ **29 automated workflows** (23 Web + 6 Mobile) — code review, security scanning, performance optimization, E2E testing, release deployment, environment setup, engine self-check, and more
- ✅ **Multi-round auto review & fix**: iterate until issues are cleared
- ✅ **AI-driven design**: Open Design fully integrated (152 brands + 111 templates + 137 skills + 6 device frames + 3 decks + 102 prompt templates + 11 craft principles)
- ✅ **Frontend polish toolchain**: DaisyUI (35+ themes) + Animal Island UI + Animate.css + Lucide React + Playwright + Impeccable critique (27 anti-AI-pattern rules) + web-design-engineer + ai-friendly-web-design + awesome-design-md (5 brand DESIGN.md: Vercel/Linear/Stripe/Notion/Apple)
- ✅ **5-layer code review**: ESLint + TypeScript + Security Scan + npm audit + AI Semantic + Handler verification (10-pass stub detection)
- ✅ **Database migration review**: scans migration files, detects 8 dangerous patterns (DROP TABLE / NOT NULL without DEFAULT, etc.), blocks high-risk changes
- ✅ **Load testing**: Artillery integration — smoke/load/stress, 3-tier performance gates
- ✅ **Security vulnerability scanning**: ESLint security rules + OWASP Top-10 + npm audit + security headers + build leak detection + dead link detection + open redirect detection + state management audit + ReDoS scanning + log sanitization + CORS check + sensitive file check + supply chain security
- ✅ **External toolchain**: 26 tools (Critiq / Stagehand / mythos-agent / trivy / gitleaks / semgrep / commitlint / noleak / seraphim-audit / lychee / pa11y-ci / recheck-cli / shellcheck / sqlfluff / bruno / log-sanitizer / cors-checker / env-leak-scanner / sensitive-file-check / deprecated-deps / knip / skillspector / aislop / dependency-cruiser / Lighthouse CI / prototype-pollution) — container/filesystem/IaC security scanning + Git history secret detection + multi-language AST-level SAST + commit format validation + Shell script analysis + SQL lint + API interaction testing + deterministic security rules (1,243 rules, 9 languages) + AI browser functional testing + hypothesis-driven security reasoning + build leak blocking + dead link detection + log sanitization + CORS config + environment variable leaks + supply chain security + dead code detection + AI skill security + code smell + dependency architecture + performance gates + prototype pollution
- ✅ **Memory system**: 6 memory backends working in concert
- ✅ **Competitive analysis**: OpenDigger data-driven decisions
- ✅ **Zero-conflict architecture**: strict tool isolation and deduplication
- ✅ **AI/Model switching**: switch AI providers via config files — supports Claude, Gemini, Qwen, and more
- ✅ **Karpathy Principles**: enforced Think Before Coding, Simplicity First, and more
- ✅ **jvn Spec-Driven Development**: `/spec` → `/design` → `/build` spec-driven pipelines, powered by [GitHub Spec-Kit](https://github.com/github/spec-kit) (11 speckit skills) with 5 Agent-enhanced review (PM + Architect + UX + Code Review + Constitutional Validator)

---

## 🏗️ Architecture Overview (Three-Layer)

| Layer | Role | Core Components |
|-------|------|-----------------|
| **Interaction Layer** | User entry, scene selection, confirm/interrupt, result display | [claude-scene CLI](./claude-scene/) |
| **Capability Layer** | Business capability implementation (action handlers) | [executeAction](./claude-scene/src/commands/start.js) |
| **Runtime Layer** | Execution environment, model invocation, tool integration | Scene engine |

👉 [Full Architecture Docs](./ARCHITECTURE.md)

---

## 🛠️ Quick Tools (One-Click)

| Tool | File | Function | Platform |
|------|------|----------|----------|
| **Claude Code Launcher** | [start-claude.bat](./start-claude.bat) / [start-claude.sh](./start-claude.sh) | One-click Claude Code launch | Windows / macOS / Linux |
| **Safe Upgrade** | [upgrade.bat](./upgrade.bat) / [upgrade.sh](./upgrade.sh) | Backup → Check → Upgrade → Verify | Windows / macOS / Linux |

---

## 🚀 Quick Start

### Prerequisites

| Dependency | Notes |
|------------|-------|
| **Node.js** ≥ 18 | Required for CLI tools |
| **Git** | Version control |
| **bash** (built-in on macOS/Linux, Git Bash on Windows) | Shell execution |

### Option 1: Claude Code Integration (Recommended)

**Windows:** Double-click `start-claude.bat`
**macOS/Linux:** Run `./start-claude.sh` in terminal

Then type `/` to see all available commands, use `/ui-polish`, `/bugfix`, etc.

### Option 2: CLI Tool (no specific AI tool required)
```bash
cd claude-scene
node src/index.js list                      # List all scenes
node src/index.js start ui-polish --auto    # Execute workflow
```

---

## 📋 29 Workflow Scenes

> 9 features merged as enhancements: backup/docker→cicd, sbom→deps, loadtest→e2e, log/incident→monitor, changelog→release, migration→review, llm-proxy-audit→hunt. Triggered on-demand in parent workflows.

| Scene | Steps | Description | Command |
|-------|-------|-------------|---------|
| **ui-polish** | 69 | Frontend polish (full conversation mode, Open Design 152 brands → shape design brief → DaisyUI/Animal Island → icons → animations → micro-interactions → Impeccable full-suite polish (dual-round QC + 3 precision fixes) + Huashu + AI-Friendly) | `/ui-polish` |
| **feature** | 26 | New feature development (CE plan + TDD + multi-Agent review) | `/feature` |
| **bugfix** | 30 | Bug fix (repro → root cause → fix → PR → regression test) | `/bugfix` |
| **review** | 33 | Comprehensive code review (ESLint + TypeScript + Security + AI semantic) + migration/QA/i18n/a11y enhancements | `/review` |
| **refactor** | 23 | Code refactoring (metrics + anti-patterns + incremental refactor + test verification) | `/refactor` |
| **optimize** | 17 | Performance optimization (bottleneck → baseline → anti-patterns → measure → fix) | `/optimize` |
| **simplify** | 15 | Code simplification (readability-first, incremental simplify + test safety) | `/simplify` |
| **hunt** | 24 | Security vulnerability scan & fix (12 external tools + CE) + LLM proxy audit enhancement | `/hunt` |
| **design** | 53 | AI-driven design (full conversation mode, Open Design 152 brands + shape design brief → 3-direction proposal → Huashu prototype → expert review → Impeccable full-suite polish (dual-round QC + 3 precision fixes) + Huashu verification) | `/design` |
| **analyze** | 18 | Deep code analysis (complexity / security / performance / CI + auto-fix) | `/analyze` |
| **loop** | 13 | Auto iteration loop (unattended: review → fix → verify) | `/loop` |
| **new-project** | 66 | Project from scratch (full conversation mode, Pre-flight design baseline → shape design brief → context gathering → CE plan → Open Design 152 brands + Impeccable full-suite polish (dual-round QC + 3 precision fixes) + AI-Friendly a11y + review + retention) | `/new-project` |
| **release** | 24 | Release deployment (quality gates + version bump + build + leak check + tag + health check + monitoring) + CHANGELOG enhancement | `/release` |
| **audit** | 47 | Full project health check (security + code + deps + performance + coverage + complexity + dead code + secret scan + 27 quality gates + infographic) | `/audit` |
| **deps** | 17 | Safe dependency updates (scan outdated → update one-by-one → breaking changes check → test) + SBOM enhancement | `/deps` |
| **rollback** | 16 | Emergency rollback (version selection → rollback → build → health check → monitor restoration) | `/rollback` |
| **onboard** | 16 | Dev environment setup (detect language → install deps → configure .env → start dev server) | `/onboard` |
| **cicd** | 12 | CI/CD config (Act + Taskfile local pipeline + GitHub Actions validation) + Docker/backup enhancements | `/cicd` |
| **e2e** | 9 | E2E test config (MSW + Supertest + Schemathesis API fuzz) + loadtest enhancement | `/e2e` |
| **monitor** | 9 | Website monitoring (Upptime + GitHub Actions + status page) + log/incident enhancements | `/monitor` |
| **qa** | 12 | Browser QA verification (git diff → browser test → bug report), also /review enhancement | `/qa` |
| **plan-ceo-review** | 11 | Founder-mode product review (10x analysis + simplify + user value), also /feature enhancement | `/plan-ceo-review` |
| **check** | 10 | Engine self-check + self-heal: dead action detection / orphan gate flags / missing action messages, auto-fix data files | `/check` |
| **mobile-audit** | 24 | App security audit (MobSF + mobsfscan + Bearer PII/GDPR + DependencyCheck CVE + OWASP MASVS + 5-layer gates) | `/mobile-audit` |
| **mobile-review** | 17 | Mobile code review (ESLint → mobsfscan SAST → UI screenshots → mobile-ui-review → AI semantic + a11y → aggregate report) | `/mobile-review` |
| **mobile-release** | 18 | App release (quality gate → cert check → version bump → CHANGELOG → TestFlight/Play Store + 4-layer gates) | `/mobile-release` |
| **mobile-optimize** | 19 | App performance optimization (Bundle analysis + startup + network + anti-patterns + auto-fix + 4-layer gates) | `/mobile-optimize` |
| **mobile-e2e** | 13 | Mobile E2E testing (Detox/Patrol auto-detect + config generation + CI integration + 3-layer gates) | `/mobile-e2e` |
| **mobile-onboard** | 16 | App dev environment setup (platform-aware prerequisites + RN Doctor + .env + emulator config) | `/mobile-onboard` |

---

## 🔧 Action Handler Completeness

The system registers **354 action handlers** (see `claude-scene/src/actions.js` `ACTION_REGISTRY`), covering all steps across 29 workflows.

| Action | Purpose | Status |
|--------|---------|--------|
| `recall` / `remember` / `consolidate` | Multi-backend memory operations | ✅ |
| `runReview` | Code review (security/full/pr modes) | ✅ |
| `runSuite` / `runAffected` / `test-coverage` | Test suite execution | ✅ |
| `select` / `confirm` | Interactive selection & confirmation | ✅ |
| `generateDesign` / `analyze` | Design & competitive analysis | ✅ |
| `analyzeUI` / `checkConsistency` / `applyDaisyUI` / `applyComponents` / `addAnimations` / `visualRegression` | Frontend polish toolchain | ✅ |
| `check-api-consistency` | OpenAPI standard pipeline (Redocly lint + cross-validation + openapi-typescript) | ✅ |
| `sec-bug-hunt` / `gitLeaks` / `npm-audit` / `security-headers` / `build-leak-check` / `dead-link-check` / `lighthouse-gate` / `open-redirect-scan` / `state-audit` / `i18n-audit` | Security + Performance + Architecture + i18n | ✅ |
| `verify-handlers` | Handler verification: 10-pass stub detection | ✅ |
| `check-smoke` / `check-action-messages` / `check-gate-flags` | Engine self-check: smoke test / action message integrity / gate flag integrity | ✅ |
| `fix-action-messages` / `fix-gate-flags` | Engine self-heal: auto-fill missing action messages and gate flag mappings | ✅ |
| `migration-review` / `load-test` | Migration review / Load testing | ✅ |
| `setup-monitor` / `setup-ci` / `setup-backup` / `setup-docker` / `setup-e2e` / `setup-logging` | One-click infrastructure config | ✅ |
| `incident-runbook` / `generate-changelog` / `generate-sbom` | Incident/Changelog/SBOM automation | ✅ |
| `huashu-*` (7) | Huashu brand design system integration | ✅ |
| `awm-brand-*` (2) | Open Design brand import (list + import) | ✅ |
| `mp-*` (10) | Matt Pocock TypeScript skill bridge | ✅ |
| `ce-*` | Compound Engineering Plugin integration | ✅ |
| `notify` / `send` | Notifications & alerts | ✅ |

---

## 🎨 Frontend Polish Toolchain

### Animal Island UI Style Conversion

```bash
# CLI command
node src/index.js start ui-polish --auto --theme animal-island --target "E:\your\project"

# Execution steps (69-step full conversation mode workflow)
# Phase 0: Pre-flight Design Intelligence
0. web-design-engineer → Declare design system baseline (Palette/Typography/Spacing/Motion/Radius/Shadows)
0.05. review-checklist → Load 23-item review checklist
# Phase 1: In-Conversation Mechanical Steps (Claude operates files directly, no CLI subprocess)
1. recall         → Inject historical context and memories
2. listMemories   → Recall previous UI optimization records
3. analyzeUI      → Analyze project structure, count CSS/components
3.5. impeccable-audit → Technical quality baseline scan (a11y/perf/responsive)
4. installDeps    → Install daisyui, animate.css, lucide-react, playwright
5. checkConsistency → Check UI consistency, output score
5.8-6.44. Open Design resources → Brand selection + template preview + skill loading + frames + decks + prompts
6. confirm        → User selects theme (DaisyUI/Animal Island/Custom/Huashu/Open Design 152 brands)
6.5. awm-brand-import → Open Design: read `open-design/design-systems/<brand>/` DESIGN.md + tokens.css → inject CSS variables (conditional)
6.7. reconcileDesignTokens → Protect existing tokens, fill gaps from new theme
7. applyDaisyUI   → Merge theme (on_error: abort)
7.2. huashu-expert-review → 5-dimension review (round 1 baseline)
7.25. impeccable-critique (round 1) → 27 anti-pattern +| **mobile-e2e** | 13 LLM critique rules, detect AI slop (on_error: abort)
8. applyComponents → Scan JSX/TSX, replace with themed components
8.5. iconUpgrade  → Material Symbols → lucide-react (all themes)
9. addAnimations  → Integrate Animate.css entrance animations
9.2. microInteractions → hover:-translate-y hover:shadow-lg active:scale-[0.98]
# Phase 2: Post-flight Skill Deep Polish (conversation mode, ⚠️ mandatory)
9.3. impeccable-polish → Full-dimension quality tuning (on_error: abort)
9.5. web-design-verify → Design delivery check
9.55. impeccable-layout → Spacing rhythm + visual hierarchy (on_error: abort)
9.56. impeccable-colorize → Strategic color injection (on_error: abort)
9.57. impeccable-bolder → Safe→Bold, break AI default aesthetics (on_error: abort)
9.58. impeccable-typeset → Typography hierarchy optimization (on_error: abort)
9.59. impeccable-animate → Purposeful motion + reduced-motion (on_error: abort)
9.591. impeccable-delight → Personality touchpoints (on_error: abort)
9.592. impeccable-harden → Loading/empty/error/edge states (on_error: abort)
9.593. impeccable-distill → Remove redundancy (on_error: abort)
9.594. impeccable-clarify → UX copy optimization (on_error: abort)
9.595. impeccable-adapt → Responsive design verification (on_error: abort)
9.596. impeccable-optimize → CSS/render performance (on_error: abort)
9.6. impeccable-critique (CLI) →| **mobile-e2e** | 13-rule auto scan (CLI supplement)
9.61. impeccable-critique (round 2) → Verify polish effectiveness (on_error: abort)
9.62. impeccable-polish (round 3) → Precision fix residual AI slop
9.63. impeccable-bolder (round 3) → Amplify conservative decisions
9.64. impeccable-delight (round 3) → Inject missing personality details
9.7. huashu-expert-review (round 2) → Post-fix verification
9.8. ai-friendly-review → Accessibility review (semantic HTML/ARIA/contrast)
9.9. aislop-scan → AI code smell scan
10. runSuite      → Run frontend tests
11. visualRegression → Playwright visual regression (Desktop/Tablet/Mobile)
12. checkAPIConsistency → OpenAPI standard pipeline
13. ce-compound    → Knowledge retention
14. remember      → Save UI polish config to memory
15. consolidate   → Cross-backend memory consistency
16. notify        → Completion notification
```

---

## 🔒 Security Vulnerability Review

### hunt Scene Workflow

```bash
node src/index.js start hunt --auto --target "E:\your\project"
```

**Execution steps:**
1. MCP info gathering (Sentry errors + Tavily CVE search + Context7 docs + GitHub issues + CodeGraph analysis)
2. `recall` → Inject security policies and known vulnerability context
3. `runReview(security, eslint-plugin-security)` → ESLint security scan (SQL Injection/XSS/CSRF)
4. `runReview(security, npm-audit)` → npm dependency vulnerability scan
5. `security-headers` → Security header configuration scan (CSP / HSTS / X-Frame-Options)
6. `open-redirect-scan` → Open redirect detection
7. `seraphim-audit` → Deep security header scan
8. `recheck-cli` → ReDoS catastrophic backtracking scan
9. `log-sanitization` → Log sanitization scan (Token/password/PII leaks)
10. `cors-check` → CORS configuration check
11. `env-var-leak` → Frontend env variable leak detection
12. `sensitive-file-check` → Sensitive file exposure check (.env/*.pem/*.key)
13. `runSuite` → Verify no functional regression after fixes (conditional)
14. `ce-compound` → Knowledge retention
15. `remember` → Save security review results to memory
16. `send` → Instant push for critical vulnerabilities (conditional)
17. `notify` → Review completion notification

---

## 🛡️ External Toolchain

These tools are integrated into corresponding workflows, executing automatically with zero conflicts:

| Tool | Type | Workflows | Function | Severity |
|------|------|-----------|----------|----------|
| **noleak** | npm CLI | `/release`, `/audit` | Build artifact leak detection (Source Map / .env / secrets / .git) | BLOCK-RELEASE |
| **seraphim-audit** | Python CLI | `/hunt`, `/audit` | Security header scan (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy) | — |
| **lychee** | Rust binary | `/audit` | Dead link detection in Markdown/HTML files | — |
| **Lighthouse CI** | npm CLI | `/release`, `/audit` | Performance gates: LCP/CLS/TBT assertions + cache strategy + PWA offline check | BLOCK-RELEASE |
| **pa11y-ci** | npm CLI | `/review` (a11y layer) | WCAG 2.1 AA accessibility scan | — |
| **recheck-cli** | npm CLI | `/hunt`, `/audit` | ReDoS catastrophic backtracking scan | — |
| **log-sanitizer** | built-in grep | `/hunt`, `/audit`, `/review` | Log sanitization: Token/password/PII/email leak detection | — |
| **cors-checker** | built-in grep | `/hunt`, `/audit`, `/review` | CORS config: wildcard + credentials leak detection | — |
| **env-leak-scanner** | built-in grep | `/hunt`, `/audit`, `/review` | Frontend env variable leak: Vite import.meta.env / process.env | — |
| **sensitive-file-check** | built-in git | `/hunt`, `/audit`, `/review` | Sensitive file exposure: .env/*.pem/*.key/credentials.json | — |
| **deprecated-deps** | npm CLI | `/audit` | Deprecated/unmaintained dependency detection | — |
| **knip** | npx CLI | `/audit`, `/review` | AST-level dead code/dependency detection (11k+ stars) | — |
| **skillspector** | Python CLI | `/hunt`, `/audit` | AI skill security scan: 64 vulnerability patterns (NVIDIA, 2.5k+ stars) | — |
| **aislop** | npx CLI | `/review`, `/audit` | AI code smell scan: 50+ rules | — |
| **dependency-cruiser** | npx CLI | `/audit` | Dependency architecture validation: circular deps, orphans, layer compliance (6.7k+ stars) | — |
| **prototype-pollution** | ESLint rule | `/audit`, `/hunt`, `/review` | no-prototype-builtins prototype pollution detection | — |
| **trivy** | Go binary | `/hunt`, `/audit` | Container image/filesystem/IaC full security scan: CVE + secrets + misconfig (Aqua Security, 25k+ stars) | — |
| **shellcheck** | Haskell binary | `/audit`, `/cicd` | Shell script static analysis: syntax errors/bad practices/security risks (37k+ stars) | — |
| **sqlfluff** | Python CLI | `/review`, `/audit` | SQL linter + formatter: 200+ rules, 8 SQL dialects (8k+ stars, MIT) | — |
| **bruno** | npm CLI | `/e2e`, `/review` | API interaction testing: REST/GraphQL/WebSocket collection runner, Git-friendly plain text (31k+ stars, MIT) | — |
| **gitleaks** | Go binary | `/hunt`, `/audit` | Git history secret leak detection: 120+ built-in rules, detect/describe/git subcommands (18k+ stars, MIT) | — |
| **semgrep** | Python CLI | `/hunt`, `/audit`, `/review` | Multi-language AST-level SAST: 2,500+ community rules, custom rule support (11k+ stars, LGPL) | — |
| **commitlint** | npm CLI | `/review`, `/cicd` | Conventional Commits format validation: `@commitlint/config-conventional` + extensible rules (18k+ stars, MIT) | — |

---

## 💬 Usage

### Via Claude Code (Recommended)

**Method 1: Using `/` commands**
```
/ui-polish animal-island E:\my-app
/bugfix Login page form validation error
/feature Add user management module
/review
/hunt
```

**Method 2: Using CLI tool**
```bash
cd claude-scene

# List all scenes
node src/index.js list

# Run workflow
node src/index.js start ui-polish --auto --theme animal-island --target "E:\project"
node src/index.js start bugfix --auto --prompt "Login page error"
node src/index.js start review --auto
node src/index.js start hunt --auto
```

### Command Parameters

| Parameter | Description |
|-----------|-------------|
| `--auto` | Auto mode, skip interactive confirmation |
| `--dry-run` | Dry run, preview only |
| `--target <path>` | Target project path |
| `--theme <name>` | Theme (daisyui/animal-island/custom/huashu/open-design) |
| `--option <name>` | Option (for optimize/simplify scenes) |
| `--prompt <text>` | Prompt text |

---

## 📁 Project Structure

```
mix-coding/
├── .claude/
│   ├── scenes/               # Scene definitions (29 JSON files)
│   │   ├── ui-polish.json    bugfix.json     feature.json
│   │   ├── review.json       refactor.json   optimize.json
│   │   ├── simplify.json     hunt.json       design.json
│   │   ├── analyze.json      loop.json       new-project.json
│   │   ├── release.json      audit.json      deps.json
│   │   ├── rollback.json     onboard.json    cicd.json
│   │   ├── e2e.json          monitor.json
│   │   ├── qa.json           plan-ceo-review.json  check.json
│   │   ├── mobile-audit.json mobile-review.json mobile-release.json
│   │   ├── mobile-optimize.json mobile-e2e.json mobile-onboard.json
│   ├── commands/             # Slash commands (29 workflows + jvn /spec /design /build /report etc.)
│   ├── rules/                # Project rules (conditional/ on-demand: core-rules / workflows / enhancements / 9 files)
│   ├── skills/               # Claude Skills (21: 10 core + 11 speckit)
│   └── agents/               # 8 Agents (PM/Architect/UX/Reviewer/Constitutional-validator + mobile-reviewer/mobile-security/mobile-perf)
│
├── .specify/                 # Spec-Kit config (templates / scripts / memory)
├── claude-scene/             # CLI tool (Scene engine)
│   └── src/
│       ├── commands/         # CLI commands (list / show / start / fork)
│       ├── handlers/         # Capability handlers
│       └── lib/              # Utility library (including huashu design integration)
│
├── scripts/                  # Project scripts (Node.js .cjs)
│   ├── scan-scenes.cjs       # Scan all scene step counts
│   ├── find-deadcode.cjs     # Dead code scanner
│   ├── check-memory-system.cjs # Memory system health check
│   └── setup-mempalace.cjs   # MemPalace MCP setup
├── constitution.md           # Project constitution (enforced by constitutional-validator Agent)
├── CLAUDE.md                 # Main project instructions
├── ARCHITECTURE.md           # Full architecture documentation
├── LICENSE                   # Elastic License 2.0 (commercial use requires author consent)
├── README.md                 # Chinese README
├── README_EN.md              # This file — English README
├── upgrade.bat / start-claude.bat   # One-click tools
└── .gitignore
```

---

## 📱 Mobile Tool Support

6 mobile workflows auto-detect available tools; missing tools are auto-skipped with install instructions.

| Workflow | Supported Tools |
|----------|----------------|
| **mobile-audit** | MobSF, mobsfscan, Bearer CLI, DependencyCheck |
| **mobile-review** | ESLint + TypeScript, mobsfscan, Detox |
| **mobile-release** | GitHub, App Store Connect, Google Play Console |
| **mobile-optimize** | Bundle Visualizer, Lighthouse, Toxiproxy |
| **mobile-e2e** | Detox, Patrol |
| **mobile-onboard** | RN Doctor, Fastlane, Android SDK |

> See [docs/mobile-tools-installation.md](./docs/mobile-tools-installation.md) for tool installation guides.

---

## ❓ FAQ

### 1. No effect after running a workflow?

Make sure to use `--target` with the correct frontend project path:
```bash
node src/index.js start ui-polish --auto --theme animal-island --target "E:\your\frontend\project"
```

### 2. Security scan not running?

Make sure the project has a `package.json` and dependencies are installed:
```bash
cd E:\your\project
npm install
```

### 3. CE Plugin not working?

Confirm Compound Engineering Plugin is installed:
```bash
claude plugins install compound-engineering@anthropic
```

---

## 📦 Complete Tool Installation Guide

| Tool Type | Install Command | Notes |
|-----------|----------------|-------|
| **Base Environment** | [Node.js LTS](https://nodejs.org/) + [Git](https://git-scm.com/) | Node.js runtime |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | AI assistant core CLI |
| **CodeGraph** | `npm install -g @codegraph/cli` | Code structure memory analysis |
| **Claude Skills** | `npx skills install <skill-name>` | Skill plugin ecosystem (12+ plugins) |
| **Impeccable Skill** | `echo Y | npx --yes impeccable@2.3.2 skills install` | AI design vocabulary + 27 anti-pattern rules +| **mobile-e2e** | 13 LLM critique rules |
| **Web Design Skill** | Copy `SKILL.md` to `.claude/skills/web-design-engineer/` | ConardLi: anti-AI-template design system |
| **AI-Friendly Design** | `npx ai-friendly-web-design-skill --local` | ianho7: semantic HTML/ARIA accessibility |
| **Awesome Design MD** | `git clone https://github.com/VoltAgent/awesome-design-md .claude/skills/awesome-design-md` | 5 curated brand DESIGN.md files (Vercel/Linear/Stripe/Notion/Apple), upgraded to Open Design 152 brands direct file reads |
| **MCP Servers** | `claude mcp install github playwright supabase` | AI context enhancement extensions |
| **Spec-Kit** | `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` | GitHub spec-driven development engine (11 speckit skills) |
| **Memory Tools** | `git clone https://github.com/claude-mem %USERPROFILE%\.claude\skills\claude-mem` + `npx nexo-brain@latest init` | 6 memory backends (project-memory / Claude-Mem / agentmemory / NEXO / CodeGraph / MemPalace) |
| **Security Toolchain** | `npm install -D noleak pa11y-ci recheck-cli @lhci/cli knip` + `pip install seraphim-audit` + Socket.dev API Key | Build leak detection / security headers / dead links / a11y / ReDoS / performance gates / dead code / supply chain |
| **New External Tools** | `pip install sqlfluff` + `npm install -g @usebruno/cli` | trivy (container/filesystem/IaC scan) / shellcheck (shell script analysis) / sqlfluff (SQL lint) / bruno (API testing) — download from GitHub releases or winget/brew |
| **App Store** | [Claude App Store](https://github.com/topics/claude-app-store) | More Claude extensions |

---

## 📊 Integration Overview

> **76+ external components**: 21 Skills + 14 MCP servers + 23 npm packages + 25 external tools

### Local Skills (21, `.claude/skills/`)

| Skill | Source | Purpose |
|-------|--------|---------|
| `speckit-specify` & 10 others | GitHub Spec-Kit | Full spec → plan → tasks → implement SDD pipeline |
| `web-design-engineer` | ConardLi | OKLCH color + 6-step workflow + anti-AI-template |
| `impeccable` | — | 27 anti-pattern rules + 12 LLM critique rules |
| `ai-friendly-web-design` | ianho7 | Semantic HTML / ARIA accessibility |
| `awesome-design-md` | VoltAgent | 5 brand DESIGN.md (Vercel/Linear/Stripe/Notion/Apple), upgraded to Open Design 152 brands direct file reads |
| `mattpocock` | Matt Pocock | 26 sub-skills (TS/engineering/productivity) |
| `review-checklist` | — | 23 review checklist items |
| `sec-bug-hunt` | — | 5-vector security scan rules |
| `mobile-ui-review` | — | Mobile UI review |
| `constitution-reference` | — | Project constitution reference |
| `stack-knowledge` | — | Tech stack knowledge base |

**Recommended extras** (`npx skills install`): `anthropics/skills`, `obra/superpowers`, `frontend-design`, `security-guidance`, `claude-seo`, `plannotator`, `deep-trilogy`

### MCP Servers (16, `.mcp.json`)

| Server | Purpose | Server | Purpose |
|--------|---------|--------|---------|
| `codegraph` | Code symbol index | `github` | PR/Issue operations |
| `context7` | Documentation query | `tavily-search` | Web search |
| `playwright` | Browser automation | `filesystem` | Filesystem ops |
| `sequential-thinking` | Chain reasoning | `memory` | Session memory |
| `mempalace` | Verbatim conversation archive | `stripe` | Payments |
| `supabase` | Database operations | `resend` | Email service |
| `sentry` | Error monitoring | `bearer` | PII/GDPR compliance |
| `detox` | RN E2E testing | `mobsfscan` | Mobile SAST |

### npm Packages (23, `claude-scene/package.json`)

**devDependencies (19)**: `@lhci/cli`, `knip`, `noleak`, `pa11y-ci`, `recheck-cli`, `artillery`, `@cyclonedx/cyclonedx-npm`, `@redocly/cli`, `@vitest/coverage-v8`, `eslint` + 3 plugins, `license-checker`, `openapi-typescript`, `playwright`, `runme`, `vitest`

**dependencies (4)**: `chalk`, `commander`, `inquirer`, `ora`

### External Tools (25, by type)

| Type | Count | Tools | Install |
|------|-------|-------|---------|
| **uv/Python** | 5 | `specify-cli` (spec-kit), `seraphim-audit`, `skillspector`, `sqlfluff`, `semgrep` | uv tool install / pip install |
| **Rust binary** | 1 | `lychee` | brew / cargo / .exe |
| **Go binary** | 4 | `act`, `restic`, `trivy`, `gitleaks` | winget / brew / download |
| **Haskell binary** | 1 | `shellcheck` | winget / brew / download |
| **npm global** | 1 | `bruno` (`@usebruno/cli`) | npm install -g |
| **npx zero-install** | 9 | `aislop`, `dependency-cruiser`, `jscpd`, `size-limit`, `Stryker`, `Spectral`, `markdownlint`, `commitlint`, `knip` | None needed |
| **Built-in grep** | 4 | `log-sanitizer`, `cors-checker`, `env-leak-scanner`, `sensitive-file-check` | Built-in |

### Integrated GitHub Projects (25)

`gitleaks/gitleaks` · `semgrep/semgrep` · `conventional-changelog/commitlint` · `aquasecurity/trivy` · `koalaman/shellcheck` · `sqlfluff/sqlfluff` · `usebruno/bruno` · `seraphimhub/seraphim-audit` · `NVIDIA/skillspector` · `lycheeverse/lychee` · `nektos/act` · `restic/restic` · `nexu-io/open-design` · `VoltAgent/awesome-design-md` · `mattpocock/skills` · `scanaislop/aislop` · `sverweij/dependency-cruiser` · `anthropics/skills` · `modelcontextprotocol/*` · `X-lab2017/open-digger` · `referodesign/refero_skill` · `DietrichGebert/ponytail` · `multica-ai/andrej-karpathy-skills` · `thedotmack/claude-mem` · `github/spec-kit`

---

## 🔄 Update Guide

### One-click Full Update

```bash
# Windows
update-all.bat

# macOS / Linux
./update-all.sh
```

Covers **5 dimensions**:

| Dimension | Action | Auto |
|-----------|--------|------|
| **npm packages** (19) | `npm update` compatible versions | Full auto |
| **Python tools** (2) | `pip install --upgrade` reinstall | Full auto |
| **Git repos** (6) | `git pull --ff-only` fast-forward | Full auto (skips if local changes) |
| **Binary tools** (3) | Version check + manual upgrade hint | Semi-auto |
| **npx zero-install** (8) | Latest pulled on each run | No action needed |

### Manual Per-dimension Update

```bash
# npm only
cd claude-scene && npm update

# Python only
pip install --upgrade seraphim-audit git+https://github.com/NVIDIA/skillspector.git

# Binary only
winget upgrade nektos.act restic.restic     # Windows
brew upgrade lychee                          # macOS
```

> **Recommended frequency**: Run `update-all` monthly. npm deps can be updated on-demand during feature work.

---

## 📚 Related Resources

| Resource | Link |
|----------|------|
| 🔧 Complete Install Guide | [INSTALL.md](./INSTALL.md) |
| Full Architecture Docs | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 📋 Complete Tool Inventory | [docs/tools-inventory.md](./docs/tools-inventory.md) |
| Open Design | [github.com/nexu-io/open-design](https://github.com/nexu-io/open-design) |
| Claude Code SDK | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code-sdk/claude-code-headless) |
| CodeGraph Docs | Installed: `codegraph init -i` → `codegraph --help` |
| Frontend Polish Tools | DaisyUI + Animal Island UI + Animate.css |

---

## 📄 License

[Elastic License 2.0](./LICENSE) — freely usable for non-commercial purposes.
**Commercial use requires author consent.** Contact the author for commercial licensing terms.

Copyright (c) 2026 cstuffrogers. All rights reserved.
