---
description: AI-assisted UI design workflow: Pre-flight design baseline → review-checklist → Impeccable audit → craft rules → shape design brief (taste direction) → 3-direction proposal → Open Design 152 brands/111 templates/138 skills + Huashu 8 modules + 5 device frames + 103 prompt templates + 3 deck frameworks + 8 community pets → expert review → Impeccable full 21-step polish chain（critique detect → 16 fixes(含quieter+onboard) → critique verify → 3 targeted fixes, dual-pass QC + residual repair）+ AI-Friendly a11y + Google DESIGN.md lint。55+ 步全对话模式工作流。
argument-hint: "[描述] [--category web|mobile]"
---

# /design — AI 辅助 UI 设计

55 步全对话模式工作流：**Pre-flight Skill 设计基准（对话模式）→ shape 设计简报确立品味方向 → 三方向提案 → 原型构建 → 专家评审 → Impeccable 全维度打磨（对话模式，⚠️ 必须执行 critique 检测 → 12 项全维度修复 → critique 验证 → 3 项精准残留修复，双轮品控+残留修复）**

## Usage

```text
/design                           # 交互式设计流程
/design 设计一个登录页面            # 带需求描述
/design --category mobile          # 移动端设计
```

## 执行流程

### Phase 0: Pre-flight 设计准备（对话模式，Skill() 调用）

在设计生成前建立设计基准：

1. **web-design-engineer Skill** (`step 0.3`) — 声明设计系统基准（Palette/Typography/Spacing/Motion/Radius/Shadows），设计方法论指导（反 cliché / OKLCH / v0 draft）
2. **Memory recall** (`step 0.5`) — 注入历史设计上下文和品牌偏好
3. **Impeccable shape** (`step 0.6`) — 🆕 设计发现访谈 → 10 节设计简报（mood/references/color strategy/design direction/bold move），在生成前确立品味方向约束
4. **Open Design 品牌选择** (`step 0.65`) — 🆕 Bash `ls open-design/design-systems/` 列出 152 品牌 → AskUserQuestion 选择品牌方向（可选，与三方向提案互补）
5. **review-checklist Skill** (`step 0.7`) — 加载审查清单，建立结构化设计审查基准
6. **Impeccable audit** (`step 0.8`) — 技术质量基线扫描（a11y/perf/responsive），为设计生成后对比建立基准
7. **Open Design 资源清单** (`step 0.85`) — Bash `ls open-design/design-systems/` + `ls open-design/design-templates/` + `ls open-design/skills/` + `ls open-design/prompt-templates/image/` + `ls open-design/prompt-templates/video/` + `ls open-design/templates/` + `ls open-design/assets/community-pets/` 列出 152 品牌 + 111 设计模板 + 138 技能 + 103 提示词模板（46 图片 + 57 视频）+ 3 演示框架 + 8 吉祥物
8. **craft 规则加载** (`step 0.9`) — Read `open-design/craft/` 全部 11 个规则文件（accessibility-baseline / animation-discipline / anti-ai-slop / color / form-validation / laws-of-ux / rtl-and-bidi / state-coverage / typography / typography-hierarchy / typography-hierarchy-editorial），建立完整设计约束基准。后续所有设计步骤必须遵守这些规则。
9. **Open Design 插件系统** (`step 0.95`) — 🆕 Bash `ls open-design/plugins/_official/scenarios/` 列出 11 个场景插件（`od-react-export` / `od-nextjs-export` / `od-vue-export` 框架导出；`od-design-refine` 设计迭代；`od-new-generation` 设计生成；`od-code-migration` / `od-figma-migration` / `od-media-generation` / `od-plugin-authoring` / `od-tune-collab`）。`ls open-design/plugins/_official/atoms/` 列出 13 个原子插件（`critique-theater` / `direction-picker` / `design-extract` / `token-map` 等设计工具）。`ls open-design/plugins/_official/examples/` 列出 140 个示例插件模板。

### Phase 1: 设计生成（对话内执行）

Claude 直接调用工具完成设计步骤（不通过 CLI 子进程）：

