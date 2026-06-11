#!/usr/bin/env node
/**
 * archon Workflow Validator (Node.js version)
 * Validates .archon/workflows/*.yaml structure.
 */

const fs = require('fs');
const path = require('path');

// Actual node types used in workflows
const VALID_NODE_KEYS = new Set(['command', 'prompt']);
const REQUIRED_FIELDS = ['id', 'description'];

function validateWorkflow(filepath) {
  console.log(`Validating ${path.basename(filepath)}...`);

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');

    const nodeIds = new Set();
    const dependencyMap = new Map(); // nodeId -> [depIds]
    let hasErrors = false;
    let currentNode = null;
    let inPrompt = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      const indent = line.length - line.trimStart().length;

      // Detect node start: "- id: xxx" at indent 2
      if (indent === 2 && /^- id:/.test(trimmed)) {
        // Validate previous node
        if (currentNode && currentNode.id) {
          const missing = REQUIRED_FIELDS.filter(f => !currentNode[f]);
          if (missing.length) {
            console.log(`  ❌ Node '${currentNode.id}' missing: ${missing.join(', ')}`);
            hasErrors = true;
          }
          if (currentNode.id) nodeIds.add(currentNode.id);
        }

        currentNode = {
          id: trimmed.replace(/^- id:\s*/, '').replace(/^["']|["']$/g, '')
        };
        dependencyMap.set(currentNode.id, []);
        inPrompt = false;
      }
      else if (currentNode && indent === 4 && !inPrompt) {
        // Parse node fields (indent 4)
        if (trimmed.startsWith('description:')) {
          currentNode.description = trimmed.replace(/^description:\s*/, '');
        } else if (trimmed.startsWith('command:')) {
          currentNode.command = trimmed.replace(/^command:\s*/, '');
          currentNode.type = 'command';
        } else if (trimmed.startsWith('prompt:')) {
          currentNode.type = 'prompt';
          inPrompt = true; // subsequent indented lines are prompt body
        } else if (trimmed.startsWith('depends_on:')) {
          const depStr = trimmed.replace(/^depends_on:\s*/, '');
          const deps = depStr.replace(/^\[|\]$/g, '').split(',').map(d => d.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
          dependencyMap.set(currentNode.id, deps);
        }
      }
      // Lines indented > 4 inside a prompt node are prompt body, skip
    }

    // Validate last node
    if (currentNode && currentNode.id) {
      const missing = REQUIRED_FIELDS.filter(f => !currentNode[f]);
      if (missing.length) {
        console.log(`  ❌ Node '${currentNode.id}' missing: ${missing.join(', ')}`);
        hasErrors = true;
      }
      if (currentNode.id) nodeIds.add(currentNode.id);
    }

    if (nodeIds.size === 0) {
      console.log('  ❌ No valid nodes found');
      return false;
    }

    // Check depends_on references
    for (const [nodeId, deps] of dependencyMap) {
      for (const dep of deps) {
        if (dep && !nodeIds.has(dep)) {
          console.log(`  ❌ Broken dependency: '${nodeId}' depends on non-existent '${dep}'`);
          hasErrors = true;
        }
      }
    }

    // Check duplicate IDs
    const allIdLines = lines
      .map((l, i) => ({ line: l.trim(), idx: i + 1 }))
      .filter(l => /^- id:/.test(l.line));
    const seen = new Map();
    for (const { line, idx } of allIdLines) {
      const id = line.replace(/^- id:\s*/, '');
      if (seen.has(id)) {
        console.log(`  ❌ Duplicate node ID '${id}' at line ${idx} (first at line ${seen.get(id)})`);
        hasErrors = true;
      } else {
        seen.set(id, idx);
      }
    }

    if (!hasErrors) {
      console.log(`  ✅ ${path.basename(filepath)} is valid (${nodeIds.size} nodes)`);
      return true;
    }
    return false;
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    return false;
  }
}

function main() {
  const workflowsDir = path.join(process.cwd(), '.archon', 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    console.error(`❌ Directory not found: ${workflowsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yaml'));
  console.log(`Found ${files.length} workflow files\n`);

  let allValid = true;
  for (const file of files) {
    if (!validateWorkflow(path.join(workflowsDir, file))) {
      allValid = false;
    }
  }

  console.log();
  if (allValid) {
    console.log('✅ All workflows are valid');
    process.exit(0);
  } else {
    console.log('❌ Some workflows have errors');
    process.exit(1);
  }
}

main();
