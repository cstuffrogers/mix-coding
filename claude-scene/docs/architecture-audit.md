# 架构深度审计报告

> 生成时间: 2026-06-13 | 审计范围: `claude-scene/src/` (81 文件, 13,353 行)

---

## 一、分层合规检查

### 当前分层结构

```
┌──────────────────────────────────────────────┐
│ CLI Layer (src/index.js + src/commands/)      │  Commander 入口, 参数解析
├──────────────────────────────────────────────┤
│ Action Dispatch (src/actions.js)              │  中央调度器, 导入全部 27 个 handler
├──────────────────────────────────────────────┤
│ Handler Layer (src/handlers/ + src/ui-polish) │  30+ 模块, 实现工作流步骤
├──────────────────────────────────────────────┤
│ Library Layer (src/lib/)                      │  共享工具: safe-exec, conditions, huashu/
├──────────────────────────────────────────────┤
│ Data Layer (src/data/)                        │  静态数据: action-messages.js
└──────────────────────────────────────────────┘
```

### 分层合规评分: ⚠️ 基本合规但存在 4 项违规

| # | 检查项 | 状态 | 详情 |
|---|--------|------|------|
| 1 | Handler → Lib 单向依赖 | ✅ 通过 | 所有 handler 仅 import lib 层 |
| 2 | Lib 层不依赖 Handler | ✅ 通过 | lib 模块无 handler import |
| 3 | CLI → Handler 通过 Action 调度 | ✅ 通过 | commands/start.js → actions.js → handlers |
| 4 | 无循环依赖 | ⚠️ 风险 | `ui-polish.js` → `actions.js` → `handlers/design.js` → 回链风险 |

### 层级违规详情

**违规 #1: ui-polish.js 跨层引用**
- `src/ui-polish.js` 位于根层，直接 import `./actions.js`
- 形成了 `ui-polish → actions → handlers` 的非标准调用链
- 建议: 将 `ui-polish.js` 移至 `src/handlers/` 或通过 `commands/start.js` 统一调度

**违规 #2: commands/start.js 双路调用**
- `commands/start.js` 同时 import `actions.js` 和 `ui-polish.js`
- UI polish 场景绕过 action dispatch 直接调 ui-polish
- 影响: 两套调用路径，行为不一致风险

---

## 二、复杂度热点图

### 热点排名 (按分支数)

| 排名 | 文件 | 行数 | 函数 | 分支数 | 分支密度 | 严重度 |
|------|------|------|------|--------|----------|--------|
| 🔴 1 | `handlers/security-scanning.js` | 701 | 18 | 106 | 0.151 | 严重 — God Module |
| 🔴 2 | `handlers/mobile.js` | 491 | 31 | 86 | 0.175 | 严重 — Fat Handler |
| 🔴 3 | `handlers/api-consistency.js` | 552 | 33 | 76 | 0.138 | 严重 — God Module |
| 🟠 4 | `handlers/testing.js` | 294 | 12 | 70 | **0.238** | 高 — 最高分支密度 |
| 🟠 5 | `handlers/design.js` | 237 | 18 | 65 | **0.274** | 高 — 最高分支密度 |
| 🟠 6 | `handlers/flow-control.js` | 375 | 29 | 59 | 0.157 | 高 — Fat Handler |
| 🟡 7 | `handlers/review.js` | 331 | 14 | 55 | 0.166 | 中 |
| 🟡 8 | `handlers/ui-tools.js` | 232 | 14 | 54 | 0.233 | 中 |
| 🟡 9 | `commands/start.js` | 356 | 24 | 52 | 0.146 | 中 |
| 🟡 10 | `handlers/external-tool-checks.js` | 290 | 11 | 45 | 0.155 | 中 |

### God Module 定义 (>500 行)

| 模块 | 行数 | 导出函数 | 问题 |
|------|------|---------|------|
| `security-scanning.js` | 701 | 14 | 单文件承载 14 种安全检查，应拆分为独立模块 |
| `api-consistency.js` | 552 | 1 | 仅导出 1 个函数但 33 个内部函数，高内聚但过大 |

### Fat Handler 定义 (300-500 行)

| 模块 | 行数 | 函数 | 问题 |
|------|------|------|------|
| `mobile.js` | 491 | 31 | 混合 mobile-audit/review/optimize 多种职责 |
| `flow-control.js` | 375 | 29 | 29 个函数过于密集 |
| `sync-docs.js` | 360 | 22 | 文档同步逻辑过长 |
| `commands/start.js` | 356 | 24 | CLI 命令应更薄 |
| `review.js` | 331 | 14 | — |

### 最高分支密度 (>0.2 = 每 5 行一个分支)

| 文件 | 分支密度 | 风险 |
|------|---------|------|
| `design.js` | **0.274** | 逻辑分支过于密集，测试覆盖困难 |
| `testing.js` | **0.238** | 同上 |
| `ui-tools.js` | 0.233 | 同上 |
| `git.js` | 0.217 | 同上 |

---

## 三、架构反模式识别

### 1. 🔴 Central Dispatch Monolith (actions.js)

