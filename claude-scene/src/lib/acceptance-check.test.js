import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyAction, checkAcceptance } from '../lib/acceptance-check.js';
import { handleVerify } from '../handlers/flow-control.js';

describe('classifyAction', () => {
  it('classifies verify actions', () => {
    expect(classifyAction('runLint')).toBe('verify');
    expect(classifyAction('runTests')).toBe('verify');
    expect(classifyAction('checkSmoke')).toBe('verify');
    expect(classifyAction('buildApp')).toBe('verify');
    expect(classifyAction('reviewCode')).toBe('verify');
    expect(classifyAction('auditSecurity')).toBe('verify');
    expect(classifyAction('runSuite')).toBe('verify');
  });

  it('classifies edit actions', () => {
    expect(classifyAction('autoFix')).toBe('edit');
    expect(classifyAction('generateDesign')).toBe('edit');
    expect(classifyAction('createPR')).toBe('edit');
    expect(classifyAction('refactorCode')).toBe('edit');
    expect(classifyAction('implementFeature')).toBe('edit');
    expect(classifyAction('patchConfig')).toBe('edit');
  });

  it('classifies other actions', () => {
    expect(classifyAction('notify')).toBe('other');
    expect(classifyAction('remember')).toBe('other');
    expect(classifyAction('show')).toBe('other');
  });

  it('handles non-string and empty', () => {
    expect(classifyAction(null)).toBe('other');
    // Omitting the arg yields undefined, exercising the typeof guard.
    expect(classifyAction()).toBe('other');
    expect(classifyAction('')).toBe('other');
  });
});

