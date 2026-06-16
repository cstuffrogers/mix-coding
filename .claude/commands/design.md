---
description: AI-assisted UI design workflow: Pre-flight design baseline → shape design brief (taste direction) → 3-direction proposal → Huashu prototype → AWM brand → expert review → Impeccable full-suite polish (critique detect → 12 fixes → critique verify → 3 targeted fixes, dual-pass QC + residual repair). 53-step hybrid workflow.
argument-hint: "[描述] [--category web|mobile]"
---

# /design — AI 辅助 UI 设计

53 步混合工作流：**Pre-flight Skill 设计基准（对话模式）→ shape 设计简报确立品味方向 → 三方向提案 → 原型构建 → 专家评审 → Impeccable 全维度打磨（对话模式，⚠️ 必须执行 critique 检测 → 12 项全维度修复 → critique 验证 → 3 项精准残留修复，双轮品控+残留修复）**

## Usage

```text
/design                           # 交互式设计流程
/design 设计一个登录页面            # 带需求描述
/design --category mobile          # 移动端设计
```

## 执行流程

### Phase 0: Pre-flight 设计准备（对话模式，Skill() 调用）

在设计生成前建立设计基准：

1. **web-design-engineer Skill** (`step 0.3`) — 声明设计系统基准（Palette/Typography/Spacing/Motion/Radius/Shadows），加载 150 品牌系统
2. **Memory recall** (`step 0.5`) — 注入历史设计上下文和品牌偏好
3. **Impeccable shape** (`step 0.6`) — 🆕 设计发现访谈 → 10 节设计简报（mood/references/color strategy/design direction/bold move），在生成前确立品味方向约束

### Phase 1: 设计生成

CLI 执行具体设计步骤（通过 `node src/index.js start design --auto`）：

- **三方向提案** (`step 1`, `generateDesign`)：huashu direction-advisor 生成 3 种视觉方向 + 评分矩阵
- **品牌列表** (`step 1.57`, `awm-brand-list`)：Awesome Design MD 展示可用品牌（Vercel/Linear/Stripe/Notion/Apple）
- **品牌导入** (`step 1.58`, `awm-brand-import`)：导入选中品牌 DESIGN.md → CSS 变量注入
- **品牌协议** (`step 1.59`, `huashu-brand-protocol`)：Huashu Brand Protocol 品牌提及检测 → 5 步资产清单 → brand-spec.md

### Phase 2: 原型构建 + 资源导出

- **原型构建** (`step 2`, `huashu-prototype`)：HTML/CSS 原型 + Playwright 自动验证截图
- **一致性检查** (`step 2.5`, `analyzeConsistency`)：CSS 变量使用率 vs 硬编码值，组件覆盖度
- **资源导出** (`step 2.7`, `exportAssets`)：tokens.css + design-spec.md → src/assets/design-system/

### Phase 3: 多维度审查（对话模式）

4. **Huashu 专家评审** (`step 3`, `huashu-expert-review`)：5 维度评分 — philosophy/hierarchy/craft/functionality/originality
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
18. **Impeccable critique（第二轮）** (`step 4.0992`) — 🆕 验证打磨后的设计改进效果：复检 27 条反 AI 模式 + 12 条 LLM 规则，确保品味提升可感知
19. **Impeccable polish（第三轮）** (`step 4.0993`) — 🆕 针对 critique 第二轮发现的残留 AI 塑料感，精准修复：微交互/阴影层级/字体配对/留白节奏
20. **Impeccable bolder（第三轮）** (`step 4.0994`) — 🆕 针对 critique 第二轮发现的安全默认审美，放大设计决策影响力
21. **Impeccable delight（第三轮）** (`step 4.0995`) — 🆕 针对 critique 第二轮发现的记忆点缺失，注入个性化微交互/细节/惊喜
22. **Huashu 5 维度评审（第二轮）** (`step 4.0996`) — 🆕 三轮修复后最终验证：philosophy/hierarchy/craft/functionality/originality 复评，确认设计质量提升可量化
23. **AI-Friendly Web Design** (`step 4.0997`) — 🆕 可访问性审查：色彩对比度/焦点顺序/语义HTML/ARIA标签/键盘导航，打磨完成后验证合规

### Phase 5: 交付物 + 沉淀

- **持久化** (`step 5`, `persist`)：保存设计选择到 .claude/designs/current.json
- **信息图** (`step 5.5`, `huashu-infographic`)：渲染设计系统可视化信息图（HTML）
- **CE 沉淀** (`step 6`, `ce-compound`)：设计知识沉淀到 CLAUDE.md
- **记忆保存** (`step 7-7.5`)：保存设计偏好 + 整理跨后端一致性
- **通知** (`step 8`)：设计结果通知

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 设计基准 | web-design-engineer Skill（150 品牌系统） | Skill |
| 方向提案 | huashu direction-advisor（3 方向 + 评分矩阵） | CLI |
| 品牌 | Awesome Design MD（Vercel/Linear/Stripe/Notion/Apple） | CLI |
| 原型 | huashu prototype-builder + Playwright 验证 | CLI |
| 一致性 | CSS 变量 vs 硬编码 + 组件覆盖度 | CLI |
| 资源 | tokens.css + design-spec.md 导出 | CLI |
| 评审 | Huashu 5 维度 + AI-friendly + Impeccable 批判 | CLI / Skill |
| 打磨 | Impeccable 27 条反模式自动修复 | Skill |
| 可视化 | Huashu 信息图渲染 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，Skill 步骤（`web-design-engineer`、`ai-friendly-web-design`、`impeccable`）因为 `conversation_mode` 条件不满足而自动跳过，仅执行机械步骤。这是设计如此。
