---
name: refactor-safely
description: Plan and execute safe refactoring using dependency analysis
---

## Refactor Safely

Use the knowledge graph to plan and execute refactoring with confidence.

## MCP vs CLI

本系统 light 模式(默认)不启用 `code-review-graph` MCP server。下方步骤写的是 MCP 工具调用;若 MCP server 未在线,用等价 CLI 命令(`uvx code-review-graph <cmd>`):

| MCP 工具 | CLI 等价 |
|----------|----------|
| `refactor_tool(mode="suggest"/"dead_code"/"rename")` | `uvx code-review-graph refactor --mode <m>` |
| `apply_refactor_tool(refactor_id)` | `uvx code-review-graph refactor --apply <id>` |
| `detect_changes_tool` | `uvx code-review-graph detect-changes` |
| `get_impact_radius_tool` | `uvx code-review-graph impact` |
| `get_affected_flows_tool` | `uvx code-review-graph flows` |
| `find_large_functions` | `uvx code-review-graph large-functions` |

图库存于 `.code-review-graph/graph.db`,CLI 命令直接读库,无需 server 在线。

### Steps

1. Use `refactor_tool` with mode="suggest" for community-driven refactoring suggestions.
2. Use `refactor_tool` with mode="dead_code" to find unreferenced code.
3. For renames, use `refactor_tool` with mode="rename" to preview all affected locations.
4. Use `apply_refactor_tool` with the refactor_id to apply renames.
5. After changes, run `detect_changes_tool` to verify the refactoring impact.

### Safety Checks

- Always preview before applying (rename mode gives you an edit list).
- Check `get_impact_radius_tool` before major refactors.
- Use `get_affected_flows_tool` to ensure no critical paths are broken.
- Run `find_large_functions` to identify decomposition targets.

## Token Efficiency Rules
- ALWAYS start with `get_minimal_context(task="<your task>")` before any other graph tool.
- Use `detail_level="minimal"` on all calls. Only escalate to "standard" when minimal is insufficient.
- Target: complete any review/debug/refactor task in ≤5 tool calls and ≤800 total output tokens.
