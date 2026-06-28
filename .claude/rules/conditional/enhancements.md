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
| Stagehand | 存在 `@browserbasehq/stagehand` 依赖 | review、bugfix、feature、ui-polish、release、refactor、design、e2e、new-project、monitor |
| mythos-agent | `mythos-agent --version` 成功 | hunt、review、feature、release、bugfix、audit、deps、refactor |
| GEPA | `python -c "import gepa"` 成功 | optimize、loop |
| Critiq | 存在 `@critiq/cli` 依赖 | review、audit、hunt |

## 菜单规则

检测到适用特征时弹菜单，3 秒无操作默认勾选，未检测到不展示。

## 各场景可选增强清单

### `/feature`、`/new-project`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | jvn 多 Agent 审查 — PM + 架构师 + UX + 代码审查 + 宪法校验 | ✓ | 需求 > 50 字 |
| 2 | 迁移审查 — SchemaForge 审查 DB 变更 | ✓ | 检测到数据库 |
| 3 | CEO 策略审查 — 10x 分析 + 精简化 + 用户价值三桶分类（Read `../commands/plan-ceo-review.md`） | ✓ | 需求 > 50 字 |
| 4 | Stagehand 功能验收 — 新功能完整用户流程浏览器自动化验证 | ✓ | 检测到 Stagehand |
| 5 | Stagehand E2E 脚手架 — 自动生成 Stagehand 测试模板 + CI 配置 | — | 检测到 Stagehand（仅 `/new-project`） |
| 6 | mythos-agent 新功能安全审计 — API 端点/文件上传/数据流安全推理 | ✓ | 检测到 mythos-agent |

### `/review`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | 无障碍扫描 — WCAG 合规检查 | ✓ | Web 前端项目 |
| 2 | i18n 审查 — 硬编码字符串/翻译覆盖率 | — | 检测到 i18n |
| 3 | 浏览器 QA 验证 — git diff → 浏览器测试 → Bug 分级报告（Read `../commands/qa.md`） | ✓ | 前端代码变更 |
| 4 | Stagehand 行为验证 — git diff → 受影响页面自动操作验证（自愈选择器，页面改版不中断） | — | 检测到 Stagehand |
| 5 | 迁移审查 — 扫描迁移文件，检测 DROP/NOT NULL 无默认值等危险模式 | ✓ | 检测到数据库 |
| 6 | mythos-agent 安全深度推理 — 基于 diff 推理新攻击面（注入点/数据流/权限绕过） | — | 检测到 mythos-agent |
| 7 | Critiq 确定性安全扫描 — 1,243 条规则 (SQLi/SSRF/路径遍历/反序列化)，零成本秒级 | ✓ | 检测到 Critiq |

### `/release`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | 迁移审查 — SchemaForge dry-run 校验 | ✓ | 检测到数据库 |
| 2 | 上线检查清单 — 监控/日志/回滚方案核验 | — | 始终可选 |
| 3 | 变更日志生成 — 基于 Conventional Commits 生成 CHANGELOG.md | ✓ | 始终可选 |
| 4 | Stagehand 发布前冒烟 — 关键路径浏览器自动化验证，任一失败阻断发布 | — | 检测到 Stagehand |
| 5 | mythos-agent 发布安全门禁 — 假设驱动全量扫描，不通过则阻断 | — | 检测到 mythos-agent |

### `/cicd`

- Docker 化 — 自动检测语言，生成多阶段 Dockerfile + .dockerignore + docker-compose.yml（始终可选）
- 备份配置 — 生成 Restic 加密去重备份脚本及排除规则（始终可选）

### `/deps`

- SBOM 生成 — CycloneDX 物料清单 + 许可证合规报告（GPL/AGPL 检测，始终可选）
- mythos-agent CVE 可利用性分析 — 判断已知 CVE 是否真正到达受影响代码路径（检测到 mythos-agent 时可选）

### `/monitor`

- 日志配置 — 检测日志库，生成结构化日志配置 + ELK/Fluentd 采集（始终可选）
- Incident Runbook — 生成 Runme 可执行 runbook（健康检查 + 升级路径，始终可选）
- Stagehand 合成监控 — 定时跑关键路径浏览器验证，失败告警（检测到 Stagehand 时可选）

### `/hunt`

- LLM 代理审计 — 三层防线检测工具调用注入（LobsterTrap + AgentShield + egress-bench，默认启用）
- mythos-agent 假设驱动扫描 — AI 推理未知漏洞 + 变量分析 + PoC 生成，与三层防线组成四层（检测到 mythos-agent 时默认启用）
- Critiq 确定性漏洞扫描 — SQLi/SSRF/路径遍历/不安全反序列化/硬编码密钥（检测到 Critiq 时默认启用）

### `/optimize`

- GEPA prompt 进化 — LLM 反思执行轨迹 → Pareto 进化搜索 → 自动优化场景 prompt（检测到 GEPA 时默认启用，需配置评估指标）

### `/loop`

- GEPA 自进化模式 — 每轮自动评估 → GEPA 优化 prompt → 下一轮跑优化后 prompt，循环至收敛（检测到 GEPA 时默认启用，需配置评估指标）

### `/e2e`

- 负载测试 — Artillery smoke/load/stress 三级测试作为 CI 门禁（始终可选）
- Stagehand 功能性测试 — act/extract/observe 验证用户关键路径（检测到 Stagehand 时默认启用）

### `/audit`、`/refactor`

- 架构深度审计 — 分层合规 + 复杂度热点图（始终可选）
- Stagehand 行为回归 — 重构前后浏览器功能一致性验证（检测到 Stagehand 时默认启用）
- mythos-agent 安全审计 — 假设驱动全库扫描 + 数据流变化推理（检测到 mythos-agent 时默认启用）
- Critiq 全量安全审计 — 9 语言 21 类别 1,243 条确定性规则 + secret 专项扫描（检测到 Critiq 时默认启用）

### `/bugfix`

- Stagehand 浏览器复现闭环 — 自然语言描述 → 浏览器复现 → 修复 → 再验证确认消失（检测到 Stagehand 时默认启用）
- mythos-agent 同根因排查 — 修了一个漏洞后，变量分析扫描全库同类模式（检测到 mythos-agent 时默认启用）

### `/ui-polish`

- Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则（默认启用）
- Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality（默认启用，需 Web 前端项目）
- Stagehand 交互完整性校验 — 美化后确认 hover/click/focus/modal 未损坏（检测到 Stagehand 时默认启用）

### `/design`

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | Huashu Brand Protocol — 品牌提及检测→资产清单 | ✓ | 品牌提及 |
| 2 | Huashu 5 维度专家评审 | ✓ | Web 前端项目 |
| 3 | Impeccable 设计打磨 | ✓ | 始终可选 |
| 4 | Stagehand 响应式校验 — desktop/tablet/mobile 多视口自动截图对比 | — | 检测到 Stagehand |

## 无增强场景

以下场景无可选增强，直接执行核心工作流：
`analyze`、`check`、`mobile-audit`、`mobile-e2e`、`mobile-onboard`、`mobile-optimize`、`mobile-release`、`mobile-review`、`onboard`、`plan-ceo-review`、`qa`、`rollback`、`simplify`
