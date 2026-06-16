---
name: awesome-design-md
description: 5 个精选品牌设计系统集合（Vercel/Linear/Stripe/Notion/Apple），DESIGN.md 格式直接复用。When user wants to build UI matching a specific brand's visual style.
user-invocable: true
---

# Awesome Design MD

精选 5 个最常被引用的品牌设计系统，可作为 design / ui-polish 工作流的输入。

## 可用品牌

| 品牌 | 场景 | 文件 |
|------|------|------|
| **Vercel** | 现代 SaaS 仪表板 | `brands/vercel.md` |
| **Linear** | 任务管理 / Issue Tracker | `brands/linear.md` |
| **Stripe** | 金融 / 支付 / Dashboard | `brands/stripe.md` |
| **Notion** | 内容 / 知识库 / 协作 | `brands/notion.md` |
| **Apple** | 极简 / 高端 / 营销站 | `brands/apple.md` |

## 使用方法

1. **AI 智能体自动加载** —— 在 design / ui-polish 工作流中，可用 `awm-brand-import` action 加载品牌
2. **手动引用** —— 在 prompt 中说"使用 Linear 风格"
3. **预览** —— 每个品牌 .md 文件包含完整的颜色、字体、间距、组件规范

## 集成位置

- `design` 工作流：step 4.6 提示用户选择品牌（在 Open Design 对话模式中执行）
- `ui-polish` 工作流：step 6 主题选择时新增"导入品牌 DESIGN.md"选项

## 与其他设计 Skill 的关系

| Skill | 作用 | 关系 |
|-------|------|------|
| **web-design-engineer** | 反 AI 套路 + oklch | 互补：方法论 |
| **ai-friendly-web-design** | 可访问性 14 原则 | 互补：质量检查 |
| **awesome-design-md** | 5 精选品牌 token | 互补：成品参考 |

三者组合使用最佳：awesome-design-md 提供 token → web-design-engineer 提供规范 → ai-friendly-web-design 提供检查。
