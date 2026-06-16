# 自动化工作流规则（Auto-Coding Workflows）

## 核心原则

当用户在对话中提出开发任务时，你必须检查是否可以使用本项目的自动化工作流来完成任务。**优先使用自动化工作流，而非手动操作**。

支持两种触发方式：
- **指令模式（推荐）**：用户输入 `/指令名 [参数...]`
- **自然语言模式**：用户说"帮我美化前端"等自然语言

---

## 引擎

所有工作流通过 **Scene 引擎** 在 Claude Code 对话内直接执行：

```
1. 识别工作流 → 匹配场景ID
2. 收集参数 → 参数不足时向用户补全
3. 检测项目特征 → 组装可选增强菜单（详见 CLAUDE.md 可选增强选择）
4. 有适用增强 → 弹出菜单让用户勾选（3秒无操作 = 仅默认项勾选）
5. 执行: node src/index.js start <场景ID> --auto [参数]
```

**对话模式优先**：以下命令依赖 Claude Code skill/MCP 工具，CLI 子进程无法调用，必须在对话内直接执行：

| 命令 | 依赖工具 | 对话模式执行 |
|------|---------|-------------|
| `/design` | web-design-engineer skill (Open Design, 150 品牌系统) | 按 `.claude/commands/design.md` 对话内调用 Skill tool |
| `/ui-polish` | web-design-engineer + impeccable + ai-friendly-web-design skills | 按 `.claude/commands/ui-polish.md` 对话内 Pre-flight Skill → CLI 机械步骤 → 后置 Skill 审查 |
| `/new-project` | web-design-engineer skill (前端项目时) | 按 `.claude/commands/new-project.md` 对话内调用 Skill + CLI 执行 |
| `/review` | review skill (五层审查) | 按 `.claude/commands/review.md` 对话内执行 |

> 这些命令在 Claude Code 会话内执行时，按 command 文件在对话内完成。

---

## 可选增强检测

在执行工作流之前，自动检测项目特征并弹出增强选择菜单（详见 CLAUDE.md 可选增强选择）：

### 检测规则

| 检测项 | 检测方式 | 适用场景 |
|--------|---------|---------|
| Web 前端 | `*.tsx`/`*.jsx`/`*.html` + `package.json` | review、ui-polish |
| 数据库 | `migrations/`、`schema.*`、`prisma/`、`drizzle/` | feature、release |
| 需求复杂度 | 用户描述 > 50 字 | feature、new-project |
| i18n | i18n 配置、locale/ 目录 | review |

### 直接执行（不弹菜单）

<!-- AUTO-SYNC:SKIP-ENHANCEMENT-LIST-START -->
以下场景无可选增强，直接执行核心工作流：`analyze`、`backup`、`bugfix`、`changelog`、`cicd`、`deps`、`design`、`docker`、`e2e`、`hunt`、`incident`、`loadtest`、`log`、`loop`、`migration`、`monitor`、`onboard`、`optimize`、`prototype`、`rollback`、`sbom`、`simplify`
<!-- AUTO-SYNC:SKIP-ENHANCEMENT-LIST-END -->

---

## 指令速查表（最优先匹配）

**用户输入以 `/` 开头时，直接按此表匹配，无需做自然语言分析：**

