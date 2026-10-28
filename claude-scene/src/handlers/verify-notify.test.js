/* global Buffer */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 第五轮：场景里那些「写了没人读」的参数（verify 的 mode/retry、notify 的
// title/content/level）现在真的生效了，这里把它们的行为钉住。
vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop, white: noop } };
});

const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockSafeExec(...args),
  escapeArg: (s) => s,
}));

const { handleVerify, handleNotify } = await import('./flow-control.js');

function projectWithPackageJson() {
  const dir = mkdtempSync(join(tmpdir(), 'mix-verify-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'vitest run' } }));
  return dir;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleVerify：mode 与退出码', () => {
  it('测试真通过 → testPassed = true', async () => {
    mockSafeExec.mockReturnValue(Buffer.from('Tests 3 passed'));
    const ctx = {};
    const result = await handleVerify('verify', { mode: 'targeted', scope: 'bugfix' }, projectWithPackageJson(), ctx);
    expect(String(result)).toContain('验证通过');
    expect(ctx.testPassed).toBe(true);
  });

  it('退出码非零就是失败（不再靠输出里有没有 failed 字样判断）', async () => {
    mockSafeExec.mockImplementation(() => {
      const error = new Error('Command failed: npm test');
      error.stdout = Buffer.from('Tests 2 failed | 5 passed');
      throw error;
    });
    const ctx = {};
    const result = await handleVerify('verify', {}, projectWithPackageJson(), ctx);
    expect(result.status).toBe('fail');
    expect(ctx.testPassed).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('输出里写着「0 failed」也不许判成失败（以前的假红）', async () => {
    mockSafeExec.mockReturnValue(Buffer.from('Tests 5 passed, 0 failed'));
    const ctx = {};
    const result = await handleVerify('verify', {}, projectWithPackageJson(), ctx);
    expect(String(result)).toContain('验证通过');
    expect(ctx.testPassed).toBe(true);
  });

  it('没有 test 脚本 → 没跑成（warn），不算失败也不算通过', async () => {
    mockSafeExec.mockImplementation(() => {
      throw new Error('npm ERR! Missing script: "test"');
    });
    const ctx = {};
    const result = await handleVerify('verify', {}, projectWithPackageJson(), ctx);
    expect(result.status).toBe('warn');
    expect(ctx.testPassed).toBeUndefined();
    expect(ctx.lastStepFailed).toBeUndefined();
  });

  it('health_check 没有服务地址 → 不假装验证过', async () => {
    const ctx = {};
    const result = await handleVerify('verify', { mode: 'health_check', scope: 'deployment', retry: 3 }, projectWithPackageJson(), ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('没有服务地址');
    expect(ctx.healthCheckPassed).toBeUndefined();
    expect(mockSafeExec).not.toHaveBeenCalled();
  });

  it('health_check 敲通了 → 记 healthCheckPassed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    const ctx = { dev_server_url: 'http://127.0.0.1:3000/health' };
    const result = await handleVerify('verify', { mode: 'health_check' }, projectWithPackageJson(), ctx);
    expect(String(result)).toContain('HTTP 200');
    expect(ctx.healthCheckPassed).toBe(true);
  });

  it('health_check 打不通 → fail，并按 retry 次数重试', async () => {
    const spy = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', spy);
    const ctx = { dev_server_url: 'http://127.0.0.1:9/health' };
    const result = await handleVerify('verify', { mode: 'health_check', retry: 3 }, projectWithPackageJson(), ctx);
    expect(result.status).toBe('fail');
    expect(spy).toHaveBeenCalledTimes(3);
    expect(ctx.healthCheckPassed).toBe(false);
  });
});

describe('handleNotify：title/content/level 也要真的发出去', () => {
  it('只有 title + content 时不再沉默（rollback#14 的紧急回滚通知）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mix-notify-'));
    const result = handleNotify('notify', { level: 'error', title: '紧急回滚已执行', content: '服务已恢复' }, dir, {});
    expect(String(result)).toContain('通知已发送');
    expect(existsSync(join(dir, '.claude', 'notifications.log'))).toBe(true);
    const log = readFileSync(join(dir, '.claude', 'notifications.log'), 'utf8');
    expect(log).toContain('[ERROR] 紧急回滚已执行: 服务已恢复');
  });

  it('什么内容都没有 → warn（以前照样报「通知已发送」）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mix-notify-'));
    const result = handleNotify('notify', {}, dir, {});
    expect(result.status).toBe('warn');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
