---
description: Polish frontend projects with DaisyUI/Animal Island UI themes, custom keyframe animations, lucide-react icon upgrade, micro-interactions, and Impeccable/web-design-engineer/Huashu design intelligence. 59-step hybrid workflow with dual-critique quality control + residual repair. Open Design 全资源集成：152品牌+111模板+138技能+11craft规则+8Huashu模块+5设备框+103提示词模板+3演示框架+8吉祥物.
argument-hint: "[target-path]"
---

# UI Polish Command

启动前端美化场景。自动美化前端项目，集成 DaisyUI / Animal Island UI 主题、动画、图标升级、微交互和设计打磨。

用法：`/ui-polish [目标路径]`

## 前置检测（必须执行）

执行任何美化步骤之前，必须先完成项目结构检测：

```
1. 确认目标路径存在，读取 package.json
2. 检测是否为多子项目（monorepo / 多前端目录）
3. 检测每个子项目的框架（React/Vue/HTML）、CSS 方案（Tailwind/CSS Modules/纯CSS）、UI 库（Antd/无）
4. 列出每个子项目的入口 CSS 文件、tailwind.config.*、组件目录
```

**多子项目规则**：如果检测到多个前端子目录（如 `frontend/student/`, `frontend/school/` 等），每个子项目必须独立执行 Phase 1 全部步骤。Phase 2 的 Impeccable 打磨链对每个子项目独立执行。

---

## Phase 0: Pre-flight 设计智能

设计系统声明和现状审计在修改代码前完成：

1. **web-design-engineer Skill** — 声明设计系统基线：检测已有 Token（Palette/Typography/Spacing/Motion/Radius/Shadows），写入 `.claude/designs/design-baseline.md`
2. **review-checklist Skill** — 加载审查清单，建立结构化审查基准
3. **Impeccable audit** — 技术质量基线扫描（a11y/perf/responsive），为后续对比建立基准
4. **Open Design 资源清单** — Bash `ls open-design/design-systems/` + `ls open-design/design-templates/` + `ls open-design/skills/` + `ls open-design/prompt-templates/image/` + `ls open-design/prompt-templates/video/` + `ls open-design/templates/` + `ls open-design/assets/community-pets/` 列出 152 品牌 + 111 设计模板 + 138 技能 + 103 提示词模板（46 图片 + 57 视频）+ 3 演示框架 + 8 吉祥物
5. **craft 规则加载** — Read `open-design/craft/` 全部 11 个规则文件（accessibility-baseline / animation-discipline / anti-ai-slop / color / form-validation / laws-of-ux / rtl-and-bidi / state-coverage / typography / typography-hierarchy / typography-hierarchy-editorial），建立完整设计约束基准。后续所有步骤必须遵守这些规则。
6. **Open Design 插件系统** — 🆕 Bash `ls open-design/plugins/_official/scenarios/` 列出 11 个场景插件（`od-react-export` / `od-nextjs-export` / `od-vue-export` 框架导出；`od-design-refine` 设计迭代；`od-new-generation` 设计生成）。`ls open-design/plugins/_official/atoms/` 列出 13 个原子插件（`critique-theater` / `direction-picker` / `design-extract` / `token-map` 等）。`ls open-design/plugins/_official/examples/` 列出 140 个示例模板。
7. **Huashu brand-protocol** — 检测用户需求中是否提及品牌名 → 5 步品牌资产清单（品牌色/字体/logo/语调/目标受众）→ 输出 brand-spec.md 到 `.claude/designs/`，后续所有步骤以 brand-spec 为权威约束：
   ```bash
   node -e "import('./src/lib/huashu/brand-protocol.js').then(m => m.runProtocol({ targetPath: '<目标路径>', requirement: '<用户原始需求>' }))"
   ```
7. **Huashu expert-review 基线** — 打磨前 5 维度设计基线测量（philosophy/hierarchy/craft/functionality/originality），为 Phase 2 对比建立评分基线：
   ```bash
   node -e "import('./src/lib/huashu/expert-review.js').then(m => m.review({ targetPath: '<目标路径>' }))"
   ```
