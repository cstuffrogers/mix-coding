import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { defaultTargetPath, sanitizeTargetPath, resolveChoiceOverride } from './start.js';
import { PROJECT_ROOT } from '../lib/paths.js';

// 回归：resolveTargetPath 曾用 process.cwd() 作默认值，导致
// MIX_CODING_PROJECT_DIR 只影响场景查找、不影响动作执行目录，
// 两者错位时动作会跑到 cwd 而不是用户指定的项目。
describe('defaultTargetPath', () => {
  it('无 --target 时回落到 PROJECT_ROOT，而非 process.cwd()', () => {
    expect(defaultTargetPath({})).toBe(PROJECT_ROOT);
    expect(defaultTargetPath({ auto: true })).toBe(PROJECT_ROOT);
  });

  it('--target 优先级最高', () => {
    expect(defaultTargetPath({ target: '/some/project', auto: true }))
      .toBe('/some/project');
  });
});

describe('sanitizeTargetPath', () => {
  it('去掉拖拽路径附带的引号与变量符号', () => {
    expect(sanitizeTargetPath('"/a/b"')).toBe('/a/b');
    expect(sanitizeTargetPath('$/a/b')).toBe('/a/b');
    expect(sanitizeTargetPath('/a/b')).toBe('/a/b');
  });
});

// PROJECT_ROOT 与 defaultTargetPath 都在模块加载时绑定，必须重置模块
// 注册表并在设好环境变量后重新导入，才能验证真实生效路径。
describe('环境变量驱动的目标项目', () => {
  const prev = process.env.MIX_CODING_PROJECT_DIR;

  afterEach(() => {
    if (prev === undefined) delete process.env.MIX_CODING_PROJECT_DIR;
    else process.env.MIX_CODING_PROJECT_DIR = prev;
    vi.resetModules();
  });

  it('MIX_CODING_PROJECT_DIR 同时决定 PROJECT_ROOT 与默认目标项目', async () => {
    process.env.MIX_CODING_PROJECT_DIR = 'env-probe-project';
    vi.resetModules();

    const { PROJECT_ROOT: freshRoot } = await import('../lib/paths.js');
    const { defaultTargetPath: freshDefault } = await import('./start.js');

    expect(freshRoot).toBe(resolve('env-probe-project'));
    // 关键断言：默认目标必须是 PROJECT_ROOT，不能退化成 cwd
    expect(freshDefault({ auto: true })).toBe(resolve('env-probe-project'));
    expect(freshDefault({ auto: true })).not.toBe(resolve(process.cwd()));
  });

  it('未设置时回落到 cwd', async () => {
    delete process.env.MIX_CODING_PROJECT_DIR;
    vi.resetModules();
    const { PROJECT_ROOT: fresh } = await import('../lib/paths.js');
    expect(fresh).toBe(resolve(process.cwd()));
  });
});

// --kind 是 pi 里唯一能选到 setup 非默认分支的入口（agent 非交互，--auto 只会取 default）。
// 参数写错时要明说可用值，不能静默回落成默认分支。
describe('resolveChoiceOverride', () => {
  const step = {
    action: 'selectSetupKind',
    params: {
      options: [
        { id: 'e2e', label: 'E2E', default: true },
        'monitor',
        { id: 'property', label: '属性测试' },
      ],
    },
  };

  it('没传值时不做覆盖', () => {
    expect(resolveChoiceOverride(step)).toEqual({ id: null, warning: null });
    expect(resolveChoiceOverride(step, '  ')).toEqual({ id: null, warning: null });
  });

  it('传合法值（字符串与对象两种 option 写法都认）', () => {
    expect(resolveChoiceOverride(step, 'monitor').id).toBe('monitor');
    expect(resolveChoiceOverride(step, 'property').id).toBe('property');
  });

  it('传非法值时给出可用值清单，且不覆盖', () => {
    const r = resolveChoiceOverride(step, 'nope');
    expect(r.id).toBeNull();
    expect(r.warning).toContain('e2e / monitor / property');
  });

  it('步骤没有 options 时也不炸', () => {
    expect(resolveChoiceOverride({ action: 'x' }, 'e2e').id).toBeNull();
  });
});
