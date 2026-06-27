---
description: Create a new project: Pre-flight design baseline → review-checklist → Impeccable audit → craft rules → shape design brief (taste direction) → context gathering → Skill planning → scaffold → Git guardrails → Open Design 全资源（152品牌+111模板+138技能+11craft规则+8Huashu模块+5设备框+103提示词模板+3演示框架+8吉祥物）→ CSS框架安装(DaisyUI/Animal Island/lucide-react) → Impeccable full 18-step polish chain（critique detect → polish+layout+colorize+bolder+typeset+animate+delight+harden+distill+clarify+adapt+optimize+quieter+onboard → critique verify → 3 targeted fixes, dual-pass QC）+ Huashu 5-dimension review + AI-Friendly a11y → implement → review → CE compound. 65+ 步全对话模式工作流。
argument-hint: "[项目描述]"
---

# /new-project — 新项目创建

65 步全对话模式工作流：**Pre-flight 设计基准（对话模式）→ shape 设计简报确立品味方向 → 上下文收集 → Skill 规划 → 脚手架 → Git guardrails → Open Design → Impeccable 全维度打磨（Huashu 基线 → critique 检测 → polish+layout+colorize+bolder+typeset+animate+delight+harden+distill+clarify+adapt+optimize → critique 验证 → 3 项精准残留修复 → Huashu 验证，双轮品控+残留修复）+ AI-Friendly 可访问性审查（对话模式，⚠️ 前端项目必须执行）→ 实现 → 审查 → CE 沉淀**

## Usage

