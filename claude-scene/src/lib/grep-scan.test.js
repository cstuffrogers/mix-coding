import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeExec } from './safe-exec.js';
import { grepScan } from './grep-scan.js';

vi.mock('./safe-exec.js', () => ({ safeExec: vi.fn() }));

// 这个文件固化「grep 没跑起来」与「grep 跑了但没匹配」必须能区分。
// 病根：以前所有 grep 都写成 `... 2>&1 || true`，两种情况都是空字符串，
// 调用方随后写 `findings.length === 0 → xxxPassed = true`，门禁就报「✓ 通过」。
// grep 的退出码本来就分得清：0 = 有匹配，1 = 没有匹配，≥2 = 出错。
describe('grepScan：三态判定', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('退出码 0（有匹配）→ ok 且带输出', () => {
    safeExec.mockReturnValue('src/a.js:1:import.meta.env.SECRET');
    const result = grepScan('grep -rn x .', '/tmp');
    expect(result.ok).toBe(true);
    expect(result.raw).toContain('SECRET');
  });

  it('退出码 1（没有匹配）→ ok，空输出（这是正常结论，不是失败）', () => {
    const error = new Error('Command failed');
    error.status = 1;
    safeExec.mockImplementation(() => { throw error; });
    const result = grepScan('grep -rn x .', '/tmp');
    expect(result.ok).toBe(true);
    expect(result.raw).toBe('');
  });

  it('退出码 2（出错）→ ok:false，并且带上原因', () => {
    const error = new Error('Command failed');
    error.status = 2;
    error.stderr = 'grep: .: No such file or directory';
    safeExec.mockImplementation(() => { throw error; });
    const result = grepScan('grep -rn x .', '/tmp');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('No such file or directory');
  });

  it('命令不存在（127 / 无 status）→ ok:false，不许当成「没有匹配」', () => {
    const notFound = new Error("'grep' is not recognized");
    notFound.status = 127;
    safeExec.mockImplementation(() => { throw notFound; });
    expect(grepScan('grep -rn x .', '/tmp').ok).toBe(false);

    const noStatus = new Error('safeExec: target directory does not exist: /tmp');
    safeExec.mockImplementation(() => { throw noStatus; });
    const result = grepScan('grep -rn x .', '/tmp');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('target directory does not exist');
  });
});
