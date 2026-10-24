import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { defaultTargetPath, sanitizeTargetPath } from './start.js';
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
