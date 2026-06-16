---
description: Generate executable Markdown Incident Runbook with health checks, common issues, and escalation paths using Runme. 9-step workflow.
---

# /incident — 事故响应

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 健康检查 → Runbook 生成**

## Usage

```text
/incident
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦监控/日志/回滚/故障转移项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取历史 incident issues 和 oncall 记录

### Phase 2: Runbook 生成

- **analyzeHealthEndpoints** (`step 2`) — 分析项目健康检查端点
- **catalogCommonIssues** (`step 3`) — 归类常见问题和修复方案
- **generateRunbook** (`step 4`) — 使用 Runme 生成可执行 Markdown Runbook
- **defineEscalation** (`step 5`) — 定义升级路径和联系人

### Phase 3: 沉淀

- **ce-compound** (`step 6`) — 运维知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| Runbook | Runme | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。健康检查分析和 Runbook 生成步骤正常执行。
