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
一个文件一个主要导出。测试文件同目录 `*.test.js`。

## 记忆系统

Claude Code auto-memory（`~/.claude/.../memory/` + MEMORY.md 索引）：用户画像/偏好/项目事实，自动保存。会话内规划用 `plan.md`/`findings.md`/`progress.md`（详见 `conditional/planning-with-files.md`）。

## 引擎

Scene 引擎在对话内执行工作流。27 个场景。`node src/index.js start <场景ID> --auto [参数]`

## 工作流速查

| 常用 | 说明 | 常用 | 说明 |
|------|------|------|------|
| `/review` | 代码审查（含审计/分析） | `/bugfix` | Bug 修复 |
| `/refactor` | 重构 + 简化 | `/feature` | 新功能开发 |
| `/ui-polish` | 前端美化 + 设计 | `/optimize` | 性能优化 |
| `/hunt` | 安全漏洞扫描 | `/new-project` | 新建项目 |
| `/release` | 发布部署 | `/deps` | 依赖更新 |
| `/check` | 引擎自检+自愈 | `/plan` | Manus 持久规划 |
| `/enhance-prompt` | UI prompt 精炼 | — | — |

> **交互式模式选择**：`/review` `/ui-polish` `/refactor` 启动时弹出勾选菜单，3秒无操作使用默认。
>
> 已融入增强：`/qa`（前端验证）、`/plan-ceo-review`（策略审查）、`/backup` `/docker`（cicd）、`/sbom`（deps）、`/changelog`（release）、`/loadtest`（e2e）、`/migration`（DB）、`/llm-proxy-audit`（hunt）。
>
> 增强工具：`Stagehand`（浏览器测试）、`mythos-agent`（安全扫描）、`GEPA`（prompt 进化）、`Critiq`（安全规则）。

执行工作流时 Read `conditional/workflows.md`（完整列表）和 `conditional/enhancements-summary.md`（可选增强规则，精简版）。
安全/审计/漏洞工作流额外 Read `conditional/security-toolchain.md`。

## Spec-Driven 开发

`/spec "需求"` → `/plan` → `/build`（GitHub Spec-Kit + 5 Agent）。宪法：`constitution.md`。

### 融合文件结构（Spec-Kit + planning-with-files）

| 文件 | 用途 | 更新时机 |
|------|------|----------|
| `spec.md` | 需求规格 | 需求变更时 |
| `plan.md` | 阶段规划 + 进度 | 每阶段完成后 |
| `tasks.md` | 任务分解 | 任务状态变更时 |
| `findings.md` | 研究/发现 | 任何发现后（2-Action Rule） |
| `progress.md` | 会话日志 | 贯计更新 |

**规划规则**：`/plan` 工作流自动 Read `conditional/planning-with-files.md`。

**会话恢复**：`/clear` 后运行 `python .claude/scripts/session-catchup.py "$(pwd)"`

## 条件规则（按项目特征 Read）

| 触发条件 | Read 文件 |
|----------|----------|
| 移动端项目 (RN/Expo/.apk/.ipa) | `conditional/mobile-coding.md` + `conditional/mobile-security-rules.md` |
| React Web 项目 | `conditional/react-doctor.md` |
| `/ui-polish` / `/design` 工作流 | `conditional/visual-standards.md` + `conditional/anti-slop-design.md` + `../od-craft/index.md` + **hallmark skill**（20 主题 + 57 slop-test + 9 宏观结构） |
| 重构/优化 (`/refactor`/`/optimize`) | `conditional/core-rules.md`（完整 CodeGuardian 边界） |
| 自动记忆触发（重要决策/bug/架构） | `conditional/memory-auto-save.md` |
| `/plan` 工作流或复杂任务 (≥3步) | `conditional/planning-with-files.md` |
| `/feature` / `/new-project` 多页站点 | `conditional/baton-loop.md`（baton 接力模式） + **hallmark skill**（新页面结构多样化） |
| 模糊 UI 需求 / prompt 优化 | `/enhance-prompt`（UI 想法精炼器） |
| hallmark 审计/重构/设计提取 | **hallmark skill** — `audit`（评分+punch list）、`redesign`（保留IA重建视觉）、`study`（截图/URL→DNA→design.md） |
| `/deps` 依赖更新 | `docs/tool-versions.md`（工具版本与更新记录 — 对比上游判断要不要更新 + 更新后写日志） |

## 执行原则

理解需求 → 收集参数 → 检测特征 → 弹增强菜单 → 执行 → 验证 → 报告。失败重试 3 次。

**Post-edit 验证**：每次代码 edit 后必须立即跑验证命令（`npm test` / `npx eslint .` 等），不得连续多次 edit 后才批量验证。交付前报告"变更 + 验证命令 + 验证结果"三元组。

工作流需在目标项目目录执行 · 删除/覆盖需用户确认 · 保持代码风格一致

## 多平台支持

本项目同时支持 Claude Code、opencode、Codex、ZCode 四个平台。配置目录互不冲突：

| 平台 | 配置目录 | 入口文件 | 环境变量 |
|------|---------|---------|---------|
| Claude Code | `.claude/` | `CLAUDE.md` | `CLAUDECODE=1` |
| opencode | `.opencode/` + `opencode.jsonc` | `AGENTS.md` → `CLAUDE.md` | `OPENCODE=1` |
| Codex | `.codex/` | `AGENTS.md` → `CLAUDE.md` | `CODEX=1` |
| ZCode | `.zcode/` | (待填充) | `ZCODE=1` |

共享场景/skills/规则/记忆统一在 `.claude/`。各平台专属配置（命令格式、MCP 配置）在各自目录。
详见 `MULTIPLATFORM.md`。
