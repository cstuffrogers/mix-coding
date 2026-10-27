---
description: Scaffold quality-observability facilities — E2E tests (MSW + Supertest + Schemathesis), uptime monitoring (Upptime + GitHub Actions), or property-based tests. 9-step workflow, branch chosen by --kind.
---

# /setup — 测试/监控/属性测试设施搭建

9 步工作流：**分支选择（e2e / monitor / property）→ 记忆召回 → 设施搭建 → 门禁检查 → 自动修复 → 通知**

引擎场景：`.claude/scenes/setup.json`（`selectSetupKind` 把选择写成 `context.setup_kind`，
后续步骤按 `setup_kind === 'e2e' | 'monitor' | 'property'` 条件分支，三者同构）。

## Usage

```text
/setup                    # 交互式选择 kind
/setup --kind e2e         # E2E：MSW + Supertest + Schemathesis
/setup --kind monitor     # 监控：Upptime + GitHub Actions
/setup --kind property    # 属性测试：propertyTestScout 探测 + 生成
/setup --auto             # 无人值守（跳过所有确认）
```

## 执行流程

### Phase 0: 分支选择

- **selectSetupKind** (`step 0`) — 单选 e2e / monitor / property，写入 `context.setup_kind`
- **invokeSkill** (`step 0.3`，仅 `conversation_mode`) — 加载对应设施的搭建知识

### Phase 1: 上下文

- **recall** (`step 1`) — 召回本场景历史（上次搭了什么、卡在哪）

### Phase 2: 设施搭建（按 kind 只走一条）

- **setupE2E** (`step 2.1`，`setup_kind === 'e2e'`) — MSW + Supertest + Schemathesis
- **setupMonitor** (`step 2.2`，`setup_kind === 'monitor'`) — Upptime + GitHub Actions 定时探测
- **propertyTestScout** (`step 2.3`，`setup_kind === 'property'`) — 探测可属性化的纯函数/序列化边界
- **invokeSkill** (`step 2.35`，`setup_kind === 'property'` 且对话模式) — 属性测试编写指引

### Phase 3: 收口

- **checkGate** (`step 3`) — 跑门禁（lint / typecheck / test）
- **autoFix** (`step 4`) — 门禁失败时按规则自动修复（有上限，超限停下问人）
- **send** (`step 5`，仅 `setupConfigured == false`) — 如实报告「设施没搭成」而不是静默通过
- **remember / consolidate** (`step 6` / `step 7`) — 沉淀本轮结论
- **ce-compound** (`step 7.5`) — CE 知识沉淀
- **notify** (`step 8`) — 完成通知

## 相关

- 场景定义：`.claude/scenes/setup.json`
- 条件求值：`claude-scene/src/lib/conditions.js`（`setupCompleted` / `setupConfigured` 走探测，不信单个布尔）
- 同类入口：`/check`（引擎自检）、`/qa`（前端验证）