8. **Huashu html-direction-advisor** — 3 方向提案（Conservative / Balanced / Bold），各含布局骨架 + 设计 token 声明 + 占位符，用户选定方向后进入 Phase 1：
   ```bash
   node -e "import('./src/lib/huashu/html-direction-advisor.js').then(m => m.proposeThreeDirections({ category: 'web', requirement: '<用户原始需求>' }))"
   ```

---

## Phase 1: 对话内机械步骤

### Step 1.0 — 主题选择

AskUserQuestion 交互式选择：
1. DaisyUI — 35+ professional themes
2. Animal Island UI — Natural, playful, rounded design
3. Custom — Keep existing style, apply animations + icons + micro-interactions
4. Huashu 40 风格库 — Bash 调用 `node -e "import('./src/lib/huashu/style-library.js').then(m => m.listStyles())"` 浏览 40 种风格
5. Open Design 品牌库 — 152 品牌设计系统（含 DESIGN.md + tokens.css + components.html）
6. Open Design 设计模板 — 111 模板（`ls open-design/design-templates/`）
7. Open Design Skills — 138 AI 技能（`ls open-design/skills/`），按需注入到打磨链
8. Open Design 提示词模板 — 103 提示词模板（46 图片生成 + 57 视频生成），用于 AI 图片/视频素材生成
9. Open Design 演示框架 — 3 演示文稿框架（deck-framework.html / kami-deck.html / live-artifacts），用于生成设计演示稿

选择 Open Design 品牌时：
- Bash `ls open-design/design-systems/` 展示可用品牌
- Read `open-design/design-systems/<brand>/DESIGN.md` 获取品牌规范
- Read `open-design/design-systems/<brand>/tokens.css` 获取 CSS 变量
- Read `open-design/design-systems/<brand>/components.html` 获取组件参考 → 将可复用组件模式（按钮/卡片/表单/导航样式）映射为 DaisyUI 类或 Tailwind 类
- `npx @google/design.md lint` 校验注入后的 DESIGN.md 格式 + WCAG 对比度，失败输出报告到 `.claude/designs/lint-report.md`

选择设计模板时：
- Bash `ls open-design/design-templates/` 列出 111 模板
- Read 选中模板的 HTML/CSS，提取布局结构和组件模式

选择 Skills 时：
- Bash `ls open-design/skills/` 列出 138 技能
- Read 选中技能的 markdown，将其设计约束注入到后续打磨步骤

选择提示词模板时：
- Bash `ls open-design/prompt-templates/image/` + `ls open-design/prompt-templates/video/` 列出 103 模板
- Read 选中的提示词模板，用于 AI 图片/视频素材生成（如 hero 背景图、OG 图片、产品演示视频）

选择演示框架时：
- Bash `ls open-design/templates/` 列出 3 演示框架
- Read `open-design/templates/<选中框架>` 获取 HTML 演示框架
- 将美化结果嵌入演示框架，生成可分享的设计演示稿

### Step 1.0a — Huashu prototype-builder（可选，选择品牌库或设计模板时建议执行）

将设计 token 和组件模式生成可交互的 HTML 原型：

```bash
node -e "import('./src/lib/huashu/prototype-builder.js').then(m => m.buildPrototype({ targetPath: '<目标路径>', requirement: '<需求描述>', styleId: 'minimal-mono', device: 'iphone' }))"
```

prototype-builder 输出：
- 单文件 HTML 原型（含设备框 + 嵌入式 CSS/JS，可点击交互）
- 设备框模式：iPhone / Android / Desktop / iPad
- 多屏切换导航（默认 Home / Detail / Profile）
- 可选 Playwright 自动验证截图

### Step 1.0b — Huashu infographic（可选，需要数据可视化时执行）

为数据密集型页面生成信息图表：

```bash
node -e "import('./src/lib/huashu/infographic.js').then(m => m.renderInfographic({ targetPath: '<目标路径>', title: '数据可视化', subtitle: '', metrics: [], sections: [] }))"
```

