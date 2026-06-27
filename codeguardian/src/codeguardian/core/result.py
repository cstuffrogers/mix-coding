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
                "original_lines": self.quality.original_lines,
                "optimized_lines": self.quality.optimized_lines,
                "lines_delta": self.quality.lines_delta,
                "new_dependencies": self.quality.new_dependencies,
            },
            "tests_passed": self.tests_passed,
            "test_output": self.test_output,
            "benchmark_output": self.benchmark_output,
            "human_review_required": self.human_review_required,
            "human_review_deadline": self.human_review_deadline.isoformat() if self.human_review_deadline else None,
            "reviewer_decision": self.reviewer_decision,
            "reviewer_notes": self.reviewer_notes,
            "error_message": self.error_message,
            "ai_model": self.ai_model,
            "optimization_prompt": self.optimization_prompt,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> OptimizationResult:
        """Reconstruct result from dictionary (e.g., loaded from JSON)."""
        result = cls(
            request_id=data.get("request_id", ""),
            status=OptimizationStatus(data.get("status", "pending")),
            original_file=Path(data.get("original_file", ".")),
            tests_passed=data.get("tests_passed", False),
            test_output=data.get("test_output", ""),
            benchmark_output=data.get("benchmark_output", ""),
            human_review_required=data.get("human_review_required", True),
            reviewer_decision=data.get("reviewer_decision", ""),
            reviewer_notes=data.get("reviewer_notes", ""),
            error_message=data.get("error_message", ""),
            ai_model=data.get("ai_model", ""),
            optimization_prompt=data.get("optimization_prompt", ""),
        )
        if data.get("timestamp"):
            result.timestamp = datetime.fromisoformat(data["timestamp"])
        if data.get("optimized_file"):
            result.optimized_file = Path(data["optimized_file"])
        if data.get("diff_file"):
            result.diff_file = Path(data["diff_file"])
        if data.get("human_review_deadline"):
            result.human_review_deadline = datetime.fromisoformat(data["human_review_deadline"])

        perf = data.get("performance", {})
        result.performance = PerformanceMetrics(
            original_time_ms=perf.get("original_time_ms", 0.0),
            optimized_time_ms=perf.get("optimized_time_ms", 0.0),
            time_change_percent=perf.get("time_change_percent", 0.0),
            original_memory_mb=perf.get("original_memory_mb", 0.0),
            optimized_memory_mb=perf.get("optimized_memory_mb", 0.0),
            memory_change_percent=perf.get("memory_change_percent", 0.0),
        )

        qual = data.get("quality", {})
        result.quality = QualityMetrics(
            original_complexity=qual.get("original_complexity", 0),
            optimized_complexity=qual.get("optimized_complexity", 0),
            complexity_change_percent=qual.get("complexity_change_percent", 0.0),
            original_lines=qual.get("original_lines", 0),
            optimized_lines=qual.get("optimized_lines", 0),
            lines_delta=qual.get("lines_delta", 0),
            new_dependencies=qual.get("new_dependencies", []),
        )

        return result

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
