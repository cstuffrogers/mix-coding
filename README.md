# 🚀 Mix-Coding System — 快速入门指南

本指南帮助您在 5 分钟内启动并使用全自动代码开发系统。
适合非专业技术人员全自动开发，集成了GitHub中最热门的开发项目，高效无冲突。
---

## 📦 系统概览

这是一个基于 **三层架构 + Scene/Archon 双引擎** 的智能开发系统，支持：

- ✅ **35 个自动化工作流**：覆盖 Web 前端（29 个）+ 移动端（6 个），含代码审查、安全扫描、性能优化、E2E 测试、发布部署、环境搭建等
- ✅ **多轮自动审查与修复**：直到问题清零
- ✅ **AI 驱动设计**：Open Design，129 套品牌设计系统，零门槛
- ✅ **前端美化工具链**：DaisyUI（35+主题）+ Animal Island UI（自然风格）+ Animate.css + Lucide React + Playwright + Impeccable 设计打磨（27 条反AI模式规则）
- ✅ **5 层代码审查**：ESLint + TypeScript + 安全扫描 + npm audit + AI 语义 + Handler 功能验证（10 Pass 空转桩检测）
- ✅ **数据库迁移审查**：扫描迁移文件，检测 8 种危险模式（DROP TABLE / NOT NULL 无默认值等），自动阻断高风险变更
- ✅ **负载测试**：Artillery 集成，smoke/load/stress 三级测试，性能门禁
- ✅ **安全漏洞扫描**：ESLint 安全规则 + OWASP Top-10 + npm audit 依赖审计 + 安全响应头扫描 + 构建泄露检测 + 死链检测 + 开放重定向检测 + 状态管理审计 + 正则 ReDoS 扫描 + 日志脱敏 + CORS 检查 + 敏感文件检查 + 供应链安全扫描
- ✅ **外部工具链**：16 个工具（noleak / seraphim-audit / lychee / pa11y-ci / recheck-cli / Lighthouse CI / Clearible / log-sanitizer / cors-checker / env-leak-scanner / sensitive-file-check / deprecated-deps / knip / skillspector / aislop / dependency-cruiser）— 自动阻断构建泄露、安全响应头扫描、死链检测、日志脱敏、CORS 配置、环境变量泄露、恶意 install 脚本、供应链安全、敏感文件暴露、技术债务、lock 文件一致性、gitignore 最佳实践、废弃依赖、AST级死代码检测、AI技能安全
- ✅ **记忆组件组合**：7 种记忆工具协同工作
- ✅ **竞品分析**：OpenDigger 数据驱动决策
- ✅ **零冲突架构**：严格工具隔离与去重
- ✅ **AI/Model 无缝切换**：通过配置文件快速切换 AI 服务提供商，支持 Claude、Gemini、Qwen 等主流模型
- ✅ **双引擎驱动**：Scene 引擎（默认，会话内执行，上下文连贯）+ Archon 引擎（实验性，独立服务器，并行多任务）
- ✅ **Karpathy 原则集成**：强制执行 Think Before Coding、Simplicity First 等开发原则
- ✅ **Compound Engineering Plugin 集成**：AI 规划、深度审查、系统调试、知识沉淀，所有 35 个工作流自动集成

---

## 🏗️ 系统架构概览（三层架构）

本系统采用 **三层架构** 设计：

| 层级 | 作用 | 核心组件 |
|------|------|---------|
| **交互层** | 用户入口、场景选择、确认打断、结果展示 | [claude-scene CLI](./claude-scene/) |
| **能力层** | 具体业务能力实现（动作处理器） | [executeAction](./claude-scene/src/commands/start.js) |
| **运行时层** | 执行环境、模型调用、工具集成 | Scene 引擎（默认）+ Archon 引擎（实验性） |

👉 [查看完整架构文档](./ARCHITECTURE.md)

---

## 🛠️ 快速工具（一键操作）

| 工具 | 文件 | 功能 | 平台 |
|------|------|------|------|
| **Claude Code 启动器** | [start-claude.bat](./start-claude.bat) | 一键启动 Claude Code（已配置 DeepSeek V4 模型） | Windows |
| **CodeWhale 启动器** | [start-codewhale.bat](./start-codewhale.bat) | 一键启动 CodeWhale（DeepSeek 官方终端 AI 助手）| Windows |
| **安全升级工具** | [upgrade.bat](./upgrade.bat) | 备份→检查→升级→验证，零风险升级 | Windows |