infographic 输出：
- 单文件 HTML 信息图卡片（editorial-brutalism 美学）
- 指标卡片网格（value + label + delta 趋势）
- 分区内容块（标题 + 正文 + 列表）
- 写入 `.claude/infographics/`

### Step 1.1 — 安装依赖

对每个子项目：
```bash
cd <子项目目录> && npm install daisyui@latest lucide-react@latest --save
```

验证：
```bash
grep -c "daisyui\|lucide-react" <子项目>/package.json
# 预期: daisyui, lucide-react 各至少出现 1 次
```

### Step 1.2 — 设计 Token 注入

**Open Design 品牌模式**（选品牌库时）：
1. 将 tokens.css 的 `:root {}` 变量块注入到每个子项目的入口 CSS 文件
2. 将品牌色彩 token 映射到 tailwind.config.js 的 `extend.colors` 块
3. 将品牌字体映射到 tailwind.config.js 的 `extend.fontFamily` 块

**DaisyUI 模式**：
1. 在入口 CSS 写入 `@plugin "daisyui/theme" { ... }` 和 `@plugin "daisyui" { themes: ... }`
2. tailwind.config.js 的 `plugins` 数组添加 `require("daisyui")`

验证：
```bash
# 检查 CSS 变量是否注入
grep -c "var(--" <入口CSS文件>
# 预期: > 5

# 检查 daisyui 插件是否配置
grep -c "daisyui" <入口CSS文件>
# 预期: >= 2 (theme + plugin)
```

### Step 1.3 — 图标升级（Material Symbols → lucide-react）

**此步骤不可跳过。强制执行。**

1. Grep 扫描所有组件中 Material Icons 使用：
```bash
grep -rn "material-icons\|Material Icons\|material-icons-round\|material-symbols" <组件目录> --include="*.tsx" --include="*.jsx" -l
```

2. 对每个命中文件：
   - 移除 `<link href="https://fonts.googleapis.com/icon?family=Material+Icons" ...>` (index.html)
   - 将 `<span className="material-icons">home</span>` 替换为 `<Home size={20} />`
   - 将 `<Icon name="xxx" />` 替换为对应的 lucide-react 组件
   - 在文件顶部添加 `import { Home, ... } from 'lucide-react'`

验证：
```bash
grep -rn "material-icons\|material-symbols\|Material Icons" <组件目录> --include="*.tsx" --include="*.jsx" -c
# 预期: 0（全部替换完成）
```

### Step 1.4 — DaisyUI 组件类应用（仅 DaisyUI 主题模式）

**此步骤不可跳过。强制执行。** 这是 polish 前后差异最大的步骤——不改 JSX 代码等于只换了颜色。

对每个子项目的所有组件文件，扫描并替换以下模式：

| 当前模式 | 替换为 | 说明 |
|---------|--------|------|
| `<button className="...">` | `<button className="btn ...">` | 必须包含 `btn` 类 |
| 主要操作按钮 | `btn btn-primary` | 品牌色按钮 |
| 次要操作按钮 | `btn btn-ghost` 或 `btn btn-outline` | 次级按钮 |
| 纯 `<div className="...">` 卡片容器 | `className="card bg-base-100 shadow-sm ..."` | daisyui card |
| 表单 `<input>` | `className="input input-bordered ..."` | daisyui input |
| `<select>` | `className="select select-bordered ..."` | daisyui select |
| `<textarea>` | `className="textarea textarea-bordered ..."` | daisyui textarea |
| 状态标签 `<span>` | `className="badge badge-primary ..."` | daisyui badge |
| 导航 Tab | `className="tabs tabs-boxed ..."` | daisyui tabs |

执行方式：
1. Grep 扫描每个组件文件，找到所有 `<button`, `<input`, `<select`, `<textarea` 标签
2. 对每个找到的标签，添加对应的 daisyui 类
3. 硬编码颜色（`#6366f1`, `#4f46e5`, `#8b5cf6` 等 indigo 系）替换为 `btn-primary` / `text-primary` 等语义类

