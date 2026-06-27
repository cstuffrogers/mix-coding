"""Core optimization guardian engine."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import uuid
from pathlib import Path

import git
from git.exc import InvalidGitRepositoryError
from rich.console import Console

from codeguardian.core.config import GuardianConfig
from codeguardian.core.result import (
    OptimizationResult,
    OptimizationStatus,
    PerformanceMetrics,
    QualityMetrics,
)

console = Console()


class CodeGuardian:
    """Main guardian engine for AI code optimization.

    Core philosophy: Optimize once, verify rigorously, human decides.
    No automatic iterative optimization.
    """

    def __init__(self, config: GuardianConfig | None = None):
        self.config = config or GuardianConfig.from_env()
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        self._history: list[OptimizationResult] = []

    def optimize(
        self,
        file_path: str | Path,
        optimized_content: str,
        ai_model: str = "unknown",
        optimization_prompt: str = "",
    ) -> OptimizationResult:
        """Process a single optimization attempt.

        This is the ONLY entry point. No loops, no retries.

        Args:
            file_path: Path to the original file
            optimized_content: AI-generated optimized code
            ai_model: Name of the AI model used
            optimization_prompt: The prompt sent to the AI

        Returns:
            OptimizationResult with full validation results
        """
        request_id = str(uuid.uuid4())[:8]
        result = OptimizationResult(
            request_id=request_id,
            original_file=Path(file_path),
            ai_model=ai_model,
            optimization_prompt=optimization_prompt,
        )

        console.print(f"[bold blue]CodeGuardian[/bold blue] Processing optimization {request_id}")

        # === PHASE 1: 物理边界检查 ===
        if not self._check_physical_boundaries(optimized_content, result):
            return result

        # === PHASE 2: 备份原始代码 ===
        backup_path = self._backup_original(file_path)

        # === PHASE 3: 写入优化版 ===
        optimized_path = self._write_optimized(file_path, optimized_content)
        result.optimized_file = optimized_path

        try:
            # === PHASE 4: 运行测试 ===
            if not self._run_tests(result):
                self._restore_original(file_path, backup_path)
                return result

            # === PHASE 5: 性能基准测试 ===
            if not self._run_benchmark(result):
                self._restore_original(file_path, backup_path)
                return result

            # === PHASE 6: 质量检查 ===
            if not self._check_quality(result):
                self._restore_original(file_path, backup_path)
                return result

            # === PHASE 7: 生成 diff ===
            self._generate_diff(result)

            # === PHASE 8: 决策 ===
            self._make_decision(result)

        except Exception as e:
            result.status = OptimizationStatus.ERROR
            result.error_message = str(e)
            self._restore_original(file_path, backup_path)
            console.print(f"[red]Error during optimization: {e}[/red]")

        finally:
            # 清理备份
            if backup_path.exists():
                backup_path.unlink()

            self._save_result(result)
            self._history.append(result)

        console.print(result.summary)
        return result

    def _check_physical_boundaries(
        self,
        content: str,
        result: OptimizationResult
    ) -> bool:
        """Check hard physical boundaries before any execution."""
        lines = content.splitlines()
        line_count = len(lines)

        # 检查 token 估算（粗略：1 token ≈ 4 chars）
        estimated_tokens = len(content) // 4
        if estimated_tokens > self.config.max_tokens_per_optimization:
            result.status = OptimizationStatus.TOO_COMPLEX
            result.error_message = (
                f"Optimized code too large: ~{estimated_tokens} tokens "
                f"(max {self.config.max_tokens_per_optimization})"
            )
            console.print(f"[red]{result.error_message}[/red]")
            return False

        # 检查依赖引入（对比原文件）
        original_content = self._get_original_content(result.original_file)
        new_imports = self._detect_new_dependencies(content, original_content)
        if len(new_imports) > self.config.max_dependencies:
            result.status = OptimizationStatus.TOO_COMPLEX
            result.error_message = (
                f"Too many new dependencies: {new_imports} "
                f"(max {self.config.max_dependencies})"
            )
            console.print(f"[red]{result.error_message}[/red]")
            return False

        result.quality.new_dependencies = new_imports
        console.print("[green]  Physical boundaries check passed[/green]")
        return True

    def _detect_new_dependencies(self, content: str, original_content: str = "") -> list[str]:
        """Detect genuinely new imports compared to original file."""
        stdlib = {
            "os", "sys", "json", "time", "math", "random", "typing", "pathlib",
            "re", "abc", "argparse", "asyncio", "base64", "collections", "contextlib",
            "copy", "csv", "dataclasses", "datetime", "decimal", "enum", "fnmatch",
            "functools", "gc", "glob", "hashlib", "heapq", "html", "http",
            "importlib", "inspect", "io", "itertools", "logging", "operator",
            "pickle", "platform", "pprint", "queue", "shutil", "signal", "socket",
            "sqlite3", "ssl", "statistics", "string", "struct", "subprocess",
            "tempfile", "textwrap", "threading", "tokenize", "traceback", "types",
            "unittest", "urllib", "uuid", "warnings", "weakref", "xml", "zipfile",
        }

        def _extract_imports(source: str) -> set[str]:
            modules: set[str] = set()
            for line in source.splitlines():
                stripped = line.strip()
                if stripped.startswith("import "):
                    parts = stripped[len("import "):].split("#")[0]
                    for segment in parts.split(","):
                        mod = segment.strip().split()[0].split(".")[0]
                        if mod:
                            modules.add(mod)
                elif stripped.startswith("from "):
                    rest = stripped[len("from "):]
                    mod_part = rest.split()[0]
                    # 跳过相对导入 (from . import ... / from ..foo import ...)
                    if not mod_part.lstrip("."):
                        continue
                    mod = mod_part.split(".")[0]
                    if mod:
                        modules.add(mod)
            return modules

        orig_imports = _extract_imports(original_content) if original_content else set()
        opt_imports = _extract_imports(content)

        truly_new = [m for m in opt_imports if m not in orig_imports and m not in stdlib]
        return sorted(set(truly_new))

    def _backup_original(self, file_path: str | Path) -> Path:
        """Create backup of original file."""
        path = Path(file_path)
        backup = path.with_suffix(path.suffix + ".cgbackup")
        shutil.copy2(path, backup)
        console.print(f"[dim]Backup created: {backup}[/dim]")
        return backup

    def _write_optimized(
        self,
        file_path: str | Path,
        content: str
    ) -> Path:
        """Write optimized content to file."""
        path = Path(file_path)
        path.write_text(content, encoding="utf-8")
        console.print(f"[dim]Optimized code written to: {path}[/dim]")
        return path

    def _restore_original(self, file_path: str | Path, backup_path: Path) -> None:
        """Restore original file from backup."""
        shutil.copy2(backup_path, file_path)
        console.print(f"[yellow]Original restored from backup[/yellow]")

    def _run_tests(self, result: OptimizationResult) -> bool:
        """Run test suite against optimized code.

        Detects project root by searching for common marker files
        (package.json, pyproject.toml, setup.py, Makefile) up the directory tree.
        Falls back to the file's parent directory.
        """
        console.print("[bold]Running tests...[/bold]")

        try:
            # 查找项目根目录
            cwd = self._find_project_root(result.original_file)
            console.print(f"[dim]  Project root: {cwd}[/dim]")

            proc = subprocess.run(
                self.config.test_command.split(),
                capture_output=True,
                text=True,
                timeout=self.config.max_time_seconds,
                cwd=cwd,
            )

            result.test_output = proc.stdout + proc.stderr
            result.tests_passed = proc.returncode == 0

            if not result.tests_passed:
                result.status = OptimizationStatus.TESTS_FAILED
                console.print(f"[red]  Tests FAILED[/red]")
                console.print(f"[dim]{result.test_output[:500]}[/dim]")
                return False

            console.print("[green]  All tests passed[/green]")
            return True

        except subprocess.TimeoutExpired:
            result.status = OptimizationStatus.TIMEOUT
            result.error_message = f"Tests timed out after {self.config.max_time_seconds}s"
            console.print(f"[red]{result.error_message}[/red]")
            return False
        except Exception as e:
            result.status = OptimizationStatus.ERROR
            result.error_message = f"Test execution failed: {e}"
            console.print(f"[red]{result.error_message}[/red]")
            return False

    @staticmethod
    def _find_project_root(file_path: Path) -> Path:
        """Walk up from file_path to find project root by marker files."""
        markers = ("package.json", "pyproject.toml", "setup.py", "Makefile", "Cargo.toml")
        current = file_path.parent.resolve()
        for _ in range(10):  # 最多上溯10层
            for marker in markers:
                if (current / marker).exists():
                    return current
            parent = current.parent
            if parent == current:
                break
            current = parent
        return file_path.parent.resolve()

    def _run_benchmark(self, result: OptimizationResult) -> bool:
        """Run performance benchmark comparing original vs optimized.

        Uses actual execution timing via subprocess + time.perf_counter.
        Falls back to complexity-based proxy if code can't be run standalone.
        """
        console.print("[bold]Running benchmark...[/bold]")

        try:
            original_content = self._get_original_content(result.original_file)
            optimized_content = result.optimized_file.read_text()

            # 更新行数和复杂度指标
            result.quality.original_lines = len(original_content.splitlines())
            result.quality.optimized_lines = len(optimized_content.splitlines())
            result.quality.lines_delta = (
                result.quality.optimized_lines - result.quality.original_lines
            )

            orig_complexity = self._calculate_complexity(original_content)
            opt_complexity = self._calculate_complexity(optimized_content)
            result.quality.original_complexity = orig_complexity
            result.quality.optimized_complexity = opt_complexity
            result.quality.complexity_change_percent = (
                (opt_complexity - orig_complexity) / max(orig_complexity, 1) * 100
            )

            # 尝试实际执行计时
            original_time = self._time_execution(original_content, result.original_file)
            optimized_time = self._time_execution(optimized_content, result.original_file)

            if original_time is not None and optimized_time is not None:
                result.performance.original_time_ms = original_time * 1000
                result.performance.optimized_time_ms = optimized_time * 1000
                if original_time > 0:
                    result.performance.time_change_percent = (
                        (optimized_time - original_time) / original_time * 100
                    )
            else:
                # 无法计时时回退到复杂度代理
                result.performance.original_time_ms = float(orig_complexity)
                result.performance.optimized_time_ms = float(opt_complexity)
                if orig_complexity > 0:
                    result.performance.time_change_percent = (
                        (opt_complexity - orig_complexity) / orig_complexity * 100
                    )
                console.print("[dim]  (complexity proxy — code not runnable standalone)[/dim]")

            # 检查行数变化
            if abs(result.quality.lines_delta) > self.config.max_lines_delta:
                result.status = OptimizationStatus.TOO_COMPLEX
                result.error_message = (
                    f"Code changed by {result.quality.lines_delta} lines "
                    f"(max allowed: ±{self.config.max_lines_delta})"
                )
                console.print(f"[red]{result.error_message}[/red]")
                return False

            # 检查复杂度增长
            if result.quality.complexity_change_percent > 0:
                ratio = (100 + result.quality.complexity_change_percent) / 100
                if ratio > self.config.max_complexity_increase:
                    result.status = OptimizationStatus.QUALITY_REGRESSION
                    result.error_message = (
                        f"Complexity increased by {result.quality.complexity_change_percent:.1f}% "
                        f"(max allowed: {(self.config.max_complexity_increase - 1) * 100:.0f}%)"
                    )
                    console.print(f"[red]{result.error_message}[/red]")
                    return False

            # 检查性能回退
            if result.performance.time_change_percent > 0 and original_time is not None:
                console.print(
                    f"[yellow]  Performance regression: "
                    f"{result.performance.time_change_percent:+.1f}%[/yellow]"
                )

            console.print("[green]  Benchmark passed[/green]")
            console.print(
                f"[dim]  Time: {result.performance.original_time_ms:.2f}ms -> "
                f"{result.performance.optimized_time_ms:.2f}ms "
                f"({result.performance.time_change_percent:+.1f}%)[/dim]"
            )
            console.print(
                f"[dim]  Complexity: {orig_complexity} -> {opt_complexity} "
                f"({result.quality.complexity_change_percent:+.1f}%)[/dim]"
            )
            console.print(
                f"[dim]  Lines: {result.quality.original_lines} -> "
                f"{result.quality.optimized_lines} ({result.quality.lines_delta:+d})[/dim]"
            )
            return True

        except Exception as e:
            result.status = OptimizationStatus.ERROR
            result.error_message = f"Benchmark failed: {e}"
            console.print(f"[red]{result.error_message}[/red]")
            return False

    def _time_execution(self, content: str, file_path: Path) -> float | None:
        """Time execution of Python code via subprocess. Returns seconds or None."""
        try:
            tmp = file_path.parent / f"_cg_bench_{hashlib.md5(content.encode()).hexdigest()[:8]}.py"
            tmp.write_text(content, encoding="utf-8")
            proc = subprocess.run(
                [
                    "python", "-c",
                    "import time; t0=time.perf_counter(); "
                    f"exec(open({str(tmp)!r}, encoding='utf-8').read()); "
                    "print(time.perf_counter() - t0)"
                ],
                capture_output=True,
                text=True,
                timeout=self.config.max_time_seconds,
                cwd=file_path.parent,
            )
            tmp.unlink(missing_ok=True)
            if proc.returncode == 0 and proc.stdout.strip():
                return float(proc.stdout.strip())
            return None
        except (subprocess.TimeoutExpired, ValueError, OSError):
            tmp.unlink(missing_ok=True)
            return None

    def _calculate_complexity(self, content: str) -> int:
        """Calculate simplified cyclomatic complexity."""
        complexity = 1
        control_keywords = [
            "if ", "elif ", "else:", "for ", "while ",
            "except", "finally:", "with ", "assert ",
            "and ", "or ", "case ", "match ",
        ]
        for line in content.splitlines():
            stripped = line.strip()
            for keyword in control_keywords:
                if keyword in stripped:
                    complexity += 1
        return complexity

    def _get_original_content(self, file_path: Path) -> str:
        """Get original file content from git or backup."""
        try:
            repo = git.Repo(file_path.parent, search_parent_directories=True)
            rel_path = file_path.resolve().relative_to(repo.working_tree_dir.resolve())
            return repo.git.show(f"HEAD:{rel_path.as_posix()}")
        except (InvalidGitRepositoryError, ValueError, Exception):
            backup = file_path.with_suffix(file_path.suffix + ".cgbackup")
            if backup.exists():
                return backup.read_text(encoding="utf-8")
            return file_path.read_text(encoding="utf-8")

    def _check_quality(self, result: OptimizationResult) -> bool:
        """Quality gate: syntax validity + code smell regressions.

        Language-aware checks:
        - Python (.py): compile() syntax check + code smell counter
        - JavaScript/TypeScript (.js/.ts/.jsx/.tsx): basic heuristics
        - Other files: generic checks (non-empty, no regression in smell count)
        """
        console.print("[bold]Quality gate check...[/bold]")

        try:
            original_content = self._get_original_content(result.original_file)
            optimized_content = result.optimized_file.read_text(encoding="utf-8")

            suffix = result.original_file.suffix.lower()
            py_suffixes = {".py", ".pyw", ".pyi"}
            js_suffixes = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}

            if suffix in py_suffixes:
                # Python: syntax check via compile()
                try:
                    compile(optimized_content, str(result.optimized_file), "exec")
                except SyntaxError as e:
                    result.status = OptimizationStatus.QUALITY_REGRESSION
                    result.error_message = f"Optimized code has syntax error: {e}"
                    console.print(f"[red]{result.error_message}[/red]")
                    return False

                orig_smells = self._count_code_smells(original_content, "py")
                opt_smells = self._count_code_smells(optimized_content, "py")

            elif suffix in js_suffixes:
                # JS/TS: heuristic checks
                if not optimized_content.strip():
                    result.status = OptimizationStatus.QUALITY_REGRESSION
                    result.error_message = "Optimized file is empty"
                    console.print(f"[red]{result.error_message}[/red]")
                    return False

                orig_smells = self._count_code_smells(original_content, "js")
                opt_smells = self._count_code_smells(optimized_content, "js")

            else:
                # Generic: basic checks
                if not optimized_content.strip():
                    result.status = OptimizationStatus.QUALITY_REGRESSION
                    result.error_message = "Optimized file is empty"
                    console.print(f"[red]{result.error_message}[/red]")
                    return False

                orig_smells = self._count_code_smells(original_content, "generic")
                opt_smells = self._count_code_smells(optimized_content, "generic")

            if opt_smells > orig_smells + 2:
                result.status = OptimizationStatus.QUALITY_REGRESSION
                result.error_message = (
                    f"Code smells increased: {orig_smells} -> {opt_smells}"
                )
                console.print(f"[red]{result.error_message}[/red]")
                return False

            if opt_smells > orig_smells:
                console.print(f"[dim]  Code smells: {orig_smells} -> {opt_smells}[/dim]")

            console.print("[green]  Quality gate passed[/green]")
            return True

        except Exception as e:
            result.status = OptimizationStatus.ERROR
            result.error_message = f"Quality check failed: {e}"
            console.print(f"[red]{result.error_message}[/red]")
            return False

    def _count_code_smells(self, content: str, language: str = "generic") -> int:
        """Count basic code smell indicators. Lower is better.

        Language parameter adjusts the checks:
        - "py": Python-specific (bare except, print(), def arg count)
        - "js": JavaScript-specific (console.log, var, == instead of ===)
        - "generic": language-agnostic (long lines, trailing whitespace)
        """
        score = 0
        lines = content.splitlines()
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith(("#", "//", "/*", "*")):
                continue

            if language == "py":
                if stripped == "except:":
                    score += 1
                if stripped.startswith("def ") and stripped.count(",") > 6:
                    score += 1
                if stripped.startswith("print("):
                    score += 1
            elif language == "js":
                if stripped.startswith("console.log("):
                    score += 1
                if re.search(r"\bvar\s+\w+", stripped) and not stripped.strip().startswith("//"):
                    score += 1
                if stripped.count(" == ") and "===" not in stripped:
                    score += 1
                if stripped.startswith("debugger"):
                    score += 1

            # 语言无关检查
            if len(stripped) > 120:
                score += 1
            if stripped != stripped.rstrip():
                score += 1

        return score

    def _generate_diff(self, result: OptimizationResult) -> None:
        """Generate diff between original and optimized."""
        if not self.config.save_diff:
            return

        try:
            original = self._get_original_content(result.original_file)
            optimized = result.optimized_file.read_text()

            diff_path = self.config.output_dir / f"{result.request_id}.diff"

            # 生成统一格式 diff
            import difflib
            diff = difflib.unified_diff(
                original.splitlines(keepends=True),
                optimized.splitlines(keepends=True),
                fromfile=str(result.original_file),
                tofile=f"{result.original_file} (optimized)",
            )
            diff_path.write_text("".join(diff), encoding="utf-8")
            result.diff_file = diff_path

            console.print(f"[dim]Diff saved: {diff_path}[/dim]")

        except Exception as e:
            console.print(f"[yellow]Warning: Could not generate diff: {e}[/yellow]")

    def _make_decision(self, result: OptimizationResult) -> None:
        """Make final decision on optimization."""
        # 所有自动检查通过 -> 需要人工审查
        result.status = OptimizationStatus.NEEDS_REVIEW
        result.human_review_required = True
        from datetime import timedelta
        result.human_review_deadline = (
            result.timestamp + timedelta(hours=self.config.human_review_timeout_hours)
        )

        console.print("[bold yellow]  Human review required[/bold yellow]")
        console.print(f"[dim]Review deadline: {result.human_review_deadline}[/dim]")
        console.print(f"[dim]Diff: {result.diff_file}[/dim]")

    def _save_result(self, result: OptimizationResult) -> None:
        """Save result to output directory."""
        result_path = self.config.output_dir / f"{result.request_id}.json"
        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, indent=2, default=str)
        console.print(f"[dim]Result saved: {result_path}[/dim]")

    def approve(self, request_id: str, notes: str = "") -> OptimizationResult | None:
        """Approve an optimization after human review.

        This is the ONLY way an optimization can be merged.
        """
        result = self._find_result(request_id)
        if not result:
            console.print(f"[red]Result {request_id} not found[/red]")
            return None

        if result.status != OptimizationStatus.NEEDS_REVIEW:
            console.print(f"[red]Cannot approve: status is {result.status.value}[/red]")
            return None

        result.status = OptimizationStatus.APPROVED
        result.reviewer_decision = "approve"
        result.reviewer_notes = notes
        result.human_review_required = False

        self._save_result(result)
        console.print(f"[green]  Optimization {request_id} approved[/green]")
        return result

    def reject(self, request_id: str, notes: str = "") -> OptimizationResult | None:
        """Reject an optimization and restore original code."""
        result = self._find_result(request_id)
        if not result:
            console.print(f"[red]Result {request_id} not found[/red]")
            return None

        # 恢复原始代码
        original_content = self._get_original_content(result.original_file)
        result.optimized_file.write_text(original_content, encoding="utf-8")

        result.status = OptimizationStatus.REJECTED
        result.reviewer_decision = "reject"
        result.reviewer_notes = notes
        result.human_review_required = False

        self._save_result(result)
        console.print(f"[yellow]  Optimization {request_id} rejected, original restored[/yellow]")
        return result

    def _find_result(self, request_id: str) -> OptimizationResult | None:
        """Find result by request ID in memory or load from disk."""
        for r in self._history:
            if r.request_id == request_id:
                return r

        # 尝试从文件加载（跨会话恢复）
        result_path = self.config.output_dir / f"{request_id}.json"
        if result_path.exists():
            try:
                data = json.loads(result_path.read_text(encoding="utf-8"))
                result = OptimizationResult.from_dict(data)
                self._history.append(result)
                return result
            except Exception:
                pass

        return None

    @property
    def history(self) -> list[OptimizationResult]:
        """Get optimization history."""
        return self._history.copy()
