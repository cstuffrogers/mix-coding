import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  handleDetectProject, handleMobileAutoInstall, handleBuildApp, handleScanSource, handleScanDependencies,
  handlePerfBaseline, handleStoreCompliance, handleMobileGenerateReport, handleMobileAutoFix,
} from './audit.js';
import { evaluateCondition } from '../../lib/conditions.js';

// 目标目录参数在这些 handler 里根本没被读，给个占位符即可
const PROJ = 'proj';

// 回归：detectProject 写的是 project_type/platforms，而 mobile_* 条件原来只读
// ctx.platform（全引擎无人写）→ iOS/Android 专有步骤在真机上永远被跳过。
describe('detectProject → 平台条件联动', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plat-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('React Native 项目：ios/android 双端为真', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.74.0' } }));
    mkdirSync(join(root, 'ios'));
    mkdirSync(join(root, 'android'));
    const ctx = { targetPath: root };

    expect(handleDetectProject('detectProject', {}, root, ctx)).toContain('rn');
    expect(ctx.project_type).toBe('rn');
    expect(evaluateCondition('mobile_platform', ctx)).toBe(true);
    expect(evaluateCondition('ios_platform', ctx)).toBe(true);
    expect(evaluateCondition('android_platform', ctx)).toBe(true);
  });

  it('只有 android 目录时，iOS 分支保持关闭', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.74.0' } }));
    mkdirSync(join(root, 'android'));
    const ctx = { targetPath: root };

    handleDetectProject('detectProject', {}, root, ctx);
    expect(evaluateCondition('mobile_platform', ctx)).toBe(true);
    expect(evaluateCondition('android_platform', ctx)).toBe(true);
    expect(evaluateCondition('ios_platform', ctx)).toBe(false);
  });

  it('Expo 项目视为双端', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { expo: '50.0.0' } }));
    const ctx = { targetPath: root };

    handleDetectProject('detectProject', {}, root, ctx);
    expect(evaluateCondition('ios_platform', ctx)).toBe(true);
    expect(evaluateCondition('android_platform', ctx)).toBe(true);
  });

  it('非移动端项目：三条条件都为假（不误开重工具链步骤）', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '18.0.0' } }));
    const ctx = { targetPath: root };

    handleDetectProject('detectProject', {}, root, ctx);
    expect(evaluateCondition('mobile_platform', ctx)).toBe(false);
    expect(evaluateCondition('ios_platform', ctx)).toBe(false);
    expect(evaluateCondition('android_platform', ctx)).toBe(false);
  });
});

