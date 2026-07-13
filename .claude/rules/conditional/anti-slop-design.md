# AI 反套娃设计标准

> 从 Google Stitch taste-design 技能提炼。用于 ui-polish/design 工作流防止 AI 生成千篇一律的 UI。

## 设计决策维度

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

## 颜色规则

### 强制约束
- **最多 1 个强调色**，饱和度 < 80%
- **禁止 AI 紫/蓝霓虹** — 无紫色按钮发光，无霓虹渐变
- 使用绝对中性底色 (Zinc/Slate) + 高对比单一强调色
- 一个调色板贯穿全站，不要冷暖灰混用
- **禁止纯黑 `#000000`** — 用 Off-Black / Zinc-950 / Charcoal

### 强调色选项（每项目选 1 个）
| 名称 | Hex | 适用场景 |
|------|-----|---------|
| Emerald Signal | `#10B981` | 增长/成功/数据面板 |
| Electric Blue | `#3B82F6` | 生产力/SaaS/开发工具 |
| Deep Rose | `#E11D48` | 创意/编辑/时尚 |
| Amber Warmth | `#F59E0B` | 社区/社交/暖色调 |

## 排版规则

### 字体选择
- **展示/标题：** `Geist` / `Satoshi` / `Cabinet Grotesk` / `Outfit` — 收紧字距、权重驱动层级
- **正文：** 同族 weight 400，行高 1.65，最大 65ch
- **等宽：** `Geist Mono` / `JetBrains Mono` — 代码、元数据、时间戳

### 禁止字体
- `Inter` — 高级/创意场景禁止
- 通用衬线字体 (`Times New Roman` / `Georgia` / `Garamond` / `Palatino`) — 禁止。如需衬线，仅用 `Fraunces` / `Gambarino` / `Editorial New` / `Instrument Serif`
- 仪表盘/软件 UI 中始终禁止衬线字体
- 密度 > 7 时，所有数字必须用等宽字体

## 组件规则

### 按钮
- 扁平表面，无外发光
- 按下态：`translateY(-1px)` 或 `scale(0.98)` 触感反馈
- 主按钮强调色填充+白色文字，次按钮幽灵/轮廓

### 卡片
- 圆角 ≥ 2rem，仅在层级需要时使用
- 阴影着色匹配背景色调
- 高密度布局用 `border-top` 分隔线替代卡片

### 输入框
- 标签在上方，错误信息在下方
- 聚焦环用强调色
- 禁止浮动标签

### 加载态
- 骨架屏匹配精确布局尺寸和圆角
- 禁止圆形旋转器

### 空状态
- 组合插画或图标构图+引导文字
- 不是简单的 "No data found"

## 布局原则

- **Grid-first** — 禁止 flexbox 百分比计算 (`calc(33% - 1rem)`)
- **禁止重叠** — 元素不可重叠，无 z-index 内容层叠
- **Hero 非对称** — 变化度 > 4 时禁止居中 Hero，用 Split Screen / 左对齐 / 非对称留白
- **禁止 3 等分卡片行** — 用 2 列 Zig-Zag / 非对称 Bento Grid / 水平滚动
- **容器** — max-width: 1400px，居中
- **全高** — 用 `min-h-[100dvh]`，禁止 `h-screen` (iOS Safari bug)
- **响应式** — < 768px 严格单列，无水平滚动，触摸目标 ≥ 44px

## 动效规则

- **弹簧物理** — `stiffness: 100, damping: 20`，无线性缓动
- **永久微交互** — 每个活跃组件有无限循环态 (Pulse / Typewriter / Float / Shimmer)
- **交错编排** — 列表/网格用 `animation-delay: calc(var(--index) * 100ms)` 瀑布式揭示
- **性能** — 仅动画 `transform` 和 `opacity`，禁止 `top/left/width/height`

## Anti-Patterns（禁止清单）

### 颜色/视觉
- [ ] 无 emoji
- [ ] 无 `Inter` 字体（高级场景）
- [ ] 无通用衬线字体
- [ ] 无纯黑 `#000000`
- [ ] 无霓虹外发光
- [ ] 无饱和度 > 80% 的强调色
- [ ] 无大标题过度渐变文字
- [ ] 无自定义鼠标光标
- [ ] 无重叠元素

### 布局
- [ ] 无 3 等分卡片功能行
- [ ] 无居中 Hero（高变化度项目）
- [ ] 无 `h-screen`（始终用 `min-h-[100dvh]`）
- [ ] 无 `z-index` 滥用（仅 Navbar/Modal/Overlay）

### 内容
- [ ] 无 AI 文案套话: "Elevate" / "Seamless" / "Unleash" / "Next-Gen" / "Revolutionize"
- [ ] 无填充 UI 文字: "Scroll to explore" / "Swipe down" / 滚动箭头 / 弹跳箭头
- [ ] 无通用占位名: "John Doe" / "Acme" / "Nexus" / "SmartFlow"
- [ ] 无假整数: `99.99%` / `50%` — 用真实数据如 `47.2%`
- [ ] 无捏造数据 — 禁止生成不存在的指标/性能数字/统计数据，用 `[metric]` 占位
- [ ] 无 `LABEL // YEAR` 格式 — "SYSTEM // 2024" 是 AI 惯用垃圾格式
- [ ] 无 fake 系统指标面板 — "SYSTEM PERFORMANCE METRICS" / "BY THE NUMBERS"

### 其他
- [ ] 无 shadcn/ui 默认值 — 自定义圆角/颜色/阴影
- [ ] 无 Unsplash 死链 — 用 `picsum.photos` 或 SVG 头像
- [ ] 无圆形加载旋转器 — 仅骨架屏

## 使用方式

在 `/ui-polish`、`/design`、`/feature` 等涉及 UI 的工作流中：

1. 生成或审查 UI 代码前，过一遍 Anti-Patterns 检查清单
2. 发现违规项时标记，优先修复视觉/布局类问题
3. 新项目开始时用 4 个决策维度确定设计方向

## 与现有规则的关系

- 本文件是 `visual-standards.md` 的补充 — visual-standards 管阈值/视口，本文件管设计品味
- 与 `awesome-design-md` / `open-design` 互补 — 那些是品牌参考，本文件是反套娃规则
- `impeccable` skill 的 27 条反模式与本文件有重叠但不重复 — impeccable 偏交互/可用性，本文件偏视觉品味