- **三方向提案** (`step 1`)：Bash 调用 `node -e "import('./src/lib/huashu/html-direction-advisor.js').then(m => m.proposeThreeDirections({...}))"` 生成 3 种视觉方向 + 评分矩阵
- **品牌列表** (`step 1.57`)：Bash `ls open-design/design-systems/` 列出全部 152 品牌设计系统（每个含 DESIGN.md + tokens.css + components.html）
- **品牌导入** (`step 1.58`)：Read `open-design/design-systems/<brand>/DESIGN.md` 获取品牌规范 → Read `tokens.css` 获取 CSS 变量 → Read `components.html`（如需组件参考）→ Edit 将 `:root {}` 变量块注入项目 `index.css` 或 `tokens.css`
- **品牌协议** (`step 1.59`)：Bash 调用 `node -e "import('./src/lib/huashu/brand-protocol.js').then(m => m.runProtocol({...}))"` 品牌提及检测 → 5 步资产清单 → brand-spec.md
- **设计模板** (`step 1.61`)：Bash `ls open-design/design-templates/` 列出 111 模板 → AskUserQuestion 选择 → Read 选中模板的 HTML/CSS，提取布局结构和组件模式
- **Skills 注入** (`step 1.62`)：Bash `ls open-design/skills/` 列出 138 技能 → AskUserQuestion 选择 → Read 选中技能的 markdown，将其设计约束注入到后续打磨步骤
- **Huashu 风格库** (`step 1.63`)：Bash 调用 `node -e "import('./src/lib/huashu/style-library.js').then(m => m.listStyles())"` 浏览 40 种风格 → AskUserQuestion 选择风格方向（与三方向提案互补）
- **Device Frames 预览** (`step 1.64`)：Bash `ls open-design/assets/frames/` 列出 5 设备框 → 对关键页面用设备框包裹验证多设备视觉效果
- **提示词模板** (`step 1.65`)：Bash `ls open-design/prompt-templates/image/` + `ls open-design/prompt-templates/video/` 列出 103 提示词模板（46 图片 + 57 视频）→ 按需选用 AI 图片/视频素材生成模板
- **演示框架** (`step 1.66`)：Bash `ls open-design/templates/` 列出 3 演示框架（deck-framework.html / kami-deck.html / live-artifacts）→ 选择演示框架用于最终设计演示稿
- **吉祥物选择** (`step 1.67`)：Bash `ls open-design/assets/community-pets/` 列出 8 吉祥物（clippit/dario/dentist/nyako-shigure/slavik/tux/yelling-dario/yorha-sit-2b）→ AskUserQuestion 选择吉祥物用于加载态/空状态/引导页
- **框架导出** (`step 1.68`) — 🆕 设计完成后：Read `open-design/plugins/_official/scenarios/od-react-export/SKILL.md`（React）/ `od-nextjs-export/SKILL.md`（Next.js）/ `od-vue-export/SKILL.md`（Vue）导出设计到目标框架代码

### Phase 2: 原型构建 + 资源导出（对话内执行）

- **原型构建** (`step 2`)：Bash 调用 `node -e "import('./src/lib/huashu/prototype-builder.js').then(m => m.buildPrototype({...}))"` 生成 HTML/CSS 原型 + Playwright 验证截图
- **一致性检查** (`step 2.5`)：Read + Grep 扫描 CSS 变量使用率 vs 硬编码值，组件覆盖度
- **资源导出** (`step 2.7`)：Write tokens.css + design-spec.md → src/assets/design-system/
- **Huashu Motion Engine** (`step 2.8`)：Bash 调用 `node -e "import('./src/lib/huashu/motion-engine.js').then(m => m.generateReleaseAnimation({ targetPath: '...', projectRoot: process.cwd(), title: 'Release', version: 'v1.0.0' }))"` 生成 MP4/GIF 发布动画（通过 `assets/huashu/render-video.js` 渲染），含标题+版本叠加，写入 `.claude/animations/`

### Phase 3: 多维度审查（对话模式）

