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
        if env_lines := os.getenv("CG_MAX_LINES_DELTA"):
            config.max_lines_delta = int(env_lines)
        if env_deps := os.getenv("CG_MAX_DEPENDENCIES"):
            config.max_dependencies = int(env_deps)
        if env_complexity := os.getenv("CG_MAX_COMPLEXITY"):
            config.max_complexity_increase = float(env_complexity)

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
