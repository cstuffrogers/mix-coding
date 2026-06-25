# 可选增强规则

执行工作流之前，**自动检测项目特征**，对适用的场景弹出可选增强菜单。不适用则不显示。

## 检测规则

| 检测项 | 检测方式 | 适用场景 |
|--------|---------|---------|
| Web 前端项目 | 存在 `*.tsx`/`*.jsx`/`*.html` + `package.json` | review、ui-polish |
| 前端代码变更 | `git diff --name-only` 含 .tsx/.jsx/.vue/.html/.css | review |
| 数据库 | 存在 `migrations/`、`schema.*`、`prisma/`、`drizzle/`、`*.sql` | feature、release、review |
| 需求复杂度 | 用户描述 > 50 字 | feature、new-project |
| i18n 多语言 | 存在 i18n 配置、locale/ 目录 | review |

## 菜单规则

检测到适用特征时弹菜单，3 秒无操作默认勾选，未检测到不展示。

## 各场景可选增强清单

### `/feature`、`/new-project`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | jvn 多 Agent 审查 — PM + 架构师 + UX + 代码审查 + 宪法校验 | ✓ | 需求 > 50 字 |
| 2 | 迁移审查 — SchemaForge 审查 DB 变更 | ✓ | 检测到数据库 |
| 3 | CEO 策略审查 — 10x 分析 + 精简化 + 用户价值三桶分类（Read `../commands/plan-ceo-review.md`） | ✓ | 需求 > 50 字 |

### `/review`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | 无障碍扫描 — WCAG 合规检查 | ✓ | Web 前端项目 |
| 2 | i18n 审查 — 硬编码字符串/翻译覆盖率 | — | 检测到 i18n |
| 3 | 浏览器 QA 验证 — git diff → 浏览器测试 → Bug 分级报告（Read `../commands/qa.md`） | ✓ | 前端代码变更 |
| 4 | 迁移审查 — 扫描迁移文件，检测 DROP/NOT NULL 无默认值等危险模式 | ✓ | 检测到数据库 |

### `/release`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | 迁移审查 — SchemaForge dry-run 校验 | ✓ | 检测到数据库 |
| 2 | 上线检查清单 — 监控/日志/回滚方案核验 | — | 始终可选 |
| 3 | 变更日志生成 — 基于 Conventional Commits 生成 CHANGELOG.md | ✓ | 始终可选 |

### `/cicd`

- Docker 化 — 自动检测语言，生成多阶段 Dockerfile + .dockerignore + docker-compose.yml（始终可选）
- 备份配置 — 生成 Restic 加密去重备份脚本及排除规则（始终可选）

### `/deps`

- SBOM 生成 — CycloneDX 物料清单 + 许可证合规报告（GPL/AGPL 检测，始终可选）

### `/monitor`

- 日志配置 — 检测日志库，生成结构化日志配置 + ELK/Fluentd 采集（始终可选）
- Incident Runbook — 生成 Runme 可执行 runbook（健康检查 + 升级路径，始终可选）

### `/hunt`

- LLM 代理审计 — 三层防线检测工具调用注入（LobsterTrap + AgentShield + egress-bench，默认启用）

### `/e2e`

- 负载测试 — Artillery smoke/load/stress 三级测试作为 CI 门禁（始终可选）

### `/audit`、`/refactor`

- 架构深度审计 — 分层合规 + 复杂度热点图（始终可选）

### `/ui-polish`

- Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则（默认启用）
- Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality（默认启用，需 Web 前端项目）

### `/design`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | Huashu Brand Protocol — 品牌提及检测→资产清单 | ✓ | 品牌提及 |
| 2 | Huashu 5 维度专家评审 | ✓ | Web 前端项目 |
| 3 | Impeccable 设计打磨 | ✓ | 始终可选 |

## 无增强场景

以下场景无可选增强，直接执行核心工作流：
`analyze`、`bugfix`、`loop`、`mobile-audit`、`mobile-e2e`、`mobile-onboard`、`mobile-optimize`、`mobile-release`、`mobile-review`、`onboard`、`optimize`、`plan-ceo-review`、`qa`、`rollback`、`simplify`
