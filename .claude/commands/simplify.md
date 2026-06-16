---
description: Simplify code: scope → baseline tests → identify simplification → incremental test → review. Improve readability without changing behavior.
---

# /simplify — 代码简化

15 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 范围确认 → 简化 → 验证**

## Usage

```text
/simplify                         # 交互式简化流程
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦可维护性/文件行数/死代码项
2. **recall** (`step 0.5`) — 注入历史简化决策

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出代码质量相关 issues
4. **Context7 MCP** (`step 2`) — 获取代码风格最佳实践

### Phase 2: 简化分析

- **detectAntiPatterns** (`step 3`) — 检测过度抽象/重复代码/过长文件
- **codeMetrics** (`step 4`) — 圈复杂度/文件行数基线

### Phase 3: 简化执行

- **confirm** (`step 5`) — 用户确认简化范围（仅修改当前 feature 相关代码）
- **applyTransformations** (`step 6`) — 执行简化变换
- **runSuite** (`step 7`) — 行为验证

### Phase 4: 审查 + 沉淀

- **aislop-scan** (`step 8`) — 检查新引入的 AI 代码气味
- **runReview** (`step 9`) — 代码审查验证
- **ce-compound** (`step 10`) — 简化知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 分析 | 反模式检测 + 复杂度扫描 + aislop | CLI |
| 验证 | 测试套件 + 代码审查 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过，skill-runner 展示清单参考内容。简化和验证步骤正常执行。
