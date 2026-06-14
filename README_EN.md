# 🚀 Mix-Coding System — Quick Start Guide

Get started with the fully automated code development system in 5 minutes.
Designed for non-technical users — integrates the hottest GitHub projects with zero conflicts.

---

## 📦 System Overview

A **three-layer architecture + Scene/Archon dual-engine** intelligent development system:

- ✅ **35 automated workflows**: 29 Web + 6 Mobile — code review, security scanning, performance optimization, E2E testing, release deployment, environment setup, and more
- ✅ **Multi-round auto review & fix**: iterate until issues are cleared
- ✅ **AI-driven design**: Open Design (129 brand design systems) + web-design-engineer Skill, zero design skills required
- ✅ **Frontend polish toolchain**: DaisyUI (35+ themes) + Animal Island UI + Animate.css + Lucide React + Playwright + Impeccable critique (27 anti-AI-pattern rules)
- ✅ **5-layer code review**: ESLint + TypeScript + Security Scan + npm audit + AI Semantic + Handler verification (10-pass stub detection)
- ✅ **Database migration review**: scans migration files, detects 8 dangerous patterns (DROP TABLE / NOT NULL without DEFAULT, etc.), blocks high-risk changes
- ✅ **Load testing**: Artillery integration — smoke/load/stress, 3-tier performance gates
- ✅ **Security vulnerability scanning**: ESLint security rules + OWASP Top-10 + npm audit + security headers + build leak detection + dead link detection + open redirect detection + state management audit + ReDoS scanning + log sanitization + CORS check + sensitive file check + supply chain security
- ✅ **External toolchain**: 16 tools (noleak / seraphim-audit / lychee / pa11y-ci / recheck-cli / Lighthouse CI / log-sanitizer / cors-checker / env-leak-scanner / sensitive-file-check / deprecated-deps / knip / skillspector / aislop / dependency-cruiser / prototype-pollution)
- ✅ **Memory system**: 7 memory backends working in concert
- ✅ **Competitive analysis**: OpenDigger data-driven decisions
- ✅ **Zero-conflict architecture**: strict tool isolation and deduplication
- ✅ **AI/Model switching**: switch AI providers via config files — supports Claude, Gemini, Qwen, and more
- ✅ **Dual-engine**: Scene engine (default, in-session execution, context continuity) + Archon engine (experimental, standalone server, parallel multi-tasking)
- ✅ **Karpathy Principles**: enforced Think Before Coding, Simplicity First, and more
- ✅ **Compound Engineering Plugin**: AI planning, deep review, system debugging, knowledge retention — integrated across all 35 workflows

---

## 🏗️ Architecture Overview (Three-Layer)

| Layer | Role | Core Components |
|-------|------|-----------------|
| **Interaction Layer** | User entry, scene selection, confirm/interrupt, result display | [claude-scene CLI](./claude-scene/) |
| **Capability Layer** | Business capability implementation (action handlers) | [executeAction](./claude-scene/src/commands/start.js) |
| **Runtime Layer** | Execution environment, model invocation, tool integration | Scene engine (default) + Archon engine (experimental) |

👉 [Full Architecture Docs](./ARCHITECTURE.md)

---

## 🛠️ Quick Tools (One-Click)

| Tool | File | Function | Platform |
|------|------|----------|----------|
| **Claude Code Launcher** | [start-claude.bat](./start-claude.bat) | One-click Claude Code (DeepSeek V4) | Windows |
| **CodeWhale Launcher** | [start-codewhale.bat](./start-codewhale.bat) | One-click CodeWhale (DeepSeek TUI) | Windows |
| **Safe Upgrade** | [upgrade.bat](./upgrade.bat) | Backup → Check → Upgrade → Verify | Windows |

---

## 🚀 Quick Start

### Option 1: Claude Code Integration (Recommended)
1. Double-click `start-claude.bat` to launch
2. Type `/` to see all available commands
3. Use `/polish`, `/bugfix` and other commands

### Option 2: CodeWhale (DeepSeek TUI)
1. Double-click `start-codewhale.bat` to launch
2. Configure API Key on first run
3. Press `Tab` to switch modes (Plan/Agent/YOLO)

### Option 3: CLI Tool (no specific AI tool required)
```bash
cd claude-scene
node src/index.js list                      # List all scenes
node src/index.js start ui-polish --auto    # Execute workflow
```

