#!/usr/bin/env python3
"""Validate archon workflow YAML files."""
import sys, yaml
from pathlib import Path

WORKFLOWS_DIR = Path(__file__).parents[2] / '.archon' / 'workflows'
REQUIRED_TOP_FIELDS = {'name', 'description'}
VALID_NODE_TYPES = {'command', 'prompt', 'bash', 'loop'}
VALID_COMMANDS = {
    'analyze-dependencies', 'auto-fix', 'auto-update', 'build',
    'bump-version', 'check-breaking-changes', 'check-coverage',
    'check-env-file', 'check-gate', 'check-outdated', 'check-prerequisites',
    'code-scan', 'commit-push', 'cost-report', 'create-issue',
    'create-release', 'create-tag', 'dependency-audit', 'deploy',
    'detect-language', 'docs-update', 'generate-changelog', 'generate-env',
    'generate-report', 'git-leaks', 'install-deps', 'knip-check',
    'list-releases', 'memory-recall', 'memory-remember', 'notify-complete',
    'opendigger-analyze', 'performance-profile', 'production-build',
    'review-full', 'rollback', 'run-suite', 'sec-bug-hunt',
    'start-dev-server', 'test-coverage', 'test-unit', 'update-deps', 'verify',
}

def validate_node_chain(nodes):
    node_ids = {n['id'] for n in nodes}
    deps_from = set()
    deps_to = set()
    for n in nodes:
        for d in n.get('depends_on', []):
            if d not in node_ids:
                print(f"  [FAIL] Node '{n['id']}' depends on unknown node '{d}'")
                return False
            deps_from.add(n['id'])
            deps_to.add(d)
    entries = node_ids - deps_from
    terminals = node_ids - deps_to
    if not entries:
        print(f"  [FAIL] No entry node found (circular dependency?)")
        return False
    if not terminals:
        print(f"  [FAIL] No terminal node found")
        return False
    return True

def validate_workflow(filepath):
    name = filepath.name
    print(f"Validating {name}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            print(f"  [FAIL] YAML syntax error: {e}")
            return False
    if not isinstance(data, dict):
        print(f"  [FAIL] Not a mapping")
        return False
    for field in REQUIRED_TOP_FIELDS:
        if field not in data:
            print(f"  [FAIL] Missing required field: {field}")
            return False
    if 'nodes' not in data:
        print(f"  [FAIL] Missing 'nodes' section")
        return False
    node_ids = set()
    for node in data['nodes']:
        nid = node.get('id')
        if not nid:
            print(f"  [FAIL] Node missing 'id'")
            return False
        if nid in node_ids:
            print(f"  [FAIL] Duplicate node ID: {nid}")
            return False
        node_ids.add(nid)
        ntype = node.get('type', 'command')
        if ntype not in VALID_NODE_TYPES:
            print(f"  [FAIL] Node '{nid}' has invalid type '{ntype}'")
            return False
        if 'description' not in node:
            print(f"  [WARN]  Node '{nid}' missing description")
        cmd = node.get('command')
        if cmd and cmd not in VALID_COMMANDS:
            print(f"  [WARN]  Node '{nid}' uses unregistered command '{cmd}'")
    if not validate_node_chain(data['nodes']):
        return False
    print(f"  [OK] {len(data['nodes'])} nodes, valid")
    return True

def main():
    yamls = sorted(WORKFLOWS_DIR.glob('*.yaml'))
    if not yamls:
        print("No YAML files found!")
        sys.exit(1)
    ok = 0
    for y in yamls:
        if validate_workflow(y):
            ok += 1
    print(f"\nResults: {ok}/{len(yamls)} passed")
    sys.exit(0 if ok == len(yamls) else 1)

if __name__ == '__main__':
    main()