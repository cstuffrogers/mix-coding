#!/usr/bin/env python3
"""
Run validation tests for archon workflows
"""

import sys
import unittest
from pathlib import Path

# Add workflows directory to Python path for importing validate_workflows
workflows_dir = Path(__file__).parent
sys.path.insert(0, str(workflows_dir))

try:
    from validate_workflows import validate_workflow
except ImportError as e:
    print(f"Failed to import validate_workflows: {e}")
    print("Make sure you're running from project root")
    sys.exit(1)

def test_all_workflows():
    """Test all workflow files in .archon/workflows"""
    workflows_path = Path(".archon/workflows")
    if not workflows_path.exists():
        print(f"[FAIL] Workflows directory not found: {workflows_path}")
        return False

    yaml_files = list(workflows_path.glob("*.yaml"))
    if not yaml_files:
        print(f"[FAIL] No YAML workflow files found in {workflows_path}")
        return False

    print(f"Found {len(yaml_files)} workflow files\n")

    all_valid = True
    for wf in yaml_files:
        print(f"Testing {wf.name}...")
        if not validate_workflow(wf):
            all_valid = False
            print(f"  [FAIL] {wf.name} FAILED validation")
        else:
            print(f"  [OK] {wf.name} passed")

    print()
    if all_valid:
        print("[OK] All workflow validation tests passed!")
        return True
    else:
        print("[FAIL] Some workflows failed validation")
        return False

if __name__ == '__main__':
    success = test_all_workflows()
    sys.exit(0 if success else 1)
