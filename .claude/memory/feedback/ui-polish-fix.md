---
name: ui-polish-fix-2026-06-19
description: ui-polish 工作流修复——问题诊断和解决方案
metadata:
  type: feedback
---

# /ui-polish 修复：从"只改CSS颜色"到"全量Open Design应用"

## 问题

用户反馈 `/ui-polish` 执行后"感觉只调了颜色，其他好像没什么变化"。

## 根因诊断

对 `E:\new-ai-edu` 项目（5 个子前端：student/school/teacher/parent/admin）执行 ui-polish 后：
- ✅ 安装了 daisyui / lucide-react（animate.css 已禁止使用，自定义 keyframe 动画替代）
- ✅ 写了 CSS 主题文件（index.css 含品牌 token）
- ✅ 配置了 tailwind + daisyui plugin
- ❌ 组件 JSX **完全没有改**——按钮仍是原生 `<button>` 无 `btn` 类，卡片仍是裸 `<div>`
- ❌ Material Icons 引用**未替换**为 lucide-react
- ❌ animate.css 动画类**未注入**到视图组件
- ❌ 微交互 hover/active 类**未添加**
- ❌ 硬编码颜色（`#6366f1` 等）**未清除**
- ❌ admin 项目（Ant Design）**完全跳过**
- ❌ Phase 2 Impeccable 打磨链**全部未执行**

根因：旧版 `ui-polish.md` 命令规范只有笼统描述（"扫描 JSX/TSX 并替换"），没有具体命令、没有强制验证、没有硬性完成标准。执行时 Agent 只做了 CSS 注入和 npm install，跳过了所有需要改 JSX 的步骤。

## 修复内容

### 1. `.claude/commands/ui-polish.md` — 完全重写

关键变更：
- 新增**前置检测**步骤：自动识别多子项目，每个子项目独立执行
- Phase 1 每个步骤写死**具体命令 + 验证 bash 命令**
- **Step 1.4 DaisyUI 组件类应用**（新增）：逐文件扫描 button/input/select/textarea，强制添加 daisyui 组件类
- **Step 1.8 硬编码颜色清除**（新增）：扫描所有 hex 颜色，替换为语义 token
- 所有关键步骤标注"**此步骤不可跳过。强制执行。**"
- 新增**完成标准** 9 项硬性指标，全部满足才算完成

### 2. `.claude/scenes/ui-polish.json` — 新增步骤和验证门禁

- 新增 step 7.5: `applyDaisyUIComponents`（DaisyUI 组件类注入）
- 新增 step 7.6: `removeHardcodedColors`（硬编码颜色清除）
- 新增 step 9.21-9.25: 5 个验证步骤（图标升级/组件类/动画/微交互/硬编码色）
- 新增 step 15.5: `completionGate` 完成标准门禁（9 项检查，不满足则循环修复）

## 验证方式

下次执行 `/ui-polish` 时，每个步骤完成后运行验证命令：
```bash
grep -rn "btn-primary\|card bg-base\|input-bordered" <组件目录> -l | wc -l  # 必须 > 0
grep -rn "material-icons" <组件目录> -l | wc -l  # 必须 = 0
grep -rn "#6366f1\|#4f46e5" <组件目录> -l | grep -v node_modules  # 必须为空
```

## 相关文件

- `E:\auto-coding\.claude\commands\ui-polish.md` — 命令规范（已重写，350行）
- `E:\auto-coding\.claude\scenes\ui-polish.json` — 场景定义（已更新，67步骤）
