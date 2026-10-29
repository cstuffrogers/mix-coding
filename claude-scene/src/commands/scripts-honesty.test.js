import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PSEUDO_ACTIONS } from '../data/pseudo-actions.js';

// ── 校验脚本自己的诚实性（第二十三轮）──
//
// `scripts/` 下这几个脚本被文档与审计报告当成「已验证」：
//   · check-dead-actions.cjs 扫出 4 条死引用，然后 exit 0 —— 报告是假的；
//   · check-params.cjs 每一条契约都标 optional，唯一会报错的 `!spec.optional`
//     分支结构上永远进不去 —— 它只会打印「Issues found: 0」；
//   · find-deadcode.cjs 是 find-deadcode-full.cjs 的子集，两套判据会漂移；
//   · scan-scenes.cjs 只认 `flow.length`，而 flow 早已是对象 → 每个场景 steps 都是
//     undefined，JSON.stringify 把字段丢掉，屏幕照样一片正常；
//   · audit-scenes.mjs 读到 0 个场景也报「0 错误 / 0 警告」。
//
// 结论：校验脚本的退出码就是它的结论，截图式的「跑了没报错」不算通过。

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPTS = join(ROOT, 'scripts');
const LIVE_ACTIONS = ['alpha', 'beta', 'gamma', 'selectModes'];

function run(script, args) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** 临时 stats 输出文件路径（单独一层目录，方便整目录删）。 */
function tmpOut() {
  const dir = mkdtempSync(join(tmpdir(), 'stats-out-'));
  return join(dir, 'stats.json');
}

function write(file, body) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

/** 造一个够「扫描面下限」的动作 fixture：20 个场景 × 20 步 = 400 条引用。 */
function actionFixture(extraAction) {
  const root = mkdtempSync(join(tmpdir(), 'deadact-'));
  write(join(root, 'claude-scene/src/actions.js'), 'const A = { alpha: 1, beta: 2 };\n');
  write(join(root, 'claude-scene/src/handlers/ui-polish.js'), 'const UI_POLISH_ACTIONS = { gamma: 1 };\n');
  write(join(root, 'claude-scene/src/data/pseudo-actions.js'), "export const PSEUDO_ACTIONS = new Set(['selectModes']);\n");
  for (let i = 0; i < 20; i += 1) {
    const flow = {};
    for (let j = 0; j < 20; j += 1) {
      const action = j === 19 && extraAction ? extraAction : LIVE_ACTIONS[j % LIVE_ACTIONS.length];
      flow[`s${j}`] = { action, description: `步 ${j}` };
    }
    write(join(root, `.claude/scenes/scene-${i}.json`), JSON.stringify({ flow }));
  }
  return root;
}

/** 造一个场景目录：`shape` 决定 flow 是对象还是数组。 */
function sceneFixture(count, shape) {
  const dir = mkdtempSync(join(tmpdir(), 'scenestats-'));
  for (let i = 0; i < count; i += 1) {
    const flow = shape === 'array'
      ? [{}, {}, {}]
      : { a: {}, b: {}, c: {}, d: {}, e: {} };
    write(join(dir, `s${i}.json`), JSON.stringify({ name: `场景${i}`, flow, description: 'x' }));
  }
  return dir;
}

