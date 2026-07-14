# AI 反套娃设计标准

> 从 Google Stitch taste-design 技能提炼。**与 hallmark skill 互补** — hallmark 提供 20 主题 + 57 slop-test 门禁 + 9 种宏观结构，本文件提供 4 维决策框架 + 强调色选项。禁止清单项已由 hallmark slop-test 接管，此处不再重复。

## 设计决策维度

hallmark 负责选主题/宏观结构/字体/调色板。以下 4 个维度在 hallmark 选型完成后用于微调密度和动效级别。

### 1. 密度 (Density)
| 级别 | 描述 |
|------|------|
| 1-3 | Gallery-airy，极简留白 |
| 4-7 | 日常 App 平衡 |
| 8-10 | Cockpit-dense，数据密集 |

### 2. 视觉变化度 (Variance)
| 级别 | 描述 |
|------|------|
| 1-3 | 可预测对称 |
| 4-7 | 偏移非对称 |
| 8-10 | 艺术性混沌 |

### 3. 动效强度 (Motion)
| 级别 | 描述 |
|------|------|
| 1-3 | 静态克制 |
| 4-7 | CSS 流体过渡 |
| 8-10 | 电影级编排 |

### 4. 创意度 (Creativity)
| 级别 | 描述 |
|------|------|
| 1-3 | 极简瑞士风格 |
| 4-7 | 平衡干净有个性 |
| 8-10 | 表现力/编辑性/粗体排版实验 |

## 强调色选项（每项目选 1 个）

hallmark 的 20 个主题自带 OKLCH 调色板。当不使用 hallmark 主题时，从以下 4 个中选 1 个：

| 名称 | Hex | 适用场景 |
|------|-----|---------|
| Emerald Signal | `#10B981` | 增长/成功/数据面板 |
| Electric Blue | `#3B82F6` | 生产力/SaaS/开发工具 |
| Deep Rose | `#E11D48` | 创意/编辑/时尚 |
| Amber Warmth | `#F59E0B` | 社区/社交/暖色调 |

## 与 hallmark 的分工

| 职责 | hallmark | 本文件 |
|------|----------|--------|
| 主题/调色板 | 20 主题 + Custom OKLCH | 4 强调色备选（非 hallmark 场景） |
| 禁止项检测 | 57 slop-test 门禁 | 不重复 |
| 宏观结构 | 9 种 macrostructures | — |
| 密度/变化度/动效/创意度 | — | 4 维 1-10 级别 |
| 设计 DNA 提取 | `study` 动词 | — |
| 审查评分 | `audit` 动词 + pre-emit critique | — |
| 字体选择 | 20 主题自带 + 2+1 font discipline | — |

## 使用方式

在 `/ui-polish`、`/design`、`/feature` 等涉及 UI 的工作流中：

1. **优先触发 hallmark**（默认 Design flow → 选主题 → 57 slop-test）获得基础视觉
2. **用本文件 4 维度微调**密度/变化度/动效/创意度
3. 非 hallmark 场景（轻量改动、不需要完整主题）直接用本文件强调色 + 4 维度

## 与现有规则的关系

- `hallmark` skill — 主力设计引擎（主题 + 门禁 + 结构）
- 本文件 — 决策框架 + 强调色备选（与 hallmark 互补）
- `visual-standards.md` — 视觉回归阈值/视口标准
- `impeccable` skill — 交互/可用性反模式（与 hallmark 不重叠）
- `awesome-design-md` / `open-design` — 品牌参考
