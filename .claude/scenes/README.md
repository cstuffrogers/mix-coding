# .claude/scenes/ - 场景定义

此目录包含 `claude-scene` CLI 工具使用的 JSON 场景定义文件（start/list/show/fork 命令）。

## 当前场景（27 个）

| 场景 ID | 指令 | 描述 |
|---------|------|------|
<!-- AUTO-SYNC:SCENE-TABLE-START -->
| `analyze` | `/analyze [项目名]` | 深度分析代码质量、性能瓶颈、安全漏洞、可维护性，生成改进建议 |
| `audit` | `/audit` | 一键全量项目审计：安全扫描 + 代码质量 + 依赖审计 + 性能基线 + 覆盖率 + 质量门禁汇总 |
| `backup` | `/backup` | 使用 Restic 配置加密去重备份，生成备份脚本和排除规则 |
| `bugfix` | `/bugfix 描述` | 端到端一键修复Bug流程（Jira/issue/PR --> issue注释 --> 本地分支 --> 修复 --> 测试 --> 提交 --> PR --> 回归测试 --> 关单） |
| `changelog` | `/changelog` | 基于 Git 提交历史和 Conventional Commits 规范自动生成或更新 CHANGELOG.md |
| `cicd` | `/cicd` | 使用 Act + Task 配置本地 CI/CD 流水线，验证 GitHub Actions 工作流，生成 Taskfile.yml 任务运行器 |
| `deps` | `/deps` | 安全依赖更新流程：检查过期 → 逐项更新 → 测试验证 → 检查breaking changes → 更新lockfile |
| `design` | `/design 描述` | 一键 AI 辅助 UI 设计与交互设计生成：Open Design 品牌+模板+Skill → shape 设计简报确立品味方向 → 三方向提案 → Huashu 原型 → AWM 品牌 → 专家评审 → Impeccable 全维度打磨（critique 检测→12 fixes→critique 验证→3 精准修复，双轮品控+残留修复，53步） |
| `docker` | `/docker` | 自动检测项目语言，生成多阶段 Dockerfile、.dockerignore、docker-compose.yml，验证 Docker 构建语法 |
| `e2e` | `/e2e` | 使用 MSW + Supertest + Schemathesis 配置端到端测试基础设施（Mock + HTTP 断言 + API fuzz） |
| `feature` | `/feature 描述` | 端到端一键推进新功能开发流程（集成CE知识沉淀） |
| `hunt` | `/hunt` | 代码安全漏洞扫描与修复（集成CE知识沉淀） |
| `incident` | `/incident` | 使用 Runme 生成可执行的 Markdown Incident Runbook，包含健康检查、常见问题、升级路径 |
| `llm-proxy-audit` | `/llm-proxy-audit` | 三层防线检测中转站 LLM API 是否注入盗取信息的 tool call：Lobster Trap 实时拦截 + AgentShield 蜜罐检测 + agent-egress-bench 基准验证 |
| `loadtest` | `/loadtest [模式]` | 运行 Artillery 负载测试：支持 smoke/load/stress 三种模式，作为 CI/CD 性能门禁 |
| `log` | `/log` | 检测项目日志库（winston/pino/log4js），自动生成结构化日志配置，检测 ELK/Fluentd 并生成采集配置 |
| `loop` | `/loop` | 无人值守自动迭代（集成CE知识沉淀） |
| `migration` | `/migration` | 审查数据库迁移文件：检测危险操作（NOT NULL无默认值、DROP、类型变更等），阻断高风险变更 |
| `mobile-audit` | `/mobile-audit` | 一键移动端安全+性能+合规+质量审计：MobSF安全扫描 → OWASP MASVS对照 → 隐私合规 → 依赖CVE → 性能基线 → 商店清单 |
| `mobile-e2e` | `/mobile-e2e` | 自动检测项目框架→选择最佳测试工具→生成配置+示例→CI 集成 |
| `mobile-onboard` | `/mobile-onboard` | 自动检测并搭建移动端开发环境：Xcode/Android Studio/Node/JDK/CocoaPods，验证首次构建 |
| `mobile-optimize` | `/mobile-optimize` | 测量基线→定位瓶颈→AI分析→自动优化→重新验证：包体积/启动时间/FPS/内存/网络/电池 |
| `mobile-release` | `/mobile-release` | 端到端移动端发布：证书检查→质量门禁→版本号→CHANGELOG→TestFlight/Google Play |
| `mobile-review` | `/mobile-review` | 5层+移动端UI审查：ESLint+RN规则 → mobsfscan安全 → Detox截图 → mobile-ui-review UI审查 → AI语义+a11y → 聚合报告 |
| `monitor` | `/monitor` | 使用 Upptime 配置 GitHub Actions 原生网站监控，自动生成配置文件和工作流，并部署状态页面 |
| `new-project` | `/new-project 描述` | 从零开始新项目：Pre-flight 设计基准 → shape 设计简报确立品味方向 → 上下文收集 → Skill 规划 → 脚手架 → Open Design → Impeccable 全维度打磨（critique 检测→12 fixes→critique 验证→3 精准修复→Huashu 验证，双轮品控+残留修复）+ AI-Friendly 可访问性审查 → 实现 → 审查 → CE 沉淀（65步） |
| `onboard` | `/onboard` | 一键环境搭建：检测缺失依赖 → 安装 → 配置.env → 验证构建 → 启动开发服务器 |
| `optimize` | `/optimize` | 基于测量的性能优化，先定位瓶颈再修复（集成CE知识沉淀） |
| `refactor` | `/refactor 描述` | 自动执行重构流程：分析重构点、生成重构方案、执行重构、验证效果 |
| `release` | `/release` | 端到端发布部署流程：质量门禁 → 版本号 → 构建 → 验证 → Tag → 发布 |
| `review` | `/review` | 全面代码质量审查 + 自动化安全漏洞扫描（集成CE多Agent深度审查 + sec-bug-hunt + 8项工具链） |
| `rollback` | `/rollback` | 紧急回滚流程：识别目标版本 → 验证回滚安全性 → 执行回滚 → 验证服务恢复 |
| `sbom` | `/sbom` | 生成软件物料清单 (SBOM) 和许可证合规报告，检测限制性许可证（GPL/AGPL/SSPL 等） |
| `simplify` | `/simplify` | 简化代码以提高可读性和可维护性，不改变行为（集成CE知识沉淀） |
| `ui-polish` | `/ui-polish <主题> <路径>` | 全对话模式 59 步混合工作流。前置检测→Phase 0 设计基准→Phase 1 机械步骤（安装依赖/主题注入/图标升级/DaisyUI组件类/Animal Island组件替换/自定义keyframe动画/微交互/硬编码颜色清除+每步验证）→Phase 2 Impeccable 全维度打磨（Huashu→critique→13fixes→critique验证→3精准修复→Huashu验证）+ 完成标准门禁。修复版：每个步骤带强制验证，多子项目独立执行，组件JSX必须修改（不只改CSS）。animate.css 已禁止使用（自定义 keyframe 动画替代） |
<!-- AUTO-SYNC:SCENE-TABLE-END -->

## 相关文件

- `.claude/commands/` - 各场景的 CLI 指令定义（27 个 .md）
- `.claude/skills/` - 可集成到审查/设计流程的 AI 技能
- `.claude/mcp-enable.json` - 按工作流的 MCP 服务器启用映射
- `claude-scene/src/` - CLI 工具源码
