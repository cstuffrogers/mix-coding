---
description: Deep project analysis: code quality, performance bottlenecks, security vulnerabilities, maintainability. 18-step competitive analysis with OpenDigger data.
argument-hint: "[项目名]"
---

# /analyze — 深度项目分析

18 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文搜索 → 多维度分析 → 报告**

## Usage

```text
/analyze                          # 分析当前项目
/analyze react-hook-form           # 分析指定开源项目
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，建立分析框架

### Phase 1: 上下文收集（对话模式）

2. **Tavily MCP** (`step 2`) — 搜索项目背景、竞品信息

### Phase 2: 多维度分析

- **codeMetrics** (`step 3`) — 代码复杂度扫描（圈复杂度/重复率/文件行数/依赖深度）
- **performanceProfile** (`step 4`) — 性能静态分析（热点函数/大 Bundle）
- **detectAntiPatterns** (`step 5`) — 反模式检测
- **runReview** (`step 6`) — 代码审查（ESLint + TypeScript）
- **security-headers** (`step 7`) — 安全响应头配置

### Phase 3: 报告 + 沉淀

- **generateReport** (`step 8`) — 生成分析报告
- **ce-compound** (`step 13.5`) — 知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | Tavily MCP | MCP |
| 分析 | 复杂度扫描 + 性能静态分析 + 反模式检测 + ESLint | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 Tavily MCP 步骤自动跳过，skill-runner 展示清单参考内容。分析步骤正常执行。
