#!/usr/bin/env node
/**
 * Workflow Validation Script — checks EVERY handler, context pipe, condition,
 * and on_error contract across ALL 34 scene files in one pass.
 *
 * Usage: node src/scripts/validate-workflows.js
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = join(__dirname, '..', '..', '..', '.claude', 'scenes');
const ROOT = join(__dirname, '..', '..');

const errors = [];
const warnings = [];

function err(severity, msg) {
  (severity === 'ERROR' ? errors : warnings).push(`[${severity}] ${msg}`);
}

// ── 1. Load all scene files ──
const sceneFiles = readdirSync(SCENES_DIR).filter(f => f.endsWith('.json'));
const scenes = {};
for (const f of sceneFiles) {
  try {
    scenes[f.replace('.json', '')] = JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf-8'));
  } catch (e) {
    err('ERROR', `无法解析场景文件 ${f}: ${e.message}`);
  }
}

// ── 2. Extract UI_POLISH_ACTIONS and ACTION_REGISTRY ──

// Read ui-polish.js to extract UI_POLISH_ACTIONS map
const uiPolishSrc = readFileSync(join(ROOT, 'src', 'handlers', 'ui-polish.js'), 'utf-8');

// Extract UI_POLISH_ACTIONS keys — use brace-depth tracking to handle nested {} in handlers
const uiPolishActions = new Set();
const uiConstIdx = uiPolishSrc.indexOf('const UI_POLISH_ACTIONS = {');
if (uiConstIdx !== -1) {
  let depth = 0;
  const blockStart = uiPolishSrc.indexOf('{', uiConstIdx);
  let blockEnd = blockStart;
  for (let i = blockStart; i < uiPolishSrc.length; i++) {
    if (uiPolishSrc[i] === '{') depth++;
    else if (uiPolishSrc[i] === '}') { depth--; if (depth === 0) { blockEnd = i + 1; break; } }
  }
  const block = uiPolishSrc.slice(blockStart, blockEnd);
  // Match top-level keys: 2-space indent + key + colon (handles both bare and quoted keys)
  const keyRe = /^\s+([\w-]+|'[\w-]+')\s*:/gm;
  let m;
  while ((m = keyRe.exec(block)) !== null) {
    const key = m[1].replace(/^'|'$/g, '');
    if (!['handler', 'args'].includes(key)) uiPolishActions.add(key);
  }
}

// Read actions.js to extract ACTION_REGISTRY keys
const actionsSrc = readFileSync(join(ROOT, 'src', 'actions.js'), 'utf-8');
const actionRegistry = new Set();

// Match: actionName: handlerFunction  AND  'action-name': handlerFunction
// Handler can be a named function or arrow function: handleXxx or (_a, _p) => ...
// Leading whitespace may be tabs or spaces — use \s+ to handle both
const actionRe = /^\s+([\w-]+|'[\w-]+')\s*:\s*(?!\s*\{)[\w(]/gm;
let am;
while ((am = actionRe.exec(actionsSrc)) !== null) {
  const key = am[1].replace(/^'|'$/g, '');
  if (!['handler', 'args'].includes(key)) actionRegistry.add(key);
}

// Also extract ce-* handlers (they also appear as 'ce-xxx': handleCeAction)
const ceActions = new Set();
const ceRe = /^\s+(?:'ce-([\w-]+)'|ce-([\w-]+))\s*:/gm;
let cm;
while ((cm = ceRe.exec(actionsSrc)) !== null) {
  ceActions.add(`ce-${cm[1] || cm[2]}`);
}

console.log(`加载: ${Object.keys(scenes).length} 个场景, ${uiPolishActions.size} 个 UI_POLISH_ACTIONS, ${actionRegistry.size} 个 ACTION_REGISTRY, ${ceActions.size} 个 CE actions`);

// ── 3. Extract handler signatures (which accept context) ──

// Read a handler file and find which functions accept context param
function extractHandlerSignatures(filePath) {
  if (!existsSync(filePath)) return {};
  const src = readFileSync(filePath, 'utf-8');
  const sigs = {};
  // Match: export function handleXxx(param1, param2, param3, context) or (param1, param2, context)
  const fnRe = /export\s+function\s+(handle\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = fnRe.exec(src)) !== null) {
    const name = m[1];
    const params = m[2].split(',').map(p => p.trim());
    sigs[name] = {
      paramCount: params.length,
      hasContext: params.some(p => p.startsWith('context')),
      params: params,
    };
  }
  return sigs;
}

const handlerFiles = [
  'flow-control.js', 'design.js', 'ui-tools.js', 'testing.js',
  'git.js', 'review.js', 'api-consistency.js', 'skill-runner.js',
  'ui-polish.js',
];
const handlerSigs = {};
for (const f of handlerFiles) {
  Object.assign(handlerSigs, extractHandlerSignatures(join(ROOT, 'src', 'handlers', f)));
}

// ── 4. Extract context keys SET and READ by each handler ──

function extractContextUsage(filePath) {
  if (!existsSync(filePath)) return {};
  const src = readFileSync(filePath, 'utf-8');
  const usage = {};

  // Find functions and analyze their bodies
  const fnRe = /export\s+function\s+(handle\w+)\s*\(([^)]*)\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
  let m;
  while ((m = fnRe.exec(src)) !== null) {
    const name = m[1];
    const body = m[3];

    // Find context.SOME_KEY = value
    const sets = new Set();
    const setRe = /context\??\.(\w+)\s*=/g;
    let sm;
    while ((sm = setRe.exec(body)) !== null) {
      if (!['lastStepFailed', 'targetPath', 'completedSteps'].includes(sm[1])) {
        sets.add(sm[1]);
      }
    }

    // Find context?.SOME_KEY or context.SOME_KEY (reads)
    const reads = new Set();
    const readRe = /context\??\.(\w+)/g;
    let rm;
    while ((rm = readRe.exec(body)) !== null) {
      if (!rm[1].startsWith('_') && !['lastStepFailed', 'targetPath', 'completedSteps'].includes(rm[1])) {
        reads.add(rm[1]);
      }
    }

    usage[name] = { sets: [...sets], reads: [...reads] };
  }

  // Also catch local functions (not exported)
  const localFnRe = /function\s+(handle\w+|replace\w+)\s*\(([^)]*)\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
  let lm;
  while ((lm = localFnRe.exec(src)) !== null) {
    const name = lm[1];
    if (usage[name]) continue;
    const body = lm[3];
    const sets = new Set();
    const setRe = /context\??\.(\w+)\s*=/g;
    let sm;
    while ((sm = setRe.exec(body)) !== null) {
      if (!['lastStepFailed', 'targetPath', 'completedSteps'].includes(sm[1])) {
        sets.add(sm[1]);
      }
    }
    const reads = new Set();
    const readRe = /context\??\.(\w+)/g;
    let rm;
    while ((rm = readRe.exec(body)) !== null) {
      if (!rm[1].startsWith('_') && !['lastStepFailed', 'targetPath', 'completedSteps'].includes(rm[1])) {
        reads.add(rm[1]);
      }
    }
    usage[name] = { sets: [...sets], reads: [...reads] };
  }

  return usage;
}

const handlerUsage = {};
for (const f of handlerFiles) {
  Object.assign(handlerUsage, extractContextUsage(join(ROOT, 'src', 'handlers', f)));
}

// Also add security handlers
const securityFiles = ['npm-scan.js', 'secret-scan.js', 'threat-scan.js', 'config-check.js'];
for (const f of securityFiles) {
  Object.assign(handlerUsage, extractContextUsage(join(ROOT, 'src', 'handlers', 'security', f)));
}

// ── 5. Map action name → handler function name ──

const actionToHandler = {};
const handlerImportRe = /import\s+\{([^}]+)\}\s+from\s+['"]\.\/handlers\/([^'"]+)['"]/g;
let im;
while ((im = handlerImportRe.exec(actionsSrc)) !== null) {
  const names = im[1].split(',').map(n => n.trim()).filter(n => n.startsWith('handle'));
  for (const n of names) {
    // Don't overwrite — first import wins
    if (!actionToHandler[n]) actionToHandler[n] = n;
  }
}

// Map from action registry name → handler name (both bare and quoted keys)
const actionNameToHandlerName = {};
const actionMapRe = /^\s+([\w-]+|'[\w-]+')\s*:\s*(?!\s*\{)(\w+|\([\w,\s]*\)\s*=>)/gm;
let arm;
while ((arm = actionMapRe.exec(actionsSrc)) !== null) {
  const key = arm[1].replace(/^'|'$/g, '');
  const handler = arm[2];
  // Arrow function stubs ((_a, _p) => ...) have no named handler
  if (handler && !handler.startsWith('(')) {
    actionNameToHandlerName[key] = handler;
  }
}

// Also map ui-polish actions: keyName: { handler: handlerName, ... }
const uiPolishActionRe = /(\w+(?:-\w+)*|'[\w-]+')\s*:\s*\{[^}]*handler:\s*(?:\([^)]*\)\s*=>\s*)?(\w+)/g;
let um;
while ((um = uiPolishActionRe.exec(uiPolishSrc)) !== null) {
  const key = um[1].replace(/^'|'$/g, '');
  actionNameToHandlerName[key] = um[2];
}

// ── 6. Build template variable pattern for context key detection ──

const templateRe = /\$\{(\w+)\}/g;

// ── 7. Read conditions.js for valid condition keys ──

const conditionsSrc = readFileSync(join(ROOT, 'src', 'lib', 'conditions.js'), 'utf-8');
const simpleConditions = new Set();
const condKeyRe = /^\s+(\w+):\s/mg;
let ck;
while ((ck = condKeyRe.exec(conditionsSrc)) !== null) {
  simpleConditions.add(ck[1]);
}

// ── 8. Validate every scene ──

for (const [sceneId, scene] of Object.entries(scenes)) {
  if (!scene.flow) continue;

  // Track context keys set by previous steps in this scene
  const keysSetInScene = new Set();
  // Pre-populated context keys (from startScene)
  const prePopulated = new Set(['prompt', 'targetPath', 'selectedTheme', 'securityScanResult',
    'selectedOption', 'database_required', 'payment_required', 'email_required',
    'refactor_points', '_sceneId', 'completedSteps', 'lastStepFailed',
  ]);
  prePopulated.forEach(k => keysSetInScene.add(k));

  // Enhancement keys (enh_* prefix)
  for (const k of Object.keys(scene).filter(k => k.startsWith('enh_'))) {
    keysSetInScene.add(k);
  }

  const stepNumbers = new Set();

  for (const step of scene.flow) {
    const { action, step: stepNum, condition, on_error, params, description } = step;

    // Check step number uniqueness
    if (stepNumbers.has(stepNum)) {
      err('ERROR', `${sceneId}.json step ${stepNum}: 步骤编号重复 (${action})`);
    }
    stepNumbers.add(stepNum);

    // Check handler exists
    const isCeAction = action && action.startsWith('ce-');
    const isUiPolishScene = sceneId === 'ui-polish';

    if (!action) continue; // skip steps without action

    let isHandlerExists = false;
    let handlerName = null;

    if (isCeAction) {
      isHandlerExists = ceActions.has(action);
      handlerName = 'handleCeAction';
    } else if (isUiPolishScene && uiPolishActions.has(action)) {
      isHandlerExists = true;
      handlerName = actionNameToHandlerName[action] || 'unknown';
    } else if (actionRegistry.has(action)) {
      isHandlerExists = true;
      handlerName = actionNameToHandlerName[action] || 'unknown';
    }

    if (!isHandlerExists) {
      err('ERROR', `${sceneId}.json step ${stepNum}: 动作 "${action}" 未注册到任何 handler`);
      continue;
    }

    // Check context acceptance
    if (handlerName && handlerSigs[handlerName]) {
      const sig = handlerSigs[handlerName];
      if (!sig.hasContext && on_error === 'abort') {
        // Handler doesn't accept context — can it still set lastStepFailed?
        // If it throws, executeAction/executeUIPolish catch block handles it
        err('WARN', `${sceneId}.json step ${stepNum}: ${handlerName} 不接受 context 但有 on_error="${on_error}". 异常传播可设置 lastStepFailed，但静默失败不会被检测。`);
      }
    }

    // Check condition references valid keys
    if (condition) {
      // Extract individual condition terms
      const terms = condition.split(/\s*&&\s*/).map(t => t.trim());
      for (const term of terms) {
        if (term.startsWith('!')) {
          const key = term.slice(1);
          if (!simpleConditions.has(key) && !keysSetInScene.has(`enh_${key}`)) {
            err('WARN', `${sceneId}.json step ${stepNum}: 条件 "${term}" 中的键 "${key}" 可能永远不成立（不在 SIMPLE_CONDITIONS 且未被前置步骤设置）`);
          }
        } else if (/^\w+$/.test(term) && !simpleConditions.has(term) && !keysSetInScene.has(term) && !keysSetInScene.has(`enh_${term}`)) {
            // Check if it's an enhancement key
            if (term.startsWith('enh_') || simpleConditions.has(term)) {
              // handled above
            } else {
              err('WARN', `${sceneId}.json step ${stepNum}: 条件 "${term}" 不在 SIMPLE_CONDITIONS 中且未见前置步骤设置（可能永远跳过）`);
            }
          }
      }
    }

    // Check params template variables
    if (params) {
      const paramsStr = JSON.stringify(params);
      let tm;
      while ((tm = templateRe.exec(paramsStr)) !== null) {
        const varName = tm[1];
        if (!keysSetInScene.has(varName) && !prePopulated.has(varName)) {
          err('WARN', `${sceneId}.json step ${stepNum}: 参数模板 \${${varName}} 引用的键未被前置步骤设置`);
        }
      }
    }

    // Track what this step sets
    if (handlerName && handlerUsage[handlerName]) {
      for (const key of handlerUsage[handlerName].sets) {
        keysSetInScene.add(key);
      }
    }

    // Also track condition flags and enhancement keys
    if (condition) {
      const terms = condition.split(/\s*&&\s*/).map(t => t.trim());
      for (const term of terms) {
        const key = term.startsWith('!') ? term.slice(1) : term;
        if (/^\w+$/.test(key)) {
          keysSetInScene.add(key);
        }
      }
    }
  }
}