```text
/new-project React+TS 后台管理系统，需要用户管理、角色权限、数据看板
/new-project "Vue3 + Express full-stack blog with auth"
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("web-design-engineer")** (`step 0.3`) — 声明设计系统基准（Palette/Typography/Spacing/Motion/Radius/Shadows），加载 150 品牌系统（前端项目）
2. **Skill("review-checklist")** (`step 0.5`) — 加载 23 项审查清单，建立项目初始化分析框架
3. **recall** (`step 0.7`) — 全量记忆注入
4. **Impeccable shape** (`step 0.71`) — 🆕 设计发现访谈 → 10 节设计简报（mood/references/color strategy/design direction/bold move），在生成前确立品味方向约束（on_error: abort）
5. **Impeccable audit** (`step 0.8`) — 🆕 技术质量基线扫描（a11y/perf/responsive），为新项目建立初始质量基线
6. **Open Design 资源清单** (`step 0.85`) — 🆕 Bash `ls open-design/design-systems/` + `ls open-design/design-templates/` + `ls open-design/skills/` + `ls open-design/prompt-templates/image/` + `ls open-design/prompt-templates/video/` + `ls open-design/templates/` + `ls open-design/assets/community-pets/` 列出 152 品牌 + 111 设计模板 + 138 技能 + 103 提示词模板（46 图片 + 57 视频）+ 3 演示框架 + 8 吉祥物
7. **craft 规则加载** (`step 0.9`) — 🆕 Read `open-design/craft/` 全部 11 个规则文件（accessibility-baseline / animation-discipline / anti-ai-slop / color / form-validation / laws-of-ux / rtl-and-bidi / state-coverage / typography / typography-hierarchy / typography-hierarchy-editorial），建立完整设计约束基准。后续所有实现步骤必须遵守这些规则。
8. **Open Design 插件系统** (`step 0.95`) — 🆕 Bash `ls open-design/plugins/_official/scenarios/` 列出 11 个场景插件（`od-react-export` / `od-nextjs-export` / `od-vue-export` 框架导出；`od-design-refine` 设计迭代；`od-new-generation` 设计生成）。`ls open-design/plugins/_official/atoms/` 列出 13 个原子插件（`critique-theater` / `direction-picker` / `design-extract` / `token-map` 等）。`ls open-design/plugins/_official/examples/` 列出 140 个示例模板。

### Phase 1: 上下文收集（对话内执行）

Claude 直接调用 MCP 工具收集上下文（不通过 CLI 子进程）：

- **GitHub MCP** (`step 1`) — 搜索最佳实践仓库
- **Tavily MCP** (`step 1.1`) — 搜索项目类型最佳实践
- **Context7 MCP** (`step 1.2`) — 获取技术栈文档
- **Supabase MCP** (`step 1.3`) — 获取数据库模板（条件触发）
- **Stripe MCP** (`step 1.4`) — 获取支付流程模板（条件触发）
- **Resend MCP** (`step 1.5`) — 获取邮件模板（条件触发）
- **OpenDigger** (`step 1.6`) — 竞品分析（条件触发，交互式）

### Phase 2: 规划（对话内执行）

11. **ce-plan** (`step 2`) — CE Plugin 生成详细项目规划：技术选型、架构设计、任务拆解
12. **Skill("review")** (`step 2.5`) — PRD 合成并发布到 Issue Tracker（对话模式）
13. **Skill("review")** (`step 2.6`) — PRD 拆解为垂直切片 Issue（对话模式）

### Phase 3: 脚手架 + 实现（对话内执行）

14. **applyTemplate** (`step 3`) — 项目脚手架：创建目录结构、初始化配置文件（文件操作工具）
15. **Git guardrails** (`step 3.1`) — 配置 PreToolUse Hook 拦截危险 git 命令（Edit 修改 settings.json）
16. **askUser** (`step 3.5`) — 询问是否使用 Open Design（AskUserQuestion 交互）
17. **Open Design 品牌导入** (`step 3.67`) — Bash `ls open-design/design-systems/` 列出 152 品牌 → AskUserQuestion 选择品牌 → Read `open-design/design-systems/<brand>/DESIGN.md` + `tokens.css` + `components.html` → Edit 注入 CSS 变量到项目，将可复用组件模式（按钮/卡片/表单/导航样式）映射为 DaisyUI 类或 Tailwind 类（对话模式，前端项目）
18. **DESIGN.md → Tailwind 导出** (`step 3.73`) — 品牌导入完成后：`npx @google/design.md export --format tailwind` 将 DESIGN.md token 导出为 Tailwind 配置，自动注入 `tailwind.config.js` 的 `theme.extend` 块。条件：`user_confirmed_open_design || awesome_design_md_used`
19. **CSS 框架安装** (`step 3.675`) — 🆕 前端项目：`npm install daisyui@latest lucide-react@latest --save`（DaisyUI 主题）/ `npm install animal-island-ui lucide-react@latest --save`（Animal Island 主题）。tailwind.config.js 注册 daisyui plugin。禁止安装 animate.css。
19. **Huashu 方向提案** (`step 3.677`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/html-direction-advisor.js').then(m => m.proposeThreeDirections({...}))"` 生成 3 种视觉方向 + 评分矩阵，在设计生成前确立品味方向
20. **Huashu 风格库** (`step 3.678`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/style-library.js').then(m => m.listStyles())"` 浏览 40 种风格 → AskUserQuestion 选择风格方向
21. **设计模板** (`step 3.679`) — 🆕 Bash `ls open-design/design-templates/` 列出 111 模板 → AskUserQuestion 选择 → Read 选中模板的 HTML/CSS，提取布局结构和组件模式
22. **Skills 注入** (`step 3.68`) — 🆕 Bash `ls open-design/skills/` 列出 138 技能 → AskUserQuestion 选择 → Read 选中技能的 markdown，将其设计约束注入到后续打磨步骤
23. **Huashu 品牌协议** (`step 3.681`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/brand-protocol.js').then(m => m.runProtocol({...}))"` 品牌提及检测 → 5 步资产清单 → brand-spec.md
24. **Device Frames 预览** (`step 3.682`) — 🆕 Bash `ls open-design/assets/frames/` 列出 5 设备框 → 验证多设备设计适配
25. **提示词模板** (`step 3.683`) — 🆕 Bash `ls open-design/prompt-templates/image/` + `ls open-design/prompt-templates/video/` 列出 103 提示词模板（46 图片 + 57 视频）→ 按需用于项目 AI 素材生成
26. **演示框架** (`step 3.684`) — 🆕 Bash `ls open-design/templates/` 列出 3 演示框架（deck-framework.html / kami-deck.html / live-artifacts）→ 选择演示框架用于项目设计演示
27. **吉祥物选择** (`step 3.685`) — 🆕 Bash `ls open-design/assets/community-pets/` 列出 8 吉祥物（clippit/dario/dentist/nyako-shigure/slavik/tux/yelling-dario/yorha-sit-2b）→ AskUserQuestion 选择吉祥物用于加载态/空状态/引导页
28. **框架导出** (`step 3.686`) — 🆕 Read `open-design/plugins/_official/scenarios/od-react-export/SKILL.md`（React）/ `od-nextjs-export/SKILL.md`（Next.js）/ `od-vue-export/SKILL.md` 导出设计到目标框架代码
29. **generateDesign** (`step 3.7`) — Open Design AI 生成设计（条件触发，Skill 工具）
30. **Huashu Motion Engine** (`step 3.71`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/motion-engine.js').then(m => m.generateReleaseAnimation({ targetPath: '...', projectRoot: process.cwd(), title: 'Release', version: 'v1.0.0' }))"` 生成 MP4/GIF 发布动画，写入 `.claude/animations/`
31. **Huashu 原型构建** (`step 3.72`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/prototype-builder.js').then(m => m.buildPrototype({...}))"` 生成 HTML/CSS 原型 + Playwright 验证截图
32. **implementLogic** (`step 3.8`) — 实现核心业务逻辑（文件操作工具）

### Phase 3.5: Impeccable 设计打磨（对话模式，前端+Open Design 时触发）⚠️ 必须执行

**CRITICAL**: 当前端项目使用了 Open Design 生成 UI 后，必须逐一调用以下 Skill 子命令进行设计打磨。每个子命令都需要实际修改代码文件。

21. **Huashu 5 维度评审（第一轮）** (`step 3.778`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/expert-review.js').then(m => m.review({ targetPath: '...' }))"` 打磨前设计基线测量：philosophy/hierarchy/craft/functionality/originality 评分，为后续打磨效果对比建立基准
22. **Impeccable critique（第一轮）** (`step 3.779`) — 🆕 Skill 深度设计批判：27 条反 AI 模式规则 + 12 条 LLM 批判规则，在修复前检测 AI 塑料感，建立问题清单供后续打磨步骤针对性修复（on_error: abort）
23. **Impeccable polish** (`step 3.78`) — 🆕 全维度质量打磨（配色/间距/字体/圆角/阴影）
24. **Impeccable layout** (`step 3.781`) — 🆕 间距节奏 + 视觉层级 + 空间重构
25. **Impeccable colorize** (`step 3.782`) — 🆕 策略性色彩注入
26. **Impeccable bolder** (`step 3.783`) — 🆕 安全→大胆，打破 AI 默认审美
27. **Impeccable typeset** (`step 3.784`) — 🆕 排版层次优化
28. **Impeccable animate** (`step 3.785`) — 🆕 purposeful motion
29. **Impeccable delight** (`step 3.786`) — 🆕 个性化记忆点
30. **Impeccable harden** (`step 3.788`) — 🆕 生产就绪：加载/空/错误/边缘状态 + i18n + 表单验证 + 键盘可操作性
31. **Impeccable distill** (`step 3.789`) — 🆕 精简提纯：去除冗余元素/装饰/过度层次
32. **Impeccable clarify** (`step 3.79`) — 🆕 UX 文案优化：标签/按钮/错误提示/空状态，消除 AI 默认措辞
33. **Impeccable adapt** (`step 3.791`) — 🆕 响应式设计验证：断点审查 + 触摸目标 + 视口溢出修复
34. **Impeccable optimize** (`step 3.7911`) — 🆕 CSS/渲染性能：CLS 布局偏移/未使用 CSS/合成层/Font Load 策略
35. **Impeccable quieter** (`step 3.79115`) — 🆕 降低视觉强度：过度加粗→适度、过大阴影→适度、装饰性模糊光晕→移除。消除 AI 默认"用力过猛"感
36. **Impeccable onboard** (`step 3.79116`) — 🆕 首次使用体验设计：空状态引导/激活流程/首次交互提示
37. **Impeccable critique（第二轮）** (`step 3.7912`) — 🆕 Skill 深度设计批判验证：复检所有修复步骤的实际效果，确认品味提升可感知，发现残留问题（on_error: abort）
38. **Impeccable polish（第三轮）** (`step 3.7913`) — 🆕 针对 critique 第二轮发现的残留 AI 塑料感，精准修复：微交互/阴影层级/字体配对/留白节奏
39. **Impeccable bolder（第三轮）** (`step 3.7914`) — 🆕 针对 critique 第二轮发现的安全默认审美，放大设计决策影响力
40. **Impeccable delight（第三轮）** (`step 3.7915`) — 🆕 针对 critique 第二轮发现的记忆点缺失，注入个性化微交互/细节/惊喜
41. **Huashu 5 维度评审（第二轮）** (`step 3.7916`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/expert-review.js').then(m => m.review({ targetPath: '...' }))"` 修复后专家评审验证：philosophy/hierarchy/craft/functionality/originality 复评，与第一轮对比确认设计质量提升可量化
42. **AI-Friendly Web Design** (`step 3.792`) — 🆕 可访问性审查：语义HTML/ARIA/对比度/键盘导航
43. **Huashu 信息图** (`step 3.793`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/infographic.js').then(m => m.renderInfographic({...}))"` 渲染设计系统可视化信息图（HTML），作为项目设计交付物
44. **Huashu 演示稿导出** (`step 3.794`) — 🆕 Bash 调用 `node -e "import('./src/lib/huashu/deck-exporter.js').then(m => m.generateReleaseDeck({ targetPath: '...', projectRoot: process.cwd(), title: 'Design Deck', version: 'v1.0.0', highlights: [] }))"` 导出 HTML 演示稿 + 可选 PPTX，写入 `.claude/decks/`

### Phase 4: 实现 + 审查 + 验证

41. **checkAPIConsistency** (`step 4`) — API 契约一致性检查
42. **runReview** (`step 4.5`) — ESLint + TypeScript 静态分析
43. **aislop-scan** (`step 4.6`) — AI 代码气味扫描（50+ 规则）
44. **Skill("sec-bug-hunt")** (`step 4.7`) — 安全漏洞扫描，建立安全基线（对话模式）
45. **runSuite** (`step 4.8`) — 完整测试套件

### Phase 5: 沉淀

46. **ce-compound** (`step 5.5`) — CE 知识沉淀到 CLAUDE.md
47. **remember** (`step 6`) — 保存项目架构决策、技术选型、执行清单到记忆系统
48. **consolidate** (`step 6.5`) — 整理跨后端记忆一致性
49. **notify** (`step 7`) — 通知项目创建完成

### 关键改进

| 改进项 | 原来 | 现在 |
|--------|------|------|
| Pre-flight 设计 | 无设计基准声明 | Skill("web-design-engineer") + review-checklist + Impeccable audit |
| Pre-flight 约束 | 无设计约束 | craft 规则 11 文件（a11y/动画/色彩/排版/状态/RTL/表单/UX 定律/编辑排版层级） |
| 设计约束 | 无 | Open Design 全资源：152品牌+111模板+138技能+11场景插件+13原子插件+140示例 |
| CSS 框架 | 无安装步骤 | DaisyUI/Animal Island UI + lucide-react 自动安装 |
| 动画 | 无动画策略 | Huashu motion-engine（MP4/GIF 发布动画）+ 自定义 keyframes + `prefers-reduced-motion` + **禁止 animate.css** |
| 品牌 | 无 awesome-design-md | Open Design 152 品牌 token 自动导入 + components.html 组件映射 + `npx @google/design.md export` Tailwind 配置导出 |
| 方向 | 无 | Huashu direction-advisor 三方向提案 + 风格库 40 风格 |
| 品牌检测 | 无 | Huashu brand-protocol（品牌提及检测 → 5 步资产清单 → brand-spec.md） |
| 原型 | 无 | Huashu prototype-builder + Playwright 验证 |
| 打磨 | Impeccable 12 步 | Impeccable 18 步全链（新增 quieter/onboard） |
| 设备适配 | 无 | Open Design 5 设备框验证 |
| 吉祥物 | 无 | Open Design 8 社区吉祥物（加载态/空状态/引导页）|
| 提示词 | 无 | Open Design 103 提示词模板（46 图片 + 57 视频）|
| 演示框架 | 无 | Open Design 3 演示框架 |
| 演示稿 | 无 | Huashu deck-exporter（HTML + PDF + 前后对比）|
| 可视化 | 无 | Huashu 信息图渲染 |
| 代码质量 | 无 aislop 扫描 | aislop-scan 50+ 规则 |
| 安全基线 | 无 | Skill("sec-bug-hunt") 初始安全扫描 |

### 执行模式

此工作流**完全在对话内执行**，不再通过 CLI 子进程。Phase 0/3.5/4 的 Skill 步骤需要 Claude Code 对话模式的深度推理能力，Phase 1 的 MCP 工具调用天然是对话内操作，Phase 2/3/5 的步骤由 Claude 直接操作文件和调用工具完成。

CLI 子进程（`node src/index.js start new-project --auto`）仅用于 CI/CD 等非对话场景的纯机械步骤，会跳过所有 Skill 和 MCP 步骤。
