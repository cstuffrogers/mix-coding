---
description: Start an iterative optimization loop: Skill review → analyze → plan → implement → verify → repeat cycles.
argument-hint: "[迭代次数]"
---

# /loop — 自动迭代优化

12 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 分析 → 方案 → 实现 → 验证 → 循环**

## Usage

```text
/loop                             # 默认 3 轮迭代
/loop 5                           # 5 轮迭代
/loop "fix lint" 5                # 5 轮聚焦 lint 修复
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，建立迭代评估基准
2. **recall** (`step 0.5`) — 注入历史迭代记录

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 2`) — 列出待修复 issues
4. **Context7 MCP** (`step 3`) — 获取相关技术文档

### Phase 2: 迭代循环

每轮迭代：
- **analyze** — 分析当前状态、识别问题
- **plan** — 制定本轮方案（.claude/plan/loop-plan.md）
- **implement** — 执行修改
- **verify** — 运行测试、lint、对比基线评分

### Phase 3: 退出 + 沉淀

- **generateReport** (`step 6`) — 生成迭代报告（轮次/评分变化/修改文件）
- **ce-compound** (`step 6`) — 迭代知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 分析 | codeMetrics + performanceProfile + detectAntiPatterns | CLI |
| 验证 | runSuite + lint | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。分析和迭代步骤正常执行。