验证：
```bash
# 检查 daisyui 组件类是否出现在 JSX 中
grep -rn "btn-primary\|btn-ghost\|btn-outline\|card bg-base\|input-bordered\|badge-primary\|tabs-boxed" <组件目录> --include="*.tsx" --include="*.jsx" -c | head -20
# 预期: 多个文件有命中

# 检查硬编码 indigo 是否被清除
grep -rn "#6366f1\|#4f46e5\|#4338ca\|#8b5cf6\|#7c3aed\|#a855f7" <组件目录> --include="*.tsx" --include="*.jsx" --include="*.css" -l
# 预期: 仅 node_modules 内出现（项目源码中应全部替换）
```

### Step 1.5 — Animal Island UI 组件替换（仅 Animal Island 主题模式）

**此步骤不可跳过。** 用 Animal Island UI 组件替换原生 HTML 元素：

1. 检查 `package.json` 是否已安装 `animal-island-ui`
2. 扫描所有组件，将符合条件的元素替换为 AIUI 组件：
   - `<button>` → `<Button color="primary">`
   - 卡片容器 → `<Card color="default">`
   - `<input>` → `<Input size="large">`
   - 分隔线 → `<Divider type="line-teal">`

验证：
```bash
grep -rn "from.*animal-island-ui\|from 'animal-island-ui'" <组件目录> --include="*.tsx" -c | head -20
# 预期: 多个文件有导入
```

### Step 1.6 — 自定义 CSS 动画注入（替代 animate.css）

**此步骤不可跳过。** 使用自定义 keyframe 动画替代 animate.css 库，避免 AI 默认动画库模式：

1. 在入口 CSS 文件添加自定义 keyframes（不使用 `@import "animate.css"`）：
```css
/* 入场动画 */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInFromBottom { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.animate-in { animation: fadeIn 250ms ease-out forwards; }
.slide-in-from-bottom-4 { animation: slideInFromBottom 300ms ease-out forwards; }

/* reduced-motion 保护 */
@media (prefers-reduced-motion: reduce) {
  .animate-in, .slide-in-from-bottom-4 { animation: none; opacity: 1; transform: none; }
}
```

2. 扫描所有视图/页面组件，在根元素添加自定义动画类：
   - 页面根 div：`animate-in`
   - 列表项 staggered：`slide-in-from-bottom-4` + staggered `animation-delay`
   - 卡片：`animate-in` + staggered delay

**禁止事项**：
- ❌ 不使用 `@import "animate.css"` — AI 默认动画库模式
- ❌ 不使用 `animate__animated` / `animate__fadeIn` 等 animate.css 类名
- ❌ 不安装 `animate.css` npm 包

验证：
```bash
grep -rn "@keyframes fadeIn\|@keyframes slideInFromBottom\|animate-in\|slide-in-from-bottom" <组件目录> --include="*.css" --include="*.tsx" --include="*.jsx" -c | head -10
# 预期: 入口 CSS 中有 keyframes 定义，多个组件使用了自定义动画类

# 验证 animate.css 未使用
grep -rn "animate__animated\|animate.css\|@import.*animate" <组件目录> --include="*.css" --include="*.tsx" --include="*.jsx" | grep -v node_modules
# 预期: 0（无 animate.css 引入）
```

#### Huashu Motion Engine 增强（可选）

对需要复杂动效的子项目，注入 Huashu motion-engine：

```bash
node -e "import('./src/lib/huashu/motion-engine.js').then(m => m.generateReleaseAnimation({ targetPath: '<子项目目录>', projectRoot: process.cwd(), title: 'Release', version: 'v1.0.0' }))"
```

Motion engine 输出：
- MP4 / GIF 发布动画文件（通过 `assets/huashu/render-video.js` 渲染）
- 标题 + 版本号动态叠加
- 可配置 duration 和 outputFormat
- 写入 `.claude/animations/release-{timestamp}.{mp4|gif}`

选择品牌库或 Huashu 风格库时**建议执行**，为发布生成品牌动画。

### Step 1.7 — 微交互注入

**此步骤不可跳过。** 给交互元素添加 hover/active/transition 类：

