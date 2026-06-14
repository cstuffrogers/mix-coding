import { describe, it, expect, vi } from 'vitest';
import { ACTION_REGISTRY, executeAction } from './actions.js';

// Suppress chalk output during tests
vi.mock('chalk', () => {
  const noop = (s) => s;
  const chalk = new Proxy(
    {},
    {
      get: () => noop,
    }
  );
  return { default: chalk };
});

describe('ACTION_REGISTRY', () => {
  it('has all flow-control actions', () => {
    const actions = ['select', 'confirm', 'choose', 'report', 'askUser'];
    for (const a of actions) {
      expect(ACTION_REGISTRY[a]).toBeTypeOf('function');
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all memory actions', () => {
    const actions = [
      'memoryRecall', 'memory-recall', 'recall',
      'memoryRemember', 'memory-remember', 'remember',
      'consolidate', 'listMemories',
    ];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all code-analysis actions (from split modules)', () => {
    const actions = [
      'codeScan', 'securityScan', 'performanceProfile',
      'codeMetrics', 'detectAntiPatterns', 'generateReport',
      'knipCheck', 'gitLeaks', 'secBugHunt', 'sec-bug-hunt',
      'analyzeSecurityVulnerabilities', 'buildLeakCheck', 'build-leak-check',
      'deadLinkCheck', 'dead-link-check',
      'lighthouseGate', 'lighthouse-gate',
      'openRedirectScan', 'open-redirect-scan',
      'stateAudit', 'state-audit',
      'i18nAudit', 'i18n-audit',
    ];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all testing actions', () => {
    const actions = [
      'testCoverage', 'test-coverage',
      'testUnit', 'test-unit',
      'runSuite', 'run_suite',
      'runAffected', 'run_affected',
      'runCI', 'generateTest',
    ];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all git actions', () => {
    const actions = ['createBranch', 'autoUpdate', 'commitPush', 'createPR'];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all design actions', () => {
    const actions = [
      'generateDesign', 'generateLowFi', 'generateHiFi',
      'analyzeConsistency', 'persist', 'input', 'exportAssets',
    ];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all issue actions', () => {
    const actions = [
      'issueQuery', 'locate', 'analyzeDependencies',
      'fix', 'verifyFix', 'regression', 'closeTicket',
    ];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all quality actions', () => {
    const actions = [
      'build', 'applyTemplate', 'implementLogic', 'cleanup',
      'autoFix', 'generateRefactorPlan', 'applyTransformations', 'analyzeInterface',
    ];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all review actions', () => {
    const actions = ['runReview', 'reviewFull', 'review-full', 'verifyVisual'];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has all ui-tools actions', () => {
    const actions = [
      'analyzeUI', 'checkConsistency', 'addAnimations',
      'visualRegression', 'checkAPIConsistency', 'check-api-consistency',
    ];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has install, docs, and gate actions', () => {
    const actions = ['installDeps', 'docsUpdate', 'docs-update', 'checkGate'];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has notification actions', () => {
    const actions = ['send', 'notify', 'notifyComplete', 'notify-complete'];
    for (const a of actions) {
      expect(typeof ACTION_REGISTRY[a]).toBe('function');
    }
  });

  it('has analyze action', () => {
    expect(typeof ACTION_REGISTRY['analyze']).toBe('function');
  });

  it('registers at least 70 actions total', () => {
    expect(Object.keys(ACTION_REGISTRY).length).toBeGreaterThanOrEqual(70);
  });
});

describe('executeAction', () => {
  it('handles ce- prefixed actions', async () => {
    const context = {};
    const result = await executeAction('test-scene', 'ce-plan', {}, context, '/tmp');
    expect(result).toContain('CE');
  });

  it('returns fallback message for unknown actions', async () => {
    const context = {};
    const result = await executeAction('test-scene', 'nonexistentAction', {}, context, '/tmp');
    expect(result).toBe('动作 nonexistentAction 执行完成');
  });

  it('catches errors and sets lastStepFailed on context', async () => {
    const context = {};
    const original = ACTION_REGISTRY['_testThrower'];
    ACTION_REGISTRY['_testThrower'] = () => {
      throw new Error('simulated failure');
    };
    const result = await executeAction('test-scene', '_testThrower', {}, context, '/tmp');
    expect(context.lastStepFailed).toBe(true);
    expect(result).toContain('部分操作可能失败');
    delete ACTION_REGISTRY['_testThrower'];
    if (original) ACTION_REGISTRY['_testThrower'] = original;
  });

  it('passes params and context through to handler', async () => {
    const context = {};
    const received = {};
    const original = ACTION_REGISTRY['_testParams'];
    ACTION_REGISTRY['_testParams'] = (action, params, targetPath, ctx) => {
      received.action = action;
      received.params = params;
      received.targetPath = targetPath;
      received.context = ctx;
      return 'ok';
    };
    const result = await executeAction('test-scene', '_testParams', { key: 'val' }, context, '/my/path');
    expect(result).toBe('ok');
    expect(received.action).toBe('_testParams');
    expect(received.params).toEqual({ key: 'val' });
    expect(received.targetPath).toBe('/my/path');
    expect(received.context).toBe(context);
    if (original) ACTION_REGISTRY['_testParams'] = original;
    else delete ACTION_REGISTRY['_testParams'];
  });
});
