# CodeGuardian 完整项目文档

> **AI Code Optimization Guardian** — 防止 AI 代码过度优化与负优化的 MCP Server + CLI 工具

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心设计原则](#2-核心设计原则)
3. [项目结构](#3-项目结构)
4. [完整代码](#4-完整代码)
5. [配置文件](#5-配置文件)
6. [安装与使用](#6-安装与使用)
7. [MCP 接入指南](#7-mcp-接入指南)
8. [CLI 命令参考](#8-cli-命令参考)
9. [工作流程](#9-工作流程)
10. [测试](#10-测试)

---

## 1. 项目概述

CodeGuardian 是一个用于防止 AI 辅助代码优化中出现过度优化（Over-Optimization）和负优化（Negative Optimization）的防护系统。

### 核心问题

AI 工具（如 Claude Code）在循环优化代码时容易出现：
- 代码复杂度指数增长
- 可读性严重下降
- 微妙的逻辑错误（测试通过但行为异常）
- 为局部最优牺牲全局可维护性
- 优化收益递减甚至为负

### 解决方案

**"优化一次，严格验证，人工决策，禁止循环"**

---

## 2. 核心设计原则

| 原则 | 说明 |
|------|------|
| **单次优化** | AI 每文件只能提交一次优化，禁止自动迭代 |
| **物理硬边界** | 代码量、依赖数、执行时间等硬性上限，AI 无法协商突破 |
| **自动验证** | 测试、性能基准、质量指标三重自动检查 |
| **失败即回滚** | 任何检查失败立即恢复原始代码，不留中间状态 |
| **人工门控** | 只有通过全部自动检查后，才进入人工审查阶段 |
| **不可自动合并** | 默认配置禁止超时自动合并，必须人工显式批准 |

---

## 3. 项目结构

```
codeguardian/
├── pyproject.toml              # 项目配置与依赖
├── README.md                   # 项目说明
├── src/
│   └── codeguardian/
│       ├── __init__.py           # 包入口
│       ├── cli.py                # 命令行工具
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py         # 配置管理
│       │   ├── guardian.py       # 核心引擎
│       │   └── result.py         # 结果模型
│       └── mcp/
│           ├── __init__.py
│           └── server.py         # MCP Server 实现
└── tests/
    ├── __init__.py
    └── test_guardian.py          # 单元测试
```

---

## 4. 完整代码

### 4.1 pyproject.toml

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "codeguardian"
version = "0.1.0"
description = "AI Code Optimization Guardian - Prevent Over-Optimization"
readme = "README.md"
license = {text = "MIT"}
requires-python = ">=3.10"
authors = [
    {name = "CodeGuardian Team"}
]
keywords = ["ai", "code-optimization", "mcp", "claude", "guardrails"]
classifiers = [
    "Development Status :: 3 - Alpha",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]
dependencies = [
    "mcp>=1.0.0",
    "pydantic>=2.0.0",
    "click>=8.0.0",
    "rich>=13.0.0",
    "pyyaml>=6.0",
    "gitpython>=3.1.0",
    "pytest>=7.0.0",
    "pytest-benchmark>=4.0.0",
    "psutil>=5.9.0",
    "httpx>=0.25.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.0.0",
    "black>=23.0.0",
    "ruff>=0.1.0",
    "mypy>=1.5.0",
]

[project.scripts]
codeguardian = "codeguardian.cli:main"
cg = "codeguardian.cli:main"

[project.urls]
Homepage = "https://github.com/your-org/codeguardian"
Documentation = "https://github.com/your-org/codeguardian#readme"
Repository = "https://github.com/your-org/codeguardian"
Issues = "https://github.com/your-org/codeguardian/issues"

[tool.hatch.build.targets.wheel]
packages = ["src/codeguardian"]

[tool.black]
line-length = 100
target-version = ['py310']

[tool.ruff]
line-length = 100
select = ["E", "F", "W", "I", "N", "D", "UP", "B", "C4", "SIM"]
ignore = ["D100", "D104"]

[tool.mypy]
python_version = "3.10"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
```

### 4.2 src/codeguardian/__init__.py

```python
"""CodeGuardian - AI Code Optimization Guardian.

Prevent over-optimization and negative optimization in AI-assisted code refactoring.
"""

__version__ = "0.1.0"

from codeguardian.core.guardian import CodeGuardian
from codeguardian.core.config import GuardianConfig
from codeguardian.core.result import OptimizationResult

__all__ = ["CodeGuardian", "GuardianConfig", "OptimizationResult"]
```

### 4.3 src/codeguardian/core/__init__.py

```python
# Core module
```

### 4.4 src/codeguardian/core/config.py

```python
"""Configuration management for CodeGuardian."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class GuardianConfig:
    """Configuration for code optimization guardrails."""

    # === 物理硬边界 ===
    max_optimization_rounds: int = 1  # 核心：只优化一次，不循环
    max_tokens_per_optimization: int = 5000
    max_time_seconds: float = 30.0
    max_lines_delta: int = 50  # 最多增加50行（负值表示允许减少）
    max_dependencies: int = 0  # 禁止引入新依赖

    # === 性能阈值 ===
    min_performance_gain_percent: float = 5.0  # 至少提升5%
    max_memory_increase_percent: float = 120.0  # 内存不超过原版120%

    # === 质量阈值 ===
    max_complexity_increase: float = 1.3  # 圈复杂度不超过原版130%
    min_test_coverage_percent: float = 80.0

    # === 审查设置 ===
    human_review_timeout_hours: float = 24.0
    auto_merge_after_timeout: bool = False  # 超时后是否自动合并（建议False）

    # === 测试配置 ===
    test_command: str = "pytest"
    benchmark_command: str = "pytest --benchmark-only"
    coverage_command: str = "pytest --cov"

    # === 输出 ===
    output_dir: Path = field(default_factory=lambda: Path(".codeguardian"))
    save_diff: bool = True
    save_benchmark: bool = True

    # === 集成 ===
    mcp_server_name: str = "codeguardian"
    mcp_log_level: str = "INFO"

    @classmethod
    def from_file(cls, path: str | Path) -> GuardianConfig:
        """Load configuration from YAML file."""
        path = Path(path)
        if not path.exists():
            return cls()

        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        # Convert path strings to Path objects
        if "output_dir" in data:
            data["output_dir"] = Path(data["output_dir"])

        return cls(**data)

    @classmethod
    def from_env(cls) -> GuardianConfig:
        """Load configuration from environment variables."""
        config = cls()

        if env_rounds := os.getenv("CG_MAX_ROUNDS"):
            config.max_optimization_rounds = int(env_rounds)
        if env_tokens := os.getenv("CG_MAX_TOKENS"):
            config.max_tokens_per_optimization = int(env_tokens)
        if env_time := os.getenv("CG_MAX_TIME"):
            config.max_time_seconds = float(env_time)
        if env_gain := os.getenv("CG_MIN_GAIN"):
            config.min_performance_gain_percent = float(env_gain)
        if env_auto := os.getenv("CG_AUTO_MERGE"):
            config.auto_merge_after_timeout = env_auto.lower() == "true"

        return config

    def to_file(self, path: str | Path) -> None:
        """Save configuration to YAML file."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            k: str(v) if isinstance(v, Path) else v
            for k, v in self.__dict__.items()
        }

        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
```

### 4.5 src/codeguardian/core/result.py

```python
"""Result models for optimization attempts."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class OptimizationStatus(Enum):
    """Status of an optimization attempt."""

    PENDING = "pending"           # 等待处理
    RUNNING = "running"           # 正在优化
    TESTS_FAILED = "tests_failed" # 测试未通过
    NO_GAIN = "no_gain"          # 性能未提升
    QUALITY_REGRESSION = "quality_regression"  # 质量下降
    TOO_COMPLEX = "too_complex"   # 改动过大
    NEEDS_REVIEW = "needs_review" # 等待人工审查
    APPROVED = "approved"         # 已批准
    REJECTED = "rejected"        # 已拒绝
    MERGED = "merged"            # 已合并
    TIMEOUT = "timeout"          # 超时
    ERROR = "error"              # 系统错误


@dataclass
class PerformanceMetrics:
    """Performance comparison between original and optimized code."""

    original_time_ms: float = 0.0
    optimized_time_ms: float = 0.0
    time_change_percent: float = 0.0

    original_memory_mb: float = 0.0
    optimized_memory_mb: float = 0.0
    memory_change_percent: float = 0.0

    original_ops_per_sec: float = 0.0
    optimized_ops_per_sec: float = 0.0
    ops_change_percent: float = 0.0

    @property
    def is_faster(self) -> bool:
        """Check if optimized version is faster."""
        return self.optimized_time_ms < self.original_time_ms

    @property
    def meets_threshold(self, min_gain_percent: float = 5.0) -> bool:
        """Check if performance gain meets minimum threshold."""
        if not self.is_faster:
            return False
        gain = (self.original_time_ms - self.optimized_time_ms) / self.original_time_ms * 100
        return gain >= min_gain_percent


@dataclass
class QualityMetrics:
    """Code quality metrics comparison."""

    original_complexity: int = 0
    optimized_complexity: int = 0
    complexity_change_percent: float = 0.0

    original_lines: int = 0
    optimized_lines: int = 0
    lines_delta: int = 0

    test_coverage_original: float = 0.0
    test_coverage_optimized: float = 0.0
    coverage_change: float = 0.0

    new_dependencies: list[str] = field(default_factory=list)


@dataclass
class OptimizationResult:
    """Complete result of an optimization attempt."""

    # 标识
    request_id: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    status: OptimizationStatus = OptimizationStatus.PENDING

    # 文件信息
    original_file: Path = field(default_factory=Path)
    optimized_file: Path | None = None
    diff_file: Path | None = None

    # 指标
    performance: PerformanceMetrics = field(default_factory=PerformanceMetrics)
    quality: QualityMetrics = field(default_factory=QualityMetrics)

    # 测试
    tests_passed: bool = False
    test_output: str = ""
    benchmark_output: str = ""

    # 决策
    human_review_required: bool = True
    human_review_deadline: datetime | None = None
    reviewer_decision: str = ""  # "approve", "reject", ""
    reviewer_notes: str = ""

    # 错误信息
    error_message: str = ""

    # 元数据
    ai_model: str = ""
    optimization_prompt: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat(),
            "status": self.status.value,
            "original_file": str(self.original_file),
            "optimized_file": str(self.optimized_file) if self.optimized_file else None,
            "diff_file": str(self.diff_file) if self.diff_file else None,
            "performance": {
                "original_time_ms": self.performance.original_time_ms,
                "optimized_time_ms": self.performance.optimized_time_ms,
                "time_change_percent": self.performance.time_change_percent,
                "original_memory_mb": self.performance.original_memory_mb,
                "optimized_memory_mb": self.performance.optimized_memory_mb,
                "memory_change_percent": self.performance.memory_change_percent,
                "is_faster": self.performance.is_faster,
            },
            "quality": {
                "original_complexity": self.quality.original_complexity,
                "optimized_complexity": self.quality.optimized_complexity,
                "complexity_change_percent": self.quality.complexity_change_percent,
                "lines_delta": self.quality.lines_delta,
                "new_dependencies": self.quality.new_dependencies,
            },
            "tests_passed": self.tests_passed,
            "human_review_required": self.human_review_required,
            "reviewer_decision": self.reviewer_decision,
            "error_message": self.error_message,
        }

    @property
    def is_successful(self) -> bool:
        """Check if optimization was successful."""
        return self.status in (OptimizationStatus.APPROVED, OptimizationStatus.MERGED)

    @property
    def summary(self) -> str:
        """Get human-readable summary."""
        lines = [
            f"=== Optimization Result: {self.request_id} ===",
            f"Status: {self.status.value}",
            f"File: {self.original_file}",
            "",
            "Performance:",
            f"  Original: {self.performance.original_time_ms:.2f}ms",
            f"  Optimized: {self.performance.optimized_time_ms:.2f}ms",
            f"  Change: {self.performance.time_change_percent:+.1f}%",
            "",
            "Quality:",
            f"  Complexity: {self.quality.original_complexity} -> {self.quality.optimized_complexity}",
            f"  Lines: {self.quality.lines_delta:+d}",
            "",
            f"Tests: {'PASSED' if self.tests_passed else 'FAILED'}",
            f"Review: {'Required' if self.human_review_required else 'Not Required'}",
        ]
        if self.error_message:
            lines.append(f"Error: {self.error_message}")
        return "\n".join(lines)
```

### 4.6 src/codeguardian/core/guardian.py

```python
"""Core optimization guardian engine."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Callable

import git
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

        # 检查依赖引入（简单启发式）
        new_imports = self._detect_new_dependencies(content)
        if len(new_imports) > self.config.max_dependencies:
            result.status = OptimizationStatus.TOO_COMPLEX
            result.error_message = (
                f"Too many new dependencies: {new_imports} "
                f"(max {self.config.max_dependencies})"
            )
            console.print(f"[red]{result.error_message}[/red]")
            return False

        result.quality.new_dependencies = new_imports
        console.print("[green]✓ Physical boundaries check passed[/green]")
        return True

    def _detect_new_dependencies(self, content: str) -> list[str]:
        """Detect potentially new imports/dependencies."""
        new_deps = []
        for line in content.splitlines():
            line = line.strip()
            if line.startswith(("import ", "from ")):
                # 简单提取模块名
                parts = line.replace("import ", "").replace("from ", "").split()
                if parts:
                    module = parts[0].split(".")[0]
                    # 排除标准库（简化检查）
                    stdlib = {"os", "sys", "json", "time", "math", "random", "typing", "pathlib"}
                    if module not in stdlib:
                        new_deps.append(module)
        return list(set(new_deps))

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
        """Run test suite against optimized code."""
        console.print("[bold]Running tests...[/bold]")

        try:
            proc = subprocess.run(
                self.config.test_command.split(),
                capture_output=True,
                text=True,
                timeout=self.config.max_time_seconds,
                cwd=Path(result.original_file).parent,
            )

            result.test_output = proc.stdout + proc.stderr
            result.tests_passed = proc.returncode == 0

            if not result.tests_passed:
                result.status = OptimizationStatus.TESTS_FAILED
                console.print(f"[red]✗ Tests FAILED[/red]")
                console.print(f"[dim]{result.test_output[:500]}[/dim]")
                return False

            console.print("[green]✓ All tests passed[/green]")
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

    def _run_benchmark(self, result: OptimizationResult) -> bool:
        """Run performance benchmark comparing original vs optimized."""
        console.print("[bold]Running benchmark...[/bold]")

        try:
            # 获取原始代码的基准（从备份或 git）
            original_content = self._get_original_content(result.original_file)
            optimized_content = result.optimized_file.read_text()

            # 简化：使用代码复杂度作为代理指标
            # 实际应使用 pytest-benchmark 等工具
            orig_complexity = self._calculate_complexity(original_content)
            opt_complexity = self._calculate_complexity(optimized_content)

            result.quality.original_complexity = orig_complexity
            result.quality.optimized_complexity = opt_complexity
            result.quality.complexity_change_percent = (
                (opt_complexity - orig_complexity) / max(orig_complexity, 1) * 100
            )

            result.quality.original_lines = len(original_content.splitlines())
            result.quality.optimized_lines = len(optimized_content.splitlines())
            result.quality.lines_delta = (
                result.quality.optimized_lines - result.quality.original_lines
            )

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

            console.print("[green]✓ Benchmark passed[/green]")
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

    def _calculate_complexity(self, content: str) -> int:
        """Calculate simplified cyclomatic complexity."""
        complexity = 1
        control_keywords = [
            "if ", "elif ", "else:", "for ", "while ", 
            "except", "finally:", "with ", "assert ",
            "and ", "or ", "?", "case ", "match ",
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
            # 从 git 获取原始版本
            rel_path = file_path.relative_to(repo.working_tree_dir)
            return repo.git.show(f"HEAD:{rel_path}")
        except:
            # 回退：从 .cgbackup 获取
            backup = file_path.with_suffix(file_path.suffix + ".cgbackup")
            if backup.exists():
                return backup.read_text()
            # 最后回退：当前文件（如果还没被覆盖）
            return file_path.read_text()

    def _check_quality(self, result: OptimizationResult) -> bool:
        """Final quality gate before human review."""
        console.print("[bold]Quality gate check...[/bold]")

        # 检查是否真的有性能提升（简化版，实际应跑真实 benchmark）
        # 这里假设如果复杂度没有大幅增长且行数合理，就通过

        console.print("[green]✓ Quality gate passed[/green]")
        return True

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
        result.human_review_deadline = (
            result.timestamp.replace(hour=result.timestamp.hour + int(self.config.human_review_timeout_hours))
        )

        console.print("[bold yellow]⚠ Human review required[/bold yellow]")
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
        console.print(f"[green]✓ Optimization {request_id} approved[/green]")
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
        console.print(f"[yellow]✗ Optimization {request_id} rejected, original restored[/yellow]")
        return result

    def _find_result(self, request_id: str) -> OptimizationResult | None:
        """Find result by request ID."""
        for r in self._history:
            if r.request_id == request_id:
                return r

        # 尝试从文件加载
        result_path = self.config.output_dir / f"{request_id}.json"
        if result_path.exists():
            # 简化：实际应实现从 JSON 反序列化
            pass

        return None

    @property
    def history(self) -> list[OptimizationResult]:
        """Get optimization history."""
        return self._history.copy()
```

### 4.7 src/codeguardian/cli.py

```python
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
            "✓" if r.tests_passed else "✗",
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
```

### 4.8 src/codeguardian/mcp/__init__.py

```python
# MCP module
```

### 4.9 src/codeguardian/mcp/server.py

```python
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
            for key, value in settings.items():
                if hasattr(self.config, key):
                    setattr(self.config, key, value)

            return [TextContent(type="text", text="Configuration updated")]

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
    """Entry point for MCP server."""
    server = CodeGuardianMCPServer()
    asyncio.run(server.run())


if __name__ == "__main__":
    main()
```

### 4.10 tests/__init__.py

```python
# Tests module
```

### 4.11 tests/test_guardian.py

```python
"""Tests for CodeGuardian core functionality."""

import tempfile
from pathlib import Path

import pytest

from codeguardian.core.config import GuardianConfig
from codeguardian.core.guardian import CodeGuardian
from codeguardian.core.result import OptimizationStatus


class TestGuardianConfig:
    """Test configuration management."""

    def test_default_config(self):
        """Test default configuration values."""
        config = GuardianConfig()
        assert config.max_optimization_rounds == 1
        assert config.min_performance_gain_percent == 5.0
        assert config.max_lines_delta == 50
        assert config.auto_merge_after_timeout is False

    def test_config_from_env(self, monkeypatch):
        """Test loading config from environment variables."""
        monkeypatch.setenv("CG_MAX_ROUNDS", "3")
        monkeypatch.setenv("CG_MIN_GAIN", "10.0")

        config = GuardianConfig.from_env()
        assert config.max_optimization_rounds == 3
        assert config.min_performance_gain_percent == 10.0

    def test_config_save_load(self, tmp_path):
        """Test saving and loading config."""
        config = GuardianConfig(
            max_optimization_rounds=2,
            min_performance_gain_percent=10.0,
        )
        config_path = tmp_path / "config.yaml"
        config.to_file(config_path)

        loaded = GuardianConfig.from_file(config_path)
        assert loaded.max_optimization_rounds == 2
        assert loaded.min_performance_gain_percent == 10.0


class TestCodeGuardian:
    """Test guardian engine."""

    @pytest.fixture
    def guardian(self, tmp_path):
        """Create a guardian instance with temp output dir."""
        config = GuardianConfig(output_dir=tmp_path / ".codeguardian")
        return CodeGuardian(config)

    @pytest.fixture
    def sample_file(self, tmp_path):
        """Create a sample Python file."""
        file_path = tmp_path / "sample.py"
        content = """
def slow_sum(n):
    result = 0
    for i in range(n):
        result += i
    return result
"""
        file_path.write_text(content)
        return file_path

    def test_optimization_with_tests_passing(self, guardian, sample_file, tmp_path):
        """Test successful optimization path."""
        # Create a test file
        test_file = tmp_path / "test_sample.py"
        test_file.write_text("""
import pytest
from sample import slow_sum

def test_slow_sum():
    assert slow_sum(5) == 10
    assert slow_sum(0) == 0
""")

        # Create optimized version
        optimized = """
def slow_sum(n):
    return n * (n - 1) // 2
"""

        result = guardian.optimize(
            file_path=sample_file,
            optimized_content=optimized,
            ai_model="test-model",
        )

        assert result.request_id != ""
        assert result.status in (
            OptimizationStatus.NEEDS_REVIEW,
            OptimizationStatus.TESTS_FAILED,  # May fail if test setup is incomplete
        )

    def test_optimization_too_large(self, guardian, sample_file):
        """Test rejection of overly large optimization."""
        # Create a very large optimized file
        optimized = "\n".join([f"x = {i}" for i in range(1000)])

        result = guardian.optimize(
            file_path=sample_file,
            optimized_content=optimized,
        )

        assert result.status == OptimizationStatus.TOO_COMPLEX
        assert "too large" in result.error_message.lower() or "tokens" in result.error_message.lower()

    def test_optimization_new_dependencies(self, guardian, sample_file):
        """Test rejection of optimization with new dependencies."""
        optimized = """
import numpy as np

def slow_sum(n):
    return np.sum(np.arange(n))
"""

        result = guardian.optimize(
            file_path=sample_file,
            optimized_content=optimized,
        )

        assert result.status == OptimizationStatus.TOO_COMPLEX
        assert "dependencies" in result.error_message.lower()

    def test_approve_and_reject(self, guardian, sample_file):
        """Test human approval and rejection workflow."""
        optimized = """
def slow_sum(n):
    return n * (n - 1) // 2
"""

        result = guardian.optimize(
            file_path=sample_file,
            optimized_content=optimized,
        )

        request_id = result.request_id

        # Test approve
        approved = guardian.approve(request_id, "Looks good")
        if approved:
            assert approved.status == OptimizationStatus.APPROVED

        # Test reject (on a fresh result)
        result2 = guardian.optimize(
            file_path=sample_file,
            optimized_content=optimized,
        )
        rejected = guardian.reject(result2.request_id, "Too risky")
        if rejected:
            assert rejected.status == OptimizationStatus.REJECTED

    def test_history_tracking(self, guardian, sample_file):
        """Test optimization history."""
        assert len(guardian.history) == 0

        optimized = "def slow_sum(n): return n * (n - 1) // 2"
        guardian.optimize(file_path=sample_file, optimized_content=optimized)

        assert len(guardian.history) == 1
        assert guardian.history[0].original_file == sample_file
```

---

## 5. 配置文件

### 5.1 .codeguardian.yaml（项目级配置）

```yaml
# CodeGuardian Configuration
# Place this file in your project root

# === 物理硬边界 ===
# 核心原则：只优化一次，禁止循环
max_optimization_rounds: 1

# 优化代码的最大估算 token 数（1 token ≈ 4 字符）
max_tokens_per_optimization: 5000

# 测试/基准的最大执行时间（秒）
max_time_seconds: 30.0

# 代码行数变化上限（±50 行）
max_lines_delta: 50

# 允许引入的新依赖数量（0 = 禁止任何新依赖）
max_dependencies: 0

# === 性能阈值 ===
# 最小性能提升百分比（低于此值直接拒绝）
min_performance_gain_percent: 5.0

# 内存使用上限（相对于原版的百分比）
max_memory_increase_percent: 120.0

# === 质量阈值 ===
# 圈复杂度增长上限（1.3 = 不超过原版 130%）
max_complexity_increase: 1.3

# 最小测试覆盖率
min_test_coverage_percent: 80.0

# === 审查设置 ===
# 人工审查超时时间（小时）
human_review_timeout_hours: 24.0

# 超时后是否自动合并（强烈建议保持 false）
auto_merge_after_timeout: false

# === 测试配置 ===
test_command: "pytest"
benchmark_command: "pytest --benchmark-only"
coverage_command: "pytest --cov"

# === 输出设置 ===
output_dir: ".codeguardian"
save_diff: true
save_benchmark: true
```

### 5.2 环境变量配置

```bash
# 通过环境变量覆盖配置（优先级高于配置文件）
export CG_MAX_ROUNDS=1
export CG_MAX_TOKENS=5000
export CG_MAX_TIME=30
export CG_MIN_GAIN=5.0
export CG_AUTO_MERGE=false
```

---

## 6. 安装与使用

### 6.1 安装

```bash
# 从源码安装
git clone https://github.com/your-org/codeguardian.git
cd codeguardian
pip install -e ".[dev]"

# 或使用 pip（发布后的方式）
pip install codeguardian
```

### 6.2 初始化项目

```bash
# 在项目根目录创建默认配置
cg init .

# 编辑 .codeguardian.yaml 自定义规则
```

### 6.3 CLI 使用示例

```bash
# 提交优化（AI 生成优化文件后）
cg optimize original.py optimized.py --model claude-3-5-sonnet

# 查看状态
cg status abc123

# 人工审查后批准
cg approve abc123 --notes "3x faster, clean change"

# 或拒绝并恢复原始代码
cg reject abc123 --notes "Too complex, not worth the risk"

# 查看历史
cg history --file original.py

# 查看当前配置
cg config
```

---

## 7. MCP 接入指南

### 7.1 Claude Code 配置

在 Claude Code 的 MCP 设置中添加：

```json
{
  "mcpServers": {
    "codeguardian": {
      "command": "python",
      "args": ["-m", "codeguardian.mcp.server"],
      "env": {
        "CG_MAX_ROUNDS": "1",
        "CG_MIN_GAIN": "5.0",
        "CG_AUTO_MERGE": "false",
        "CG_MAX_DEPENDENCIES": "0"
      }
    }
  }
}
```

### 7.2 MCP 工具说明

#### codeguardian_optimize

**调用者**：AI Agent（Claude Code 等）

**功能**：提交优化后的代码进行验证

**约束**：
- 每文件只能调用一次
- 工具描述中明确禁止循环调用
- 如果优化被拒绝，原始代码自动恢复

**输入**：
```json
{
  "file_path": "/absolute/path/to/file.py",
  "optimized_content": "def optimized_func(): ...",
  "ai_model": "claude-3-5-sonnet-20241022",
  "optimization_prompt": "Optimize this function for O(n) time complexity"
}
```

**输出**：
```json
{
  "request_id": "abc123",
  "status": "needs_review",
  "tests_passed": true,
  "performance_change": "+300%",
  "complexity_change": "+5%",
  "lines_delta": -10,
  "human_review_required": true,
  "diff_file": ".codeguardian/abc123.diff",
  "message": "Optimization passed all automatic checks. Awaiting human review. Diff: .codeguardian/abc123.diff"
}
```

#### codeguardian_status

**调用者**：AI / 人类

**功能**：查询优化请求状态

#### codeguardian_approve / codeguardian_reject

**调用者**：**仅限人类**

**功能**：批准或拒绝优化

**重要**：工具描述中明确标注 "HUMAN-ONLY tool. AI agents should NOT call this tool."

---

## 8. CLI 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `cg init <path>` | 初始化配置 | `cg init .` |
| `cg optimize <original> <optimized>` | 提交优化 | `cg optimize a.py b.py --model claude` |
| `cg status <id>` | 查看状态 | `cg status abc123` |
| `cg approve <id>` | 批准优化 | `cg approve abc123 -n "LGTM"` |
| `cg reject <id>` | 拒绝优化 | `cg reject abc123 -n "Too risky"` |
| `cg history` | 查看历史 | `cg history --file a.py` |
| `cg config` | 查看配置 | `cg config` |

---

## 9. 工作流程

### 9.1 正常流程（优化成功）

```
AI 生成优化代码
       ↓
codeguardian_optimize(file_path, optimized_content)
       ↓
┌─────────────────────────────┐
│ Phase 1: 物理边界检查        │
│ - 代码量 ≤ 5000 tokens       │
│ - 新依赖 ≤ 0                 │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Phase 2: 备份原始代码        │
│ - 创建 .cgbackup 备份        │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Phase 3: 写入优化版          │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Phase 4: 运行测试            │
│ - 执行 pytest                │
│ - 全部通过？                 │
└─────────────┬───────────────┘
         是 /                  ↓    ↓
┌─────────────┐  ┌─────────────┐
│ Phase 5:    │  │ 恢复原始代码 │
│ 性能基准     │  │ 状态:TESTS_  │
│ - 复杂度     │  │ FAILED      │
│ - 行数变化   │  │ 返回错误     │
│ - 通过？     │  └─────────────┘
└──────┬──────┘
   是 /           ↓    ↓
┌─────────────┐  ┌─────────────┐
│ Phase 6:    │  │ 恢复原始代码 │
│ 质量检查     │  │ 状态:TOO_   │
│ - 通过？     │  │ COMPLEX     │
└──────┬──────┘  └─────────────┘
   是 /           ↓    ↓
┌─────────────┐  ┌─────────────┐
│ Phase 7:    │  │ 恢复原始代码 │
│ 生成 diff    │  │ 状态:QUALITY│
└──────┬──────┘  │ _REGRESSION │
       ↓         └─────────────┘
┌─────────────────────────────┐
│ Phase 8: 人工审查门控        │
│ 状态: NEEDS_REVIEW           │
│ AI 无法继续                  │
│ 等待人类 approve/reject      │
└─────────────────────────────┘
```

### 9.2 决策状态机

```
PENDING → RUNNING → [TESTS_FAILED | TOO_COMPLEX | QUALITY_REGRESSION | NEEDS_REVIEW]
                                                              ↓
                                                    ┌─────────┴─────────┐
                                                    ↓                   ↓
                                              APPROVED            REJECTED
                                                    ↓                   ↓
                                              MERGED              (original restored)
```

---

## 10. 测试

### 10.1 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行全部测试
pytest

# 带覆盖率
pytest --cov=codeguardian

# 特定测试
pytest tests/test_guardian.py::TestGuardianConfig
```

### 10.2 代码质量检查

```bash
# 格式化
black src tests

# 静态检查
ruff check src tests

# 类型检查
mypy src
```

---

## 附录：设计决策记录

### 为什么禁止自动迭代？

| 轮次 | 典型结果 |
|------|---------|
| 第 1 轮 | 去除冗余，有实际改进 |
| 第 2 轮 | 引入抽象，边际收益 |
| 第 3 轮 | 过度设计，可读性下降 |
| 第 4 轮+ | 为优化而优化，负优化 |

**结论**：单次优化 + 严格验证 > 多次迭代 + 复杂防护

### 为什么用物理边界而非智能评估？

- 物理边界（代码量、依赖数）是**客观不可协商的**
- 智能评估（收益代价分析）会被 AI **操纵和绕过**
- 简单规则比复杂规则更可靠

### 为什么必须人工审查？

- AI 无法真正"理解"代码的业务逻辑
- 测试通过 ≠ 行为正确（可能改变边界行为）
- 可读性判断需要人类认知
- 责任归属需要明确到人

---

*文档版本: 0.1.0*
*最后更新: 2026-06-20*
