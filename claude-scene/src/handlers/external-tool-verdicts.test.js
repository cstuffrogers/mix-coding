import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 第十二轮维度A：**外部工具报出的发现 → 步骤状态**。
// 修的是同一类假绿：handler 找到 N 个问题，却 still 返回一句「…完成: N 项」，
// 引擎按文案判 pass，而门禁旗标写的是 false —— 报告里一行绿一行 failed。
// 契约集中在 lib/finding-verdict.js；这里验证每个 handler 真的按它发状态。
const { mockSafeExec } = vi.hoisted(() => ({ mockSafeExec: vi.fn() }));
vi.mock('../lib/safe-exec.js', () => ({ safeExec: mockSafeExec, escapeArg: String }));

const {
  handleKnipCheck,
  handleActionlint,
  handleZizmor,
  handleJscpd,
  handleSkillspectorScan,
  handleSpectral,
  handleMarkdownlint,
  handleSizeLimit,
} = await import('./external-tool-checks.js');

// claude-scene 的 eslint 没开 node globals，别用 Buffer；handler 只调 .toString()
const out = (s) => ({ toString: () => s });

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tool-verdict-'));
  mockSafeExec.mockReset();
  mockSafeExec.mockReturnValue(out(''));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('knip：找到死代码就不是 pass', () => {
  it('JSON 里有 4 项 → warn，旗标 false，数量写在消息里', () => {
    mockSafeExec.mockReturnValue(out(JSON.stringify({
      issues: [{ files: ['x.js'], dependencies: ['lodash'], exports: ['a', 'b'] }],
    })));
    const context = {};
    const result = handleKnipCheck('knip', {}, root, context);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('4 项');
    expect(context.deadCodePassed).toBe(false);
  });

  it('knip 有发现时退出码非 0 —— stdout 里的 JSON 仍然要读出来', () => {
    const err = new Error('Command failed: npx knip');
    err.stdout = out(JSON.stringify({ issues: [{ files: ['x.js'] }] }));
    mockSafeExec.mockImplementation(() => { throw err; });
    const context = {};
    const result = handleKnipCheck('knip', {}, root, context);
    expect(result.status).toBe('warn');
    expect(context.deadCodePassed).toBe(false);
  });

  it('knip 没装 → skip，且不写「死代码通过」的旗标', () => {
    mockSafeExec.mockReturnValue(out("'knip' is not recognized as an internal or external command"));
    const context = {};
    const result = handleKnipCheck('knip', {}, root, context);
    expect(result.status).toBe('skip');
    expect(context.deadCodePassed).toBeUndefined();
  });

  it('零发现才是 pass', () => {
    mockSafeExec.mockReturnValue(out(JSON.stringify({ issues: [] })));
    const context = {};
    expect(handleKnipCheck('knip', {}, root, {})).toContain('无死代码');
    handleKnipCheck('knip', {}, root, context);
    expect(context.deadCodePassed).toBe(true);
  });
});

