#!/usr/bin/env node
/**
 * generate-opencode-config.cjs — 生成 opencode 全局配置 JSON
 *
 * 用法: node scripts/generate-opencode-config.cjs [--pencil <path>]
 *
 * 输出: stdout 打印 JSON，可重定向至 ~/.config/opencode/opencode.json
 */

const pencilPath = process.argv.includes('--pencil')
  ? process.argv[process.argv.indexOf('--pencil') + 1]
  : null;

// ======== 108 Commands ========
const commands = {
  // ---- 38 .md-referenced commands (Claude Code parity) ----
  '/polish': { description: '美化前端项目 (DaisyUI / Animal Island UI)', template: '先完整读取 .claude/commands/ui-polish.md 获取详细工作流。然后按步骤执行前端美化：1) 确认目标路径 2) 弹出风格菜单 3) 安装依赖并应用主题 4) 添加动效 5) 测试验证 6) 生成报告。' },
  '/review': { description: '五层代码审查：静态分析→运行时→视觉→AI语义→聚合报告', template: '先完整读取 .claude/commands/review.md（86行33步混合工作流），严格按 Phase 0-4 执行：Pre-flight Skill → CLI 8工具链(ESLint/npm audit/a11y/knip/depcruise/aislop/Huashu/security) → Post-flight 深度审查 → 安全扫描 → 质量门禁+报告。' },
  '/feature': { description: '功能开发：理解需求→编写测试→实现→CI验证', template: '先完整读取 .claude/commands/feature.md 获取详细工作流。1) 理解需求并确认 2) 编写测试用例 (TDD) 3) 实现功能使测试通过 4) CI 验证。用法：/feature [功能描述]' },
  '/bugfix': { description: 'Bug 修复：复现→定位根因→修复→验证', template: '先完整读取 .claude/commands/bugfix.md 获取详细工作流。1) 复现问题 2) 定位根因 3) 制定修复方案 4) 修复并验证测试通过。用法：/bugfix [问题描述]' },
  '/hunt': { description: '安全漏洞扫描：规则扫描 + 依赖检查 + 自动修复', template: '先完整读取 .claude/commands/hunt.md 获取详细工作流。1) 安全规则扫描 (XSS/SQL注入/CSRF/硬编码密钥) 2) 依赖漏洞扫描 (npm audit) 3) 自动修复 4) 生成报告。' },
  '/analyze': { description: '竞品分析', template: '先完整读取 .claude/commands/analyze.md 获取详细工作流。1) 调用 OpenDigger 获取项目数据 2) 分析活跃度、影响力、质量指标 3) 生成对比分析报告。' },
  '/design': { description: 'AI 驱动设计：多风格方案→确认→输出规范', template: '先完整读取 .claude/commands/design.md 获取详细工作流。1) 调用 Open Design 理解需求 2) 生成多风格方案 3) 用户确认 4) 输出设计规范。' },
  '/simplify': { description: '分析并简化代码逻辑，保持行为不变', template: '先完整读取 .claude/commands/simplify.md 获取详细工作流。分析代码，识别可简化点：减少嵌套、消除重复、合并条件、提取函数。保持行为不变。' },
  '/optimize': { description: '性能测量与优化', template: '先完整读取 .claude/commands/optimize.md 获取详细工作流。分析性能瓶颈，测量当前性能，实施优化，验证改进效果。' },
  '/refactor': { description: '重构指定模块', template: '先完整读取 .claude/commands/refactor.md 获取详细工作流。重构指定模块：分析代码结构，制定计划，执行重构，验证测试通过。' },
  '/new-project': { description: '创建新项目：理解需求→创建结构→初始化配置', template: '先完整读取 .claude/commands/new-project.md 获取详细工作流。创建新项目：理解需求，创建目录结构，初始化配置，安装依赖。' },
  '/plan': { description: '创建实施计划：重述需求→评估风险→分步规划→等待确认', template: '先完整读取 .claude/commands/plan-ceo-review.md 获取详细工作流。1) 重述需求以确认理解 2) 识别风险和阻塞项 3) 将实现分解为阶段 4) 标记依赖关系和复杂性 5) 呈现计划后等待用户确认才能写代码。' },
  '/build-fix': { description: '检测构建系统并增量修复构建/类型错误', template: '先完整读取 .claude/commands/build.md 获取详细工作流。增量修复构建和类型错误。1) 检测项目构建工具 2) 运行构建命令捕获错误 3) 按文件分组并按依赖排序 4) 逐一修复 5) 报告修复结果。' },
  '/loop': { description: '启动迭代优化循环：分析→计划→实现→验证→重复', template: '先完整读取 .claude/commands/loop.md 获取详细工作流（10步迭代）。Phase 1: 分析当前状态并评分。Phase 2: 制定本迭代计划。Phase 3: 实现更改。Phase 4: 运行测试和 linter 验证。Phase 5: 评分对比，不改进则停止。最大 10 次迭代。' },
  '/loop-start': { description: '启动受管理的自主循环模式', template: '先完整读取 .claude/commands/loop-start.md 获取详细工作流。1) 设定目标和迭代次数上限 2) 安全防护 3) 监控进度 4) 满足条件时自动退出。' },
  '/loop-status': { description: '检查活跃循环和卡死状态', template: '先完整读取 .claude/commands/loop-status.md 获取详细工作流。1) 检查活跃循环进程 2) 检查 git 卡死状态 3) 报告资源使用情况 4) 建议下一步操作。' },
  '/audit': { description: '全量健康检查：安全扫描+5层代码审查+依赖审计+性能基线+覆盖率+质量门禁汇总', template: '先完整读取 .claude/commands/audit.md 获取详细工作流（41步全量健康检查）。然后严格按步骤执行：安全扫描→代码审查→依赖审计→性能基线→覆盖率→质量门禁汇总报告。' },
  '/build': { description: '逐步构建：阶段开发+代码审查+人工门禁', template: '先完整读取 .claude/commands/build.md 获取详细工作流。然后按阶段逐步构建，每个阶段完成后进行代码审查并申请用户批准。' },
  '/check': { description: '引擎自检+自愈：检测死动作/孤儿门旗/缺失动作消息并自动修复', template: '先完整读取 .claude/commands/check.md 获取详细工作流。然后执行引擎自检，检测死动作、孤儿门旗、缺失动作消息，自动修复数据映射文件。' },
  '/cicd': { description: '配置本地 CI/CD 流水线，验证 GitHub Actions + 生成 Taskfile', template: '先完整读取 .claude/commands/cicd.md 获取详细工作流（11步）。然后配置本地 CI/CD：验证 GitHub Actions 工作流 + 生成 Taskfile.yml。' },
  '/deps': { description: '安全依赖更新：检查过期→逐个更新→测试→验证破坏性变更→更新锁文件', template: '先完整读取 .claude/commands/deps.md 获取详细工作流（16步）。然后按步骤安全更新依赖。' },
  '/docs': { description: '生成项目文档：API文档/架构图/变更日志', template: '先完整读取 .claude/commands/docs.md 获取详细工作流。然后生成指定类型的文档。' },
  '/e2e': { description: '配置端到端测试：MSW mock + Supertest HTTP + Schemathesis API fuzz', template: '先完整读取 .claude/commands/e2e.md 获取详细工作流（9步）。然后配置 E2E 测试基础设施。' },
  '/monitor': { description: '配置 GitHub Actions 网站监控：Upptime 自动生成配置和工作流', template: '先完整读取 .claude/commands/monitor.md 获取详细工作流（9步）。然后配置 Upptime 网站监控。' },
  '/mobile-audit': { description: '移动端全维度审计：MobSF安全+隐私扫描+依赖CVE+性能基线', template: '先完整读取 .claude/commands/mobile-audit.md 获取详细工作流。然后执行移动端安全+性能审计。' },
  '/mobile-e2e': { description: '移动端 E2E 测试配置：Detox/miniprogram-automator + CI集成', template: '先完整读取 .claude/commands/mobile-e2e.md 获取详细工作流。然后配置移动端 E2E 测试。' },
  '/mobile-onboard': { description: '移动端环境搭建：RN诊断+Android SDK/Xcode+模拟器配置', template: '先完整读取 .claude/commands/mobile-onboard.md 获取详细工作流。然后搭建移动端开发环境。' },
  '/mobile-optimize': { description: '移动端性能优化：Bundle分析+启动时间+FPS+内存+网络', template: '先完整读取 .claude/commands/mobile-optimize.md 获取详细工作流。然后执行移动端性能优化。' },
  '/mobile-release': { description: '移动端发布：证书检查+质量门禁+版本号+CHANGELOG+商店发布', template: '先完整读取 .claude/commands/mobile-release.md 获取详细工作流。然后执行移动端发布流程。' },
  '/mobile-review': { description: '移动端5层审查：ESLint+RN规则+mobsfscan安全+Detox截图+AI语义+a11y', template: '先完整读取 .claude/commands/mobile-review.md 获取详细工作流。然后执行移动端5层代码审查。' },
  '/onboard': { description: '一键环境搭建：检测缺失依赖→安装→配置.env→验证构建→启动开发服务器', template: '先完整读取 .claude/commands/onboard.md 获取详细工作流（16步）。然后执行一键环境搭建。' },
  '/qa': { description: '基于浏览器的 QA 验证：读取 git diff → 测试受影响路由 → 发现 bug', template: '先完整读取 .claude/commands/qa.md 获取详细工作流。然后执行浏览器 QA 验证。' },
  '/release': { description: '端到端发布部署：质量门禁→版本→构建→泄漏检查→Lighthouse→部署→健康检查→GitHub Release', template: '先完整读取 .claude/commands/release.md 获取详细工作流（24步，含3个阻塞门禁）。然后严格按步骤执行发布流程。' },
  '/rollback': { description: '紧急回滚：定位目标版本→验证安全→执行回滚→健康检查→事故复盘', template: '先完整读取 .claude/commands/rollback.md 获取详细工作流（16步，双重确认）。然后按步骤执行紧急回滚。' },
  '/spec': { description: '描述你要构建的功能需求，进入 Spec-Driven 开发流程', template: '先完整读取 .claude/commands/spec.md 获取详细工作流。然后按 Spec-Driven 开发流程：录入需求→/design→/build。' },
  '/plan-ceo-review': { description: '创始人模式产品策略审查：找到 10x 版本，砍掉范围蔓延，聚焦用户影响', template: '先完整读取 .claude/commands/plan-ceo-review.md 获取详细工作流。然后进行产品策略深度审查。' },
  '/recall': { description: 'MemPalace 召回历史对话原文（逐字、无摘要）', template: '先完整读取 .claude/commands/recall.md 获取详细工作流。然后按查询条件召回历史对话。' },
  '/report': { description: '分析本项目并生成时间戳报告', template: '先完整读取 .claude/commands/report.md 获取详细工作流。然后分析项目并生成报告。' },
  '/report-fix': { description: '修复项目报告中发现的问题', template: '先完整读取 .claude/commands/report-fix.md 获取详细工作流。然后根据报告修复问题。' },
  '/others': { description: '查看所有可用工具（场景工作流+辅助工具），弹出分类选择菜单', template: '先完整读取 .claude/commands/others.md 获取详细工作流。然后展示分类菜单供用户选择。' },

  // ---- 70 standalone commands (opencode-only, no .md counterpart) ----
  '/checkpoint': { description: '创建/验证/列出工作流检查点', template: '管理检查点。create: 运行 lint+test 确保干净状态，git commit/stash 并记录到 .claude/checkpoints.log。verify: 对比当前状态。list: 显示所有检查点。' },
  '/save-session': { description: '保存当前会话状态供后续恢复', template: '捕获会话完整状态并写入日期文件。1) 收集上下文 2) 按模板写入 ~/.claude/session-data/ 3) 展示文件内容 4) 等待用户确认。' },
  '/resume-session': { description: '加载最近会话文件并恢复完整上下文', template: '加载之前保存的会话状态。1) 查找 ~/.claude/session-data/ 中最新的 -session.tmp 文件 2) 完整读取 3) 以结构化简报格式呈现 4) 等待用户指示。' },
  '/learn': { description: '从当前会话提取可复用模式并保存为候选 skill', template: '分析当前会话提取有价值模式。1) 回顾会话 2) 识别最可复用的洞察 3) 按模板草拟 skill 文件 4) 用户确认后保存到 ~/.claude/skills/learned/。' },
  '/evolve': { description: '分析已学模式，评估成熟度，提升为正式 skill', template: '评估 /learn 保存的模式。1) 扫描 ~/.claude/skills/learned/ 等 2) 按通用性/清晰度/价值/稳定性评分 3) >=7.0 提升，5.0-7.0 改进，<5.0 存档。' },
  '/test-coverage': { description: '分析覆盖率，识别缺口，生成缺失测试至 80%+', template: '提升测试覆盖率至 80%+。1) 检测测试框架并运行覆盖率 2) 解析报告列出低于 80% 的文件 3) 生成缺失测试 4) 运行全量测试 5) 重新运行覆盖率验证。' },
  '/update-docs': { description: '从源码真相文件同步文档', template: '同步代码与文档。1) 从 package.json 读取脚本 2) 从 .env.example 提取环境变量 3) 更新 CONTRIBUTING.md 和 RUNBOOK.md 4) 检查 90+ 天未修改的文档。' },
  '/update-codemaps': { description: '扫描项目结构并生成 token-lean 架构 codemap', template: '生成架构 codemap。1) 扫描项目结构 2) 在 docs/CODEMAPS/ 中创建/更新 architecture.md 等 3) token-lean 格式。' },
  '/quality-gate': { description: '对文件或项目作用域运行质量检查并报告修复步骤', template: '运行质量门禁。1) 检测目标语言/工具 2) 运行格式化检查 3) 运行 lint/类型检查 4) 生成简洁的修复列表。支持 --fix 和 --strict。' },
  '/project-init': { description: '检测项目技术栈并生成入职方案 (默认 dry-run)', template: '创建安全的入职方案。1) 默认 dry-run 模式 2) 检测技术栈 3) 生成最小方案 4) 报告将要更改的内容 5) 等待用户批准。' },
  '/auto-update': { description: '从上游仓库拉取最新更改并重新应用项目配置', template: '从项目上游仓库拉取最新更改。1) git pull 2) 检测配置变更 3) 重新应用项目本地配置 4) 报告更新内容。' },
  '/sessions': { description: '管理会话历史：列出、加载和查看会话元数据', template: '管理会话记录。1) 列出 ~/.claude/session-data/ 中所有会话 2) 加载指定会话查看详情。' },
  '/marketing-campaign': { description: '规划并执行完整营销活动', template: '从产品简介生成完整营销方案。1) 理解产品/目标受众 2) 生成着陆页文案 3) 创建邮件序列 4) 社交媒体帖子 5) 广告变体 6) 视频脚本 7) 内容日历。' },
  '/jira': { description: '检索 Jira 工单、分析需求、更新状态或添加评论', template: '与 Jira 集成。1) 检索工单详情 2) 分析需求 3) 更新工单状态 4) 添加评论。' },
  '/review-pr': { description: '使用多视角子代理进行全面的 PR 审查', template: '对当前 PR 分支进行全面审查。1) 多子代理并行分析 (架构/安全/性能/可读性) 2) 收集各视角反馈 3) 聚合生成最终审查报告。' },
  '/prune': { description: '清除过时或低价值的已学习模式', template: '清理低价值已学习模式。1) 扫描 ~/.claude/skills/learned/ 等地 2) 按使用频率和上次访问时间评估 3) 标记过时条目 4) 用户确认后删除。' },
  '/promote': { description: '手动将已学习模式提升为正式 skill', template: '手动升级已学习模式为正式 skill。1) 选择要提升的模式 2) 转换格式为正式 SKILL.md 3) 写入 .claude/skills/ 4) 记录升级日志。' },
  '/projects': { description: '列出并管理已知项目及其模式', template: '管理项目列表。1) 显示所有已知项目 2) 每个项目的已学习模式和 skill 统计 3) 支持按名称筛选。' },
  '/security-scan': { description: '运行实用安全扫描', template: '执行安全扫描。1) npm audit 依赖漏洞检查 2) ESLint 安全规则扫描 3) 文件模式匹配检查 4) 聚合报告与修复建议。' },
  '/refactor-clean': { description: '安全识别并移除死代码', template: '安全移除死代码。1) 分析代码识别未使用的函数/变量/导入 2) 逐个移除 3) 每次删除后运行测试验证 4) 报告摘要。' },
  '/model-route': { description: '根据复杂度、风险和预算推荐最佳模型层级', template: '分析任务并推荐模型。1) 评估任务复杂度 2) 评估风险等级 3) 考虑预算约束 4) 推荐最佳模型层级。' },
  '/cost-report': { description: '生成本地 API 使用成本报告', template: '从本地数据库生成成本报告。1) 查询 API 使用记录 2) 按时间/模型/项目分组 3) 计算总成本和平均成本 4) 显示报告。' },
  '/setup-pm': { description: '配置偏好的包管理器', template: '设置包管理器。1) 检测当前项目锁定文件 2) 建议或确认包管理器 3) 生成配置 4) 可选设置为全局默认。' },
  '/feature-dev': { description: '引导式功能开发：代码库理解→架构→实现→验证', template: '引导功能开发全流程。1) 理解需求 2) 探索代码库相关部分 3) 架构设计 4) 分步实现 5) 测试验证。' },
  '/learn-eval': { description: '从会话提取模式并在保存前自我评估质量', template: '提取会话模式并评估质量。1) 回顾会话 2) 识别可复用模式 3) 按通用性/清晰度/价值/稳定性自评 4) 决定保存位置 5) 保存。' },
  '/skill-health': { description: '显示 skill 生态系统健康仪表盘', template: '检查 skill 生态健康。1) 扫描所有 skill 目录 2) 检查前置元数据完整性 3) 报告使用频率和最后更新 4) 标记问题。' },
  '/skill-create': { description: '从 git 历史分析提取编码模式并生成 SKILL.md', template: '从 git 历史提取模式。1) 分析 git log 2) 识别重复出现的问题/修复模式 3) 总结为可复用指导 4) 生成 SKILL.md。' },
  '/instinct-status': { description: '显示已学习模式的当前状态', template: '显示已学模式仪表盘。1) 统计已学习模式总数 2) 按成熟度分类 3) 计算项目覆盖度。' },
  '/instinct-import': { description: '从导出文件或外部源导入已学习模式', template: '导入已学习模式。1) 读取导出文件 2) 验证格式 3) 合并到本地知识库 4) 报告导入结果。' },
  '/instinct-export': { description: '将已学习模式导出为可移植文件', template: '导出已学习模式。1) 选择要导出的模式 2) 序列化为可移植格式 3) 写入导出文件 4) 报告导出位置。' },
  '/ecc-guide': { description: 'ECC 生态系统交互式导航地图', template: '导航 ECC 生态系统。1) 展示可用代理 2) 展示可用技能 3) 展示可用命令 4) 展示钩子配置。' },
  '/harness-audit': { description: '运行确定性仓库审计并返回优先评分卡', template: '审计仓库的 AI 编码准备状态。1) 按 12 个类别评分 2) 为每个类别打分 3) 生成优先改进列表 4) 返回评分卡报告。' },
  '/pm2': { description: '分析项目并为检测到的服务生成 PM2 配置', template: '生成 PM2 配置。1) 分析项目服务 2) 检测入口点和运行命令 3) 生成 ecosystem.config.js 4) 提供管理命令。' },
  '/hookify': { description: '创建钩子规则以防止不需要的行为', template: '创建预防性钩子规则。1) 分析不需要的行为模式 2) 编写检查条件 3) 定义触发动作 4) 保存到 hooks/ 目录。' },
  '/hookify-list': { description: '列出所有已配置的 hookify 规则', template: '显示所有活跃的钩子规则。1) 扫描 hooks/ 目录 2) 解析每条规则的触发条件和动作 3) 以表格格式展示。' },
  '/hookify-help': { description: '获取 hookify 系统的文档和用法', template: '显示钩子系统文档。1) 钩子规则格式说明 2) 可用命令列表 3) 配置示例。' },
  '/hookify-configure': { description: '交互式启用或禁用 hookify 规则', template: '管理钩子规则开关。1) 列出所有规则及当前状态 2) 选择要切换的规则 3) 启用/禁用。' },
  '/prp-implement': { description: '使用严格验证循环执行实施计划', template: '执行计划文件。1) 读取 .claude/PRPs/plans/ 中指定的计划 2) 按步骤执行 3) 每步后验证 4) 报告进度。' },
  '/prp-commit': { description: '快速提交：自然语言描述文件变更', template: '自然语言提交。1) 分析用户自然语言描述的变更 2) 匹配到具体文件 3) git add 相关文件 4) git commit。' },
  '/prp-pr': { description: '从当前分支创建 GitHub PR', template: '创建 PR。1) 检测 PR 模板 2) 分析分支变更 3) 生成描述 4) 推送分支 5) 使用 gh CLI 创建 PR。' },
  '/prp-prd': { description: '交互式 PRD 生成器', template: '生成 PRD。1) 先提问理解问题和假设 2) 来回对话细化需求 3) 输出结构化 PRD 文档 4) 保存到 .claude/PRPs/prds/。' },
  '/prp-plan': { description: '创建全面实施计划', template: '生成实施计划。1) 分析需求 2) 探索代码库相关部分 3) 提取现有模式 4) 分步计划 5) 保存到 .claude/PRPs/plans/。' },
  '/multi-execute': { description: '执行多代理实施计划', template: '多代理执行计划。1) 读取计划 2) 调度前端/后端子代理 3) 独占文件写入 4) 合并成果 5) 验证。' },
  '/multi-backend': { description: '运行后端聚焦的多代理工作流', template: '后端聚焦多代理工作流。1) 选择后端代理 2) 分析需求 3) 并行执行 4) 代码审查 5) 合并。' },
  '/multi-frontend': { description: '运行前端聚焦的多代理工作流', template: '前端聚焦多代理工作流。1) 选择前端代理 2) 分析需求 3) 并行执行 4) 代码审查 5) 合并。' },
  '/multi-plan': { description: '使用并行前端/后端专家代理创建多代理计划', template: '多代理规划。1) 分析需求 2) 分配给前端和后端子代理并行分析 3) 合并计划 4) 输出多阶段执行计划。' },
  '/multi-workflow': { description: '完整 6 阶段多代理开发', template: '完整多代理开发工作流。1) 研究阶段 2) 规划阶段 3) 执行阶段 4) 优化阶段 5) 审查阶段 6) 质量门禁。' },
  '/gan-design': { description: '生成器/评估器设计迭代循环', template: '设计迭代循环。1) 生成器创建设计方案 2) 评估器评分 3) 循环改进 4) 达到迭代上限或评分满意后输出。' },
  '/gan-build': { description: '生成器/评估器构建迭代循环', template: '构建迭代循环。1) 生成器构建实现 2) 评估器审查 3) Playwright 验证 4) 循环改进。' },
  '/santa-loop': { description: '对抗性双审查收敛循环', template: '双审查对抗循环。1) 两个独立子代理分别审查 2) 都批准才能继续 3) 有分歧时迭代直到收敛。' },
  '/cpp-review': { description: 'C++ 代码审查', template: '审查 C++ 代码。1) 检查内存安全 2) 现代 C++ 惯用语法 3) 并发安全 4) 安全漏洞。运行 clang-tidy。' },
  '/cpp-test': { description: 'C++ TDD', template: 'C++ TDD 工作流。1) 编写 GoogleTest 测试 (RED) 2) 实现使测试通过 (GREEN) 3) gcov/lcov 验证覆盖率 4) 重构。' },
  '/cpp-build': { description: '增量修复 C++ 构建/CMake/链接器错误', template: '修复 C++ 构建错误。1) 运行 cmake/make 捕获错误 2) 按编译/链接分组 3) 逐一修复 4) 每次后重新构建验证。' },
  '/flutter-review': { description: 'Flutter/Dart 审查', template: '审查 Flutter/Dart 代码。1) 小部件最佳实践 2) 状态管理 3) 性能 4) 可访问性 5) 安全性。' },
  '/flutter-test': { description: '运行 Flutter 测试并修复失败', template: '运行并修复 Flutter 测试。1) 运行 flutter test 2) 分析失败原因 3) 增量修复 4) 重新验证。' },
  '/flutter-build': { description: '修复 Flutter 构建失败', template: '修复 Flutter 构建。1) 运行 dart analyze 2) 运行 flutter build 3) 按错误类型分组 4) 逐一修复 5) 重新验证。' },
  '/go-review': { description: 'Go 代码审查', template: '审查 Go 代码。1) 惯用 Go 模式 2) 并发安全 3) 错误处理 4) 性能。运行 go vet + staticcheck。' },
  '/go-test': { description: 'Go TDD', template: 'Go TDD 工作流。1) 编写表格驱动测试 (RED) 2) 实现使测试通过 (GREEN) 3) go test -cover 验证 80%+ 4) 重构。' },
  '/go-build': { description: '增量修复 Go 构建错误', template: '修复 Go 构建错误。1) 运行 go build 和 go vet 2) 按模块分组 3) 逐一修复 4) 每次后验证。' },
  '/kotlin-review': { description: 'Kotlin 审查', template: '审查 Kotlin 代码。1) 空安全 2) 协程正确性 3) 惯用 Kotlin 4) Android/Compose 最佳实践。' },
  '/kotlin-test': { description: 'Kotlin TDD', template: 'Kotlin TDD 工作流。1) 编写 Kotest 测试 (RED) 2) 实现使测试通过 (GREEN) 3) Kover 验证 80%+ 4) 重构。' },
  '/kotlin-build': { description: '增量修复 Kotlin/Gradle 构建错误', template: '修复 Kotlin 构建错误。1) 运行 ./gradlew build 2) 按编译器/错误分组 3) 逐一修复 4) 每次后验证。' },
  '/python-review': { description: 'Python 审查', template: '审查 Python 代码。1) PEP 8 合规 2) 类型提示正确性 3) 安全性 4) Python 惯用语法。运行 ruff + mypy。' },
  '/rust-review': { description: 'Rust 审查', template: '审查 Rust 代码。1) 所有权和生命周期问题 2) 不安全代码块 3) 错误处理 4) 惯用 Rust。运行 cargo clippy。' },
  '/rust-test': { description: 'Rust TDD', template: 'Rust TDD 工作流。1) 编写测试 (RED) 2) 实现使测试通过 (GREEN) 3) cargo-llvm-cov 验证 80%+ 4) 重构。' },
  '/rust-build': { description: '增量修复 Rust 构建错误', template: '修复 Rust 构建错误。1) 运行 cargo build 捕获错误 2) 按借用检查/类型/依赖分组 3) 逐一修复 4) 每次后验证。' },
  '/fastapi-review': { description: 'FastAPI 审查', template: '审查 FastAPI 应用。1) 路由器和模式设计 2) 异步正确性 3) 依赖注入 4) Pydantic 模型 5) 安全性 6) 可测试性。' },
  '/gradle-build': { description: '修复 Android 和 KMP 项目的 Gradle 构建错误', template: '修复 Gradle 构建错误。1) 运行 ./gradlew build 2) 分析错误 3) 逐一修复 4) 验证。' }
};

