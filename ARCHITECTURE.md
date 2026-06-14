# Architecture Documentation

## Overview

This project implements a **three-layer architecture** following the **12-factor-agents** design principles. This document provides a comprehensive guide to the system's structure, components, and workflows.

## Table of Contents

1. [Three-Layer Architecture](#three-layer-architecture)
2. [Capability Layer Services](#capability-layer-services)
3. [Runtime Layer Tools](#runtime-layer-tools)
4. [Frontend Design & Polish Toolchain](#frontend-design--polish-toolchain)
5. [ECC Integration (everything-claude-code)](#ecc-integration-everything-claude-code)
6. [Workflow System (archon)](#workflow-system-archon)
7. [Design Principles (12-factor-agents)](#design-principles-12-factor-agents)
8. [Zero-Conflict Strategy](#zero-conflict-strategy)
9. [CI/CD Integration](#cicd-integration)
10. [MCP Dynamic Enablement](#mcp-dynamic-enablement)
11. [Quick Start](#quick-start)

---

## Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         🖥️ 交互层（Interaction Layer）                │
│         用户入口 · 场景选择 · 确认打断 · 结果展示                      │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  claude-scene CLI · 场景模板(.claude/scenes/) · 进度展示    │    │
│   │  /new-project  /feature  /bugfix  /refactor  /design  /review│   │
│   │  /hunt  /analyze  /loop  /simplify  /optimize  /polish      │    │
│   │  /ecc-plan  /ecc-tdd  /ecc-code-review  /ecc-e2e            │    │
│   │  /learn  /evolve  (ECC 持续学习 — 命名空间隔离)               │    │
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
│   │  archon CLI（工作流编排引擎）← 新增                          │    │
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
| **运行时层** | 执行环境、模型调用、工具集成 | Claude Code 核心、MCP Servers、Hooks、Child Process、**archon CLI** | 业务逻辑、决策流程 |

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

### archon CLI

**Role**: Workflow orchestration engine (YAML-based, complements claude-scene JSON scenes)

**Installation**: Clone the [Archon project](https://github.com/coleam00/Archon) and set up via WSL2 (see Quick Start below)

**Commands**:
```bash
archon workflow list                          # List available workflows
archon workflow run <name> [--pr <num>]      # Execute workflow
archon workflow validate <file>               # Validate YAML
```

**Configuration**: `.archon/workflows/*.yaml`

**vs. ESLint/Playwright**: archon is a **tool** in the runtime layer, not a new architectural layer.

### Other Runtime Tools

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

## ECC Integration (everything-claude-code)

本系统集成了 [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)（50k+ Stars），采用**命名空间隔离**策略：

### 集成组件

| ECC 组件 | 本系统映射 | 集成方式 |
|----------|-----------|---------|
| planner agent | ecc-plan 场景 | Archon 子节点（feature 工作流） |
| architect agent | new-project 架构设计 | Archon 子节点增强 |
| tdd-guide agent | ecc-tdd 场景 | Archon ecc-tdd-enforce 节点 |
| code-reviewer agent | ecc-code-review 场景 | 5层审查 AI 语义层增强 |
| security-reviewer (912规则) | ecc-security-scan 场景 | security-hunt 工作流增强 |
| e2e-runner agent | ecc-e2e 场景 | Playwright E2E 增强 |
| **持续学习系统** ⭐ | **learn / evolve** | **全新能力 — 本系统最大差异化** |

### 命名空间规则

- 所有 ECC 命令加 `ecc-` 前缀：`/ecc-plan`, `/ecc-tdd`, `/ecc-code-review` 等
- 持续学习系统不加前缀：`/learn`, `/evolve`（无冲突）
- 冲突解决：`/code-review`(ECC) → `/ecc-code-review`，`/review`(本系统) 保持

### 持续学习系统

```
会话结束 → /learn → 提取模式 → .claude/knowledge/learn/
                                    ↓
定期执行 → /evolve → 评估成熟度 → 生成 Skill → .claude/skills/evolved/
```

详见：[ecc/mapping.json](./ecc/mapping.json)

---

## Workflow System (archon)

### Node Types

1. **`command`**: Deterministic service call (e.g., `review-full`, `notify-complete`)
2. **`prompt`**: LLM reasoning with prompt content
3. **`bash`**: Shell script execution
4. **`loop`**: Repeat execution with iteration control

### Common Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique node identifier |
| `command` | string | Node type: `command` / `prompt` / `bash` / `loop` |
| `description` | string | Human-readable node description |
| `prompt` | string | Prompt content (for `prompt` nodes) |
| `arguments` | string | Command arguments (for `command` nodes) |
| `context` | string | Context mode (e.g., `fresh`) |
| `depends_on` | string[] | IDs of prerequisite nodes |
| `condition` | string | Flag in context required to execute |

### Constants Pattern

Use `constants:` section to avoid string literals:
```yaml
constants:
  FRONTEND_INVOLVED: "frontend_involved"
  COMPETITOR_MENTIONED: "user_mentioned_competitor_or_domain"

nodes:
  - id: analyze
    condition: constants.COMPETITOR_MENTIONED
```

---

## Design Principles (12-factor-agents)

These are **cross-cutting concerns**, not architectural layers.

| Principle | Application |
|-----------|-------------|
| **#1 明确接口契约** | Capability APIs (`MemoryService.recall(params)`) have strict TypeScript interfaces |
| **#2 无共享状态** | Each archon workflow runs in isolated git worktree; nodes communicate via depends_on |
| **#3 配置与代码分离** | Secrets in `.env`, workflows in YAML, business logic in TS |
| **#4 并发与弹性** | ReviewEngine 5-layer review can run in parallel (Layers 1-4 independent) |
| **#5 构建/运行分离** | Knowledge graph built at build time, read-only at runtime |
| **#6 一次性执行** | archon workflows are idempotent; re-running skips completed steps |
| **#7 环境等价** | `archon workflow run` behaves identically in local and CI |
| **#8 并发进程** | Multiple CLI subprocesses run in parallel (ESLint + Playwright) |
| **#9 易处置** | SIGINT cleanly terminates workflow; no state residue |
| **#10 日志即事件** | archon outputs structured JSON logs for observability |

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
5. archon workflows existence (12 expected: new-project, feature, bugfix, refactor, design, review, hunt, analyze, loop, simplify, optimize, ui-polish)
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
      - '.archon/workflows/**'
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
mkdir -p .archon/{workflows,commands}
mkdir -p .visual-baselines/playwright
```

### 2. Initialize archon workflows (optional)
```bash
mkdir -p .archon/{workflows,commands}
```

### 3. Install Frontend Design Tools
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

### 4. Install Memory Components
```bash
# Claude-Mem: claude plugins install claude-mem
# agentmemory: npm install -g agentmemory && agentmemory init
# NEXO Brain: npx nexo-brain init --model gpt-4.1
# CodeGraph: npm install -g @codegraph/cli && codegraph index
```

### 5. Install Review Components
```bash
npm install -D eslint @playwright/test react-doctor prettier
# 配置文件：eslint.config.js, playwright.config.ts, react-doctor.config.json
npx playwright install chromium
```

### 6. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 7. Validate Setup
```bash
python3 .github/workflows/validate_workflows.py  # YAML validation
```

### 8. Run Your First Workflow
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
| agent-orchestrator | Conflicts with archon architecture | — |
| claude-context | Duplicate of Claude-Mem | — |
| cc-haha | Based on leaked source code, legal risk | — |
| GrapesJS | Replaced by Open Design (AI-driven, higher quality) | — |
| *[7 shown]* | See project history for full list | — |

### Configuration Files

| File | Purpose |
|------|---------|
| `.archon/workflows/*.yaml` | archon workflow definitions |
| `.claude/mcp-enable.json` | MCP server mapping per workflow |
| `.archon/timeout-policy.md` | Global timeout/retry defaults |
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