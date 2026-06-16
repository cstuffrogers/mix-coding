---
description: Measure-based performance optimization: profile baseline → locate bottlenecks → analyze → auto-fix → verify.
---

# /optimize — 性能优化

16 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 基线测量 → 瓶颈定位 → 优化 → 验证**

## Usage

```text
/optimize                         # 全量性能优化
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦性能项（N+1 查询/代码分割/缓存策略）
2. **recall** (`step 0.5`) — 注入历史性能数据和优化记录

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 2`) — 列出性能相关 issues
4. **Context7 MCP** (`step 3`) — 获取性能优化最佳实践文档

### Phase 2: 性能分析

- **performanceProfile** (`step 4`) — 热点函数/大 Bundle/同步阻塞检测
- **codeMetrics** (`step 5`) — 圈复杂度/重复率/文件行数/依赖深度

### Phase 3: 优化执行

- **detectAntiPatterns** (`step 6`) — 检测性能反模式（N+1/同步 I/O/内存泄漏）
- **locate** (`step 7`) — 定位最热瓶颈
- **autoFix** (`step 8`) — 自动应用安全优化
- **runSuite** (`step 9`) — 回归测试

### Phase 4: 验证 + 沉淀

- **checkCoverage** (`step 10`) — 验证覆盖率未降级
- **ce-compound** (`step 11`) — 性能优化知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 分析 | 性能静态分析 + 复杂度扫描 + 反模式检测 | CLI |
| 验证 | 测试套件 + 覆盖率 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过，skill-runner 展示清单参考内容。分析和优化步骤正常执行。
