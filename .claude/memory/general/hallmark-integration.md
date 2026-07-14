---
name: hallmark-integration
description: Nutlope/hallmark v1.1.0 安装到 .claude/skills/hallmark/，106 文件 872KB，与现有 anti-slop-design/CLAUDE.md 集成完毕
metadata:
  type: project
---

# Hallmark Skill 集成

**日期**: 2026-07-14
**版本**: hallmark v1.1.0 (by Nutlope / Together AI)

## 做了什么

1. 将 `Nutlope/hallmark` 完整复制到 `.claude/skills/hallmark/`（106 文件，872KB）
2. 精简 `anti-slop-design.md`：去掉 57 项与 hallmark slop-test 重复的禁止清单，保留 4 维决策框架（密度/变化度/动效/创意度）+ 4 个强调色备选，顶部注明与 hallmark 的分工
3. 更新 `CLAUDE.md` 条件规则表：
   - `/ui-polish` / `/design` 行加入 hallmark skill
   - `/feature` / `/new-project` 行加入 hallmark skill（新页面结构多样化）
   - 新增 hallmark 独立行：`audit`/`redesign`/`study` 三个动词

## 分工

| 职责 | hallmark | anti-slop-design.md |
|------|----------|---------------------|
| 主题/调色板 | 20 主题 + Custom OKLCH | 4 强调色备选（非 hallmark 场景）|
| 禁止项检测 | 57 slop-test 门禁 | 不再重复 |
| 宏观结构 | 9 种 macrostructures | — |
| 密度/变化度/动效/创意度 | — | 4 维 1-10 级别 |
| 设计 DNA 提取 | `study` 动词 | — |
| 审查评分 | `audit` 动词 + pre-emit critique | — |

**Why:** hallmark 的 57 slop-test 门禁比原有的 20 条禁止清单更系统、更全面，且自带 20 主题引擎。保留 anti-slop-design.md 的 4 维决策框架因为它提供了 hallmark 没有的"密度/变化度/动效/创意度"微调控件。

**How to apply:** UI 相关工作流优先触发 hallmark（默认 Design flow → 选主题 → 57 slop-test），然后用 anti-slop-design.md 的 4 维度微调。非 hallmark 场景（轻量改动）直接用 anti-slop-design.md 的强调色。