// ── 9. Check on_error: "abort" handlers specifically ──

// Handlers known to set lastStepFailed explicitly
const knownAbortSafe = new Set([
  'handleAutoUpdate', 'handleBumpVersion', 'handleCreateTag',
  'handleRunSuite', 'handleVerify', 'handleLoadTest',
  'handleRunReview', 'handleCheckAPIConsistency', 'handleCheckGate',
]);

for (const [sceneId, scene] of Object.entries(scenes)) {
  if (!scene.flow) continue;
  for (const step of scene.flow) {
    if (step.on_error === 'abort' && step.action) {
      const handlerName = actionNameToHandlerName[step.action];
      if (handlerName && !knownAbortSafe.has(handlerName)) {
        // Check if handler or its wrapper sets lastStepFailed
        const usage = handlerUsage[handlerName];
        if (usage && !usage.sets.includes('lastStepFailed')) {
          err('WARN', `${sceneId}.json step ${step.step}: ${handlerName} (${step.action}) 有 on_error=abort 但不显式设置 lastStepFailed。依赖 executeAction/executeUIPolish catch 块。`);
        }
      }
    }
  }
}

// ── 10. Report ──

console.log('\n' + '='.repeat(70));
console.log(`  验证完成: ${errors.length} 个错误, ${warnings.length} 个警告`);
console.log('='.repeat(70) + '\n');

if (errors.length > 0) {
  console.log('❌ 错误 (必须修复):');
  for (const e of errors) console.log('  ' + e);
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  警告 (建议修复):');
  for (const w of warnings) console.log('  ' + w);
  console.log('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ 所有工作流验证通过！');
}

process.exit(errors.length > 0 ? 1 : 0);