对每个子项目的入口 CSS 文件，添加微交互工具类：
```css
.hover-lift { transition: transform 200ms ease-out, box-shadow 200ms ease-out; }
.hover-lift:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.hover-glow:hover { box-shadow: 0 0 0 3px var(--accent, oklch(65% 0.18 30)); }
.active-press:active { transform: scale(0.97); }
.transition-theme { transition: background-color 200ms ease-out, color 200ms ease-out; }
```

**禁止事项**：❌ 不使用 `transition: all` — 触发布局/绘制重算，性能反模式。

然后扫描关键交互组件，添加对应的微交互类。

验证：
```bash
grep -rn "hover-lift\|hover-glow\|active-press\|transition-theme" <组件目录> --include="*.tsx" --include="*.jsx" -c | head -10
# 预期: 多个文件有命中
```

### Step 1.8 — 硬编码颜色清除

**此步骤不可跳过。** 将所有硬编码颜色替换为 Tailwind 语义类或 CSS 变量：

```bash
# 扫描所有硬编码 hex 颜色
grep -rn "#[0-9a-fA-F]{3,6}" <组件目录> --include="*.tsx" --include="*.jsx" -l | grep -v node_modules
```

对每个命中文件，将品牌相关颜色替换为语义 token：
- `#6366f1`, `#4f46e5`, `#8b5cf6` → `text-primary` / `bg-primary`
- `#ef4444` → `text-error` / `bg-error`
- `#10b981` → `text-success` / `bg-success`
- `#f59e0b` → `text-warning` / `bg-warning`

验证：
```bash
grep -rn "#[0-9a-fA-F]{6}" <组件目录> --include="*.tsx" --include="*.jsx" | grep -v node_modules | wc -l
# 预期: 大幅减少（允许保留非品牌色的 hex，如图表色、特殊装饰色）
```

---

## Phase 2: Post-flight 设计打磨

**CRITICAL**: Phase 2 是惊艳感的核心来源。每个 Impeccable 子命令必须实际修改代码文件，不允许只给建议。

对**每个子项目**独立执行以下步骤：

### Step 2.0 — Huashu 5 维度评审（第一轮）

打磨前设计基线测量，5 个维度分别评分（0-100）：
- philosophy — 品牌哲学一致性
- hierarchy — 视觉层级清晰度
- craft — 工艺细节（间距/字体/阴影/动效）
- functionality — 可用性（对比度/触摸目标/键盘）
- originality — 原创性（反模板化程度）

### Step 2.1 — Impeccable critique（第一轮）

Skill 深度设计批判，检测 27 条反模式 + 12 条 LLM 规则：
- 默认 Tailwind indigo 作为 accent
- 两色渐变 hero
- emoji 作为 feature icon
- sans-serif 在 display 文字上（当有 serif 品牌字体时）
- 圆角卡片 + 左侧彩色边框 accent
- 虚构指标
- 填充文案
- 标准 Hero→Features→Pricing→FAQ→CTA 序列

**必须输出问题清单**，每个问题标注文件路径和具体修复建议。

### Step 2.2 — Impeccable polish

全维度质量调优：配色/间距/字体/圆角/阴影。在完整组件状态下统一调优。

### Step 2.3 — Impeccable layout

间距节奏 + 视觉层级 + 空间重构：
- 消除均匀间距（不同 section 间距应有变化）
- 建立呼吸节奏（紧凑→宽松→中等）
- 打破模板感（非对称布局、意外留白）

### Step 2.4 — Impeccable colorize

策略性色彩注入。检测单色调界面 → 注入品牌配色策略：
- 选择策略：Restrained / Committed / Full Palette / Drenched
- 至少 2 种 accent 色可见使用（但每屏 ≤2 个 accent 元素）

### Step 2.5 — Impeccable bolder

安全→大胆：放大设计决策的影响力。具体：
- 字号对比度至少 1.5x 跳跃
- 至少一个元素打破常规（超大数字、意外留白、非对称卡片）

### Step 2.6 — Impeccable typeset

排版层次优化：
- font-family ≤ 3
- 字号阶梯 ≥ 1.25（标题不能只比正文大 2px）
- 正文行长 65-75ch
- 标题 `text-wrap: balance`
- ALL CAPS 必须 `letter-spacing: 0.06em-0.1em`
- Display 文字（≥32px）必须有负 letter-spacing