| 指令 | 场景ID | 执行方式 |
|------|--------|---------|
<!-- AUTO-SYNC:COMMAND-TABLE-START -->
| `/analyze` | `analyze` | ❌ | `node src/index.js start analyze --auto --prompt "<描述>"` | — |
| `/audit` | `audit` | ❌ | `node src/index.js start audit --auto` | — |
| `/backup` | `backup` | ❌ | `node src/index.js start backup --auto` | — |
| `/bugfix` | `bugfix` | ❌ | `node src/index.js start bugfix --auto --prompt "<描述>"` | — |
| `/changelog` | `changelog` | ❌ | `node src/index.js start changelog --auto` | — |
| `/cicd` | `cicd` | ❌ | `node src/index.js start cicd --auto` | — |
| `/deps` | `deps` | ❌ | `node src/index.js start deps --auto` | — |
| `/design` | `design` | ❌ | `node src/index.js start design --auto --prompt "<描述>"` | — |
| `/docker` | `docker` | ❌ | `node src/index.js start docker --auto` | — |
| `/e2e` | `e2e` | ❌ | `node src/index.js start e2e --auto` | — |
| `/feature` | `feature` | ❌ | `node src/index.js start feature --auto --prompt "<描述>"` | — |
| `/hunt` | `hunt` | ❌ | `node src/index.js start hunt --auto` | — |
| `/incident` | `incident` | ❌ | `node src/index.js start incident --auto` | — |
| `/loadtest` | `loadtest` | ❌ | `node src/index.js start loadtest --auto` | — |
| `/log` | `log` | ❌ | `node src/index.js start log --auto` | — |
| `/loop` | `loop` | ❌ | `node src/index.js start loop --auto` | — |
| `/migration` | `migration` | ❌ | `node src/index.js start migration --auto` | — |
| `/mobile-audit` | `mobile-audit` | ❌ | `node src/index.js start mobile-audit --auto` | — |
| `/mobile-e2e` | `mobile-e2e` | ❌ | `node src/index.js start mobile-e2e --auto` | — |
| `/mobile-onboard` | `mobile-onboard` | ❌ | `node src/index.js start mobile-onboard --auto` | — |
| `/mobile-optimize` | `mobile-optimize` | ❌ | `node src/index.js start mobile-optimize --auto` | — |
| `/mobile-release` | `mobile-release` | ❌ | `node src/index.js start mobile-release --auto` | — |
| `/mobile-review` | `mobile-review` | ❌ | `node src/index.js start mobile-review --auto` | — |
| `/monitor` | `monitor` | ❌ | `node src/index.js start monitor --auto` | — |
| `/new-project` | `new-project` | ❌ | `node src/index.js start new-project --auto --prompt "<描述>"` | — |
| `/onboard` | `onboard` | ❌ | `node src/index.js start onboard --auto` | — |
| `/optimize` | `optimize` | ❌ | `node src/index.js start optimize --auto` | — |
| `/refactor` | `refactor` | ❌ | `node src/index.js start refactor --auto --prompt "<描述>"` | — |
| `/release` | `release` | ❌ | `node src/index.js start release --auto` | — |
| `/review` | `review` | ❌ | `node src/index.js start review --auto` | — |
| `/rollback` | `rollback` | ❌ | `node src/index.js start rollback --auto` | — |
| `/sbom` | `sbom` | ❌ | `node src/index.js start sbom --auto` | — |
| `/simplify` | `simplify` | ❌ | `node src/index.js start simplify --auto` | — |
| `/ui-polish` | `ui-polish` | ❌ | `node src/index.js start ui-polish --auto --theme <主题> --target <路径>` | — |
<!-- AUTO-SYNC:COMMAND-TABLE-END -->

---

### CE Plugin 指令（Compound Engineering）

**需要先安装 CE Plugin**：`/plugin install compound-engineering@anthropic`

| 指令 | 功能描述 | 用法格式 | 集成场景 |
|------|---------|---------|---------|
| `/ce-brainstorm` | 需求头脑风暴 | `/ce-brainstorm [需求描述]` | 所有场景 |
| `/ce-plan` | 详细方案规划 | `/ce-plan [任务描述]` | feature, new-project |
| `/ce-review` | 多Agent深度审查 | `/ce-review [审查范围]` | review, bugfix, refactor |
| `/ce-work` | 分步开发执行 | `/ce-work [任务]` | 所有场景 |
| `/ce-debug` | 系统Bug排查 | `/ce-debug [问题描述]` | bugfix |
| `/ce-compound` | 知识沉淀 | `/ce-compound [总结内容]` | 所有场景（自动触发） |

**CE Plugin 集成说明**：
- CE Plugin 作为增强层运行，不会替代现有工作流
- 所有27个场景在执行完成后会自动调用 `/ce-compound` 进行知识沉淀
- 部分场景会在执行过程中调用特定CE命令（如 `/ce-plan`、`/ce-review`、`/ce-debug`）
- CE命令有条件判断 `plugin_ce_available`，未安装时自动跳过，不影响核心流程

---

### jvn Spec-Driven 指令

**jvn 已集成**，提供规范的 spec → design → build 开发流程：

| 指令 | 功能描述 | 用法格式 | 集成场景 |
|------|---------|---------|---------|
| `/spec` | 创建功能规格说明（PM Agent 引导需求澄清） | `/spec "需求描述"` | feature, new-project |
| `/design` | 生成技术设计方案（架构师 + UX Agent 参与） | `/design` | spec 之后 |
| `/build` | 分阶段实现，人工审批关卡（代码审查 + 宪法校验） | `/build` | design 之后 |
| `/report` | 生成项目分析报告 | `/report` | review, audit |
| `/report-fix` | 根据报告修复问题 | `/report-fix` | report 之后 |

