# 项目架构

> 自动生成于 2026-06-05

## 技术栈

- 待补充

## 目录结构

```
ARCHITECTURE.md
Archon-dev/
  Archon-dev/
    assets/
      logo.png
    auth-service/
      bun.lock
      Dockerfile
      package.json
      server.js
      test.js
    bun.lock
    bunfig.toml
    Caddyfile.example
    CHANGELOG.md
    CLAUDE.md
    CONTRIBUTING.md
    deploy/
      cloud-init.yml
      docker-compose.override.example.yml
      docker-compose.yml
      Dockerfile.user.example
    docker-compose.override.example.yml
    docker-compose.yml
    docker-entrypoint.sh
    Dockerfile
    Dockerfile.user.example
    eslint.config.mjs
    examples/
      workflows/
    global.d.ts
    homebrew/
      archon.rb
    LICENSE
    migrations/
      000_combined.sql
      001_initial_schema.sql
      002_command_templates.sql
      003_add_worktree.sql
      004_worktree_sharing.sql
      005_isolation_abstraction.sql
      006_isolation_environments.sql
      007_drop_legacy_columns.sql
      008_workflow_runs.sql
      009_workflow_last_activity.sql
      010_immutable_sessions.sql
      011_partial_unique_constraint.sql
      012_workflow_events.sql
      013_conversation_titles.sql
      014_message_history.sql
      015_background_dispatch.sql
      016_session_ended_reason.sql
      017_drop_command_templates.sql
      018_fix_workflow_status_default.sql
      019_workflow_resume_path.sql
      020_codebase_env_vars.sql
      021_add_allow_env_keys_to_codebases.sql
    package.json
    packages/
      adapters/
      cli/
      core/
      docs-web/
      git/
      isolation/
      paths/
      providers/
      server/
      web/
      workflows/
    README.md
    scripts/
      build-binaries.sh
      check-bundled-skill.ts
      checksums.sh
      generate-bundled-defaults.ts
      install.ps1
      install.sh
      sync-versions.sh
      tsconfig.json
```

## 核心依赖

- `animal-island-ui`
- `@playwright/test`
- `@eslint/js`
- `animate.css`
- `claude-mem`
- `daisyui`
- `eslint`
- `lucide-react`
- `react`
- `react-dom`
- `tailwindcss`
- `vitest`

## 模块说明

<!-- TODO: 补充各模块职责和数据流向 -->

## 数据流

<!-- TODO: 补充核心数据流图（请求 → 路由 → 服务 → 数据层 → 响应） -->

## 编码规范

详见 `CLAUDE.md` 和 `.claude/rules/` 目录。

## 工作流

本项目使用 mix-coding 系统，支持 28 个自动化工作流。详见 `CLAUDE.md`。

## 报告产物契约（engine ↔ agent）

引擎不直接调 MCP（`codegraph_impact` 等在图能力上是桩），真正的图查询/测试明细由
agent 侧完成并落盘成产物，引擎只**消费产物 + 记账**。所有产物写在 `.claude/reports/`
（已 gitignore）。

| 产物 | 谁写 | 形状 | 引擎读取方 | 缺失时 |
|---|---|---|---|---|
| `impact-<stamp>.json` | agent（`mcp__codegraph__*` 查询后） | `{ changedFiles: string[], callers: string[], riskLevel: 'low'\|'medium'\|'high' }` | `impactReport` | `warn`「修复范围未评估」（不阻断） |
| `fence-<stamp>.json` | `fenceCapture` | `{ stamp, targetPath, snapshotSha, restoreBase, testCount, passed, failed, tests }` | `fenceVerify` / `fenceRestore` | `skip`（拿不到明细就不动手） |
| `aislop-<stamp>.json` | `aislop` handler | aislop 原始 findings | `aislop-fix` | `skip` |

要点：

- **产物优先于推断**：有逐条明细就只信明细，不用文本正则猜「跑没跑成」
  （JSON 里本来就可能出现 `Cannot find module` 这种被测试断言的字符串）。
- **围栏只保护已有测试覆盖的行为**。未被测试覆盖的改动，围栏给不了安全感——
  不要把它当全覆盖。
- 围栏回滚只碰**已跟踪的改动文件**：`??` 未跟踪文件、`node_modules/`、
  `.claude/reports/` 一律不碰，且先 `git cat-file -e` 确认路径在快照里。