---

## 📋 35 Workflow Scenes

| Scene | Steps | Description | Command |
|-------|-------|-------------|---------|
| **ui-polish** | 25 | Frontend polish (DaisyUI + Animal Island UI + Animate.css + Lucide + Playwright + Impeccable + Huashu review + AI-Friendly review + Awesome Design MD + token reconciliation) | `/polish` |
| **feature** | 27 | New feature development (CE plan + TDD + multi-Agent review) | `/feature` |
| **bugfix** | 28 | Bug fix (repro → root cause → fix → PR → regression test) | `/bugfix` |
| **review** | 15 | Comprehensive code review (ESLint + TypeScript + Security + AI semantic + state audit + open redirect + handler verification + i18n) | `/review` |
| **refactor** | 21 | Code refactoring (metrics + anti-patterns + incremental refactor + test verification) | `/refactor` |
| **optimize** | 14 | Performance optimization (bottleneck → baseline → anti-patterns → measure → fix) | `/optimize` |
| **simplify** | 13 | Code simplification (readability-first, incremental simplify + test safety) | `/simplify` |
| **hunt** | 24 | Security vulnerability scan & fix (ESLint + npm audit + OWASP + 12 external tools + CE retention) | `/hunt` |
| **design** | 22 | AI-driven design (conversation mode: web-design-engineer Skill + Awesome Design MD + Impeccable + Huashu review + prototypes) | `/design` |
| **analyze** | 15 | Deep code analysis (complexity / security / performance / CI + auto-fix) | `/analyze` |
| **loop** | 10 | Auto iteration loop (unattended: review → fix → verify) | `/loop` |
| **new-project** | 21 | Project from scratch (conversation mode: web-design-engineer Skill design baseline + CLI scaffolding + CE plan) | `/new-project` |
| **release** | 23 | Release deployment (quality gates + version bump + build + leak check + tag + health check + monitoring) | `/release` |
| **audit** | 40 | Full project health check (security + code + deps + performance + coverage + complexity + dead code + secret scan + 27 quality gates + infographic) | `/audit` |
| **prototype** | 11 | Rapid prototype validation (requirements interview + MVP generation + local run + decision report) | `/prototype` |
| **deps** | 14 | Safe dependency updates (scan outdated → update one-by-one → breaking changes check → test) | `/deps` |
| **rollback** | 14 | Emergency rollback (version selection → rollback → build → health check → monitor restoration) | `/rollback` |
| **onboard** | 14 | Dev environment setup (detect language → install deps → configure .env → start dev server) | `/onboard` |
| **migration** | 8 | Database migration review: detect 8 dangerous patterns, block high-risk changes | `/migration` |
| **loadtest** | 8 | Load testing (Artillery, smoke/load/stress, performance gates) | `/loadtest` |
| **backup** | 8 | Encrypted deduplicated backup (Restic config + S3/SSH remote + cron integration) | `/backup` |
| **changelog** | 9 | Changelog generation (Git history + Conventional Commits) | `/changelog` |
| **cicd** | 8 | CI/CD config (Act + Taskfile local pipeline + GitHub Actions validation) | `/cicd` |
| **docker** | 8 | Docker containerization (multi-stage Dockerfile + .dockerignore + docker-compose.yml) | `/docker` |
| **e2e** | 8 | E2E test config (MSW + Supertest + Schemathesis API fuzz) | `/e2e` |
| **incident** | 8 | Incident runbook (Runme + health checks + FAQs + escalation paths) | `/incident` |
| **log** | 8 | Logging config (winston/pino/log4js + ELK/Fluentd collection) | `/log` |
| **monitor** | 8 | Website monitoring (Upptime + GitHub Actions + status page + availability alerts) | `/monitor` |
| **sbom** | 8 | SBOM generation + license compliance check (GPL/AGPL blocking) | `/sbom` |
| **mobile-audit** | 22 | App security audit (MobSF + mobsfscan + Bearer PII/GDPR + DependencyCheck CVE + OWASP MASVS + 5-layer gates) | `/mobile-audit` |
| **mobile-review** | 14 | Mobile code review (ESLint → mobsfscan SAST → UI screenshots → AI semantic + a11y → aggregate report) | `/mobile-review` |
| **mobile-release** | 18 | App release (Fastlane build/sign → TestFlight/Play Store → Shorebird OTA → Sentry + 4-layer gates) | `/mobile-release` |
| **mobile-optimize** | 17 | App performance optimization (Bundle analysis + startup + network + anti-patterns + auto-fix + 4-layer gates) | `/mobile-optimize` |
| **mobile-e2e** | 11 | Mobile E2E testing (Detox/Maestro/Patrol auto-detect + config generation + CI integration + 3-layer gates) | `/mobile-e2e` |
| **mobile-onboard** | 16 | App dev environment setup (platform-aware prerequisites + RN Doctor + Fastlane + .env + emulator config) | `/mobile-onboard` |

