---
description: Emergency rollback: identify target version → verify safety → execute rollback → health check → incident review. 16-step workflow with double confirmation.
---

# /rollback — 紧急回滚

16 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 版本选择 → 安全验证 → 执行回滚 → 服务验证**

## Usage

```text
/rollback
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦部署安全/回滚流程项
2. **recall** (`step 0.5`) — 注入历史回滚记录和已知风险

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出最近的 release tags 和关联 issues

### Phase 2: 回滚分析

- **listVersions** (`step 2`) — 列出最近 10 个发布版本
- **selectTarget** (`step 3`) — 选择回滚目标版本
- **codeMetrics** (`step 4`) — CodeGraph 分析版本差异影响范围
- **confirm** (`step 5`) — 二次确认回滚操作（高风险）

### Phase 3: 回滚执行

- **gitRollback** (`step 6`) — 执行 Git 回滚
- **rebuild** (`step 7`) — 回滚后重新构建
- **healthCheck** (`step 8`) — 强力健康检查（5次重试）
- **runSuite** (`step 9`) — 运行测试验证功能完整
- **pushRollback** (`step 10`) — 提交回滚记录并推送
- **createIncidentIssue** (`step 11`) — 创建回滚事件 Issue 供事后复盘

### Phase 4: 沉淀

- **ce-compound** (`step 12`) — 回滚知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| 影响分析 | CodeGraph | CLI |
| 验证 | 测试套件 + 健康检查 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。版本选择、回滚执行和验证步骤正常执行。