---

## 🚀 快速开始

### 方式一：Claude Code 集成（推荐）
1. 双击 `start-claude.bat` 一键启动
2. 输入 `/` 查看所有可用命令
3. 使用 `/polish`、`/bugfix` 等命令

### 方式二：CodeWhale（DeepSeek TUI）
1. 双击 `start-codewhale.bat` 启动
2. 首次运行需要配置 API Key
3. 按 `Tab` 切换模式（Plan/Agent/YOLO）

### 方式三：CLI 工具（不依赖特定 AI 工具）
```bash
cd claude-scene
node src/index.js list                      # 查看所有场景
node src/index.js start ui-polish --auto    # 执行工作流
```

---

## 📋 35 个工作流场景

| 场景 | 步骤数 | 描述 | 命令 |
|------|--------|------|------|
| **ui-polish** | 23步 | 前端美化（DaisyUI + Animal Island UI + Animate.css + Playwright + Impeccable 设计打磨 + Huashu 专家评审 + AI-Friendly 审查 + Awesome Design MD 品牌 + 设计一致性保护） | `/polish` |
| **feature** | 27步 | 新增功能开发（CE 规划 + 测试驱动 + 多 Agent 审查） | `/feature` |
| **bugfix** | 28步 | Bug 修复（问题复现 → 根因定位 → 修复 → PR → 回归测试） | `/bugfix` |
| **review** | 15步 | 全面代码审查（ESLint + TypeScript + 安全 + AI 语义 + 状态管理审计 + 开放重定向 + Handler 功能验证 + i18n + 聚合报告） | `/review` |
| **refactor** | 21步 | 代码重构（代码度量 + 反模式检测 + 增量重构 + 测试验证） | `/refactor` |
| **optimize** | 14步 | 性能优化（问题选择 → 基线 → 反模式 → 测量确认 → 增量测试） | `/optimize` |
| **simplify** | 13步 | 代码简化（可读性优先，逐方向简化 + 测试保全） | `/simplify` |
| **hunt** | 24步 | 安全漏洞扫描与修复（ESLint 安全规则 + npm audit + OWASP + 开放重定向 + 安全响应头扫描 + 12 项外部工具链 + CE 沉淀） | `/hunt` |
| **design** | 22步 | AI 驱动设计（对话模式：web-design-engineer Skill 声明设计系统 + Awesome Design MD 品牌 + Impeccable 设计打磨 + Huashu 专家评审 + 交互原型） | `/design` |
| **analyze** | 15步 | 深度代码分析（复杂度 / 安全 / 性能 / CI + 自动修复） | `/analyze` |
| **loop** | 10步 | 自动迭代循环（无人值守，持续审查→修复→验证） | `/loop` |
| **new-project** | 21步 | 从零开始新项目（对话模式：web-design-engineer Skill 设计基准 + CLI 脚手架 + CE 规划） | `/new-project` |
| **release** | 23步 | 发布部署（质量门禁 + 版本号 + 构建 + 泄露检测 + Tag + 健康检查 + 监控） | `/release` |
| **audit** | 40步 | 全面项目健康检查（安全 + 代码 + 依赖 + 性能 + 覆盖率 + 复杂度 + 死代码 + 密钥扫描 + 安全响应头 + 死链 + 构建泄露 + 开放重定向 + 状态管理 + Lighthouse + Handler 功能验证 + i18n + 27 项质量门禁 + 信息图） | `/audit` |
| **prototype** | 11步 | 快速原型验证（需求访谈 + MVP 生成 + 本地运行 + 决策报告） | `/prototype` |
| **deps** | 14步 | 安全依赖更新（扫描过期 + 逐项更新 + Breaking Changes 检测 + 测试） | `/deps` |
| **rollback** | 14步 | 紧急回滚（版本选择 + 回滚 + 构建 + 健康检查 + 监控复原） | `/rollback` |
| **onboard** | 14步 | 开发环境搭建（检测语言 + 安装依赖 + 配置 .env + 启动服务） | `/onboard` |
| **migration** | 8步 | 数据库迁移审查：检测 8 种危险模式（DROP/NOT NULL 无默认值等），阻断高风险变更 | `/migration` |
| **loadtest** | 8步 | 负载测试（Artillery，smoke/load/stress 三级模式，性能门禁） | `/loadtest` |
| **backup** | 8步 | 加密去重备份（Restic 配置 + S3/SSH 远程备份 + 定时任务集成） | `/backup` |
| **changelog** | 9步 | 变更日志生成（Git 历史 + Conventional Commits + CHANGELOG.md 更新） | `/changelog` |
| **cicd** | 8步 | CI/CD 配置（Act + Taskfile 本地流水线 + GitHub Actions 验证） | `/cicd` |
| **docker** | 8步 | Docker 容器化（多阶段 Dockerfile + .dockerignore + docker-compose.yml） | `/docker` |
| **e2e** | 8步 | 端到端测试配置（MSW + Supertest + Schemathesis API fuzz） | `/e2e` |
| **incident** | 8步 | 事故响应手册（Runme Runbook + 健康检查 + 常见问题 + 升级路径） | `/incident` |
| **log** | 8步 | 日志配置（winston/pino/log4js + ELK/Fluentd 采集配置） | `/log` |
| **monitor** | 8步 | 网站监控（Upptime + GitHub Actions + 状态页 + 可用性告警） | `/monitor` |
| **sbom** | 8步 | 软件物料清单（SBOM 生成 + 许可证合规检测 + GPL/AGPL 阻断） | `/sbom` |
| **mobile-audit** | 22步 | App 安全审计（MobSF + mobsfscan + Bearer PII/GDPR + DependencyCheck CVE + OWASP MASVS + 5 层门禁） | `/mobile-audit` |
| **mobile-review** | 14步 | 移动端代码审查（ESLint → mobsfscan SAST → UI 截图 → AI 语义+a11y → 聚合报告 + 质量门禁） | `/mobile-review` |
| **mobile-release** | 18步 | App 发布部署（Fastlane 构建签名 → TestFlight/Play Store → Shorebird OTA → Sentry + 4 层门禁） | `/mobile-release` |
| **mobile-optimize** | 17步 | App 性能优化（Bundle 分析 + 启动优化 + 网络分析 + 反模式检测 + 自动修复 + 4 层门禁） | `/mobile-optimize` |
| **mobile-e2e** | 11步 | 移动端 E2E 测试（Detox/Maestro/Patrol 自动检测 + 配置生成 + CI 集成 + 3 层门禁） | `/mobile-e2e` |
| **mobile-onboard** | 16步 | App 开发环境搭建（平台感知前置条件 + RN Doctor + Fastlane + .env 模板 + 模拟器配置 + 门禁） | `/mobile-onboard` |

