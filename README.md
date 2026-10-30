# 🚀 Mix-Coding System — 快速入门指南

本指南帮助您在 5 分钟内启动并使用全自动代码开发系统。
适合非专业技术人员全自动开发，集成了GitHub中最热门的开发项目，高效无冲突。
---

## 📦 系统概览

这是一个基于 **三层架构 + Scene 引擎** 的智能开发系统，支持：

- ✅ **26 个自动化工作流**：覆盖 Web 前端（20 个）+ 移动端（6 个），含代码审查、安全扫描、性能优化、设施搭建、发布部署、环境搭建、引擎自检、UI prompt 精炼等。另有 9 个历史功能已不再是独立工作流：`changelog` 并入 `/release`（与 `/mobile-release`）、日志脱敏并入 `/review`；backup / docker / sbom / loadtest / incident / migration / llm-proxy-audit 只注册了动作、没有任何场景步骤会调用它们（**不可达**，已登记债务，见 `docs/CHANGELOG.md` 第三十四轮）
- ✅ **交互式模式选择**：`/review`、`/refactor`、`/ui-polish` 启动时弹出勾选菜单，3秒无操作使用默认
- ✅ **多轮自动审查与修复**：直到问题清零
- ✅ **AI 驱动设计**：Open Design 集成（设计系统 catalogs + 设计模板 + skill / craft 设计铁律 + 设备框 + prompt 模板），零设计门槛 —— 前提是本地 clone 了 `open-design/`（该目录已 gitignore，不在仓库内，`/ui-polish` 与 `/new-project` 会用；缺失时按提示 clone）
- ✅ **前端美化工具链**：DaisyUI（35+主题）+ Animal Island UI（自然风格）+ Animate.css + Lucide React + Playwright + Impeccable 全维度设计打磨（shape 设计简报 + 27 条反AI模式规则 + 12 条 LLM 批判规则 + 双轮品控 + 3 项精准残留修复）+ web-design-engineer Skill（OKLCH 色彩系统 + 反AI套路规则 + 设计基准声明，所有模式必须执行）+ **hallmark Skill（20 主题 + 57 slop-test 门禁 + 9 种宏观结构 + 4 动词：build/audit/redesign/study）**+ anti-slop 反套娃设计标准（4 维决策框架 + 与 hallmark 互补分工）
- ✅ **5 层代码审查**：ESLint（1216→0 错误归零）+ TypeScript + 安全扫描 + npm audit + AI 语义 + Handler 功能验证（10 Pass 空转桩检测）
- ✅ **数据库迁移审查**：扫描迁移文件，检测 8 种危险模式（DROP TABLE / NOT NULL 无默认值等），自动阻断高风险变更
- ✅ **负载测试**：Artillery 集成，smoke/load/stress 三级测试，性能门禁
- ✅ **浏览器功能测试**：Stagehand 集成，act/extract/observe API + 自愈选择器，AI 驱动用户关键路径验证（10 个工作流可选增强）
- ✅ **安全漏洞扫描**：ESLint 安全规则 + OWASP Top-10 + npm audit 依赖审计 + mythos-agent 假设驱动推理（变量分析 + PoC 生成，8 个工作流可选增强）+ 安全响应头扫描 + 构建泄露检测 + 死链检测 + 开放重定向检测 + 状态管理审计 + 正则 ReDoS 扫描 + 日志脱敏 + CORS 检查 + 敏感文件检查 + 供应链安全扫描
- ✅ **外部安全工具链**：33 个工具（noleak / seraphim-audit / lychee / pa11y-ci / recheck-cli / log-sanitizer / cors-checker / env-var-leak / prototype-pollution / sensitive-file-check / deprecated-deps / knip / skillspector / aislop / dependency-cruiser / Lighthouse CI / jscpd / size-limit / Stryker / Spectral / markdownlint / codeguardian / critiq / trivy / shellcheck / sqlfluff / bruno / gitleaks / semgrep / commitlint / biome / ruff / hurl）— JS/TS lint+format / Python lint+format / API 测试 / 容器/文件系统/IaC 安全扫描 + Git 历史密钥检测 + 多语言 AST 级 SAST + Commit 规范校验 + Shell 脚本分析 + SQL lint + API 交互测试 + 确定性安全规则扫描（1,243 条规则 9 语言）、自动阻断构建泄露、安全响应头扫描、死链检测、日志脱敏、CORS 配置、环境变量泄露、恶意 install 脚本、供应链安全、敏感文件暴露、技术债务、lock 文件一致性、gitignore 最佳实践、废弃依赖、AST级死代码检测、AI技能安全、AI代码气味、依赖架构、性能门禁、原型链污染
- ✅ **记忆组件组合**：6 种记忆工具协同工作
- ✅ **竞品分析**：OpenDigger 数据驱动决策
- ✅ **零冲突架构**：严格工具隔离与去重
- ✅ **AI/Model 无缝切换**：通过配置文件快速切换 AI 服务提供商，支持 Claude、Gemini、Qwen 等主流模型
- ✅ **编码原则四重防线**：Ponytail（写之前阻断）+ Karpathy（写之时约束）+ CodeGuardian（改之后验证）+ `/refactor` 的 simplify 模式（写之后清理），合并为 `conditional/core-rules.md` 按需加载
- ✅ **Prompt 自动进化**：GEPA 集成 — LLM 反思执行轨迹 → Pareto 进化搜索 → 自动优化场景 prompt（`/optimize`、`/loop` 可选增强）
- ✅ **jvn Spec-Driven 开发**：`/spec`（speckit specify → clarify → plan → tasks）→ `/build` 规范驱动开发，底层由 [GitHub Spec-Kit](https://github.com/github/spec-kit)（11 speckit 技能）驱动，5 Agent 增强审查（PM + 架构师 + UX + 代码审查 + 宪法校验）+ 新页面自动触发 hallmark 选型 + baton-loop 接力
- ✅ **多页站点自动生成**：Baton 接力模式 — `next-prompt.md` 接力棒 + SITE.md 路线图 + DESIGN.md 设计系统，配合 `/loop` 全自动逐页生成完整站点（`/feature` `/new-project` 多页站点时自动加载）+ **hallmark Skill 确保每页不同宏观结构**
- ✅ **UI Prompt 精炼器**：`/enhance-prompt`（Open Design Skill 提供，需本地 clone `open-design/`）— 模糊 UI 想法 → 结构化 prompt，含 UI/UX 关键词参考 + 形容词调色板 + 色彩角色术语，提升设计工具生成质量
- ✅ **hallmark 设计引擎**：Nutlope/hallmark v1.1.0 — 4 动词设计 Skill：`audit`（评分+punch list）、`redesign`（保留IA+品牌重建视觉）、`study`（截图/URL→设计DNA→design.md）、默认 Design flow（20 主题 + 57 slop-test 门禁 + pre-emit 自批判）

---

## 🏗️ 系统架构概览（三层架构）

本系统采用 **三层架构** 设计：

| 层级 | 作用 | 核心组件 |
|------|------|---------|
| **交互层** | 用户入口、场景选择、确认打断、结果展示 | [claude-scene CLI](./claude-scene/) |
| **能力层** | 具体业务能力实现（动作处理器） | [executeAction](./claude-scene/src/commands/start.js) |
| **运行时层** | 执行环境、模型调用、工具集成 | Scene 引擎 |

👉 [查看完整架构文档](./ARCHITECTURE.md)

---

## 🛠️ 快速工具（一键操作）

| 工具 | 文件 | 功能 | 平台 |
|------|------|------|------|
| **Claude Code 启动器** | [start-claude.bat](./start-claude.bat) / [start-claude.sh](./start-claude.sh) | 一键启动 Claude Code + 自动 init.sh 环境检查 | Windows / macOS / Linux |
| **会话初始化** | [init.sh](./init.sh) | Node/Git/依赖/测试/Harness 文件完整性检查 | macOS / Linux |
| **架构合规检查** | [zero-conflict-check.sh](./zero-conflict-check.sh) | 工具前缀验证 + 层纯度 + Harness 文件完整性 | macOS / Linux |
| **会话结束清理** | [scripts/clean-session.cjs](./scripts/clean-session.cjs) | Git 状态/测试/lint 检查，`--fix` 自动提交 | Windows / macOS / Linux |
| **安全升级工具** | [upgrade.bat](./upgrade.bat) / [upgrade.sh](./upgrade.sh) | 备份→检查→升级→验证，零风险升级 | Windows / macOS / Linux |

---

## 🚀 快速开始

### 环境要求

| 依赖 | 说明 |
|------|------|
| **Node.js** ≥ 18 | 运行 CLI 工具 |
| **Git** | 版本管理 |
| **bash**（macOS/Linux 内置，Windows 用 Git Bash） | Shell 命令执行 |

### 方式一：Claude Code 集成（推荐）

**Windows：** 双击 `start-claude.bat` 一键启动
**macOS/Linux：** 终端运行 `./start-claude.sh`

启动后输入 `/` 查看所有可用命令，使用 `/ui-polish`、`/bugfix` 等。

### 方式二：CLI 工具（不依赖特定 AI 工具）
```bash
cd claude-scene
node src/index.js list                      # 查看所有场景
node src/index.js start ui-polish --auto    # 执行工作流
```

---

## 📋 26 个工作流场景

> 另有 9 个功能已融入增强菜单（backup/docker→cicd、sbom→deps、loadtest→setup、log/incident→setup、changelog→release、migration→review、llm-proxy-audit→review），对应父工作流中按需弹出。
>
> **交互式模式选择**：`/review`、`/refactor`、`/ui-polish` 启动时弹出勾选菜单，3秒无操作使用默认。

| 场景 | 步骤数 | 描述 | 命令 |
|------|--------|------|------|
| **ui-polish** | 74 步 | 前端美化 + 设计（交互式模式：UI美化/仅设计/品牌系统/Impeccable/落地页） | `/ui-polish` |
| **new-project** | 70 步 | 从零开始新项目（设计基准 → shape 简报 → Open Design + Impeccable） | `/new-project` |
| **review** | 43 步 | 代码审查 + 安全审计（交互式模式：代码审查/全量审计/仅分析/安全深度/质量工具链/AI设计）。安全深度模式含响应头/SkillSpector/ReDoS/CORS/日志脱敏/密钥/敏感文件 | `/review` |
| **bugfix** | 34 步 | Bug 修复（问题复现 → 根因定位 → 修复 → PR → 回归测试） | `/bugfix` |
| **feature** | 31 步 | 新功能开发（CE 规划 + 测试驱动 + 多 Agent 审查） | `/feature` |
| **mobile-audit** | 24 步 | App 安全审计（MobSF + mobsfscan + Bearer + OWASP MASVS） | `/mobile-audit` |
| **refactor** | 30 步 | 代码重构 + 简化（交互式模式：代码重构/代码简化/架构优化） | `/refactor` |
| **release** | 24 步 | 发布部署（质量门禁 + 版本号 + 构建 + 泄露检测 + Tag + 监控） | `/release` |
| **mobile-optimize** | 19 步 | App 性能优化（Bundle 分析 + 启动优化 + 网络分析 + 反模式检测） | `/mobile-optimize` |
| **mobile-release** | 18 步 | App 发布部署（证书检查 → 质量门禁 → TestFlight/Play Store） | `/mobile-release` |
| **deps** | 17 步 | 安全依赖更新（扫描过期 + Breaking Changes 检测 + SBOM 可选增强） | `/deps` |
| **mobile-review** | 17 步 | 移动端代码审查（ESLint + mobsfscan + UI 截图 + AI 语义） | `/mobile-review` |
| **optimize** | 17 步 | 性能优化（问题选择 → 基线 → 反模式 → 增量测试） | `/optimize` |
| **mobile-onboard** | 16 步 | App 开发环境搭建（RN Doctor + .env 模板 + 模拟器配置） | `/mobile-onboard` |
| **onboard** | 16 步 | 开发环境搭建（检测语言 + 安装依赖 + 配置 .env） | `/onboard` |
| **rollback** | 16 步 | 紧急回滚（版本选择 + 回滚 + 健康检查 + 监控复原） | `/rollback` |
| **loop** | 18 步 | 自动迭代循环（无人值守，持续审查→修复→验证） | `/loop` |
| **mobile-e2e** | 13 步 | 移动端 E2E 测试（Detox/Patrol + CI 集成） | `/mobile-e2e` |
| **cicd** | 12 步 | CI/CD 配置（Act + Taskfile + Docker化/备份可选增强） | `/cicd` |
| **qa** | 13 步 | 浏览器 QA 验证（git diff → 浏览器测试 → Bug 分级） | `/qa` |
| **plan-ceo-review** | 11 步 | 创始人策略审查（10x 分析 + 精简化 + 用户价值） | `/plan-ceo-review` |
| **check** | 8 步 | 引擎自检（dead action / 未实现门禁 / 空转 handler；不自动改源码） | `/check` |
| **plan** | 10 步 | Manus 持久规划（会话恢复 + SHA256认证 + 多阶段追踪） | `/plan` |
| **spec** | 10 步 | Spec-Driven 开发（需求 → 建 feature → 用户故事/验收标准 → 交互与状态 → 可选澄清 → 规格落地门禁，产出 `specs/NNN-*/spec.md`） | `/spec` |
| **update** | 10 步 | 系统资源更新（扫描 MCP/Skill/CLI/npm → 冲突检测 → patch/minor 自动更新 → major 待确认 → 写日期日志） | `/update` |
| **setup** | 14 步 | 测试/监控设施搭建（交互选择：E2E 测试 MSW+Supertest+Schemathesis / 网站监控 Upptime+GitHub Actions） | `/setup` |

---

## 🎯 开发场景最佳工作流

按常见开发场景推荐工作流组合。每个场景给出**主工作流**和**配套增强**。

### 新功能开发

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 需求 → 规划 | `/spec "需求"` → `/plan` | Spec-Kit 录入需求，plan.md 持久化规划 |
| 实现 | `/feature <描述>` | TDD：写测试 → 实现 → CI 验证 |
| 审查 | `/review` | 勾选"代码审查" + "安全深度扫描" |
| 发布 | `/release` | 质量门禁 → 版本 → 构建 → 部署 |

> **增强**：需求 >50 字时 `/feature` 自动弹 CEO 策略审查；检测到 DB 触发迁移审查。

### Bug 修复

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 复现定位 | `/bugfix <描述>` | 复现 → 根因 → 修复方案 |
| 验证 | （内置） | 测试通过 + 回归 |
| 同类排查 | `/review` | security_deep 模式，同根因变量分析扫全库同类漏洞 |

> **增强**：检测到 Stagehand 时支持浏览器复现闭环；mythos-agent 同根因排查。

### 代码重构 / 简化

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 分析 | `/refactor` | 勾选"代码重构" + "架构优化" |
| 简化 | `/refactor` | 勾选"代码简化"（不改行为） |
| 验证 | （内置） | 测试通过 + 覆盖率不低于基线 + API 契约一致 |

> **增强**：CodeGraph 影响分析评估爆炸半径；CodeGuardian 边界验证（±50行/0依赖/复杂度≤130%）。

### 代码审查 / 质量审计

| 场景 | 工作流 | 勾选模式 |
|------|--------|----------|
| 日常 PR 审查 | `/review` | 代码审查 + 安全深度扫描 |
| 全量健康检查 | `/review` | 全量审计（原 `/audit`） |
| 仅分析不改动 | `/review` | 仅分析（原 `/analyze`） |
| 死代码/重复/变异 | `/review` | 质量工具链（Knip + jscpd + Stryker） |
| AI/设计审查 | `/review` | AI/设计审查（aislop + Huashu + Impeccable） |

### 前端美化 / 设计

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| UI 美化 | `/ui-polish` | DaisyUI 主题 + 动效 + 组件类注入 |
| 设计规范 | `/ui-polish` | Huashu 5 维度评审 + Impeccable 打磨 + hallmark audit |
| 响应式校验 | `/ui-polish` | Stagehand 多视口截图（检测到时） |

> **hallmark 集成**：`/ui-polish` 自动加载 hallmark skill — 选主题 → 57 slop-test → pre-emit 自批判。`hallmark study` 可从截图/URL 提取设计 DNA 并生成 design.md。详见 hallmark Skill 的 4 个动词（audit/redesign/study/默认 Design flow）。

### 安全漏洞扫描

| 深度 | 工作流 | 说明 |
|------|--------|------|
| 快速扫描 | `/review` | sec-bug-hunt + ReDoS + 开放重定向 + 日志脱敏 |
| 深度扫描 | `/review` | + LLM 代理审计 + mythos 假设驱动 + Critiq 确定性规则 |
| 密钥泄露 | `/review` | gitleaks Git 历史 + trivy 容器/文件系统 |

### 性能优化

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 基线测量 | `/optimize` | Lighthouse + 性能基线 |
| 瓶颈分析 | `/optimize` | 反模式检测 + before/after 对比 |
| Prompt 进化 | `/optimize` | GEPA 自动优化场景 prompt（检测到时） |

### 发布部署

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 发布前 | `/release` | 质量门禁 → 版本 → 构建产物泄露检查 |
| 部署 | `/release` | Lighthouse 门禁 → 部署 → 健康检查 |
| 发布后 | `/release` | GitHub Release + 变更日志 |

> **增强**：检测到 DB 触发迁移 dry-run；Stagehand 发布前冒烟。

### 依赖更新

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 检查 | `/deps` | 过期扫描 + 废弃依赖检测 |
| 更新 | `/deps` | 逐项更新 + 测试 + 破坏性变更验证 |
| 物料清单 | `/deps` | SBOM 生成（CycloneDX + 许可证合规） |

### 移动端开发

| 场景 | 工作流 |
|------|--------|
| 环境搭建 | `/mobile-onboard` |
| 代码审查 | `/mobile-review` |
| 安全审计 | `/mobile-audit`（MASVS 18 条规则） |
| 性能优化 | `/mobile-optimize` |
| E2E 测试 | `/mobile-e2e` |
| 发布 | `/mobile-release` |

### 持久规划（复杂任务）

| 场景 | 工作流 | 说明 |
|------|--------|------|
| ≥3 步复杂任务 | `/plan` | Manus 风格：plan.md + findings.md + progress.md |
| 会话恢复 | `/plan` | session-catchup.py 检测未同步上下文 |
| 多 Agent 协作 | `/plan` | SHA256 认证防注入 |

> **规则**：2-Action Rule（每 2 次搜索保存发现）+ 3-Strike Protocol（失败 3 次上报）。

### 基础设施配置

| 场景 | 工作流 |
|------|--------|
| CI/CD 流水线 | `/cicd`（Docker 化 + 备份可选） |
| 网站监控 | `/setup` 选 monitor（Upptime + Runbook） |
| E2E 测试 | `/setup` 选 e2e（MSW + Supertest + fuzz） |
| 环境搭建 | `/onboard`（一键检测+安装+配置） |

### 紧急回滚

| 场景 | 工作流 | 说明 |
|------|--------|------|
| 线上故障 | `/rollback` | 定位版本 → 验证安全 → 回滚 → 健康检查 → 复盘 |

### 自动迭代

| 场景 | 工作流 | 说明 |
|------|--------|------|
| 无人值守优化 | `/loop` | 分析→计划→实现→验证循环，最多 10 轮 |

### UI Prompt 精炼

> 这三条来自 **Open Design Skill**（`open-design/skills/enhance-prompt/`）：它是那个本地 clone 里的 skill，不是本仓库的命令。没 clone `open-design/` 时 `/enhance-prompt` 不存在，改用 `/ui-polish` 的交互式设计简报。

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 模糊想法 → 精炼 | `/enhance-prompt <描述>`（Open Design Skill） | 注入平台/配色/排版/结构，输出结构化 prompt |
| 已有 DESIGN.md | `/enhance-prompt`（Open Design Skill） | 自动提取设计系统块嵌入 prompt |
| 结果不满意 | `/enhance-prompt`（Open Design Skill） | 增强特异性 + UI/UX 关键词 + 形容词调色板 |

### 多页站点自动生成

| 阶段 | 工作流 | 说明 |
|------|--------|------|
| 初始化 | 创建 `.site/SITE.md` + `.site/DESIGN.md` + `.site/next-prompt.md` | 站点愿景 + 设计系统 + 首页接力棒 |
| 逐页生成 | `/feature` 或手动触发 | 读接力棒 → 生成页面 → 集成 → 写下一个接力棒 |
| 全自动 | `/loop 3m "读取 .site/next-prompt.md，生成页面，更新接力棒"` | baton 接力模式全自动跑完整站 |

---

## 🔧 Action 处理器完整性

系统注册了 **428 个 action 名**（`claude-scene/src/actions.js` 中 `ACTION_REGISTRY` 的键；同一个 handler 常同时登记成 camelCase 与 kebab-case 两个名字，所以名字数多于函数数），由 **70 个 handler 模块**共 **284 个不同的 handler 函数**实现，覆盖 26 个工作流的全部步骤需求。常用 action 示例：

| Action | 用途 | 实现状态 |
|--------|------|---------|
| `recall` / `remember` / `consolidate` | 多后端记忆操作 | ✅ |
| `runReview` | 代码审查（支持 security/full/pr 模式） | ✅ |
| `runSuite` / `runAffected` / `test-coverage` | 测试套件运行 | ✅ |
| `select` / `confirm` | 交互式选择与确认 | ✅ |
| `generateDesign` / `analyze` | 设计与竞品分析 | ✅ |
| `analyzeUI` / `checkConsistency` / `applyDaisyUI` / `applyComponents` / `addAnimations` / `visualRegression` | 前端美化工具链 | ✅ |
| `check-api-consistency` | OpenAPI 标准管线（Redocly lint + 交叉验证 + openapi-typescript） | ✅ |
| `sec-bug-hunt` / `gitLeaks` / `securityScan` / `security-headers` / `build-leak-check` / `dead-link-check` / `lighthouse-gate` / `open-redirect-scan` / `depcruise-architecture` / `i18n-audit` | 安全扫描 + 性能 + 架构 + i18n | ✅ |
| `verify-handlers` | Handler 功能验证：10 Pass 空转桩检测（内联桩/CE桩/逻辑密度/工具健康/依赖/导入链/场景交叉/静态安全/MCP配置） | ✅ |
| `check-smoke` / `check-gate-flags` | 引擎自检：冒烟测试 / 场景声明的门禁是否都实现了 | ✅ |
| `migration-review` / `load-test` | 迁移审查 / 负载测试 | ✅ |
| `setup-monitor` / `setup-ci` / `setup-backup` / `setup-docker` / `setup-e2e` / `setup-logging` | 一键基础设施配置 | ✅ |
| `incident-runbook` / `generate-changelog` / `generate-sbom` | 事故/变更/SBOM 自动化 | ✅ |
| `huashu-*`（6 个） | Huashu 品牌设计系统集成 | ✅ |
| `awm-brand-*`（2 个） | Open Design 品牌导入（list + import） | ✅ |
| `mp-*`（14 个） | Matt Pocock TypeScript skill 桥接 | ✅ |
| `ce-*`（6 个） | Compound Engineering Plugin 集成 | ✅ |
| `notify` / `send` | 通知与告警 | ✅ |

> `npm-audit` 是传给 `runReview` 的**审查规则名**，不是 action：npm audit 在 `securityScan` / `runReview(security, npm-audit)` 内部跑。旧表格把它和已删除的 `state-audit` 一起标成 ✅ —— 而那张表没有任何东西验证过。

---

## 🎨 前端美化工具链

### Animal Island UI 风格转换

```bash
# CLI 命令
node src/index.js start ui-polish --auto --theme animal-island --target "./your-project"

# 或使用自然语言在 Claude Code 中
> /ui-polish animal-island ./your-project
```

# 执行步骤（59 步全对话模式工作流）
# Phase 0: Pre-flight 设计智能
0. web-design-engineer → 声明设计系统基线（Palette/Typography/Spacing/Motion/Radius/Shadows）
0.05. review-checklist → 加载 23 项审查清单
# Phase 1: 对话内机械步骤（Claude 直接操作文件，不再通过 CLI 子进程）
1. recall         → 注入历史上下文和相关记忆
2. listMemories   → 召回之前的 UI 优化记录（Memory MCP）
3. analyzeUI      → 分析项目结构，统计 CSS/组件文件
3.5. impeccable-audit → 技术质量基线扫描（a11y/perf/responsive）
4. installDeps    → 安装 daisyui, animate.css, lucide-react, playwright
5. checkConsistency → 检查 UI 一致性，输出评分
5.8-6.44. Open Design 资源加载 → 品牌选择 + 模板预览 + Skill 加载 + 设备框 + 演示文稿 + 提示词
6. confirm        → 用户选择主题（DaisyUI/Animal Island/Custom/Huashu/Open Design 152 品牌）
6.5. awm-brand-import → Open Design: 直接读取 `open-design/design-systems/<brand>/` DESIGN.md + tokens.css → 注入 CSS 变量（条件触发）
6.7. reconcileDesignTokens → 设计 Token 调和：已有值优先，新主题填充缺失
7. applyDaisyUI   → 整合应用主题（on_error: abort）
7.15. exportAssets → 导出设计资源到 src/assets/design-system/
7.2. huashu-expert-review → Huashu 5 维度评审（第一轮基线测量）
7.25. impeccable-critique（第一轮）→ 27 条反AI模式 + 12 条LLM批判，检测 AI 塑料感（on_error: abort）
7.3. impeccable-polish → 全维度质量调优（配色/间距/字体/圆角/阴影）（on_error: abort）
8. applyComponents → 扫描 JSX/TSX 替换为 Animal Island UI 组件（仅 animal-island 主题）
8.5. iconUpgrade  → 图标升级：Material Symbols → lucide-react（所有主题）
9. addAnimations  → 动画注入：animate.css（fadeIn/fadeInDown/fadeInUp）
9.2. microInteractions → 微交互：hover:-translate-y hover:shadow-lg active:scale-[0.98]
# Phase 2: Post-flight Skill 深度打磨（对话模式，⚠️ 必须执行）
9.5. web-design-verify → 设计交付检查
9.56. impeccable-layout → 间距节奏 + 视觉层级 + 空间重构（on_error: abort）
9.57. impeccable-colorize → 策略性色彩注入（on_error: abort）
9.58. impeccable-bolder → 安全→大胆，打破 AI 默认审美（on_error: abort）
9.55. impeccable-typeset → 排版层次优化（on_error: abort）
9.3. impeccable-animate → purposeful motion + reduced-motion（on_error: abort）
9.59. impeccable-delight → 个性化记忆点（on_error: abort）
9.593. impeccable-harden → 生产就绪：加载/空/错误/边缘状态（on_error: abort）
9.594. impeccable-distill → 精简提纯：去除冗余（on_error: abort）
9.591. impeccable-clarify → UX 文案优化（on_error: abort）
9.592. impeccable-adapt → 响应式设计验证（on_error: abort）
9.595. impeccable-optimize → CSS/渲染性能诊断（on_error: abort）
9.6. impeccable-critique（CLI）→ 12 条规则自动扫描（CLI 模式补充）
9.605. impeccable-critique（第二轮）→ 验证打磨效果，确认品味提升（on_error: abort）
9.606. impeccable-polish（第三轮）→ 精准修复残留 AI 塑料感
9.608. impeccable-bolder（第三轮）→ 放大仍显保守的设计决策
9.61. impeccable-delight（第三轮）→ 注入遗漏的个性化记忆点
9.65. huashu-expert-review（第二轮）→ 修复后验证，确认质量提升可量化
9.7. ai-friendly-review → 可访问性审查（语义HTML/ARIA/对比度/键盘导航）
9.75. aislop-scan → AI 代码气味扫描
10. runSuite      → 运行前端测试
11. visualRegression → Playwright 视觉回归测试（Desktop/Tablet/Mobile）
12. checkAPIConsistency → OpenAPI 标准管线
13. ce-compound    → 知识沉淀到 CLAUDE.md
14. remember      → 保存 UI 美化配置到记忆
15. consolidate   → 整理跨后端记忆一致性
16. notify        → 通知完成
```

**Animal Island UI 设计规范：**

| 设计元素 | 值 |
|---------|------|
| 主色调 | `#19c8b9` |
| 背景色 | `#FAF8F5` |
| 强调色 | `#FF6F61` |
| 文字色 | `#5D4E37` |
| 圆角 | 16px-24px |

---

## 🆕 new-project 完整工作流

### 使用方式

```bash
# 启动工作流
cd claude-scene
node src/index.js start new-project

# 或使用自动模式
node src/index.js start new-project --auto --prompt "创建一个 React 电商网站"
```

### 完整流程说明（65 步全对话模式工作流）

| 阶段 | 步骤 | 说明 |
|------|------|------|
| **Phase 0: Pre-flight** | web-design-engineer → review-checklist → recall → shape 设计简报 | 设计基准声明 + 品味方向确立 |
| **Phase 1: 上下文收集** | GitHub/Tavily/Context7/Supabase/Stripe/Resend MCP + OpenDigger 竞品分析 | 自动搜索最佳实践、文档、模板 |
| **Phase 2: 规划** | ce-plan → Skill review（PRD 合成 + Issue 拆解） | CE 详细规划 + Issue Tracker 集成 |
| **Phase 3: 脚手架** | applyTemplate → askUser(Open Design) → Open Design 152 品牌资源加载 → brand-import → generateDesign | 项目创建 + 品牌选择 + AI 设计生成 |
| **Phase 3.5: Impeccable 打磨** | Huashu 基线 → critique(检测) → polish → layout → colorize → bolder → typeset → animate → delight → harden → distill → clarify → adapt → optimize → critique(验证) → polish+bolder+delight(精准修复) → Huashu 验证 → AI-Friendly 可访问性 | 双轮品控+3项残留修复，所有关键步骤 on_error: abort |
| **Phase 4: 实现+审查** | implementLogic → checkAPI → runReview → aislop → sec-bug-hunt → runSuite | 业务逻辑 + 代码质量 + 安全基线 |
| **Phase 5: 沉淀** | review(git-guardrails) → ce-compound → remember → consolidate → notify | 知识沉淀 + 记忆保存 |

---

## 🔒 安全漏洞审查

### hunt 场景工作流

```bash
node src/index.js start hunt --auto --target "./your-project"
```

**执行步骤：**
1. MCP 信息收集（Sentry 错误 + Tavily 漏洞搜索 + Context7 文档 + GitHub issues + CodeGraph 代码分析）
1. `recall` → 注入项目安全策略和已知漏洞上下文
2. `runReview(security, eslint-plugin-security)` → ESLint 安全扫描（SQL注入/XSS/CSRF）
3. `runReview(security, npm-audit)` → npm 依赖漏洞扫描
4. `security-headers` → 安全响应头配置扫描（CSP / HSTS / X-Frame-Options 等）
4.3. `open-redirect-scan` → 开放重定向检测（location.href/window.open 参数注入）
4.5. `security-headers` → seraphim-audit 安全响应头深度扫描
4.7. `recheck-cli` → 正则 ReDoS 灾难性回溯扫描
4.8. `log-sanitization` → 日志脱敏扫描（Token/密码/身份证/手机号/邮箱泄露）
4.9. `cors-check` → CORS 配置检测（通配符/credentials 泄露）
4.10. `env-var-leak` → 前端环境变量泄露检测
4.12. `sensitive-file-check` → 敏感文件暴露检查（.env/*.pem/*.key）
5. `runSuite` → 验证修复后无功能回归（条件触发）
6. `ce-compound` → 知识沉淀
6.5. `remember` → 保存安全审查结果到记忆
7. `send` → 高危漏洞即时推送（条件触发）
8. `notify` → 审查完成通知

**支持的安全扫描规则：**
- `eslint-plugin-security` - ESLint 安全规则（SQL注入/XSS/CSRF）
- `OWASP-Top-10` - OWASP Top 10 安全标准
- `npm-audit` - npm 依赖漏洞审计
- `security-headers` - 安全响应头配置扫描（seraphim-audit）
- `open-redirect-scan` - 开放重定向检测
- `recheck-cli` - 正则 ReDoS 灾难性回溯扫描
- `log-sanitization` - 日志脱敏扫描（Token/密码/身份证/手机号/邮箱）
- `cors-check` - CORS 配置检测
- `postinstall-check` - 恶意 install 脚本检测
- `socket-scan` - Socket.dev 供应链安全扫描
- `sensitive-file-check` - 敏感文件暴露检查
- `autoFix` - 自动修复可修复的问题

---

## 🛡️ 外部安全工具链

下表「负责工作流」列只写**引擎里真有的东西**：`/review` `/release` 之类后面跟的 `step N` 都是 `claude-scene/scenes/<场景>.json` 里 `flow` 条目的真实 `step` 值（`scripts/check-tool-steps.cjs` 校验）；标「未接入」的是**没有接进任何场景步骤**的工具——不假装它会自动跑：

| 工具 | 类型 | 负责工作流 | 功能 | 阻断级别 |
|------|------|-----------|------|---------|
| **noleak** | npm CLI | `/release` (step 8.5), `/cicd` (step 2.5) | 构建产物泄露检测：Source Map / .env / 密钥 / .git 目录扫描 | BLOCK-RELEASE |
| **seraphim-audit** | Python CLI | `/review` (step 4.56) | 安全响应头扫描：CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy | — |
| **lychee** | Rust 二进制 | 未接入场景：handler 已注册，没有任何场景步骤调用 | 死链接检测：扫描项目 Markdown/HTML 文件中的失效链接 | — |
| **Lighthouse CI** | npm CLI | `/release` (step 8.6) | 性能门禁：LCP/CLS/TBT 断言 + 缓存策略 + PWA 离线检查 | BLOCK-RELEASE |
| **pa11y-ci** | npm CLI | `/review` (step 2.35) | WCAG 2.1 AA 深度无障碍扫描 | — |
| **recheck-cli** | npm CLI | `/review` (step 4.1) | 正则 ReDoS 灾难性回溯扫描 | — |
| **log-sanitizer** | 内置 grep | `/review` (step 4.3) | 日志脱敏扫描：Token/密码/身份证/手机号/邮箱泄露检测 | — |
| **cors-checker** | 内置 grep | `/review` (step 4.4) | CORS 配置检测：通配符 + credentials 泄露 | — |
| **env-var-leak** | 内置 grep | `/review` (step 4.5) | 前端环境变量泄露：Vite import.meta.env / process.env 浏览器端泄露 | — |
| **sensitive-file-check** | 内置 git | `/review` (step 4.55) | 敏感文件暴露检查：.env/*.pem/*.key/credentials.json | — |
| **deprecated-deps** | npm CLI | `/deps` (step 3.5) | 废弃/未维护依赖检测：npm outdated 识别 deprecated 包 | — |
| **knip** | npx CLI | `/review` (step 2.6) | AST 级死代码/依赖检测：未使用文件/未使用导出/未解析导入/未声明依赖/未使用依赖 | — |
| **skillspector** | Python CLI | `/review` (step 4.57) | AI 技能安全扫描：提示注入/数据外泄/权限提升/供应链攻击等 64 种漏洞模式（NVIDIA） | — |
| **aislop** | npx CLI | `/review` (step 2.9), `/release` (step 8.7) | AI 代码气味扫描：50+ 规则检测叙事注释/吞异常/死代码/as any 滥用/重复 helper（子秒级确定性） | — |
| **dependency-cruiser** | npx CLI | `/review` (step 2.65) | 依赖架构验证：循环依赖检测/孤儿模块识别/架构分层合规/调用图生成 | — |
| **prototype-pollution** | ESLint 规则 | `/review` (step 2) | no-prototype-builtins 原型链污染检测 | — |
| **trivy** | Go 二进制 | 未接入引擎：没有 handler，只有安装与版本检查 | 容器镜像/文件系统/IaC 全量安全扫描：CVE + 密钥 + 配置错误（Aqua Security） | — |
| **shellcheck** | Haskell 二进制 | 未接入引擎：没有 handler，只有安装与版本检查 | Shell 脚本静态分析：语法错误/不良实践/安全风险 | — |
| **sqlfluff** | Python CLI | 未接入引擎：没有 handler，只有安装与版本检查 | SQL linter + formatter：200+ 规则，支持 8 种 SQL 方言（MIT） | — |
| **bruno** | npm CLI | 未接入引擎：没有 handler，只有安装与版本检查 | API 交互测试：REST/GraphQL/WebSocket 集合运行，Git 友好纯文本（MIT） | — |
| **gitleaks** | Go 二进制 | `/review` (step 4.551) | Git 历史密钥泄露检测：120+ 内置规则，detect/describe/git 子命令（MIT） | — |
| **semgrep** | Python CLI | `/review` (step 4.6) | 多语言 AST 级 SAST：2,500+ 社区规则，支持自定义规则，跨语言模式匹配（LGPL） | — |
| **commitlint** | npm CLI | 未接入引擎：没有 handler，只有安装与版本检查 | Conventional Commits 格式校验：`@commitlint/config-conventional` + 可扩展规则（MIT） | — |
| **biome** | npm CLI | 未接入引擎：没有 handler，只有安装与版本检查 | Rust 编写 JS/TS linter + formatter，替代 ESLint+Prettier，零配置高性能（MIT/Apache-2.0） | — |
| **ruff** | Python CLI | 未接入引擎：没有 handler，只有安装与版本检查 | Rust 编写 Python linter + formatter，替代 Flake8+isort+black，10-100x 更快（MIT） | — |
| **hurl** | Rust 二进制 | 未接入引擎：没有 handler，只有安装与版本检查 | 纯文本 API 测试 CLI，Git 友好，CI/CD 原生支持（Apache-2.0） | — |
| **jscpd** | npx CLI | `/review` (step 2.95) | 代码重复检测：跨文件复制粘贴片段扫描（默认 5 行 / 50 token） | — |
| **size-limit** | npx CLI | `/review` (step 2.96) | 包体积预算检查：超过 `.size-limit.json` 阈值即失败 | — |
| **Stryker** | npx CLI | `/qa` (step 6.5) | 变异测试：注入变异体验证测试是否真能抓住错误（mutation score） | — |
| **Spectral** | npx CLI | 未接入场景：handler 已注册，没有任何场景步骤调用 | API lint（OpenAPI/Swagger 规范校验） | — |
| **markdownlint** | npx CLI | 未接入场景：handler 已注册，没有任何场景步骤调用 | Markdown 格式检查（标题层级 / 列表缩进 / 行宽） | — |
| **codeguardian** | Python MCP | `/loop` (step 4.2), `/optimize` (step 9.6), `/refactor` (step 13.5) | AI 代码优化守护者：复杂度/重复度/可读性建议 | — |
| **critiq** | npm CLI | `/review` 增强项（`critiq_security_scan`，需装 `@critiq/cli` 并在增强菜单里勾选） | 确定性安全规则扫描：1,243 条规则 9 语言（SQLi/SSRF/路径遍历/反序列化/硬编码密钥） | — |

### 工具安装

```bash
# 核心工具（跨平台 npm）
npm install -D noleak pa11y-ci recheck-cli knip

# Python 工具（macOS/Linux/Windows 均支持）
pip install git+https://github.com/seraphimhub/seraphim-audit.git
pip install git+https://github.com/NVIDIA/skillspector.git
pip install sqlfluff
pip install semgrep

# trivy — 容器/文件系统安全扫描
# winget install AquaSecurity.Trivy  (Windows)
# brew install trivy                   (macOS)

# gitleaks — Git 历史密钥泄露检测
# winget install Gitleaks.Gitleaks     (Windows)
# brew install gitleaks                (macOS)

# shellcheck — Shell 脚本静态分析
# winget install koalaman.shellcheck   (Windows)
# brew install shellcheck              (macOS)

# bruno — API 交互测试
npm install -g @usebruno/cli

# commitlint — Commit 规范校验
npm install -D @commitlint/cli @commitlint/config-conventional

# biome — JS/TS linter + formatter (Rust)
npm install -D @biomejs/biome

# ruff — Python linter + formatter (Rust)
pip install ruff

# hurl — API 测试 CLI (Rust)
# winget install Orange-OpenSource.Hurl  (Windows, 需管理员)
# brew install hurl                       (macOS)

# lychee 死链检测 — 按平台下载二进制
# https://github.com/lycheeverse/lychee/releases
```

> **macOS/Linux 用户**：上述命令直接运行。**Windows 用户**：需要 Git Bash 或 WSL，Python 工具会自动扫描已安装的 Python 版本目录。

---

## 💬 使用方式

### 在 Trae 中使用（推荐）

**方式一：使用 `/` 指令触发**
```
/ui-polish animal-island E:\my-app
/bugfix 登录页面表单验证报错
/feature 添加用户管理模块
/review
/setup
```

**方式二：使用 CLI 工具**
```bash
cd claude-scene

# 查看所有场景
node src/index.js list

# 运行工作流
node src/index.js start ui-polish --auto --theme animal-island --target "E:\project"
node src/index.js start bugfix --auto --prompt "登录页面报错"
node src/index.js start review --auto
node src/index.js start hunt --auto
```

### 命令参数说明

| 参数 | 说明 |
|------|------|
| `--auto` | 自动模式，跳过交互确认 |
| `--dry-run` | 试运行，仅预览不执行 |
| `--target <path>` | 指定目标项目路径 |
| `--theme <name>` | 指定主题（daisyui/animal-island/custom/huashu/open-design） |
| `--option <name>` | 指定选项（用于 optimize/simplify 场景） |
| `--prompt <text>` | 指定提示信息 |

---

## 📁 项目结构

```
mix-coding/
├── .claude/
│   ├── scenes/               # 场景定义（26 个 JSON；本层优先于 claude-scene/scenes）
│   ├── commands/             # Slash commands（33 个 .md：26 个工作流 + 7 个非场景命令）
│   ├── rules/                # 项目规则（conditional/ 按需加载，含 anti-slop 反套娃设计标准 + baton-loop 多页站点接力模式）
│   ├── skills/               # Claude Skills（30 个：19 个通用 + 11 个 speckit）
│   ├── agents/               # 12 个 Agent
│   ├── reports/              # 审计报告（含 harness-audit 12 维评分）
│   ├── knowledge/            # 知识索引
│   └── scheduled_tasks.json  # 定时任务配置
│
├── .github/workflows/        # CI 流水线（lint → test）
├── .husky/pre-commit         # Git 钩子（eslint + test + 死代码扫描 + 场景统计同步）
├── .specify/                 # Spec-Kit 配置
├── claude-scene/             # CLI 工具（Scene 引擎）
├── scripts/                  # 项目脚本（Node.js .cjs）
│   ├── check-readme-stats.cjs        # README 场景数/步骤数校验
│   ├── check-doc-counts.cjs          # README/CLAUDE.md 类目计数校验
│   ├── check-tool-steps.cjs          # 工具表「场景 + step」引用是否真实存在
│   ├── scan-scenes.cjs               # 场景步骤数 → scripts/scenes-stats.json
│   ├── lib/scene-dir.cjs             # 场景层顺序的唯一定义（覆盖层优先，同引擎）
│   └── ...其他脚本
├── feature_list.json         # WIP 特性跟踪（wip_limit: 1）
├── progress.md               # 会话状态日志
├── DECISIONS.md              # 架构决策记录
├── constitution.md           # 项目宪法
├── CLAUDE.md                 # 项目主指令（~65 行）
├── AGENTS.md                 # Harness 操作手册（5 节）
├── ARCHITECTURE.md           # 架构文档
├── init.sh                   # 会话初始化检查
├── zero-conflict-check.sh    # 架构合规检查
├── upgrade.bat / start-claude.bat / start-claude.sh   # 一键工具
└── README.md
```

---

## 🧠 记忆系统

**状态**：✅ Claude Code auto-memory 自动保存用户画像/偏好/项目事实

- `~/.claude/.../memory/*.md` + `MEMORY.md` 索引，跨会话自动加载
- 会话内规划用 `plan.md` / `findings.md` / `progress.md`（见 `.claude/rules/conditional/planning-with-files.md`）

### 一键脚本

| 脚本 | 作用 |
|------|------|
| `npm run scan:deadcode` | 死代码扫描 |
| `npm run scan:all` | 综合扫描 |

---

## 🔧 MCP 动态启用

| 工作流 | 启用的 MCP 服务器 |
|--------|-------------------|
| new-project | github, context7, supabase, stripe, resend |
| feature | github, context7, supabase |
| bugfix | sentry, context7, github, codegraph |
| refactor | github, context7 |
| design | context7 |
| ui-polish | memory, playwright |
| simplify | github, context7 |
| optimize | github, context7 |
| review | github, context7 |
| hunt | sentry, context7, github, codegraph |
| analyze | opendigger |
| loop | github, context7 |
| release | github |
| audit | github, context7, codegraph |
| deps | github |
| rollback | github, codegraph |
| changelog | github |
| cicd | github |
| incident | github |
| monitor | github |
| sbom | github |
| mobile-audit | mobsf, mobsfscan, bearer, sentry, dependencycheck |
| mobile-review | mobsfscan, detox, codegraph, mobile-ui-review |
| mobile-release | github |
| mobile-optimize | bundle-visualizer, detox, toxiproxy |
| mobile-e2e | detox, patrol |
| mobile-onboard | react-native-doctor |
| llm-proxy-audit | lobstertrap |

---

## 📱 移动端工具支持

6 个移动端工作流自动检测可用工具，缺失工具自动跳过对应步骤并输出安装指引。

| 工作流 | 支持的工具 |
|--------|-----------|
| **mobile-audit** | MobSF、mobsfscan、Bearer CLI、DependencyCheck |
| **mobile-review** | ESLint + TypeScript、mobsfscan、Detox |
| **mobile-release** | GitHub、App Store Connect、Google Play Console |
| **mobile-optimize** | Bundle Visualizer、Lighthouse、Toxiproxy |
| **mobile-e2e** | Detox、Patrol |
| **mobile-onboard** | RN Doctor、Android SDK |

> 各工具安装指南详见 [docs/mobile-tools-installation.md](./docs/mobile-tools-installation.md)

---

## ❓ 常见问题

### 1. 工作流执行后无效果？

确保使用 `--target` 参数指定正确的前端项目路径：
```bash
node src/index.js start ui-polish --auto --theme animal-island --target "E:\your\frontend\project"
```

### 2. 安全扫描未执行？

确保在项目目录下有 `package.json` 文件，且已安装依赖：
```bash
cd your-project
npm install
```

### 3. CE Plugin 不生效？

确认已安装 Compound Engineering Plugin：
```bash
claude plugins install compound-engineering@anthropic
```

---

## 📦 完整工具安装配置指南

| ✅ 工具类型 | 🔧 安装命令 | 📋 说明 |
|-----------|-----------|--------|
| **基础环境** | [Node.js LTS](https://nodejs.org/) + [Git](https://git-scm.com/) | Node.js 运行时环境 |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | AI助手核心CLI |
| **CodeGraph** | `npm install -g @codegraph/cli` | 代码结构记忆分析工具 |
| **code-review-graph** | `uvx code-review-graph serve`（按需拉取，无需预装） | Tree-sitter 代码知识图谱：blast radius / 语义搜索 / 架构社区 / 死代码 / 大函数热点。与 CodeGraph 共存——CodeGraph 通用符号+动态trace，CRG 审查/重构架构洞察。light 模式走 CLI (`uvx code-review-graph <cmd>`)，full 模式可选 MCP server |
| **Claude Skills** | `npx skills install 技能名` | 技能插件生态（12+主流插件） |
| **Spec-Kit** | `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` + `specify init --here --integration claude --force` | GitHub Spec-Driven Development 引擎（11 speckit 技能） |
| **Impeccable Skill** | `echo Y \| npx --yes impeccable@2.3.2 skills install` | AI 设计词汇 + 27 反模式规则 + 12 LLM 批判规则，自动修正 UI 塑料感 |
| **Web Design Skill** | 复制 `SKILL.md` 到 `.claude/skills/web-design-engineer/`（注意：前序元数据仅保留 name/description/user-invocable） | ConardLi: 反AI套路设计系统，OKLCH 色彩 + 6步工作流 + 预交付检查清单 |
| **AI-Friendly Design** | `npx ai-friendly-web-design-skill --local` | ianho7: 语义HTML/ARIA可访问性 |
| **Awesome Design MD** | `git clone https://github.com/VoltAgent/awesome-design-md .claude/skills/awesome-design-md`（同上，注意前序元数据格式） | 5 精选品牌 DESIGN.md（Vercel/Linear/Stripe/Notion/Apple），已升级为 Open Design 152 品牌库直接文件读取 |
| **MCP服务器** | `claude mcp install github playwright supabase` | AI上下文增强扩展 |
| **记忆工具** | `git clone https://github.com/claude-mem \`%USERPROFILE%\.claude\skills\claude-mem` + `npx nexo-brain@latest init` | 5种记忆组件组合使用（project-memory / Claude-Mem / agentmemory / NEXO / CodeGraph） |
| **安全工具链** | `npm install -D noleak pa11y-ci recheck-cli @lhci/cli knip` + `pip install seraphim-audit` + Socket.dev API Key 配置 | 构建泄露检测 / 安全响应头 / 死链 / 无障碍 / ReDoS / 性能门禁 / AST 死代码检测 / 日志脱敏 / CORS / 敏感文件 / 供应链安全 / 技术债务 |
| **App Store** | [claude代码商店](https://github.com/topics/claude-app-store) | 更多Claude扩展工具 |

---

## 📊 集成全景

> 共集成 **84 个外部组件，每一类都在本仓库里数得出来**：本地 Skills 30 个 + 启用的 MCP 3 个 + npm 包 23 个 + 外部工具 28 个

### 本地 Skills（30 个，`.claude/skills/`)

| Skill | 来源 | 功能 |
|-------|------|------|
| `speckit-specify` 等 11 个 | GitHub Spec-Kit | spec → plan → tasks → implement 规范驱动开发全流程 |
| `hallmark` | Nutlope / Together AI | 20 主题 + 57 slop-test 门禁 + 9 宏观结构 + 4 动词（build/audit/redesign/study） |
| `web-design-engineer` | ConardLi | OKLCH 色彩 + 6步工作流 + 反 AI 套路 |
| `impeccable` | — | 27 反模式规则 + 12 LLM 批判规则，去塑料感 |
| `landing-page-design` | elayadesign（MIT） | 落地页完整系统：A 部分结构/版式/转化文案/SEO + B 部分字号刻度/间距表/圆角公式/hero/图标/动效曲线/交付清单。`ui-polish` 的 `landing_page` 模式调用 |
| `ai-friendly-web-design` | ianho7 | 语义 HTML / ARIA 可访问性 |
| `awesome-design-md` | VoltAgent | 5 品牌 DESIGN.md（Vercel/Linear/Stripe/Notion/Apple），已升级为 Open Design 152 品牌库直接文件读取 |
| `mattpocock` | Matt Pocock | 含 29 个子技能（TS/工程/生产力） |
| `code-review-graph` | tirth8205 | 7 个 skills：review-delta / refactor-safely / review-changes / review-pr / build-graph / debug-issue / explore-codebase。Tree-sitter 知识图谱，blast-radius 审查+死代码+架构社区（CLI 驱动，与 codegraph 共存） |
| `review-checklist` | — | 23 项审查清单 |
| `sec-bug-hunt` | — | 5 向量安全扫描规则 |
| `mobile-ui-review` | — | 移动端 UI 审查 |
| `constitution-reference` | — | 项目宪法引用 |
| `stack-knowledge` | — | 技术栈知识库 |
| `i-have-adhd` | ayghri/i-have-adhd | ADHD 友好输出风格：首行动作 + 编号步骤 + 重述状态 + 压制分支（10 规则，纯按需 `/i-have-adhd`） |

**推荐额外安装**（`npx skills install`）：`anthropics/skills`、`obra/superpowers`、`frontend-design`、`security-guidance`、`claude-seo`、`plannotator`、`deep-trilogy`

### MCP 服务器（`.mcp.json` 启用 3 个，`.mcp.json.full` 14 个，下表列 15 个）

| 服务器 | 用途 | 服务器 | 用途 |
|--------|------|--------|------|
| `codegraph` | 代码符号索引 | `github` | GitHub PR/Issue 操作 |
| `context7` | 文档查询 | `tavily-search` | 网络搜索 |
| `playwright` | 浏览器自动化 | `filesystem` | 文件系统操作 |
| `sequential-thinking` | 链式推理 | `memory` | 会话持久化记忆 |
| `stripe` | 支付集成 | `supabase` | 数据库操作 |
| `resend` | 邮件服务 | `sentry` | 错误监控 |
| `bearer` | PII/GDPR 隐私合规 |
| `detox` | RN E2E 测试 | `mobsfscan` | 移动端 SAST |

真正启用的是 `context7` / `github` / `sentry`（`.mcp.json`）；`npm run mcp:switch -- full` 会把 `.mcp.json.full`（14 个）复制上去，`-- light` 再从 `.mcp.json.light` 复制回来（双向可逆，`_modes` 元数据跟着真实内容改写）。`tavily-search` / `filesystem` / `sequential-thinking` 只是参考条目，两个 profile 里都没有。

### npm 包（23 个，`claude-scene/package.json`）

**devDependencies（19）**：`@lhci/cli`、`knip`、`noleak`、`pa11y-ci`、`recheck-cli`、`artillery`、`@cyclonedx/cyclonedx-npm`、`@redocly/cli`、`@vitest/coverage-v8`、`eslint` + 3 插件、`license-checker`、`openapi-typescript`、`playwright`、`runme`、`vitest`

**dependencies（4）**：`chalk`、`commander`、`inquirer`、`ora`

### 外部工具（28 个，按类型）

| 类型 | 数量 | 工具 | 安装方式 |
|------|------|------|---------|
| **uv/Python** | 6 | `specify-cli`（spec-kit）、`seraphim-audit`、`skillspector`、`sqlfluff`、`semgrep`、`ruff` | uv tool install / pip install |
| **Rust 二进制** | 2 | `lychee`、`hurl` | brew / cargo / winget / 下载 exe |
| **Go 二进制** | 4 | `act`、`restic`、`trivy`、`gitleaks` | winget / brew / 下载 |
| **Haskell 二进制** | 1 | `shellcheck` | winget / brew / 下载 |
| **npm 全局** | 1 | `bruno`（`@usebruno/cli`） | npm install -g |
| **npx 零安装** | 10 | `biome`、`aislop`、`dependency-cruiser`、`jscpd`、`size-limit`、`Stryker`、`Spectral`、`markdownlint`、`commitlint`、`knip` | 无需安装 |
| **内置 grep** | 4 | `log-sanitizer`、`cors-checker`、`env-var-leak`、`sensitive-file-check` | 已内置 |

### 集成 GitHub 项目（30 个）

`Nutlope/hallmark` · `gitleaks/gitleaks` · `semgrep/semgrep` · `conventional-changelog/commitlint` · `biomejs/biome` · `astral-sh/ruff` · `Orange-OpenSource/hurl` · `aquasecurity/trivy` · `koalaman/shellcheck` · `sqlfluff/sqlfluff` · `usebruno/bruno` · `seraphimhub/seraphim-audit` · `NVIDIA/skillspector` · `lycheeverse/lychee` · `nektos/act` · `restic/restic` · `nexu-io/open-design` · `VoltAgent/awesome-design-md` · `mattpocock/skills` · `scanaislop/aislop` · `sverweij/dependency-cruiser` · `anthropics/skills` · `modelcontextprotocol/*` · `X-lab2017/open-digger` · `referodesign/refero_skill` · `DietrichGebert/ponytail` · `multica-ai/andrej-karpathy-skills` · `thedotmack/claude-mem` · `github/spec-kit` · `ayghri/i-have-adhd`

---

## 🔄 更新指南

### `/update` 工作流（推荐）

```bash
node src/index.js start update --auto
```

扫描 MCP / Skill / CLI / npm 四类系统资源 → 检测冲突（硬冲突阻断、软冲突提示）→ 自动更新无冲突的 patch/minor → major 待确认 → 写日期日志到 `docs/tool-versions.md`。

> 与 `update-all.bat` 的区别：脚本只跑 `npm update` / `git pull`；`/update` 工作流额外做冲突检测和 major 版本人工确认，更安全。

### 一键全量更新

```bash
# Windows
update-all.bat

# macOS / Linux
./update-all.sh
```

脚本自动覆盖 **5 个维度**：

| 维度 | 操作 | 自动化 |
|------|------|--------|
| **npm 包**（19个） | `npm update` 拉取兼容版本 | 全自动 |
| **Python 工具**（2个） | `pip install --upgrade` 重装 | 全自动 |
| **Git 仓库**（6个） | `git pull --ff-only` 快进合并 | 全自动（有本地修改时跳过） |
| **二进制工具**（3个） | 版本检查 + 提示手动升级路径 | 半自动 |
| **npx 零安装**（8个） | 每次执行自动拉最新 | 无需操作 |

### 分维度手动更新

```bash
# 仅 npm
cd claude-scene && npm update

# 仅 Python
pip install --upgrade seraphim-audit git+https://github.com/NVIDIA/skillspector.git

# 仅二进制
winget upgrade nektos.act restic.restic     # Windows
brew upgrade lychee                          # macOS
```

> **建议频率**：每月跑一次 `update-all`，npm 依赖可随功能开发即时更新。

---

## 📚 相关资源

| 资源 | 链接 |
|------|------|
| 🔧 完整安装配置指南 | [INSTALL.md](./INSTALL.md) |
| 完整架构文档 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 🛡️ 外部安全工具链清单（33 个，唯一真值） | [.claude/rules/conditional/security-toolchain.md](./.claude/rules/conditional/security-toolchain.md) |
| 🎬 场景定义与场景表 | [.claude/scenes/README.md](./.claude/scenes/README.md) |
| Open Design | [github.com/nexu-io/open-design](https://github.com/nexu-io/open-design) |
| Claude Code SDK | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code-sdk/claude-code-headless) |
| **CodeGraph文档** | 已安装：`codegraph init -i` → `codegraph --help` |
| **前端美化工具** | DaisyUI + Animal Island UI + Animate.css |
