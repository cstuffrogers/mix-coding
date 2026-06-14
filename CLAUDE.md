# Mix-Coding System

## 引擎模式

本项目支持两种工作流执行引擎，通过环境变量 `AUTO_CODING_ENGINE` 切换：

### Scene 引擎（默认）

Claude 在对话内直接执行工作流，上下文连贯，精度和效率最优。

- **原理**：Claude 读 `.claude/scenes/<场景>.json`，在同一个会话里逐步执行
- **优势**：长上下文保温、交互式确认、记忆实时沉淀
- **劣势**：不能并行、需守着终端
- **场景**：35 个全支持
- **命令**：`node src/index.js start <场景ID> --auto [参数]`

### Archon 引擎（实验性）

独立服务器编排 Claude Code Headless，Worktree 隔离，多入口触发。

- **原理**：Archon 读 `.archon/workflows/<场景>.yaml`，每个节点独立调用 Claude SDK
- **优势**：并行多任务、后台 fire-and-forget、Slack/Web/GitHub 多入口
- **劣势**：每节点 `context: fresh` 丢失上下文连贯性、成本更高
- **场景**：12 个（缺少 audit/deps/onboard/prototype/release/rollback）
- **命令**：`bun run cli workflow run auto-coding-<场景ID> -q "<描述>"`

> 加 `-q` 参数抑制内部 JSON 日志，只输出工作流进度和结果。

