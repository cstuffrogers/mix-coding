# Auto-Coding System (Codex)

## Workflow Commands

Execute workflows via Scene engine CLI:

    node E:\auto-coding\claude-scene\src\index.js start <scene> --auto

| Command | Scene | Description |
|---------|-------|-------------|
| `/audit` | audit | Full system health check |
| `/review` | review | 5-layer code review |
| `/feature` | feature | New feature development |
| `/bugfix` | bugfix | Bug fix workflow |
| `/check` | check | Engine self-check |
| `/hunt` | hunt | Security scan |
| `/qa` | qa | QA verification |

**Example:**

    node E:\auto-coding\claude-scene\src\index.js start audit --auto

## Reference

- Full guide: [AGENTS.md](../AGENTS.md)
- Scene engine: E:\auto-coding\claude-scene\src\index.js