`src/actions.js` 导入全部 27 个 handler 模块，形成**星型依赖**。任何 handler 改动都会触发 actions.js 的依赖图更新。

```
actions.js
  ├── handlers/memory.js
  ├── handlers/code-analysis.js  (barrel → 7 子模块)
  ├── handlers/testing.js
  ├── handlers/git.js
  ├── handlers/design.js
  ├── handlers/issues.js
  ├── handlers/quality.js
  ├── handlers/deps.js
  ├── handlers/review.js
  ├── handlers/docs.js
  ├── handlers/migration.js
  ├── handlers/monitor.js
  ├── handlers/cicd.js
  ├── handlers/backup.js
  ├── handlers/changelog.js
  ├── handlers/docker.js
  ├── handlers/e2e.js
  ├── handlers/flow-control.js
  ├── handlers/incident.js
  ├── handlers/logging.js
  ├── handlers/mobile.js
  ├── handlers/mobile-onboard.js
  ├── handlers/mobile-release.js
  ├── handlers/mobile-testing.js
  ├── handlers/sbom.js
  └── handlers/ui-tools.js
```

**影响**: 新增场景需要修改 actions.js 添加 import，违反开闭原则。

### 2. 🟠 Barrel File 过度包装 (code-analysis.js)

`src/handlers/code-analysis.js` (22 行) 是纯 re-export barrel，自身无逻辑，仅转发 3 个子模块的导出。增加了不必要的间接层。

### 3. 🟠 无 Service/Repository 抽象

所有 handler 直接调用 `safeExec()` + `fs.readFileSync()` 等 I/O 操作。没有:
- 配置管理抽象
- 文件系统抽象
- 外部工具执行抽象

这导致 handler 测试困难（当前覆盖率 21.8% 的根本原因之一）。

### 4. 🟡 ui-polish.js 位置不当

`src/ui-polish.js` 不在 handlers 目录，但功能上是一个 handler。它位于 src/ 根层，通过 actions.js 间接调用其他 handler，形成非标准路径。

---

## 四、依赖深度分析

### 关键路径最大深度

| 调用链 | 深度 | 路径 |
|--------|------|------|
| CLI → Action → Handler | 3 | `index.js → commands/start.js → actions.js → handler` |
| CLI → UI Polish | 4 | `index.js → commands/start.js → ui-polish.js → actions.js → handler` |
| Memory 子系统 | 3 | `actions.js → handlers/memory.js → handlers/memory/{agentmemory,claude-mem,...}.js` |
| Huashu 子系统 | 4 | `actions.js → handlers/design.js → lib/huashu/{brand-protocol,expert-review,...}.js` |

### 依赖方向检查

```
lib ← handlers ← actions ← commands ← index.js
 ↑                          ↓
 └──────── ui-polish.js ────┘  ⚠️ 反向依赖
```

---

## 五、改进建议（按优先级）

### P0 — 结构修复

| # | 建议 | 影响文件 | 预期收益 |
|---|------|---------|---------|
| 1 | 拆分 `security-scanning.js` (701行) | 1 → ~5 文件 | 可测试性、可维护性 |
| 2 | 拆分 `api-consistency.js` (552行) | 1 → ~3 文件 | 职责单一 |
| 3 | 拆分 `mobile.js` (491行) | 1 → ~3 文件 | 按 mobile-audit/review/optimize 分离 |

### P1 — 架构改进

| # | 建议 | 影响文件 | 预期收益 |
|---|------|---------|---------|
| 4 | actions.js 改为懒加载/注册制 | actions.js | 消除星型依赖 |
| 5 | 移除 code-analysis.js barrel | 1 文件 | 减少间接层 |
| 6 | ui-polish.js 移入 handlers/ | 1 文件 | 分层一致 |

### P2 — 长期优化

| # | 建议 | 预期收益 |
|---|------|---------|
| 7 | 引入 I/O 抽象层 (FileSystem, CommandRunner) | 测试覆盖率可提升至 60%+ |
| 8 | 对 branchRatio > 0.2 的 4 个文件做复杂度重构 | 圈复杂度下降 30% |
| 9 | 统一 CLI 入口，消除 commands/start.js 双路调用 | 行为一致性 |

---

## 六、总结

| 维度 | 评分 | 说明 |
|------|------|------|
| 分层合规 | ⚠️ B | 基本合规，1 处跨层引用 + 1 处双路调用 |
| 模块规模 | ⚠️ C | 3 个 God Module (>500行), 5 个 Fat Handler (>300行) |
| 圈复杂度 | ⚠️ C | 平均 14.7, 4 个文件分支密度 >0.2 |
| 依赖管理 | ⚠️ B | 星型中央调度, 无循环依赖但存在风险 |
| 可测试性 | 🔴 D | 21.8% 覆盖率, 无 I/O 抽象, handler 直接调用 fs/shell |
| 扩展性 | ⚠️ C | 新增场景需修改 actions.js |

**综合评分: C+** — 项目结构基本合理，但存在 God Module、中央调度器紧耦合、可测试性差三个主要问题。短期优先拆分 3 个超大文件，中期引入 handler 注册机制替代星型 import。
