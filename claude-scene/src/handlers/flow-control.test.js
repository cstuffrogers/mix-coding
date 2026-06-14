import { describe, it, expect, vi } from 'vitest';
import {
  handleSelect, handleConfirm, handleCheckEnvFile,
  handleGenerateEnv, handleVerify, handleNotify, handleChoose, handleAskUser,
  handleCheckGate, handleCeAction,
} from './flow-control.js';
import { handleCheckPrerequisites } from './prerequisites.js';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop, white: noop } };
});

describe('handleSelect', () => {
  it('selects default first option when no prior selection', () => {
    const ctx = {};
    const result = handleSelect('select', { options: ['react', 'vue', 'svelte'] }, '/tmp', ctx);
    expect(result).toContain('react');
    expect(ctx.selectedOption).toBe('react');
  });

  it('uses existing selection if already set', () => {
    const ctx = { selectedOption: 'vue' };
    const result = handleSelect('select', { options: ['react', 'vue'] }, '/tmp', ctx);
    expect(result).toContain('vue');
  });

  it('handles empty options', () => {
    const ctx = {};
    const result = handleSelect('select', {}, '/tmp', ctx);
    expect(result).toBe('选择完成（无选项）');
  });
});

describe('handleConfirm', () => {
  it('returns confirmation message', () => {
    const result = handleConfirm('confirm', { message: '确定要执行吗？' }, '/tmp');
    expect(result).toBe('确认完成');
  });

  it('works without message param', () => {
    const result = handleConfirm('confirm', {}, '/tmp');
    expect(result).toBe('确认完成');
  });
});

describe('handleNotify', () => {
  it('returns completion message', () => {
    const result = handleNotify('notify', { message: '工作流已完成' });
    expect(result).toBe('任务完成通知已发送');
  });
});

describe('handleCheckPrerequisites', () => {
  it('checks node, npm, git availability', () => {
    const result = handleCheckPrerequisites('check-prerequisites', {}, '/tmp');
    expect(result).toMatch(/可用$/);
  });
});

describe('handleCheckEnvFile', () => {
  it('detects missing env file and sets context flag', () => {
    const ctx = {};
    const result = handleCheckEnvFile('check-env-file', {}, '/tmp', ctx);
    expect(ctx.missing_env_vars_detected).toBe(true);
    expect(result).toContain('缺失');
  });
});

describe('handleGenerateEnv', () => {
  it('fails gracefully when no .env.example', () => {
    const result = handleGenerateEnv('generate-env', {}, '/tmp');
    expect(result).toContain('缺失');
  });
});

describe('handleVerify', () => {
  it('sets testPassed context on test success', () => {
    const ctx = {};
    const result = handleVerify('verify', {}, '/tmp', ctx);
    expect(typeof result).toBe('string');
    expect('testPassed' in ctx).toBe(true);
  });
});

describe('handleChoose', () => {
  it('auto-selects first option and sets context', () => {
    const ctx = { _sceneId: 'design' };
    const result = handleChoose('choose', {
      message: '选择设计风格',
      options: ['modern', 'classic', 'minimal'],
    }, '/tmp', ctx);
    expect(ctx.selectedOption).toBe('modern');
    expect(ctx.design_selected).toBe('modern');
    expect(result).toContain('modern');
  });

  it('handles object-style options with labels', () => {
    const ctx = {};
    handleChoose('choose', {
      options: [
        { label: 'DaisyUI', description: '35+ themes' },
        { label: 'Animal Island', description: 'Nature style' },
      ],
    }, '/tmp', ctx);
    expect(ctx.selectedOption).toBe('DaisyUI');
  });
});

describe('handleAskUser', () => {
  it('auto-answers confirm with default true', () => {
    const ctx = {};
    const result = handleAskUser('askUser', {
      prompt: '确认继续？',
      type: 'confirm',
    }, '/tmp', ctx);
    expect(ctx.user_confirmed).toBe(true);
    expect(result).toContain('true');
  });

  it('uses provided default value', () => {
    const ctx = {};
    handleAskUser('askUser', {
      prompt: '确认？',
      type: 'confirm',
      default: false,
    }, '/tmp', ctx);
    expect(ctx.user_confirmed).toBe(false);
  });

  it('auto-answers text prompts', () => {
    const ctx = {};
    const result = handleAskUser('askUser', {
      prompt: '输入名称',
      type: 'text',
      default: 'my-app',
    }, '/tmp', ctx);
    expect(result).toContain('my-app');
  });
});

describe('handleCheckGate', () => {
  it('passes when all checks are green', () => {
    const ctx = { lintPassed: true, typecheckPassed: true, testPassed: true };
    const result = handleCheckGate('check-gate', { checks: ['lint', 'typecheck', 'test'] }, '/tmp', ctx);
    expect(result).toContain('通过');
  });

  it('skips checks not yet run', () => {
    const ctx = {};
    const result = handleCheckGate('check-gate', { checks: ['lint', 'typecheck', 'test'] }, '/tmp', ctx);
    expect(result).toContain('通过');
  });

  it('blocks on high severity security finding', () => {
    const ctx = { securityScanResult: { highSeverityFound: true } };
    const result = handleCheckGate('check-gate', { checks: ['security'] }, '/tmp', ctx);
    expect(result).toContain('阻断');
    expect(ctx.lastStepFailed).toBe(true);
    expect(ctx.gateBlocked).toBe(true);
  });

  it('flags unknown checks', () => {
    const ctx = { lintPassed: true };
    const result = handleCheckGate('check-gate', { checks: ['lint', 'unknown_check'] }, '/tmp', ctx);
    expect(result).toContain('通过');
  });

  it('handles failed checks', () => {
    const ctx = { lintPassed: false, typecheckPassed: true };
    const result = handleCheckGate('check-gate', { checks: ['lint', 'typecheck'] }, '/tmp', ctx);
    expect(result).toContain('未通过');
  });

  it('handles all gate check types', () => {
    const ctx = {
      testPassed: true, coveragePassed: true, lintPassed: true,
      typecheckPassed: true, dependencyAuditPassed: true,
      performancePassed: true, complexityPassed: true,
      deadCodePassed: true, gitLeaksPassed: true,
      deadLinkPassed: true, buildLeakPassed: true, i18nPassed: true,
    };
    const result = handleCheckGate('check-gate', {
      checks: ['lint', 'typecheck', 'test', 'coverage', 'dependencies',
               'performance', 'complexity', 'dead_code', 'git_leaks',
               'dependency_audit', 'visual_regression',
               'dead_links', 'build_leaks', 'i18n'],
    }, '/tmp', ctx);
    expect(result).toContain('通过');
  });
});

describe('handleCeAction', () => {
  it('resolves ce-plan description', () => {
    const result = handleCeAction('ce-plan');
    expect(result).toContain('CE plan');
  });

  it('falls back for unknown CE action', () => {
    const result = handleCeAction('ce-unknown');
    expect(result).toContain('CE unknown');
  });
});
