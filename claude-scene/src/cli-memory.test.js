import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const CLI = join(fileURLToPath(import.meta.url), '..', 'index.js');

// `memory` 子命令以前只能操作 cwd：跨项目查/写在别处跑就会读写错项目。
// 这里固化 --target 真的生效（-t 是记忆类型，两者不能混用）。
describe('CLI memory --target', () => {
  let root;
  let env;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cli-mem-'));
    env = {
      ...process.env,
      CLAUDE_MEM_HOME: join(root, '.cm'),
      AGENTMEMORY_HOME: join(root, '.am'),
      NEXO_HOME: join(root, '.nx'),
      CODEGRAPH_HOME: join(root, '.cg'),
    };
  });

  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  const run = (args) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf-8' });

  it('remember 写进 --target 指定的项目，而不是 cwd', () => {
    const proj = join(root, 'proj');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 'package.json'), '{"name":"p"}');
    const res = run(['memory', 'remember', '--type', 'qa', '--target', proj, '-d', '{"marker":"CLI"}']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('已保存到记忆');
    expect(existsSync(join(proj, '.claude', 'memory', 'qa'))).toBe(true);
  });

  it('list --target 只数目标项目的记忆', () => {
    const proj = join(root, 'proj2');
    mkdirSync(proj, { recursive: true });
    run(['memory', 'remember', '--type', 'qa', '--target', proj, '-d', '{"marker":"ONE"}']);
    const res = run(['memory', 'list', '--target', proj]);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/1 条（project-memory）/);
  });
});
