import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// npm-scan.js 的三个 handler 长期没有任何测试 —— 于是「npm audit 没跑成 → 记
// highSeverityFound = false → security 门禁报 ✓ 通过」这条假绿一直活着。
// 这里按「工具没跑通 ≠ 项目没问题」逐个钉住三种返回：查到 / 确认为 0 / 不知道。

const execMock = vi.hoisted(() => ({ safeExec: vi.fn() }));
vi.mock('../../lib/safe-exec.js', () => ({ safeExec: execMock.safeExec }));

const { handleSecurityScan, handleAnalyzeSecurityVulnerabilities, handleDeprecatedDeps } =
  await import('./npm-scan.js');

let dir;

beforeEach(() => {
  execMock.safeExec.mockReset();
  dir = mkdtempSync(join(tmpdir(), 'mix-npmscan-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 让 npm audit 输出一段无法解析的文本（registry 不支持的典型表现） */
function auditUnparsable() {
  execMock.safeExec.mockReturnValue('npm ERR! audit endpoint not supported by this registry\n');
}

describe('handleSecurityScan：npm audit 没跑成不能算「没漏洞」', () => {
  it('npm audit 输出无法解析 → warn，且不写 highSeverityFound（门禁如实跳过）', () => {
    auditUnparsable();
    const ctx = {};
    const result = handleSecurityScan('securityScan', {}, dir, ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('不是通过');
    // 关键：没有 verdict ≠ verdict false
    expect(ctx.securityScanResult?.highSeverityFound).toBeUndefined();
    expect(ctx.high_severity_found).toBeUndefined();
  });

  it('npm audit 真跑了且 0 漏洞 → pass，明确写 highSeverityFound = false', () => {
    execMock.safeExec.mockReturnValue(JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: {} } }));
    const ctx = {};
    const result = handleSecurityScan('securityScan', {}, dir, ctx);
    expect(typeof result).toBe('string');
    expect(result).toContain('无问题');
    expect(ctx.securityScanResult.highSeverityFound).toBe(false);
  });

  it('npm audit 报告 2 个漏洞 → 结论里带出来，并置 high_severity_found', () => {
    execMock.safeExec.mockReturnValue(JSON.stringify({ vulnerabilities: { a: {}, b: {} } }));
    const ctx = {};
    const result = handleSecurityScan('securityScan', {}, dir, ctx);
    expect(result).toContain('npm: 2 漏洞');
    expect(ctx.securityScanResult.highSeverityFound).toBe(true);
    expect(ctx.high_severity_found).toBe(true);
  });

  it('源码里发现硬编码秘密 → 即便 npm 那侧没跑通也报出来', () => {
    auditUnparsable();
    writeFileSync(join(dir, 'src/app.js'), 'const api_key = "abcdefghijklmnopqrstuvwxyz123456";\n');
    const ctx = {};
    const result = handleSecurityScan('securityScan', {}, dir, ctx);
    expect(result).toContain('API Key');
    expect(ctx.securityScanResult.highSeverityFound).toBe(true);
  });

  it('人类可读输出里的 "found 0 vulnerabilities" 算「查过，没有」', () => {
    // JSON 解析失败 → 落到 scrape 分支
    execMock.safeExec
      .mockReturnValueOnce('not json at all')
      .mockReturnValueOnce('found 0 vulnerabilities\n');
    const ctx = {};
    const result = handleSecurityScan('securityScan', {}, dir, ctx);
    expect(result).toContain('无问题');
    expect(ctx.securityScanResult.highSeverityFound).toBe(false);
  });
});

describe('handleAnalyzeSecurityVulnerabilities：审计没跑成不写 verdict', () => {
  it('输出无法解析 → warn，不写 highSeverityFound', () => {
    auditUnparsable();
    const ctx = {};
    const result = handleAnalyzeSecurityVulnerabilities('v', {}, dir, ctx);
    expect(result.status).toBe('warn');
    expect(ctx.securityScanResult).toBeUndefined();
  });

  it('解析出 critical + high → highSeverityFound = true', () => {
    execMock.safeExec.mockReturnValue(JSON.stringify({
      vulnerabilities: {
        x: { severity: 'critical' },
        y: { severity: 'high' },
        z: { severity: 'low' },
      },
    }));
    const ctx = {};
    const result = handleAnalyzeSecurityVulnerabilities('v', {}, dir, ctx);
    expect(result).toContain('3 个漏洞');
    expect(ctx.securityScanResult.highSeverityFound).toBe(true);
    expect(ctx.securityScanResult.vulnerabilityCount).toBe(3);
  });

  it('只有 low/medium → highSeverityFound = false（有结论的 false，不是猜的）', () => {
    execMock.safeExec.mockReturnValue(JSON.stringify({ vulnerabilities: { z: { severity: 'low' } } }));
    const ctx = {};
    handleAnalyzeSecurityVulnerabilities('v', {}, dir, ctx);
    expect(ctx.securityScanResult.highSeverityFound).toBe(false);
  });

  it('depth 参数真的进到了命令里', () => {
    execMock.safeExec.mockReturnValue(JSON.stringify({ vulnerabilities: {} }));
    handleAnalyzeSecurityVulnerabilities('v', { depth: 3 }, dir, {});
    expect(execMock.safeExec.mock.calls[0][0]).toContain('--depth 3');
  });
});

describe('handleDeprecatedDeps：npm outdated 没跑成不写 verdict（假绿同源）', () => {
  it('safeExec 抛错 → warn，不写 deprecatedDepsPassed', () => {
    execMock.safeExec.mockImplementation(() => { throw new Error('ENOENT: npm not found'); });
    const ctx = {};
    const result = handleDeprecatedDeps('d', {}, dir, ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('未完成');
    expect(ctx.deprecatedDepsPassed).toBeUndefined();
  });

  it('输出里既没有数据也不是「空」 → warn（不能当成查过）', () => {
    execMock.safeExec.mockReturnValue('registry unreachable\n');
    const ctx = {};
    const result = handleDeprecatedDeps('d', {}, dir, ctx);
    expect(result.status).toBe('warn');
    expect(ctx.deprecatedDepsPassed).toBeUndefined();
  });

  it('npm outdated 输出为空字符串 → 查过且没有过期依赖 → pass', () => {
    execMock.safeExec.mockReturnValue('');
    const ctx = {};
    const result = handleDeprecatedDeps('d', {}, dir, ctx);
    expect(result).toContain('0 个');
    expect(ctx.deprecatedDepsPassed).toBe(true);
  });

  it('JSON 里标了 deprecated → 计数正确，verdict 为 false', () => {
    execMock.safeExec.mockReturnValue(JSON.stringify({ left: { current: '1.0.0', latest: '2.0.0', deprecated: 'no longer supported' } }));
    const ctx = {};
    const result = handleDeprecatedDeps('d', {}, dir, ctx);
    expect(result).toContain('1 个');
    expect(ctx.deprecatedDepsPassed).toBe(false);
  });
});
