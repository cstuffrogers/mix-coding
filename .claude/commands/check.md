---
description: Engine self-audit and self-healing — detect dead actions, orphan gate flags, missing action messages, and auto-fix data map files
---

# /check — 引擎自检 + 自愈

10 步工作流：**Pre-flight 记忆召回 → 检测（handler 验证/冒烟测试/action 消息/gate 映射）→ 自动修复 → 报告**

## Usage

```text
/check                    # 交互式自检
/check --auto             # 自动模式（含自动修复）
```

## 执行流程

### Phase 0: Pre-flight

1. **recall** (`step 0.5`) — 注入历史自检上下文

### Phase 1: 检测

2. **verify-handlers** (`step 1`) — handler 完整性验证：inline stubs / CE stubs / pseudo-stubs / 工具健康 / orphan actions
3. **check-smoke** (`step 2`) — 运行 Vitest 冒烟测试（dead action / handler smoke / await-safeExec / scene JSON）
4. **check-action-messages** (`step 3`) — 交叉对比 ACTION_REGISTRY 与 action-messages.js，检测缺少消息的 handler
5. **check-gate-flags** (`step 4`) — 交叉对比 context flag 写入与 gate-flags.js 映射，检测孤儿 flag

### Phase 2: 自动修复

6. **fix-action-messages** (`step 5`) — 为缺少消息的 handler 自动生成并插入 action message（仅修复数据文件，不修改 handler）
7. **fix-gate-flags** (`step 6`) — 为未映射的 context flag 自动推断检查名并插入 gate-flags.js

### Phase 3: 报告

8. **self-check-report** (`step 7`) — 生成结构化自检报告（发现数 + 修复数 + 遗留问题）
9. **remember** (`step 8`) — 保存自检结果到记忆
10. **consolidate** + **notify** (`step 9-10`) — 记忆整理 + 通知

### 自动修复原则

- 仅修改数据映射文件（`action-messages.js`、`gate-flags.js`），不修改 handler 代码或场景 JSON
- 跳过内联箭头函数（MCP placeholder / Matt Pocock stub），这些自带消息无需修复
- 修复前双重检查目标文件当前状态，确保幂等

### CLI 模式回退

在 CLI 模式（非对话）下，`recall` 和 `invokeSkill` 步骤自动跳过。检测和自动修复步骤正常执行。
