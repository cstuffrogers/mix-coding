---
description: 创建功能规格（spec-kit 流程：specify → clarify → plan → tasks）
argument-hint: "<要做什么>"
---

按 spec-kit 流程产出功能规格。pi 里没有 Claude Code 的 `Skill(...)` / `Task(...)` 调用 ——
技能就是 Markdown 文档，读它并照做；子代理用 `subagent` 工具。

## 输入

```text
$ARGUMENTS
```

## 步骤

1. **规格**：读 `.claude/skills/speckit-specify/SKILL.md`，按其步骤执行。
   产出：`specs/NNN-short-name/` 目录 + 基础 `spec.md`。记下 spec 路径。
2. **澄清（有歧义时）**：读 `.claude/skills/speckit-clarify/SKILL.md`，最多 5 个问题，
   答案写回同一份 spec。
3. **计划**：读 `.claude/skills/speckit-plan/SKILL.md`。
4. **拆任务**：读 `.claude/skills/speckit-tasks/SKILL.md`。
5. **一致性**：`speckit-analyze` 检查 spec/plan/tasks 是否互相矛盾。

需要产品或 UX 视角补充时，用 `subagent` 工具派一个子代理读同一份 spec 后追加章节，
不要自己臆造章节。

## 汇报

- spec 路径 + 关键用户故事
- 遗留的 `[NEEDS CLARIFICATION]` 标记
- 下一步：`/speckit-implement`（有 tasks.md 后）或先澄清