4. **Huashu 专家评审** (`step 3`)：Bash 调用 `node -e "import('./src/lib/huashu/expert-review.js').then(m => m.review({ targetPath: '...' }))"` — 5 维度评分：philosophy/hierarchy/craft/functionality/originality
5. **Impeccable 批判（第一轮）** (`step 3.5`, `Skill("impeccable", "critique")`)：27 条反 AI 模式规则 + 12 条 LLM 批判规则，在打磨前检测 AI 塑料感，建立问题清单（on_error: abort）

### Phase 4: 设计打磨（对话模式）⚠️ 必须执行

**CRITICAL**: Phase 4 是设计质量的核心来源。必须逐一调用以下 Skill 子命令，每个都需要实际修改代码/设计文件。

6. **Impeccable polish** (`step 4`) — 自动修复 AI 塑料感 — 微交互/阴影层级/字体配对/留白节奏
7. **Impeccable layout** (`step 4.05`) — 🆕 间距节奏 + 视觉层级 + 空间重构 — 消除均匀间距、建立呼吸节奏
8. **Impeccable colorize** (`step 4.06`) — 🆕 策略性色彩注入 — Restrained/Committed/Full Palette/Drenched
9. **Impeccable bolder** (`step 4.07`) — 🆕 安全→大胆 — 放大设计决策影响力，打破 AI 安全默认审美
10. **Impeccable typeset** (`step 4.08`) — 🆕 排版层次优化 — font-family ≤3、字号阶梯 ≥1.25、行长 65-75ch
11. **Impeccable animate** (`step 4.09`) — 🆕 purposeful motion + reduced-motion + exponential easing
12. **Impeccable delight** (`step 4.095`) — 🆕 个性化记忆点 — 微交互/细节/惊喜，让设计有灵魂
13. **Impeccable harden** (`step 4.096`) — 🆕 生产就绪：加载/空/错误/边缘状态 + i18n + 表单验证 + 键盘可操作性
14. **Impeccable distill** (`step 4.097`) — 🆕 精简提纯：去除冗余元素/装饰/过度层次，保留核心信息层级
15. **Impeccable clarify** (`step 4.098`) — 🆕 UX 文案优化：标签/按钮/错误提示/空状态，消除 AI 默认措辞
16. **Impeccable adapt** (`step 4.099`) — 🆕 响应式设计验证：断点审查 + 触摸目标 + 视口溢出修复
17. **Impeccable optimize** (`step 4.0991`) — 🆕 CSS/渲染性能：CLS 布局偏移/未使用 CSS/合成层/Font Load 策略
18. **Impeccable quieter** (`step 4.09915`) — 🆕 降低视觉强度：过度加粗→适度、过大阴影→适度、装饰性模糊光晕→移除。消除 AI 默认"用力过猛"感
19. **Impeccable onboard** (`step 4.09916`) — 🆕 首次使用体验设计：空状态引导/激活流程/首次交互提示
20. **Impeccable critique（第二轮）** (`step 4.0992`) — 🆕 验证打磨后的设计改进效果：复检 27 条反 AI 模式 + 12 条 LLM 规则，确保品味提升可感知
21. **Impeccable polish（第三轮）** (`step 4.0993`) — 🆕 针对 critique 第二轮发现的残留 AI 塑料感，精准修复：微交互/阴影层级/字体配对/留白节奏
22. **Impeccable bolder（第三轮）** (`step 4.0994`) — 🆕 针对 critique 第二轮发现的安全默认审美，放大设计决策影响力
23. **Impeccable delight（第三轮）** (`step 4.0995`) — 🆕 针对 critique 第二轮发现的记忆点缺失，注入个性化微交互/细节/惊喜
24. **Huashu 5 维度评审（第二轮）** (`step 4.0996`) — 🆕 三轮修复后最终验证：philosophy/hierarchy/craft/functionality/originality 复评，确认设计质量提升可量化
25. **AI-Friendly Web Design** (`step 4.0997`) — 🆕 可访问性审查：色彩对比度/焦点顺序/语义HTML/ARIA标签/键盘导航，打磨完成后验证合规

### Phase 5: 交付物 + 沉淀

