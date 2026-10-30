import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// findResourceDir 是「条件」和「执行器」共用的一处目录解析：
//   - conditions.js 用它判断 impeccable_available / awesome_design_md_available …
//   - skill-runner 用 ~/.mix-coding/.claude/skills 找 SKILL.md
// 两者必须看同一批目录，否则条件恒假、步骤静默跳过（这就是本文件锁的不变式）。
// PROJECT_ROOT / USER_DATA_DIR 都是 import-time 快照，所以每条用例都重新 import。

let sandbox;
let project;
let home;

function seed(dir, skill) {
  mkdirSync(join(dir, 'skills', skill), { recursive: true });
  writeFileSync(join(dir, 'skills', skill, 'SKILL.md'), `# ${skill}\n`, 'utf-8');
}

async function loadPaths({ projectDir = project, homeDir = home } = {}) {
  process.env.MIX_CODING_PROJECT_DIR = projectDir;
  process.env.MIX_CODING_HOME = homeDir;
  vi.resetModules();
  return import('./paths.js');
}

beforeEach(() => {
  sandbox = join(process.cwd(), `.paths-tmp-${randomBytes(4).toString('hex')}`);
  project = join(sandbox, 'some-other-project');
  home = join(sandbox, 'mix-home');
  mkdirSync(project, { recursive: true });
  mkdirSync(home, { recursive: true });
});

afterEach(() => {
  delete process.env.MIX_CODING_PROJECT_DIR;
  delete process.env.MIX_CODING_HOME;
  try { rmSync(sandbox, { recursive: true, force: true }); } catch { /* ok */ }
});

describe('findResourceDir', () => {
  it('项目级 .claude/skills 优先于用户级', async () => {
    seed(join(project, '.claude'), 'impeccable');
    seed(join(home, '.claude'), 'impeccable');
    const { findResourceDir } = await loadPaths();
    expect(findResourceDir('skills', 'impeccable')).toBe(join(project, '.claude', 'skills', 'impeccable'));
  });

  it('项目目录没有该技能时回落到 ~/.mix-coding/.claude/skills（全局安装的真实位置）', async () => {
    // 全局安装脚本把引擎技能装到 <USER_DATA_DIR>/.claude/skills。
    // 以前这里只查 <USER_DATA_DIR>/skills —— 于是任何非本仓库目录下
    // impeccable_available 都是 false，ui-polish 的 18 个步骤全被静默跳过。
    seed(join(home, '.claude'), 'impeccable');
    const { findResourceDir } = await loadPaths();
    expect(findResourceDir('skills', 'impeccable')).toBe(join(home, '.claude', 'skills', 'impeccable'));
  });

  it('项目级 .agents/skills（pi 侧技能目录）也算项目覆盖', async () => {
    seed(join(project, '.agents'), 'landing-page-design');
    const { findResourceDir } = await loadPaths();
    expect(findResourceDir('skills', 'landing-page-design'))
      .toBe(join(project, '.agents', 'skills', 'landing-page-design'));
  });

  it('用户级根目录下的 skills 仍然生效（旧路径不能丢）', async () => {
    seed(home, 'awesome-design-md');
    const { findResourceDir } = await loadPaths();
    expect(findResourceDir('skills', 'awesome-design-md')).toBe(join(home, 'skills', 'awesome-design-md'));
  });

  it('全都找不到时返回项目级候选，调用方用自己的 existsSync 判定', async () => {
    const { findResourceDir } = await loadPaths();
    expect(findResourceDir('skills', 'nope')).toBe(join(project, '.claude', 'skills', 'nope'));
  });
});
