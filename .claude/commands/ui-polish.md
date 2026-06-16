---
description: Polish frontend projects with DaisyUI/Animal Island UI themes, animate.css animations, lucide-react icon upgrade, micro-interactions, and Impeccable/web-design-engineer/Huashu design intelligence. 59-step hybrid workflow with dual-critique quality control + residual repair.
argument-hint: "[target-path]"
---

# UI Polish Command

启动前端美化场景。自动美化前端项目，集成 DaisyUI / Animal Island UI 主题、动画、图标升级、微交互和设计打磨。

**59 步混合工作流**：Pre-flight Skill 设计智能（对话模式）→ CLI 机械步骤（npm install / 文件修改）→ Post-flight Skill 深度打磨（对话模式，⚠️ 必须执行 Huashu 基线 → critique 检测 → polish + layout + colorize + bolder + typeset + animate + delight + harden + distill + clarify + adapt + optimize → critique 验证 → 3 项精准残留修复 → Huashu 验证，双轮品控+残留修复）

用法：`/ui-polish [目标路径]`

## 执行流程

### Phase 0: Pre-flight 设计智能（对话模式，Skill() 调用）

设计系统声明和现状审计在修改代码前完成，这些步骤需要 Skill 深度推理，仅在对话模式执行：

1. **web-design-engineer Skill** (`step 0`) — 声明设计系统基线：检测已有 Token（Palette/Typography/Spacing/Motion/Radius/Shadows），写入 `.claude/designs/design-baseline.md`。Custom 模式用基线确定图标尺寸映射和动画 duration 范围。
2. **review-checklist Skill** (`step 0.05`) — 加载 23 项审查清单（正确性/类型安全/安全/性能/测试/可维护性），建立结构化审查基准。
3. **Impeccable audit** (`step 3.5`) — 技术质量基线扫描（a11y/perf/responsive），为后续对比建立基准。

### Phase 1: CLI 机械步骤

基线声明完成后，CLI 执行具体美化（通过 `node src/index.js start ui-polish --auto --theme <主题> --target <路径>`）：

- 安装依赖（daisyui / animate.css / lucide-react）
- 一致性检查（CSS 变量使用率、组件覆盖度）
- **主题选择**（交互式：DaisyUI 35+/Animal Island/Custom/Huashu 40 风格库/Awesome Design MD 品牌）
- 设计 Token 调和（提取已有值 → apply 时已有优先，新值填补空缺）
- 主题应用（daisyui npm + tailwind.config.js 配置，animal-island 注入 CSS 变量）
- 图标升级（Material Symbols → lucide-react，所有主题）
- 动画注入（animate.css 入口动画类）
- 微交互（hover:-translate-y-0.5 / active:scale-[0.98] / transition-all）
- Impeccable 设计打磨 CLI（12 条反AI模式规则扫描+自动修复）
- 测试 + 视觉回归
- AI 代码气味扫描（aislop: 50+ 规则检测叙事注释/吞异常/as any 滥用）
- 记忆沉淀

### Phase 2: Post-flight 设计打磨（对话模式，Skill() 调用）⚠️ 必须执行

**CRITICAL**: Phase 2 是惊艳感的核心来源。CLI 机械步骤完成后，必须逐一调用以下 Skill 子命令，不可跳过。每个子命令都需要实际修改代码文件，不是只给建议。

