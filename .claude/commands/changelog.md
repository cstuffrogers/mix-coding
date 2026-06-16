---
description: Auto-generate or update CHANGELOG.md from Git commit history using Conventional Commits specification. 10-step workflow.
---

# /changelog — 变更日志

10 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 提交分析 → CHANGELOG 生成 → 验证**

## Usage

```text
/changelog
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦版本管理/文档完整性项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取现有 CHANGELOG 和 release tags

### Phase 2: CHANGELOG 生成

- **analyzeCommits** (`step 2`) — 解析 Conventional Commits 格式提交历史
- **classifyChanges** (`step 3`) — 分类：Features / Bug Fixes / Breaking Changes / Docs
- **generateChangelog** (`step 4`) — 生成或更新 CHANGELOG.md
- **validateFormat** (`step 5`) — 验证 Keep a Changelog 格式规范

### Phase 3: 沉淀

- **ce-compound** (`step 6`) — 版本管理知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| 分析 | Git + Conventional Commits | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。提交分析和 CHANGELOG 生成步骤正常执行。
