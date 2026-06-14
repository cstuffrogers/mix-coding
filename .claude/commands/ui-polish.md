---
description: Polish frontend projects with DaisyUI/Animal Island UI themes, animate.css animations, lucide-react icon upgrade, micro-interactions, and impeccable design critique. 25-step workflow.
argument-hint: "[target-path]"
---

# UI Polish Command

启动前端美化场景。自动美化前端项目，集成 DaisyUI / Animal Island UI 主题、动画、图标升级、微交互和设计打磨。

**25 步工作流**：设计基准声明 → 主题选择 → 依赖安装 → 图标升级（Material Symbols→lucide-react）→ 动画注入（animate.css）→ 微交互（hover/active）→ 设计打磨（Impeccable）→ 审查 → 测试 → 沉淀

用法：`/ui-polish [目标路径]`

## 执行流程

### Pre-flight: 声明设计系统基准（Open Design）

在运行 CLI 美化步骤之前，先调用 web-design-engineer skill 建立设计系统基准，确保后续美化不偏离：

```
Skill({ skill: "web-design-engineer", args: "Survey the target project at <目标路径>. Identify existing design tokens (CSS variables, Tailwind config colors, font stacks). Declare a design system baseline: Palette (oklch, respecting existing brand colors), Typography (detect existing fonts and recommend complementary ones from anti-cliché blocklist), Spacing scale, Motion tokens, Radius scale, Shadows. The goal is to fill gaps without overwriting existing design decisions." })
```

**验证产出**：
- [ ] 检测到已有设计 Token（DESIGN.md / CSS 变量 / tailwind.config.js）
- [ ] 声明 Palette（已有品牌色保留，空缺用 oklch 填补）
- [ ] 声明 Typography（已有字体保留，空缺用 anti-cliché 推荐）
- [ ] 声明 Spacing / Motion / Radius / Shadows

将基线写入 `.claude/designs/design-baseline.md`，后续 CLI 步骤将读取此基线进行 Token 调和。

### Phase 1: CLI 美化步骤

基线声明完成后，运行 CLI 工作流执行具体美化：

```bash
node src/index.js start ui-polish --auto --theme <主题> --target <路径>
```

CLI 步骤包括：
- 安装依赖（daisyui / animate.css / lucide-react）
- 一致性检查（CSS 变量使用率、组件覆盖度）
- 主题应用（DaisyUI / Animal Island / Custom / Huashu 40 / Awesome Design MD）
- 设计 Token 调和（已有值优先，新值填补空缺）
- 图标升级（Material Symbols → lucide-react）
- 动画注入（animate.css）
- 微交互（hover/active 效果）
- Impeccable 设计打磨
- 测试 + 视觉回归
- 记忆沉淀

### Phase 2: 后置审查

美化完成后，调用 impeccable skill 进行最终打磨验证：

```
Skill({ skill: "impeccable", args: "Review the polished project at <目标路径>. Run anti-pattern check against the design baseline. Verify: no purple-blue gradients, no Inter defaults, spacing consistency, typography scale adherence, color contrast." })
```
