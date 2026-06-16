---
description: Configure end-to-end testing infrastructure: MSW mock server + Supertest HTTP assertions + Schemathesis API fuzz testing. 9-step workflow.
---

# /e2e — 端到端测试配置

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → Mock 配置 → HTTP 断言 → Fuzz 测试**

## Usage

```text
/e2e
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦测试覆盖率/API 安全/边界条件项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取 API 端点和测试相关 issues

### Phase 2: E2E 测试配置

- **setupMSW** (`step 2`) — 配置 MSW Mock 服务器
- **setupSupertest** (`step 3`) — 配置 Supertest HTTP 断言
- **setupSchemathesis** (`step 4`) — 配置 Schemathesis API fuzz 测试
- **generateCI** (`step 5`) — 生成 CI 集成配置

### Phase 3: 沉淀

- **ce-compound** (`step 6`) — E2E 测试配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| Mock | MSW | CLI |
| 断言 | Supertest | CLI |
| Fuzz | Schemathesis | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。测试框架配置步骤正常执行。
