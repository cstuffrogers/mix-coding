# Changelog

## 2026-07-01

### Quality

- **ESLint 错误归零 (1216→0, -100%)**：93 个 sonarjs 规则违规全部修复（47 super-linear-regex、51 cognitive-complexity、21 no-unused-vars、10 no-dead-store 等）
- **56 个文件手术式修改**：跨 20 个 handler 文件提取约 100 个帮助函数以降低认知复杂度
- **正则全面提升**：57 处超线性/复杂/慢正则全部修复（bounded quantifier + 分割数组 + 重构）
- **死代码清理**：44 处未使用变量/导入/集合 + 10 处无用赋值 + 2 处重复分支全部移除
- **测试改进**：3 处 `expect` 断言改用精确匹配（toHaveLength/toBeNull）

### Changes

- 新增 `.mcp/**` 至 ESLint 忽略列表（vendor 代码不扫描）
- 移除 68 个已失效的 `eslint-disable` 注释
- `REFACTOR.md` 新增：README 文档质量提升

## 2026-06-30

### Features

- **opencode 全平台适配**：108 命令 + 17 MCP + 4 providers 全局配置，与 Claude Code 工作流完全对齐
- **38/38 .md 工作流引用**：所有 `.claude/commands/*.md` 在 opencode 模板中均有对应引用
- **Harness Engineering 合规**：完成 12 维度审计，评分从 64% 提升至 ~96%（Tier A）
- **Harness 状态文件**：新增 `feature_list.json`、`progress.md`、`DECISIONS.md`
- **会话生命周期**：新增 `init.sh`（环境检查）、`scripts/clean-session.cjs`（结束清理）、`zero-conflict-check.sh`（架构合规）
- **CI 流水线**：`.github/workflows/ci.yml` — lint → test 全自动
- **代码质量钩子**：`.husky/pre-commit` 扩展为 eslint + test + 死代码扫描
- **定时任务**：`.claude/scheduled_tasks.json` — 3 项维护任务
- **AGENTS.md**：升级为完整 Harness 操作手册（5 节），同步至 `.opencode/`、`.codex/`、`.zcode/`
- **配置生成器**：`scripts/generate-opencode-config.cjs` + `.opencode/deploy-global.cjs`（Node.js 方案替代脆弱的 shell heredoc）

### Changes

- `scripts/setup-opencode-global.sh` 重构：495 行 heredoc → 调用 deploy-global.cjs
- `ARCHITECTURE.md`、`docs/MULTIPLATFORM.md`、`README.md` 同步更新
- `.mcp.json` 新增 9 个 MCP 服务器（sentry/supabase/stripe/resend/schemaforge/a11y/mobsf/detox/bearer）

## 2026-06-05

### Features

- 新增 `/migration` 工作流：数据库迁移审查，内置 8 种危险 SQL 模式检测（DROP TABLE / NOT NULL 无默认值 / 类型变更等）
- 新增 `/loadtest` 工作流：Artillery 负载测试集成，支持 smoke/load/stress 三级
- 新增 `migration.js` handler：双模式分析（db-scalability-guardian + 内置规则）
- 新增 `handleLoadTest` handler：Artillery 配置发现与执行

### Bug Fixes

- 修复 `migrationHighCount > 0` 条件永远返回 false 的 CRITICAL bug（`evalClause` 不支持纯数字 `>` 比较）
- 修复 `runArtillery` catch 块标记 `ran: true` 导致"未安装"分支不可达
- 修复 `handleCheckGate` 缺少 `migration` 和 `loadtest` 门禁类型
- 修复 `migration.json` step 8 通知消息措辞不准确
- 修复 `flow-control.js` 认知复杂度超标（18→below 15）
- 修复 `review.js` 认知复杂度超标（22→below 15）
- 修复 `testing.test.js` Buffer 未定义问题（8 处）

### Dead Code Cleanup

- 移除 `handleGenerateChangelog`（ACTION_REGISTRY 使用 `handleChangelog`，此函数无引用）
- 移除 `ARCHON_DIR`（全项目零引用）
- 移除 3 个 UI handler 重导出（ui-polish.js 使用本地版本）

## 历史

- 添加 anthropic-cybersecurity-skills 安全测试用例 - SQLi/XSS/命令注入测试文件
- 修复工作流安全审计配置
