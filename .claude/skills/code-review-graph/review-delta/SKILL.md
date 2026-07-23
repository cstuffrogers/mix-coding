---
name: review-delta
description: Review only changes since last commit using impact analysis. Token-efficient delta review with automatic blast-radius detection.
argument-hint: "[file or function name]"
---

# Review Delta

Perform a focused, token-efficient code review of only the changed code and its blast radius.

**Token optimization:** Before starting, call `get_docs_section_tool(section_name="review-delta")` for the optimized workflow. Use ONLY changed nodes + 2-hop neighbors in context.

## MCP vs CLI

本系统 light 模式(默认)不启用 `code-review-graph` MCP server。下方步骤写的是 MCP 工具调用;若 MCP server 未在线,用等价 CLI 命令(`uvx code-review-graph <cmd>`)拿到同样结果:

| MCP 工具 | CLI 等价 |
|----------|----------|
| `build_or_update_graph_tool()` | `uvx code-review-graph update` (增量) / `build` (全量) |
| `get_review_context_tool()` | `uvx code-review-graph detect-changes` + `impact` |
| `query_graph_tool(pattern=...)` | `uvx code-review-graph query --pattern <p> --target <t>` |
| `get_impact_radius_tool()` | `uvx code-review-graph impact` |

图库存于 `.code-review-graph/graph.db`,CLI 命令直接读库,无需 server 在线。

## Steps

1. **Ensure the graph is current** by calling `build_or_update_graph_tool()` (incremental update).

2. **Get review context** by calling `get_review_context_tool()`. This returns:
   - Changed files (auto-detected from git diff)
   - Impacted nodes and files (blast radius)
   - Source code snippets for changed areas
   - Review guidance (test coverage gaps, wide impact warnings, inheritance concerns)

3. **Analyze the blast radius** by reviewing the `impacted_nodes` and `impacted_files` in the context. Focus on:
   - Functions whose callers changed (may need signature/behavior verification)
   - Classes with inheritance changes (Liskov substitution concerns)
   - Files with many dependents (high-risk changes)

4. **Perform the review** using the context. For each changed file:
   - Review the source snippet for correctness, style, and potential bugs
   - Check if impacted callers/dependents need updates
   - Verify test coverage using `query_graph_tool(pattern="tests_for", target=<function_name>)`
   - Flag any untested changed functions

5. **Report findings** in a structured format:
   - **Summary**: One-line overview of the changes
   - **Risk level**: Low / Medium / High (based on blast radius)
   - **Issues found**: Bugs, style issues, missing tests
   - **Blast radius**: List of impacted files/functions
   - **Recommendations**: Actionable suggestions

## Advantages Over Full-Repo Review

- Only sends changed + impacted code to the model (5-10x fewer tokens)
- Automatically identifies blast radius without manual file searching
- Provides structural context (who calls what, inheritance chains)
- Flags untested functions automatically
