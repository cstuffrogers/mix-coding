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
  loadSkillspectorBaseline,
  compareSkillspectorFindings,
} = await import('./external-tool-checks.js');
// 分类是引擎侧的函数：断言要用「引擎实际读到的那个字段」，不是自己写的那个键。
const { skipReasonFrom, warnKindFrom } = await import('../data/step-reasons.js');

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

// 第三十六轮：这条检查以前 >0 就 warn —— 每次 review 都挂同一条、数字从不变化，
// 没人会去看。“有发现”一旦恒为真，就不再是信息。改成对**冻结基线**判增量：
// 一致 → pass（数字照样写在消息里）；超出 → warn 并点名涨了的规则；
// 读不到基线 → skip（既不能说通过，也不能替人下结论）。
const BASELINE = loadSkillspectorBaseline();

/** 按基线的 byRule 造一批命中（默认 MEDIUM），用来造“与基线一致”的场景。 */
function seedFromBaseline(byRule) {
  return Object.entries(byRule).flatMap(([rule, n]) =>
    Array.from({ length: n }, () => ({ severity: 'MEDIUM', pattern: rule, location: { file: 'skills/x/SKILL.md' } })));
}

function scanOnce(findings) {
  mockSafeExec
    .mockReturnValueOnce(out('SkillSpector 2.1.4'))
    .mockReturnValueOnce(out(JSON.stringify({ issues: findings })));
  return handleSkillspectorScan('skillspector', { targets: ['.claude/skills/'] }, root, {});
}

describe('skillspector 冻结基线：噪声地板变成增量信号', () => {
  it('基线文件自身成立：total 等于 byRule 之和', () => {
    expect(BASELINE.ok).toBe(true);
    const sum = Object.values(BASELINE.data.byRule).reduce((a, b) => a + b, 0);
    expect(sum).toBe(BASELINE.data.total);
    // 上面那条「有 CRITICAL 也只 warn」的用例靠『PHPshell 不在基线里』成立：
    // 基线一重生成就可能变成「与基线一致 → pass」。这里把依赖写死，改基线时先红。
    expect(Object.keys(BASELINE.data.byRule)).not.toContain('PHPshell');
  });

  it('与基线一致 → pass，但数字照样写清楚（不是「无问题」）', () => {
    const result = scanOnce(seedFromBaseline(BASELINE.data.byRule));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('与冻结基线一致');
    expect(result.message).toContain(`共 ${BASELINE.data.total} 个`);
    expect(result.message).not.toContain('无问题');
  });

  it('某条规则涨了 1 条 → warn 并点名规则与「基线→现在」', () => {
    const [rule, base] = Object.entries(BASELINE.data.byRule)[0];
    const findings = [
      ...seedFromBaseline(BASELINE.data.byRule),
      { severity: 'MEDIUM', pattern: rule, location: { file: 'skills/x/SKILL.md' } },
    ];
    const result = scanOnce(findings);
    expect(result.status).toBe('warn');
    expect(warnKindFrom(result).kind).toBe('findings');
    expect(result.message).toContain(`${rule} ${base}→${base + 1}`);
    expect(result.message).toContain('需人工复核');
  });

  it('基线里没有的规则（新规则）→ warn，base 记 0', () => {
    const findings = [
      ...seedFromBaseline(BASELINE.data.byRule),
      { severity: 'CRITICAL', pattern: 'YARA rule my-new-rule', location: { file: 'skills/y/SKILL.md' } },
      { severity: 'HIGH', pattern: 'YARA rule my-new-rule', location: { file: 'skills/y/SKILL.md' } },
    ];
    const result = scanOnce(findings);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('YARA rule my-new-rule 0→2');
  });

  it('扫出来比基线少 → pass，并提醒可以下调基线（不许静默）', () => {
    const entries = Object.entries(BASELINE.data.byRule);
    const trimmed = Object.fromEntries(entries.slice(1));
    const dropped = entries[0][1];
    const result = scanOnce(seedFromBaseline(trimmed));
    expect(result.status).toBe('pass');
    expect(result.message).toContain(`比基线少 ${dropped} 条`);
    expect(result.message).toContain('可下调基线');
  });

  it('一条都没扫到 → pass「无问题」', () => {
    const result = scanOnce([]);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('无问题');
  });

  it('基线文件不存在 → skip（不许把 105 条当 0 条，也不许替人下结论）', () => {
    const prev = process.env.SKILLSPECTOR_BASELINE;
    process.env.SKILLSPECTOR_BASELINE = join(root, 'no-such-baseline.json');
    try {
      const result = scanOnce(seedFromBaseline(BASELINE.data.byRule));
      expect(result.status).toBe('skip');
      // 第三十六轮：这里原本断言的是 `skipReason`，而引擎读的是 `reason` ——
      // 写错键等于「声明了但没人听见」，单测还是绿的。断言走引擎的分类函数。
      expect(skipReasonFrom(result).reason).toBe('input-missing');
      expect(result.message).toContain('读不到冻结基线');
      expect(result.message).toContain('基线文件不存在');
    } finally {
      if (prev === undefined) delete process.env.SKILLSPECTOR_BASELINE;
      else process.env.SKILLSPECTOR_BASELINE = prev;
    }
  });

  it('基线文件形状不对（缺 byRule）→ skip，理由写的是「缺 total / byRule」', () => {
    const prev = process.env.SKILLSPECTOR_BASELINE;
    const broken = join(root, 'shape-baseline.json');
    writeFileSync(broken, JSON.stringify({ total: 105 }), 'utf-8');
    process.env.SKILLSPECTOR_BASELINE = broken;
    try {
      const result = scanOnce(seedFromBaseline(BASELINE.data.byRule));
      expect(result.status).toBe('skip');
      expect(result.message).toContain('缺 total / byRule');
    } finally {
      if (prev === undefined) delete process.env.SKILLSPECTOR_BASELINE;
      else process.env.SKILLSPECTOR_BASELINE = prev;
    }
  });
});

describe('compareSkillspectorFindings：纯函数层面', () => {
  it('同一规则多一条就点名，与规则顺序无关', () => {
    const diff = compareSkillspectorFindings(
      [{ pattern: 'B' }, { pattern: 'A' }, { pattern: 'A' }],
      { total: 2, byRule: { A: 1, B: 1 } },
    );
    expect(diff.risen).toHaveLength(1);
    expect(diff.risen[0]).toEqual({ rule: 'A', now: 2, base: 1 });
  });

  it('缺 pattern/rule/type 的命中归到「未分类」，不许静默丢弃', () => {
    const diff = compareSkillspectorFindings([{ severity: 'HIGH' }], { total: 0, byRule: {} });
    expect(diff.byRule.get('未分类')).toBe(1);
    expect(diff.risen[0].rule).toBe('未分类');
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
