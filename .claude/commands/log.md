---
description: Detect project logging library (winston/pino/log4js), auto-generate structured logging config, detect ELK/Fluentd and generate collection config. 9-step workflow.
---

# /log — 日志配置

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 日志库检测 → 配置生成 → 采集配置**

## Usage

```text
/log
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦日志安全/脱敏/结构化日志项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取现有日志配置和 issues

### Phase 2: 日志配置

- **detectLibrary** (`step 2`) — 检测项目日志库（winston/pino/log4js）
- **generateConfig** (`step 3`) — 生成结构化日志配置（JSON/字段标准）
- **detectCollector** (`step 4`) — 检测 ELK/Fluentd 并生成采集配置
- **validateConfig** (`step 5`) — 验证日志格式和采集管道

### Phase 3: 沉淀

- **ce-compound** (`step 6`) — 日志配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| 日志 | winston/pino/log4js + ELK/Fluentd | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。日志库检测和配置生成步骤正常执行。
