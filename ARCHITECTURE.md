# Architecture Documentation

## Overview

This project implements a **three-layer architecture** following the **12-factor-agents** design principles. This document provides a comprehensive guide to the system's structure, components, and workflows.

## Table of Contents

1. [Three-Layer Architecture](#three-layer-architecture)
2. [Capability Layer Services](#capability-layer-services)
3. [Runtime Layer Tools](#runtime-layer-tools)
4. [Frontend Design & Polish Toolchain](#frontend-design--polish-toolchain)
5. [Design Principles (12-factor-agents)](#design-principles-12-factor-agents)
6. [Zero-Conflict Strategy](#zero-conflict-strategy)
7. [CI/CD Integration](#cicd-integration)
8. [MCP Dynamic Enablement](#mcp-dynamic-enablement)
9. [Quick Start](#quick-start)

---

## Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         🖥️ 交互层（Interaction Layer）                │
│         用户入口 · 场景选择 · 确认打断 · 结果展示                      │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  claude-scene CLI · 场景模板(.claude/scenes/) · 进度展示    │    │
│   │  /new-project  /feature  /bugfix  /refactor  /spec    /review│   │
│   │  /setup  /loop  /rollback  /optimize  /ui-polish  /qa  /deps   │    │
│   └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│   【设计原则】12-factor-agents #7（环境等价）· #10（日志即事件）        │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        ⚙️ 能力层（Capability Layer）                  │
│         具体业务能力的实现（无状态逻辑；副作用通过运行时层注入）          │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐ │
│   │ Memory       │ │ Design       │ │ Review       │ │ OpenDigger│ │
│   │ Service      │ │ Service      │ │ Engine       │ │ Service   │ │
│   │              │ │              │ │              │ │           │ │
│   │ 记忆工具组合  │ │ AI驱动设计   │ │ 审查代码工具  │ │ 数据洞察  │ │
│   │ → 4组件方案  │ │ → Open Design│ │ → 5层审查    │ │ → 竞品分析│ │
│   └──────────────┘ └──────────────┘ └──────────────┘ └───────────┘ │
│   ┌──────────────┐ ┌──────────────┐                                │
│   │ Test         │ │ Notification │                                │
│   │ Engine       │ │ Service      │                                │
│   └──────────────┘ └──────────────┘                                │
│                                                                     │
│   【设计原则】12-factor-agents #1（明确接口）· #2（无共享状态）        │
│             #4（并发弹性）· #6（一次性执行）                            │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       🔧 运行时层（Runtime Layer）                    │
│         执行环境 · 模型调用 · 工具集成 · 子进程管理                    │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  Claude Code 核心 · MCP Servers · Hooks · Child Process    │    │
│   │  CLI Tools (eslint/vitest/playwright/dev-utils/opendigger) │    │
│   │  Frontend Tools (daisyui/animate.css/lucide-react)         │    │
│   └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│   【设计原则】12-factor-agents #3（配置分离）· #5（构建/运行分离）      │
│             #8（并发进程）· #9（易处置）                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| 层级 | 职责 | 关键组件 | 不包含 |
|------|------|---------|--------|
| **交互层** | 用户入口、场景选择、确认打断、结果展示 | claude-scene CLI、场景模板、进度展示 | 实际执行逻辑、外部工具调用 |
| **能力层** | 具体业务能力的实现（无状态业务逻辑；副作用通过运行时层注入） | Memory Service、Review Engine、Test Engine、Design Service、OpenDigger Service、Notification Service | 用户界面、Claude 核心推理 |
| **运行时层** | 执行环境、模型调用、工具集成 | Claude Code 核心、MCP Servers、Hooks、Child Process | 业务逻辑、决策流程 |

---

## Capability Layer Services

### 1. Memory Service

**Purpose**: Unified memory management combining 6 complementary backends

**Components**:
- **project-memory**: JSON-file-based structured memory, type-tagged (security/bugfix/architecture/…)
- **Claude-Mem**: Claude Code native plugin, Markdown-based persistent memory
- **agentmemory**: CLI tool with SQLite backend, structured data
- **NEXO Brain**: Graph-based semantic memory with GPT-4
- **CodeGraph**: Code relationship knowledge graph (SQLite)

**Isolation Strategy**:
- Tool name prefixes: `memory-agentmemory_*`, `memory-nexo_*`, `memory-codegraph_*`
- Separate SQLite databases in ~/.agentmemory/, ~/.nexo/, ~/.codegraph/

**API**:
```typescript
interface MemoryService {
  recall(params: { mode: 'full' | 'recent' | 'by_id'; filters?: object; limit?: number }): Promise<MemoryEntries>;
  remember(params: { type: 'architecture' | 'analysis' | 'issue'; data: any }): Promise<void>;
  consolidate(params: { deduplicate?: boolean }): Promise<void>;
}
```

### 2. Design Service

**Purpose**: AI-driven visual design generation

**Tool**: **Open Design** ([nexu-io/open-design](https://github.com/nexu-io/open-design), Apache 2.0)

**Features**:
- Brand-level design systems (Stripe, Apple, Linear, Airbnb, etc.) — the catalogue grows upstream, so its size is not pinned here
- 31 composable skills covering web, mobile, slide, and marketing design
- 5 visual directions (Editorial Monocle, Modern Minimal, Warm Soft, Tech Utility, Brutalist)
- Export: HTML/CSS, PDF, PPTX, MP4
- 16 coding agent CLIs auto-detected
- BYOK architecture (bring your own API key)

**Workflow**:
1. User describes design intent in natural language
2. Open Design generates professional design artifact
3. Preview and refine interactively
4. Export to desired format
5. Hand off to `auto-coding-ui-polish` for DaisyUI/Animate.css enhancement

**API**:
```typescript
interface DesignService {
  generateDesign(params: {
    description: string;
    designSystem?: string;
    visualDirection?: 'editorial' | 'minimal' | 'warm' | 'tech' | 'brutalist';
    outputFormat?: 'html' | 'pdf' | 'pptx' | 'mp4';
  }): Promise<DesignArtifact>;
  verifyVisual(params: { viewports: Viewport[] }): Promise<VerificationReport>;
}
```

### 3. Review Engine

**Purpose**: Comprehensive multi-layer code review

**Five-Layer Architecture**:

| Layer | Tool | Scope | AutoFix |
|-------|------|-------|---------|
| **Layer 1** | ESLint + reviewdog | Syntax, style, common bugs | ✅ |
| **Layer 2** | react-doctor | React-specific patterns (useEffect, state) | ✅ |
| **Layer 3** | Playwright | Visual regression (pixel-perfect) | ❌ |
| **Layer 4** | Claude Code Headless | Semantic logic, security patterns | ⚠️ Partial |
| **Layer 5** | Aggregate | Prioritize by severity, deduplicate | ✅ |

**Modes**:
- `full`: All layers
- `pr`: PR-focused (Layers 1-2)
- `security`: Security rules only (OWASP, eslint-plugin-security)

### 4. Test Engine

**Purpose**: Intelligent test execution

**Tools**:
- **Vitest**: Unit/integration tests
- **Playwright**: E2E browser tests + Visual regression

**Strategies**:
- `runAffected()`: Only test changed files (via git diff)
- `runSuite(mode)`: Full suite with coverage

**Coverage Target**: ≥ 80%

### 5. OpenDigger Service

**Purpose**: Competitive intelligence

**Source**: OpenDigger (开源项目数据分析平台)

**CLI**: `opendigger analyze --repo <owner/repo> --metric openrank --period 90d`

### 6. Notification Service

**Purpose**: Multi-channel alerts

**Channels**: DingTalk, Feishu, Email

---

## Frontend Design & Polish Toolchain

For non-professional developers and designers — zero technical knowledge required, fully automated:

| Tool | Function | License | Automation |
|------|----------|---------|-------------|
| **Open Design** | AI design generation (design systems; catalogue grows upstream) | Apache 2.0 | ✅ |
| **DaisyUI** | Tailwind theme plugin (35 presets) | MIT | ✅ |
| **Animate.css** | CSS animations (80+ presets) | MIT | ✅ |
| **Lucide React** | Icon system (2000+ icons) | ISC | ✅ |
| **Playwright** | Automated visual regression testing | Apache 2.0 | ✅ |

### Integration Workflow

```
User describes need → /ui-polish（Design 流程：Open Design 选型）
     ↓
Open Design generates design with a brand system from its catalog
     ↓
/ polish (DaisyUI + Animate.css + Lucide React)
     ↓
Playwright auto visual regression test
     ↓
Deploy
```

### Conflict Analysis

| Combination | Conflict Risk | Notes |
|-------------|--------------|-------|
| Open Design + DaisyUI | 🟢 None | Design → code pipeline |
| Open Design + Animate.css | 🟢 None | Design → animation pipeline |
| DaisyUI + Animate.css | 🟢 None | Pure CSS, no runtime overlap |
| Animate.css + Lucide React | 🟢 None | CSS animations + React icons |
| All + Playwright | 🟢 None | Testing layer, independent |

---

## Runtime Layer Tools

### Runtime Tools

| Tool | Purpose | Invocation |
|------|---------|-----------|
| **ESLint** | Linting | `npx eslint .` |
| **react-doctor** | React patterns | `npx react-doctor .` |
| **Playwright** | Visual/E2E | `npx playwright test` |
| **Vitest** | Unit tests | `npx vitest run` |
| **prettier** | Code formatting | `npx prettier --write .` |
| **OpenDigger** | Data analysis | `npx opendigger analyze` |
| **DaisyUI** | Theme system | Tailwind plugin (zero runtime) |
| **Animate.css** | Animations | CSS import (zero runtime) |
| **Lucide React** | Icons | React component (tree-shakeable) |
| **Critiq** | Security | `npx critiq check .` — 1,243 条确定性安全规则 |

---

## Design Principles (12-factor-agents)

These are **cross-cutting concerns**, not architectural layers.

| Principle | Application |
|-----------|-------------|
| **#1 明确接口契约** | Capability APIs (`MemoryService.recall(params)`) have strict TypeScript interfaces |
| **#2 无共享状态** | Each workflow runs with isolated context; steps communicate via defined interfaces |
| **#3 配置与代码分离** | Secrets in `.env`, workflows in JSON, business logic in TS |
| **#4 并发与弹性** | ReviewEngine 5-layer review can run in parallel (Layers 1-4 independent) |
| **#5 构建/运行分离** | Knowledge graph built at build time, read-only at runtime |
| **#6 一次性执行** | Workflows are idempotent; re-running skips completed steps |
| **#7 环境等价** | `node src/index.js start <scene>` behaves identically in local and CI |
| **#8 并发进程** | Multiple CLI subprocesses run in parallel (ESLint + Playwright) |
| **#9 易处置** | SIGINT cleanly terminates workflow; no state residue |
| **#10 日志即事件** | CLI outputs structured JSON logs for observability |

---

## Zero-Conflict Strategy

### Tool Isolation

**Memory Tools**: Prefix isolation prevents cross-contamination
- `memory-agentmemory_*` → agentmemory DB
- `memory-nexo_*` → NEXO Brain
- `memory-codegraph_*` → CodeGraph

**Review Tools**: Configuration dedup
- `react-doctor.config.json`: `"adoptExistingLintConfig": false`
- Playwright: `snapshotDir: ".visual-baselines/playwright"`

**Frontend Tools**: No runtime overlap
- DaisyUI: Tailwind plugin (build time only)
- Animate.css: Pure CSS import (no JS)
- Lucide React: Tree-shakeable React components
- Open Design: Independent Electron/Next.js app
- Playwright: Test-only dependency

### Compatibility Checks

The following checks ensure architectural compliance during development:

1. Memory tool prefix isolation
2. SQLite file independence
3. react-doctor dedup configuration
4. Playwright baseline directory
5. Scene workflows existence (34 expected scenes)
6. 12-factor principles compliance
7. Frontend tool absence of runtime conflicts (DaisyUI + Animate.css + Lucide React)
8. CI permission safety
9. Rejected tools residue
10. Three-layer purity (no fake "orchestration layer")
11. Capability API consistency (6/6 services referenced)
12. Node type compliance

---

## CI/CD Integration

### Health Check Workflow (`.github/workflows/project-health-check.yml`)

Triggers on PR changes to workflows:
```yaml
on:
  pull_request:
    paths:
      - '.claude/scenes/**'
      - 'ARCHITECTURE.md'
```

### Review Pipeline (`.github/workflows/review-pipeline.yml`)

Simplified to single CLI invocation:
```yaml
- name: Run comprehensive review
  run: node src/index.js start review --auto
```

---

## MCP Configuration

MCP servers are configured by **exactly two files**, and the engine only ever sees the first one:

| File | Role |
|------|------|
| `.mcp.json` | 当前生效的配置（light 档，3 个无需凭据的 server） |
| `.mcp.json.full` | 完整档（14 个，含需要凭据/首次会下载的） |

切换是**整文件替换**，可逆：`npm run mcp:switch -- full` / `npm run mcp:switch -- light`。

**没有实现「按场景自动启用 MCP」**。以前这里挂着这样一份配置（场景 → server 映射 + token 预算），
但它**没有任何代码读取**：24 条映射里 6 条指向已退役场景（`design`/`simplify`/`hunt`/`analyze`/`audit`/`prototype`），
8 个现存场景没有映射。第三十三轮整份删除 —— 描述一个不存在的机制，比不描述更糟。
`tests`: `claude-scene/src/commands/retired-artifacts.test.js` 守着它不许复活。

---

## Quick Start

### Prerequisites
- **Node.js ≥ 20.x**（推荐 ≥ 25.x）
- Git
- 不需要 Claude Code CLI —— 引擎是仓库内的 Node 脚本（`node claude-scene/src/index.js start <场景> --auto`）

### 1. Initialize Project Structure
```bash
mkdir -p .claude/{skills,commands,rules}
mkdir -p .visual-baselines/playwright
```

### 2. Install Frontend Design Tools
```bash
# Open Design (AI design generation) — optional, gitignored, local clone only
git clone https://github.com/nexu-io/open-design.git
cd open-design && pnpm install

# DaisyUI, Animate.css, Lucide React
npm install daisyui animate.css lucide-react

# Playwright (visual testing)
npm install -D @playwright/test
npx playwright install chromium
```

### 3. Install Memory Components
```bash
# Claude-Mem: claude plugins install claude-mem
# agentmemory: npm install -g agentmemory && agentmemory init
# NEXO Brain: npx nexo-brain init --model gpt-4.1
# CodeGraph: npm install -g @codegraph/cli && codegraph index
```

### 4. Install Review Components
```bash
npm install -D eslint @playwright/test react-doctor prettier
# 配置文件：eslint.config.js, playwright.config.ts, react-doctor.config.json
npx playwright install chromium
```

### 5. Configure Environment
```bash
cp claude-scene/.env.example claude-scene/.env
# Edit .env with your API keys
```

### 6. Validate Setup
```bash
python3 .github/workflows/validate_workflows.py  # YAML validation
```

### 7. Run Your First Workflow
```bash
node src/index.js start new-project --auto
# or from Claude Code: input /new-project
```

---

## Appendix

### Rejected Tools (热度验证后明确拒绝)

| Tool | Reason |
|------|--------|
| lean-ctx | Low activity, unverified community |
| ouroboros | Experimental, security risk (self-delete incident) |
| codebase-memory-mcp | Duplicate of CodeGraph |
| agent-orchestrator | Conflicts with scene workflow architecture |
| claude-context | Duplicate of Claude-Mem |
| cc-haha | Based on leaked source code, legal risk |
| GrapesJS | Replaced by Open Design (AI-driven, higher quality) |
| *[7 shown]* | See project history for full list |

### Configuration Files

| File | Purpose |
|------|---------|
| `claude-scene/.env.example` | Environment variables template |
| `react-doctor.config.json` | ESLint/react-doctor dedup |
| `playwright.config.ts` | Visual regression config |
| `tailwind.config.js` | Tailwind CSS + DaisyUI plugin configuration |
| `.github/workflows/project-health-check.yml` | CI validation |
| `.github/workflows/validate_workflows.py` | YAML schema validator |

---

**Version**: v2026.06.14  
**Maintainer**: Architecture Team  
**Last Updated**: 2026-06-14