import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../lib/safe-exec.js', () => ({
  safeExec: vi.fn(),
  safeExecFile: vi.fn(),
  escapeArg: String,
}));

const { safeExec } = await import('../lib/safe-exec.js');
const { handleAnalyzeConsistency } = await import('./design.js');
const { handleVerifyFix, handleRegression } = await import('./issues.js');
const { handleCreateRelease, handleAutoUpdate } = await import('./git.js');
const { handleInstallDeps, handleDocsUpdate } = await import('./flow-control.js');
const { handleCheckOutdated } = await import('./deps.js');
const { handleAislopScan } = await import('./aislop.js');
const { handleApiDocs } = await import('./docs.js');
const { UI_POLISH_ACTIONS } = await import('./ui-polish.js');

/** 建一个临时项目目录，files = { '相对路径': '内容' } */
function project(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'falsegreen-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('假绿回归：设计一致性检查', () => {
  it('没有 CSS 文件 → skip，而不是「检查完成」', () => {
    const r = handleAnalyzeConsistency('x', {}, project({ 'src/a.js': 'export const a = 1;' }), {});
    expect(r.status).toBe('skip');
  });

  it('找出一堆硬编码色 → warn，而不是「检查完成」', () => {
    const dir = project({ 'src/a.css': '.a{color:#fff;background:#000;border:#123456}' });
    const ctx = {};
    const r = handleAnalyzeConsistency('x', {}, dir, ctx);
    expect(r.status).toBe('warn');
    expect(r.message).toMatch(/硬编码色值/);
    expect(ctx.consistency_warn_count).toBe(1);
  });

  it('色值全走变量 → pass', () => {
    const dir = project({ 'src/a.css': ':root{--c:#fff}.a{color:var(--c);background:var(--c)}' });
    const r = handleAnalyzeConsistency('x', {}, dir, {});
    expect(typeof r).toBe('string');
    expect(r).toContain('检查完成');
  });
});

describe('假绿回归：API 文档生成', () => {
  it('没有源文件目录 → skip，而不是「生成完成」', () => {
    const r = handleApiDocs('api-docs', {}, project({ 'README.md': '# x' }), {});
    expect(r.status).toBe('skip');
  });
});

describe('假绿回归：修复/回归测试验证', () => {
  it('测试真的跑了且失败 → fail（不是「运行器不可用」）', () => {
    safeExec.mockImplementation(() => { throw Object.assign(new Error('Command failed'), { status: 1, stdout: '1 failed' }); });
    expect(handleRegression('x', {}, '/tmp', {}).status).toBe('fail');
    expect(handleVerifyFix('x', {}, '/tmp', {}).status).toBe('fail');
  });

  it('测试运行器起不来 → warn（没验证过，不能算通过）', () => {
    safeExec.mockImplementation(() => { throw new Error('spawn npx ENOENT'); });
    const r = handleRegression('x', {}, '/tmp', {});
    expect(r.status).toBe('warn');
    expect(r.message).toContain('未执行');
  });

  it('没有任何测试文件 → warn，而不是 fail 也不是 pass', () => {
    safeExec.mockImplementation(() => { throw Object.assign(new Error('x'), { status: 1, stdout: 'No test files found, exiting with code 1' }); });
    expect(handleRegression('x', {}, '/tmp', {}).status).toBe('warn');
  });

  it('测试全绿 → 字符串 pass', () => {
    safeExec.mockReturnValue(Buffer.from('Test Files 3 passed'));
    expect(handleRegression('x', {}, '/tmp', {})).toBe('回归测试通过');
  });
});

describe('假绿回归：gh CLI 不可用', () => {
  // 以前命令里拼了 `|| true`，gh 不存在也 exit 0，于是
  // "Release 已创建: gh: command not found" 被记成 ✓ pass。
  it('gh 起不来 → warn 且明说未创建', () => {
    safeExec.mockImplementation(() => { throw Object.assign(new Error('Command failed: gh release create'), { status: 127 }); });
    const r = handleCreateRelease('x', { tag: 'v1' }, '/tmp', {});
    expect(r.status).toBe('warn');
    expect(r.message).toContain('未创建');
  });

  it('创建成功 → 报已创建', () => {
    safeExec.mockReturnValue(Buffer.from('https://github.com/o/r/releases/v1'));
    expect(handleCreateRelease('x', { tag: 'v1' }, '/tmp', {})).toContain('已创建');
  });
});