### Step 2.7 — Impeccable animate

用 purposeful motion 替代浅层 animate.css：
- 遵循 `prefers-reduced-motion`
- 使用 exponential easing (`cubic-bezier(0.2, 0, 0, 1)`)
- 微交互 ≤ 200ms，页面转场 ≤ 300ms

### Step 2.8 — Impeccable delight

个性化记忆点：至少 3 处微交互/细节/惊喜，让页面有「人设计的」感觉。

### Step 2.8a — Community Pets 吉祥物注入（可选）

为品牌页面注入 Open Design 社区吉祥物，增加亲和力和个性化：

```bash
ls open-design/assets/community-pets/
```

8 个可用吉祥物：`clippit` / `dario` / `dentist` / `nyako-shigure` / `slavik` / `tux` / `yelling-dario` / `yorha-sit-2b`

推荐使用场景：
- 加载状态（吉祥物动画替代 spinner）
- 空状态（吉祥物 + 引导文案）
- 错误状态（吉祥物 + 恢复 CTA）
- 首次使用引导（吉祥物作为向导角色）
- 成就/徽章页（吉祥物颁发徽章）

集成方式：将吉祥物 SVG/PNG 复制到项目 `public/pets/` 目录，在对应状态组件中引用。

### Step 2.9 — Impeccable harden

生产就绪：检查每个页面的 5 种状态（loading/empty/error/populated/edge）。

### Step 2.10 — Impeccable distill

精简提纯：去除美化过程中可能引入的冗余元素/装饰/过度层次。

### Step 2.11 — Impeccable clarify

UX 文案优化：标签/按钮/错误提示/空状态，消除 AI 默认措辞。

### Step 2.12 — Impeccable adapt

响应式设计验证：移动端/平板/桌面断点审查 + 触摸目标 24px+。

### Step 2.13 — Impeccable optimize

CSS/渲染性能诊断：CLS 布局偏移/未使用 CSS/合成层/Font Load 策略。

### Step 2.13a — Impeccable quieter

降低视觉强度：过度加粗 → 适度加粗、过大阴影 → 适度阴影、过度装饰 → 精简。消除 AI 默认的"用力过猛"感：
- `font-black` (900) → `font-extrabold` (800) 或 `font-bold` (700)
- `shadow-xl` / `shadow-2xl` → `shadow-md` / `shadow-lg`
- 装饰性模糊光晕 → 移除或降级
- 非功能性大字号 → 缩放到合理范围
- 检查 `fontsize` 阈值：无 <12px 文字，无 >6rem 标题

### Step 2.13b — Impeccable onboard

首次使用体验设计：空状态引导、激活流程、首次交互提示：
- 检查所有页面的空状态（empty state）是否有引导性文案和 CTA
- 检查是否有 onboarding 提示（tooltip/coach mark/setup wizard）
- 检查首次加载是否有欢迎状态而非直接空白页
- 检查错误状态是否有可操作的恢复路径

### Step 2.14 — Impeccable critique（第二轮）

复检所有修复步骤的实际效果，确认品味提升可感知，发现残留问题。

### Step 2.15 — 三轮精准修复

针对 critique 第二轮发现的残留问题，执行 3 项精准修复：
1. polish（微交互/阴影层级/字体配对/留白节奏）
2. bolder（放大设计决策影响力）
3. delight（注入个性化微交互/细节/惊喜）

### Step 2.16 — Huashu 5 维度评审（第二轮）

复评 5 维度，与第一轮对比验证设计质量提升可量化（预期提升 ≥ 15 分）。

### Step 2.17 — AI-Friendly Web Design 可访问性审查

打磨完成后验证可访问性合规：
- 色彩对比度检查（WCAG 2.2 AA：正文 ≥4.5:1，大文字 ≥3:1）
- 焦点顺序合理性（Tab 键导航路径检查）
- 语义 HTML 结构（heading hierarchy / landmarks / alt text）
- ARIA 标签完整性（form labels / button labels / live regions）
- 键盘导航可操作性（所有交互元素可键盘到达）
- `prefers-reduced-motion` 全量保护验证
- 触摸目标最小尺寸验证（24×24 CSS px AA / 44×44 AAA）