**与现有工作流的关系**：
- jvn 命令是现有 27 个工作流的**互补增强**，不是替代
- `/feature` 和 `/new-project` 可在执行过程中调用 `/spec` + `/design` + `/build`
- `/review` 可调用 `/report` 生成详细分析
- 5 个 Agent 在 `/design` 和 `/build` 阶段自动参与审查

---

### 指令解析规则

1. 用户输入以 `/` 开头时，提取指令名，对照上表找到场景ID
2. 指令后的文本即为参数，按以下规则分配：
   - `/ui-polish animal-island E:\my-app` → `--theme animal-island --target "E:\my-app"`
   - `/ui-polish E:\my-app`（只有路径）→ 询问主题 → 再执行
   - `/bugfix 登录页面报错了` → `--prompt "登录页面报错了"`
   - `/feature 添加用户管理` → `--prompt "添加用户管理"`
   - `/new-project React+TS后台系统` → `--prompt "React+TS后台系统"`
4. 参数不足以执行时，向用户提问补全

### 指令执行示例

```
用户: /ui-polish animal-island E:\my-app
AI: 识别到 /ui-polish 指令，主题=animal-island，路径=E:\my-app
    → 执行: node src/index.js start ui-polish --auto --theme animal-island --target "E:\my-app"

用户: /bugfix 登录页面表单验证不生效
AI: 识别到 /bugfix 指令，问题描述="登录页面表单验证不生效"
    → 执行: node src/index.js start bugfix --auto --prompt "登录页面表单验证不生效"

用户: /review
AI: 识别到 /review 指令，无需额外参数
    → 执行: node src/index.js start review --auto
```

---

## CLI 工具路径

**Scene 引擎**：`claude-scene/`（相对于项目根目录）

```bash
node src/index.js start <场景ID> --auto [选项...]
```

---

## 自然语言触发（无 `/` 前缀时使用）

当用户输入不以 `/` 开头时，按以下触发词匹配。以下是完整的 34 个工作流：

<!-- AUTO-SYNC:TRIGGER-SECTIONS-START -->
### 1. 竞品分析 — `analyze`
**触发词**：竞品、分析、竞品分析、市场分析、对比、竞品对比
**自然语言示例**：
- "帮我分析一下竞品"
- "做一个竞品分析报告"
- "对比一下市面上的同类产品"

**CLI 命令**：
```bash
node src/index.js start analyze --auto --prompt "分析项目名"
```

### 2. 全面健康检查 — `audit`
**触发词**：审计、健康检查、全面检查、audit、health check、项目体检
**自然语言示例**：
- "帮我的项目做一次全面体检"
- "审计一下项目健康状况"
- "做一次完整的安全和质量检查"

**CLI 命令**：
```bash
node src/index.js start audit --auto
```

### 3. 备份配置 — `backup`
**触发词**：备份、backup、restic、数据备份、灾难恢复、数据保护、加密备份
**自然语言示例**：
- "帮我配置项目备份"
- "设置自动备份"
- "给数据做加密备份"

**CLI 命令**：
```bash
node src/index.js start backup --auto
```

### 4. Bug 修复 — `bugfix`
**触发词**：修复、bug、报错、出错、不对、有问题、异常、修复这个、修一下、不工作、报错了、改 bug
**自然语言示例**：
- "登录页面报错了，帮我修复"
- "这个 bug 帮我修一下"
- "程序运行出错，帮我看看"
- "修复表单验证的问题"

**CLI 命令**：
```bash
node src/index.js start bugfix --auto --prompt "用户的问题描述"
```

**参数处理规则**：
- 先让用户描述问题的具体表现
- 如有错误日志，引导用户提供
- 将用户描述拼接为 `--prompt` 参数

### 5. 变更日志 — `changelog`
**触发词**：changelog、变更日志、更新日志、release notes、版本日志
**自然语言示例**：
- "帮我生成变更日志"
- "更新一下 CHANGELOG"
- "生成 release notes"

**CLI 命令**：
```bash
node src/index.js start changelog --auto
```

### 6. CI/CD 配置 — `cicd`
**触发词**：CI/CD、cicd、流水线、pipeline、持续集成、持续部署、Taskfile、本地CI
**自然语言示例**：
- "帮我配置 CI/CD 流水线"
- "设置本地 CI 验证"
- "生成 Taskfile 任务配置"