---

## 🔧 Action 处理器完整性

系统注册了 **280+ 个 action 处理器**（详见 `claude-scene/src/actions.js` 中的 `ACTION_REGISTRY`），覆盖 35 个工作流的全部步骤需求。常用 action 示例：

| Action | 用途 | 实现状态 |
|--------|------|---------|
| `recall` / `remember` / `consolidate` | 多后端记忆操作 | ✅ |
| `runReview` | 代码审查（支持 security/full/pr 模式） | ✅ |
| `runSuite` / `runAffected` / `test-coverage` | 测试套件运行 | ✅ |
| `select` / `confirm` | 交互式选择与确认 | ✅ |
| `generateDesign` / `analyze` | 设计与竞品分析 | ✅ |
| `analyzeUI` / `checkConsistency` / `applyDaisyUI` / `applyComponents` / `addAnimations` / `visualRegression` | 前端美化工具链 | ✅ |
| `check-api-consistency` | OpenAPI 标准管线（Redocly lint + 交叉验证 + openapi-typescript） | ✅ |
| `sec-bug-hunt` / `gitLeaks` / `npm-audit` / `security-headers` / `build-leak-check` / `dead-link-check` / `lighthouse-gate` / `open-redirect-scan` / `state-audit` / `i18n-audit` | 安全扫描 + 性能 + 架构 + i18n | ✅ |
| `verify-handlers` | Handler 功能验证：10 Pass 空转桩检测（内联桩/CE桩/逻辑密度/工具健康/依赖/导入链/场景交叉/静态安全/MCP配置） | ✅ |
| `migration-review` / `load-test` | 迁移审查 / 负载测试 | ✅ |
| `setup-monitor` / `setup-ci` / `setup-backup` / `setup-docker` / `setup-e2e` / `setup-logging` | 一键基础设施配置 | ✅ |
| `incident-runbook` / `generate-changelog` / `generate-sbom` | 事故/变更/SBOM 自动化 | ✅ |
| `huashu-*`（7 个） | Huashu 品牌设计系统集成 | ✅ |
| `awm-brand-*`（2 个） | Awesome Design MD 品牌导入（list + import） | ✅ |
| `mp-*`（10 个） | Matt Pocock TypeScript skill 桥接 | ✅ |
| `ce-*` | Compound Engineering Plugin 集成 | ✅ |
| `notify` / `send` | 通知与告警 | ✅ |

