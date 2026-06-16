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
│   │  /new-project  /feature  /bugfix  /refactor  /design  /review│   │
│   │  /hunt  /analyze  /loop  /simplify  /optimize  /ui-polish      │    │
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

**Purpose**: Unified memory management combining 7 complementary backends

**Components**:
- **project-memory**: JSON-file-based structured memory, type-tagged (security/bugfix/architecture/…)
- **Claude-Mem**: Claude Code native plugin, Markdown-based persistent memory
- **agentmemory**: CLI tool with SQLite backend, structured data
- **NEXO Brain**: Graph-based semantic memory with GPT-4
- **CodeGraph**: Code relationship knowledge graph (SQLite)
- **MemPalace**: Verbatim conversation archiving and recall (v3.3.5, 2026-06-06)
- **Supermemory**: Cloud-based semantic memory + user profiles (`supermemoryai/supermemory`, 26K+ stars, 2026-06-09, optional via `SUPERMEMORY_API_KEY`)

**Isolation Strategy**:
- Tool name prefixes: `memory-agentmemory_*`, `memory-nexo_*`, `memory-codegraph_*`
- Separate SQLite databases in ~/.agentmemory/, ~/.nexo/, ~/.codegraph/
- Supermemory is cloud-only, disabled by default (no API key → zero impact on local backends)

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

**Tool**: **Open Design** ([nexu-io/open-design](https://github.com/nexu-io/open-design), 40k+ Stars, Apache 2.0)

**Features**:
- 129 brand-level design systems (Stripe, Apple, Linear, Airbnb, etc.)
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

| Tool | GitHub Stars | Function | License | Automation |
|------|-------------|----------|---------|-------------|
| **Open Design** | 40k+ | AI design generation (129 design systems) | Apache 2.0 | ✅ |
| **DaisyUI** | 30k+ | Tailwind theme plugin (35 presets) | MIT | ✅ |
| **Animate.css** | 77k+ | CSS animations (80+ presets) | MIT | ✅ |
| **Lucide React** | 12k+ | Icon system (2000+ icons) | ISC | ✅ |
| **Playwright** | 65k+ | Automated visual regression testing | Apache 2.0 | ✅ |

### Integration Workflow

```
User describes need → /design (Open Design)
     ↓
Open Design generates design with 129 brand systems
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

## MCP Dynamic Enablement

**File**: `.claude/mcp-enable.json`

Maps workflows to MCP servers with token budget:

```json
{
  "mcp_mappings": {
    "new-project": {
      "enabled_servers": ["github", "tavily", "context7", "supabase", "stripe", "resend"],
      "token_estimate": 2200
    },
    "design": {
      "enabled_servers": [],
      "token_estimate": 0
    }
  }
}
```

---

## Quick Start

### Prerequisites
- **Node.js ≥ 20.x**（推荐 ≥ 25.x）
- Git
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

### 1. Initialize Project Structure
```bash
mkdir -p .claude/{skills,commands,rules}
mkdir -p .visual-baselines/playwright
```

### 2. Install Frontend Design Tools
```bash
# Open Design (AI design generation)
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
cp .env.example .env
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

| Tool | Reason | Stars |
|------|--------|-------|
| lean-ctx | Low activity, unverified community | 239 |
| ouroboros | Experimental, security risk (self-delete incident) | 547 |
| codebase-memory-mcp | Duplicate of CodeGraph | — |
| agent-orchestrator | Conflicts with scene workflow architecture | — |
| claude-context | Duplicate of Claude-Mem | — |
| cc-haha | Based on leaked source code, legal risk | — |
| GrapesJS | Replaced by Open Design (AI-driven, higher quality) | — |
| *[7 shown]* | See project history for full list | — |

### Configuration Files

| File | Purpose |
|------|---------|
| `.claude/mcp-enable.json` | MCP server mapping per workflow |
| `.env.example` | Environment variables template |
| `react-doctor.config.json` | ESLint/react-doctor dedup |
| `playwright.config.ts` | Visual regression config |
| `tailwind.config.js` | Tailwind CSS + DaisyUI plugin configuration |
| `.github/workflows/project-health-check.yml` | CI validation |
| `.github/workflows/validate_workflows.py` | YAML schema validator |

---

**Version**: v2026.06.14  
**Maintainer**: Architecture Team  
**Last Updated**: 2026-06-14