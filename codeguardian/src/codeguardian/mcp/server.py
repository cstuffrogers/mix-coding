"""MCP Server implementation for CodeGuardian.

Exposes tools to Claude Code and other MCP clients for safe code optimization.
"""

from __future__ import annotations

import json
import asyncio
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequestParams,
    ListToolsRequest,
    TextContent,
    Tool,
)

from codeguardian.core.config import GuardianConfig
from codeguardian.core.guardian import CodeGuardian
from codeguardian.core.result import OptimizationResult, OptimizationStatus


# === Tool Definitions ===

OPTIMIZE_TOOL = Tool(
    name="codeguardian_optimize",
    description="Submit optimized code for validation and review. IMPORTANT: This tool only accepts ONE optimization attempt per file. Do NOT call this tool multiple times for the same file in a loop. If the optimization is rejected, the original code is automatically restored. The optimization will be validated against: test suite (must pass all tests), performance benchmark (must show improvement), quality metrics (complexity, lines of code), physical boundaries (max tokens, max dependencies). If all checks pass, the optimization goes to human review. Use codeguardian_status to check review status.",
    inputSchema={
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Absolute path to the file to optimize"
            },
            "optimized_content": {
                "type": "string",
                "description": "The optimized code content"
            },
            "ai_model": {
                "type": "string",
                "description": "Name of the AI model used for optimization",
                "default": "unknown"
            },
            "optimization_prompt": {
                "type": "string",
                "description": "The prompt sent to the AI model",
                "default": ""
            }
        },
        "required": ["file_path", "optimized_content"]
    }
)

STATUS_TOOL = Tool(
    name="codeguardian_status",
    description="Check the status of an optimization request.",
    inputSchema={
        "type": "object",
        "properties": {
            "request_id": {
                "type": "string",
                "description": "The request ID returned by codeguardian_optimize"
            }
        },
        "required": ["request_id"]
    }
)

HISTORY_TOOL = Tool(
    name="codeguardian_history",
    description="Get optimization history for a file or all files.",
    inputSchema={
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Optional: filter by file path",
                "default": ""
            }
        }
    }
)

CONFIG_TOOL = Tool(
    name="codeguardian_config",
    description="View or update CodeGuardian configuration.",
    inputSchema={
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["view", "update"],
                "description": "View current config or update settings"
            },
            "settings": {
                "type": "object",
                "description": "New settings to apply (only for update action)",
                "properties": {
                    "min_performance_gain_percent": {"type": "number"},
                    "max_lines_delta": {"type": "integer"},
                    "max_complexity_increase": {"type": "number"},
                    "human_review_timeout_hours": {"type": "number"},
                }
            }
        },
        "required": ["action"]
    }
)

APPROVE_TOOL = Tool(
    name="codeguardian_approve",
    description="Approve an optimization after human review. IMPORTANT: This is a HUMAN-ONLY tool. AI agents should NOT call this tool. The human reviewer must: 1. Read the diff file, 2. Understand the changes, 3. Confirm the optimization is safe and correct, 4. Then call this tool with their approval.",
    inputSchema={
        "type": "object",
        "properties": {
            "request_id": {
                "type": "string",
                "description": "The request ID to approve"
            },
            "notes": {
                "type": "string",
                "description": "Review notes or comments",
                "default": ""
            }
        },
        "required": ["request_id"]
    }
)

REJECT_TOOL = Tool(
    name="codeguardian_reject",
    description="Reject an optimization and restore original code. IMPORTANT: This is a HUMAN-ONLY tool. AI agents should NOT call this tool. Use this when: the optimization is incorrect or unsafe, the performance gain is not worth the complexity, the code readability is significantly degraded, any other concerns about the optimization.",
    inputSchema={
        "type": "object",
        "properties": {
            "request_id": {
                "type": "string",
                "description": "The request ID to reject"
            },
            "notes": {
                "type": "string",
                "description": "Reason for rejection",
                "default": ""
            }
        },
        "required": ["request_id"]
    }
)