describe('checkAcceptance', () => {
  const flow = [
    { step: 0.5, action: 'injectContext' },
    { step: 1, action: 'autoFix' },
    { step: 2, action: 'runLint' },
    { step: 3, action: 'runTests' },
    { step: 4, action: 'notify' },
  ];

  it('flags missing verify when edits ran but no verify', () => {
    const r = checkAcceptance(flow, [0.5, 1, 4]);
    expect(r.hasEdit).toBe(true);
    expect(r.hasVerify).toBe(false);
    expect(r.missingVerify).toBe(true);
  });

  it('passes when edits ran with a verify', () => {
    const r = checkAcceptance(flow, [0.5, 1, 2, 4]);
    expect(r.hasEdit).toBe(true);
    expect(r.hasVerify).toBe(true);
    expect(r.missingVerify).toBe(false);
  });

  it('passes when no edits ran', () => {
    const r = checkAcceptance(flow, [0.5, 4]);
    expect(r.hasEdit).toBe(false);
    expect(r.missingVerify).toBe(false);
  });

  it('handles empty flow', () => {
    const r = checkAcceptance([], [1, 2]);
    expect(r.hasEdit).toBe(false);
    expect(r.hasVerify).toBe(false);
    expect(r.missingVerify).toBe(false);
  });

  it('handles null flow', () => {
    const r = checkAcceptance(null, [1]);
    expect(r.missingVerify).toBe(false);
  });

  it('honors allowNoVerify opt-out for change-bearing scenes', () => {
    // plan-ceo-review style: edits but no verify, explicitly opted out.
    const r = checkAcceptance(flow, [0.5, 1, 4], true);
    expect(r.hasEdit).toBe(true);
    expect(r.hasVerify).toBe(false);
    expect(r.missingVerify).toBe(false);
  });

  it('still flags missingVerify when allowNoVerify is false', () => {
    const r = checkAcceptance(flow, [0.5, 1, 4], false);
    expect(r.missingVerify).toBe(true);
  });

  it('with stepResults, flags unreviewedChange when verify steps all failed', () => {
    // step 1 autoFix (edit, pass), step 2 runLint (verify, fail), step 3 runTests (verify, noop)
    const results = [
      { action: 'autoFix', status: 'pass' },
      { action: 'runLint', status: 'fail' },
      { action: 'runTests', status: 'noop' },
    ];
    const r = checkAcceptance(flow, [1, 2, 3], false, results);
    expect(r.hasEdit).toBe(true);
    expect(r.hasVerify).toBe(true);
    expect(r.hasPassingVerify).toBe(false);
    expect(r.missingVerify).toBe(false);
    expect(r.unreviewedChange).toBe(true);
  });

  // 维度（第十七轮）：变更类步骤的 status 得看 —— noop/skip 是「没做」，不是「改了」。
  // 实测（对话模式）：qa 场景的 generateQAReport → noop、update 的 writeUpdateLog → noop，
  // 两步都没执行任何写入，却被「有变更但验证未通过」拦下 exit 1 —— 消息里的「有变更」是假话。
  it('noop 的变更类步骤不算「有变更」（不许拿它拦下一次什么都没改的运行）', () => {
    const r = checkAcceptance(flow, [1, 2], false, [
      { action: 'autoFix', status: 'noop' },
      { action: 'runTests', status: 'skip' },
    ]);
    expect(r.hasEdit).toBe(false);
    expect(r.inertEditSteps).toEqual(['autoFix']);
    expect(r.unreviewedChange).toBe(false);
    expect(r.missingVerify).toBe(false);
  });

  it('skip 的变更类步骤也不算，但 fail 的算（写了一半也是写）', () => {
    const skipped = checkAcceptance(flow, [1], false, [{ action: 'autoFix', status: 'skip' }]);
    expect(skipped.hasEdit).toBe(false);
    expect(skipped.inertEditSteps).toEqual(['autoFix']);
    const failed = checkAcceptance(flow, [1], false, [{ action: 'autoFix', status: 'fail' }]);
    expect(failed.hasEdit).toBe(true);
    expect(failed.inertEditSteps).toEqual([]);
  });

  it('真的改过（pass）仍然要验证 —— 收紧 noop 不是把门禁拆了', () => {
    const r = checkAcceptance(flow, [1, 2], false, [
      { action: 'autoFix', status: 'pass' },
      { action: 'runTests', status: 'skip' },
    ]);
    expect(r.hasEdit).toBe(true);
    expect(r.inertEditSteps).toEqual([]);
    expect(r.unreviewedChange).toBe(true);
  });

  it('没有 stepResults 时仍是 presence-only（静态检查不变）', () => {
    const r = checkAcceptance(flow, [1, 2], false, null);
    expect(r.hasEdit).toBe(true);
    expect(r.inertEditSteps).toEqual([]);
  });

  it('with stepResults, passes when at least one verify step is pass', () => {
    const results = [
      { action: 'autoFix', status: 'pass' },
      { action: 'runLint', status: 'fail' },
      { action: 'runTests', status: 'pass' },
    ];
    const r = checkAcceptance(flow, [1, 2, 3], false, results);
    expect(r.hasPassingVerify).toBe(true);
    expect(r.unreviewedChange).toBe(false);
  });

  // 第十六轮把 warn 收紧成「真的跑了、但有发现」：表示「未执行/未测量」的步骤
  // 一律 skip。所以这条断言现在依赖的前提变了 —— 不再是「warn 普遍算已审阅」，
  // 而是「warn 只能出现在真跑过的验证上」。下面补了一条真实 handler 的反例。
  it('treats warn as a reviewed-passing verify status（warn 只用于「跑了但有发现」）', () => {
    const results = [
      { action: 'autoFix', status: 'pass' },
      { action: 'runLint', status: 'warn' },
    ];
    const r = checkAcceptance(flow, [1, 2], false, results);
    expect(r.hasPassingVerify).toBe(true);
    expect(r.unreviewedChange).toBe(false);
  });

  it('验证没跑成（skip）不算已审阅 —— 真 handler 也不许给 warn', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'acc-verify-'));
    try {
      // 没有 package.json = 没东西可跑。以前 verifyByTestRun 返回 warn，
      // 而 PASSING_RE 收 warn → 「改了代码、验证没跑」被门禁放行（实测 exit 0）。
      const res = await handleVerify('verify', { mode: 'smoke_test' }, dir, {});
      expect(res.status).toBe('skip');
      const r = checkAcceptance(flow, [1, 2], false, [
        { action: 'autoFix', status: 'pass' },
        { action: 'runLint', status: res.status },
      ]);
      expect(r.hasVerify).toBe(true);
      expect(r.hasPassingVerify).toBe(false);
      expect(r.unreviewedChange).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('without stepResults, falls back to verify-presence (static scene check)', () => {
    // No stepResults: any verify action in completed steps counts as passing.
    const r = checkAcceptance(flow, [0.5, 1, 2, 4], false);
    expect(r.hasPassingVerify).toBe(true);
    expect(r.unreviewedChange).toBe(false);
  });

  it('allowNoVerify opts out of unreviewedChange too', () => {
    const results = [{ action: 'autoFix', status: 'pass' }];
    const r = checkAcceptance(flow, [1], true, results);
    expect(r.unreviewedChange).toBe(false);
  });

  // 豁免必须能被看见：以前 allow_no_verify=true 完全静默，读者看不出
  // 「没拦」是因为不需要验证，还是因为门禁被场景关掉了。
  it('豁免生效时要告诉调用方（waivedNoVerify），不许静默放行', () => {
    const waived = checkAcceptance(flow, [1], true, [{ action: 'autoFix', status: 'pass' }]);
    expect(waived.waivedNoVerify).toBe(true);

    const notWaived = checkAcceptance(flow, [1], false, [{ action: 'autoFix', status: 'pass' }]);
    expect(notWaived.waivedNoVerify).toBe(false);
  });

  it('声明了 allow_no_verify 但这次没有变更动作 → 不算豁免过（避免打出误导的提示）', () => {
    const r = checkAcceptance(flow, [2], true, [{ action: 'runLint', status: 'pass' }]);
    expect(r.hasEdit).toBe(false);
    expect(r.waivedNoVerify).toBe(false);
  });

  it('allow_no_verify 只认布尔 true（字符串 "true" 不能当豁免）', () => {
    const r = checkAcceptance(flow, [1], 'true', [{ action: 'autoFix', status: 'pass' }]);
    // 字符串 'true' 不是布尔 true：豁免不生效，门禁照常拦（missingVerify 照样成立），
    // 也不许打出「已豁免」的提示。
    expect(r.missingVerify).toBe(true);
    expect(r.waivedNoVerify).toBe(false);
  });
});
