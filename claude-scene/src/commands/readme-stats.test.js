import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * README 的「N 个场景 / N 步」必须和场景文件对得上。
 *
 * 这一条以前是靠 `scripts/fix-readme-en.cjs` 维持的 —— 一个 114 行的历史补丁：
 * 里面写死「34 → 35」「60 → 69」之类的替换，读进来的 scenes-stats.json 一次都没用，
 * 跑完还打印「All step counts verified」（只验证自己的硬编码）。锚点被它自己改没以后，
 * 它就彻底空转，而屏幕上一直是绿的 —— 于是 README 长期写着 29 个场景、3 个不存在的
 * 场景（hunt / e2e / monitor），数字全错。
 *
 * 现在换成 check-readme-stats.cjs：真值来自 claude-scene/scenes/*.json，两份 README
 * 摊开比对。本文件既是它的单元测试，也是真仓库的漂移守卫（随 npm test 跑）。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-readme-stats.cjs');

/** 逐项执行脚本：返回 { code, out }。 */
function run(scriptArgs) {
  const res = spawnSync(process.execPath, [SCRIPT, ...scriptArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function scene(name, steps) {
  const flow = {};
  for (let i = 0; i < steps; i += 1) flow[i] = { action: 'noop', params: {} };
  return { name, description: 'fixture', flow };
}

/** 20 个场景的假仓库（下限 20，少一个就是「扫描面塌了」）。 */
function scaffold({ scenes, zh, en }) {
  const dir = mkdtempSync(join(tmpdir(), 'readme-stats-'));
  mkdirSync(join(dir, 'claude-scene', 'scenes'), { recursive: true });
  for (const [slug, steps] of Object.entries(scenes)) {
    writeFileSync(
      join(dir, 'claude-scene', 'scenes', `${slug}.json`),
      JSON.stringify(scene(slug, steps), null, 2),
    );
  }
  if (zh !== undefined) writeFileSync(join(dir, 'README.md'), zh);
  if (en !== undefined) writeFileSync(join(dir, 'README_EN.md'), en);
  return dir;
}

const TEN_SCENES = {
  bugfix: 5, check: 3, feature: 7, loop: 4, optimize: 6,
  plan: 2, qa: 9, refactor: 8, release: 5, review: 4,
  setup: 3, spec: 2, update: 1, 'ui-polish': 10, rollback: 2,
  deps: 3, cicd: 2, onboard: 4, 'new-project': 6, 'plan-ceo-review': 1,
};

function zhReadme(rows, total = rows.length) {
  return [
    '# 项目',
    '',
    `## 📋 ${total} 个工作流场景`,
    '',
    '| 场景 | 步骤数 | 说明 | 命令 |',
    '|------|--------|------|------|',
    ...rows.map(([slug, steps]) => `| **${slug}** | ${steps} 步 | 说明 | \`/${slug}\` |`),
    '',
  ].join('\n');
}

function enReadme(rows, total = rows.length, stepsTotal = null) {
  const tail = stepsTotal === null ? '' : ` (${stepsTotal} Steps Total)`;
  return [
    '# Project',
    '',
    `## 📋 ${total} Workflow Scenes${tail}`,
    '',
    '| Scene | Steps | Description | Command |',
    '|-------|-------|-------------|---------|',
    ...rows.map(([slug, steps]) => `| **${slug}** | ${steps} | desc | \`/${slug}\` |`),
    '',
  ].join('\n');
}

const ROWS = Object.entries(TEN_SCENES);

describe('check-readme-stats：真值来自场景文件', () => {
  it('干净仓库 → exit 0，两份 README 都报对得上', () => {
    const dir = scaffold({ scenes: TEN_SCENES, zh: zhReadme(ROWS), en: enReadme(ROWS) });
    const { code, out } = run([dir]);
    expect(code, out).toBe(0);
    expect(out).toContain('README.md（中文）：20 行全部对得上');
    expect(out).toContain('README_EN.md（英文）：20 行全部对得上');
  });

  it('幽灵行（文档列了没有场景的 /cmd）→ exit 1 并点名', () => {
    const rows = [...ROWS, ['hunt', 24]];
    const dir = scaffold({ scenes: TEN_SCENES, zh: zhReadme(rows), en: enReadme(rows) });
    const { code, out } = run([dir]);
    expect(code).toBe(1);
    expect(out).toContain('幽灵行：`hunt`');
    expect(out, '两份都错就两份都要点名').toContain('README_EN.md');
  });

  it('步骤数不符 → exit 1，写出「写的」与「实际」', () => {
    const drifted = ROWS.map(([slug, steps]) => [slug, slug === 'review' ? 43 : steps]);
    const dir = scaffold({ scenes: TEN_SCENES, zh: zhReadme(drifted), en: enReadme(ROWS) });
    const { code, out } = run([dir]);
    expect(code).toBe(1);
    expect(out).toContain('`review` 步骤数写 43，实际 4');
    expect(out, '没漂移的那份不许被牵连').toContain('README_EN.md（英文）：20 行全部对得上');
  });

  it('漏列场景 → exit 1 并报出漏了谁', () => {
    const rows = ROWS.filter(([slug]) => slug !== 'spec' && slug !== 'setup');
    const dir = scaffold({ scenes: TEN_SCENES, zh: zhReadme(rows), en: enReadme(ROWS) });
    const { code, out } = run([dir]);
    expect(code).toBe(1);
    expect(out).toContain('漏列 2 个场景：setup, spec');
  });

  it('标题数字不符（含英文的 Steps Total）→ exit 1', () => {
    const dir = scaffold({
      scenes: TEN_SCENES,
      zh: zhReadme(ROWS, 27),
      en: enReadme(ROWS, 29, 999),
    });
    const { code, out } = run([dir]);
    expect(code).toBe(1);
    expect(out).toContain('标题写 27 个场景，实际 20 个');
    expect(out).toContain('标题写 29 个场景，实际 20 个');
    expect(out).toContain('标题写 999 步');
  });

  it('没写步骤数（—）也算不一致', () => {
    const rows = ROWS.map(([slug, steps]) => [slug, slug === 'qa' ? '—' : steps]);
    const dir = scaffold({ scenes: TEN_SCENES, zh: zhReadme(rows), en: enReadme(ROWS) });
    const { code, out } = run([dir]);
    expect(code).toBe(1);
    expect(out).toContain('`qa` 没写步骤数（实际 9）');
  });

  it('场景太少 → exit 2（这时的「全部对得上」不可信）', () => {
    const few = Object.fromEntries(ROWS.slice(0, 3));
    const dir = scaffold({ scenes: few, zh: zhReadme(Object.entries(few)), en: enReadme(Object.entries(few)) });
    const { code, out } = run([dir]);
    expect(code).toBe(2);
    expect(out).toContain('只读到 3 个场景（下限 20）');
  });

  it('表格格式变了认不出行 → exit 2（不许当成干净）', () => {
    const brokenZh = ['## 📋 20 个工作流场景', '', ...ROWS.map(([s, n]) => `- ${s}: ${n}`)].join('\n');
    const dir = scaffold({ scenes: TEN_SCENES, zh: brokenZh, en: enReadme(ROWS) });
    const { code, out } = run([dir]);
    expect(code).toBe(2);
    expect(out).toMatch(/只认出 0 行场景（下限 \d+）/);
  });

  it('真仓库：两份 README 与 26 个场景对得上（漂移守卫）', () => {
    const { code, out } = run([]);
    expect(code, out).toBe(0);
    expect(out).toContain('✅ README.md（中文）');
    expect(out).toContain('✅ README_EN.md（英文）');
  });

  it('不摆假证据：fix-readme-en.cjs 不许复活', () => {
    expect(
      existsSync(join(ROOT, 'scripts', 'fix-readme-en.cjs')),
      '这个脚本只验证自己的硬编码数字，跑完打印 "All step counts verified"，已删除；'
        + '要改 README 数字请用 check-readme-stats.cjs 看真值',
    ).toBe(false);
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const scriptsJson = JSON.stringify(pkg.scripts);
    expect(scriptsJson, 'package.json 里还挂着已删脚本').not.toContain('fix-readme-en');
  });
});
