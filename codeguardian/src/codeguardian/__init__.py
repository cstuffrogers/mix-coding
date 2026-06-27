"""CodeGuardian - AI Code Optimization Guardian.

Prevent over-optimization and negative optimization in AI-assisted code refactoring.
"""

__version__ = "0.1.0"

from codeguardian.core.guardian import CodeGuardian
from codeguardian.core.config import GuardianConfig
from codeguardian.core.result import OptimizationResult

__all__ = ["CodeGuardian", "GuardianConfig", "OptimizationResult"]
