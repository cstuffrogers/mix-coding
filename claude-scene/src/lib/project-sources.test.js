import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, sep } from 'path';
import {
  CODE_EXTS,
  listProjectFiles,
  listProjectCodeFiles,
  loadScanIgnore,
  codeRoots,
  assertSources,
} from './project-sources.js';

function makeProject(files) {
  const dir = mkdtempSync(join(tmpdir(), 'psrc-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body ?? 'x\n');
  }
  return dir;
}

const rels = (dir, files) => files.map((f) => relative(dir, f).split(sep).join('/')).sort();

describe('listProjectCodeFiles：扫描根不能假设 <repo>/src', () => {
  let dir;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it('前端/后端分目录时全都能扫到', () => {
    dir = makeProject({
      'frontend/web/src/App.jsx': '',
      'backend/api/src/main.py': '',
      'pkg/service/handler.go': '',
    });
    expect(rels(dir, listProjectCodeFiles(dir))).toEqual([
      'backend/api/src/main.py',
      'frontend/web/src/App.jsx',
      'pkg/service/handler.go',
    ]);
  });

  it('产物/依赖/虚拟环境目录一律跳过', () => {
    dir = makeProject({
      'src/a.js': '',
      'node_modules/pkg/b.js': '',
      'dist/c.js': '',
      'build/d.js': '',
      'coverage/e.js': '',
      '.git/f.js': '',
      '__pycache__/g.py': '',
      'venv/h.py': '',
      'target/i.java': '',
      '.next/j.js': '',
      'android/k.js': '',
      'ios/l.js': '',
    });
    expect(rels(dir, listProjectCodeFiles(dir))).toEqual(['src/a.js']);
  });

  it('点开头的目录不看，点文件默认也不看', () => {
    dir = makeProject({ 'src/a.js': '', '.github/workflows/ci.js': '', 'src/.eslintrc.js': '' });
    expect(rels(dir, listProjectCodeFiles(dir))).toEqual(['src/a.js']);
  });

  it('includeDotFiles 才纳入 .env 这类配置点文件', () => {
    dir = makeProject({ 'src/a.js': '', '.env.example': '', '.env': '' });
    const withDot = listProjectFiles(dir, {
      exts: [...CODE_EXTS, '.env'],
      namePattern: /(^|\/)\.env[^/]*$/,
      includeDotFiles: true,
    });
    expect(rels(dir, withDot)).toEqual(['.env', '.env.example', 'src/a.js']);
  });

  it('扩展名过滤 + namePattern 兜住 Dockerfile/Makefile', () => {
    dir = makeProject({ 'src/a.ts': '', 'Dockerfile': '', 'Makefile': '', 'notes.txt': '' });
    const files = listProjectFiles(dir, { exts: ['.ts'], namePattern: /(^|\/)(dockerfile|makefile)$/ });
    expect(rels(dir, files)).toEqual(['Dockerfile', 'Makefile', 'src/a.ts']);
  });

  it('嵌套仓库（自带 .git 的子目录）不算本项目源码', () => {
    dir = makeProject({
      'src/a.js': '',
      'vendor-lib/b.js': '',
      'vendor-lib/.git/HEAD': '',
    });
    // .git 目录本身被 SKIP_SEGMENTS 跳过，但父目录要整体排除
    expect(rels(dir, listProjectCodeFiles(dir))).toEqual(['src/a.js']);
  });

  it('.claude/scene-scan-ignore 能排除项目自己声明的外部目录', () => {
    dir = makeProject({
      'src/a.js': '',
      'legacy/b.js': '',
      '.claude/scene-scan-ignore': '# 老代码\nlegacy/\n',
    });
    expect(loadScanIgnore(dir)).toEqual(['legacy']);
    expect(rels(dir, listProjectCodeFiles(dir))).toEqual(['src/a.js']);
  });

  it('不存在的目录返回空数组而不是抛错', () => {
    const missing = join(tmpdir(), 'definitely-not-here-xyz');
    expect(listProjectCodeFiles(missing)).toEqual([]);
  });
});

describe('codeRoots / assertSources', () => {
  it('从文件清单反推扫描根', () => {
    const files = ['/p/src/a.js', '/p/backend/b.py', '/p/root.js'];
    expect(codeRoots('/p', files).sort()).toEqual(['.', 'backend', 'src']);
  });

  it('0 文件必须判失败（空转不能算通过）', () => {
    const ctx = {};
    expect(assertSources([], ctx, 'demo')).toBe(false);
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('有文件时不动 lastStepFailed', () => {
    const ctx = {};
    expect(assertSources(['a.js'], ctx, 'demo')).toBe(true);
    expect(ctx.lastStepFailed).toBeUndefined();
  });
});
