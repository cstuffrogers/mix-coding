# NOTICE — landing-page-design

本目录的 `SKILL.md` 来自第三方开源仓库，**不是**本仓库（Mix-Coding System，
Elastic License 2.0）的原创内容。

| 项 | 值 |
|---|---|
| 上游 | https://github.com/elayadesign/ai-design-skills |
| 路径 | `skills/landing-page-design/SKILL.md` |
| 版本 | commit `ded7efc`（2026-10-30 取） |
| 作者 | Elaya (elayadesign) |
| 许可 | **MIT**（见同目录 `LICENSE`，版权行保留原样） |
| 再上游 | 部分内容改编自 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)（MIT），署名见上游 SKILL.md 的 Credits 段 |

## 本地改动（为可追溯而列全）

1. **frontmatter `description` 收窄**：上游写的是「任何落地页/组件都先查本文件」，
   与本项目的品牌预设工作流（awesome-design-md / Liquid Glass 接管调色板与字体）冲突。
   收窄为「构建或审查落地页/营销页时使用」，并把裁决指向文末附录。
2. **文末追加**「本项目集成约定」附录 —— 五个 skill 同场时的优先级。
3. **换行统一 LF**（上游仓库是 LF，Windows clone 会变 CRLF）。

正文（Part A / Part B / Output format / Quick checklist / Credits）**一字未改**。

## 许可边界

MIT 不是 CC BY-SA：本目录**不受**本仓库 Elastic License 约束，也不需要按
`property-based-testing` 等 Trail of Bits 目录那样声明 CC BY-SA 4.0。
两份声明不可互换 —— `skill-runner.test.js` 对两类目录分别断言。
