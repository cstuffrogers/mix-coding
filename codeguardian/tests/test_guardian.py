"""Tests for CodeGuardian core functionality."""

import json
import tempfile
from pathlib import Path

import pytest

from codeguardian.core.config import GuardianConfig
from codeguardian.core.guardian import CodeGuardian
from codeguardian.core.result import OptimizationResult, OptimizationStatus


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

    def test_config_from_env_extended(self, monkeypatch):
        """Test loading extended env vars (max_lines_delta, max_deps, max_complexity)."""
        monkeypatch.setenv("CG_MAX_LINES_DELTA", "30")
        monkeypatch.setenv("CG_MAX_DEPENDENCIES", "2")
        monkeypatch.setenv("CG_MAX_COMPLEXITY", "1.5")

        config = GuardianConfig.from_env()
        assert config.max_lines_delta == 30
        assert config.max_dependencies == 2
        assert config.max_complexity_increase == 1.5

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
        test_file = tmp_path / "test_sample.py"
        test_file.write_text("""
import pytest
from sample import slow_sum

def test_slow_sum():
    assert slow_sum(5) == 10
    assert slow_sum(0) == 0
""")

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
            OptimizationStatus.TESTS_FAILED,
            OptimizationStatus.ERROR,
        )

    def test_optimization_too_large(self, guardian, sample_file):
        """Test rejection of overly large optimization."""
        optimized = "\n".join([f"x_{i} = 'some descriptive string to fill space'" for i in range(1000)])

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

    def test_dependency_detection_existing_import(self, guardian):
        """Test that existing imports are not flagged as new."""
        original = "import numpy as np\n\ndef foo(): return np.array([1,2,3])"
        optimized = "import numpy as np\n\n\ndef foo(): return np.sum(np.array([1,2,3]))"
        new = guardian._detect_new_dependencies(optimized, original)
        assert new == []

    def test_dependency_detection_stdlib_ok(self, guardian):
        """Test that stdlib imports are not flagged."""
        original = ""
        optimized = "import os\nimport json\nfrom pathlib import Path\n\ndef foo(): pass"
        new = guardian._detect_new_dependencies(optimized, original)
        assert new == []

    def test_find_project_root(self, guardian, tmp_path):
        """Test project root detection by marker files."""
        # 在临时目录创建 package.json
        (tmp_path / "package.json").write_text("{}")
        src_dir = tmp_path / "src" / "components"
        src_dir.mkdir(parents=True)
        test_file = src_dir / "App.tsx"
        test_file.write_text("// App")

        root = guardian._find_project_root(test_file)
        assert root == tmp_path

    def test_count_code_smells_python(self, guardian):
        """Test Python code smell counting."""
        clean = "def foo(x, y):\n    return x + y\n"
        dirty = "def foo(a,b,c,d,e,f,g,h):\n    except:\n        print('err')\n" + "x" * 121

        assert guardian._count_code_smells(clean, "py") == 0
        assert guardian._count_code_smells(dirty, "py") >= 3

    def test_count_code_smells_javascript(self, guardian):
        """Test JavaScript code smell counting."""
        clean_js = "const add = (a, b) => a + b;"
        dirty_js = "var x = 1;\nconsole.log('debug');\ndebugger;\nif (x == 1) {}\n" + "a" * 121

        assert guardian._count_code_smells(clean_js, "js") == 0
        assert guardian._count_code_smells(dirty_js, "js") >= 4  # var + console.log + debugger + == + long line

    def test_result_roundtrip(self):
        """Test OptimizationResult to_dict/from_dict roundtrip."""
        from codeguardian.core.result import QualityMetrics, PerformanceMetrics

        r = OptimizationResult(
            request_id="test-roundtrip",
            status=OptimizationStatus.NEEDS_REVIEW,
            original_file=Path("test.py"),
            tests_passed=True,
            human_review_required=True,
            reviewer_notes="looks good",
            ai_model="claude",
            optimization_prompt="optimize",
            test_output="all passed",
            benchmark_output="bench: ok",
        )
        r.quality = QualityMetrics(
            original_complexity=5, optimized_complexity=3,
            complexity_change_percent=-40.0,
            original_lines=50, optimized_lines=45, lines_delta=-5,
        )
        r.performance = PerformanceMetrics(
            original_time_ms=100.0, optimized_time_ms=80.0,
            time_change_percent=-20.0,
        )

        data = r.to_dict()
        r2 = OptimizationResult.from_dict(data)

        assert r2.request_id == "test-roundtrip"
        assert r2.status == OptimizationStatus.NEEDS_REVIEW
        assert r2.quality.lines_delta == -5
        assert r2.performance.time_change_percent == -20.0
        assert r2.reviewer_notes == "looks good"
        assert r2.ai_model == "claude"
        assert r2.optimization_prompt == "optimize"
        assert r2.test_output == "all passed"

    def test_result_json_roundtrip(self):
        """Test full JSON serialization roundtrip."""
        from codeguardian.core.result import QualityMetrics, PerformanceMetrics

        r = OptimizationResult(
            request_id="json-test",
            status=OptimizationStatus.NEEDS_REVIEW,
            original_file=Path("test.py"),
            tests_passed=True,
        )
        r.quality = QualityMetrics(lines_delta=-3)
        r.performance = PerformanceMetrics(time_change_percent=-15.0)

        json_str = json.dumps(r.to_dict(), default=str)
        loaded = OptimizationResult.from_dict(json.loads(json_str))

        assert loaded.request_id == "json-test"
        assert loaded.status == OptimizationStatus.NEEDS_REVIEW
        assert loaded.quality.lines_delta == -3

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
