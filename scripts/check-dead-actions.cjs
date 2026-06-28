const fs = require('fs');
const path = require('path');

const actionsContent = fs.readFileSync('E:/auto-coding/claude-scene/src/actions.js', 'utf-8');
const actionMessagesContent = fs.readFileSync('E:/auto-coding/claude-scene/src/data/action-messages.js', 'utf-8');
const uiPolishContent = fs.readFileSync('E:/auto-coding/claude-scene/src/handlers/ui-polish.js', 'utf-8');

const scenesDir = 'E:/auto-coding/.claude/scenes';
const sceneFiles = fs.readdirSync(scenesDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

function actionExists(action) {
  const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match bare key, 'single-quoted', or "double-quoted" key in object literals
  const keyPattern = '(?:^|[\\s,{])(?:\'' + escaped + '\'|"' + escaped + '"|' + escaped + ')\\s*:';
  const re = new RegExp(keyPattern, 'm');
  if (re.test(actionsContent)) return true;
  if (re.test(uiPolishContent)) return true;
  if (re.test(actionMessagesContent)) return true;
  // Special: shell commands (git diff, etc.)
  if (action.includes(' ')) return true;
  return false;
}

let deadActions = [];
let totalRefs = 0;

for (const sf of sceneFiles) {
  const scene = JSON.parse(fs.readFileSync(path.join(scenesDir, sf), 'utf-8'));
  const flow = scene.flow;
  if (!flow || typeof flow !== 'object') continue;
  const steps = Object.values(flow);
  for (const step of steps) {
    if (!step.action) continue;
    totalRefs++;
    const action = step.action;
    if (!actionExists(action)) {
      deadActions.push({ scene: sf, action, step: (step.description || '').slice(0, 60) });
    }
  }
}

console.log('Total action references: ' + totalRefs);
console.log('Dead references: ' + deadActions.length);
if (deadActions.length > 0) {
  console.log('');
  for (const d of deadActions) {
    console.log('  ' + d.scene + ': "' + d.action + '" — ' + d.step);
  }
} else {
  console.log('All actions have valid handlers or messages!');
}
