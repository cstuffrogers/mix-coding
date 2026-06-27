"""Command-line interface for CodeGuardian."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from codeguardian.core.config import GuardianConfig
from codeguardian.core.guardian import CodeGuardian
from codeguardian.core.result import OptimizationResult

console = Console()


@click.group()
@click.option("--config", "-c", type=click.Path(), help="Path to config file")
@click.option("--output-dir", "-o", type=click.Path(), help="Output directory")
@click.pass_context
def main(ctx: click.Context, config: str | None, output_dir: str | None) -> None:
    """CodeGuardian - AI Code Optimization Guardian.

    Prevent over-optimization and negative optimization in AI-assisted code refactoring.
    """
    # Load configuration
    if config:
        cfg = GuardianConfig.from_file(config)
    else:
        cfg = GuardianConfig.from_env()

    if output_dir:
        cfg.output_dir = Path(output_dir)

    ctx.ensure_object(dict)
    ctx.obj["config"] = cfg
    ctx.obj["guardian"] = CodeGuardian(cfg)


@main.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.argument("optimized_file", type=click.Path(exists=True))
@click.option("--model", "-m", default="unknown", help="AI model used")
@click.option("--prompt", "-p", default="", help="Optimization prompt")
@click.pass_context
def optimize(
    ctx: click.Context,
    file_path: str,
    optimized_file: str,
    model: str,
    prompt: str,
) -> None:
    """Submit an optimized file for validation.

    FILE_PATH: Path to the original file
    OPTIMIZED_FILE: Path to the AI-generated optimized version
    """
    guardian: CodeGuardian = ctx.obj["guardian"]

    optimized_content = Path(optimized_file).read_text()

    result = guardian.optimize(
        file_path=file_path,
        optimized_content=optimized_content,
        ai_model=model,
        optimization_prompt=prompt,
    )

    _display_result(result)


@main.command()
@click.argument("request_id")
@click.pass_context
def status(ctx: click.Context, request_id: str) -> None:
    """Check optimization status."""
    guardian: CodeGuardian = ctx.obj["guardian"]
    result = guardian._find_result(request_id)

    if not result:
        console.print(f"[red]Request {request_id} not found[/red]")
        sys.exit(1)

    _display_result(result)


@main.command()
@click.argument("request_id")
@click.option("--notes", "-n", default="", help="Review notes")
@click.pass_context
def approve(ctx: click.Context, request_id: str, notes: str) -> None:
    """Approve an optimization (human only)."""
    guardian: CodeGuardian = ctx.obj["guardian"]
    result = guardian.approve(request_id, notes)

    if result:
        console.print(f"[green]Approved: {request_id}[/green]")
    else:
        console.print(f"[red]Failed to approve: {request_id}[/red]")
        sys.exit(1)


@main.command()
@click.argument("request_id")
@click.option("--notes", "-n", default="", help="Rejection reason")
@click.pass_context
def reject(ctx: click.Context, request_id: str, notes: str) -> None:
    """Reject an optimization and restore original (human only)."""
    guardian: CodeGuardian = ctx.obj["guardian"]
    result = guardian.reject(request_id, notes)

    if result:
        console.print(f"[yellow]Rejected: {request_id}[/yellow]")
    else:
        console.print(f"[red]Failed to reject: {request_id}[/red]")
        sys.exit(1)


@main.command()
@click.option("--file", "-f", type=click.Path(), help="Filter by file path")
@click.pass_context
def history(ctx: click.Context, file: str | None) -> None:
    """Show optimization history."""
    guardian: CodeGuardian = ctx.obj["guardian"]

    results = guardian.history
    if file:
        results = [r for r in results if str(r.original_file) == file]

    if not results:
        console.print("[dim]No optimization history found[/dim]")
        return

    table = Table(title="Optimization History")
    table.add_column("Request ID", style="cyan")
    table.add_column("File", style="green")
    table.add_column("Status", style="yellow")
    table.add_column("Performance", justify="right")
    table.add_column("Tests", justify="center")

    for r in results:
        status_color = {
            "approved": "green",
            "merged": "green",
            "needs_review": "yellow",
            "rejected": "red",
            "tests_failed": "red",
            "error": "red",
        }.get(r.status.value, "white")

        table.add_row(
            r.request_id,
            str(r.original_file),
            f"[{status_color}]{r.status.value}[/{status_color}]",
            f"{r.performance.time_change_percent:+.1f}%",
            "PASS" if r.tests_passed else "FAIL",
        )

    console.print(table)


@main.command()
@click.pass_context
def config(ctx: click.Context) -> None:
    """Show current configuration."""
    cfg: GuardianConfig = ctx.obj["config"]

    table = Table(title="CodeGuardian Configuration")
    table.add_column("Setting", style="cyan")
    table.add_column("Value", style="green")

    settings = [
        ("Max Optimization Rounds", cfg.max_optimization_rounds),
        ("Max Tokens", cfg.max_tokens_per_optimization),
        ("Max Time (s)", cfg.max_time_seconds),
        ("Max Lines Delta", cfg.max_lines_delta),
        ("Max Dependencies", cfg.max_dependencies),
        ("Min Performance Gain %", cfg.min_performance_gain_percent),
        ("Max Memory Increase %", cfg.max_memory_increase_percent),
        ("Max Complexity Increase", cfg.max_complexity_increase),
        ("Min Test Coverage %", cfg.min_test_coverage_percent),
        ("Review Timeout (h)", cfg.human_review_timeout_hours),
        ("Auto Merge After Timeout", cfg.auto_merge_after_timeout),
        ("Output Directory", str(cfg.output_dir)),
    ]

    for key, value in settings:
        table.add_row(key, str(value))

    console.print(table)


@main.command()
@click.argument("path", type=click.Path())
@click.pass_context
def init(ctx: click.Context, path: str) -> None:
    """Initialize CodeGuardian in a project.

    Creates default configuration file.
    """
    config_path = Path(path) / ".codeguardian.yaml"
    cfg = GuardianConfig()
    cfg.to_file(config_path)

    console.print(f"[green]Created config: {config_path}[/green]")
    console.print("[dim]Edit this file to customize guardrails[/dim]")


def _display_result(result: OptimizationResult) -> None:
    """Display optimization result in rich format."""
    # Status color
    status_colors = {
        "approved": "green",
        "merged": "green",
        "needs_review": "yellow",
        "rejected": "red",
        "tests_failed": "red",
        "too_complex": "red",
        "quality_regression": "red",
        "error": "red",
    }
    color = status_colors.get(result.status.value, "white")

    # Main panel
    title = Text(f"Optimization Result: {result.request_id}", style="bold")
    status_text = Text(result.status.value.upper(), style=f"bold {color}")

    content = f"""
