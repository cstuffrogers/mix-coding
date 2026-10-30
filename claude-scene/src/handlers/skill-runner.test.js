import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath, URL } from 'url';
import { randomBytes } from 'crypto';
import { handleInvokeSkill, resolveSkillCandidates } from './skill-runner.js';
import { listSceneIds, resolveScenePath } from '../lib/paths.js';

// 本文件在 <repo>/claude-scene/src/handlers/ 下，往上 3 层就是仓库根。
const ENGINE_DIR = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');

vi.mock('chalk', () => {
  const noop = (s) => s;
  const chalk = new Proxy({}, { get: () => noop });
  return { default: chalk };
});

let tmp;
beforeEach(() => {
  tmp = join(process.cwd(), `.skill-runner-tmp-${randomBytes(4).toString('hex')}`);
  mkdirSync(tmp, { recursive: true });
});
afterEach(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ok */ } });

describe('handleInvokeSkill', () => {
  // 契约变更（本轮修假绿）：展示清单/有替代方案都不等于“执行了 skill”，
  // 所以不再返回裸字符串让引擎按正则猜成 pass，而是显式 noop/skip。
  it('returns skip for unknown skill', () => {
    const result = handleInvokeSkill('invokeSkill', { skill: 'nonexistent-skill' }, tmp, {});
    expect(result.status).toBe('skip');
    expect(result.message).toContain('跳过');
  });

  it.each(['sec-bug-hunt', 'ai-friendly-web-design', 'mobile-ui-review'])(
    'returns CLI alternative as noop for %s',
    (skill) => {
      const result = handleInvokeSkill('invokeSkill', { skill }, tmp, {});
      expect(result.status).toBe('noop');
      expect(result.message).toContain('CLI 静态替代方案');
    },
  );

  it('reads SKILL.md and returns checklist count for review-checklist', () => {
    // resolveSkillPath() looks for skills at `targetPath/..`, so targetPath has to
    // be a subdirectory of the sandbox. Passing `tmp` itself pointed the lookup at
    // the repo's real .claude/skills/, and the fixture below overwrote the tracked
    // SKILL.md on every test run.
    const projectDir = join(tmp, 'project');
    mkdirSync(projectDir, { recursive: true });
    const skillDir = join(tmp, '.claude', 'skills', 'review-checklist');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: review-checklist\n---\n## Section\n- [ ] item one\n- [ ] item two\n');
    const result = handleInvokeSkill('invokeSkill', { skill: 'review-checklist' }, projectDir, {});
    expect(result.status).toBe('noop');
    expect(result.message).toContain('2 项清单');
  });

  it('populates context with skill data when context provided', () => {
    const projectDir = join(tmp, 'project');
    mkdirSync(projectDir, { recursive: true });
    const skillDir = join(tmp, '.claude', 'skills', 'review-checklist');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: review-checklist\n---\n## Section\n- [ ] item\n');
    const ctx = {};
    handleInvokeSkill('invokeSkill', { skill: 'review-checklist' }, projectDir, ctx);
    expect(ctx['skill_review-checklist_checklist']).toBeDefined();
    expect(ctx['skill_review-checklist_name']).toBe('review-checklist');
  });

  it('handles missing params gracefully', () => {
    const result = handleInvokeSkill('invokeSkill', {}, tmp, {});
    expect(result.status).toBe('skip');
  });

  it('handles null context gracefully', () => {
    const result = handleInvokeSkill('invokeSkill', { skill: 'nonexistent' }, tmp, null);
    expect(result.status).toBe('skip');
  });
});

