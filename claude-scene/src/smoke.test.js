import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync, mkdirSync, rmSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const SCENES_DIR = join(__dirname, '..', '..', '.claude', 'scenes');
const HANDLERS_DIR = join(__dirname, 'handlers');
const DATA_DIR = join(__dirname, 'data');

// ═══ Mocks ═══

const chalkFn = (s) => s;
const colors = ['bold', 'dim', 'green', 'red', 'yellow', 'blue', 'cyan', 'magenta',
  'white', 'gray', 'grey', 'black', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue',
  'underline', 'italic', 'strikethrough', 'inverse', 'hidden', 'reset'];
for (const c of colors) chalkFn[c] = chalkFn;

vi.mock('chalk', () => ({
  default: new Proxy(chalkFn, { get: () => chalkFn }),
}));

vi.mock('./lib/safe-exec.js', () => ({
  safeExec: vi.fn(() => 'mocked-output'),
  escapeArg: vi.fn((v) => `'${String(v)}'`),
}));

vi.mock('./lib/scan-dir.js', () => ({
  scanDir: vi.fn(() => []),
}));

// ═══ Helpers ═══

function readJsonOrNull(p) {
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function makeTempDir() {
  const dir = join(tmpdir(), `smoke-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'smoke', type: 'module' }));
  return dir;
}

// ═══ 1. Dead action check ═══

function collectRegisteredKeys() {
  const registrySrc = readFileSync(join(__dirname, 'actions.js'), 'utf-8');
  const msgSrc = readFileSync(join(DATA_DIR, 'action-messages.js'), 'utf-8');
  const uiSrc = existsSync(join(HANDLERS_DIR, 'ui-polish.js'))
    ? readFileSync(join(HANDLERS_DIR, 'ui-polish.js'), 'utf-8') : '';
  const keyRe = /(?:^|[\s,{])(?:'([^']+)'|"([^"]+)"|(\w+))\s*:/gm;
  const extract = (s) => {
    const keys = new Set(); let m;
    while ((m = keyRe.exec(s)) !== null) keys.add(m[1] || m[2] || m[3]);
    return keys;
  };
  return new Set([...extract(registrySrc), ...extract(uiSrc), ...extract(msgSrc)]);
}

function collectSceneActions() {
  if (!existsSync(SCENES_DIR)) return [];
  const actions = [];
  for (const f of readdirSync(SCENES_DIR).filter(x => x.endsWith('.json') && !x.startsWith('_'))) {
    const scene = readJsonOrNull(join(SCENES_DIR, f));
    if (!scene?.flow) continue;
    for (const step of Object.values(scene.flow)) {
      if (step.action) actions.push({ scene: f, action: step.action, step: (step.description || '').slice(0, 60) });
    }
  }
  return actions;
}

describe('dead action references', () => {
  it('every scene JSON action has a registered handler or message', () => {
    const allKeys = collectRegisteredKeys();
    const dead = [];
    for (const { scene, action, step } of collectSceneActions()) {
      if (action.includes(' ')) continue;
      if (!allKeys.has(action)) dead.push(`${scene}: "${action}" — ${step}`);
    }
    expect(dead).toEqual([]);
  });
});

// ═══ 2. Handler smoke test ═══

const SMOKE_SKIP = new Set([
  'generateDesign', 'exportAssets', 'persist', 'input', 'designInput', 'generateDRY',
  'createBranch', 'commitPush', 'createPR', 'createTag', 'createRelease',
  'autoUpdate', 'bumpVersion', 'deploy', 'rollback', 'listReleases', 'createIssue',
]);

const OVERRIDES = {
  'ce-compound': ['ce-compound', {}, '/test', {}],
  'ce-plan': ['ce-plan', {}, '/test', {}],
  'ce-review': ['ce-review', {}, '/test', {}],
  'ce-debug': ['ce-debug', {}, '/test', {}],
  'ce-brainstorm': ['ce-brainstorm', {}, '/test', {}],
  'ce-work': ['ce-work', {}, '/test', {}],
  invokeSkill: [null, { skill: 'test', mode: 'cli' }, '/test', {}],
  runSuite: [null, { mode: 'unit' }, '/test', {}],
  run_suite: [null, { mode: 'unit' }, '/test', {}],
  runCI: [null, { check: [] }, '/test', {}],
  runReview: [null, { mode: 'none', options: { rules: [] } }, '/test', {}],
  loadTest: [null, { mode: 'smoke' }, '/test', {}],
  select: [null, { options: ['test'] }, '/test', {}],
  choose: [null, { options: [{ label: 'test' }] }, '/test', {}],
  askUser: [null, { type: 'confirm', default: true }, '/test', {}],
  send: [null, { title: 'test', content: 'test' }, '/test'],
  notify: [null, { message: 'test' }, '/test'],
  checkGate: [null, { checks: [] }, '/test', {}],
};

describe('handler smoke tests', () => {
  it('all ACTION_REGISTRY handlers return a value without throwing', async () => {
    const { ACTION_REGISTRY } = await import('./actions.js');
    const entries = Object.entries(ACTION_REGISTRY);
    expect(entries.length).toBeGreaterThanOrEqual(70);

    const tempDir = makeTempDir();
    const failures = [];
    try {
      for (const [name, handler] of entries) {
        if (SMOKE_SKIP.has(name)) continue;
        try {
          const ctx = { targetPath: tempDir };
          const overrides = OVERRIDES[name];
          let result = overrides ? handler(...overrides) : handler(null, {}, tempDir, ctx);
          if (result instanceof Promise) result = await result;

          if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
            if (Object.keys(result).length === 0) failures.push(`${name}: empty object`);
          } else if (typeof result !== 'string') {
            failures.push(`${name}: ${typeof result} — ${JSON.stringify(result).slice(0, 60)}`);
          } else if (result.length === 0) {
            failures.push(`${name}: empty string`);
          }
        } catch (e) {
          failures.push(`${name}: THREW — ${e.message?.slice(0, 150)}`);
        }
      }
    } finally {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ok */ }
    }

    expect(failures).toEqual([]);
  }, 120000);
});

// ═══ 3. await-safeExec anti-pattern ═══

describe('no await safeExec anti-pattern', () => {
  it('handler files never use await on synchronous safeExec', () => {
    if (!existsSync(HANDLERS_DIR)) return;
    const violations = [];
    const awaitRe = /\bawait\s+safeExec\s*\(/;
    function scan(dir) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { scan(full); continue; }
        if (!e.name.endsWith('.js')) continue;
        const lines = readFileSync(full, 'utf-8').split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (awaitRe.test(lines[i])) {
            violations.push(`${full.replace(__dirname, 'handlers')}:${i + 1}`);
          }
        }
      }
    }
    scan(HANDLERS_DIR);
    expect(violations).toEqual([]);
  });
});

// ═══ 4. scene JSON well-formedness ═══

describe('scene JSON integrity', () => {
  it('all scene JSONs are valid and have scene_id + flow fields', () => {
    if (!existsSync(SCENES_DIR)) return;
    const broken = [];
    for (const f of readdirSync(SCENES_DIR).filter(x => x.endsWith('.json'))) {
      const scene = readJsonOrNull(join(SCENES_DIR, f));
      if (!scene) { broken.push(`${f}: invalid JSON`); continue; }
      if (!scene.scene_id) broken.push(`${f}: missing scene_id`);
      if (!scene.flow) broken.push(`${f}: missing flow`);
    }
    expect(broken).toEqual([]);
  });
});