[bold]File:[/bold] {result.original_file}
[bold]Status:[/bold] {status_text}

[bold]Performance:[/bold]
  Original: {result.performance.original_time_ms:.2f}ms
  Optimized: {result.performance.optimized_time_ms:.2f}ms
  Change: {result.performance.time_change_percent:+.1f}%

[bold]Quality:[/bold]
  Complexity: {result.quality.original_complexity} -> {result.quality.optimized_complexity}
  Lines: {result.quality.original_lines} -> {result.quality.optimized_lines} ({result.quality.lines_delta:+d})
  New Dependencies: {', '.join(result.quality.new_dependencies) or 'None'}

[bold]Tests:[/bold] {'[green]PASSED[/green]' if result.tests_passed else '[red]FAILED[/red]'}

[bold]Review:[/bold] {'[yellow]Required[/yellow]' if result.human_review_required else '[green]Not Required[/green]'}
    """

    if result.diff_file:
        content += f"\n[bold]Diff:[/bold] {result.diff_file}"

    if result.error_message:
        content += f"\n[bold red]Error:[/bold red] {result.error_message}"

    console.print(Panel(content, title=title))

    # Action guidance
    if result.status.value == "needs_review":
        console.print("\n[bold yellow]Next Steps:[/bold yellow]")
        console.print("1. Review the diff file")
        console.print("2. Run your own tests if needed")
        console.print(f"3. Approve: [bold]cg approve {result.request_id}[/bold]")
        console.print(f"   Reject:  [bold]cg reject {result.request_id}[/bold]")
    elif result.status.value == "tests_failed":
        console.print("\n[red]Original code has been restored.[/red]")


if __name__ == "__main__":
    main()
