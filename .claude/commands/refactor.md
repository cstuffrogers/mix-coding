---
description: Automatically refactor code: analyze refactor points, generate refactor plan, execute refactor, verify with tests.
argument-hint: "[目标模块]"
---

# /refactor — 代码重构

24 步混合工作流：**Pre-flight 审查清单（对话模式）→ Skill 审查 → 重构分析 → 执行 → 验证**

## Usage

```text
/refactor                          # 交互式重构流程
/refactor src/handlers/auth.js      # 重构指定模块
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦可维护性/性能/类型安全项
2. **recall** (`step 0.5`) — 注入历史重构决策和已知反模式

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出该模块相关的 issues
4. **Context7 MCP** (`step 1.1`) — 获取相关技术栈最新文档

### Phase 2: Skill 审查（对话模式）

5. **Skill("review")** (`step 3`) — Matt Pocock 双轴审查（标准轴 + 规范轴），建立重构目标

### Phase 3: 重构执行

- **analyzeInterface** (`step 4`) — 分析模块接口和依赖
- **detectAntiPatterns** (`step 5`) — 检测反模式（God Object/重复代码/过长文件）
- **generateRefactorPlan** (`step 6`) — 生成渐进式重构方案
- **confirm** (`step 7`) — 用户确认重构范围
- **applyTransformations** (`step 8`) — 执行重构变换

### Phase 4: 验证 + 沉淀

- **runSuite** (`step 9`) — 运行测试套件验证
- **checkCoverage** (`step 10`) — 检查覆盖率
- **aislop-scan** (`step 11`) — 检查新引入的 AI 代码气味
- **ce-compound** (`step 8.5`) — 重构知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 代码审查 | review Skill（Matt Pocock 双轴） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 重构 | ESLint + 反模式检测 + aislop + 测试套件 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill()` 和 MCP 步骤自动跳过，skill-runner 展示清单/规则参考内容。重构分析和执行步骤正常执行。
