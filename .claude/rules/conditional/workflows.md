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

## 可选增强检测
| 检测项 | 检测方式 | 适用 |
|--------|---------|------|
| Web 前端 | `*.tsx`/`*.jsx`/`*.html` | review、ui-polish |
| 数据库 | migrations/schema.* | feature、release |
| 需求 > 50 字 | 描述长度 | feature、new-project |
| i18n | locale/ 目录 | review |

无适用增强时**不弹菜单**。

## 关键工作流（速查）
| 指令 | 场景 | 关键 |
|------|------|------|
| `/ui-polish` | ui-polish | 必须先声明设计系统 |
| `/design` | design | 152 品牌 + 111 模板 + 137 Skill |
| `/review` | review | 5 层审查 + CE |
| `/qa` | qa | 浏览器 QA 验证 + Bug 报告 |
| `/plan-ceo-review` | plan-ceo-review | 创始人策略审查：10x + 精简 + 用户价值 |
| `/new-project` | new-project | 完整 + 知识沉淀 |
| `/bugfix` | bugfix | issue → 分支 → 修复 → PR |

完整列表见 `.claude/scenes/` 目录。

## 执行约束
- 工作流目录：`.claude/scenes/<id>.json`
- 命令文件：`.claude/commands/<id>.md`
- 默认路径：`--prompt "<描述>"`
- 失败重试：3 次后询问用户
- 用户确认：3 秒无操作 = 默认勾选
