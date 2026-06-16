---
description: Configure local CI/CD pipeline: validate GitHub Actions workflows with Act + generate Taskfile.yml task runner. 11-step workflow.
---

# /cicd — CI/CD 配置

11 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → Workflow 验证 → Taskfile 生成**

## Usage

```text
/cicd
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦 CI/CD 安全/密钥管理/构建配置项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 检查现有 Actions workflow 配置

### Phase 2: CI/CD 配置

- **validateWorkflows** (`step 2`) — 使用 Act 验证 GitHub Actions 工作流
- **generateTaskfile** (`step 3`) — 生成 Taskfile.yml 本地任务运行器
- **validateTaskfile** (`step 4`) — 验证 Task 任务可执行性

### Phase 3: 沉淀

- **ce-compound** (`step 5`) — CI/CD 配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| CI/CD | Act + Task | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。Workflow 验证和配置文件生成步骤正常执行。
