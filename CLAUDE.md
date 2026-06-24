# Mix-Coding System

> 本文件 ~60 行全量加载。其余规则按需 Read，默认路径 `.claude/rules/conditional/`。

## 核心规则

写代码前过决策阶梯：YAGNI → 标准库 → 平台原生 → 已安装依赖 → 一行搞定 → 最少代码。

| # | 规则 | 要诀 |
|---|------|------|
| 1 | **YAGNI** | 能用标准库/已安装包就不要写 |
| 2 | **最少代码** | 能一行不写两行，不引入新依赖 |
| 3 | **手术式修改** | 只改必须改的，不顺手重构 |

改之后物理边界：≤ ±50 行 · 0 新依赖 · 复杂度 ≤ 130% · 测试/基准/质量全过（失败自动回滚）。
详见 `conditional/core-rules.md`

**安全底线**：不破坏性 git（reset --hard/push --force/stash clear）除非明确要求 · 不提交密钥 · 推送/发 PR 前确认

## 命名与文件

变量/函数 camelCase · 类/接口 PascalCase · 常量 UPPER_SNAKE_CASE · 文件 kebab-case。
一个文件一个主要导出。测试文件同目录 `*.test.ts`。

## 记忆系统

MemPalace MCP：`mcp__mempalace__search` 查历史，`mcp__mempalace__remember` 保存。验证：`npm run scan:memory`

## 引擎

Scene 引擎在对话内执行工作流。34 个场景。`node src/index.js start <场景ID> --auto [参数]`

## 工作流速查

| 常用 | 说明 | 常用 | 说明 |
|------|------|------|------|
| `/audit` | 全量健康检查 | `/bugfix` | Bug 修复 |
| `/review` | 5 层代码审查 | `/feature` | 新功能开发 |
| `/simplify` | 代码简化 | `/optimize` | 性能优化 |
| `/ui-polish` | 前端美化 | `/design` | AI 辅助 UI 设计 |
| `/refactor` | 重构 | `/new-project` | 新建项目 |
| `/qa` | 浏览器 QA 验证 | `/plan-ceo-review` | 创始人策略审查 |
| `/release` | 发布部署 | `/deps` | 依赖更新 |

执行工作流时 Read `conditional/workflows.md`（完整列表）和 `conditional/enhancements.md`（可选增强规则）。
安全/审计/漏洞工作流额外 Read `conditional/security-toolchain.md`。

## Spec-Driven 开发

`/spec "需求"` → `/design` → `/build`（GitHub Spec-Kit + 5 Agent）。宪法：`constitution.md`。

## 条件规则（按项目特征 Read）

| 触发条件 | Read 文件 |
|----------|----------|
| 移动端项目 (RN/Expo/.apk/.ipa) | `conditional/mobile-coding.md` + `conditional/mobile-security-rules.md` |
| React Web 项目 | `conditional/react-doctor.md` |
| `/ui-polish` / `/design` 工作流 | `conditional/visual-standards.md` + `../od-craft/index.md` |
| 重构/优化 (`/refactor`/`/optimize`) | `conditional/core-rules.md`（完整 CodeGuardian 边界） |
| 自动记忆触发（重要决策/bug/架构） | `conditional/memory-auto-save.md` |

## 执行原则

理解需求 → 收集参数 → 检测特征 → 弹增强菜单 → 执行 → 验证 → 报告。失败重试 3 次。

工作流需在目标项目目录执行 · 删除/覆盖需用户确认 · 保持代码风格一致