---

## 🔧 Action Handler Completeness

The system registers **280+ action handlers** (see `claude-scene/src/actions.js` `ACTION_REGISTRY`), covering all steps across 35 workflows.

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
| `migration-review` / `load-test` | Migration review / Load testing | ✅ |
| `setup-monitor` / `setup-ci` / `setup-backup` / `setup-docker` / `setup-e2e` / `setup-logging` | One-click infrastructure config | ✅ |
| `incident-runbook` / `generate-changelog` / `generate-sbom` | Incident/Changelog/SBOM automation | ✅ |
| `huashu-*` (7) | Huashu brand design system integration | ✅ |
| `awm-brand-*` (2) | Awesome Design MD brand import (list + import) | ✅ |
| `mp-*` (10) | Matt Pocock TypeScript skill bridge | ✅ |
| `ce-*` | Compound Engineering Plugin integration | ✅ |
| `notify` / `send` | Notifications & alerts | ✅ |

---

## 🎨 Frontend Polish Toolchain

### Animal Island UI Style Conversion

```bash
# CLI command
node src/index.js start ui-polish --auto --theme animal-island --target "E:\your\project"

# Execution steps
1. recall         → Inject historical context and memories
2. listMemories   → Recall previous UI optimization records
3. analyzeUI      → Analyze project structure, count CSS/components
3.5. web-design-declare-system → Declare design system baseline (Palette/Typography/Spacing/Motion/Radius/Shadows)
4. installDeps    → Install daisyui, lucide-react, animate.css
5. checkConsistency → Check UI consistency, output score
6. confirm        → User selects theme (DaisyUI/Animal Island/Custom/Huashu/Awesome Design MD)
6.5. awm-brand-import → Load brand DESIGN.md, inject CSS variables (conditional)
6.7. reconcileDesignTokens → Protect existing tokens, fill gaps from new theme
7. applyDaisyUI   → Merge theme into tailwind.config.js and index.css
8. applyComponents → Scan JSX/TSX, replace with themed components
9. addAnimations  → Integrate Animate.css + Lucide React icons
9.5. web-design-verify → Design delivery check
9.6. impeccable-critique → Remove AI slop (pure black/white, purple gradients, etc.)
9.65. huashu-expert-review → 5-dimension expert review (philosophy/hierarchy/craft/functionality/originality)
9.7. ai-friendly-review → Accessibility review (semantic HTML/ARIA/contrast)
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

---

## 💬 Usage

### Via Claude Code (Recommended)

**Method 1: Using `/` commands**
```
/polish animal-island E:\my-app
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
| `--theme <name>` | Theme (daisyui/animal-island/custom/huashu/awm-brand) |
| `--option <name>` | Option (for optimize/simplify scenes) |
| `--prompt <text>` | Prompt text |

---

## 📁 Project Structure

