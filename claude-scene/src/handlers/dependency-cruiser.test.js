import { describe, it, expect, vi, beforeEach } from 'vitest';

// 这个 handler 以前零测试覆盖，而它的假绿很典型：
//   safeExec 抛错（npx 下载失败 / 没有 src 目录）→ 输出里挑不出违规行 →
//   violationCount = 0 → context.depCruiserPassed = true → 门禁「✓ 通过」。
// 现在要求：输出里必须真的出现 dependency-cruiser 的报告，才算「跑过」。
const mockSafeExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({ safeExec: (...args) => mockSafeExec(...args) }));

const mockExistsSync = vi.fn(() => false);
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, existsSync: (...args) => mockExistsSync(...args), mkdirSync: () => {} };
});

const { handleDepcruiseArchitecture } = await import('./dependency-cruiser.js');

function execError({ stdout = '', stderr = '', status } = {}) {
  const error = new Error('Command failed');
  if (status !== undefined) error.status = status;
  error.stdout = stdout;
  error.stderr = stderr;
  return error;
}

describe('handleDepcruiseArchitecture：跑没跑起来必须分清', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('退出码 0 → 无违规，写通过', () => {
    mockSafeExec.mockReturnValue('');
    const context = {};
    const result = handleDepcruiseArchitecture('x', {}, '/project', context);
    expect(String(result)).toContain('无问题');
    expect(context.depCruiserPassed).toBe(true);
    expect(context.depcruise_violations).toBe(0);
  });

  it('非零退出但输出里有违规行 → 违规数如实计入，不算通过', () => {
    mockSafeExec.mockImplementation(() => {
      throw execError({ stdout: 'error no-circular: src/a.js -> src/b.js\n', status: 1 });
    });
    const context = {};
    const result = handleDepcruiseArchitecture('x', {}, '/project', context);
    expect(String(result)).toContain('1 个违规');
    expect(context.depCruiserPassed).toBe(false);
    expect(context.depcruise_violations).toBe(1);
  });

  it('非零退出且输出是「no violations」→ 跑过了，算通过', () => {
    mockSafeExec.mockImplementation(() => {
      throw execError({ stdout: '✔ no violations found (12 modules)\n', status: 1 });
    });
    const context = {};
    const result = handleDepcruiseArchitecture('x', {}, '/project', context);
    expect(String(result)).toContain('无问题');
    expect(context.depCruiserPassed).toBe(true);
  });

  it('工具没跑起来 → skip，且不写任何 verdict', () => {
    mockSafeExec.mockImplementation(() => {
      throw execError({ stderr: 'npm error could not determine executable to run', status: 1 });
    });
    const context = {};
    const result = handleDepcruiseArchitecture('x', {}, '/project', context);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('不是通过');
    expect(context.depCruiserPassed).toBeUndefined();
    expect(context.depcruise_violations).toBeUndefined();
  });

  it('params.rules 真的被读到（按声明的文件名找配置）', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('custom-rules.cjs'));
    mockSafeExec.mockReturnValue('');
    handleDepcruiseArchitecture('x', { rules: 'custom-rules.cjs' }, '/project', {});
    const command = mockSafeExec.mock.calls[0][0];
    expect(command).toContain('custom-rules.cjs');
  });

  it('没声明 params.rules 时回落默认配置名（不是空字符串）', () => {
    mockSafeExec.mockReturnValue('');
    handleDepcruiseArchitecture('x', {}, '/project', {});
    const command = mockSafeExec.mock.calls[0][0];
    expect(command).not.toContain('-c "undefined"');
    expect(command).toContain('--no-config');
  });
});
