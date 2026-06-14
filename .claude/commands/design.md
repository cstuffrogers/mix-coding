---
description: AI-driven UI design — invoke web-design-engineer skill, generate multi-style options, confirm, export assets.
argument-hint: "[设计描述]"
---

# /design — AI 驱动 UI 设计生成

调用 Open Design（web-design-engineer skill，129 套品牌系统、oklch 色彩、Anti-Cliché Blocklist）生成设计方案。**本命令仅在对话模式有效** — CLI 子进程无法调用 Skill 工具。

## 用法

```text
/design 登录页面
/design 后台管理仪表板
/design "SaaS landing page with hero and pricing"
```

## 执行流程

### Phase 1: 收集需求

如果用户未提供设计描述，询问：
- 设计什么界面/组件？
- 目标平台（web / mobile / both）？
- 风格偏好（简约 / 企业 / 创意 / 自然）？

### Phase 2: 声明设计系统（Open Design — 必须执行）

**调用 web-design-engineer skill 声明设计系统基准：**

```
Skill({ skill: "web-design-engineer", args: "Declare a complete design system for: <用户需求>. Output: Palette (oklch), Typography (heading + body fonts from anti-cliché blocklist), Spacing scale (4px base), Motion tokens, Radius scale, Shadows. Use the anti-cliché blocklist — no Inter/Roboto/system-ui, no purple-blue gradients, no blue primary buttons." })
```

**验证产出**：
- [ ] Palette 已声明（oklch 值，含 chroma/hue/lightness）
- [ ] Typography 已声明（heading + body，非 Inter/Roboto/Arial/system-ui）
- [ ] Spacing 尺度已声明（4px base）
- [ ] Motion 已声明（200ms ease-out / 600ms ease-in-out）
- [ ] Radius 已声明（button/card/modal 三级）
- [ ] Shadows 已声明

将产出的设计系统写入 `.claude/designs/design-system.md`。

### Phase 3: 生成多风格设计方案

基于设计系统，生成 3 套不同风格的低保真设计方案。每套方案必须是**完整可运行的 HTML 原型**（单文件，内联 CSS），写入 `.claude/designs/proposal-<A/B/C>.html`：

**方案 A** — 偏暖色、衬线标题、大量留白（editorial 方向）
**方案 B** — 偏冷色、无衬线、高密度信息（product 方向）  
**方案 C** — 品牌风格（检测到品牌提及则针对品牌，否则 Apple 极简风格）

每套方案 HTML 需包含：
- 完整的 `<style>` 块（使用 oklch 颜色变量）
- 页面布局骨架
- 关键组件（至少：header/nav、hero/主内容区、CTA 按钮、card/列表项）
- 所有状态样式（hover/active/focus/disabled）
- 不使用任何图标库或外部字体 CDN（用系统字体 + CSS 绘制图标）

### Phase 4: 用户选择

展示 3 套方案（渲染 HTML 原型或描述），让用户选择一套进入高保真。

### Phase 5: 高保真输出

对用户选择的方案生成高保真产出：

**5a. 调用 impeccable skill 打磨选中方案：**
```
Skill({ skill: "impeccable", args: "Critique and fix the selected design <方案X>. Run anti-pattern check (no purple-blue gradient, no Inter default, no cards-nested-in-cards, spacing consistency, typography scale, color contrast). Apply fixes." })
```

**5b. 写入最终产出：**
- `.claude/designs/design-spec.md` — 完整设计规范（设计系统 + 布局 + 组件清单含所有状态）
- `.claude/designs/prototype.html` — 高保真 HTML 原型（可浏览器打开）
- `.claude/designs/current.json` — 设计元数据

### Phase 6: AI-Friendly 可访问性审查

调用 ai-friendly-web-design skill：
```
Skill({ skill: "ai-friendly-web-design", args: "Review the design prototype at .claude/designs/prototype.html for: semantic HTML, ARIA labels, stable locators, form best practices, color contrast." })
```

### Phase 7: API 契约检查

如果项目存在 OpenAPI 规范文件，从设计稿提取数据字段/端点，与后端代码交叉验证。

### Phase 8: 记忆沉淀

将方案选择、设计 Token、品牌信息保存到记忆：
- Claude Code 原生 memory：`project` 类型
- 项目 CLI 记忆：`node src/index.js memory remember --type design`

## 与 CLI 模式的关系

CLI 子进程（`node src/index.js start design --auto`）**无法**调用 Claude Code Skill 工具。Open Design 设计生成（Skill-based）在 CLI 模式下的对应步骤已被移除，CLI 路径聚焦于静态分析（API 契约检查、设计一致性、可访问性审查、资源导出）。

**本命令（对话模式）是 Open Design 的唯一执行路径。** 检测方式：`CLAUDECODE=1` 环境变量。