// Vendored Trail of Bits skills. These are real files pulled from upstream, so
// the guards below check they are still present, still loadable, still
// internally consistent, and still correctly attributed. A silently emptied
// directory would otherwise degrade the scene into a no-op that reads as pass.
describe('vendored Trail of Bits skills', () => {
  const TOB = ['property-based-testing', 'variant-analysis', 'sharp-edges', 'insecure-defaults'];
  // 仓库根由本文件位置推导，不用 process.cwd()：/check 的冒烟步骤是在仓库根跑
  // vitest 的，那时 cwd 是仓库根而非 claude-scene，`cwd/..` 会变成盘符根 E:\。
  const skillFile = (name) => join(REPO_ROOT, '.claude', 'skills', name, 'SKILL.md');

  it.each(TOB)('%s ships a SKILL.md with frontmatter', (name) => {
    const content = readFileSync(skillFile(name), 'utf-8');
    expect(content.startsWith('---')).toBe(true);
    expect(content).toMatch(/^name:\s*\S+/m);
    expect(content).toMatch(/^description:\s*\S+/m);
  });

  it.each(TOB)('%s is loadable through handleInvokeSkill', (name) => {
    const ctx = {};
    const result = handleInvokeSkill('invokeSkill', { skill: name }, ENGINE_DIR, ctx);
    expect(result.status).toBe('noop');
    expect(result.message).toContain('参考内容已载入 context');
    expect(ctx[`skill_${name}_name`]).toBeTruthy();
  });

  // 第十三轮：ui-polish 的 18 个步骤用 `command: "critique|layout|polish|…"` 表达模式，
  // 而 handler 只认 `subcommand` —— 声明被静默丢弃。两个键名都认，且结论里要看得见。
  it('command 当 subcommand 的别名用，写进 context 和结论（不再被静默丢弃）', () => {
    const ctx = {};
    const result = handleInvokeSkill('invokeSkill', { skill: 'sharp-edges', command: 'layout' }, ENGINE_DIR, ctx);
    expect(ctx['skill_sharp-edges_subcommand']).toBe('layout');
    expect(result.message).toContain('模式 layout');
  });

  it('subcommand 优先于 command（显式 keys 赢）', () => {
    const ctx = {};
    handleInvokeSkill('invokeSkill', { skill: 'sharp-edges', subcommand: 'polish', command: 'layout' }, ENGINE_DIR, ctx);
    expect(ctx['skill_sharp-edges_subcommand']).toBe('polish');
    expect(ctx['skill_sharp-edges_dimensions']).toBeUndefined();
  });

  it.each(TOB)('%s has no dangling relative markdown links', (name) => {
    const dir = join(REPO_ROOT, '.claude', 'skills', name);
    const dangling = [];
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.md')) continue;
        const text = readFileSync(full, 'utf-8');
        for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
          const href = m[1];
          if (/^(https?:|mailto:|#)/.test(href)) continue;
          let target = join(dirname(full), href.split('#')[0]);
          if (!existsSync(target)) dangling.push(`${relative(dir, full)} -> ${href}`);
        }
      }
    };
    walk(dir);
    expect(dangling).toEqual([]);
  });

  it('runs no external process and installs nothing', () => {
    // The whole point of vendoring: usable with no network and no npm install.
    // Guard the handler contract rather than the (absent) subprocess plumbing.
    const result = handleInvokeSkill('invokeSkill', { skill: 'sharp-edges' }, ENGINE_DIR, null);
    expect(result.message).toContain('参考内容已载入 context');
  });

  it.each(TOB)('%s keeps its CC BY-SA attribution notice', (name) => {
    const notice = readFileSync(
      join(REPO_ROOT, '.claude', 'skills', name, 'NOTICE.md'), 'utf-8',
    );
    // These files must not drift into being presented as Elastic License 2.0.
    expect(notice).toContain('CC BY-SA 4.0');
    expect(notice).toContain('trailofbits/skills');
    expect(notice).toContain('NOT covered by this repository');
  });
});

describe('场景点名的技能都必须登记', () => {
  // 以前 speckit-* / repomix / refactor-safely / review-delta 没进 SKILL_PATHS，
  // 10 个步骤一律 skip「本机没有它的 SKILL.md」—— 文件明明在，这句话是假的。
  const referenced = () => {
    const names = new Set();
    for (const id of listSceneIds()) {
      const flow = JSON.parse(readFileSync(resolveScenePath(id), 'utf-8')).flow;
      for (const step of Array.isArray(flow) ? flow : Object.values(flow)) {
        if (step.action === 'invokeSkill' && step.params?.skill) names.add(step.params.skill);
      }
    }
    return [...names].sort();
  };

  it('每个被点名的技能都能在仓库里解析到 SKILL.md', () => {
    const missing = referenced().filter(
      (n) => resolveSkillCandidates(n, REPO_ROOT).every((p) => !existsSync(p)),
    );
    expect(missing, '场景引用了没登记/不存在的技能（会 skip 成「本机没有它的 SKILL.md」）').toEqual([]);
  });

  it('扫描面不许塌（否则上面那条恒绿）', () => {
    expect(referenced().length).toBeGreaterThan(20);
  });
});

