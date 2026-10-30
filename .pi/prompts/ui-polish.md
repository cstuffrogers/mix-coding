---
description: Run Mix-Coding System ui-polish workflow via scene engine (5 modes: ui_polish / impeccable / design_only / brand_system / landing_page)
argument-hint: "[target-path] [--mode ui_polish,impeccable,landing_page]"
---
Run the Mix-Coding System `ui-polish` workflow by executing:

```bash
claude-scene start ui-polish --auto $ARGUMENTS
```

Report the command output and the acceptance triple (changes / verify command / verify result).

## 模式（`--mode`，逗号分隔）

`--mode` 一旦传了就**不再叠加场景声明的默认值**（默认只有 `ui_polish` + `impeccable`），
所以要「加一个模式」必须把默认那两个也写进去。

| 模式 | 干什么 | 默认 |
|------|--------|------|
| `ui_polish` | 主流程：主题 / 动画 / 图标 / 微交互 / 打磨 | ✅ |
| `impeccable` | Skill 深度批判两轮 + CLI 反「AI 塑料感」修复（18 步） | ✅ |
| `design_only` | 只出设计，不改代码 | — |
| `brand_system` | 从品牌预设（`awesome-design-md`，5 套）出设计系统 | — |
| `landing_page` | **落地页专项**：`landing-page-design` skill 的 A 部分结构/转化文案 + B 部分视觉基线（字号刻度、间距表、嵌套圆角公式、hero 680px、动效基准曲线）+ 交付清单逐条核对 | — |

## 常用调用

```bash
# 整体美化（场景默认两模式）
claude-scene start ui-polish --auto --target ./frontend

# 落地页 + 保留默认两套（推荐：默认负责打磨，landing_page 负责数值与结构）
claude-scene start ui-polish --auto --target ./web --mode ui_polish,impeccable,landing_page

# 只跑落地页方法论
claude-scene start ui-polish --auto --target ./web --mode landing_page

# 只出品牌设计系统
claude-scene start ui-polish --auto --target ./web --mode brand_system
```

`--mode` 里写了认不出的 id 时，引擎会打印可用列表并回落到场景默认值，不会静默改计划。

## 落地页模式的裁决顺序

用户当轮说的 > 落地页专项数值（B 部分）> 品牌预设的调色板/字体/材质 > `impeccable` 只保留批判
> 上游禁止项（禁 Inter/Roboto、禁背景渐变、字号必须落刻度……）。冲突时按这个顺序，别让
skill 的「Always consult it」压掉用户明确要求。
