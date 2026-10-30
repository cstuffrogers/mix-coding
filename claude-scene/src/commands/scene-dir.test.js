import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/**
 * 场景的两份副本，谁才是「真值」？
 *
 * 改前实测：`.claude/scenes/*.json`（项目覆盖层）与 `claude-scene/scenes/*.json`
 * （随包内置）26 个文件逐字节相同；引擎按 `paths.js` 的 `getSceneDirs()` 取
 * 「覆盖层优先」，所以跑起来的是 `.claude/scenes`。可校验脚本分成两派：
 * `check-readme-stats` / `check-action-stats` / `check-doc-counts` / `check-tool-steps`
 * 读内置那份，`check-dead-actions` / `find-deadcode-full` / `scan-scenes` 读覆盖层那份。
 * 于是往覆盖层里加一步（运行时立刻多一步），README 校验器照样报「全部对得上」——
 * 它核的是永远不会被执行的那个副本。
 *
 * 现在所有脚本共用 `scripts/lib/scene-dir.cjs`：层顺序与引擎一致，同名场景只取一次
 * （覆盖层优先）。本文件既是它的单元测试，也是真仓库的漂移守卫（随 npm test 跑）。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCRIPTS = join(ROOT, 'scripts');
const require = createRequire(import.meta.url);
const { sceneTiers, resolveScenes } = require(join(SCRIPTS, 'lib', 'scene-dir.cjs'));

const README_SCRIPT = join(SCRIPTS, 'check-readme-stats.cjs');

function scene(steps) {
  const flow = {};
  for (let i = 0; i < steps; i += 1) flow[i] = { action: 'noop', params: {} };
  return { name: 'fixture', description: 'fixture', flow };
}

/** 写一层场景目录（slug → 步骤数） */
function writeTier(dir, scenes) {
  mkdirSync(dir, { recursive: true });
  for (const [slug, steps] of Object.entries(scenes)) {
    writeFileSync(join(dir, `${slug}.json`), JSON.stringify(scene(steps), null, 2));
  }
}

function scaffold({ builtin = {}, overlay = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'scene-dir-'));
  if (Object.keys(builtin).length > 0) writeTier(join(dir, 'claude-scene', 'scenes'), builtin);
  if (Object.keys(overlay).length > 0) writeTier(join(dir, '.claude', 'scenes'), overlay);
  return dir;
}