describe('假绿回归：ui-polish 验证器', () => {
  it('indigo 色没清干净 → warn', () => {
    const dir = project({ 'src/a.tsx': 'const c = "#6366f1";' });
    const r = UI_POLISH_ACTIONS.verifyNoHardcodedIndigo.handler(dir);
    expect(r.status).toBe('warn');
    expect(r.message).toContain('仍有 1 处');
  });

  it('indigo 色清干净 → 字符串 pass', () => {
    const dir = project({ 'src/a.tsx': 'const c = "text-primary";' });
    expect(UI_POLISH_ACTIONS.verifyNoHardcodedIndigo.handler(dir)).toContain('验证通过');
  });

  it('Material Icons 没换掉 → warn', () => {
    const dir = project({ 'src/a.tsx': '<span class="material-icons">home</span>' });
    expect(UI_POLISH_ACTIONS.verifyIconUpgrade.handler(dir).status).toBe('warn');
  });

  it('animate.css 还有引用 → warn', () => {
    const dir = project({ 'src/a.tsx': 'import "animate.css";' });
    expect(UI_POLISH_ACTIONS.verifyAnimations.handler(dir).status).toBe('warn');
  });

  it('正则不带 g：多文件统计不会因 lastIndex 漏判', () => {
    // 带 g 时第一次 .test() 命中后 lastIndex 前移，第二个文件会被跳过 → 统计假绿。
    const dir = project({
      'src/a.tsx': '<div className="btn btn-primary">a</div>',
      'src/b.tsx': '<div className="card input-bordered">b</div>',
    });
    const msg = UI_POLISH_ACTIONS.verifyDaisyUIComponents.handler(dir);
    expect(msg).toContain('2/2');
  });
});

/**
 * 第三轮全量审计（26 场景 / 586 步）捞出来的假绿与假信号。
 * 共同点：handler 什么都没做（或没做成），却给出一句读起来像「完成」的话。
 */
describe('假绿回归：没做成的步骤不许记 pass', () => {
  it('没有 package.json → 依赖安装 skip，而不是「安装完成」', () => {
    expect(handleInstallDeps('installDeps', {}, project(), {}).status).toBe('skip');
  });

  it('没有 README → 文档更新 skip，而不是「更新完成」', () => {
    expect(handleDocsUpdate('docsUpdate', {}, project(), {}).status).toBe('skip');
  });

  it('README 已带 Last updated → noop，而不是重复「更新完成」', () => {
    const dir = project({ 'README.md': ['# x', '', 'Last updated: 2020-01-01', ''].join('\n') });
    expect(handleDocsUpdate('docsUpdate', {}, dir, {}).status).toBe('noop');
  });

  it('npm outdated 输出无法解析 → warn，且明确「没有结论」', () => {
    safeExec.mockReturnValue(Buffer.from('npm ERR! network timeout'));
    const r = handleCheckOutdated('checkOutdated', {}, project(), {});
    expect(r.status).toBe('warn');
    expect(r.message).toContain('未完成');
    expect(r.message).toContain('network timeout');
  });

  it('npm outdated 返回 {} → pass（真的全部最新）', () => {
    safeExec.mockReturnValue(Buffer.from('{}'));
    const ctx = {};
    expect(handleCheckOutdated('checkOutdated', {}, project(), ctx).status).toBe('pass');
    expect(ctx.dependencyAuditPassed).toBe(true);
  });

  it('aislop 完全没有输出 → warn，而不是「未发现 AI 代码气味」', () => {
    safeExec.mockReturnValue(Buffer.from(''));
    const ctx = {};
    const r = handleAislopScan('aislopScan', {}, project(), ctx);
    expect(r.status).toBe('warn');
    expect(ctx.aislopPassed).toBe(false);
  });

  it('仓库没有配远程 → 代码更新 skip，而不是「更新失败」', () => {
    // 非 git 目录里 `git remote` 直接抛错 → remotes 为空 → skip（不是 fail）
    expect(handleAutoUpdate('autoUpdate', {}, project(), {}).status).toBe('skip');
  });
});
