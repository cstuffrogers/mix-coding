import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { mcpConfigCandidates, loadMcpServers, hasMcpServer } from './mcp-config.js';

// 这些用例挡的是同一个回归：把「有没有这个 MCP」当成「是不是在对话里」。
// 配置里只剩 3 个 server 时，github/sentry/tavily 之类的条件仍然判「满足」，
// 场景就会排一堆调用不存在的工具的步骤，而且没人看得出来。
describe('MCP 配置探测', () => {
  let root;
  let home;

  const writeConfig = (base, servers) => {
    mkdirSync(join(base, '.pi'), { recursive: true });
    const file = base === home ? join(home, '.pi', 'agent') : join(base, '.pi');
    mkdirSync(file, { recursive: true });
    writeFileSync(join(file, 'mcp.json'), JSON.stringify({ mcpServers: servers }));
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcpc-root-'));
    home = mkdtempSync(join(tmpdir(), 'mcpc-home-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it('候选顺序：项目 .pi → 用户 ~/.pi/agent → .claude', () => {
    const paths = mcpConfigCandidates(root, home).map((p) => p.replaceAll('\\', '/'));
    expect(paths[0]).toBe(`${root.replaceAll('\\', '/')}/.pi/mcp.json`);
    expect(paths[1]).toBe(`${home.replaceAll('\\', '/')}/.pi/agent/mcp.json`);
    expect(paths[2]).toBe(`${root.replaceAll('\\', '/')}/.claude/mcp.json`);
  });

  it('两个文件都不存在时是空集，而不是「统统可用」', () => {
    const loaded = loadMcpServers(root, home);
    expect(loaded.path).toBeNull();
    expect(loaded.servers.size).toBe(0);
    expect(hasMcpServer('github', root, home)).toBe(false);
  });

  it('项目级优先；只认配置里真有的 server', () => {
    writeConfig(root, { schemaforge: { command: 'npx' }, detox: { command: 'npx' } });
    writeConfig(home, { github: { command: 'npx' } });
    expect(hasMcpServer('detox', root, home)).toBe(true);
    expect(hasMcpServer('github', root, home)).toBe(false); // 项目级遮蔽了用户级
  });

  it('项目级没有该条目时回落到用户级配置（用户级文件优先于项目级缺失）', () => {
    writeConfig(home, { github: { command: 'npx' } });
    expect(hasMcpServer('github', root, home)).toBe(true);
  });

  it('enabled: false 的 server 不算可用', () => {
    writeConfig(root, { github: { command: 'npx', enabled: false } });
    expect(hasMcpServer('github', root, home)).toBe(false);
  });

  it('配置 JSON 语法错 → 判定为坏配置，不猜成可用', () => {
    mkdirSync(join(root, '.pi'), { recursive: true });
    writeFileSync(join(root, '.pi', 'mcp.json'), '{ not json');
    const loaded = loadMcpServers(root, home);
    expect(loaded.broken).toBe(true);
    expect(loaded.servers.size).toBe(0);
  });

  it('别名命中：tavily-search 认作 tavily', () => {
    writeConfig(root, { 'tavily-search': { command: 'npx' } });
    expect(hasMcpServer('tavily', root, home)).toBe(true);
  });
});