// 同类（第 9 种假绿）：「要你手动做」的步骤原先返回字符串 → 引擎判 pass，
// 汇总行于是把「没装、没构建、没扫描」算成通过。全部改成显式 skip。
describe('没跑成的移动端步骤必须自报 skip', () => {
  it('installTools：缺工具时 skip 并列出缺什么', () => {
    const result = handleMobileAutoInstall('mobileAutoInstall', { missing: ['adb', 'maestro'] }, PROJ, {});
    expect(result.status).toBe('skip');
    expect(result.message).toContain('adb');
    expect(result.message).toContain('maestro');
  });

  it('buildApp：CLI 下不构建 → skip', () => {
    const ctx = {};
    const result = handleBuildApp('buildApp', { platform: 'ios' }, PROJ, ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('ios');
    expect(ctx.app_built).toBeUndefined();
  });

  it('scanSource：装了工具也只算「未测量」→ skip', () => {
    const result = handleScanSource('scanSource', {}, PROJ, {});
    // 工具装没装都必须是 skip：装了不代表扫了（取决于本机环境，两种都断言）
    const status = typeof result === 'string' ? 'string' : result.status;
    expect(status === 'skip' || String(result).includes('未安装')).toBe(true);
  });

  it('scanDependencies：外部工具缺失 → skip', () => {
    const result = handleScanDependencies('scanDependencies', { source: 'npm' }, PROJ, {});
    expect(result.status).toBe('skip');
    expect(result.message).toContain('npm');
  });

  // 第十三轮：场景写的 `tool: "mobsfscan" / "dependencycheck"` 以前没人读 ——
  // 引擎不执行外部工具，但至少要把「该跑哪个工具」写到屏幕上。
  it('scanSource / scanDependencies 把声明的 tool 透传到结论', () => {
    expect(String(handleScanSource('scanSource', { tool: 'semgrep' }, PROJ, {}))).toContain('semgrep');
    expect(handleScanDependencies('scanDependencies', { tool: 'dependencycheck' }, PROJ, {}).message)
      .toContain('dependencycheck');
  });
});

// 这一组守「报告里写的话必须真的发生了」：
// 以前 perfBaseline 一律报「采集完成 N 项」（其实 N-1 项是 device_required）、
// generateReport 只置一个旗子就报「报告已生成」（零字节）、autoFix 报「修复完成」（没动代码）、
// storeCompliance 的 check 返回值被丢掉还带个 `() => true`。
describe('移动端审计：不许把「没做」说成「完成」', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'audit-honest-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('性能基线：只有 device_required 时是 noop，不报「采集完成」', () => {
    const ctx = {};
    const r = handlePerfBaseline('perfBaseline', { metrics: ['fps', 'memory'] }, root, ctx);
    expect(r.status).toBe('noop');
    expect(r.message).not.toContain('采集完成');
    expect(ctx.performance_baseline).toEqual({ fps: 'device_required', memory: 'device_required' });
  });

  it('性能基线：bundle_size 真算了才 pass', () => {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.js'), 'x'.repeat(2048));
    const r = handlePerfBaseline('perfBaseline', { metrics: ['bundle_size'] }, root, {});
    expect(r.status).toBe('pass');
    expect(r.message).toContain('bundle_size=');
  });

  it('商店合规：全都查不出来时 warn，不许算通过', () => {
    const ctx = {};
    const r = handleStoreCompliance('storeCompliance', {}, root, ctx);
    expect(r.status).toBe('warn');
    expect(r.message).toContain('无法静态判定: 非公开 API 扫描');
    expect(ctx.store_compliance.unknown).toEqual(['非公开 API 扫描']);
  });

  it('商店合规：文件齐全 + 仍有无法静态判定的项 → warn', () => {
    mkdirSync(join(root, 'ios'), { recursive: true });
    mkdirSync(join(root, 'android', 'app', 'src', 'main'), { recursive: true });
    writeFileSync(join(root, 'ios', 'PrivacyInfo.xcprivacy'), '{}');
    writeFileSync(join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), '<manifest/>');
    const ctx = {};
    const r = handleStoreCompliance('storeCompliance', {}, root, ctx);
    expect(r.status).toBe('warn');
    expect(ctx.store_compliance.passed).toHaveLength(2);
    expect(ctx.store_compliance.failed).toEqual([]);
  });

  it('审计报告：真写文件、回读存在，才说已生成', () => {
    const ctx = { platform: 'ios', performance_baseline: { fps: 'device_required' } };
    const r = handleMobileGenerateReport('mobileGenerateReport', { format: 'markdown' }, root, ctx);
    expect(r.status).toBe('pass');
    expect(readFileSync(ctx.mobile_report_path, 'utf-8')).toContain('# 移动端审计报告');
    expect(ctx.mobile_report_generated).toBeUndefined();
  });

  it('审计报告：没有目标路径时明确说没生成', () => {
    const r = handleMobileGenerateReport('mobileGenerateReport', {}, '', {});
    expect(r.status).toBe('warn');
    expect(r.message).toContain('未生成');
  });

  it('自动修复：CLI 不动代码 → noop，且不写 mobile_autofix_applied', () => {
    const ctx = {};
    const r = handleMobileAutoFix('mobileAutoFix', { mode: 'safe' }, root, ctx);
    expect(r.status).toBe('noop');
    expect(r.message).toContain('未执行');
    expect(ctx.mobile_autofix_applied).toBeUndefined();
  });
});
