# 自动化工作流规则（精简版）

## 核心原则
当用户提出开发任务时，**优先使用自动化工作流**而非手动操作。两种触发方式：
- 指令模式（推荐）：`/指令名 [参数]`
- 自然语言模式：用户说"帮我美化前端"等

## 引擎
所有工作流通过 Scene 引擎在 Claude Code 对话内直接执行：
```
识别 → 收集参数 → 检测项目特征 → 弹出增强菜单（CLAUDE.md） → 执行
```

**对话模式优先**：依赖 skill/MCP 工具的命令必须在对话内执行。

## 增强系统

9 个功能已融入增强菜单，对应父工作流自动弹出：
`/qa`（review 前端变更）、`/plan-ceo-review`（feature 长需求）、`/backup` `/docker`（cicd）、`/sbom`（deps）、`/changelog`（release）、`/loadtest`（e2e）、`/log` `/incident`（monitor）、`/migration`（review/feature 检测到 DB）、`/llm-proxy-audit`（hunt）

完整增强规则见 `enhancements.md`。

## 关键工作流（速查）
| 指令 | 场景 | 关键 |
|------|------|------|
| `/ui-polish` | ui-polish | 必须先声明设计系统 |
| `/design` | design | 152 品牌 + 111 模板 + 137 Skill |
| `/review` | review | 5 层审查 + CE |
| `/new-project` | new-project | 完整 + 知识沉淀 |
| `/bugfix` | bugfix | issue → 分支 → 修复 → PR |

完整列表见 `.claude/scenes/` 目录。

## 执行约束
- 工作流目录：`.claude/scenes/<id>.json`
- 命令文件：`.claude/commands/<id>.md`
- 默认路径：`--prompt "<描述>"`
- 失败重试：3 次后询问用户
- 用户确认：3 秒无操作 = 默认勾选
