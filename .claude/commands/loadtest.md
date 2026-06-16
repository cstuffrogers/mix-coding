---
description: Run Artillery load tests: smoke (PR validation) → load (release gates) → stress (capacity planning). 9-step workflow with CI/CD performance gates.
argument-hint: "[smoke|load|stress]"
---

# /loadtest — 负载测试

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 模式选择 → 执行测试 → 结果评估**

## Usage

```text
/loadtest                         # 默认 smoke 模式
/loadtest smoke                   # 轻量测试（1-5 VUs, 30s），PR 验证
/loadtest load                    # 标准负载（50+ VUs, 5min），发布门禁
/loadtest stress                  # 峰值压力（100+ VUs, 10min），容量规划
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦性能/并发/资源管理项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 列出性能相关 issues

### Phase 2: 负载测试执行

- **detectMode** (`step 2`) — 从参数解析测试模式（默认 smoke）
- **startServer** (`step 3`) — 启动后台服务
- **runLoadTest** (`step 4`) — 运行 Artillery 负载测试
- **evaluateResults** (`step 5`) — 评估结果：p50/p95/p99 延迟 + 错误率
- **stopServer** (`step 6`) — 停止后台服务

### Phase 3: 沉淀

- **ce-compound** (`step 7`) — 性能数据沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| 测试 | Artillery（smoke/load/stress） | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。负载测试执行和结果评估正常执行。
