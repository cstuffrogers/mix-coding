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

## ADR-002: 多平台支持 (Claude Code + opencode + Codex + ZCode + pi)

**Status**: ACCEPTED
**Date**: 2026-06-15 (2026-10-24 更新: 新增 pi)
**Decided By**: System Architect

### Context

项目需要在多个 AI 编码平台上运行，每个平台有不同的配置格式和命令机制。

### Decision

- `.claude/` 作为共享资源宿主（scenes/skills/rules/memory/plugins）
- 各平台通过环境变量 (CLAUDECODE/OPENCODE/CODEX/ZCODE/AI_AGENT) 自识别
- opencode 采用全局配置 (`~/.config/opencode/opencode.json`) + 项目配置的 双层架构
- 共享配置通过 `CLAUDE.md` → `AGENTS.md` 链引用
- pi 使用专属 `.pi/` 目录（官方 CONFIG_DIR_NAME） + 引擎 CLI；percho 是 pi 的桌面端 GUI，共用 `.pi/` 与引擎，不单独识别

### Consequences

- 正向: 一次配置，五个平台可用
- 正向: `.claude/commands/*.md` 38 个工作流在 opencode 中 100% 对齐
- 负向: ZCode / pi 尚未实测（AI_AGENT=pi 标记已从 pi 源码核验）

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

---

## ADR-004: 记忆写入侧去重（内容指纹）

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: Memory audit round 5

### Context

一次结果写 4 个后端（project-memory / claude-mem / agentmemory / NEXO）。
`autoRemember` 的 data 里带 `timestamp: new Date().toISOString()`，而 project-memory
的旧去重是「完整内容 sha256」—— 于是每跑一次场景，4 个后端各多一份完全相同的内容。
清单计数一路涨，召回侧又去重成一条，用户看到的「记忆在变多」是假的。

### Decision

- 统一指纹 `contentFingerprint(value)`：规范化 JSON（键排序 + 忽略
  `timestamp` / `ts` / `created_at` / `updated_at` / `stored_at` / `archived_at`）后 sha256。
- **不忽略 `id`**：它常是 data 里区分两条记录的字段，忽略会导致真实记忆被判重丢失。
- 判重必须带项目路径：否则 B 项目的同名内容被 A 项目的记录「挡住」，B 永远查不到。
- 窗口 7 天（`DEDUPE_WINDOW_MS`）：无限长会让周期性检查永远只留第一天那条。
- 判重失败一律照写；`{skipped:true}` 的消息措辞不得含「失败」（引擎按
  `/失败|阻断|FAIL/` 判步骤失败）。
- 四个后端各自实现：claude-mem items（前 20 条）/ markdown（标题区写指纹，查最近 10 个文件）/
  agentmemory（新增 `content_hash` 列，判定下推 SQL）/ NEXO（事件 JSON 带 `fingerprint`，查 50 个）。

### Consequences

- 正向: 重复跑不再堆副本；消息如实说明「N 个后端命中相同内容未重复写入」
- 负向: 指纹是启发式而非数据库约束，极端并发仍可能各写一份（锁只保证文件不截断）
- 负向: agentmemory 多一次 `SELECT COUNT(*)`（有 `type` 索引，代价可接受）

---

## ADR-005: `.archive` 用压缩收敛，不删

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: Memory audit round 5

### Context

保留策略一律「归档不删除」，代价是 `.archive` 无限增长。删除用户记忆是不可逆的
（历史审计中已两次因此拒绝删除方案）。

### Decision

`pruneAll` 末尾调用 `compactArchives()`：把 30 天（`archiveOlderThanDays` 可调）以前的
归档文件 gzip 成 `.gz`，覆盖四个归档根。压缩件非空且回读非空才删原文件；已有 `.gz`
不覆盖；单文件 > 64MB 跳过（`gzipSync` 一次性读内存）；失败数 / 超大数必须打印。

### Consequences

- 正向: 空间增长被压住，且数据一条不丢（`gunzip` 即可还原）
- 负向: 归档件的格式从 `.jsonl` 变成 `.jsonl.gz`，外部工具若直接读归档目录需自行解压
- 负向: `.gz` 永不删除，体积增长变慢但不归零

---

## ADR-006: `.codegraph/`（130MB）保留，不重建

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: Memory audit round 5

### Context

`E:/auto-coding/.codegraph/codegraph.db` 约 130MB（3567 节点），已被 `.gitignore` 忽略，
不随仓库分发。重建需要外部 codegraph MCP 服务，当前环境网络受限（github/Docker Hub 不可达）。

### Decision

保留现状，不做删除/重建。理由：它不是仓库内容，不影响测试与安装；删掉只是把
「下一次查询变慢」提前，且重建能力依赖一个当前不可用的外部工具。

### Consequences

- 正向: 不引入无法验证的破坏性操作
- 负向: 本地磁盘占用 130MB；数据库内容随代码演进会过时（`codegraph` 查询结果可能滞后）

---

## ADR-007: MCP 可用性以配置文件为准，不以「是不是在对话里」为准

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: 全工作流健康检查

### Context

`conditions.js` 里所有 `*_mcp_available` 都是 `isConversationMode()`。这在 Claude Code 时代
勉强成立（那个宿主会自动加载 `.claude/mcp.json`），但它表达的是「我在对话里，所以什么
MCP 都有」——和真实配置无关。宿主收敛到 pi 之后，配置里只剩 schemaforge / a11y / detox
三个 server，而 github / sentry / tavily / context7 / codegraph / supabase / stripe / resend
的条件依然全部判「满足」，场景于是排了一串「调用不存在的工具」的步骤，跑起来才发现
工具不在，而且步骤状态是 pass。

### Decision

新增 `src/lib/mcp-config.js`，按 `项目 .pi/mcp.json → 用户 ~/.pi/agent/mcp.json →
.claude/mcp.json` 的顺序读配置，`hasMcpServer(kind)` 只认配置里真实存在且未
`enabled: false` 的条目；`conditions.js` 的 MCP 条件改为走它。`memory` / `codeguardian`
是引擎自带 handler，恒为真；`crg_skill_available` 是技能不是 MCP，仍按对话模式判断。

### Consequences

- 正向: 缺工具时步骤显示「跳过」而不是假装可用；`/check` Pass 10 与条件判定使用同一份配置
- 正向: 加装 MCP 后条件自动变真，不需要改代码
- 负向: 同一份配置在两处（项目级 / 用户级）需要同步维护
- 负向: 配置文件写错（JSON 语法错）会被判成「没有 server」，需靠 Pass 10 报错提示