### Step 2.18 — Device Frames 设备框适配

使用 Open Design 5 设备框验证多设备视觉效果：
- Bash `ls open-design/assets/frames/` 列出 5 设备框
- 对关键页面用设备框包裹截图（browser-chrome / ipad-pro / iphone-15-pro / macbook / android-pixel）
- 验证每种设备的布局完整性、触摸目标、字号可读性

此步骤**建议对所有子项目执行**，确保响应式美化在多设备上一致。

### Step 2.19 — Huashu deck-exporter 演示稿导出

将打磨后的页面导出为设计演示稿（PDF/HTML），用于评审和交付：

```bash
node -e "import('./src/lib/huashu/deck-exporter.js').then(m => m.generateReleaseDeck({ targetPath: '<目标路径>', projectRoot: process.cwd(), title: 'Design Deck', version: 'v1.0.0', highlights: [] }))"
```

deck-exporter 输出：
- HTML 演示稿（封面 + 亮点页 + 结尾页，1920×1080 缩放渲染）
- 可选 PPTX 导出（需 `npm i pptxgenjs`）
- 标题 + 版本号 + 亮点摘要（`highlights: [{title, body}, ...]`）
- 写入 `.claude/decks/release-{timestamp}.html`

**建议对所有子项目执行**，生成可交付的设计演示稿。

---

## 执行模式

此工作流**完全在对话内执行**，不通过 CLI 子进程。

CLI 子进程（`node src/index.js start ui-polish --auto`）仅用于 CI/CD 等非对话场景的纯机械步骤，会跳过所有 Skill 步骤。

## 完成标准

美化完成的硬性指标（全部满足才算完成）：

- [ ] 所有子项目的 `package.json` 包含 daisyui / lucide-react
- [ ] 所有子项目的入口 CSS 包含主题变量注入或 daisyui plugin
- [ ] Material Icons / Material Symbols 引用数为 0
- [ ] DaisyUI 组件类（btn/btn-primary/card/input/badge）在至少 30% 的组件文件中出现
- [ ] 自定义 CSS keyframe 动画（animate-in / slide-in-from-bottom）在入口 CSS 中定义，在至少 50% 的视图文件中使用
- [ ] 微交互类（hover-lift/hover-glow/active-press）在交互组件中出现（不含 transition-all）
- [ ] 硬编码 indigo 色（#6366f1/#4f46e5/#8b5cf6 等）在项目源码中为 0
- [ ] animate.css 库未安装、未引用（@import "animate.css" / animate__animated 类名出现次数为 0）
- [ ] Phase 0 全部 8 步已执行（web-design-engineer → review-checklist → impeccable audit → Open Design 资源清单 → craft 规则加载 → brand-protocol → expert-review 基线 → html-direction-advisor）
- [ ] Phase 2 Impeccable 打磨链全部 23 步已执行（Huashu→critique→polish→layout→colorize→bolder→typeset→animate→delight→community-pets→harden→distill→clarify→adapt→optimize→quieter→onboard→critique→3精准修复→Huashu→AI-Friendly a11y→设备框→deck-exporter）
- [ ] Huashu 第二轮评分 ≥ 第一轮评分 + 15
- [ ] Impeccable quieter 已执行：无过度加粗/过度阴影/装饰性模糊
- [ ] Impeccable onboard 已执行：空状态/首次使用/激活流程已检查
- [ ] AI-Friendly Web Design 可访问性审查已执行（对比度/焦点/语义HTML/ARIA/键盘/触摸目标）
- [ ] Device Frames 设备框适配已验证（browser-chrome/ipad-pro/iphone-15-pro 三端截图）
- [ ] Huashu prototype-builder 原型已生成（选择品牌库或设计模板时）
- [ ] Huashu infographic 信息图表已渲染（需要数据可视化时）
- [ ] Huashu deck-exporter 演示稿已导出（HTML + PDF）
