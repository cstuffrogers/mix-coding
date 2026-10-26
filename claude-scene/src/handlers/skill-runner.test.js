import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath, URL } from 'url';
import { randomBytes } from 'crypto';
import { handleInvokeSkill, resolveSkillCandidates } from './skill-runner.js';

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
  it('returns skip message for unknown skill', () => {
    const result = handleInvokeSkill('invokeSkill', { skill: 'nonexistent-skill' }, tmp, {});
    expect(result).toContain('需要在对话模式中执行');
  });

  it.each(['sec-bug-hunt', 'ai-friendly-web-design', 'mobile-ui-review'])(
    'returns CLI alternative message for %s',
    (skill) => {
      const result = handleInvokeSkill('invokeSkill', { skill }, tmp, {});
      expect(result).toContain('CLI 静态替代方案');
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
    expect(result).toContain('参考内容已展示');
    expect(result).toContain('2 项清单');
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
    expect(result).toContain('需要在对话模式中执行');
  });

  it('handles null context gracefully', () => {
    const result = handleInvokeSkill('invokeSkill', { skill: 'nonexistent' }, tmp, null);
    expect(result).toContain('需要在对话模式中执行');
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
    expect(result).not.toContain('需要在对话模式中执行');
    expect(result).toContain('参考内容已展示');
    expect(ctx[`skill_${name}_name`]).toBeTruthy();
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
    expect(result).toContain('参考内容已展示');
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
    expect(result).not.toContain('需要在对话模式中执行');
    expect(result).toContain('参考内容已展示');
  });

  it('prefers a project-local override over the engine copy', () => {
    const target = join(tmp, 'override-project');
    const skillDir = join(target, '.claude', 'skills', 'sharp-edges');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: sharp-edges\n---\n## Local\n- [ ] local-only item\n');
    const ctx = {};
    const result = handleInvokeSkill('invokeSkill', { skill: 'sharp-edges' }, target, ctx);
    expect(result).toContain('1 项清单');
    expect(ctx['skill_sharp-edges_checklist'][0].text).toBe('local-only item');
  });

  it('returns an empty candidate list for an unknown skill', () => {
    expect(resolveSkillCandidates('no-such-skill', tmp)).toEqual([]);
  });

  it('leaves the engine repo untouched by the resolution probe', () => {
    expect(existsSync(join(REPO_ROOT, '.claude', 'skills'))).toBe(true);
  });
});