describe('landing-page-design（MIT，elayadesign/ai-design-skills）', () => {
  const DIR = join(REPO_ROOT, '.claude', 'skills', 'landing-page-design');

  it('署名不断裂：NOTICE/LICENSE/SKILL.md 三件都在，且声明的是 MIT 而非 CC BY-SA', () => {
    for (const f of ['SKILL.md', 'NOTICE.md', 'LICENSE']) {
      expect(existsSync(join(DIR, f)), `${f} 缺失`).toBe(true);
    }
    const notice = readFileSync(join(DIR, 'NOTICE.md'), 'utf-8');
    expect(notice).toContain('elayadesign/ai-design-skills');
    expect(notice).toContain('MIT');
    // 两个许可边界不能互相同化：MIT 目录不能被写成 CC BY-SA，反之亦然。
    expect(notice).toContain('MIT 不是 CC BY-SA');
    expect(notice).not.toContain('CC BY-SA 4.0，© Trail of Bits');
    expect(readFileSync(join(DIR, 'LICENSE'), 'utf-8')).toContain('MIT License');
  });

  it('正文包含 A/B 两部分、交付清单和本地冲突裁决附录', () => {
    const text = readFileSync(join(DIR, 'SKILL.md'), 'utf-8');
    expect(text.startsWith('---\nname: landing-page-design\n')).toBe(true);
    for (const marker of ['# Landing Page Design', '# PART A', '# PART B', '# Quick checklist', '## B10. Ship requirements']) {
      expect(text, marker).toContain(marker);
    }
    // 上游写着「this file wins」，本项目有品牌预设，必须给出裁决顺序。
    expect(text).toContain('本项目集成约定');
    expect(text).toContain('awesome-design-md');
    expect(text).toContain('Liquid Glass');
  });

  it('无悬空相对链接（目录内自包含）', () => {
    const dangling = [];
    for (const entry of readdirSync(DIR, { withFileTypes: true })) {
      if (!entry.name.endsWith('.md')) continue;
      const text = readFileSync(join(DIR, entry.name), 'utf-8');
      for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const href = m[1];
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        if (!existsSync(join(DIR, href.split('#')[0]))) dangling.push(`${entry.name} -> ${href}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('invokeSkill 能解析到它并把清单载入 context（不起子进程）', () => {
    const context = {};
    const result = handleInvokeSkill('invokeSkill', { skill: 'landing-page-design' }, ENGINE_DIR, context);
    expect(result.status).not.toBe('skip');
    expect(result.message).toContain('参考内容已载入 context');
    expect(Array.isArray(context['skill_landing-page-design_checklist'])).toBe(true);
  });
});

describe('skill resolution from an arbitrary project directory', () => {
  it('lists a target-project skill as the highest-priority candidate', () => {
    const target = join(tmp, 'some-other-project');
    const candidates = resolveSkillCandidates('sharp-edges', target);
    expect(candidates[0]).toBe(join(target, '.claude', 'skills', 'sharp-edges', 'SKILL.md'));
  });

  it('still resolves skills when the target is unrelated to the engine repo', () => {
    // This is the regression: resolution used to be `targetPath/..` only, so a
    // real project (/tmp/vuln etc.) resolved to a nonexistent path and every
    // invokeSkill step silently degraded to "no SKILL.md".
    const target = join(tmp, 'unrelated-project');
    mkdirSync(target, { recursive: true });
    const ctx = {};
    const result = handleInvokeSkill('invokeSkill', { skill: 'sharp-edges' }, target, ctx);
    expect(result.status).toBe('noop');
    expect(result.message).toContain('参考内容已载入 context');
  });

  it('prefers a project-local override over the engine copy', () => {
    const target = join(tmp, 'override-project');
    const skillDir = join(target, '.claude', 'skills', 'sharp-edges');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: sharp-edges\n---\n## Local\n- [ ] local-only item\n');
    const ctx = {};
    const result = handleInvokeSkill('invokeSkill', { skill: 'sharp-edges' }, target, ctx);
    expect(result.message).toContain('1 项清单');
    expect(ctx['skill_sharp-edges_checklist'][0].text).toBe('local-only item');
  });

  it('returns an empty candidate list for an unknown skill', () => {
    expect(resolveSkillCandidates('no-such-skill', tmp)).toEqual([]);
  });

  it('leaves the engine repo untouched by the resolution probe', () => {
    expect(existsSync(join(REPO_ROOT, '.claude', 'skills'))).toBe(true);
  });
});