**CLI 命令**：
```bash
node src/index.js start cicd --auto
```

### 7. 依赖更新 — `deps`
**触发词**：更新依赖、升级依赖、deps、dependency update、过期的包、依赖升级
**自然语言示例**：
- "帮我更新一下项目依赖"
- "依赖太旧了，升级一下"
- "检查并更新过期的npm包"

**CLI 命令**：
```bash
node src/index.js start deps --auto
```

### 8. AI 设计 — `design`
**触发词**：设计、UI设计、界面设计、设计系统、design system、设计稿
**自然语言示例**：
- "帮我设计一个登录页面"
- "设计一个后台管理系统界面"
- "生成设计系统"

**CLI 命令**：
```bash
node src/index.js start design --auto --prompt "设计需求描述"
```

### 9. Docker 容器化 — `docker`
**触发词**：docker、容器化、Dockerfile、docker-compose、容器部署
**自然语言示例**：
- "帮我配置 Docker 容器化"
- "生成 Dockerfile 和 docker-compose"
- "给项目加上容器支持"

**CLI 命令**：
```bash
node src/index.js start docker --auto
```

### 10. E2E 测试配置 — `e2e`
**触发词**：e2e、端到端测试、集成测试、E2E测试、API测试、mock、fuzz、接口测试
**自然语言示例**：
- "帮我配置端到端测试"
- "设置 API 集成测试"
- "加上接口 mock 和 fuzz 测试"

**CLI 命令**：
```bash
node src/index.js start e2e --auto
```

### 11. 新增功能 — `feature`
**触发词**：添加、新增、实现、做一个、开发、功能、加一个、新功能、增加
**自然语言示例**：
- "添加一个用户登录功能"
- "帮我实现一个搜索功能"
- "新增一个数据导出模块"
- "开发一个消息通知系统"

**CLI 命令**：
```bash
node src/index.js start feature --auto --prompt "用户的功能描述"
```

**参数处理规则**：
- 先确认功能需求的完整性
- 如果用户描述过于简单，追问关键细节
- 将完整需求描述作为 `--prompt` 参数

### 12. 安全扫描 — `hunt`
**触发词**：安全、漏洞、安全检查、有没有安全问题、安全扫描、查漏洞
**自然语言示例**：
- "帮我做一下安全检查"
- "扫描一下有没有漏洞"
- "检查安全问题"

**CLI 命令**：
```bash
node src/index.js start hunt --auto
```

### 13. 事故响应 — `incident`
**触发词**：事故、故障、应急、oncall、SRE、运维手册、runbook、incident、故障排查
**自然语言示例**：
- "帮我生成事故响应手册"
- "创建应急处理 runbook"
- "写一份故障排查指南"

**CLI 命令**：
```bash
node src/index.js start incident --auto
```

### 14. 负载测试 — `loadtest`
**触发词**：负载测试、load test、压力测试、stress test、性能测试、loadtest、artillery
**自然语言示例**：
- "（请根据实际场景补充示例）"

**CLI 命令**：
```bash
node src/index.js start loadtest --auto
```

**参数处理规则**：
- （请根据实际场景补充参数规则）

### 15. 日志聚合 — `log`
**触发词**：日志、log、logging、日志配置、ELK、winston、pino、日志聚合
**自然语言示例**：
- "帮我配置日志系统"
- "设置日志聚合"
- "生成日志配置文件"

**CLI 命令**：
```bash
node src/index.js start log --auto
```

### 16. 自动迭代 — `loop`
**触发词**：迭代、循环优化、持续改进、自动迭代、循环、自动优化
**自然语言示例**：
- "启动自动迭代循环"
- "持续改进代码质量"
- "进入自动优化模式"

**CLI 命令**：
```bash
node src/index.js start loop --auto
```

### 17. 数据库迁移审查 — `migration`
**触发词**：迁移审查、数据库迁移、migration review、db migration、schema审查、数据库变更
**自然语言示例**：
- "（请根据实际场景补充示例）"

**CLI 命令**：
```bash
node src/index.js start migration --auto
```

**参数处理规则**：
- （请根据实际场景补充参数规则）

### 18. 移动端全维度审计 — `mobile-audit`
**触发词**：App安全、App审计、移动端审计、检查App安全、应用安全检查、App体检、mobile audit
**自然语言示例**：
- "帮我检查一下 App 的安全性"
- "给 App 做个全面体检"
- "应用安全扫描"

