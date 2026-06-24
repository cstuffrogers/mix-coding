# 🚀 Mix-Coding System — 快速入门指南

本指南帮助您在 5 分钟内启动并使用全自动代码开发系统。
适合非专业技术人员全自动开发，集成了GitHub中最热门的开发项目，高效无冲突。
---

## 📦 系统概览

这是一个基于 **三层架构 + Scene 引擎** 的智能开发系统，支持：

- ✅ **28 个自动化工作流**：覆盖 Web 前端（22 个）+ 移动端（6 个），含代码审查、安全扫描、性能优化、E2E 测试、发布部署、环境搭建等。另有 9 个功能已融入增强菜单（cicd/deps/monitor/hunt/release/e2e/review/feature 内按需弹出）
- ✅ **多轮自动审查与修复**：直到问题清零
- ✅ **AI 驱动设计**：Open Design 完整集成（152 品牌 + 111 设计模板 + 137 Skill + 6 设备框 + 3 演示文稿 + 102 提示词模板 + 11 craft 设计铁律），零设计门槛
- ✅ **前端美化工具链**：DaisyUI（35+主题）+ Animal Island UI（自然风格）+ Animate.css + Lucide React + Playwright + Impeccable 全维度设计打磨（shape 设计简报 + 27 条反AI模式规则 + 12 条 LLM 批判规则 + 双轮品控 + 3 项精准残留修复）+ web-design-engineer Skill（OKLCH 色彩系统 + 反AI套路规则 + 设计基准声明，所有模式必须执行）
- ✅ **5 层代码审查**：ESLint + TypeScript + 安全扫描 + npm audit + AI 语义 + Handler 功能验证（10 Pass 空转桩检测）
- ✅ **数据库迁移审查**：扫描迁移文件，检测 8 种危险模式（DROP TABLE / NOT NULL 无默认值等），自动阻断高风险变更
- ✅ **负载测试**：Artillery 集成，smoke/load/stress 三级测试，性能门禁
- ✅ **安全漏洞扫描**：ESLint 安全规则 + OWASP Top-10 + npm audit 依赖审计 + 安全响应头扫描 + 构建泄露检测 + 死链检测 + 开放重定向检测 + 状态管理审计 + 正则 ReDoS 扫描 + 日志脱敏 + CORS 检查 + 敏感文件检查 + 供应链安全扫描
- ✅ **外部工具链**：16 个工具（noleak / seraphim-audit / lychee / pa11y-ci / recheck-cli / log-sanitizer / cors-checker / env-leak-scanner / sensitive-file-check / deprecated-deps / knip / skillspector / aislop / dependency-cruiser / Lighthouse CI / prototype-pollution）— 自动阻断构建泄露、安全响应头扫描、死链检测、日志脱敏、CORS 配置、环境变量泄露、恶意 install 脚本、供应链安全、敏感文件暴露、技术债务、lock 文件一致性、gitignore 最佳实践、废弃依赖、AST级死代码检测、AI技能安全、AI代码气味、依赖架构、性能门禁、原型链污染
- ✅ **记忆组件组合**：7 种记忆工具协同工作
- ✅ **竞品分析**：OpenDigger 数据驱动决策
- ✅ **零冲突架构**：严格工具隔离与去重
- ✅ **AI/Model 无缝切换**：通过配置文件快速切换 AI 服务提供商，支持 Claude、Gemini、Qwen 等主流模型
- ✅ **编码原则四重防线**：Ponytail（写之前阻断）+ Karpathy（写之时约束）+ CodeGuardian（改之后验证）+ `/simplify`（写之后清理），合并为 `conditional/core-rules.md` 按需加载
- ✅ **jvn Spec-Driven 开发**：`/spec` → `/design` → `/build` 规范驱动开发，底层由 [GitHub Spec-Kit](https://github.com/github/spec-kit)（12 speckit 技能）驱动，5 Agent 增强审查（PM + 架构师 + UX + 代码审查 + 宪法校验）

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
| **Claude Code 启动器** | [start-claude.bat](./start-claude.bat) / [start-claude.sh](./start-claude.sh) | 一键启动 Claude Code | Windows / macOS / Linux |
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

## 📋 28 个工作流场景

> 另有 9 个功能已融入增强菜单（backup/docker→cicd、sbom→deps、loadtest→e2e、log/incident→monitor、changelog→release、migration→review、llm-proxy-audit→hunt），对应父工作流中按需弹出。

| 场景 | 步骤数 | 描述 | 命令 |
|------|--------|------|------|
| **ui-polish** | 69 步 | 前端美化（全对话模式：设计系统声明 → 主题注入 → Impeccable 全维度打磨 + AI-Friendly 审查） | `/ui-polish` |
| **new-project** | 66 步 | 从零开始新项目（设计基准 → shape 简报 → 上下文收集 → CE 规划 → Open Design + Impeccable + AI-Friendly） | `/new-project` |
| **design** | 53 步 | AI 辅助 UI 设计（设计系统 → 品牌选择 → 三方向提案 → 专家评审 → 验证） | `/design` |
| **audit** | 47 步 | 全面项目健康检查（27 项质量门禁 + 信息图） | `/audit` |
| **review** | 33 步 | 全面代码审查（ESLint + TypeScript + 安全 + AI 语义）+ 迁移审查/QA/i18n/无障碍可选增强 | `/review` |
| **bugfix** | 30 步 | Bug 修复（问题复现 → 根因定位 → 修复 → PR → 回归测试） | `/bugfix` |
| **feature** | 26 步 | 新功能开发（CE 规划 + 测试驱动 + 多 Agent 审查） | `/feature` |
| **hunt** | 24 步 | 安全漏洞扫描与修复（12 项外部工具链 + CE 沉淀）+ LLM 代理审计可选增强 | `/hunt` |
| **mobile-audit** | 24 步 | App 安全审计（MobSF + mobsfscan + Bearer + DependencyCheck + 5 层门禁） | `/mobile-audit` |
| **refactor** | 23 步 | 代码重构（代码度量 + 反模式检测 + 增量重构 + 测试验证） | `/refactor` |
| **release** | 24 步 | 发布部署（质量门禁 + 版本号 + 构建 + 泄露检测 + Tag + 健康检查 + 监控）+ CHANGELOG 可选增强 | `/release` |
| **mobile-optimize** | 19 步 | App 性能优化（Bundle 分析 + 启动优化 + 网络分析 + 反模式检测 + 4 层门禁） | `/mobile-optimize` |
| **analyze** | 18 步 | 深度代码分析（复杂度 / 安全 / 性能 / CI + 自动修复） | `/analyze` |
| **mobile-release** | 18 步 | App 发布部署（证书检查 → 质量门禁 → 版本号 → CHANGELOG → TestFlight/Play Store + 4 层门禁） | `/mobile-release` |
| **deps** | 17 步 | 安全依赖更新（扫描过期 + 逐项更新 + Breaking Changes 检测 + 测试）+ SBOM 可选增强 | `/deps` |
| **mobile-review** | 17 步 | 移动端代码审查（ESLint + mobsfscan SAST + UI 截图 + AI 语义+a11y + 聚合报告） | `/mobile-review` |
| **optimize** | 17 步 | 性能优化（问题选择 → 基线 → 反模式 → 测量确认 → 增量测试） | `/optimize` |
| **mobile-onboard** | 16 步 | App 开发环境搭建（平台感知前置条件 + RN Doctor + .env 模板 + 模拟器配置） | `/mobile-onboard` |
| **onboard** | 16 步 | 开发环境搭建（检测语言 + 安装依赖 + 配置 .env + 启动服务） | `/onboard` |
| **rollback** | 16 步 | 紧急回滚（版本选择 + 回滚 + 构建 + 健康检查 + 监控复原） | `/rollback` |
| **simplify** | 15 步 | 代码简化（可读性优先，逐方向简化 + 测试保全） | `/simplify` |
| **loop** | 13 步 | 自动迭代循环（无人值守，持续审查→修复→验证） | `/loop` |
| **mobile-e2e** | 13 步 | 移动端 E2E 测试（Detox/Patrol 自动检测 + 配置生成 + CI 集成 + 3 层门禁） | `/mobile-e2e` |
| **cicd** | 12 步 | CI/CD 配置（Act + Taskfile 本地流水线 + GitHub Actions 验证）+ Docker 化/备份可选增强 | `/cicd` |
| **e2e** | 9 步 | 端到端测试配置（MSW + Supertest + Schemathesis API fuzz）+ 负载测试可选增强 | `/e2e` |
| **monitor** | 9 步 | 网站监控（Upptime + GitHub Actions + 状态页）+ 日志/Incident Runbook 可选增强 | `/monitor` |
| **qa** | 11 步 | 浏览器 QA 验证（git diff → 浏览器测试 → Bug 分级报告），也作为 /review 增强 | `/qa` |
| **plan-ceo-review** | 10 步 | 创始人策略审查（10x 分析 + 精简化 + 用户价值三桶），也作为 /feature 增强 | `/plan-ceo-review` |

---

## 🔧 Action 处理器完整性

系统注册了 **321 个 action 处理器**（详见 `claude-scene/src/actions.js` 中的 `ACTION_REGISTRY`），覆盖 28 个工作流的全部步骤需求。常用 action 示例：

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
| `awm-brand-*`（2 个） | Open Design 品牌导入（list + import） | ✅ |
| `mp-*`（10 个） | Matt Pocock TypeScript skill 桥接 | ✅ |
| `ce-*` | Compound Engineering Plugin 集成 | ✅ |
| `notify` / `send` | 通知与告警 | ✅ |

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

## 🛡️ 外部工具链

以下工具已集成到对应工作流中，自动执行，零冲突：

| 工具 | 类型 | 负责工作流 | 功能 | 阻断级别 |
|------|------|-----------|------|---------|
| **noleak** | npm CLI | `/release` (step 8.5), `/audit` (step 8.7) | 构建产物泄露检测：Source Map / .env / 密钥 / .git 目录扫描 | BLOCK-RELEASE |
| **seraphim-audit** | Python CLI | `/hunt` (step 4.5), `/audit` (step 3.5) | 安全响应头扫描：CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy | — |
| **lychee** | Rust 二进制 | `/audit` (step 8.5) | 死链接检测：扫描项目 Markdown/HTML 文件中的失效链接 | — |
| **Lighthouse CI** | npm CLI | `/release` (step 8.6), `/audit` (step 8.8) | 性能门禁：LCP/CLS/TBT 断言 + 缓存策略 + PWA 离线检查 | BLOCK-RELEASE |
| **pa11y-ci** | npm CLI | `/review` (a11y 增强层) | WCAG 2.1 AA 深度无障碍扫描 | — |
| **recheck-cli** | npm CLI | `/hunt` (step 4.7), `/audit` (step 3.6) | 正则 ReDoS 灾难性回溯扫描 | — |
| **log-sanitizer** | 内置 grep | `/hunt` (step 4.8), `/audit` (step 3.7), `/review` (step 4.3) | 日志脱敏扫描：Token/密码/身份证/手机号/邮箱泄露检测 | — |
| **cors-checker** | 内置 grep | `/hunt` (step 4.9), `/audit` (step 3.8), `/review` (step 4.4) | CORS 配置检测：通配符 + credentials 泄露 | — |
| **env-leak-scanner** | 内置 grep | `/hunt` (step 4.10), `/audit` (step 3.9), `/review` (step 4.5) | 前端环境变量泄露：Vite import.meta.env / process.env 浏览器端泄露 | — |
| **sensitive-file-check** | 内置 git | `/hunt` (step 4.12), `/audit` (step 3.12), `/review` (step 4.6) | 敏感文件暴露检查：.env/*.pem/*.key/credentials.json | — |
| **deprecated-deps** | npm CLI | `/audit` (step 3.16) | 废弃/未维护依赖检测：npm outdated 识别 deprecated 包 | — |
| **knip** | npx CLI | `/audit` (verifier Pass 7), `/review` (verifier Pass 7) | AST 级死代码/依赖检测：未使用文件/未使用导出/未解析导入/未声明依赖/未使用依赖（11k+ stars） | — |
| **skillspector** | Python CLI | `/hunt` (step 4.15), `/audit` (step 3.18) | AI 技能安全扫描：提示注入/数据外泄/权限提升/供应链攻击等 64 种漏洞模式（NVIDIA, 2.5k+ stars） | — |
| **aislop** | npx CLI | `/review` (step 2.9), `/audit` (step 3.19) | AI 代码气味扫描：50+ 规则检测叙事注释/吞异常/死代码/as any 滥用/重复 helper（子秒级确定性） | — |
| **dependency-cruiser** | npx CLI | `/audit` (step 3.20) | 依赖架构验证：循环依赖检测/孤儿模块识别/架构分层合规/调用图生成（6.7k+ stars） | — |
| **prototype-pollution** | ESLint 规则 | `/audit` (step 1, 2), `/hunt` (step 3), `/review` (step 2 lint) | no-prototype-builtins 原型链污染检测 | — |

### 工具安装

```bash
# 核心工具（跨平台 npm）
npm install -D noleak pa11y-ci recheck-cli knip

# Python 工具（macOS/Linux/Windows 均支持）
pip install git+https://github.com/seraphimhub/seraphim-audit.git
pip install git+https://github.com/NVIDIA/skillspector.git

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
| `--theme <name>` | 指定主题（daisyui/animal-island/custom/huashu/open-design） |
| `--option <name>` | 指定选项（用于 optimize/simplify 场景） |
| `--prompt <text>` | 指定提示信息 |

---

## 📁 项目结构

```
mix-coding/
├── .claude/
│   ├── scenes/               # 场景定义（28 个 JSON）
│   │   ├── ui-polish.json    bugfix.json     feature.json
│   │   ├── review.json       refactor.json   optimize.json
│   │   ├── simplify.json     hunt.json       design.json
│   │   ├── analyze.json      loop.json       new-project.json
│   │   ├── release.json      audit.json
│   │   ├── deps.json         rollback.json   onboard.json
│   │   ├── cicd.json         e2e.json        monitor.json
│   │   ├── qa.json           plan-ceo-review.json
│   │   ├── mobile-audit.json mobile-review.json mobile-release.json
│   │   ├── mobile-optimize.json mobile-e2e.json mobile-onboard.json
│   ├── commands/             # Slash commands（28 个工作流 + jvn /spec /design /build /report 等）
│   ├── rules/                # 项目规则（conditional/ 按需加载：core-rules / workflows / enhancements 等 9 个）
│   ├── skills/               # Claude Skills（22 个：10 核心 + 12 speckit）
│   └── agents/               # 8 个 Agent（PM/架构师/UX/审查/宪法校验 + mobile-reviewer/mobile-security/mobile-perf）
│
├── .specify/                 # Spec-Kit 配置（templates / scripts / memory）
├── claude-scene/             # CLI 工具（Scene 引擎）
│   └── src/
│       ├── commands/         # CLI 命令（list / show / start / fork）
│       ├── handlers/         # 能力处理器
│       └── lib/              # 工具库（含 huashu 设计集成）
├── scripts/                  # 项目脚本（Node.js .cjs，跨平台不假死）
│   ├── scan-scenes.cjs       # 扫描所有 scene 真实步骤数
│   ├── find-deadcode.cjs     # 死代码扫描
│   ├── check-memory-system.cjs # 记忆系统状态检查
│   └── setup-mempalace.cjs   # MemPalace MCP 一键配置
├── constitution.md           # 项目宪法（constitutional-validator Agent 强制执行）
├── CLAUDE.md                 # 项目主指令（精简后 ~65 行，全量加载）
├── ARCHITECTURE.md           # 完整架构文档
├── upgrade.bat / start-claude.bat   # 一键工具
└── README.md
```

---

## 🧠 MemPalace 记忆系统（MCP 工具调用）

**状态**：✅ 已通过 MCP 工具调用（不走 hook 避免 Windows 路径转义假死）

### 架构变化

```
旧架构（已废弃）：Trae/Claude Code → hook 脚本 → 假死 ❌
新架构（当前）：   Trae/Claude Code ─┬─→ [禁用 hook] sys.exit(0) 立即返回
                                  └─→ MCP 工具调 mempalace ✅
```

### 用法

| 场景 | Claude 主动调用的 MCP 工具 |
|------|----------------------------|
| 用户问"上次 / 之前 / 那个" | `mcp__mempalace__search` |
| 重要决策 / 关键 bug 修复 | `mcp__mempalace__remember` |
| 项目知识沉淀 | `mcp__mempalace__store` |
| 列出所有记忆 | `mcp__mempalace__list` |

### 安装配置

```bash
# mempalace CLI 需先安装
uv tool install mempalace

# 一键配置（修改 .mcp.json 用全路径避免 Windows 路径问题）
npm run setup:mempalace

# 验证
npm run scan:memory
```

### 一键脚本

| 脚本 | 作用 |
|------|------|
| `npm run setup:mempalace` | 安装 + 配置 |
| `npm run scan:memory` | 状态扫描 |
| `npm run scan:deadcode` | 死代码扫描 |
| `npm run scan:all` | 综合扫描 |

详细说明见 [docs/省token.md](./docs/省token.md)

---

## 🔧 MCP 动态启用

| 工作流 | 启用的 MCP 服务器 |
|--------|-------------------|
| new-project | github, context7, supabase, stripe, resend, mempalace |
| feature | github, context7, supabase, mempalace |
| bugfix | sentry, context7, github, codegraph, mempalace |
| refactor | github, context7, mempalace |
| design | context7, mempalace |
| ui-polish | memory, playwright, mempalace |
| simplify | github, context7, mempalace |
| optimize | github, context7, mempalace |
| review | github, context7, mempalace |
| hunt | sentry, context7, github, codegraph, mempalace |
| analyze | opendigger, mempalace |
| loop | github, context7, mempalace |
| release | github, mempalace |
| audit | github, context7, codegraph, mempalace |
| deps | github, mempalace |
| rollback | github, codegraph, mempalace |
| changelog | github, mempalace |
| cicd | github, mempalace |
| incident | github, mempalace |
| monitor | github, mempalace |
| sbom | github, mempalace |
| mobile-audit | mobsf, mobsfscan, bearer, sentry, dependencycheck, mempalace |
| mobile-review | mobsfscan, detox, codegraph, mobile-ui-review, mempalace |
| mobile-release | github, mempalace |
| mobile-optimize | bundle-visualizer, detox, toxiproxy, mempalace |
| mobile-e2e | detox, patrol, mempalace |
| mobile-onboard | react-native-doctor, mempalace |
| llm-proxy-audit | lobstertrap, mempalace |

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
| **Claude Skills** | `npx skills install 技能名` | 技能插件生态（12+主流插件） |
| **Spec-Kit** | `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` + `specify init --here --integration claude --force` | GitHub Spec-Driven Development 引擎（12 speckit 技能） |
| **Impeccable Skill** | `echo Y \| npx --yes impeccable@2.3.2 skills install` | AI 设计词汇 + 27 反模式规则 + 12 LLM 批判规则，自动修正 UI 塑料感 |
| **Web Design Skill** | 复制 `SKILL.md` 到 `.claude/skills/web-design-engineer/`（注意：前序元数据仅保留 name/description/user-invocable） | ConardLi: 反AI套路设计系统，OKLCH 色彩 + 6步工作流 + 预交付检查清单 |
| **AI-Friendly Design** | `npx ai-friendly-web-design-skill --local` | ianho7: 语义HTML/ARIA可访问性 |
| **Awesome Design MD** | `git clone https://github.com/VoltAgent/awesome-design-md .claude/skills/awesome-design-md`（同上，注意前序元数据格式） | 5 精选品牌 DESIGN.md（Vercel/Linear/Stripe/Notion/Apple），已升级为 Open Design 152 品牌库直接文件读取 |
| **MCP服务器** | `claude mcp install github playwright supabase` | AI上下文增强扩展 |
| **记忆工具** | `git clone https://github.com/claude-mem \`%USERPROFILE%\.claude\skills\claude-mem` + `npx nexo-brain@latest init` | 7种记忆组件组合使用（project-memory / Claude-Mem / agentmemory / NEXO / CodeGraph / MemPalace / Supermemory） |
| **安全工具链** | `npm install -D noleak pa11y-ci recheck-cli @lhci/cli knip` + `pip install seraphim-audit` + Socket.dev API Key 配置 | 构建泄露检测 / 安全响应头 / 死链 / 无障碍 / ReDoS / 性能门禁 / AST 死代码检测 / 日志脱敏 / CORS / 敏感文件 / 供应链安全 / 技术债务 |
| **App Store** | [claude代码商店](https://github.com/topics/claude-app-store) | 更多Claude扩展工具 |

---

## 📊 集成全景

> 共集成 **80+ 个外部组件**：Skills 22 个 + MCP 16 个 + npm 包 23 个 + 外部工具 18 个 + MemPalace 工具 1 个

### 本地 Skills（22 个，`.claude/skills/`）

| Skill | 来源 | 功能 |
|-------|------|------|
| `speckit-specify` 等 12 个 | GitHub Spec-Kit | spec → plan → tasks → implement 规范驱动开发全流程 |
| `web-design-engineer` | ConardLi | OKLCH 色彩 + 6步工作流 + 反 AI 套路 |
| `impeccable` | — | 27 反模式规则 + 12 LLM 批判规则，去塑料感 |
| `ai-friendly-web-design` | ianho7 | 语义 HTML / ARIA 可访问性 |
| `awesome-design-md` | VoltAgent | 5 品牌 DESIGN.md（Vercel/Linear/Stripe/Notion/Apple），已升级为 Open Design 152 品牌库直接文件读取 |
| `mattpocock` | Matt Pocock | 含 29 个子技能（TS/工程/生产力） |
| `review-checklist` | — | 23 项审查清单 |
| `sec-bug-hunt` | — | 5 向量安全扫描规则 |
| `mobile-ui-review` | — | 移动端 UI 审查 |
| `constitution-reference` | — | 项目宪法引用 |
| `stack-knowledge` | — | 技术栈知识库 |

**推荐额外安装**（`npx skills install`）：`anthropics/skills`、`obra/superpowers`、`frontend-design`、`security-guidance`、`claude-seo`、`plannotator`、`deep-trilogy`

### MCP 服务器（16 个，`.mcp.json`）

| 服务器 | 用途 | 服务器 | 用途 |
|--------|------|--------|------|
| `codegraph` | 代码符号索引 | `github` | GitHub PR/Issue 操作 |
| `context7` | 文档查询 | `tavily-search` | 网络搜索 |
| `playwright` | 浏览器自动化 | `filesystem` | 文件系统操作 |
| `sequential-thinking` | 链式推理 | `memory` | 会话持久化记忆 |
| `mempalace` | 对话原文归档 | `stripe` | 支付集成 |
| `supabase` | 数据库操作 | `resend` | 邮件服务 |
| `sentry` | 错误监控 | `bearer` | PII/GDPR 隐私合规 |
| `detox` | RN E2E 测试 | `mobsfscan` | 移动端 SAST |

### npm 包（23 个，`claude-scene/package.json`）

**devDependencies（19）**：`@lhci/cli`、`knip`、`noleak`、`pa11y-ci`、`recheck-cli`、`artillery`、`@cyclonedx/cyclonedx-npm`、`@redocly/cli`、`@vitest/coverage-v8`、`eslint` + 3 插件、`license-checker`、`openapi-typescript`、`playwright`、`runme`、`vitest`

**dependencies（4）**：`chalk`、`commander`、`inquirer`、`ora`

### 外部工具（18 个，按类型）

| 类型 | 数量 | 工具 | 安装方式 |
|------|------|------|---------|
| **uv/Python** | 3 | `specify-cli`（spec-kit）、`seraphim-audit`、`skillspector` | uv tool install / pip install |
| **Rust 二进制** | 1 | `lychee` | brew / cargo / 下载 exe |
| **Go 二进制** | 2 | `act`、`restic` | winget / brew / 下载 |
| **npx 零安装** | 8 | `aislop`、`dependency-cruiser`、`jscpd`、`size-limit`、`Stryker`、`Spectral`、`markdownlint`、`knip` | 无需安装 |
| **内置 grep** | 4 | `log-sanitizer`、`cors-checker`、`env-leak-scanner`、`sensitive-file-check` | 已内置 |

### 集成 GitHub 项目（18 个）

`seraphimhub/seraphim-audit` · `NVIDIA/skillspector` · `lycheeverse/lychee` · `nektos/act` · `restic/restic` · `nexu-io/open-design` · `VoltAgent/awesome-design-md` · `mattpocock/skills` · `scanaislop/aislop` · `sverweij/dependency-cruiser` · `anthropics/skills` · `modelcontextprotocol/*` · `X-lab2017/open-digger` · `referodesign/refero_skill` · `DietrichGebert/ponytail` · `multica-ai/andrej-karpathy-skills` · `thedotmack/claude-mem` · `github/spec-kit`

---

## 🔄 更新指南

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
| 📋 完整工具清单与使用矩阵 | [docs/tools-inventory.md](./docs/tools-inventory.md) |
| Open Design | [github.com/nexu-io/open-design](https://github.com/nexu-io/open-design) |
| Claude Code SDK | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code-sdk/claude-code-headless) |
| **CodeGraph文档** | 已安装：`codegraph init -i` → `codegraph --help` |
| **前端美化工具** | DaisyUI + Animal Island UI + Animate.css |
