// Scene classification config for sync-docs.js
// Extracted to reduce sync-docs.js size (architectural deep audit: god_object fix)

export const PROMPT_SCENES = new Set([
  'feature', 'bugfix', 'refactor', 'new-project', 'design', 'analyze', 'prototype',
]);


export const SKIP_ENHANCEMENT = new Set([
  'bugfix', 'loop', 'optimize',
  'deps', 'setup', 'cicd', 'backup', 'incident',
  'changelog', 'sbom', 'log', 'prototype', 'rollback', 'onboard',
  'migration', 'loadtest',
]);