**CLI 命令**：
```bash
node src/index.js start mobile-audit --auto
```

### 19. 移动端 E2E 测试配置 — `mobile-e2e`
**触发词**：App测试、移动端E2E、UI自动化测试、mobile e2e、Detox
**自然语言示例**：
- "帮我配置 App 的 E2E 测试"
- "给项目加上 UI 自动化测试"
- "配置 Detox 测试"

**CLI 命令**：
```bash
node src/index.js start mobile-e2e --auto
```

### 20. 移动端开发环境搭建 — `mobile-onboard`
**触发词**：App开发环境、RN环境搭建、Flutter环境、iOS开发环境、Android开发环境、mobile setup
**自然语言示例**：
- "帮我搭建 App 开发环境"
- "配置一下 RN 的开发环境"
- "准备 iOS 开发环境"

**CLI 命令**：
```bash
node src/index.js start mobile-onboard --auto
```

### 21. 移动端性能优化 — `mobile-optimize`
**触发词**：App太慢、App卡顿、移动端性能、包体积优化、启动优化、mobile optimize、优化App
**自然语言示例**：
- "App 启动太慢了，帮我优化"
- "这个应用好卡，帮忙看看"
- "包体积太大了，优化一下"

**CLI 命令**：
```bash
node src/index.js start mobile-optimize --auto
```

### 22. 移动端发布流程 — `mobile-release`
**触发词**：发布App、App上线、移动端发布、TestFlight、应用商店发布、mobile release、帮我发布
**自然语言示例**：
- "帮我发布 App 到 TestFlight"
- "App 准备上线了"
- "发布新版本到应用商店"

**CLI 命令**：
```bash
node src/index.js start mobile-release --auto [patch|minor|major]
```

**参数处理规则**：
- 如果用户未指定版本升级类型，交互式选择 patch/minor/major

### 23. 移动端代码审查 — `mobile-review`
**触发词**：App审查、RN审查、Flutter审查、移动端代码审查、检查App代码、mobile review、App代码质量
**自然语言示例**：
- "帮我审查一下 App 代码"
- "review 一下 RN 项目的代码质量"
- "检查 Flutter 代码有没有问题"

**CLI 命令**：
```bash
node src/index.js start mobile-review --auto
```

### 24. 网站监控配置 — `monitor`
**触发词**：监控、monitor、uptime、网站监控、健康监控、upptime、状态页、可用性监控
**自然语言示例**：
- "帮我配置网站监控"
- "设置一个 uptime 监控"
- "给项目加上健康检查监控"

**CLI 命令**：
```bash
node src/index.js start monitor --auto
```

### 25. 新项目创建 — `new-project`
**触发词**：创建项目、新建项目、初始化、脚手架、新项目、创建一个、搭一个
**自然语言示例**：
- "帮我创建一个新的 React 项目"
- "新建一个后台管理系统"
- "初始化一个全栈项目"

**CLI 命令**：
```bash
node src/index.js start new-project --auto --prompt "项目描述"
```

### 26. 环境搭建 — `onboard`
**触发词**：环境搭建、setup、init project、新手入门、onboard、配置环境、环境准备
**自然语言示例**：
- "帮我搭建开发环境"
- "配置一下这个项目的环境"
- "新人入职，帮我设置好开发环境"

**CLI 命令**：
```bash
node src/index.js start onboard --auto
```

### 27. 性能优化 — `optimize`
**触发词**：优化、性能、加速、太慢、卡顿、快一点、加载慢、性能优化
**自然语言示例**：
- "这个页面加载太慢了，帮我优化"
- "优化一下性能"
- "应用很卡顿，能不能加速"

**CLI 命令**：
```bash
node src/index.js start optimize --auto
```

### 28. 代码重构 — `refactor`
**触发词**：重构、整理、优化结构、改写、重写、clean code、代码整理
**自然语言示例**：
- "这段代码需要重构"
- "帮我整理一下代码结构"
- "重写这个模块"

**CLI 命令**：
```bash
node src/index.js start refactor --auto --prompt "重构目标模块"
```

### 29. 发布部署 — `release`
**触发词**：发布、release、上线、deploy、ship、发版、部署
**自然语言示例**：
- "帮我发布一个新版本"
- "准备上线到生产环境"
- "执行部署流程"

**CLI 命令**：
```bash
node src/index.js start release --auto
```

