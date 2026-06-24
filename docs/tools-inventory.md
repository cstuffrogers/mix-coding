# Mix-Coding System — 完整工具清单与使用矩阵

> 生成日期：2026-06-14

---

## 目录

1. [工具全景图](#工具全景图)
2. [MCP 服务器（13个）与场景使用矩阵](#mcp-服务器13个与场景使用矩阵)
3. [Claude Skills（37个）与触发场景](#claude-skills37个与触发场景)
4. [CLI 工具 claude-scene（16模块 + 280+ Action处理器）](#cli-工具-claude-scene16模块--280-action处理器)
5. [35 个场景工作流（Scene JSON + Command Markdown）](#35-个场景工作流scene-json--command-markdown)
6. [89 个 Slash 命令分类](#89-个-slash-命令分类)
7. [CI/CD 与配置体系](#cicd-与配置体系)
8. [前端美化工具链](#前端美化工具链)
9. [记忆系统](#记忆系统)
10. [汇总统计](#汇总统计)

---

## 工具全景图

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          AI 终端入口（2个 IDE 适配）                            │
│   Claude Code  │  Gemini (.gemini/)                                           │
│   主入口       │  codegraph MCP                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                          89 个 Slash 命令 (.claude/commands/)                  │
│  27核心场景 │ 语言构建/测试(14) │ 审查(9) │ 工作流(8) │ 会话(3) │ 元工具(18)  │
├──────────────────────────────────────────────────────────────────────────────┤
│                          claude-scene CLI (Node.js)                           │
│  list | start | show | fork  ──  280+ Action处理器 ── 16个源模块              │
├──────────────────────────────────────────────────────────────────────────────┤
│                       27 场景定义 (.claude/scenes/*.json)                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                          能力层 — 6 大服务                                     │
│  Memory  │  Design  │  Review  │  Test  │  OpenDigger  │  Notification       │
├──────────────────────────────────────────────────────────────────────────────┤
│                          运行时层 — 13 MCP服务器 + 37 Skills                   │
│  github│tavily│context7│sentry│supabase│stripe│resend│codegraph│memory│     │
│  playwright│filesystem│sequential-thinking│opendigger                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP 服务器（13个）与场景使用矩阵

### 活跃 MCP 服务器（7个，定义在 `.claude/mcp.json`）

| # | 服务器 | 运行时 | 依赖环境变量 | 代码位置 |
|---|--------|--------|-------------|---------|
| 1 | **github** | Docker `ghcr.io/github/github-mcp-server` | `GITHUB_PERSONAL_ACCESS_TOKEN` | 远程镜像 |
| 2 | **tavily-search** | Node `./.mcp/tavily-mcp/build/index.js` | `TAVILY_API_KEY` | `.mcp/tavily-mcp/` |
| 3 | **context7** | npx `@upstash/context7-mcp` | `CONTEXT7_API_KEY` | npm 包 |
| 4 | **sentry** | npx `./.mcp/sentry-mcp/index.ts` | `SENTRY_AUTH_TOKEN` | `.mcp/sentry-mcp/` |
| 5 | **supabase** | npx `@supabase/mcp-server-supabase` | `SUPABASE_ACCESS_TOKEN` | npm 包 |
| 6 | **stripe** | npx `@stripe/mcp` | `STRIPE_SECRET_KEY` | npm 包 |
| 7 | **resend** | Node `./.mcp/resend-mcp/dist/index.js` | `RESEND_API_KEY` | `.mcp/resend-mcp/` |

### 注册但非独立 MCP 服务器（11个，定义在 `.claude/mcp-enable.json`）

| # | 服务器 | 类型 | 用途 |
|---|--------|------|------|
| 8 | **codegraph** | 代码图谱 | 代码依赖/调用关系分析，SQLite 数据库（130MB） |
| 9 | **memory** | 会话记忆 | 跨会话持久化记忆 |
| 10 | **playwright** | 浏览器测试 | E2E 和视觉回归测试 |
| 11 | **filesystem** | 文件系统 | 文件读写操作 |
| 12 | **sequential-thinking** | 推理链 | 链式思维推理 |
| 13 | **opendigger** | CLI 工具 | 开源项目竞品数据分析 |
| 14 | **mobsf** | CLI + Docker | MobSF REST API — APK/IPA 全量安全分析 |
| 15 | **mobsfscan** | CLI 工具 | 移动端源码级 SAST（硬编码密钥/不安全存储/弱加密） |
| 16 | **bearer** | CLI 工具 | PII/GDPR 隐私合规扫描（120+ 规则） |
| 17 | **detox** | CLI 工具 | React Native Gray box E2E 测试框架 |
| 18 | **toxiproxy** | CLI 工具 | TCP 网络故障注入（延迟/超时/断开） |

### MCP 动态启用映射：18 场景 × MCP 服务器

> 定义在 `.claude/mcp-enable.json`，每次启动场景时自动启用相应 MCP 服务器，控制 token 消耗（警告线 2000，硬上限 5000）。

| 场景 | 启用服务器 | Token预算 | 用途说明 |
|------|-----------|-----------|---------|
| **new-project** | github, tavily-search, context7, supabase, stripe, resend | 2200 | 全流程：仓库模板搜索、技术文档、数据库模板、支付/邮件模板 |
| **bugfix** | sentry, tavily-search, context7, github, codegraph | 1800 | 错误监控、同类方案搜索、技术文档、issue 查询、代码图谱 |
| **hunt** | sentry, tavily-search, context7, github, codegraph | 1800 | 安全扫描：错误监控、漏洞搜索、文档、issue、代码图谱 |
| **feature** | github, context7, supabase | 1200 | 新功能：仓库、文档、数据库结构 |
| **review** | github, context7 | 700 | 审查：仓库访问、最佳实践文档 |
| **refactor** | github, context7 | 700 | 重构：代码仓库、文档参考 |
| **analyze** | tavily-search | 600 | 竞品分析：市场搜索 |
| **optimize** | github, context7 | 500 | 性能优化：仓库、文档 |
| **simplify** | github, context7 | 500 | 代码简化：仓库、文档 |
| **loop** | github, context7 | 500 | 循环监控：仓库、文档 |
| **design** | tavily-search, context7 | 400 | 设计：设计参考搜索、文档 |
| **ui-polish** | memory | 400 | 美化：优化历史记忆 |
| **mobile-audit** | mobsf, mobsfscan, bearer, sentry, dependencycheck | 1800 | App 安全审计：静态分析(SAST) + 动态分析 + 隐私扫描 + CVE + 崩溃监控 |
| **mobile-review** | mobsfscan, detox, maestro, codegraph | 1400 | 移动端审查：SAST + E2E 测试 + UI 自动化 + 代码图谱 |
| **mobile-release** | github, fastlane, sentry, shorebird | 1200 | App 发布：构建签名 + 分发 + 崩溃监控 + OTA 热更新 |
| **mobile-optimize** | bundle-visualizer, detox, toxiproxy | 1000 | 性能优化：Bundle 分析 + 启动测量 + 网络故障注入 |
| **mobile-e2e** | detox, maestro, patrol | 700 | E2E 测试：自动检测框架 + 生成配置 + CI 集成 |
| **mobile-onboard** | react-native-doctor, fastlane | 400 | 环境搭建：RN 环境检查 + 签名证书配置 |

---

## Claude Skills（37个）与触发场景

### 自主 Skills（9个，定义在 `.claude/skills/`）

| Skill | SKILL.md | 专注领域 | 被哪些场景引用 |
|-------|----------|---------|--------------|
| **impeccable** | 有 | AI 设计词汇：27 反模式规则 + 12 LLM 批判规则，去 AI 塑料感 | ui-polish/design 场景 |
| **sec-bug-hunt** | 有 | XSS/SQL注入/CSRF/密钥扫描（高置信度≥0.85） | review 场景 Step 4（阻断合并条件） |
| **design-taste-frontend** | 有 | 落地页/作品集/品牌重设计的反模板化设计 | 前端设计类任务 |
| **high-end-visual-design** | 有 | 高端视觉设计：字体间距/阴影/动画 | 前端美化任务 |
| **gpt-taste** | 有 | GSAP 动效/AIDA 结构/Bento 网格/大间距排版 | 前端设计类任务 |
| **ui-polish** | 有 | DaisyUI/主题/动画/图标集成 | ui-polish 场景 |
| **ui-visual-trigger** | 有 | 视觉回归测试/截图/基线管理 | ui-polish 场景 |
| **api-contract-check** | 有 | OpenAPI 标准管线（Redocly lint + 交叉验证 + openapi-typescript） | feature/design/new-project 等 35 个场景 |
| **ua-context** | 有 | 前端审查的用户代理上下文感知 | review 场景 |

### 移动端 Skills（1个）

| Skill | SKILL.md | 专注领域 | 被哪些场景引用 |
|-------|----------|---------|--------------|
| **mobile-ui-review** | 有 | Safe Area/Notch/键盘避让/触摸目标/手势/加载状态/方向/色彩对比度 | mobile-review 场景 |

### Matt Pocock Skills（29个，定义在 `.claude/skills/mattpocock/skills/`）

**工程类（10个）— 被 feature/bugfix/new-project 场景引用：**

| Skill | 用途 | 场景引用 |
|-------|------|---------|
| **diagnose** | 结构化调试：复现→最小化→假设→插桩→修复→回归 | bugfix |
| **grill-me** | 面试式需求收集（消除盲区和设计歧义） | feature Step 2.5 |
| **grill-with-docs** | 带 ADR/CONTEXT 格式的需求收集 | feature |
| **improve-codebase-architecture** | 架构深潜：内聚性/可测试性/AI可导航性 | feature Step 2.6 |
| **prototype** | 原型开发 | new-project |
| **tdd** | 测试驱动开发：深层模块/接口设计/Mock | feature |
| **triage** | Issue 分类（Agent brief + 排除规则） | bugfix |
| **to-issues** | 规格转 Issue | feature |
| **to-prd** | 生成产品需求文档 | new-project |
| **zoom-out** | 高层架构审查 | review |

**写作/教学类（4个）：**

| Skill | 用途 |
|-------|------|
| teach | 教学：术语表/学习记录/任务/资源 |
| writing-beats | 写作节拍表 |
| writing-fragments | 写作片段 |
| writing-shape | 写作大纲/结构 |

**生产力类（4个）：**

| Skill | 用途 |
|-------|------|
| caveman | 原始调试法（最简化复现） |
| handoff | 工作交接流程 |
| review | 代码审查 |
| write-a-skill | Skill 编写指南 |

**Git/工程基础设施（3个）：**

| Skill | 用途 |
|-------|------|
| git-guardrails-claude-code | 阻止危险 git 操作 |
| setup-matt-pocock-skills | Skill 安装器：域配置/issue 追踪 |
| setup-pre-commit | 设置 pre-commit 钩子 |

**其他（8个）**：migrate-to-shoehorn, scaffold-exercises, edit-article, obsidian-vault, design-an-interface(deprecated), qa(deprecated), request-refactor-plan(deprecated), ubiquitous-language(deprecated)

---

## CLI 工具 claude-scene（16模块 + 280+ Action处理器）

### 入口与命令

```
claude-scene/src/index.js          ← CLI 入口 (commander)
  ├─ commands/list.js              ← node src/index.js list        列出所有场景
  ├─ commands/start.js             ← node src/index.js start <id>  执行场景
  ├─ commands/show.js              ← node src/index.js show <id>   查看场景详情
  └─ commands/fork.js              ← node src/index.js fork <id>   复制场景
```

### 能力处理模块

```
claude-scene/src/
├─ actions.js                      ← 核心：280+ Action 处理器注册表
├─ ui-polish.js                    ← UI 美化专用逻辑
├─ lib/conditions.js               ← 条件评估引擎（30+条件）
├─ lib/template.js                 ← 模板渲染
├─ lib/scan-dir.js                 ← 目录扫描
├─ lib/paths.js                    ← 路径解析
├─ lib/fs-utils.js                 ← 文件系统工具
├─ data/action-messages.js         ← 回退消息
├─ handlers/
│   ├─ code-analysis.js            ← 代码扫描/安全扫描/性能分析/度量/反模式/报告/Lighthouse/开放重定向/状态审计/i18n
│   ├─ memory.js                   ← 记忆召回/保存/整理/列表
│   ├─ testing.js                  ← 测试覆盖/单元测试/套件/受影响/CI/生成
│   ├─ handler-verify.js           ← Handler 验证：10 Pass 检测（内联桩/CE桩/逻辑密度/工具健康/依赖/导入链/场景交叉/静态安全/MCP）
│   ├─ lighthouse.js               ← Lighthouse CI 性能门禁（LCP/CLS/TBT）
│   ├─ open-redirect.js            ← 开放重定向检测
│   ├─ state-audit.js              ← Clearible 状态管理审计
│   └─ i18n.js                     ← i18n 国际化审查（硬编码/RTL）
```

### Action 处理器完整清单（280+ 注册键）

**交互控制（6个）：**
`select`, `confirm`, `choose`, `report`, `askUser`, `input`

**测试引擎（8个）：**
`testCoverage`, `testUnit`, `runSuite`, `runAffected`, `runCI`, `generateTest`, `verifyFix`, `regression`

**代码审查（2个）：**
`runReview`, `reviewFull`

**静态分析（10个）：**
`codeScan`, `securityScan`, `performanceProfile`, `codeMetrics`, `detectAntiPatterns`, `generateReport`, `lighthouseGate`, `openRedirectScan`, `stateAudit`, `i18nAudit`

**设计服务（10个）：**
`generateDesign`, `generateLowFi`, `generateHiFi`, `analyzeConsistency`, `persist`, `exportAssets`, `verifyVisual`, `analyzeUI`, `checkConsistency`, `generateRefactorPlan`

**代码工程（6个）：**
`applyTemplate`, `implementLogic`, `autoFix`, `applyTransformations`, `cleanup`, `build`

**记忆管理（4个）：**
`memoryRecall`/`recall`, `memoryRemember`/`remember`, `consolidate`, `listMemories`

**项目服务（3个）：**
`createBranch`, `commitPush`, `createPR`

**问题处理（6个）：**
`issueQuery`, `locate`, `analyzeDependencies`, `fix`, `closeTicket`, `analyzeInterface`

**前端美化（4个）：**
`installDeps`, `addAnimations`, `visualRegression`, `checkAPIConsistency`

**数据分析（2个）：**
`analyze`, `docsUpdate`

**通知（2个）：**
`send`, `notify`/`notifyComplete`

**CE Plugin（6个）：**
`ce-plan`, `ce-review`, `ce-debug`, `ce-compound`, `ce-brainstorm`, `ce-work`

**Handler 验证（1个）：**
`verifyHandlers`/`verify-handlers` — 10 Pass 空转桩检测：内联 MCP/MP 桩 + CE 桩 + 逻辑密度分析 (138 functions) + 外部工具健康 + 依赖健康 + CE Plugin + knip AST 导入链 + 场景交叉引用 + 静态安全烟测 + MCP 配置

---

## 35 个场景工作流（Scene JSON + Command Markdown）

> 每个场景有两层定义：`.claude/scenes/<id>.json`（数据结构）→ `.claude/commands/<id>.md`（用户命令）

### 场景详情

#### 1. new-project — 从零创建项目（26步）【对话模式】

| 步骤 | 动作 | 条件 | 说明 |
|------|------|------|------|
| 1 | recall | 总是 | 全量记忆注入（Claude-Mem + agentmemory + NEXO + CodeGraph） |
| 1.1 | GitHubMCP.searchRepositories | github_mcp_available | 搜索同类型项目最佳实践 |
| 1.2 | TavilyMCP.search | tavily_mcp_available | 搜索架构最佳实践 |
| 1.3 | Context7MCP.getDocumentation | context7_mcp_available | 获取技术栈文档 |
| 1.4 | SupabaseMCP.getSchema | supabase + database_required | 获取数据库模板 |
| 1.5 | StripeMCP.getPaymentFlow | stripe + payment_required | 获取支付流程模板 |
| 1.6 | ResendMCP.getEmailTemplate | resend + email_required | 获取邮件模板 |
| 2 | ce-plan | plugin_ce_available | CE Plugin 详细规划 |
| 3 | analyze (OpenDigger) | user_mentioned_competitor | 竞品数据分析 |
| 4 | askUser (技术方案确认) | 总是 | 技术方案设计并等待确认 |
| 4.5 | askUser (Open Design) | 总是 | 是否启用 AI 设计 |
| 4.6 | askUser (重构检查) | 总是 | 是否启用代码重构检查 |
| 5 | generateDesign | frontend_involved | AI 生成设计 |
| 5.1-5.5 | 重构流程 | user_confirmed_refactor | 度量→反模式→重构计划→测试→审查 |
| 6 | runReview (full) | 总是 | 全量代码审查 |
| 7 | runSuite | 总是 | 全量测试运行 |
| 8 | ce-compound | plugin_ce_available | 知识沉淀 |
| 9 | notify | 总是 | 完成通知 |

**MCP启用**：github, tavily-search, context7, supabase, stripe, resend（Token预算 2200）

---

#### 2. bugfix — Bug 修复（17步）

| 步骤 | 动作 | 条件 |
|------|------|------|
| 1 | GitHubMCP.listIssues(labels=bug) | github_mcp_available |
| 1.1 | SentryMCP.listIssues(7d) | sentry_mcp_available |
| 1.2 | TavilyMCP.search(同类方案) | tavily_mcp_available |
| 1.3 | Context7MCP.getDocumentation | context7_mcp_available |
| 1.4 | CodeGraphMCP.analyzeDependencies | codegraph_mcp_available |
| 2 | issueQuery | 总是 |
| 3 | locate | 总是 |
| 4 | analyzeDependencies | 总是 |
| 5 | createBranch | 总是 |
| 6 | fix | 总是 |
| 7 | commitPush | 总是 |
| 8 | verifyFix | 总是 |
| 9 | runAffected | 总是 |
| 10 | createPR | 总是 |
| 11 | regression | 总是 |
| 12 | closeTicket | 总是 |
| 13 | ce-compound | plugin_ce_available |

**MCP启用**：sentry, tavily-search, context7, github, codegraph（Token预算 1800）

---

#### 3. feature — 新功能开发（27步）

| 步骤 | 动作 | 条件 |
|------|------|------|
| 1 | GitHubMCP.listIssues | github_mcp_available |
| 1.1 | Context7MCP.getDocumentation | context7_mcp_available |
| 1.2 | SupabaseMCP.getSchema | supabase_mcp_available |
| 2 | recall(feature_plan) | 总是 |
| 2.5 | mp-grill-me | mattpocock_skill_available |
| 2.6 | mp-improve-codebase-architecture | mattpocock_skill_available |
| 3 | ce-plan | plugin_ce_available |
| 4 | applyTemplate | 总是 |
| 5 | implementLogic | 总是 |
| 6 | runSuite | 总是 |
| 7 | runReview(full) | 总是 |
| 8 | checkAPIConsistency | 总是 |
| 9 | autoFix | 总是 |
| 10 | commitPush | 总是 |
| 11 | ce-compound | plugin_ce_available |

**MCP启用**：github, context7, supabase（Token预算 1200）

---

#### 4. review — 代码审查 + 安全审计（14步）

| 步骤 | 动作 | 条件 | 说明 |
|------|------|------|------|
| 0.5 | recall(full) | 总是 | 注入历史审查上下文 |
| 1 | GitHubMCP.listPullRequests | github_mcp_available | 待审查 PR 列表 |
| 1.1 | Context7MCP.getDocumentation | context7_mcp_available | 审查最佳实践 |
| 2 | runReview(full) | 总是 | ESLint → react-doctor → Playwright 视觉 → AI 语义 |
| 2.5 | huashu-expert-review | enh_huashu_expert_review | Huashu 5 维度专家评审 |
| 2.7 | state-audit | 总是 | 状态管理审计：Context 过度使用/耦合度/循环依赖 |
| 3 | ce-review(9 Agent) | plugin_ce_available | CE 多Agent深度审查 |
| 4 | sec-bug-hunt(≥0.85置信度) | 总是 | 安全深度审计（阻断高危） |
| 4.2 | open-redirect-scan | 总是 | 开放重定向检测：URL 参数注入 |
| 4.5 | checkGate(strict) | 总是 | 质量门禁：lint + typecheck + security |
| 5 | ce-compound | plugin_ce_available | 知识沉淀 |
| 6 | remember | 总是 | 保存审查结果到记忆 |
| 6.5 | consolidate | 总是 | 跨后端记忆一致性 |
| 7 | notify | 总是 | 审计结果通知 |

**MCP启用**：github, context7（Token预算 700）

---

#### 5. refactor — 代码重构（11步）

核心流程：记忆召回 → codeMetrics → detectAntiPatterns → generateRefactorPlan → applyTransformations → runSuite → runReview → cleanup → ce-compound → notify

**MCP启用**：github, context7（Token预算 700）

---

#### 6. optimize — 性能优化（14步）

核心流程：记忆召回 → performanceProfile → codeMetrics → detectAntiPatterns → 选择优化方向 → implementLogic → runSuite → verifyFix → cleanup → ce-compound → notify

**MCP启用**：github, context7（Token预算 500）

---

#### 7. simplify — 代码简化（11步）

核心流程：记忆召回 → codeMetrics → detectAntiPatterns → 选择简化方向 → applyTransformations → runSuite → runReview → cleanup → ce-compound → notify

**MCP启用**：github, context7（Token预算 500）

---

#### 8. hunt — 安全漏洞审查（24步）

| 步骤 | 动作 | 条件 |
|------|------|------|
| 1 | SentryMCP.listIssues(7d) | sentry_mcp_available |
| 1.1 | TavilyMCP.search(OWASP) | tavily_mcp_available |
| 1.2 | Context7MCP.getDocumentation | context7_mcp_available |
| 1.3 | GitHubMCP.listIssues(security) | github_mcp_available |
| 1.4 | CodeGraphMCP.analyzeSecurityVulnerabilities | codegraph_mcp_available |
| 2 | recall(security) | 总是 |
| 3 | runReview(security, eslint-plugin-security, OWASP) | 总是 |
| 4 | runReview(security, npm-audit) | 总是 |
| 4.3 | open-redirect-scan | 总是 |
| 4.5 | security-headers (seraphim-audit) | 总是 |
| 4.7 | recheck-cli (ReDoS 扫描) | 总是 |
| 4.8 | log-sanitization (日志脱敏) | 总是 |
| 4.9 | cors-check (CORS 配置) | 总是 |
| 4.10 | env-var-leak (环境变量泄露) | 总是 |
| 4.12 | sensitive-file-check (敏感文件) | 总是 |
| 5 | runSuite | fixes_applied |
| 6 | ce-compound | plugin_ce_available |
| 6.5 | remember(security) | 总是 |
| 6.6 | consolidate | 总是 |
| 7 | send(高危通知) | high_severity_found |
| 8 | notify(审查完成) | 总是 |

**MCP启用**：sentry, tavily-search, context7, github, codegraph（Token预算 1800）

---

#### 9. design — AI 驱动设计（22步）【对话模式】

核心流程：web-design-engineer Skill 声明设计系统 → TavilyMCP/Context7MCP → recall → choose(视觉方向) → generateLowFi → askUser(确认) → generateHiFi → analyzeConsistency → exportAssets → persist → verifyVisual → ce-compound → notify

**MCP启用**：tavily-search, context7（Token预算 400）

---

#### 10. analyze — 竞品分析 + 代码分析（11步）

核心流程：TavilyMCP.search → CodeGraphMCP.analyzeDependencies → recall → OpenDigger.analyze → codeScan → securityScan → performanceProfile → generateReport → ce-compound → notify

**MCP启用**：tavily-search（Token预算 600）

---

#### 11. ui-polish — 前端美化（25步）【对话模式】

核心流程：MemoryMCP.listMemories → analyzeUI → web-design-declare-system → installDeps → checkConsistency → confirm(主题选择) → awm-brand-import → reconcileDesignTokens → applyDaisyUI → applyComponents → iconUpgrade(Material Symbols→lucide-react) → addAnimations(animate.css注入) → microInteractions(hover/active效果) → web-design-verify → impeccable-critique(真实扫描修复) → huashu-expert-review → ai-friendly-review → runSuite → visualRegression → checkAPIConsistency → ce-compound → notify

**MCP启用**：memory（Token预算 400）

---

#### 12. loop — 自动迭代循环（6步）

核心流程：GitHubMCP/Context7MCP → runReview → autoFix → runSuite → 循环(最多50次) → ce-compound

**MCP启用**：github, context7（Token预算 500）

---

#### 13. mobile-audit — App 安全审计（22步）

核心流程：recall → mobsfscan SAST → MobSF 全量分析 → Bearer PII/GDPR 隐私扫描 → DependencyCheck CVE → OWASP MASVS 合规检查 → mobile-security Agent 审查 → 聚合报告 → remember → consolidate → notify

**MCP启用**：mobsf, mobsfscan, bearer, sentry, dependencycheck（Token预算 1800）

---

#### 14. mobile-review — 移动端代码审查（14步）

核心流程：recall → @react-native/eslint-config → mobsfscan SAST → Detox/Maestro E2E → mobile-reviewer Agent（6 维度） → mobile-ui-review Skill（7 项检查） → 聚合报告 → remember → consolidate → notify

**MCP启用**：mobsfscan, detox, maestro, codegraph（Token预算 1400）

---

#### 15. mobile-release — App 发布部署（16步）

核心流程：recall → checkGate(quality) → 版本号升级 → Fastlane 构建签名 → TestFlight/Play Store 上传 → Shorebird OTA 热更新 → Sentry 崩溃监控启用 → 健康检查 → remember → consolidate → notify

**MCP启用**：github, fastlane, sentry, shorebird（Token预算 1200）

---

#### 16. mobile-optimize — App 性能优化（17步）

核心流程：recall → bundle-visualizer 基线 → 启动时间测量 → 网络分析 → mobile-perf Agent 反模式检测 → 自动修复（图片压缩/懒加载/缓存） → 重新测量验证 → remember → consolidate → notify

**MCP启用**：bundle-visualizer, detox, toxiproxy（Token预算 1000）

---

#### 17. mobile-e2e — 移动端 E2E 测试配置（8步）

核心流程：recall → 自动检测框架（RN/Flutter/小程序） → 选择工具（Detox/Maestro/Patrol/miniprogram-automator） → 生成测试配置 → 生成示例测试 → CI 集成 → verifyFix → notify

**MCP启用**：detox, maestro, patrol（Token预算 700）

---

#### 18. mobile-onboard — App 开发环境搭建（10步）

核心流程：recall → 检测缺失依赖 → 自动安装 → react-native doctor → Fastlane init → .env 模板 → 验证构建 → 模拟器/模拟器配置 → remember → notify

**MCP启用**：react-native-doctor, fastlane（Token预算 400）

---

## 89 个 Slash 命令分类

> 所有命令定义在 `.claude/commands/*.md`，Claude Code 自动加载。

### 35 个核心场景命令

| 命令 | 文件 | 场景ID |
|------|------|--------|
| `/polish` | polish.md | ui-polish |
| `/bugfix` | bugfix.md | bugfix |
| `/feature` | feature.md | feature |
| `/review` | review.md | review |
| `/refactor` | refactor.md | refactor |
| `/optimize` | optimize.md | optimize |
| `/simplify` | simplify.md | simplify |
| `/hunt` | hunt.md | hunt |
| `/design` | design.md | design |
| `/analyze` | analyze.md | analyze |
| `/loop` | loop.md | loop |
| `/new-project` | new-project.md | new-project |
| `/mobile-audit` | mobile-audit.md | mobile-audit |
| `/mobile-review` | mobile-review.md | mobile-review |
| `/mobile-release` | mobile-release.md | mobile-release |
| `/mobile-optimize` | mobile-optimize.md | mobile-optimize |
| `/mobile-e2e` | mobile-e2e.md | mobile-e2e |
| `/mobile-onboard` | mobile-onboard.md | mobile-onboard |

### 语言构建/测试命令（14个）

`/cpp-build`, `/cpp-test`, `/cpp-review`, `/flutter-build`, `/flutter-test`, `/flutter-review`, `/go-build`, `/go-test`, `/go-review`, `/gradle-build`, `/kotlin-build`, `/kotlin-test`, `/kotlin-review`, `/rust-build`, `/rust-test`, `/rust-review`

### 代码审查命令（6个）

`/review`, `/review-pr`, `/fastapi-review`, `/python-review`, `/security-scan`, `/code-review`

### 开发流程命令（12个）

`/build-fix`, `/feature-dev`, `/refactor-clean`, `/checkpoint`, `/project-init`, `/gan-build`, `/gan-design`, `/plan`, `/docker`, `/changelog`, `/sbom`, `/log`

### CE Plugin 命令（6个，需安装 compound-engineering 插件）

`/ce-brainstorm`, `/ce-plan`, `/ce-review`, `/ce-work`, `/ce-debug`, `/ce-compound`

### 多项目命令（4个）

`/multi-backend`, `/multi-frontend`, `/multi-plan`, `/multi-execute`, `/multi-workflow`

### 会话命令（3个）

`/resume-session`, `/save-session`, `/sessions`

### AI 学习/进化命令（5个）

`/learn`, `/learn-eval`, `/evolve`, `/promote`, `/prune`

### 配置/基础设施命令（10个）

`/hookify`, `/hookify-configure`, `/hookify-help`, `/hookify-list`, `/harness-audit`, `/model-route`, `/setup-pm`, `/update-codemaps`, `/update-docs`

### PR/项目管理命令（7个）

`/prp-plan`, `/prp-prd`, `/prp-commit`, `/prp-implement`, `/prp-pr`, `/jira`, `/projects`

### 质量/测试命令（4个）

`/quality-gate`, `/test-coverage`, `/skill-health`, `/cost-report`

### 其他专用命令（11个）

`/aside`, `/auto-update`, `/instinct-export`, `/instinct-import`, `/instinct-status`, `/loop-start`, `/loop-status`, `/marketing-campaign`, `/pm2`, `/santa-loop`, `/skill-create`

---

## CI/CD 与配置体系

### GitHub Workflows（`.github/workflows/` — 6个文件）

| 文件 | 触发条件 | 用途 |
|------|---------|------|
| `project-health-check.yml` | PR 修改 `.claude/scenes/**` / `ARCHITECTURE.md` | 项目架构健康检查 |
| `review-pipeline.yml` | PR 事件 | 代码审查管线（调用 `node src/index.js start review --auto`） |
| `validate_workflows.py` | 手动/CI | Scene JSON 工作流 schema 验证 |
| `validate_workflows.js` | 手动/CI | JavaScript 版本验证 |
| `test_validate_workflows.py` | 手动/CI | 验证器测试 |
| `run_validator_tests.py` | 手动/CI | 验证器测试运行器 |

### 规则文件（`.claude/rules/` — 5个文件）

| 文件 | 内容 |
|------|------|
| `coding.md` | 通用编码规范：camelCase/PascalCase/UPPER_SNAKE/kebab-case |
| `karpathy-principles.md` | Karpathy 四诫：先思考、简洁优先、手术式修改、目标驱动 |
| `react-doctor.md` | react-doctor 去重：负责 effect/RSC/性能；ESLint 负责语法 |
| `visual-standards.md` | Playwright 视觉阈值：maxDiffPixels=50, threshold=0.2, 3视口 |
| `workflows.md` | 工作流触发规则：12个指令 + CE Plugin + 意图识别优先级 |

### 根级配置文件（10个）

| 文件 | 用途 |
|------|------|
| `package.json` | 项目元信息、依赖、脚本 |
| `eslint.config.js` | ESLint 配置 |
| `playwright.config.ts` | Playwright 视觉测试：3视口、maxDiffPixels=50、threshold=0.2 |
| `vitest.config.ts` | Vitest：node环境、v8覆盖率、排除外部目录 |
| `tailwind.config.js` | Tailwind + DaisyUI：5主题（light/dark/cupcake/corporate/synthwave） |
| `react-doctor.config.json` | react-doctor：忽略 no-missing-use-effect-deps, no-rules-of-hooks |
| `.prettierrc` | Prettier：semi/单引号/es5尾逗号/100宽度/2缩进 |
| `.env` | API Keys：Anthropic/GitHub/Tavily/Sentry/Supabase/Stripe/Resend |
| `.env.example` | 环境变量模板 |

### 权限配置

| 文件 | 内容 |
|------|------|
| `.claude/settings.json` | 项目级：允许 codegraph MCP 工具 |
| `.claude/settings.local.json` | 本地：大量 Bash/Read/WebSearch 白名单 |

### 工程模板（`.claude/harness-templates/` — 5个文件）

| 文件 | 用途 |
|------|------|
| `AGENTS.md.template` | Agent 行为指令模板 |
| `DECISIONS.md.template` | 架构决策记录模板 |
| `progress.md.template` | 进度追踪模板 |
| `init.sh.template` | 项目初始化脚本模板 |
| `feature_list.schema.json` | 功能追踪 JSON Schema（WIP限制=1） |

---

## 前端美化工具链

| 工具 | 版本/来源 | 用途 | 使用场景 | 运行时 |
|------|----------|------|---------|--------|
| **DaisyUI** | npm `daisyui` | Tailwind 组件库：35+预设主题 | ui-polish | 构建时 |
| **Animal Island UI** | npm `animal-island-ui` | 自然圆润风格组件库 | ui-polish | 运行时 React |
| **Animate.css** | npm `animate.css` | 80+ CSS 动画预设 | ui-polish | 纯 CSS |
| **Lucide React** | npm `lucide-react` | 2000+ SVG 图标 | ui-polish | 运行时 React |
| **Tailwind CSS** | npm `tailwindcss` | 实用优先 CSS 框架 | 全局 | 构建时 |
| **Playwright** | npm `@playwright/test` | 浏览器 E2E/视觉回归测试 | ui-polish/全局 | 测试时 |
| **Open Design** | `open-design/` 本地仓库 | AI 设计生成（152套品牌系统 + 111模板 + 137 Skill + 6设备框 + 3文稿 + 102提示词） | design/new-project/ui-polish | 独立应用 |
| **Impeccable** | `.claude/skills/impeccable/` | AI 设计词汇 + 27 反模式规则 + 12 LLM 批判规则，自动修正 UI 塑料感 | ui-polish/design | Claude Code Skill |

### 质量与安全工具链（14 个工具）

| 工具 | 版本/来源 | 用途 | 使用场景 | 运行时 |
|------|----------|------|---------|--------|
| **Lighthouse CI** | npm `@lhci/cli` | Web 性能门禁（LCP/CLS/TBT/缓存/PWA） | audit, release | CLI |
| **noleak** | npm `noleak` | 构建产物泄露检测（.env/Source Map/密钥） | audit, release | CLI |
| **seraphim-audit** | pip `seraphim-audit` | 安全响应头扫描（CSP/HSTS/X-Frame-Options） | hunt, audit | CLI |
| **lychee** | Rust 二进制 | 死链接检测（Markdown/HTML） | audit | CLI |
| **pa11y-ci** | npm `pa11y-ci` | WCAG 2.1 AA 无障碍扫描 | review | CLI |
| **recheck-cli** | npm `recheck-cli` | 正则 ReDoS 灾难性回溯检测 | hunt, audit | CLI |
| **log-sanitizer** | 内置 grep | 日志脱敏扫描（Token/密码/身份证/手机号/邮箱） | hunt, audit | 内置 |
| **cors-checker** | 内置 grep | CORS 配置检测（通配符/credentials 泄露） | hunt, audit | 内置 |
| **env-leak-scanner** | 内置 grep | 前端环境变量泄露（Vite/process.env） | hunt, audit, review | 内置 |
| **sensitive-file-check** | 内置 git | 敏感文件暴露检查（.env/*.pem/*.key） | hunt, audit | 内置 |
| **deprecated-deps** | npm CLI | 废弃/未维护依赖检测 | audit | CLI |
| **knip** | npx CLI | AST 级死代码/依赖检测：未使用文件/未使用导出/未解析导入/未声明依赖/未使用依赖（11k+ stars） | audit, review | CLI |
| **skillspector** | pip `skillspector` | AI 技能安全扫描：扫描 `.claude/skills/` `.claude/commands/` 中的提示注入、数据外泄、权限提升、恶意代理等 64 种漏洞模式（NVIDIA, 2.5k+ stars） | hunt, audit | CLI |

### 移动端工具链

| 工具 | 版本/来源 | 用途 | 使用场景 | 运行时 |
|------|----------|------|---------|--------|
| **MobSF** | Docker `opensecurity/mobsf` | APK/IPA 全量安全分析（静态+动态） | mobile-audit | Docker 容器 |
| **mobsfscan** | pip `mobsfscan` | 移动端源码级 SAST | mobile-audit, mobile-review | CLI |
| **Bearer CLI** | npm `@bearer/cli` | PII/GDPR 隐私合规扫描（120+ 规则） | mobile-audit | CLI |
| **DependencyCheck** | Java CLI | CVE 依赖漏洞扫描 | mobile-audit | CLI |
| **Detox** | npm `detox-cli` | React Native Gray box E2E 测试 | mobile-e2e, mobile-review | 测试时 |
| **Maestro** | shell 脚本 | 跨平台移动 UI 自动化测试 | mobile-e2e | 测试时 |
| **react-native-bundle-visualizer** | npm | JS Bundle 树图分析 | mobile-optimize | CLI |
| **fastlane** | Ruby gem | iOS/Android 自动构建签名发布 | mobile-release | 构建时 |
| **Shorebird** | Dart pub | Flutter/RN OTA 热更新 | mobile-release | Dart CLI |
| **Toxiproxy** | Go CLI | TCP 网络故障注入（延迟/超时/断开） | mobile-optimize | 测试时 |

### ui-polish 场景的 25 步完整工具链

```
recall → listMemories → analyzeUI → web-design-declare-system
→ installDeps(DaisyUI+Animate.css+Lucide+Playwright)
→ checkConsistency → confirm(主题选择) → Open Design 品牌导入
→ reconcileDesignTokens → applyDaisyUI → applyComponents
→ iconUpgrade(Material Symbols→lucide-react) → addAnimations(animate.css类注入)
→ microInteractions(hover/active效果) → web-design-verify
→ impeccable-critique(真实扫描修复纯黑/纯白/紫色渐变)
→ huashu-expert-review → ai-friendly-review → runSuite
→ visualRegression → checkAPIConsistency → ce-compound → notify
```

**审查四层管线**：web-design-verify（技术交付检查）→ impeccable-critique（真实扫描+自动修复，纯黑/纯白/紫色渐变检测）→ huashu-expert-review（5 维度专家评审）→ ai-friendly-review（可访问性审查）

**新增步骤（v2.0）**：iconUpgrade（Material Symbols → lucide-react，60+ 映射）、microInteractions（hover/active 微交互）、增强的 impeccable-critique（真实扫描修复替代 CLI 轻量空转）

**API 一致性评分公式**：`score = max(0, 100 - lint失败×20 - 交叉验证critical×20 - 类型生成失败×15 - 交叉验证high×5)`

---

## 记忆系统

### 7 种记忆工具

| 工具 | 类型 | 存储 | 命名空间 | 用途 |
|------|------|------|---------|------|
| **project-memory** | CLI | JSON `claude-scene/memory/` | `memory_*` | 工作流结构化结果 |
| **Claude-Mem** | 插件 | Markdown `.claude/memory/` | 直接 | Markdown 持久化记忆 |
| **agentmemory** | CLI | SQLite `~/.agentmemory/` | `memory-agentmemory_*` | 结构化数据 |
| **NEXO Brain** | CLI | SQLite `~/.nexo/` + GPT-4 | `memory-nexo_*` | 语义记忆图 |
| **CodeGraph** | CLI | SQLite `.codegraph/codegraph.db`(130MB) | `memory-codegraph_*` | 代码关系知识图谱 |
| **MemPalace** | CLI | Markdown `~/.claude/projects/` | 逐字归档 | 对话原文逐字归档与智能召回 |
| **Supermemory** | SaaS | 云端向量数据库 | 语义搜索 | 语义搜索 + 自动事实提取（需 API Key） |

### 记忆 Action 处理器

| Action | 用途 | 被哪些场景使用 |
|--------|------|--------------|
| `recall` / `memoryRecall` | 召回项目记忆 | new-project, feature, bugfix, hunt, refactor, optimize, simplify |
| `remember` / `memoryRemember` | 保存到记忆 | 所有场景（通过 ce-compound 知识沉淀） |
| `consolidate` | 去重整理记忆 | 定期维护 |
| `listMemories` | 列出所有记忆 | ui-polish |

---

## 汇总统计

| 类别 | 数量 |
|------|------|
| **MCP 服务器（总）** | 18 |
| ├─ 活跃（mcp.json） | 10 |
| └─ 注册（mcp-enable.json） | 11 |
| **本地 MCP 代码目录** | 5 (.mcp/) |
| **Claude Skills（总）** | 39 |
| ├─ 自主 Skills | 10 |
| └─ Matt Pocock Skills | 29 |
| **Slash 命令** | 95 |
| ├─ 核心场景 | 35 |
| ├─ 语言构建/测试 | 14 |
| ├─ 审查 | 6 |
| ├─ 开发流程 | 8 |
| ├─ CE Plugin | 6 |
| ├─ 多项目 | 4 |
| ├─ 会话 | 3 |
| ├─ AI 学习/进化 | 5 |
| ├─ 配置/基础设施 | 10 |
| ├─ PR/项目管理 | 7 |
| ├─ 质量/测试 | 4 |
| └─ 其他 | 11 |
| **Scene JSONs** | 18（共 238+ 步） |
| **claude-scene 源模块** | 16 |
| **Action 处理器** | 280+ 注册键 |
| **条件评估器** | 30+ |
| **CI/CD 文件** | 6 |
| **规则文件** | 7 |
| **根级配置** | 10 |
| **工程模板** | 5 |
| **前端/质量/安全工具** | 10 |
| **记忆工具** | 7 |
| **插件** | 2 |
| **MCP 动态映射（场景×服务器）** | 18 条 |
| **Token 预算范围** | 400-2200 |
| **总工具产出物** | **~300+** |

---

## 工具使用快速索引

| 想知道... | 看这里 |
|----------|--------|
| 某个场景用哪些 MCP？ | [MCP 动态启用映射表](#mcp-动态启用映射18-场景--mcp-服务器) |
| 某个 MCP 被哪些场景用？ | 搜索 "MCP启用" |
| 某个 Skill 在哪里触发？ | [Claude Skills](#claude-skills37个与触发场景) |
| 某个 Slash 命令的源码？ | `.claude/commands/<命令名>.md` + `.claude/scenes/<场景id>.json` |
| 某个 Action 处理器代码？ | `claude-scene/src/actions.js` 搜索函数名 |
| 如何添加新场景？ | 创建 `.claude/scenes/<id>.json` + `.claude/commands/<cmd>.md` |
| 完整架构？ | `ARCHITECTURE.md` |
| 安装配置？ | `INSTALL.md` |
| 快速入门？ | `README.md` |
| 工作流配置？ | `.claude/workflow-config.md` |