function runReadme(dir) {
  const res = spawnSync(process.execPath, [README_SCRIPT, dir], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

/** 20 个场景（check-readme-stats 的下限），review 单独给不同步数 */
const BASE = {
  review: 3, bugfix: 5, check: 3, feature: 7, loop: 4,
  optimize: 6, plan: 2, qa: 9, refactor: 8, release: 5,
  setup: 3, spec: 2, update: 1, 'ui-polish': 10, rollback: 2,
  deps: 3, cicd: 2, onboard: 4, 'new-project': 6, 'plan-ceo-review': 1,
};

function zhReadme(rows) {
  return [
    '# 项目',
    '',
    `## 📋 ${rows.length} 个工作流场景`,
    '',
    '| 场景 | 步骤数 | 说明 | 命令 |',
    '|------|--------|------|------|',
    ...rows.map(([slug, steps]) => `| **${slug}** | ${steps} 步 | 说明 | \`/${slug}\` |`),
    '',
  ].join('\n');
}

function enReadme(rows) {
  return [
    '# Project',
    '',
    `## 📋 ${rows.length} Workflow Scenes`,
    '',
    '| Scene | Steps | Description | Command |',
    '|-------|-------|-------------|---------|',
    ...rows.map(([slug, steps]) => `| **${slug}** | ${steps} | desc | \`/${slug}\` |`),
    '',
  ].join('\n');
}

/** 表格行：review 用 overlayReview 步，其余用 BASE 步数 */
function rowsWith(overlayReview) {
  return Object.entries({ ...BASE, review: overlayReview });
}

describe('scene-dir：场景层与引擎同序（覆盖层优先）', () => {
  it('只有随包内置 → 读内置', () => {
    const dir = scaffold({ builtin: { review: 3 } });
    const { scenes, source } = resolveScenes(dir);
    expect(scenes.size).toBe(1);
    expect(scenes.get('review').tier).toContain('claude-scene/scenes');
    expect(source).toContain('claude-scene/scenes');
  });

  it('只有项目覆盖层 → 读覆盖层', () => {
    const dir = scaffold({ overlay: { review: 4 } });
    const { scenes, source } = resolveScenes(dir);
    expect(scenes.get('review').tier).toContain('.claude/scenes');
    expect(source).not.toContain('claude-scene/scenes');
  });

  it('两层都有同名场景 → 覆盖层那份赢，且只算一次', () => {
    const dir = scaffold({ builtin: { review: 3, qa: 9 }, overlay: { review: 4 } });
    const { scenes } = resolveScenes(dir);
    expect([...scenes.keys()].sort()).toEqual(['qa', 'review']);
    expect(scenes.get('review').file).toBe(join(dir, '.claude', 'scenes', 'review.json'));
    expect(scenes.get('qa').file).toBe(join(dir, 'claude-scene', 'scenes', 'qa.json'));
  });

  it('MIX_CODING_SCENES_DIR 显式覆盖优先于两层，且用完必须还原环境', () => {
    const dir = scaffold({ builtin: { review: 3 }, overlay: { review: 4 } });
    const explicit = scaffold({ builtin: { only: 1 } });
    const saved = process.env.MIX_CODING_SCENES_DIR;
    try {
      process.env.MIX_CODING_SCENES_DIR = join(explicit, 'claude-scene', 'scenes');
      const { scenes } = resolveScenes(dir);
      expect([...scenes.keys()]).toEqual(['only']);
    } finally {
      if (saved === undefined) delete process.env.MIX_CODING_SCENES_DIR;
      else process.env.MIX_CODING_SCENES_DIR = saved;
    }
  });

  it('两层都没有场景 → 空视图 + 明说「两层都没有」，不假装读了什么', () => {
    const dir = scaffold({});
    const { scenes, source } = resolveScenes(dir);
    expect(scenes.size).toBe(0);
    expect(source).toContain('两层都没有');
    expect(sceneTiers(dir)).toEqual([]);
  });
});

describe('真仓库：两份场景副本必须一模一样', () => {
  const OVERLAY = join(ROOT, '.claude', 'scenes');
  const BUILTIN = join(ROOT, 'claude-scene', 'scenes');
  const jsonFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

  it('文件名集合相同（有一边多出来的场景 = 覆盖面漂移）', () => {
    const overlay = jsonFiles(OVERLAY);
    const builtin = jsonFiles(BUILTIN);
    expect(overlay.length).toBeGreaterThan(20);
    expect(overlay).toEqual(builtin);
  });

  it('内容逐行相同（行尾不计：core.autocrlf 会把同内容检出成不同字节）', () => {
    // 为什么不论字节：本仓库 `.gitattributes` 没锁场景 JSON，开发机开着
    // core.autocrlf=true 时同一份内容会检出成 CRLF，blob 里已经带 CR 的文件
    // 还会被再转一次（CRCRLF）—— 拿字节比随时假红（第二十八轮结尾就踩了一次）。
    // 场景 JSON 的语义与行尾无关，所以比的是归一化后的内容；
    // 真要分叉（改了一边没改另一边）依然会在这里红。
    const norm = (file) => readFileSync(file, 'utf-8').replaceAll('\r\n', '\n');
    const drifted = jsonFiles(OVERLAY).filter(
      (f) => norm(join(OVERLAY, f)) !== norm(join(BUILTIN, f)),
    );
    expect(
      drifted,
      `这些场景两份内容不一样：${drifted.join(', ')} —— 运行时会用 .claude/scenes，`
      + '请把改动同步到另一边（或删掉覆盖层副本），不要只改一边',
    ).toEqual([]);
  });

  it('校验器读的目录 == 引擎解析场景时读的目录', () => {
    // 引擎在导入期按 PROJECT_ROOT 求值，所以用子进程单独问它一次
    const probed = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "const p = await import('./claude-scene/src/lib/paths.js');"
        + "console.log(p.resolveScenePath('review'));",
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(probed.status, `${probed.stdout}${probed.stderr}`).toBe(0);
    const engineFile = probed.stdout.trim();
    const checkerFile = resolveScenes(ROOT).scenes.get('review').file;
    expect(engineFile.split(sep).join('/')).toBe(checkerFile.split(sep).join('/'));
  });
});

describe('check-readme-stats：核的是运行时会跑的那份', () => {
  it('覆盖层写 4 步（内置只有 3 步）→ 文档写 4 步就是对的', () => {
    const dir = scaffold({ builtin: BASE, overlay: { review: 4 } });
    writeFileSync(join(dir, 'README.md'), zhReadme(rowsWith(4)));
    writeFileSync(join(dir, 'README_EN.md'), enReadme(rowsWith(4)));
    const { code, out } = runReadme(dir);
    expect(code, out).toBe(0);
    expect(out).toContain('README.md（中文）：20 行全部对得上');
  });

  it('同一份 fixture 里文档写内置的 3 步 → exit 1，并报「实际 4」', () => {
    const dir = scaffold({ builtin: BASE, overlay: { review: 4 } });
    writeFileSync(join(dir, 'README.md'), zhReadme(rowsWith(3)));
    writeFileSync(join(dir, 'README_EN.md'), enReadme(rowsWith(4)));
    const { code, out } = runReadme(dir);
    expect(code).toBe(1);
    expect(out).toContain('`review` 步骤数写 3，实际 4');
    expect(out, '没漂移的那份不许被牵连').toContain('README_EN.md（英文）：20 行全部对得上');
  });

  it('覆盖层只放 1 个场景 → 真值是两层并集，不许误报「扫描面塌了」', () => {
    const dir = scaffold({ builtin: BASE, overlay: { review: 4 } });
    writeFileSync(join(dir, 'README.md'), zhReadme(rowsWith(4)));
    writeFileSync(join(dir, 'README_EN.md'), enReadme(rowsWith(4)));
    const { code, out } = runReadme(dir);
    expect(out).toContain('真值：20 个场景');
    expect(code, out).toBe(0);
  });
});

describe('scripts 里的场景读取必须只用这一份实现', () => {
  const scripts = readdirSync(SCRIPTS).filter((f) => f.endsWith('.cjs'));

  /** 粗略剥注释：只认整行注释与块注释的行首标记。目录名都出现在字符串里，够用。 */
  const code = (f) => readFileSync(join(SCRIPTS, f), 'utf-8')
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/u.test(line))
    .join('\n');

  it('凡是从场景文件取真值的脚本，都必须 require lib/scene-dir.cjs', () => {
    const offenders = scripts.filter((f) => {
      const text = code(f);
      const readsScenes = /\bscenes\b/u.test(text) || text.includes('sceneDir');
      return readsScenes && !text.includes('scene-dir.cjs');
    });
    expect(
      offenders,
      `这些脚本自己在找场景目录：${offenders.join(', ')} —— 请改用 scripts/lib/scene-dir.cjs`,
    ).toEqual([]);
    // 空跑自检：scripts/ 下真的有一批脚本被扫到了
    expect(scripts.length).toBeGreaterThan(5);
  });

  it('剥注释后仍能认出「在读场景」的脚本（防止这条守卫空转）', () => {
    const readers = scripts.filter((f) => code(f).includes('scene-dir.cjs'));
    expect(readers.length, `只认出这些：${readers.join(', ')}`).toBeGreaterThanOrEqual(6);
  });
});
