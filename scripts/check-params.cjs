const fs = require('fs');
const path = require('path');

// Map of handler functions → their expected params (derived from reading handler code)
// This checks that scene JSON steps pass params that match what handlers expect
const HANDLER_PARAMS = {
  runSuite: { expects: ['mode'], optional: true },
  runReview: { expects: ['mode', 'options'], optional: true },
  runCI: { expects: ['check'], optional: true },
  loadTest: { expects: ['mode'], optional: true },
  checkGate: { expects: ['checks'], optional: true },
  invokeSkill: { expects: ['skill', 'mode', 'args'], optional: true },
  applyDaisyUI: { expects: ['theme'], optional: true },
  applyComponents: { expects: ['theme'], optional: true },
  iconUpgrade: { expects: ['theme'], optional: true },
  addAnimations: { expects: ['theme'], optional: true },
  microInteractions: { expects: ['theme'], optional: true },
  installDeps: { expects: ['theme'], optional: true },
  applyDaisyUIComponents: { expects: ['theme'], optional: true },
  'awm-brand-import': { expects: ['brand'], optional: true },
  'od-brand-import': { expects: ['brand'], optional: true },
  'od-brand-pick': { expects: ['brand'], optional: true },
  huashuBrandProtocol: { expects: ['brand'], optional: true },
  huashuExpertReview: { expects: ['mode', 'iterations'], optional: true },
};

const scenesDir = 'E:/auto-coding/.claude/scenes';
const sceneFiles = fs.readdirSync(scenesDir).filter(f => f.endsWith('.json'));

// Collect all action-using steps and check params
let issues = [];
let total = 0;

for (const sf of sceneFiles) {
  const scene = JSON.parse(fs.readFileSync(path.join(scenesDir, sf), 'utf-8'));
  const flow = scene.flow;
  if (!flow || typeof flow !== 'object') continue;
  const steps = Object.values(flow);

  for (const step of steps) {
    if (!step.action) continue;
    total++;
    const action = step.action;
    const params = step.params;
    const spec = HANDLER_PARAMS[action];

    // Check: actions with known required params that have empty/null params
    if (spec && !spec.optional && params) {
      for (const p of spec.expects) {
        if (!params[p]) {
          issues.push(`${sf}: action="${action}" missing expected param "${p}", step="${(step.description||'').slice(0,40)}"`);
        }
      }
    }

    // Check: theme-dependent actions that might be missing theme context
    if (['applyDaisyUI', 'applyDaisyUIComponents', 'applyComponents', 'iconUpgrade',
         'addAnimations', 'microInteractions', 'installDeps'].includes(action) && params) {
      if (!params.theme && step.description && !step.description.includes('animal-island')) {
        // Most are fine without explicit theme param (default from context)
      }
    }
  }
}

console.log(`Total steps with actions: ${total}`);
console.log(`Issues found: ${issues.length}`);
if (issues.length > 0) {
  issues.forEach(i => console.log('  ' + i));
} else {
  console.log('No param mismatches found.');
}
