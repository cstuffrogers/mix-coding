import { describe, it, expect } from 'vitest';
import { classifyAction, checkAcceptance } from '../lib/acceptance-check.js';

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

  it('treats warn as a reviewed-passing verify status', () => {
    const results = [
      { action: 'autoFix', status: 'pass' },
      { action: 'runLint', status: 'warn' },
    ];
    const r = checkAcceptance(flow, [1, 2], false, results);
    expect(r.hasPassingVerify).toBe(true);
    expect(r.unreviewedChange).toBe(false);
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
});