describe('check-dead-actions.cjs：假红修好了，退出码是真的', () => {
  it('真仓库扫完是 0 条死引用（和 scene-contract.test.js 的判断一致）', () => {
    const { status, out } = run('check-dead-actions.cjs', []);
    expect(out).toContain('Dead references: 0');
    expect(status).toBe(0);
  });

  it('伪动作不算死引用（以前 selectModes / selectSetupKind 被报死，脚本还 exit 0）', () => {
    const root = actionFixture(null);
    try {
      const { status, out } = run('check-dead-actions.cjs', [root]);
      expect(out).toContain('Dead references: 0');
      expect(status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('真有死引用 → 退出码 1 并点名', () => {
    const root = actionFixture('totallyMissingAction');
    try {
      const { status, out } = run('check-dead-actions.cjs', [root]);
      expect(status).toBe(1);
      expect(out).toContain('totallyMissingAction');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('一个场景都没扫到 → 退出码 2，不许报成 0 dead', () => {
    const root = mkdtempSync(join(tmpdir(), 'deadact-empty-'));
    try {
      const { status, out } = run('check-dead-actions.cjs', [root]);
      expect(status).toBe(2);
      expect(out).toContain('扫描面塌了');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('scan-scenes.cjs：写出去的步骤数必须是真的', () => {
  it('flow 是对象（现格式）时按 key 数统计，不许写出没有 steps 的记录', () => {
    const dir = sceneFixture(21, 'object');
    const out = tmpOut();
    try {
      const r = run('scan-scenes.cjs', [dir, out]);
      expect(r.status).toBe(0);
      const stats = JSON.parse(readFileSync(out, 'utf-8'));
      expect(Object.keys(stats)).toHaveLength(21);
      for (const info of Object.values(stats)) expect(info.steps).toBe(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(dirname(out), { recursive: true, force: true });
    }
  });

  it('flow 是数组（老格式）也认，不因为形状变了就静默丢数据', () => {
    const dir = sceneFixture(21, 'array');
    const out = tmpOut();
    try {
      const r = run('scan-scenes.cjs', [dir, out]);
      expect(r.status).toBe(0);
      const stats = JSON.parse(readFileSync(out, 'utf-8'));
      for (const info of Object.values(stats)) expect(info.steps).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(dirname(out), { recursive: true, force: true });
    }
  });

  it('有场景读不出步骤数 → 退出码 1，且不覆盖已有的 stats 文件', () => {
    const dir = sceneFixture(20, 'object');
    const outDir = mkdtempSync(join(tmpdir(), 'stats-out-'));
    const out = join(outDir, 'stats.json');
    writeFileSync(out, '{"旧数据":true}\n');
    write(join(dir, 'broken.json'), JSON.stringify({ name: '坏的', flow: null }));
    try {
      const r = run('scan-scenes.cjs', [dir, out]);
      expect(r.status).toBe(1);
      expect(r.out).toContain('broken.json');
      expect(readFileSync(out, 'utf-8')).toBe('{"旧数据":true}\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('场景太少 → 退出码 2', () => {
    const dir = sceneFixture(3, 'object');
    const outDir = mkdtempSync(join(tmpdir(), 'stats-out-'));
    const out = join(outDir, 'stats.json');
    try {
      const r = run('scan-scenes.cjs', [dir, out]);
      expect(r.status).toBe(2);
      expect(existsSync(out)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe('audit-scenes.mjs：0 错误必须建立在真的扫到了东西上', () => {
  it('真仓库 0 错误且退出码 0', () => {
    const { status, out } = run('audit-scenes.mjs', []);
    expect(status).toBe(0);
    expect(out).toContain('0 个错误');
  });

  it('场景目录是空的时候退出码 2，而不是「0 错误 / 0 警告」', () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-empty-'));
    try {
      const { status, out } = run('audit-scenes.mjs', [dir]);
      expect(status).toBe(2);
      expect(out).toContain('不可信');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('假检查不许复活 / 一份名单只能有一处', () => {
  it('结构上不可能报错的 check-params.cjs 与重复的 find-deadcode.cjs 已删除', () => {
    expect(existsSync(join(SCRIPTS, 'check-params.cjs'))).toBe(false);
    expect(existsSync(join(SCRIPTS, 'find-deadcode.cjs'))).toBe(false);
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const scripts = JSON.stringify(pkg.scripts);
    expect(scripts).not.toContain('check-params');
    expect(scripts).not.toContain('find-deadcode.cjs');
    expect(scripts).toContain('find-deadcode-full.cjs');
  });

  it('伪动作表只有一个来源，且每个名字在 start.js 里真有实现痕迹', () => {
    const startSrc = readFileSync(join(ROOT, 'claude-scene/src/commands/start.js'), 'utf-8');
    // 与 smoke.test.js 同构的抽取方式：`step.action === 'x'` / `!== 'x'` + actionMap 的键
    const implemented = new Set();
    for (const m of startSrc.matchAll(/step\.action (?:===|!==) '([\w-]+)'/g)) implemented.add(m[1]);
    const mapBlock = startSrc.match(/const actionMap = \{([\s\S]*?)\};/);
    if (mapBlock) for (const m of mapBlock[1].matchAll(/^[ \t]*(\w+):/gm)) implemented.add(m[1]);

    // 幽灵豁免（audit-scenes.mjs 以前多了个 'selectOption'）会在这里当场变红
    const ghosts = [];
    for (const action of PSEUDO_ACTIONS) if (!implemented.has(action)) ghosts.push(action);
    expect(ghosts, '幽灵豁免：名单里有 start.js 根本不存在实现的动作').toEqual([]);
  });

  // 第二十六轮：陈旧产物不许复活
  //   · scripts/scenes-stats-utf8.txt：键是中文显示名、含已删除场景（hunt/analyze）、
  //     review 还是 33 步 —— 一份没人读的陈旧 dump，却能被当成「统计结果」引用；
  //   · claude-scene/.express-sec-audit-cache.json：225KB 的审计缓存，幽灵动作 state-audit
  //     就是从这里被喂进审计报告的唯一来源。
  it('陈旧产物（scenes-stats-utf8.txt / express-sec-audit-cache.json）已删除且不许重新提交', () => {
    expect(existsSync(join(SCRIPTS, 'scenes-stats-utf8.txt'))).toBe(false);
    expect(existsSync(join(ROOT, 'claude-scene/.express-sec-audit-cache.json'))).toBe(false);
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf-8');
    expect(ignore).toContain('scripts/scenes-stats-utf8.txt');
    expect(ignore).toContain('claude-scene/.express-sec-audit-cache.json');
    // 真值仍在：scenes-stats.json 必须与场景文件一致（旧文本转储不能顶替它）
    const stats = JSON.parse(readFileSync(join(SCRIPTS, 'scenes-stats.json'), 'utf-8'));
    const sceneDir = join(ROOT, 'claude-scene', 'scenes');
    const slugs = readdirSync(sceneDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(Object.keys(stats).sort()).toEqual(slugs);
    let steps = 0;
    for (const slug of slugs) {
      const scene = JSON.parse(readFileSync(join(sceneDir, `${slug}.json`), 'utf-8'));
      steps += Object.keys(scene.flow || {}).length;
    }
    const written = Object.values(stats).reduce((a, v) => a + (typeof v === 'object' && v ? v.steps : v), 0);
    expect(written, 'scenes-stats.json 的步骤数必须等于场景 flow 键数之和').toBe(steps);
  });
});
