---
name: scene-runner
description: 执行 Mix-Coding System 工作流场景。当用户输入 /review、/feature、/bugfix、/refactor、/plan、/optimize、/ui-polish、/hunt、/release、/deps、/check、/qa、/new-project、/onboard、/cicd、/monitor、/rollback、/e2e、/loop、/spec、/plan-ceo-review、/mobile-* 等命令，或要求运行工作流/场景时使用。
---

# Scene Runner

通过 Scene 引擎 CLI 执行项目工作流。

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
| /hunt | hunt | 安全漏洞扫描 |
| /release | release | 发布部署 |
| /deps | deps | 依赖更新 |
| /check | check | 引擎自检 + 自愈 |
| /qa | qa | 浏览器 QA 验证 |
| /new-project | new-project | 新项目创建 |
| /onboard | onboard | 环境搭建 |
| /cicd | cicd | CI/CD 流水线 |
| /monitor | monitor | 监控配置 |
| /rollback | rollback | 紧急回滚 |
| /e2e | e2e | E2E 测试配置 |
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
| /simplify | /refactor | refactor 场景勾选"代码简化"模式 |
| /design | /ui-polish | 使用 ui-polish 场景 |
| /polish | /ui-polish | 使用 ui-polish 场景 |

## 用法

当用户调用场景命令（如 /review）时：

1. 按上表映射命令到场景名（旧命令走"已合并命令"映射）
2. 执行：
   `node E:\auto-coding\claude-scene\src\index.js start <scene>`
3. 可加 --auto 非交互模式
4. 向用户报告输出

## 示例

用户：/review

执行：
```
node E:\auto-coding\claude-scene\src\index.js start review --auto
```

用户：/audit（已合并）

执行：`node E:\auto-coding\claude-scene\src\index.js start review --auto`
并提示用户：/audit 已合并到 /review，请在交互菜单勾选"全量审计"模式。

## 引擎路径

默认：E:\auto-coding\claude-scene\src\index.js

若项目路径不同，相应调整路径。
