import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleDetectProject } from './audit.js';
import { evaluateCondition } from '../../lib/conditions.js';

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
