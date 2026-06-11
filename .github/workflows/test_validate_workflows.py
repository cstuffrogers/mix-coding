#!/usr/bin/env python3
"""
Unit tests for archon workflow validation
"""

import sys
import unittest
import tempfile
from pathlib import Path
import yaml

sys.path.insert(0, str(Path(__file__).parent))

from validate_workflows import validate_workflow, VALID_NODE_TYPES, VALID_COMMANDS

class TestWorkflowValidation(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.workflows_dir = Path(self.temp_dir) / "workflows"
        self.workflows_dir.mkdir()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)

    def create_workflow(self, content: dict) -> Path:
        wf_path = self.workflows_dir / "test.yaml"
        with open(wf_path, 'w') as f:
            yaml.dump(content, f)
        return wf_path

    def test_valid_minimal_workflow(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'test-node',
                    'command': 'test-unit',
                    'description': 'Run unit tests'
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertTrue(validate_workflow(wf))

    def test_missing_description(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'test-node',
                    'command': 'test-unit'
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertTrue(validate_workflow(wf))  # description is a warning, not a failure

    def test_invalid_node_type(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'test-node',
                    'type': 'invalid_type',
                    'description': 'Test'
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertFalse(validate_workflow(wf))

    def test_valid_prompt_node(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'choose-strategy',
                    'prompt': 'Choose a strategy...',
                    'description': 'Interactive strategy selection'
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertTrue(validate_workflow(wf))

    def test_duplicate_node_id(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {'id': 'same-id', 'command': 'test-unit', 'description': 'First'},
                {'id': 'same-id', 'command': 'review-full', 'description': 'Second'}
            ]
        }
        wf = self.create_workflow(content)
        self.assertFalse(validate_workflow(wf))

    def test_broken_dependency(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'node-a',
                    'command': 'test-unit',
                    'description': 'Tests',
                    'depends_on': ['non-existent']
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertFalse(validate_workflow(wf))

    def test_valid_dependency(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'node-a',
                    'command': 'test-unit',
                    'description': 'Tests'
                },
                {
                    'id': 'node-b',
                    'command': 'review-full',
                    'description': 'Review',
                    'depends_on': ['node-a']
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertTrue(validate_workflow(wf))

    def test_missing_nodes_section(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
        }
        wf = self.create_workflow(content)
        self.assertFalse(validate_workflow(wf))

    def test_missing_required_top_fields(self):
        content = {
            'nodes': [
                {'id': 'test', 'command': 'test-unit', 'description': 'Test'}
            ]
        }
        wf = self.create_workflow(content)
        self.assertFalse(validate_workflow(wf))

    def test_unregistered_command_warns_but_passes(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'test-node',
                    'command': 'unknown-command-xyz',
                    'description': 'Test'
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertTrue(validate_workflow(wf))  # unregistered command is a warning

    def test_command_node_with_arguments(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'test-node',
                    'command': 'test-unit',
                    'description': 'Tests',
                    'arguments': 'mode=unit coverage=true'
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertTrue(validate_workflow(wf))

    def test_node_with_context_fresh(self):
        content = {
            'name': 'test-workflow',
            'description': 'A test workflow',
            'nodes': [
                {
                    'id': 'test-node',
                    'command': 'test-unit',
                    'description': 'Tests',
                    'context': 'fresh'
                }
            ]
        }
        wf = self.create_workflow(content)
        self.assertTrue(validate_workflow(wf))


class TestCommandRegistry(unittest.TestCase):
    def test_all_standard_commands_registered(self):
        expected = [
            'memory-recall', 'memory-remember', 'test-unit', 'review-full',
            'notify-complete', 'opendigger-analyze', 'run-suite', 'verify',
            'commit-push', 'build', 'auto-update', 'check-gate',
        ]
        for cmd in expected:
            self.assertIn(cmd, VALID_COMMANDS,
                          f"Command '{cmd}' should be in VALID_COMMANDS")

    def test_valid_node_types(self):
        self.assertIn('command', VALID_NODE_TYPES)
        self.assertIn('prompt', VALID_NODE_TYPES)


if __name__ == '__main__':
    unittest.main()
