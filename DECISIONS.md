# Mix-Coding System — Architectural Decisions

> 记录所有架构决策，便于后续 Agent 会话理解设计意图。
> 基于 ADR (Architecture Decision Records) 实践。

---

## ADR-001: 三层架构 + Scene 引擎

**Status**: ACCEPTED
**Date**: 2026-06-01
**Decided By**: System Architect

### Context

需要一种可扩展的架构来支持多种 AI 编码场景（新项目、功能开发、bug 修复、代码审查、重构、设计等），
同时保持代码库的可维护性和工具间的零冲突。

### Decision

采用三层架构：
- **交互层**: Scene 引擎 + CLI 命令路由
- **能力层**: 独立 Service (MemoryService, ReviewEngine, TestEngine, DesignService, OpenDiggerService)
- **运行时层**: AI 模型 + MCP 服务器 + 工具链

每个场景由独立的 JSON 文件定义，通过 `node src/index.js start <scene>` 触发。

### Consequences

- 正向: 场景之间完全隔离，添加新场景不修改现有代码
- 正向: 工具命名前缀机制 (memory-*, review-*) 防止命名冲突
- 负向: 场景 JSON 可能膨胀 (audit.json 达 620 行)

---

## ADR-002: 多平台支持 (Claude Code + opencode + Codex + ZCode)

**Status**: ACCEPTED
**Date**: 2026-06-15
**Decided By**: System Architect

### Context

项目需要在多个 AI 编码平台上运行，每个平台有不同的配置格式和命令机制。

### Decision

- `.claude/` 作为共享资源宿主（scenes/skills/rules/memory/plugins）
- 各平台通过环境变量 (CLAUDECODE/OPENCODE/CODEX/ZCODE) 自识别
- opencode 采用全局配置 (`~/.config/opencode/opencode.json`) + 项目配置的 双层架构
- 共享配置通过 `CLAUDE.md` → `AGENTS.md` 链引用

### Consequences

- 正向: 一次配置，四个平台可用
- 正向: `.claude/commands/*.md` 38 个工作流在 opencode 中 100% 对齐
- 负向: ZCode 尚未实测

---

## ADR-003: Harness Engineering 实践

**Status**: ACCEPTED
**Date**: 2026-06-30
**Decided By**: System Audit

### Context

Harness Engineering Audit 发现 3 个关键状态文件缺失 (feature_list.json, progress.md, DECISIONS.md)，评分 64% (Tier C)。

### Decision

采用基于 [Learn Harness Engineering](https://github.com/walkinglabs/learn-harness-engineering) 的实践：
- `feature_list.json`: 机器可读的功能边界，强制 WIP=1
- `progress.md`: 人类可读的会话历史，跨 Session 恢复上下文
- `DECISIONS.md`: 架构决策记录，让新 Agent 理解设计意图
- `init.sh`: 会话初始化脚本，验证环境健康
- 5 个子系统: Instructions + State + Verification + Scope + Session Lifecycle

### Consequences

- 正向: 严格 WIP=1 控制 Agent 不越界
- 正向: 跨会话上下文不再丢失
- 负向: 需要维护额外文件