---

## 🎨 前端美化工具链

### Animal Island UI 风格转换

```bash
# CLI 命令
node src/index.js start ui-polish --auto --theme animal-island --target "E:\your\project"

# 执行步骤
1. recall         → 注入历史上下文和相关记忆
2. listMemories   → 召回之前的 UI 优化记录（Memory MCP）
3. analyzeUI      → 分析项目结构，统计 CSS/组件文件
3.5. web-design-declare-system → Web Design Engineer: 声明设计系统基准（Palette/Typography/Spacing/Motion/Radius/Shadows）
4. installDeps    → 安装 animal-island-ui, daisyui, lucide-react, animate.css
5. checkConsistency → 检查 UI 一致性，输出评分
6. confirm        → 用户选择主题（DaisyUI/Animal Island/Custom/Huashu/Awesome Design MD 品牌）
6.5. awm-brand-import → Awesome Design MD: 加载品牌 DESIGN.md 注入 CSS 变量（条件触发）
6.7. reconcileDesignTokens → 设计 Token 调和：检测已有 DESIGN.md / CSS 变量 / tailwind.config.js，已有值优先，新主题填充缺失，避免覆盖 design 工作流产出的设计系统
7. applyDaisyUI   → 整合应用主题：保留已有 Token 前提下合并到 tailwind.config.js 和 index.css
8. applyComponents → 扫描 JSX/TSX 替换为 Animal Island UI 组件（仅 animal-island 主题）
9. addAnimations  → 集成 Animate.css + Lucide React 图标
9.5. web-design-verify → Web Design Engineer: 设计交付检查（无控制台错误/无破损布局/对比度合格）
9.6. impeccable-critique → Impeccable 设计打磨：27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感（纯黑/纯白/紫色渐变等）
9.65. huashu-expert-review → Huashu 5 维度专家评审（philosophy/hierarchy/craft/functionality/originality）
9.7. ai-friendly-review → AI-Friendly Web Design: 可访问性审查（语义HTML/ARIA/对比度）
10. runSuite      → 运行前端测试
11. visualRegression → Playwright 视觉回归测试（Desktop/Tablet/Mobile）
12. checkAPIConsistency → OpenAPI 标准管线（Redocly lint → bundle → 交叉验证 → openapi-typescript）
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

### 完整流程说明

| 步骤 | 名称 | 类型 | 描述 | 条件触发 |
|------|------|------|------|---------|
| **Step 1** | 全量记忆注入 | 自动 | 注入 7 后端（project-memory + Claude-Mem + agentmemory + NEXO + CodeGraph + MemPalace + Supermemory） | 总是执行 |
| **Step 1.1** | GitHub 最佳实践搜索 | 可选 | 使用 GitHub MCP 搜索同类型项目最佳实践 | github_mcp_available |
| **Step 1.2** | Tavily 架构搜索 | 可选 | 搜索项目类型的架构最佳实践 2024 | tavily_mcp_available |
| **Step 1.3** | Context7 文档获取 | 可选 | 获取相关技术栈的文档 | context7_mcp_available |
| **Step 1.4** | Supabase 数据库模板 | 可选 | 获取数据库模板 | supabase_mcp_available && database_required |
| **Step 1.5** | Stripe 支付流程模板 | 可选 | 获取支付流程模板 | stripe_mcp_available && payment_required |
| **Step 1.6** | Resend 邮件模板 | 可选 | 获取邮件模板 | resend_mcp_available && email_required |
| **Step 2** | CE 项目规划 | 可选 | Compound Engineering Plugin 生成详细规划 | plugin_ce_available |
| **Step 3** | OpenDigger 竞品分析 | 可选 | 分析竞品数据（90天 OpenRank） | user_mentioned_competitor_or_domain |
| **Step 4** | 技术方案设计 | 交互 | 生成技术方案并等待用户确认 | 总是执行 |
| **Step 4.5** | Open Design 设计选择 | 交互 | 询问是否需要使用 Open Design 进行 UI 设计 | 总是执行 |
| **Step 4.6** | 重构检查选择 | 交互 | 询问是否需要进行代码重构检查 | 总是执行 |
| **Step 5** | Open Design 设计生成 | 可选 | AI 生成设计（129套品牌系统） | frontend_involved **或者** user_confirmed_open_design |
| **Step 5.1** | 代码度量分析 | 可选 | 计算圈复杂度、维护性得分 | user_confirmed_refactor |
| **Step 5.2** | 反模式检测 | 可选 | 检测 God Object、长方法、重复代码等 | user_confirmed_refactor |
| **Step 5.3** | 重构计划生成 | 可选 | 生成代码结构调整和测试覆盖率要求 | user_confirmed_refactor |
| **Step 5.4** | 测试套件运行 | 可选 | 运行单元测试确保代码质量 | user_confirmed_refactor |
| **Step 5.5** | 代码质量审查 | 可选 | 代码规范检查、重构完整性评估 | user_confirmed_refactor |
| **Step 6** | 全量代码审查 | 自动 | ESLint + TypeScript + 安全扫描 + npm audit + AI 语义 | 总是执行 |
| **Step 7** | 完整测试运行 | 自动 | 运行所有单元测试确保功能正确 | 总是执行 |
| **Step 8** | 知识沉淀 | 可选 | 将项目创建知识保存到 CLAUDE.md | plugin_ce_available |
| **Step 9** | 完成通知 | 自动 | 通知用户项目初始化完成 | 总是执行 |

### 可选功能说明

- **Open Design AI 设计**：用户选择启用后，使用 129 套品牌系统（Stripe/Linear/Vercel/Apple 等风格）生成专业 UI 设计
- **代码重构检查**：用户选择启用后，进行代码质量分析，检测反模式，提供重构建议

---

## 🔒 安全漏洞审查

### hunt 场景工作流

```bash
node src/index.js start hunt --auto --target "E:\your\project"
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

