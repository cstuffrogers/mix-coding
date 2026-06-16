---
description: Configure encrypted deduplicated backups with Restic: generate backup script, exclusion rules, and scheduled task. 9-step workflow.
---

# /backup — 备份配置

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → Restic 配置 → 备份脚本 → 排除规则**

## Usage

```text
/backup
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦数据安全/敏感文件/环境变量保护项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 检查 .gitignore 和项目结构

### Phase 2: 备份配置

- **detectProject** (`step 2`) — 分析项目文件结构，识别需备份目录
- **generateResticConfig** (`step 3`) — 生成 Restic 配置（仓库/密码/保留策略）
- **generateScript** (`step 4`) — 生成备份脚本（加密去重）
- **generateExclusions** (`step 5`) — 生成排除规则（node_modules/build/.git）

### Phase 3: 沉淀

- **ce-compound** (`step 6`) — 备份配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| 备份 | Restic | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。备份配置生成步骤正常执行。
