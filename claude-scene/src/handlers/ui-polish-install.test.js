/**
 * ui-polish 步骤 4（installDeps）的假红修复回归测试。
 *
 * 湿跑时发现的问题：这一步无条件 `npm install lucide-react animate.css`。
 * 在一个和美化毫无关系的 non-React 工程里，它照样去装 React 组件库；
 * 一旦 npm 因为项目自身的 peer 冲突报错，整步记 fail —— 美化还没开始就红了，
 * 而「本项目不是 React 工程，这些库本来就用不上」这个真原因反而不出现在报告里。
 *
 * 改后的契约：
 *   - 非 React/Next 工程：不装 React 专属包，并在消息里点名跳过了什么
 *   - React 工程：只装该主题真正要用的包
 *   - npm 真失败：warn，且消息里是 npm 的实质错误（不是 `Command failed:` 壳行）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const safeExecMock = vi.fn();

vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => safeExecMock(...args),
  safeExecFile: vi.fn(),
}));

const { isReactProject, selectInstallPackages, UI_POLISH_ACTIONS } = await import('./ui-polish.js');

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'ui-polish-install-'));
  return dir;
}

function writePackageJson(dir, deps) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'probe', dependencies: deps }, null, 2));
}

function installDeps(targetPath, theme) {
  const entry = UI_POLISH_ACTIONS.installDeps;
  const argMap = { action: 'installDeps', params: {}, targetPath, context: {}, theme };
  return entry.handler(...entry.args.map(name => argMap[name]));
}

describe('installDeps：非 React 工程不该红', () => {
  let dirs = [];

  beforeEach(() => {
    safeExecMock.mockReset();
    dirs = [];
  });

  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  function project(deps) {
    const dir = makeProject();
    dirs.push(dir);
    writePackageJson(dir, deps);
    return dir;
  }

  it('没有 react/next 依赖 → isReactProject 为 false', () => {
    expect(isReactProject(project({ chalk: '^5.0.0' }))).toBe(false);
  });

  it('有 react 依赖 → isReactProject 为 true', () => {
    expect(isReactProject(project({ react: '^19.0.0' }))).toBe(true);
  });

  it('没有 package.json → 当作非 React，不抛异常', () => {
    expect(isReactProject(project({}))).toBe(false);
  });

  it('主题专属包只在选中该主题时出现', () => {
    expect(selectInstallPackages('animal-island', true)).toContain('animal-island-ui');
    expect(selectInstallPackages('liquid-glass', true)).toContain('liquid-glass-react');
    expect(selectInstallPackages('huashu', true)).not.toContain('animal-island-ui');
    expect(selectInstallPackages('huashu', true)).not.toContain('liquid-glass-react');
  });

  it('non-React 工程：命令里不含 lucide-react，且消息点名跳过了它', () => {
    const dir = project({ chalk: '^5.0.0' });
    const result = installDeps(dir, 'daisyui');

    expect(safeExecMock).toHaveBeenCalledTimes(1);
    expect(safeExecMock.mock.calls[0][0]).toBe('npm install animate.css');
    expect(result).toContain('依赖安装完成');
    expect(result).toContain('跳过 lucide-react');
  });

  it('React 工程装 daisyui：animate.css + lucide-react', () => {
    const dir = project({ react: '^19.0.0' });
    const result = installDeps(dir, 'daisyui');

    expect(safeExecMock).toHaveBeenCalledTimes(1);
    expect(safeExecMock.mock.calls[0][0]).toBe('npm install animate.css lucide-react');
    expect(result).not.toContain('跳过');
  });

  it('liquid-glass + React 18 → 自动带 --legacy-peer-deps（peerDeps 要求 >=19）', () => {
    const dir = project({ react: '^18.2.0' });
    installDeps(dir, 'liquid-glass');
    expect(safeExecMock.mock.calls[0][0]).toContain('--legacy-peer-deps');
  });

  it('liquid-glass + React 19 → 不加 --legacy-peer-deps', () => {
    const dir = project({ react: '^19.0.0' });
    installDeps(dir, 'liquid-glass');
    expect(safeExecMock.mock.calls[0][0]).not.toContain('--legacy-peer-deps');
  });

  it('npm 失败 → warn，消息里是实质错误而不是 Command failed 壳行', () => {
    const dir = project({ react: '^19.0.0' });
    safeExecMock.mockImplementation(() => {
      throw new Error('Command failed: npm install animate.css lucide-react\nnpm error code ERESOLVE\nnpm error 冲突');
    });

    const result = installDeps(dir, 'daisyui');

    expect(result.status).toBe('warn');
    expect(result.message).toContain('ERESOLVE');
    expect(result.message).not.toContain('Command failed');
    expect(result.message).toContain('后续美化组件可能不可用');
  });
});