class CodeGuardianMCPServer:
    """MCP Server for CodeGuardian."""

    def __init__(self):
        self.config = GuardianConfig.from_env()
        self.guardian = CodeGuardian(self.config)
        self.server = Server(self.config.mcp_server_name)
        self._setup_handlers()

    def _setup_handlers(self) -> None:
        """Set up MCP request handlers."""

        @self.server.list_tools()
        async def handle_list_tools(request: ListToolsRequest) -> list[Tool]:
            return [
                OPTIMIZE_TOOL,
                STATUS_TOOL,
                HISTORY_TOOL,
                CONFIG_TOOL,
                APPROVE_TOOL,
                REJECT_TOOL,
            ]

        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
            try:
                if name == "codeguardian_optimize":
                    return await self._handle_optimize(arguments)
                elif name == "codeguardian_status":
                    return await self._handle_status(arguments)
                elif name == "codeguardian_history":
                    return await self._handle_history(arguments)
                elif name == "codeguardian_config":
                    return await self._handle_config(arguments)
                elif name == "codeguardian_approve":
                    return await self._handle_approve(arguments)
                elif name == "codeguardian_reject":
                    return await self._handle_reject(arguments)
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
            except Exception as e:
                return [TextContent(
                    type="text",
                    text=json.dumps({"error": str(e), "tool": name})
                )]

    async def _handle_optimize(self, args: dict[str, Any]) -> list[TextContent]:
        """Handle optimize tool call."""
        file_path = args["file_path"]
        optimized_content = args["optimized_content"]
        ai_model = args.get("ai_model", "unknown")
        optimization_prompt = args.get("optimization_prompt", "")

        result = self.guardian.optimize(
            file_path=file_path,
            optimized_content=optimized_content,
            ai_model=ai_model,
            optimization_prompt=optimization_prompt,
        )

        response = {
            "request_id": result.request_id,
            "status": result.status.value,
            "tests_passed": result.tests_passed,
            "performance_change": f"{result.performance.time_change_percent:+.1f}%",
            "complexity_change": f"{result.quality.complexity_change_percent:+.1f}%",
            "lines_delta": result.quality.lines_delta,
            "human_review_required": result.human_review_required,
            "diff_file": str(result.diff_file) if result.diff_file else None,
            "message": self._get_status_message(result),
        }

        return [TextContent(type="text", text=json.dumps(response, indent=2))]

    async def _handle_status(self, args: dict[str, Any]) -> list[TextContent]:
        """Handle status check."""
        request_id = args["request_id"]
        result = self.guardian._find_result(request_id)

        if not result:
            return [TextContent(type="text", text=f"Request {request_id} not found")]

        response = {
            "request_id": result.request_id,
            "status": result.status.value,
            "original_file": str(result.original_file),
            "tests_passed": result.tests_passed,
            "performance": {
                "original_time_ms": result.performance.original_time_ms,
                "optimized_time_ms": result.performance.optimized_time_ms,
                "change": f"{result.performance.time_change_percent:+.1f}%",
            },
            "quality": {
                "complexity": f"{result.quality.original_complexity} -> {result.quality.optimized_complexity}",
                "lines_delta": result.quality.lines_delta,
            },
            "review_status": {
                "required": result.human_review_required,
                "deadline": result.human_review_deadline.isoformat() if result.human_review_deadline else None,
                "decision": result.reviewer_decision or "pending",
            },
            "error": result.error_message or None,
        }

        return [TextContent(type="text", text=json.dumps(response, indent=2))]

    async def _handle_history(self, args: dict[str, Any]) -> list[TextContent]:
        """Handle history request."""
        file_path = args.get("file_path", "")
        history = self.guardian.history

        if file_path:
            history = [r for r in history if str(r.original_file) == file_path]

        response = [
            {
                "request_id": r.request_id,
                "timestamp": r.timestamp.isoformat(),
                "status": r.status.value,
                "file": str(r.original_file),
                "tests_passed": r.tests_passed,
                "performance_change": f"{r.performance.time_change_percent:+.1f}%",
            }
            for r in history
        ]

        return [TextContent(type="text", text=json.dumps(response, indent=2))]

    async def _handle_config(self, args: dict[str, Any]) -> list[TextContent]:
        """Handle config view/update."""
        action = args["action"]

        if action == "view":
            response = {
                "max_optimization_rounds": self.config.max_optimization_rounds,
                "min_performance_gain_percent": self.config.min_performance_gain_percent,
                "max_lines_delta": self.config.max_lines_delta,
                "max_complexity_increase": self.config.max_complexity_increase,
                "human_review_timeout_hours": self.config.human_review_timeout_hours,
                "auto_merge_after_timeout": self.config.auto_merge_after_timeout,
                "output_dir": str(self.config.output_dir),
            }
            return [TextContent(type="text", text=json.dumps(response, indent=2))]

        elif action == "update":
            settings = args.get("settings", {})
            # 只允许更新已知的安全字段
            allowed = {
                "min_performance_gain_percent": float,
                "max_lines_delta": int,
                "max_complexity_increase": float,
                "human_review_timeout_hours": float,
            }
            updated = []
            for key, value in settings.items():
                if key in allowed and hasattr(self.config, key):
                    try:
                        typed_value = allowed[key](value)
                        setattr(self.config, key, typed_value)
                        updated.append(key)
                    except (ValueError, TypeError):
                        return [TextContent(
                            type="text",
                            text=f"Invalid value for {key}: {value} (expected {allowed[key].__name__})"
                        )]

            if not updated:
                return [TextContent(type="text", text="No valid settings to update")]
            return [TextContent(
                type="text",
                text=f"Configuration updated: {', '.join(updated)}"
            )]

        return [TextContent(type="text", text="Invalid action")]

    async def _handle_approve(self, args: dict[str, Any]) -> list[TextContent]:
        """Handle approval (human-only)."""
        request_id = args["request_id"]
        notes = args.get("notes", "")

        result = self.guardian.approve(request_id, notes)
        if result:
            return [TextContent(type="text", text=f"Optimization {request_id} approved and merged.")]
        return [TextContent(type="text", text=f"Could not approve {request_id}")]

    async def _handle_reject(self, args: dict[str, Any]) -> list[TextContent]:
        """Handle rejection (human-only)."""
        request_id = args["request_id"]
        notes = args.get("notes", "")

        result = self.guardian.reject(request_id, notes)
        if result:
            return [TextContent(type="text", text=f"Optimization {request_id} rejected. Original code restored.")]
        return [TextContent(type="text", text=f"Could not reject {request_id}")]

    def _get_status_message(self, result: OptimizationResult) -> str:
        """Get human-readable status message."""
        if result.status == OptimizationStatus.NEEDS_REVIEW:
            return (
                f"Optimization passed all automatic checks. "
                f"Awaiting human review. Diff: {result.diff_file}"
            )
        elif result.status == OptimizationStatus.TESTS_FAILED:
            return f"Tests failed. Original code restored. Error: {result.error_message}"
        elif result.status == OptimizationStatus.TOO_COMPLEX:
            return f"Optimization rejected: {result.error_message}. Original code restored."
        elif result.status == OptimizationStatus.QUALITY_REGRESSION:
            return f"Quality regression detected: {result.error_message}. Original code restored."
        elif result.status == OptimizationStatus.ERROR:
            return f"System error: {result.error_message}. Original code restored."
        return result.status.value

    async def run(self) -> None:
        """Run the MCP server."""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options(),
            )


def main() -> None:
    """Entry point for MCP server. Safe to call inside or outside event loop."""
    server = CodeGuardianMCPServer()
    try:
        loop = asyncio.get_running_loop()
        # 已有事件循环时创建 task
        loop.create_task(server.run())
    except RuntimeError:
        asyncio.run(server.run())


if __name__ == "__main__":
    main()