describe('actionlint：工作流语法错误是 error 级', () => {
  beforeEach(() => mkdirSync(join(root, '.github', 'workflows'), { recursive: true }));

  it('一条 ::error → fail（CI 会直接挂，不该只记黄字）', () => {
    mockSafeExec.mockReturnValue(out('::error file=.github/workflows/ci.yml,line=3,col=1::unexpected key "foo"\n'));
    const context = {};
    const result = handleActionlint('actionlint', {}, root, context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('1 个工作流语法错误');
    expect(context.actionlintPassed).toBe(false);
  });

  it('npx 报「没装」不再算「工作流语法无问题」', () => {
    mockSafeExec.mockReturnValue(out("'actionlint' is not recognized as an internal or external command"));
    const context = {};
    const result = handleActionlint('actionlint', {}, root, context);
    expect(result.status).toBe('skip');
    expect(context.actionlintPassed).toBeUndefined();
  });

  it('输出既不是 ::error 也不是干净格式 → warn（解析不出 ≠ 通过）', () => {
    mockSafeExec.mockReturnValue(out('some unexpected output'));
    const result = handleActionlint('actionlint', {}, root, {});
    expect(result.status).toBe('warn');
  });

  it('干净输出 → pass，旗标 true', () => {
    const context = {};
    const result = handleActionlint('actionlint', {}, root, context);
    expect(result).toContain('无问题');
    expect(context.actionlintPassed).toBe(true);
  });
});

describe('zizmor：按工具自己的严重级别分档', () => {
  beforeEach(() => mkdirSync(join(root, '.github', 'workflows'), { recursive: true }));

  it('有 error 级 → fail', () => {
    mockSafeExec.mockReturnValue(out(JSON.stringify([
      { severity: 'error' }, { severity: 'warning' }, { severity: 'warning' },
    ])));
    const context = {};
    const result = handleZizmor('zizmor', {}, root, context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('error/critical 级 1 个');
    expect(context.zizmorPassed).toBe(false);
  });

  it('只有 warning 级 → warn（不夸大也不吞掉）', () => {
    mockSafeExec.mockReturnValue(out(JSON.stringify([{ severity: 'warning' }, { severity: 'note' }])));
    const context = {};
    const result = handleZizmor('zizmor', {}, root, context);
    expect(result.status).toBe('warn');
    expect(context.zizmorPassed).toBe(false);
  });

  it('零发现 → pass', () => {
    const context = {};
    expect(handleZizmor('zizmor', {}, root, {})).toContain('无问题');
    handleZizmor('zizmor', {}, root, context);
    expect(context.zizmorPassed).toBe(true);
  });

  it('npx 报「没装」→ skip，不写 zizmorPassed', () => {
    mockSafeExec.mockReturnValue(out('npm ERR! 404 Not Found - could not determine executable to run'));
    const context = {};
    const result = handleZizmor('zizmor', {}, root, context);
    expect(result.status).toBe('skip');
    expect(context.zizmorPassed).toBeUndefined();
  });
});

describe('jscpd：重复率越线就不是「完成」', () => {
  it('重复率 12.5% 超过 5% 阈值 → warn，旗标 false', () => {
    mockSafeExec.mockReturnValue(out('Found 12 clones\nDuplicated lines 200 (12.5%)'));
    const context = {};
    const result = handleJscpd('jscpd', {}, root, context);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('12.5%');
    expect(context.jscpdPassed).toBe(false);
  });

  it('重复率 2% 在阈值内 → pass，旗标 true', () => {
    mockSafeExec.mockReturnValue(out('Found 2 clones\nDuplicated lines 30 (2%)'));
    const context = {};
    const result = handleJscpd('jscpd', {}, root, context);
    expect(String(result)).toContain('2.0%');
    expect(context.jscpdPassed).toBe(true);
  });

  it('场景声明的 threshold 真的改变判定（0.05 → 5%，>1 当百分数）', () => {
    // 重复率 3%：默认 5% 阈值下通过，声明 0.02 就必须越线
    mockSafeExec.mockReturnValue(out('Found 3 clones\nDuplicated lines 60 (3%)'));
    const strict = handleJscpd('jscpd', { threshold: 0.02 }, root, {});
    expect(strict.status).toBe('warn');
    expect(strict.message).toContain('超过 2% 阈值'); // 0.02 换算成 2% 并真的用于判定

    mockSafeExec.mockReturnValue(out('Found 3 clones\nDuplicated lines 60 (3%)'));
    const loose = handleJscpd('jscpd', { threshold: 10 }, root, {});
    expect(String(loose)).toContain('阈值 10%');
  });

  it('threshold 声明了但不是可用数字 → 回落默认值，并在结论里说明', () => {
    mockSafeExec.mockReturnValue(out('Found 1 clones\nDuplicated lines 10 (1%)'));
    const result = handleJscpd('jscpd', { threshold: 'five' }, root, {});
    expect(String(result)).toContain('阈值 5%');
    expect(String(result)).toContain('不是数字');
  });
});

describe('skillspector：扫文档必然命中示例代码 → 只 warn，且不写门禁旗标', () => {
  it('有 CRITICAL 也只记 warn，不写 skillspectorPassed', () => {
    // probeTool 先跑 --version，随后每个 target 一次 scan
    mockSafeExec
      .mockReturnValueOnce(out('SkillSpector 2.1.4'))
      .mockReturnValueOnce(out(JSON.stringify({
        issues: [{ severity: 'CRITICAL', pattern: 'PHPshell', location: { file: 'skills/x/references/lang-php.md' } }],
      })));
    const context = {};
    const result = handleSkillspectorScan('skillspector', { targets: ['.claude/skills/'] }, root, context);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('人工复核');
    // 「扫描对象是文档」的判定：写 passed 旗标 = 恒 false 的假门禁
    expect(context.skillspectorPassed).toBeUndefined();
  });
});

// 第十三轮维度1：**工具没跑成时不许写门禁旗标**。
// 以前 spectral / markdownlint / size-limit 三条都有同一个坑：catch 之后计数变量
// 还停在初始值（0 / true），于是 `xPassed = true` 写进了 context，门禁报通过 ——
// 而工具根本没装、根本没跑。没测量就是没测量，不许冒充达标。
describe('工具没跑成 → skip 且不写 verdict 旗标', () => {
  it('spectral 无 spec 文件 → noop，不写 spectralPassed', () => {
    const context = {};
    const result = handleSpectral('spectral', {}, root, context);
    expect(result.status).toBe('noop');
    expect(context.spectralPassed).toBeUndefined();
    expect(mockSafeExec).not.toHaveBeenCalled();
  });

  it('spectral 工具缺失 → skip，不写 spectralPassed', () => {
    writeFileSync(join(root, 'openapi.yaml'), 'openapi: 3.0.0\n');
    mockSafeExec.mockReturnValue(out("'spectral' is not recognized as an internal or external command"));
    const context = {};
    const result = handleSpectral('spectral', {}, root, context);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('不是通过');
    expect(context.spectralPassed).toBeUndefined();
  });

  it('markdownlint 工具缺失 → skip，不写 markdownlintPassed', () => {
    mockSafeExec.mockReturnValue(out("'markdownlint' is not recognized as an internal or external command"));
    const context = {};
    const result = handleMarkdownlint('markdownlint', {}, root, context);
    expect(result.status).toBe('skip');
    expect(context.markdownlintPassed).toBeUndefined();
  });

  it('size-limit 无配置 → noop，不写 sizeLimitPassed', () => {
    const context = {};
    const result = handleSizeLimit('sizeLimit', {}, root, context);
    expect(result.status).toBe('noop');
    expect(context.sizeLimitPassed).toBeUndefined();
    expect(mockSafeExec).not.toHaveBeenCalled();
  });

  it('size-limit 工具缺失 → skip，不写 sizeLimitPassed', () => {
    writeFileSync(join(root, '.size-limit.json'), '[]');
    mockSafeExec.mockReturnValue(out("'size-limit' is not recognized as an internal or external command"));
    const context = {};
    const result = handleSizeLimit('sizeLimit', {}, root, context);
    expect(result.status).toBe('skip');
    expect(context.sizeLimitPassed).toBeUndefined();
  });
});