- **持久化** (`step 5`, `persist`)：保存设计选择到 .claude/designs/current.json
- **DESIGN.md 校验** (`step 5.1`)：`npx @google/design.md lint` 校验生成的 DESIGN.md 格式正确性 + WCAG 对比度，失败则输出报告到 `.claude/designs/lint-report.md` 供审查
- **信息图** (`step 5.5`)：Bash 调用 `node -e "import('./src/lib/huashu/infographic.js').then(m => m.renderInfographic({...}))"` 渲染设计系统可视化信息图（HTML）
- **演示稿导出** (`step 5.6`)：Bash 调用 `node -e "import('./src/lib/huashu/deck-exporter.js').then(m => m.generateReleaseDeck({ targetPath: '...', projectRoot: process.cwd(), title: 'Design Deck', version: 'v1.0.0', highlights: [] }))"` 导出 HTML 演示稿（封面+亮点+结尾） + 可选 PPTX（需 pptxgenjs），写入 `.claude/decks/`
- **CE 沉淀** (`step 6`, `ce-compound`)：设计知识沉淀到 CLAUDE.md
- **记忆保存** (`step 7-7.5`)：保存设计偏好 + 整理跨后端一致性
- **通知** (`step 8`)：设计结果通知

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 设计基准 | web-design-engineer Skill（设计方法论 + 反 cliché 规则） | Skill |
| 审查基线 | review-checklist Skill（23 项分析框架） | Skill |
| 基线扫描 | Impeccable audit（a11y/perf/responsive 技术基线） | Skill |
| 设计约束 | craft 规则 11 文件（a11y/动画/色彩/排版/状态/RTL/表单/UX 定律/编辑排版层级） | 文件读取 |
| 方向提案 | huashu direction-advisor（3 方向 + 评分矩阵） | CLI |
| 品牌 | Open Design 152 品牌库（直接读取 `open-design/design-systems/`）| 文件读取 |
| 模板 | Open Design 111 设计模板（`open-design/design-templates/`）| 文件读取 |
| 技能 | Open Design 138 Skills（`open-design/skills/`）| 文件读取 |
| 风格 | Huashu 40 风格库（style-library.js） | CLI |
| 原型 | huashu prototype-builder + Playwright 验证 | CLI |
| 动效 | Huashu motion-engine（MP4/GIF 发布动画生成，写入 `.claude/animations/`） | CLI |
| 品牌检测 | huashu brand-protocol（品牌提及检测 → 5 步资产清单 → brand-spec.md） | CLI |
| 一致性 | CSS 变量 vs 硬编码 + 组件覆盖度 | CLI |
| 资源 | tokens.css + design-spec.md 导出 | CLI |
| 设备适配 | Open Design 5 设备框（`open-design/assets/frames/`）| 文件读取 |
| 吉祥物 | Open Design 8 社区吉祥物（`open-design/assets/community-pets/`）| 文件读取 |
| 提示词 | Open Design 103 提示词模板（46 图片 + 57 视频）| 文件读取 |
| 演示框架 | Open Design 3 演示框架（deck-framework/kami-deck/live-artifacts）| 文件读取 |
| 框架导出 | Open Design 场景插件（od-react-export / od-nextjs-export / od-vue-export）| 文件读取 |
| 演示稿 | Huashu deck-exporter（HTML + PDF + token 参考卡片 + 前后对比）| CLI |
| 评审 | Huashu 5 维度 + AI-friendly + Impeccable 批判 | Skill |
| 打磨 | Impeccable 21 步全链（polish→layout→colorize→bolder→typeset→animate→delight→harden→distill→clarify→adapt→optimize→quieter→onboard→critique→3精准修复→Huashu→a11y） | Skill |
| 可视化 | Huashu 信息图渲染 | CLI |
| 校验 | Google DESIGN.md CLI（`npx @google/design.md lint` — 格式校验 + WCAG 对比度） | npx |

### 执行模式

此工作流**完全在对话内执行**，不再通过 CLI 子进程。Phase 0/3/4 的 Skill 步骤需要 Claude Code 对话模式的深度推理能力，Phase 1/2/5 的步骤由 Claude 直接操作文件和调用工具完成。

CLI 子进程（`node src/index.js start design --auto`）仅用于 CI/CD 等非对话场景的纯机械步骤，会跳过所有 Skill 步骤。
