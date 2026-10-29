import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * 视觉回归：「没测」不许写成「没通过」。
 *
 * 旧实现的四条「压根没跑」路径（没有 package.json / package.json 读不出来 /
 * 没装 Playwright / 没有视觉测试文件）全都写 `visualRegressionPassed = false`，
 * 而它是注册过的门禁旗标（`ui_regression` / `visual_regression`）——
 * 于是「目标目录没装 Playwright」在门禁眼里等于「视觉回归失败」（假红）；
 * 「没有匹配的视觉测试文件」那条还返回「完成」文案（假绿）。
 * 只有真正跑过 playwright 的两次才有资格写 true / false。
 */

const { mockSafeExec } = vi.hoisted(() => ({ mockSafeExec: vi.fn() }));
vi.mock('../lib/safe-exec.js', () => ({ safeExec: mockSafeExec }));

const { handleVisualRegression } = await import('./ui-tools.js');

let project;

function writePackage(devDependencies = {}) {
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'p', devDependencies }, null, 2));
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'visual-reg-'));
  mockSafeExec.mockReset();
  mockSafeExec.mockImplementation(() => '');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('handleVisualRegression 的「没测」路径', () => {
  it('没有 package.json → skip，且不写门禁旗标', () => {
    const context = {};
    const result = handleVisualRegression('visualRegression', {}, project, context);

    expect(result).toMatchObject({ status: 'skip' });
    expect(result.message).toContain('没有 package.json');
    expect('visualRegressionPassed' in context).toBe(false);
  });

  it('package.json 读不出来 → skip，且不写门禁旗标', () => {
    writeFileSync(join(project, 'package.json'), '{ not json');
    const context = {};
    const result = handleVisualRegression('visualRegression', {}, project, context);

    expect(result).toMatchObject({ status: 'skip' });
    expect(result.message).toContain('读不出来');
    expect('visualRegressionPassed' in context).toBe(false);
  });

  it('没装 Playwright → skip（不是「失败」），且不写门禁旗标', () => {
    writePackage({});
    const context = {};
    const result = handleVisualRegression('visualRegression', {}, project, context);

    expect(result).toMatchObject({ status: 'skip' });
    expect(result.message).toContain('未安装 Playwright');
    expect('visualRegressionPassed' in context).toBe(false);
  });

  it('装了 Playwright 但一个视觉测试文件都没有 → skip，不许说「完成」', () => {
    writePackage({ playwright: '^1.0.0' });
    const context = {};
    const result = handleVisualRegression('visualRegression', {}, project, context);

    expect(result).toMatchObject({ status: 'skip' });
    expect(result.message).toContain('没有匹配的视觉测试文件');
    expect('visualRegressionPassed' in context).toBe(false);
  });

  it('skip 路径不产出 screenshots 目录（没跑就别在别人项目里留垃圾）', () => {
    writePackage({});
    handleVisualRegression('visualRegression', {}, project, {});
    expect(existsSync(join(project, 'screenshots'))).toBe(false);
  });
});

describe('handleVisualRegression 真跑过的两条路径', () => {
  beforeEach(() => {
    writePackage({ playwright: '^1.0.0' });
    mkdirSync(join(project, 'tests'));
    writeFileSync(join(project, 'tests', 'visual.spec.js'), "test('visual snapshot', () => {});\n");
  });

  it('playwright 通过 → 旗标 true + 完成文案', () => {
    const context = {};
    const result = handleVisualRegression('visualRegression', { viewports: ['mobile'] }, project, context);

    expect(result).toContain('视觉回归测试完成');
    expect(result).toContain('mobile');
    expect(context.visualRegressionPassed).toBe(true);
  });

  it('playwright 非零退出 → status fail + 旗标 false（这是真测量出来的失败）', () => {
    mockSafeExec.mockImplementation(() => {
      throw new Error('playwright exited with 1');
    });
    const context = {};
    const result = handleVisualRegression('visualRegression', {}, project, context);

    expect(result).toMatchObject({ status: 'fail' });
    expect(context.visualRegressionPassed).toBe(false);
  });
});
