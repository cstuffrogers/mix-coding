---
name: scene-runner
description: 执行 Mix-Coding System 工作流场景。当用户输入 /review、/feature、/bugfix、/refactor、/plan、/optimize、/ui-polish、/release、/deps、/check、/qa、/new-project、/onboard、/cicd、/setup、/rollback、/loop、/spec、/plan-ceo-review、/mobile-* 等命令，或要求运行工作流/场景时使用。
---

# Scene Runner

通过 Scene 引擎 CLI 执行项目工作流。适用于 pi CLI 与 percho 桌面端。

## 可用场景

| 命令 | 场景 | 说明 |
|---------|-------|-------------|
| /review | review | 5 层代码审查（含 audit/analyze 模式） |
| /feature | feature | 新功能开发 |
| /bugfix | bugfix | Bug 修复 |
| /refactor | refactor | 代码重构 + 简化 + 架构优化 |
| /plan | plan | Manus 持久规划（会话恢复+SHA256） |
| /optimize | optimize | 性能优化 |
| /ui-polish | ui-polish | 前端美化 |
| /release | release | 发布部署 |
| /deps | deps | 依赖更新 |
| /check | check | 引擎自检 + 自愈 |
| /qa | qa | 浏览器 QA 验证 |
| /new-project | new-project | 新项目创建 |
| /onboard | onboard | 环境搭建 |
| /cicd | cicd | CI/CD 流水线 |
| /rollback | rollback | 紧急回滚 |
| /setup | setup | 测试/监控设施搭建 |
| /loop | loop | 自动迭代循环 |
| /spec | analyze | Spec-Driven 开发 |
| /plan-ceo-review | plan-ceo-review | 创始人策略审查 |
| /mobile-review | mobile-review | 移动端代码审查 |
| /mobile-audit | mobile-audit | 移动端审计 |
| /mobile-e2e | mobile-e2e | 移动端 E2E |
| /mobile-onboard | mobile-onboard | 移动端环境搭建 |
| /mobile-optimize | mobile-optimize | 移动端性能优化 |
| /mobile-release | mobile-release | 移动端发布 |

## 已合并命令（旧命令 → 新命令）

用户输入旧命令时，映射到新命令执行：

| 旧命令 | 新命令 | 说明 |
|--------|--------|------|
| /audit | /review | review 场景勾选"全量审计"模式 |
| /analyze | /review | review 场景勾选"仅分析"模式 |
| /hunt | /review | 安全已并入 review 的 security_deep 模式（默认开启） |
| /simplify | /refactor | refactor 场景勾选"代码简化"模式 |
| /design | /ui-polish | 使用 ui-polish 场景 |
| /polish | /ui-polish | 使用 ui-polish 场景 |
| /e2e | /setup | setup 场景，kind 选 e2e（默认） |
| /monitor | /setup | setup 场景，kind 选 monitor |

## 用法

当用户调用场景命令（如 /review）时：

1. 按上表映射命令到场景名（旧命令走"已合并命令"映射）
2. 在**当前工作目录**直接执行：
   `claude-scene start <scene> --auto`
3. 可加 `--target <路径>` 审查其他目录；`--dry-run` 只看不执行
4. 向用户报告输出

## 示例

用户：/review

执行：
```
claude-scene start review --auto
```

用户：/audit（已合并）

执行：`claude-scene start review --auto`
并提示用户：/audit 已合并到 /review，请在交互菜单勾选"全量审计"模式。

## 引擎

`claude-scene` 是全局命令（npm link / npm i -g 安装）。
目标项目默认为当前目录，可用 `--target` 或 `MIX_CODING_PROJECT_DIR` 覆盖。

若提示 command not found，说明引擎未全局安装：
```
cd <引擎仓库>/claude-scene && npm link
```

场景数据随引擎包分发；项目若有 `.claude/scenes/<name>.json` 会覆盖同名的内置场景。