// ======== 17 MCP Servers ========
const mcp = {
  pencil: pencilPath
    ? { type: 'local', command: [pencilPath, '--app', 'visual_studio_code', '--agent', 'openCodeCLI'], enabled: true }
    : null,
  codegraph: { type: 'local', command: ['codegraph', 'serve', '--mcp'], enabled: true },
  github: { type: 'local', command: ['npx', '-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' }, enabled: true },
  memory: { type: 'local', command: ['npx', '-y', '@modelcontextprotocol/server-memory'], enabled: true },
  playwright: { type: 'local', command: ['npx', '-y', '@playwright/mcp', '--browser', 'chromium'], enabled: true },
  'sequential-thinking': { type: 'local', command: ['npx', '-y', '@modelcontextprotocol/server-sequential-thinking'], enabled: true },
  'tavily-search': { type: 'local', command: ['npx', '-y', '@tavily/mcp'], env: { TAVILY_API_KEY: '${TAVILY_API_KEY}' }, enabled: true, description: 'Web search provider' },
  context7: { type: 'local', command: ['npx', '-y', '@upstash/context7-mcp'], env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' }, enabled: true },
  sentry: { type: 'local', command: ['npx', 'ts-node', './.mcp/sentry-mcp/index.ts'], env: { SENTRY_AUTH_TOKEN: '${SENTRY_AUTH_TOKEN}' }, enabled: false },
  supabase: { type: 'local', command: ['npx', '-y', '@supabase/mcp-server-supabase@latest'], env: { SUPABASE_ACCESS_TOKEN: '${SUPABASE_ACCESS_TOKEN}' }, enabled: false },
  stripe: { type: 'local', command: ['npx', '-y', '@stripe/mcp'], env: { STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY}' }, enabled: false },
  resend: { type: 'local', command: ['node', './.mcp/resend-mcp/dist/index.js'], env: { RESEND_API_KEY: '${RESEND_API_KEY}' }, enabled: false },
  schemaforge: { type: 'local', command: ['npx', '-y', 'schemaforge-mcp'], enabled: true, description: 'DB migration lint — schema diff / dry-run / dialect validation' },
  a11y: { type: 'local', command: ['npx', '-y', 'a11y-mcp-server'], enabled: true, description: 'WCAG 2.2 accessibility scanner (64 rules, no browser)' },
  mobsf: { type: 'local', command: ['npx', '-y', 'mobsf-mcp'], env: { MOBSF_URL: '${MOBSF_URL}', MOBSF_API_KEY: '${MOBSF_API_KEY}' }, enabled: false, description: 'Mobile Security Framework — Android/iOS static+dynamic analysis' },
  detox: { type: 'local', command: ['npx', '-y', 'detox-mcp'], enabled: true, description: 'React Native gray-box E2E testing' },
  bearer: { type: 'local', command: ['npx', '-y', '@bearer/mcp'], env: { BEARER_API_KEY: '${BEARER_API_KEY}' }, enabled: false, description: 'PII/GDPR privacy compliance scanner (120+ rules)' }
};

// Filter out null pencil
const cleanMcp = {};
Object.keys(mcp).forEach(k => { if (mcp[k]) cleanMcp[k] = mcp[k]; });

// ======== 4 Providers ========
const provider = {
  claude: {
    name: 'claude',
    model: 'claude-sonnet-4-20250514',
    apiKey: '${ANTHROPIC_API_KEY}'
  }
};

// ======== Build output ========
const config = {
  $schema: 'https://opencode.ai/config.json',
  command: commands,
  mcp: cleanMcp,
  provider,
  instructions: [
    'CLAUDE.md',
    '请使用简体中文回复。所有回答、代码注释和文档都使用中文。'
  ]
};

process.stdout.write(JSON.stringify(config, null, 2));