> ⚠️ **已知限制**：
> - **嵌套 Claude Code 冲突**：从 Claude Code 会话内启动 Archon 会导致子节点僵死
>   （[Archon #1067](https://github.com/coleam00/Archon/issues/1067)），必须从独立终端运行
> - **需要 Git Remote**：Worktree 隔离依赖 origin 拉取，本地仓库需加 `--no-worktree`
> - **分支名检测**：非 `main` 分支的仓库需在 `.archon/config.yaml` 配置 `worktree.baseBranch`
> 
> **正确用法**：在独立终端中运行 `archon serve`，然后通过 CLI/Slack/Web 触发，不要从 Claude Code 会话内触发。

### 切换方式

```bash
# Scene 引擎（默认，不需要设置）
unset AUTO_CODING_ENGINE

# 切换到 Archon
export AUTO_CODING_ENGINE=archon

# 切回 Scene
unset AUTO_CODING_ENGINE
```

**路由规则**：执行 `/` 命令时检查：
1. `AUTO_CODING_ENGINE=archon` 且该场景的 `.archon/workflows/*.yaml` 存在 → Archon 引擎
2. 否则 → Scene 引擎（默认）

## 可用命令

Claude Code 会自动加载 `.claude/commands/` 目录中的所有命令文件。输入 `/` 查看可用命令列表。

### jvn Spec-Driven 开发命令

jvn 引入了规范的 spec → design → build 开发流程，由 5 个专业 Agent 护航：

| 命令 | 功能 | Agent 参与 |
|------|------|-----------|
| `/spec "需求"` | 创建功能规格说明 | PM 引导需求澄清 |
| `/design` | 生成技术设计方案 | 架构师 + UX 设计师 |
| `/build` | 分阶段实现，人工审批关卡 | 代码审查 + 宪法校验 |
| `/report` | 生成项目分析报告 | — |
| `/report-fix` | 根据报告修复问题 | — |

**5 个 Agent**（`claude code/agents/`）：
- **product-manager** — 需求保真度检查
- **architect** — 架构合规性审查
- **ux-designer** — 用户体验设计审查
- **code-reviewer** — 代码质量标准
- **constitutional-validator** — 宪法规则校验（基于 `constitution.md`）

**项目宪法**：`constitution.md`（项目根目录）定义了所有开发必须遵守的原则，由 constitutional-validator Agent 强制执行。

## 系统简介

这是一个基于 **三层架构** 的智能开发系统，支持：
- 35 个自动化工作流（通过 `/` 直接调用或 `/others` 菜单浏览）
- 多轮自动审查与修复
- AI 驱动设计（Open Design，129套品牌系统）
- 前端美化工具链（DaisyUI + Animal Island UI + Animate.css + Lucide React + Playwright）
- Impeccable 设计打磨（27 条反AI模式规则 + 12 条 LLM 批判规则，自动修正 AI 塑料感）
- 5 层代码审查 + CE Plugin 深度审查
- jvn Spec-Driven 开发（/spec → /design → /build）+ 5 Agent 增强审查（PM + 架构师 + UX + 代码审查 + 宪法校验）
- 记忆组件组合（7种记忆工具：project-memory / Claude-Mem / agentmemory / NEXO / CodeGraph / MemPalace / Supermemory）
- 自动记忆：无需用户调用，发现重要信息时自动保存到多后端记忆系统（详见 `.claude/rules/memory-auto-save.md`）
- 竞品分析（OpenDigger）
- 数据库迁移审查（SchemaForge MCP）+ 无障碍扫描（a11y MCP）
- 外部安全工具链（16 个工具：noleak / seraphim-audit / lychee / pa11y-ci / recheck-cli / log-sanitizer / cors-checker / env-leak-scanner / sensitive-file-check / deprecated-deps / knip / skillspector / aislop / dependency-cruiser / Lighthouse CI / prototype-pollution）— 自动阻断构建泄露、安全响应头扫描、死链检测、日志脱敏、CORS 配置、环境变量泄露、恶意 install 脚本、供应链安全、敏感文件暴露、技术债务、lock 文件一致性、gitignore 最佳实践、废弃依赖、AST级死代码检测、AI技能安全、AI代码气味、依赖架构、性能门禁、原型链污染

## 工作流执行

### /polish - 前端美化工作流

**触发方式**：
```
> /polish animal-island E:\my-app
> 美化前端，使用自然风格
> 将项目改为 DaisyUI corporate 主题
```

**执行流程**（详见 `.claude/scenes/ui-polish.json`）：

| 阶段 | 步骤 | 说明 |
|------|------|------|
| **准备** | recall → listMemories → analyzeUI | 注入记忆上下文，分析项目 UI 结构 |
| **设计基准** | web-design-declare-system | 声明设计系统基准（Palette/Typography/Spacing/Motion/Radius/Shadows） |
| **安装** | installDeps | 安装 daisyui / animate.css / lucide-react / playwright |
| **一致性** | checkConsistency | CSS 变量使用率、组件覆盖度、硬编码样式数 |
| **主题选择** | confirm | 交互式选择：DaisyUI（35+主题）/ Animal Island / Custom / Huashu 40 风格库 / Awesome Design MD 品牌（Vercel/Linear/Stripe/Notion/Apple） |
| **品牌** | awm-brand-import | Awesome Design MD: 加载品牌 DESIGN.md 注入 CSS 变量（条件触发） |
| **调和** | reconcileDesignTokens | 检测已有设计 Token → 与主题对比 → 已有值优先，新值填补空缺，避免覆盖 design 工作流产出 |
| **应用** | applyDaisyUI → applyComponents → iconUpgrade → addAnimations → microInteractions | 整合主题 → 替换组件（Animal Island） → 图标升级（Material Symbols→lucide-react，所有主题） → 注入 animate.css 动画类 → 添加 hover/active 微交互 |
| **审查** | web-design-verify → impeccable-critique → huashu-expert-review → ai-friendly-review | 四层审查：技术交付检查 → AI 塑料感打磨（真实扫描+自动修复） → Huashu 5 维度评审 → 可访问性审查 |
| **测试** | runSuite → visualRegression | 功能测试 + Playwright 视觉回归（Desktop/Tablet/Mobile） |
| **契约** | checkAPIConsistency | OpenAPI 标准管线（Redocly lint + 交叉验证 + openapi-typescript） |
| **沉淀** | ce-compound → remember → consolidate | 知识沉淀 → 保存配置 → 整理记忆 |
| **完成** | notify | 通知美化结果 |

**设计一致性保护**：`reconcileDesignTokens` 步骤确保 polish 工作流不会覆盖 design 工作流产出的设计系统。已有 DESIGN.md / CSS 变量 / tailwind.config.js 中的品牌色、字体、间距、圆角、阴影、动效偏好均被保留，仅用新主题填充缺失项。

### 其他工作流

| 工作流 | 触发方式 | 步骤数 | 说明 |
|--------|---------|--------|------|
<!-- AUTO-SYNC:WORKFLOW-TABLE-START -->
| `/analyze` | `> /analyze [项目名]` | 15步 | 深度分析代码质量、性能瓶颈、安全漏洞、可维护性，生成改进建议 |
| `/audit` | `> /audit` | 39步 | 一键全量项目审计：安全扫描 + 代码质量 + 依赖审计 + 性能基线 + 覆盖率 + 质量门禁汇总 + 安全响应头 + 死链检测 + 构建泄露 |
| `/backup` | `> /backup` | 8步 | 使用 Restic 配置加密去重备份，生成备份脚本和排除规则 |
| `/bugfix` | `> /bugfix 描述` | 28步 | 端到端一键修复Bug流程（Jira/issue/PR --> issue注释 --> 本地分支 --> 修复 --> 测试 --> 提交 --> PR --> 回归测试 --> 关单） |
| `/changelog` | `> /changelog` | 9步 | 基于 Git 提交历史和 Conventional Commits 规范自动生成或更新 CHANGELOG.md |
| `/cicd` | `> /cicd` | 8步 | 使用 Act + Task 配置本地 CI/CD 流水线，验证 GitHub Actions 工作流，生成 Taskfile.yml 任务运行器 |
| `/deps` | `> /deps` | 14步 | 安全依赖更新流程：检查过期 → 逐项更新 → 测试验证 → 检查breaking changes → 更新lockfile |
| `/design` | `> /design 描述` | 22步 | 一键AI辅助UI设计与交互设计生成流程，覆盖交互原型、视觉设计、组件库检查 |
| `/docker` | `> /docker` | 8步 | 自动检测项目语言，生成多阶段 Dockerfile、.dockerignore、docker-compose.yml，验证 Docker 构建语法 |
| `/e2e` | `> /e2e` | 8步 | 使用 MSW + Supertest + Schemathesis 配置端到端测试基础设施（Mock + HTTP 断言 + API fuzz） |
| `/feature` | `> /feature 描述` | 27步 | 端到端一键推进新功能开发流程（集成CE知识沉淀） |
| `/hunt` | `> /hunt` | 24步 | 代码安全漏洞扫描与修复 + 安全响应头配置扫描（集成CE知识沉淀） |
| `/incident` | `> /incident` | 8步 | 使用 Runme 生成可执行的 Markdown Incident Runbook，包含健康检查、常见问题、升级路径 |
| `/loadtest` | `> /loadtest [模式]` | 8步 | 运行 Artillery 负载测试：支持 smoke/load/stress 三种模式，作为 CI/CD 性能门禁 |
| `/log` | `> /log` | 8步 | 检测项目日志库（winston/pino/log4js），自动生成结构化日志配置，检测 ELK/Fluentd 并生成采集配置 |
| `/loop` | `> /loop` | 10步 | 无人值守自动迭代（集成CE知识沉淀） |
| `/migration` | `> /migration` | 8步 | 审查数据库迁移文件：检测危险操作（NOT NULL无默认值、DROP、类型变更等），阻断高风险变更 |
| `/mobile-audit` | `> /mobile-audit` | 22步 | 一键移动端安全+性能+合规+质量审计：MobSF安全扫描 → OWASP MASVS对照 → 隐私合规 → 依赖CVE → 性能基线 → 商店清单 |
| `/mobile-e2e` | `> /mobile-e2e` | 11步 | 自动检测项目框架→选择最佳测试工具→生成配置+示例→CI 集成 |
| `/mobile-onboard` | `> /mobile-onboard` | 16步 | 自动检测并搭建移动端开发环境：Xcode/Android Studio/Node/JDK/CocoaPods，验证首次构建 |
| `/mobile-optimize` | `> /mobile-optimize` | 17步 | 测量基线→定位瓶颈→AI分析→自动优化→重新验证：包体积/启动时间/FPS/内存/网络/电池 |
| `/mobile-release` | `> /mobile-release` | 18步 | 端到端移动端发布：证书检查→质量门禁→版本号→CHANGELOG→fastlane构建签名→TestFlight/Google Play→OTA热更新→Sentry崩溃监控 |
| `/mobile-review` | `> /mobile-review` | 14步 | 5层移动端代码审查：ESLint+RN规则 → mobsfscan安全 → Detox/Maestro截图 → AI语义+a11y → 聚合报告 |
| `/monitor` | `> /monitor` | 8步 | 使用 Upptime 配置 GitHub Actions 原生网站监控，自动生成配置文件和工作流，并部署状态页面 |
| `/new-project` | `> /new-project 描述` | 21步 | 从零开始新项目（集成CE方案规划和知识沉淀） |
| `/onboard` | `> /onboard` | 14步 | 一键环境搭建：检测缺失依赖 → 安装 → 配置.env → 验证构建 → 启动开发服务器 |
| `/optimize` | `> /optimize` | 14步 | 基于测量的性能优化，先定位瓶颈再修复（集成CE知识沉淀） |
| `/prototype` | `> /prototype 描述` | 11步 | 快速原型验证：需求访谈 → MVP代码生成 → 本地运行 → 验证报告（在正式feature/new-project之前） |
| `/refactor` | `> /refactor 描述` | 21步 | 自动执行重构流程：分析重构点、生成重构方案、执行重构、验证效果 |
| `/release` | `> /release` | 23步 | 端到端发布部署流程：质量门禁 → 版本号 → 构建 → 泄露检测(noleak) → 验证 → Tag → 发布 |
| `/review` | `> /review` | 14步 | 全面代码质量审查 + 自动化安全漏洞扫描（集成CE多Agent深度审查 + sec-bug-hunt） |
| `/rollback` | `> /rollback` | 14步 | 紧急回滚流程：识别目标版本 → 验证回滚安全性 → 执行回滚 → 验证服务恢复 |
| `/sbom` | `> /sbom` | 8步 | 生成软件物料清单 (SBOM) 和许可证合规报告，检测限制性许可证（GPL/AGPL/SSPL 等） |
| `/simplify` | `> /simplify` | 13步 | 简化代码以提高可读性和可维护性，不改变行为（集成CE知识沉淀） |
| `/ui-polish` | `> /ui-polish <主题> <路径>` | 25步 | 使用 DaisyUI/Animate.css/Lucide/Playwright 美化前端界面（含图标升级+微交互+Impeccable打磨） |
<!-- AUTO-SYNC:WORKFLOW-TABLE-END -->

> 详细工作流配置见 `.claude/scenes/*.json` 和 `.claude/workflow-config.md`

## 可选增强选择

执行工作流之前，**自动检测项目特征**，对适用的场景弹出可选增强菜单。不适用则不显示。

### 检测规则

| 检测项 | 检测方式 | 适用场景 |
|--------|---------|---------|
| Web 前端项目 | 存在 `*.tsx`/`*.jsx`/`*.html` + `package.json` | review、ui-polish |
| 数据库 | 存在 `migrations/`、`schema.*`、`prisma/`、`drizzle/`、`*.sql` | feature、release |
| 需求复杂度 | 用户描述 > 50 字 | feature、new-project |
| i18n 多语言 | 存在 i18n 配置、locale/ 目录 | review |

### 菜单模板

根据检测结果动态组装，**未检测到特征的不展示对应选项**：

```
📋 本次可选增强（输入数字切换勾选，回车确认）：

  [✓] 1. <增强项1>
  [✓] 2. <增强项2>
  [ ] 3. <增强项3>
  [ ] 0. 全部跳过 — 仅执行核心工作流

当前勾选：1, 2
```

### 各场景可选增强清单

**`/feature`、`/new-project`**：

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | jvn 多 Agent 审查 — PM（需求保真）+ 架构师（设计合规）+ UX + 代码审查 + 宪法校验 | ✓ | 需求 > 50 字 |
| 2 | 迁移审查 — SchemaForge 审查 DB 变更，自动生成迁移脚本 | ✓ | 检测到数据库 |

**`/review`**：

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | 无障碍扫描 — WCAG 合规检查（加入审查管线 Layer 2.5） | ✓ | Web 前端项目 |
| 2 | i18n 审查 — 硬编码字符串/翻译覆盖率 | — | 检测到 i18n |

**`/release`**：

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | 迁移审查 — SchemaForge dry-run 校验迁移脚本 | ✓ | 检测到数据库 |
| 2 | 上线检查清单 — 监控/日志/回滚方案逐项核验 | — | 始终可选 |

**`/audit`、`/refactor`**：

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | 架构深度审计 — 分层合规 + 复杂度热点图 | — | 始终可选 |

**`/ui-polish`**：

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感 | ✓ | 始终可选 |
| 2 | Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality | ✓ | Web 前端项目 |

**`/design`**：

| # | 选项 | 默认 | 出现条件 |
|---|------|------|---------|
| 1 | Huashu Brand Protocol — 检测品牌提及→5 步资产清单→brand-spec.md | ✓ | 品牌提及 |
| 2 | Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality | ✓ | Web 前端项目 |
| 3 | Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感 | ✓ | 始终可选 |

<!-- AUTO-SYNC:SKIP-ENHANCEMENT-LIST-START -->
以下场景无可选增强，直接执行核心工作流：`analyze`、`backup`、`bugfix`、`changelog`、`cicd`、`deps`、`design`、`docker`、`e2e`、`hunt`、`incident`、`log`、`loop`、`monitor`、`optimize`、`sbom`、`simplify`
以下场景无可选增强，直接执行核心工作流：`loadtest`、`migration`、`onboard`、`prototype`、`rollback`
<!-- AUTO-SYNC:SKIP-ENHANCEMENT-LIST-END -->

### 执行流程

```
1. 识别工作流
2. 收集参数
3. 检测项目特征 → 组装可选增强菜单
4. 有适用增强 → 弹出菜单让用户选择（3 秒无操作 = 默认勾选）
5. 执行核心工作流 + 已选增强
```

## 执行原则

1. **先理解需求**：确认用户想要什么效果
2. **收集必要信息**：路径、风格选择等
3. **弹出可选增强**：检测项目特征，展示适用的增强选项，用户勾选确认
4. **执行工作流**：按照基础步骤 + 已选增强执行
5. **验证结果**：确保达到预期效果
6. **报告完成**：提供执行报告

## 外部安全工具链

以下工具已集成到对应工作流中，自动执行，零冲突：

| 工具 | 类型 | 负责工作流 | 功能 | 状态 |
|------|------|-----------|------|------|
| **noleak** | npm CLI | `/release` (step 8.5), `/audit` (step 8.7) | 构建产物泄露检测：Source Map / .env / 密钥 / .git 目录扫描，BLOCK-RELEASE 级别阻断 | ✅ |
| **seraphim-audit** | Python CLI | `/hunt` (step 4.5), `/audit` (step 3.5) | 安全响应头扫描：CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy — 静态代码配置扫描（+ 可选实时 URL 扫描，设 `SERAPHIM_AUDIT_URL` 环境变量启用） | ✅ |
| **lychee** | Rust 二进制 | `/audit` (step 8.5) | 死链接检测：扫描项目 Markdown/HTML 文件中的失效链接 | ✅ |
| **pa11y-ci** | npm CLI | `/audit` (step 3.2), `/review` (a11y 增强层) | WCAG 2.1 AA 无障碍扫描 — HTML 文件时运行 pa11y-ci，JSX/TSX 回退到代码级 grep 检查 | ✅ |
| **recheck-cli** | npm CLI | `/hunt` (step 4.7), `/audit` (step 3.6) | 正则 ReDoS 灾难性回溯扫描 | ✅ |

| **log-sanitizer** | 内置 grep | `/hunt` (step 4.8), `/audit` (step 3.7), `/review` (step 4.3) | 日志脱敏扫描：console.log 中 Token/密码/身份证号/手机号/邮箱泄露检测 | ✅ |
| **cors-checker** | 内置 grep | `/hunt` (step 4.9), `/audit` (step 3.8), `/review` (step 4.4) | CORS 配置检测：Access-Control-Allow-Origin: * / credentials + 通配符 / cors() 无配置 | ✅ |
| **env-leak-scanner** | 内置 grep | `/hunt` (step 4.10), `/audit` (step 3.9), `/review` (step 4.5) | 前端环境变量泄露：Vite import.meta.env 非 VITE_ 前缀 + process.env 浏览器端泄露 | ✅ |
| **prototype-pollution** | ESLint 规则 | `/audit` (step 1, 2), `/hunt` (step 3), `/review` (step 2 lint) | no-prototype-builtins 原型链污染检测（已内置于 eslint.config.js） | ✅ |
| **sensitive-file-check** | 内置 git | `/hunt` (step 4.12), `/audit` (step 3.12), `/review` (step 4.6) | 敏感文件暴露检查：.env/*.pem/*.key/credentials.json 的 gitignore 规则与 git 追踪状态 | ✅ |
| **deprecated-deps** | npm CLI | `/audit` (step 3.16) | 废弃/未维护依赖检测：npm outdated 识别 deprecated 包 | ✅ |
| **knip** | npx CLI | `/audit` (step 3.17 verifier Pass 7), `/review` (step 2.8 verifier Pass 7) | AST 级死代码/依赖检测：未使用文件/未使用导出/未解析导入/未声明依赖/未使用依赖（11k+ stars） | ✅ |
| **skillspector** | Python CLI | `/hunt` (step 4.15), `/audit` (step 3.18) | AI 技能安全扫描：扫描 `.claude/skills/` `.claude/commands/` 中的提示注入、数据外泄、权限提升、供应链攻击、恶意代理等 64 种漏洞模式（NVIDIA, 2.5k+ stars） | ✅ |
| **aislop** | npx CLI | `/review` (step 2.9), `/audit` (step 3.19) | AI 代码气味扫描：50+ 规则检测叙事注释、吞异常、死代码、as any 滥用、重复 helper、过多抽象（子秒级确定性） | ✅ |
| **dependency-cruiser** | npx CLI | `/audit` (step 3.20) | 依赖架构验证：循环依赖检测、孤儿模块识别、架构分层合规、调用图生成（6.7k+ stars） | ✅ |
| **Lighthouse CI** | npm CLI | `/release` (step 8.6), `/audit` (step 8.8) | 性能门禁：LCP/CLS/TBT 断言 + 缓存策略 + PWA 离线检查，BLOCK-RELEASE 级别阻断 | ✅ |

### 工具安装

```bash
# 核心工具（Phase 1）
npm install -D noleak pa11y-ci recheck-cli knip    # npm 工具
pip install git+https://github.com/seraphimhub/seraphim-audit.git  # seraphim-audit (Python 零依赖)
pip install git+https://github.com/NVIDIA/skillspector.git       # skillspector (AI 技能安全扫描)
# lychee: 下载 Windows 二进制 → https://github.com/lycheeverse/lychee/releases
# aislop: npx aislop (零安装) → https://github.com/scanaislop/aislop
# dependency-cruiser: npx dependency-cruiser (零安装) → https://github.com/sverweij/dependency-cruiser
```

### 与现有工具的无冲突设计

- **不通过 MCP 协议** — 纯 CLI 调用，不占端口，不与 codegraph/pencil/pm-skills MCP 冲突
- **devDependencies 隔离** — 不参与项目构建，不影响业务代码
- **只读扫描** — 不修改源码，不引入新依赖到构建产物

## 注意事项

- 工作流需要在目标项目目录下执行
- 某些操作需要用户确认（如删除文件、覆盖代码）
- 遇到错误时，及时报告并提供解决方案
- 保持代码风格一致
- 遵循项目的设计规范