3. **Huashu 5 维度评审（第一轮）** (`step 7.2`) — 🆕 打磨前设计基线测量：philosophy/hierarchy/craft/functionality/originality 评分，为后续打磨效果对比建立基准
4. **Impeccable critique（第一轮）** (`step 7.25`) — 🆕 Skill 深度设计批判：在修复前检测 AI 塑料感（27 条反模式 + 12 条 LLM 规则），建立问题清单供后续打磨步骤针对性修复（on_error: abort）
5. **Impeccable polish** (`step 9.3`) — 组件升级后全维度质量调优（配色/间距/字体/圆角/阴影），在完整组件状态下统一调优，为后续维度打磨建立基础
6. **Impeccable layout** (`step 9.55`) — 🆕 间距节奏 + 视觉层级 + 空间重构：消除均匀间距、建立呼吸节奏、打破模板感
7. **Impeccable colorize** (`step 9.56`) — 🆕 策略性色彩注入：检测单色调界面 → 注入品牌配色策略（Restrained/Committed/Full Palette/Drenched）
8. **Impeccable bolder** (`step 9.57`) — 🆕 安全→大胆：放大设计决策的影响力，打破「安全但无聊」的 AI 默认审美
9. **Impeccable typeset** (`step 9.58`) — 排版层次优化：font-family ≤3、字号阶梯 ≥1.25、正文行长 65-75ch、标题 text-wrap: balance
10. **Impeccable animate** (`step 9.59`) — 用 purposeful motion 替代浅层 animate.css，遵循 reduced-motion，使用 exponential easing
11. **Impeccable delight** (`step 9.591`) — 🆕 个性化记忆点：微交互/细节/惊喜，让页面有「人设计的」感觉
12. **Impeccable harden** (`step 9.592`) — 🆕 生产就绪：加载/空/错误/边缘状态 + i18n + 表单验证 + 键盘可操作性
13. **Impeccable distill** (`step 9.593`) — 🆕 精简提纯：去除美化过程中可能引入的冗余元素/装饰/过度层次
14. **Impeccable clarify** (`step 9.594`) — 🆕 UX 文案优化：标签/按钮/错误提示/空状态，消除 AI 默认措辞，注入产品语调
15. **Impeccable adapt** (`step 9.595`) — 🆕 响应式设计验证：移动端/平板/桌面断点审查 + 触摸目标 24px+ + 视口溢出修复
16. **Impeccable optimize** (`step 9.596`) — 🆕 CSS/渲染性能诊断：CLS 布局偏移/未使用 CSS/合成层/Font Load 策略
17. **Impeccable critique CLI** (`step 9.6`) — CLI 端 12 条规则自动扫描+修复（作为 Skill 批判的补充）
18. **Impeccable critique（第二轮）** (`step 9.61`) — 🆕 Skill 深度设计批判验证：复检所有修复步骤的实际效果，确认品味提升可感知，发现残留问题
19. **Impeccable polish（第三轮）** (`step 9.62`) — 🆕 针对 critique 第二轮发现的残留 AI 塑料感，精准修复：微交互/阴影层级/字体配对/留白节奏
20. **Impeccable bolder（第三轮）** (`step 9.63`) — 🆕 针对 critique 第二轮发现的安全默认审美，放大设计决策影响力
21. **Impeccable delight（第三轮）** (`step 9.64`) — 🆕 针对 critique 第二轮发现的记忆点缺失，注入个性化微交互/细节/惊喜
22. **Huashu 5 维度评审（第二轮）** (`step 9.7`) — philosophy/hierarchy/craft/functionality/originality 复评，与第一轮对比验证设计质量提升可量化
23. **AI-Friendly 可访问性审查** (`step 9.8`)
24. **AI 代码气味扫描** (`step 9.9`) — aislop: 50+ 规则检测叙事注释/吞异常/as any 滥用

### 主题选择

**选项：**
1. DaisyUI — 35+ professional themes (applied to tailwind.config.js)
2. Animal Island UI — Natural, playful, rounded design (replaces HTML elements with AIUI components)
3. Custom — Keep existing style, apply animations + icons + micro-interactions + impeccable colorize
4. Huashu 40 风格库 — HTML-native 20 web styles (editorial-brutalism, neo-brutalism, apple-product, dark-tech-grid, ...)
5. Awesome Design MD — 品牌设计系统 (Vercel/Linear/Stripe/Notion/Apple)

### Huashu 主题

选择 Huashu 主题时，`handleApplyHuashuStyle` 会：
- 从 40 风格库中选择风格（所有风格均有 CSS token 映射）
- 生成 `src/styles/huashu-<style-id>.css`（包含完整的 CSS 自定义属性）
- 注入 `@import` 到 `src/index.css`
- 注入颜色 token 到 `tailwind.config.js` 的 extend 块

### CLI 模式回退

在 CLI 模式（非对话）下，Skill 步骤因为 `conversation_mode` 条件不满足而自动跳过，仅执行机械步骤。这是设计如此。
