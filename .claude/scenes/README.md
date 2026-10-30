# .claude/scenes/ - 场景定义

此目录包含 `claude-scene` CLI 工具使用的 JSON 场景定义文件（start/list/show/fork 命令）。

## 当前场景（26 个）

| 场景 ID | 指令 | 描述 |
|---------|------|------|
<!-- AUTO-SYNC:SCENE-TABLE-START -->
| `bugfix` | `/bugfix 描述` | 端到端一键修复Bug流程（Jira/issue/PR --> issue注释 --> 本地分支 --> 修复 --> 测试 --> 提交 --> PR --> 回归测试 --> 关单） |
| `check` | `/check` | 引擎功能完整性检查：检测 dead actions / 场景声明但未实现的门禁 / 空转 handler，自动修复 gate-flags 数据文件 |
| `cicd` | `/cicd` | 使用 Act + Task 配置本地 CI/CD 流水线，验证 GitHub Actions 工作流，生成 Taskfile.yml 任务运行器 |
| `deps` | `/deps` | 安全依赖更新流程：检查过期 → 逐项更新 → 测试验证 → 检查breaking changes → 更新lockfile |
| `feature` | `/feature 描述` | 端到端一键推进新功能开发流程（集成CE知识沉淀） |
| `loop` | `/loop` | 无人值守自动迭代（集成CE知识沉淀） |
| `mobile-audit` | `/mobile-audit` | 一键移动端安全+性能+合规+质量审计：MobSF安全扫描 → OWASP MASVS对照 → 隐私合规 → 依赖CVE → 性能基线 → 商店清单 |
| `mobile-e2e` | `/mobile-e2e` | 自动检测项目框架→选择最佳测试工具→生成配置+示例→CI 集成 |
| `mobile-onboard` | `/mobile-onboard` | 自动检测并搭建移动端开发环境：Xcode/Android Studio/Node/JDK/CocoaPods，验证首次构建 |
| `mobile-optimize` | `/mobile-optimize` | 测量基线→定位瓶颈→AI分析→自动优化→重新验证：包体积/启动时间/FPS/内存/网络/电池 |
| `mobile-release` | `/mobile-release` | 端到端移动端发布：证书检查→质量门禁→版本号→CHANGELOG→TestFlight/Google Play |
| `mobile-review` | `/mobile-review` | 5层+移动端UI审查：ESLint+RN规则 → mobsfscan安全 → Detox截图 → mobile-ui-review UI审查 → AI语义+a11y → 聚合报告 |
| `new-project` | `/new-project 描述` | 从零开始新项目：Pre-flight 设计基准 → shape 设计简报确立品味方向 → 上下文收集 → Skill 规划 → 脚手架 → Open Design → Impeccable 全维度打磨（critique 检测→12 fixes→critique 验证→3 精准修复→Huashu 验证，双轮品控+残留修复）+ AI-Friendly 可访问性审查 → 实现 → 审查 → CE 沉淀（65步） |
| `onboard` | `/onboard` | 一键环境搭建：检测缺失依赖 → 安装 → 配置.env → 验证构建 → 启动开发服务器 |
| `optimize` | `/optimize` | 基于测量的性能优化，先定位瓶颈再修复（集成CE知识沉淀） |
| `plan` | `/plan` | 基于文件的持久化任务规划，支持会话恢复、SHA256认证、多阶段追踪 |
| `plan-ceo-review` | `/plan-ceo-review` | 从创始人视角审查功能：找到 10x 版本、砍掉 scope creep、聚焦用户价值 |
| `qa` | `/qa` | 读取 git diff，浏览器测试受影响路由，发现 Bug 并生成结构化报告 |
| `refactor` | `/refactor 描述` | 代码重构与简化合并。可选模式：重构 / 简化（不改变行为）/ 架构优化 |
| `release` | `/release` | 端到端发布部署流程：质量门禁 → 版本号 → 构建 → 验证 → Tag → 发布 |
| `review` | `/review` | 全面代码质量审查，可选模式：代码审查 / 全量审计 / 仅分析 |
| `rollback` | `/rollback` | 紧急回滚流程：识别目标版本 → 验证回滚安全性 → 执行回滚 → 验证服务恢复 |
| `setup` | `/setup` | 一键搭建质量观测设施：E2E 测试（MSW + Supertest + Schemathesis）或网站监控（Upptime + GitHub Actions）。两者流程同构，仅第 2 步动作不同，用 kind 参数区分。 |
| `spec` | `/spec` | 把需求变成可实施的规格：speckit-specify 建 feature → product-manager 补用户故事/验收标准 → ux-designer 补交互与状态 → （可选）clarify 澄清歧义 → 规格落地门禁。产出 specs/NNN-*/spec.md。 |
| `ui-polish` | `/ui-polish <主题> <路径>` | 前端美化与 AI 辅助设计合并。可选模式：UI 美化 / 仅设计 / 品牌系统 / Impeccable 打磨 / 落地页设计（`landing_page`，走 `landing-page-design`） |
| `update` | `/update` | 全量扫描 MCP/Skill/CLI/npm 四类资源 → 检测冲突 → 自动更新无冲突 patch/minor → major 待确认 → 写日期日志 |
<!-- AUTO-SYNC:SCENE-TABLE-END -->

## 相关文件

- `.claude/commands/` - 各场景的 CLI 指令定义（26 个 .md）
- `.claude/skills/` - 可集成到审查/设计流程的 AI 技能
- `.mcp.json` - 真正生效的 MCP 配置（`npm run mcp:switch -- light|full` 在 light/full 两档间切换）
- `claude-scene/src/` - CLI 工具源码

> 上面的场景表由 `sync-docs` 从 JSON 生成，标题里的场景数由 `scripts/check-doc-counts.cjs` 校对 ——
> 手改表会被告警，手改数字会变红。
>
> 「MCP 按场景自动启用」这件事**没有实现**：引擎与脚本都不读任何「场景 → server」映射表。
> 第三十三轮删掉了一份这样的映射配置 —— 没有任何代码引用它，映射里 6 个场景早已退役、
> 8 个现存场景没有映射，而 4 份文档把它写成「每次启动场景时自动启用」。现在只有两份真文件：
> `.mcp.json`（当前生效）与 `.mcp.json.full`（完整档），切换靠 `npm run mcp:switch`。