```
mix-coding/
├── .claude/
│   ├── scenes/               # Scene definitions (35 JSON files)
│   │   ├── ui-polish.json    bugfix.json     feature.json
│   │   ├── review.json       refactor.json   optimize.json
│   │   ├── simplify.json     hunt.json       design.json
│   │   ├── analyze.json      loop.json       new-project.json
│   │   ├── release.json      audit.json      prototype.json
│   │   ├── deps.json         rollback.json   onboard.json
│   │   ├── migration.json    loadtest.json   backup.json
│   │   ├── changelog.json    cicd.json       docker.json
│   │   ├── e2e.json          incident.json   log.json
│   │   ├── monitor.json      sbom.json
│   │   ├── mobile-audit.json mobile-review.json mobile-release.json
│   │   ├── mobile-optimize.json mobile-e2e.json mobile-onboard.json
│   ├── commands/             # Slash commands (35 workflows + jvn /spec /design /build /report etc.)
│   ├── rules/                # Project rules (coding / karpathy-principles / memory-auto-save / mobile-coding / etc.)
│   ├── skills/               # Claude Skills (including mobile-ui-review)
│   └── agents/               # 8 Agents (PM/Architect/UX/Reviewer/Constitutional-validator + mobile-reviewer/mobile-security/mobile-perf)
│
├── claude-scene/             # CLI tool (Scene engine)
│   └── src/
│       ├── commands/         # CLI commands (list / show / start / fork)
│       ├── handlers/         # Capability handlers
│       └── lib/              # Utility library (including huashu design integration)
│
├── .archon/workflows/        # Archon YAML workflows (experimental engine, 12 scenes)
│
├── constitution.md           # Project constitution (enforced by constitutional-validator Agent)
├── CLAUDE.md                 # Main project instructions
├── ARCHITECTURE.md           # Full architecture documentation
├── LICENSE                   # Elastic License 2.0 (commercial use requires author consent)
├── README.md                 # Chinese README
├── README_EN.md              # This file — English README
├── upgrade.bat / start-claude.bat / start-codewhale.bat   # One-click tools
└── .gitignore
```

---

## 📱 Mobile Tool Support

6 mobile workflows auto-detect available tools; missing tools are auto-skipped with install instructions.

| Workflow | Supported Tools |
|----------|----------------|
| **mobile-audit** | MobSF, mobsfscan, Bearer CLI, DependencyCheck |
| **mobile-review** | ESLint + TypeScript, mobsfscan, Maestro/Detox |
| **mobile-release** | Fastlane, Shorebird, Sentry |
| **mobile-optimize** | Bundle Visualizer, Lighthouse, Toxiproxy |
| **mobile-e2e** | Detox, Maestro, Patrol |
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
| **Impeccable Skill** | `echo Y | npx --yes impeccable@2.3.2 skills install` | AI design vocabulary + 27 anti-pattern rules + 12 LLM critique rules |
| **Web Design Skill** | Copy `SKILL.md` to `.claude/skills/web-design-engineer/` | ConardLi: anti-AI-template design system |
| **AI-Friendly Design** | `npx ai-friendly-web-design-skill --local` | ianho7: semantic HTML/ARIA accessibility |
| **Awesome Design MD** | `git clone https://github.com/VoltAgent/awesome-design-md .claude/skills/awesome-design-md` | 5 curated brand DESIGN.md files (Vercel/Linear/Stripe/Notion/Apple) |
| **MCP Servers** | `claude mcp install github playwright supabase` | AI context enhancement extensions |
| **Memory Tools** | `git clone https://github.com/claude-mem %USERPROFILE%\.claude\skills\claude-mem` + `npx nexo-brain@latest init` | 7 memory backends (project-memory / Claude-Mem / agentmemory / NEXO / CodeGraph / MemPalace / Supermemory) |
| **Security Toolchain** | `npm install -D noleak pa11y-ci recheck-cli @lhci/cli knip` + `pip install seraphim-audit` + Socket.dev API Key | Build leak detection / security headers / dead links / a11y / ReDoS / performance gates / dead code / supply chain |
| **App Store** | [Claude App Store](https://github.com/topics/claude-app-store) | More Claude extensions |

---

## 📚 Related Resources

| Resource | Link |
|----------|------|
| 🔧 Complete Install Guide | [INSTALL.md](./INSTALL.md) |
| Full Architecture Docs | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 📋 Complete Tool Inventory | [docs/tools-inventory.md](./docs/tools-inventory.md) |
| CodeWhale Install | https://codewhale.net/zh/install |
| Archon Repository | [github.com/coleam00/Archon](https://github.com/coleam00/Archon) |
| Open Design | [github.com/nexu-io/open-design](https://github.com/nexu-io/open-design) |
| Claude Code SDK | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code-sdk/claude-code-headless) |
| CodeGraph Docs | Installed: `codegraph init -i` → `codegraph --help` |
| Frontend Polish Tools | DaisyUI + Animal Island UI + Animate.css |

---

## 📄 License

[Elastic License 2.0](./LICENSE) — freely usable for non-commercial purposes.
**Commercial use requires author consent.** Contact the author for commercial licensing terms.

Copyright (c) 2026 cstuffrogers. All rights reserved.
