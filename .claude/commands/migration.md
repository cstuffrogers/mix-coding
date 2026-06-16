---
description: Review database migration files: detect dangerous operations (DROP/NOT NULL without DEFAULT/type changes). 10-step workflow with CRITICAL/HIGH/MEDIUM severity classification.
argument-hint: "[path]"
---

# /migration — 数据库迁移审查

10 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 迁移文件识别 → 危险模式检测 → 修复建议**

## Usage

```text
/migration                        # 审查当前项目迁移文件
/migration migrations/            # 审查指定目录
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦数据库安全/数据完整性项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 列出数据库迁移相关 issues
3. **Context7 MCP** (`step 2`) — 获取数据库迁移最佳实践文档

### Phase 2: 迁移审查

- **identifyFiles** (`step 3`) — 扫描迁移目录（migrations/prisma/drizzle/supabase）
- **runAnalysis** (`step 4`) — 运行危险模式检测
  - **CRITICAL**: DROP TABLE / TRUNCATE / NOT NULL without DEFAULT
  - **HIGH**: DROP COLUMN / 类型变更
  - **MEDIUM**: RENAME COLUMN / ADD FOREIGN KEY
- **suggestFixes** (`step 5`) — 为可修复项生成安全替代方案

### Phase 3: 沉淀

- **ce-compound** (`step 6`) — 迁移审查知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 分析 | 内建模式扫描 + db-scalability-guardian（可选） | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。迁移文件扫描和危险模式检测正常执行。
