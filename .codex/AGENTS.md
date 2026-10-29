# Auto-Coding System (Codex)

## Workflow Commands

Execute workflows via Scene engine CLI:

    node E:\auto-coding\claude-scene\src\index.js start <scene> --auto

| Command | Scene | Description |
|---------|-------|-------------|
| `/review` | review | 5-layer code review (含 audit/analyze 模式) |
| `/feature` | feature | New feature development |
| `/bugfix` | bugfix | Bug fix workflow |
| `/refactor` | refactor | 代码重构 + 简化 |
| `/plan` | plan | Manus 持久规划 (会话恢复+SHA256) |
| `/check` | check | Engine self-check |
| `/setup` | setup | E2E / monitor 设施搭建（`--kind e2e\|monitor`，原 /e2e /monitor 已合并） |
| `/qa` | qa | QA verification |

**Example:**

    node E:\auto-coding\claude-scene\src\index.js start review --auto

## Reference

- Full guide: [AGENTS.md](../AGENTS.md)
- Scene engine: E:\auto-coding\claude-scene\src\index.js
