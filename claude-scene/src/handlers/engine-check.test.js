import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const safeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({ safeExec: (...args) => safeExec(...args), escapeArg: (v) => v }));

const { handleCheckSmoke, handleCheckGateFlags, handleSelfCheckReport } = await import('./engine-check.js');

function throwsWith({ message = '', stdout = '', stderr = '' }) {
  const error = new Error(message);
  error.stdout = Buffer.from(stdout);
  error.stderr = Buffer.from(stderr);
  return error;
}

describe('check-smoke 三态（没跑成 ≠ 测试失败）', () => {
  beforeEach(() => {
    safeExec.mockReset();
  });

  it('测试通过 → pass', () => {
    safeExec.mockReturnValue(Buffer.from(' Tests  12 passed (12)\n'));
    const context = {};
    const result = handleCheckSmoke('checkSmoke', {}, '/proj', context);
    expect(result.status).toBe('pass');
    expect(context.smokePassed).toBe(true);
  });

  it('测试真的失败 → fail 且带失败数', () => {
    safeExec.mockImplementation(() => {
      throw throwsWith({ message: 'Command failed: npx vitest run', stdout: ' Tests  2 failed | 10 passed\n' });
    });
    const context = {};
    const result = handleCheckSmoke('checkSmoke', {}, '/proj', context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('2 个失败');
    expect(context.smokePassed).toBe(false);
  });

  it('没装 vitest → skip 而不是 fail', () => {
    safeExec.mockImplementation(() => {
      throw throwsWith({ message: "Cannot find module 'vitest'", stderr: 'npm ERR! code MODULE_NOT_FOUND\n' });
    });
    const context = {};
    const result = handleCheckSmoke('checkSmoke', {}, '/proj', context);
    expect(result.status).toBe('skip');
    expect(context.smokePassed).toBeUndefined();
  });

  it('没有测试文件 → skip', () => {
    safeExec.mockReturnValue(Buffer.from('No test files found, exiting with code 1\n'));
    expect(handleCheckSmoke('checkSmoke', {}, '/proj', {}).status).toBe('skip');
  });

  it('跑了但认不出结论 → warn（不冒充通过）', () => {
    safeExec.mockReturnValue(Buffer.from('something unexpected\n'));
    expect(handleCheckSmoke('checkSmoke', {}, '/proj', {}).status).toBe('warn');
  });
});

describe('自检报告不把「没跑」说成「失败」', () => {
  it('smokePassed=undefined → ⏭ 未执行，且本步不算失败', () => {
    // 契约变更（第三轮审计）：以前未执行也记 pass —— 摘要写着「⏭ 未执行」，
    // 汇总却给绿勾。「没验证」不等于「通过」，所以改成 warn；仍然不许说成失败。
    const result = handleSelfCheckReport('selfCheckReport', {}, '/proj', { smokePassed: undefined });
    expect(result.message).toContain('未执行');
    expect(result.message).not.toContain('❌ 失败');
    expect(result.status).toBe('warn');
  });

  it('smokePassed=false → 如实报失败，但报告步骤本身只 warn', () => {
    const result = handleSelfCheckReport('selfCheckReport', {}, '/proj', { smokePassed: false, smokeFailures: 3 });
    expect(result.message).toContain('❌ 失败');
    expect(result.message).toContain('3');
    expect(result.status).toBe('warn');
  });
});

describe('check-gate-flags：场景声明了什么，引擎就得有什么', () => {
  const sceneDirWith = (flow) => {
    const dir = mkdtempSync(join(tmpdir(), 'checkscene-'));
    writeFileSync(join(dir, 'demo.json'), JSON.stringify({ name: 'demo', flow }), 'utf-8');
    return dir;
  };

  it('场景声明的门禁都实现了 → pass，并报出个数', () => {
    // 以前这一步比的是「handler 写了 *Passed flag 但 gate-flags.js 没映射」，
    // 于是 healthCheckPassed / setupConfigured 固定报「2 缺失」—— 假信号。
    const dir = sceneDirWith([
      { action: 'checkGate', params: { checks: ['lint', 'test', 'security'] } },
      { action: 'checkGate', params: { gate: 'setup_config' } },
    ]);
    const context = {};
    const result = handleCheckGateFlags('checkGateFlags', {}, '/proj', context, dir);
    expect(result).toContain('都有实现');
    expect(context.unimplementedGateCount).toBe(0);
    expect(context.declaredGateCount).toBe(4);
  });

  it('场景写了引擎不认识的门禁名 → warn 且点名场景', () => {
    const dir = sceneDirWith([{ action: 'checkGate', params: { checks: ['lint', 'lintt'] } }]);
    const context = {};
    const result = handleCheckGateFlags('checkGateFlags', {}, '/proj', context, dir);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('lintt');
    expect(result.message).toContain('demo');
    expect(context.unimplementedGates).toEqual(['lintt（demo）']);
  });

  it('一个场景都没读到 → skip（空扫描范围不等于通过）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'checkscene-'));
    const result = handleCheckGateFlags('checkGateFlags', {}, '/proj', {}, dir);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('扫描范围为空');
  });

  it('引擎自己的 26 个场景：声明的门禁全都实现了', () => {
    const context = {};
    handleCheckGateFlags('checkGateFlags', {}, '/proj', context);
    expect(context.declaredGateCount).toBeGreaterThan(20);
    expect(context.unimplementedGates).toEqual([]);
  });
});
