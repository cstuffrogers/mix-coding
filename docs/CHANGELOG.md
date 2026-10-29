# Changelog

## 2026-07-01

### Fixed

- **场景真值曾经有两份，校验器各读一份**：`.claude/scenes/*.json`（项目覆盖层）与 `claude-scene/scenes/*.json`（随包内置）26 个文件相同，引擎跑的是覆盖层，而 `check-readme-stats` / `check-action-stats` / `check-doc-counts` / `check-tool-steps` 读的却是内置那份。实测往覆盖层加一步（运行时 43→44 步），`check-readme-stats` 仍报「583 步…全部对得上」。现新增 `scripts/lib/scene-dir.cjs`（`sceneTiers()` / `resolveScenes()`，层顺序与引擎 `getSceneDirs()` 一致、同名覆盖层优先），七个脚本全部改用它；README 校验器的「真值」行会打印这次读的是哪几层。
- **`scan-scenes.cjs` 的输入也换成同一视图**：默认从运行时视图统计（覆盖层优先），两份副本分叉时不会再数错「哪一份才是真在跑的」。
- **pre-commit 新增第四道门禁**：提交前重跑 `scan-scenes.cjs`，若 `scripts/scenes-stats.json` 与场景文件不同步则拦截（陈旧产物不许落地）。此前没有任何环节重跑它。

### Added

- **`claude-scene/src/commands/scene-dir.test.js`（13 例）**：层顺序四态（只有内置 / 只有覆盖层 / 两层 / 两层皆空 + `MIX_CODING_SCENES_DIR` 显式覆盖）、真仓库两份副本逐字节相同守卫（自探针：改一个字节即红）、「校验器读的目录 == 引擎 `resolveScenePath()` 返回的目录」、「覆盖层写 4 步 / 内置 3 步时文档必须按 4 步校验」的回归用例、以及「凡读场景的脚本必须 require `scene-dir.cjs`」的静态守卫。
- `DECISIONS.md` 新增 ADR-022（场景真值的唯一定义 + 为什么是合并而不是只读覆盖层）。

### Removed

- **opencode 支持退役**：删除 `.opencode/`（`deploy-global.cjs` / `opencode.jsonc` / `AGENTS.md`）、`scripts/generate-opencode-config.cjs`、`scripts/setup-opencode-global.sh`、`scripts/check-opencode-config.cjs` 及其测试。此前这套「全局配置生成器 + 部署脚本 + 校验器」是纯维护负担：模板里的文件名与步骤数反复与仓库真值漂移，而该平台已不再使用。`platform.js` 保留 `OPENCODE=1` 识别（仅为行为可预期），不再提供任何 opencode 专属配置。
- 同步删除 `scripts/scenes-stats-utf8.txt`、`claude-scene/.express-sec-audit-cache.json` 两个陈旧产物，并在 `.gitignore` 拦住复活。
- **退役命令的残留引用清理**：`.pi/skills/scene-runner/SKILL.md`、`.claude/commands/review.md`、`AGENTS.md`、`.codex/AGENTS.md`、`.zcode/AGENTS.md`、README 使用示例里把 `/hunt` `/e2e` `/monitor` `/analyze` `/audit` 当现存命令的写法全部改掉（改成 `/review` / `/setup` 或明确标「旧名」）。
- **`lib/enhancements.js` 删掉 8 个死增强分组**：`audit` `analyze` `hunt` `monitor` `e2e` `design` `prototype` `changelog`。`applyEnhancements` 按 `REGISTRY[sceneId]` 查表，这些场景 JSON 都不存在 → 对应增强项永远不会出现在菜单里，是纯死配置（`ENHANCEMENT_KEYS` 也跟着少 8 个键）。
- **`.claude/rules/conditional/enhancements.md` 按 `REGISTRY` 重写**：删掉 `/cicd`、`/setup --kind monitor`、`/review 安全深度`、`/setup --kind e2e`、`/design` 五节（都是死分组），清单改为逐项列出 code 里的 `key` + `label` + 默认值，探测器表只留真正被引用的 4 个。

### Fixed

- **README 外部工具表「负责工作流」列长期在编数字**：写着 `/review` (step 4.10) / (step 4.12) / (step 4.15) / (step 3) 等，`review.json` 里根本没有这些 `step`；整列还指向 `/audit` `/hunt` `/e2e` 这些已删场景。现按 scene JSON 真值重写（如 recheck-cli 4.1、log-sanitizer 4.3、sensitive-file-check 4.55、seraphim-audit 4.56、jscpd 2.95、size-limit 2.96、Stryker qa@6.5），没有 handler 或没有场景步骤调用的工具（trivy / shellcheck / sqlfluff / bruno / commitlint / biome / ruff / hurl / lychee / Spectral / markdownlint）改标「未接入」，不再宣称自动执行。
- **新增 `scripts/check-tool-steps.cjs`**：校验三份文档（README.md / README_EN.md / `.claude/rules/conditional/security-toolchain.md`）工具表里每个 `` `/scene` (step N) `` 的场景存在且 `N ∈ flow[*].step`；退役场景、幽灵场景、编的步骤号一律 exit 1，表结构/引用格式变了 exit 2。
- **新增 `retired-commands.test.js` 守卫**：活的文档里退役命令必须以「旧名/已合并/已并入/退役/已删除/原」标注；增强项文档与 `REGISTRY` 一一对应；`REGISTRY` 的每个分组必须挂在真实场景上。

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

- **opencode 全平台适配**：命令 + MCP + Provider 全局配置（数量由 `.opencode/deploy-global.cjs` 生成时统计，不在文档里写死），与 Claude Code 工作流对齐
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