### 30. 代码审查 — `review`
**触发词**：审查、review、检查代码、代码质量、有没有问题、帮我看看代码、review 一下
**自然语言示例**：
- "帮我审查一下代码"
- "检查一下代码质量"
- "review 一下最近的改动"
- "看看代码有没有问题"

**CLI 命令**：
```bash
node src/index.js start review --auto
```

### 31. 紧急回滚 — `rollback`
**触发词**：回滚、rollback、撤销部署、紧急恢复、revert、版本回退
**自然语言示例**：
- "线上出问题了，赶紧回滚"
- "回滚到上一个版本"
- "紧急撤销这次部署"

**CLI 命令**：
```bash
node src/index.js start rollback --auto
```

### 32. SBOM 许可证合规 — `sbom`
**触发词**：sbom、许可证、license、合规、依赖分析、软件物料清单
**自然语言示例**：
- "帮我生成 SBOM"
- "检查一下许可证合规"
- "扫描依赖许可证"

**CLI 命令**：
```bash
node src/index.js start sbom --auto
```

### 33. 代码简化 — `simplify`
**触发词**：简化、精简、减少复杂度、太复杂、简单点、代码简化
**自然语言示例**：
- "这段代码太复杂了，简化一下"
- "精简一下代码逻辑"
- "能不能写简单点"

**CLI 命令**：
```bash
node src/index.js start simplify --auto
```

### 34. 前端美化 — `ui-polish`
**触发词**：美化、换主题、改UI、DaisyUI、Animal Island、前端美化、漂亮、配色、改样式、UI改版、换个风格、界面美化
**自然语言示例**：
- "帮我把这个项目的前端美化一下"
- "把前端改成 Animal Island 风格"
- "换个 DaisyUI 主题"
- "这个界面太丑了，美化一下"
- "给项目换个漂亮的主题"

**CLI 命令**：
```bash
node src/index.js start ui-polish --auto --theme <daisyui|animal-island|custom> --target "项目路径"
```

**参数处理规则**：
- 如果用户未指定目标路径，必须询问："请提供要美化的前端项目路径"
- 如果用户未指定主题，必须让用户选择：
  ```
  请选择前端美化风格：
  1. DaisyUI（35+专业主题）
  2. Animal Island UI（自然、圆润风格）
  3. Custom（自定义颜色）
  ```
- 如果用户选择了 Custom，询问主色调、背景色、强调色
<!-- AUTO-SYNC:TRIGGER-SECTIONS-END -->

## 执行流程（重要）

当识别到用户意图匹配某个工作流时，严格按以下流程执行：

1. **识别意图**：从用户消息中匹配触发词，确定对应的工作流
2. **确认参数**：
   - 检查是否缺少必要参数（如 `--target`、`--prompt`、`--theme`）
   - 缺失参数时，**必须向用户提问确认**，不要自行猜测
   - 确认完毕后，向用户复述将要执行的操作
3. **执行命令**：使用 `RunCommand` 工具运行对应的 CLI 命令
   - 工作目录设为 `e:\auto-coding\claude-scene`
   - 所有命令必须加 `--auto` 参数
   - 命令示例：`node src/index.js start ui-polish --auto --theme animal-island --target "E:\your-project"`
4. **报告结果**：向用户展示执行结果，包括成功/失败状态和输出摘要

## 意图识别优先级

当用户消息同时匹配多个工作流触发词时，按以下优先级选择：

1. `ui-polish`（美化/UI 相关）— 最高优先级，因为 UI 美化是最具体的操作
2. `mobile-audit` / `mobile-review`（移动端安全/审查）— App 安全性优先
3. `bugfix`（修复/bug 相关）— 有明确问题描述时优先
4. `feature`（新增/功能相关）— 有明确功能需求时优先
5. `hunt`（安全/漏洞相关）— 安全性问题优先于代码质量
6. `mobile-optimize` / `optimize` — 性能优化类
7. `refactor` / `simplify` — 代码改进类
8. `mobile-release` / `release` — 发布类
9. `mobile-e2e` / `mobile-onboard` — 配置类
10. 其他工作流

## 快速查看所有工作流

```bash
cd e:\auto-coding\claude-scene && node src/index.js list
```

## 注意事项

- 所有命令必须加 `--auto` 参数避免交互式等待
- 必要参数缺失时必须向用户确认后再执行
- 如果命令失败，报告错误信息并建议手动排查
- **路径中的反斜杠在命令行中需要正确处理**，Windows 路径如 `E:\your-project` 需要用引号包裹
- 在执行命令前，先向用户简要说明将要执行的工作流和操作