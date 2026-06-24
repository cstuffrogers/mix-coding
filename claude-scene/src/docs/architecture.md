# 项目架构

> 自动生成于 2026-06-13

## 技术栈

- 待补充

## 目录结构

```
actions.js
actions.test.js
commands/
  fork.js
  list.js
  show.js
  start.js
data/
  action-messages.js
  gate-flags.js
  sync-docs-config.js
docs/
  CHANGELOG.md
handlers/
  api/
    frontend-detect.js
    pipeline.js
    spec-utils.js
  api-consistency.js
  backup.js
  backup.test.js
  changelog.js
  changelog.test.js
  cicd.js
  cicd.test.js
  code-metrics.js
  deps.js
  design.js
  docker.js
  docker.test.js
  docs.js
  e2e.js
  e2e.test.js
  external-tool-checks.js
  flow-control.js
  flow-control.test.js
  git.js
  handler-verify.js
  i18n.js
  incident.js
  incident.test.js
  issues.js
  lighthouse.js
  logging.js
  logging.test.js
  memory/
    agentmemory.js
    claude-mem.js
    codegraph.js
    nexo.js
    project-memory.js
    supermemory.js
  memory.js
  memory.test.js
  migration.js
  migration.test.js
  mobile/
    agent.js
    audit.js
    optimize.js
  mobile-onboard.js
  mobile-release.js
  mobile-testing.js
  mobile.js
  monitor.js
  monitor.test.js
  open-redirect.js
  prerequisites.js
  quality.js
  review.js
  sbom.js
  sbom.test.js
  security/
    config-check.js
```

## 核心依赖

待补充

## 模块说明

| 目录 | 职责 |
|------|------|
| `src/commands/` | CLI 命令入口（list/start/show/fork） |
| `src/handlers/` | Action 处理器（安全/性能/文档/审计/流程控制等） |
| `src/lib/` | 共享库（代码分析/条件评估/增强选择/文档同步） |
| `src/data/` | 配置常量（Action 消息/场景标签/门禁标志） |

## 数据流

CLI 命令 → Commander 解析参数 → `commands/start.js` 加载场景 JSON → `actions.js` 分发到 handler → handler 执行并更新 context → 质量门禁检查 → 通知完成

## 编码规范

详见 `CLAUDE.md` 和 `.claude/rules/` 目录。

## 工作流

本项目使用 mix-coding 系统，支持 28 个自动化工作流。详见 `CLAUDE.md`。
