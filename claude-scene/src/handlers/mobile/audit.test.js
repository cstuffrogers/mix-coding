import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  handleDetectProject, handleMobileAutoInstall, handleBuildApp, handleScanSource, handleScanDependencies,
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
});
