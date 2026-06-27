# 可选增强规则（精简版）

执行工作流前自动检测项目特征，弹可选增强菜单。3秒无操作默认勾选，未检测到不展示。完整版见 `enhancements.md`。

## 检测→场景映射

| 检测项 | 方式 | 场景 |
|--------|------|------|
| Web前端 | `*.tsx`/`*.jsx`+`package.json` | review, ui-polish |
| 前端变更 | git diff含.tsx/.jsx/.vue | review |
| 数据库 | `migrations/`/`prisma/`/`*.sql` | feature, release, review |
| 需求>50字 | — | feature, new-project |
| i18n | i18n配置/locale/ | review |
| Stagehand | `@browserbasehq/stagehand` | 10场景 |
| mythos-agent | CLI可用 | 8场景 |
| GEPA | `import gepa` | optimize, loop |
| Critiq | `@critiq/cli` | review, audit, hunt |

## 各场景增强菜单（选项/默认/条件）

**feature/new-project**: jvn多Agent审查✓(>50字) · 迁移审查✓(DB) · CEO策略审查✓(>50字) · Stagehand功能验收✓(Stagehand) · Stagehand E2E脚手架(Stagehand+new-project) · mythos安全审计✓(mythos)

**review**: 无障碍✓(Web) · i18n(i18n) · QA验证✓(前端变更) · Stagehand行为(Stagehand) · 迁移审查✓(DB) · mythos安全推理(mythos) · Critiq✓(Critiq)

**release**: 迁移审查✓(DB) · 上线清单 · 变更日志✓ · Stagehand冒烟(Stagehand) · mythos发布门禁(mythos)

**cicd**: Docker化 · 备份配置

**deps**: SBOM生成 · mythos CVE分析(mythos)

**monitor**: 日志配置 · Incident Runbook · Stagehand合成监控(Stagehand)

**hunt**: LLM代理审计✓ · mythos假设驱动扫描✓(mythos) · Critiq漏洞扫描✓(Critiq)

**optimize**: GEPA prompt进化✓(GEPA)

**loop**: GEPA自进化✓(GEPA)

**e2e**: 负载测试 · Stagehand功能测试✓(Stagehand)

**audit/refactor**: 架构深度审计 · Stagehand行为回归✓(Stagehand) · mythos安全审计✓(mythos) · Critiq全量审计✓(Critiq)

**bugfix**: Stagehand浏览器复现✓(Stagehand) · mythos同根因排查✓(mythos)

**ui-polish**: Impeccable打磨✓ · Huashu评审✓(Web) · Stagehand交互校验(Stagehand)

**design**: Huashu Brand Protocol✓(品牌提及) · Huashu评审✓(Web) · Impeccable打磨✓ · Stagehand响应式(Stagehand)

## 无增强场景

`analyze` `mobile-audit` `mobile-e2e` `mobile-onboard` `mobile-optimize` `mobile-release` `mobile-review` `onboard` `plan-ceo-review` `qa` `rollback` `simplify`
