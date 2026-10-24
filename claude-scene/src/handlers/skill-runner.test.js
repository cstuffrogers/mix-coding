import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { handleInvokeSkill } from './skill-runner.js';

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

  it('returns CLI alternative message for sec-bug-hunt', () => {
    const result = handleInvokeSkill('invokeSkill', { skill: 'sec-bug-hunt' }, tmp, {});
    expect(result).toContain('CLI 静态替代方案');
  });

  it('returns CLI alternative message for ai-friendly-web-design', () => {
    const result = handleInvokeSkill('invokeSkill', { skill: 'ai-friendly-web-design' }, tmp, {});
    expect(result).toContain('CLI 静态替代方案');
  });

  it('returns CLI alternative message for mobile-ui-review', () => {
    const result = handleInvokeSkill('invokeSkill', { skill: 'mobile-ui-review' }, tmp, {});
    expect(result).toContain('CLI 静态替代方案');
  });

  it('reads SKILL.md and returns checklist count for review-checklist', () => {
    // Create the skill file at expected relative path
    const skillDir = join(tmp, '..', '.claude', 'skills', 'review-checklist');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: review-checklist\n---\n## Section\n- [ ] item one\n- [ ] item two\n');
    const result = handleInvokeSkill('invokeSkill', { skill: 'review-checklist' }, tmp, {});
    expect(result).toContain('参考内容已展示');
    expect(result).toContain('2 项清单');
  });

  it('populates context with skill data when context provided', () => {
    const skillDir = join(tmp, '..', '.claude', 'skills', 'review-checklist');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: review-checklist\n---\n## Section\n- [ ] item\n');
    const ctx = {};
    handleInvokeSkill('invokeSkill', { skill: 'review-checklist' }, tmp, ctx);
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