## 🛡️ 外部工具链

以下工具已集成到对应工作流中，自动执行，零冲突：

| 工具 | 类型 | 负责工作流 | 功能 | 阻断级别 |
|------|------|-----------|------|---------|
| **noleak** | npm CLI | `/release` (step 8.5), `/audit` (step 8.7) | 构建产物泄露检测：Source Map / .env / 密钥 / .git 目录扫描 | BLOCK-RELEASE |
| **seraphim-audit** | Python CLI | `/hunt` (step 4.5), `/audit` (step 3.5) | 安全响应头扫描：CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy | — |
| **lychee** | Rust 二进制 | `/audit` (step 8.5) | 死链接检测：扫描项目 Markdown/HTML 文件中的失效链接 | — |
| **Lighthouse CI** | npm CLI | `/release` (step 8.6), `/audit` (step 8.8) | 性能门禁：LCP/CLS/TBT 断言 + 缓存策略 + PWA 离线检查 | BLOCK-RELEASE |

| **Clearible** | npm CLI | `/review` (step 2.7), `/audit` (step 6.6) | React 状态管理审计：Context 过度使用/耦合度/循环依赖/多库混用 | — |
| **pa11y-ci** | npm CLI | `/review` (a11y 增强层) | WCAG 2.1 AA 深度无障碍扫描 | — |
| **recheck-cli** | npm CLI | `/hunt` (step 4.7), `/audit` (step 3.6) | 正则 ReDoS 灾难性回溯扫描 | — |
| **log-sanitizer** | 内置 grep | `/hunt` (step 4.8), `/audit` (step 3.7), `/review` (step 4.3) | 日志脱敏扫描：Token/密码/身份证/手机号/邮箱泄露检测 | — |
| **cors-checker** | 内置 grep | `/hunt` (step 4.9), `/audit` (step 3.8), `/review` (step 4.4) | CORS 配置检测：通配符 + credentials 泄露 | — |
| **env-leak-scanner** | 内置 grep | `/hunt` (step 4.10), `/audit` (step 3.9), `/review` (step 4.5) | 前端环境变量泄露：Vite import.meta.env / process.env 浏览器端泄露 | — |
| **sensitive-file-check** | 内置 git | `/hunt` (step 4.12), `/audit` (step 3.12), `/review` (step 4.6) | 敏感文件暴露检查：.env/*.pem/*.key/credentials.json | — |
| **deprecated-deps** | npm CLI | `/audit` (step 3.16) | 废弃/未维护依赖检测：npm outdated 识别 deprecated 包 | — |
| **knip** | npx CLI | `/audit` (verifier Pass 7), `/review` (verifier Pass 7) | AST 级死代码/依赖检测：未使用文件/未使用导出/未解析导入/未声明依赖/未使用依赖（11k+ stars） | — |

### 工具安装

```bash
# 核心工具（Phase 1）
npm install -D noleak pa11y-ci recheck-cli @lhci/cli clearible knip    # npm 工具
pip install git+https://github.com/seraphimhub/seraphim-audit.git  # seraphim-audit (Python 零依赖)
# lychee: 下载 Windows 二进制 → https://github.com/lycheeverse/lychee/releases
```

---

## 💬 使用方式

### 在 Trae 中使用（推荐）

**方式一：使用 `/` 指令触发**
```
/polish animal-island E:\my-app
/bugfix 登录页面表单验证报错
/feature 添加用户管理模块
/review
/hunt
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
| `--theme <name>` | 指定主题（daisyui/animal-island/custom/huashu/awm-brand） |
| `--option <name>` | 指定选项（用于 optimize/simplify 场景） |
| `--prompt <text>` | 指定提示信息 |

---

## 📁 项目结构

```
mix-coding/
├── .claude/
│   ├── scenes/               # 场景定义（35 个 JSON）
│   │   ├── ui-polish.json    bugfix.json     feature.json
│   │   ├── review.json       refactor.json   optimize.json
│   │   ├── simplify.json     hunt.json       design.json
│   │   ├── analyze.json      loop.json       new-project.json
│   │   ├── release.json      audit.json      prototype.json
│   │   ├── deps.json         rollback.json   onboard.json
│   │   ├── migration.json    loadtest.json   backup.json
│   │   ├── changelog.json    cicd.json       docker.json
│   │   ├── e2e.json          incident.json   log.json
│   │   ├── monitor.json      sbom.json
│   │   ├── mobile-audit.json mobile-review.json mobile-release.json
│   │   ├── mobile-optimize.json mobile-e2e.json mobile-onboard.json
│   ├── commands/             # Slash commands（35 个工作流 + jvn /spec /design /build /report 等）
│   ├── rules/                # 项目规则（coding / karpathy-principles / memory-auto-save / mobile-coding / mobile-security-rules 等）
│   ├── skills/               # Claude Skills（含 mobile-ui-review）
│   └── agents/               # 8 个 Agent（PM/架构师/UX/审查/宪法校验 + mobile-reviewer/mobile-security/mobile-perf）
│
├── claude-scene/             # CLI 工具（Scene 引擎）
│   └── src/
│       ├── commands/         # CLI 命令（list / show / start / fork）
│       ├── handlers/         # 能力处理器
│       └── lib/              # 工具库（含 huashu 设计集成）
│
├── .archon/workflows/        # Archon YAML 工作流（实验性引擎，12 个场景）
│
├── constitution.md           # 项目宪法（constitutional-validator Agent 强制执行）
├── CLAUDE.md                 # 项目主指令
├── ARCHITECTURE.md           # 完整架构文档
├── upgrade.bat / start-claude.bat / start-codewhale.bat   # 一键工具
└── README.md
```

---

## 🔧 MCP 动态启用

| 工作流 | 启用的 MCP 服务器 |
|--------|-------------------|
| new-project | github, tavily-search, context7, supabase, stripe, resend |
| feature | github, context7, supabase |
| bugfix | sentry, tavily-search, context7, github, codegraph |
| refactor | github, context7 |
| design | tavily-search, context7 |
| ui-polish | memory, playwright |
| simplify | github, context7 |
| optimize | github, context7 |
| review | github, context7 |
| hunt | sentry, tavily-search, context7, github, codegraph |
| analyze | tavily-search, opendigger |
| loop | github, context7 |
| release | github |
| audit | github, tavily-search, context7, codegraph |
| prototype | （无） |
| deps | github |
| rollback | github, codegraph |
| onboard | （无） |
| migration | github |
| loadtest | （无） |
| backup | （无） |
| changelog | github |
| cicd | github |
| docker | （无） |
| e2e | （无） |
| incident | github |
| log | （无） |
| monitor | github |
| sbom | github |
| mobile-audit | mobsf, mobsfscan, bearer, sentry, dependencycheck |
| mobile-review | mobsfscan, detox, maestro, codegraph, mobile-ui-review |
| mobile-release | github, fastlane, sentry, shorebird |
| mobile-optimize | bundle-visualizer, detox, toxiproxy |
| mobile-e2e | detox, maestro, patrol |
| mobile-onboard | react-native-doctor, fastlane |

---

## 📱 移动端工具支持

6 个移动端工作流自动检测可用工具，缺失工具自动跳过对应步骤并输出安装指引。

| 工作流 | 支持的工具 |
|--------|-----------|
| **mobile-audit** | MobSF、mobsfscan、Bearer CLI、DependencyCheck |
| **mobile-review** | ESLint + TypeScript、mobsfscan、Maestro/Detox |
| **mobile-release** | Fastlane、Shorebird、Sentry |
| **mobile-optimize** | Bundle Visualizer、Lighthouse、Toxiproxy |
| **mobile-e2e** | Detox、Maestro、Patrol |
| **mobile-onboard** | RN Doctor、Fastlane、Android SDK |

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
cd E:\your\project
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
| **Claude Skills** | `npx skills install 技能名` | 技能插件生态（12+主流插件） |
| **Impeccable Skill** | `echo Y \| npx --yes impeccable@2.3.2 skills install` | AI 设计词汇 + 27 反模式规则 + 12 LLM 批判规则，自动修正 UI 塑料感 |
| **Web Design Skill** | 手动复制 `SKILL.md` 到 `.claude/skills/web-design-engineer/` | ConardLi: 反AI套路设计系统 |
| **AI-Friendly Design** | `npx ai-friendly-web-design-skill --local` | ianho7: 语义HTML/ARIA可访问性 |
| **Awesome Design MD** | `git clone https://github.com/VoltAgent/awesome-design-md .claude/skills/awesome-design-md` | 5 精选品牌 DESIGN.md（Vercel/Linear/Stripe/Notion/Apple） |
| **MCP服务器** | `claude mcp install github playwright supabase` | AI上下文增强扩展 |
| **记忆工具** | `git clone https://github.com/claude-mem \`%USERPROFILE%\.claude\skills\claude-mem` + `npx nexo-brain@latest init` | 7种记忆组件组合使用（project-memory / Claude-Mem / agentmemory / NEXO / CodeGraph / MemPalace / Supermemory） |
| **安全工具链** | `npm install -D noleak pa11y-ci recheck-cli @lhci/cli clearible knip` + `pip install seraphim-audit` + Socket.dev API Key 配置 | 构建泄露检测 / 安全响应头 / 死链 / 无障碍 / ReDoS / 性能门禁 / AST 安全扫描 / 状态管理审计 / AST 死代码检测 / 日志脱敏 / CORS / 敏感文件 / 供应链安全 / 技术债务 |
| **App Store** | [claude代码商店](https://github.com/topics/claude-app-store) | 更多Claude扩展工具 |

---

## 📚 相关资源

| 资源 | 链接 |
|------|------|
| 🔧 完整安装配置指南 | [INSTALL.md](./INSTALL.md) |
| 完整架构文档 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 📋 完整工具清单与使用矩阵 | [docs/tools-inventory.md](./docs/tools-inventory.md) |
| CodeWhale 安装配置 | https://codewhale.net/zh/install |
| Archon 官方仓库 | [github.com/coleam00/Archon](https://github.com/coleam00/Archon) |
| Open Design | [github.com/nexu-io/open-design](https://github.com/nexu-io/open-design) |
| Claude Code SDK | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code-sdk/claude-code-headless) |
| **CodeGraph文档** | 已安装：`codegraph init -i` → `codegraph --help` |
| **前端美化工具** | DaisyUI + Animal Island UI + Animate.css |
