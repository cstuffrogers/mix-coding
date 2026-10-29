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
const { handleSkillspectorScan } = await import('./external-tool-checks.js');
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

  it('测试运行器起不来 → skip（没验证过，不能算通过）', () => {
    safeExec.mockImplementation(() => { throw new Error('spawn npx ENOENT'); });
    const r = handleRegression('x', {}, '/tmp', {});
    expect(r.status).toBe('skip');
    expect(r.message).toContain('未执行');
  });

  it('没有任何测试文件 → skip，而不是 fail 也不是 pass', () => {
    safeExec.mockImplementation(() => { throw Object.assign(new Error('x'), { status: 1, stdout: 'No test files found, exiting with code 1' }); });
    expect(handleRegression('x', {}, '/tmp', {}).status).toBe('skip');
  });

  it('测试全绿 → 字符串 pass', () => {
    safeExec.mockReturnValue(Buffer.from('Test Files 3 passed'));
    expect(handleRegression('x', {}, '/tmp', {})).toBe('回归测试通过');
  });
});

describe('假绿回归：gh CLI 不可用', () => {
  // 以前命令里拼了 `|| true`，gh 不存在也 exit 0，于是
  // "Release 已创建: gh: command not found" 被记成 ✓ pass。
  // 契约变更（第五轮）：以前「gh 出错」一律当 warn（工具没跑通）。但 gh 出错分两种：
  // 没装（跳过，本来就没得跑）和 装了但失败（认证/网络/参数错 —— 是真的没发出去）。
  // 后者以前混在 warn 里，会被当成「不是项目的问题」放过去。
  it('gh 没装 → skip，说明未创建', () => {
    safeExec.mockImplementation(() => { throw new Error(['Command failed: gh release create', 'gh: command not found'].join('\n')); });
    const r = handleCreateRelease('x', { tag: 'v1' }, '/tmp', {});
    expect(r.status).toBe('skip');
    expect(r.message).toContain('未创建');
  });

  it('gh 装了但执行失败 → fail（认证/参数错不是「工具不可用」）', () => {
    safeExec.mockImplementation(() => { throw Object.assign(new Error(['Command failed: gh release create', 'HTTP 401: Bad credentials'].join('\n')), { status: 1 }); });
    const r = handleCreateRelease('x', { tag: 'v1' }, '/tmp', {});
    expect(r.status).toBe('fail');
    expect(r.message).toContain('创建失败');
  });

  it('body_ref 指向的 context 变量不存在 → 正文为空要说出来', () => {
    safeExec.mockReturnValue(Buffer.from('https://github.com/o/r/releases/v1'));
    const r = handleCreateRelease('x', { tag: 'v1', body_ref: 'changelog_content' }, '/tmp', {});
    expect(String(r)).toContain('changelog_content');
    // 有正文时走 --notes-file（不是把正文塞进 shell 引号里）
    const ctx = { changelog_content: ['## v1', '- fix'].join('\n') };
    handleCreateRelease('x', { tag: 'v1', body_ref: 'changelog_content' }, '/tmp', ctx);
    const lastCmd = safeExec.mock.calls.at(-1)[0];
    expect(lastCmd).toContain('--notes-file');
  });

  it('prerelease / tag_ref 真的进了 gh 命令', () => {
    safeExec.mockReturnValue(Buffer.from('ok'));
    handleCreateRelease('x', { tag: 'v1', tag_ref: 'new_version', prerelease: true }, '/tmp', { new_version: 'v1.2.3' });
    const cmd = safeExec.mock.calls.at(-1)[0];
    expect(cmd).toContain('--prerelease');
    expect(cmd).toContain('--target v1.2.3');
  });

  it('draft 真的进了 gh 命令（两个场景都声明了 draft: false）', () => {
    // release#13 与 mobile-release#10 的 params 里都有 draft。以前没人读它：
    // 场景写着草稿就草稿、正式就正式 —— 而实际两种都发正式版。
    // 当时这条声明还被文案表里的 'web-design-v0-draft' 子串掩护着。
    safeExec.mockReturnValue(Buffer.from('ok'));
    handleCreateRelease('x', { tag: 'v1', draft: true }, '/tmp', {});
    expect(safeExec.mock.calls.at(-1)[0]).toContain('--draft');
    expect(handleCreateRelease('x', { tag: 'v1', draft: true }, '/tmp', {})).toContain('草稿');
    safeExec.mockReturnValue(Buffer.from('ok'));
    const notDraft = handleCreateRelease('x', { tag: 'v1', draft: false }, '/tmp', {});
    expect(safeExec.mock.calls.at(-1)[0]).not.toContain('--draft');
    expect(String(notDraft)).not.toContain('草稿');
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

  it('aislop 完全没有输出 → skip，而不是「未发现 AI 代码气味」', () => {
    safeExec.mockReturnValue(Buffer.from(''));
    const ctx = {};
    const r = handleAislopScan('aislopScan', {}, project(), ctx);
    expect(r.status).toBe('skip');
    expect(ctx.aislopPassed).toBe(false);
  });

  it('仓库没有配远程 → 代码更新 skip，而不是「更新失败」', () => {
    // 非 git 目录里 `git remote` 直接抛错 → remotes 为空 → skip（不是 fail）
    expect(handleAutoUpdate('autoUpdate', {}, project(), {}).status).toBe('skip');
  });
});

describe('假绿回归：SkillSpector 扫描没跑完', () => {
  it('扫描抛错且没有结果 → warn，并挑一句真实的错误（不是库的弃用警告）', () => {
    const dir = project({ '.claude/skills/demo/SKILL.md': '# demo' });
    safeExec
      .mockReturnValueOnce(Buffer.from('SkillSpector v2.1.4'))  // probe --version
      .mockImplementationOnce(() => {
        const err = new Error([
          'Command failed: skillspector scan',
          '/py/langgraph/cache/base/__init__.py:8: LangChainPendingDeprecationWarning: xxx',
          'Traceback (most recent call last):',
          'RuntimeError: model endpoint unreachable',
        ].join('\n'));
        throw err;
      });
    const r = handleSkillspectorScan('skillspectorScan', {}, dir, {});
    expect(r.status).toBe('warn');
    expect(r.message).toContain('model endpoint unreachable');
    expect(r.message).not.toContain('LangChainPendingDeprecationWarning');
  });

  it('本机没装 skillspector → skip（不是「部分失败」的 warn）', () => {
    const dir = project({ '.claude/skills/demo/SKILL.md': '# demo' });
    safeExec.mockImplementationOnce(() => { throw new Error("'skillspector' is not recognized as an internal or external command"); });
    const r = handleSkillspectorScan('skillspectorScan', {}, dir, {});
    expect(r.status).toBe('skip');
    expect(r.message).toContain('没有安装 skillspector');
  });
});

describe('假绿回归：移动端发布版本号', () => {
  it('没选升级类型 → warn（以前 || "patch" 静默升补丁号）', async () => {
    const { handleMobileBumpVersion } = await import('./mobile-release.js');
    const dir = project({ 'package.json': JSON.stringify({ version: '1.2.3' }) });
    const ctx = {};
    const r = handleMobileBumpVersion('mobileBumpVersion', {}, dir, ctx);
    expect(r.status).toBe('warn');
    expect(r.message).toContain('升级类型未确定');
    expect(ctx.new_version).toBeUndefined();
  });

  it('升级类型写错 → warn 并列出可用值（不按 patch 猜）', async () => {
    const { handleMobileBumpVersion } = await import('./mobile-release.js');
    const dir = project({ 'package.json': JSON.stringify({ version: '1.2.3' }) });
    const r = handleMobileBumpVersion('mobileBumpVersion', {}, dir, { selectedOption: 'majr' });
    expect(r.status).toBe('warn');
    expect(r.message).toContain('major');
  });

  it('没有可改的 version 文件 → warn（以前报「版本号已更新: N/A → undefined」）', async () => {
    const { handleMobileBumpVersion } = await import('./mobile-release.js');
    const dir = project({ 'README.md': '# x' });
    const r = handleMobileBumpVersion('mobileBumpVersion', {}, dir, { selectedOption: 'minor' });
    expect(r.status).toBe('warn');
    expect(r.message).toContain('没找到');
  });

  it('minor 真的只升中版本号', async () => {
    const { handleMobileBumpVersion } = await import('./mobile-release.js');
    const dir = project({ 'package.json': JSON.stringify({ version: '1.2.3' }) });
    const ctx = { selectedOption: 'minor' };
    const r = handleMobileBumpVersion('mobileBumpVersion', {}, dir, ctx);
    expect(String(r)).toContain('1.2.3 → 1.3.0');
    expect(ctx.new_version).toBe('1.3.0');
  });

  it('版本号未定时不生成「## vunknown」的 CHANGELOG', async () => {
    const { handleMobileGenerateChangelog } = await import('./mobile-release.js');
    const ctx = {};
    const r = handleMobileGenerateChangelog('mobileGenerateChangelog', {}, '/tmp', ctx);
    expect(r.status).toBe('warn');
    expect(ctx.changelog_content).toBeUndefined();
  });
});

describe('假绿回归：移动端平台识别', () => {
  it('detectProject 要写 context.platform，否则下游全走「非 Android 项目」', async () => {
    const { handleDetectProject } = await import('./mobile/audit.js');
    const dir = project({
      'package.json': JSON.stringify({ name: 'x', dependencies: { 'react-native': '0.74.0' } }),
      'android/build.gradle': '',
    });
    const ctx = {};
    handleDetectProject('detectProject', {}, dir, ctx);
    expect(ctx.platform).toBe('android');
    expect(ctx.platforms).toEqual({ ios: false, android: true });
  });

  it('没有 ios/ 和 android/ → platform unknown 时要 warn', async () => {
    const { handleDetectProject } = await import('./mobile/audit.js');
    const dir = project({ 'package.json': JSON.stringify({ name: 'x' }) });
    const ctx = {};
    const r = handleDetectProject('detectProject', {}, dir, ctx);
    expect(ctx.platform).toBe('unknown');
    expect(r.status).toBe('warn');
  });
});

describe('假绿回归：发布前检查不许自己给自己盖章', () => {
  it('releaseChecks 不再把安全/性能/测试/合规四个门禁写成「通过」', async () => {
    const { handleReleaseChecks } = await import('./mobile-release.js');
    const dir = project({ 'android/gradle.properties': 'a=b', 'ios/ExportOptions.plist': '<plist/>' });
    const ctx = { platform: 'both' };
    const r = handleReleaseChecks('releaseChecks', {}, dir, ctx);
    expect(String(r)).toContain('发布前检查完成');
    expect(ctx.release_checks).toHaveLength(2);          // 这两项是真去看了文件
    expect(ctx.securityScanResult).toBeUndefined();
    expect(ctx.performancePassed).toBeUndefined();
    expect(ctx.testPassed).toBeUndefined();
    expect(ctx.storeCompliancePassed).toBeUndefined();
  });
});

describe('假绿回归：移动端 E2E 配置', () => {
  const load = () => import('./mobile-testing.js');

  it('Detox 项目要真的写出 .detoxrc.js 和示例用例', async () => {
    const { handleSetupE2EConfig } = await load();
    const dir = project({ 'package.json': JSON.stringify({ name: 'x' }) });
    const ctx = { project_type: 'rn' };
    const r = handleSetupE2EConfig('setupE2EConfig', { generate_examples: true }, dir, ctx);
    expect(r.status).toBe('pass');
    expect(ctx.e2eConfigPassed).toBe(true);
    expect(ctx.testExamplesPassed).toBe(true);
    expect(ctx.e2eConfigured).toBe(true);
  });

  it('verifySetup 不再把「0/2 通过」记成完成', async () => {
    const { handleVerifySetup } = await load();
    const dir = project({ 'package.json': JSON.stringify({ name: 'x' }) });
    safeExec.mockImplementation(() => { throw new Error('Command failed: detox --version'); });
    const r = handleVerifySetup('verifySetup', {}, dir, { e2e_tool: 'Detox' });
    expect(r.status).toBe('fail');
    expect(r.message).toContain('未通过');
  });

  it('generate_examples: false 时不把 testExamplesPassed 记成 false（那是假红）', async () => {
    const { handleSetupE2EConfig } = await load();
    const dir = project({ 'package.json': JSON.stringify({ name: 'x' }) });
    const ctx = { project_type: 'rn' };
    handleSetupE2EConfig('setupE2EConfig', { generate_examples: false }, dir, ctx);
    expect(ctx.e2eConfigPassed).toBe(true);
    expect(ctx.testExamplesPassed).toBeUndefined();
  });

  it('CLI 与配置都就绪 → 验证通过，setupConfigured 才置位', async () => {
    const { handleSetupE2EConfig, handleVerifySetup } = await load();
    const dir = project({ 'package.json': JSON.stringify({ name: 'x' }) });
    const ctx = { project_type: 'rn' };
    handleSetupE2EConfig('setupE2EConfig', { generate_examples: true }, dir, ctx);
    safeExec.mockReturnValue(Buffer.from('detox 20.0.0'));
    const r = handleVerifySetup('verifySetup', {}, dir, ctx);
    expect(String(r)).toContain('2/2 通过');
    expect(ctx.e2e_verified).toBe(true);
    expect(ctx.setupConfigured).toBe(true);
  });

  it('CI workflow 写不进去 → warn（以前照样 ciConfigured = true）', async () => {
    const { handleGenerateCIConfig } = await load();
    const dir = project({ 'blocker': 'x' });
    const blockerAsDir = join(dir, 'blocker', '.github'); // 父路径是文件 → 必然写失败
    const r = handleGenerateCIConfig('generateCIConfig', {}, blockerAsDir, {});
    expect(r.status).toBe('warn');
    expect(r.message).toContain('未生成');
  });

  it('CI workflow 写成功 → ciConfigured 才置位', async () => {
    const { handleGenerateCIConfig } = await load();
    const dir = project({ 'package.json': JSON.stringify({ name: 'x' }) });
    const ctx = {};
    const r = handleGenerateCIConfig('generateCIConfig', {}, dir, ctx);
    expect(String(r)).toContain('已生成');
    expect(ctx.ciConfigured).toBe(true);
  });
});

describe('假绿回归：移动端环境检查', () => {
  /** 临时清掉 Android SDK 环境变量（本机可能真的配了）。 */
  function withoutAndroidEnv(fn) {
    const saved = { home: process.env.ANDROID_HOME, root: process.env.ANDROID_SDK_ROOT };
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
    try { return fn(); } finally {
      if (saved.home !== undefined) process.env.ANDROID_HOME = saved.home;
      if (saved.root !== undefined) process.env.ANDROID_SDK_ROOT = saved.root;
    }
  }

  it('Android SDK 一个都没配 → warn（以前只存值就报「检查完成」）', async () => {
    const { handleCheckAndroidSDK } = await import('./mobile-onboard.js');
    const dir = project({ 'package.json': JSON.stringify({ name: 'x' }) });
    withoutAndroidEnv(() => {
      const r = handleCheckAndroidSDK('checkAndroidSDK', {}, dir, { platform: 'android' });
      expect(r.status).toBe('warn');
      expect(r.message).toContain('未找到');
    });
  });

  it('android/local.properties 里的 sdk.dir 也算找到 SDK', async () => {
    const { handleCheckAndroidSDK } = await import('./mobile-onboard.js');
    const dir = project({ 'android/local.properties': 'sdk.dir=/opt/android-sdk\n' });
    withoutAndroidEnv(() => {
      const r = handleCheckAndroidSDK('checkAndroidSDK', {}, dir, { platform: 'android' });
      expect(String(r)).toContain('/opt/android-sdk');
    });
  });

  it('非 Android 项目 → skip（不是「检查完成」）', async () => {
    const { handleCheckAndroidSDK } = await import('./mobile-onboard.js');
    const r = handleCheckAndroidSDK('checkAndroidSDK', {}, '/tmp', { platform: 'ios' });
    expect(r.status).toBe('skip');
  });

  it('.env.example 已存在时不谎称「生成完成」', async () => {
    const { handleSetupEnv } = await import('./mobile-onboard.js');
    const dir = project({ '.env.example': 'A=1\n' });
    const ctx = {};
    const r = handleSetupEnv('setupEnv', {}, dir, ctx);
    // 契约变更（第十八轮）：消息从裸字符串改成 {status,message}。
    // 「已存在」= 这次没生成任何东西，状态是 noop 而不是 pass。
    expect(r.status).toBe('noop');
    expect(r.message).toContain('已存在');
    expect(ctx.env_template_generated).toBe(false);
    expect(ctx.envTemplatePassed).toBe(true);
  });

  it('新项目写不出 .env.example → warn（以前照样 envTemplatePassed = true）', async () => {
    const { handleSetupEnv } = await import('./mobile-onboard.js');
    const dir = project({ 'blocker': 'x' });
    const ctx = {};
    const r = handleSetupEnv('setupEnv', {}, join(dir, 'blocker'), ctx);
    expect(r.status).toBe('warn');
    expect(ctx.envTemplatePassed).toBe(false);
  });
});
