import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `npm run mcp:switch` 必须真的能来回切，且不许谎报。
 *
 * 改前实测：
 *   · 没有 `.mcp.json.light` 这个文件 —— `full` 直接拿 `.mcp.json.full` 覆盖 `.mcp.json`，
 *     light 档被**永久覆盖掉了**；
 *   · 之后再执行 `light`，脚本一个文件都不读，就打印「already in light mode (4 active servers)」，
 *     而当时 `.mcp.json` 里是 14 个（数字也是写死的）；
 *   · 未知模式（`npm run mcp:switch -- ful`）打印用法后 **exit 0** —— 假绿。
 *
 * 现在：两份档位各是一个文件，light / full 都从文件复制、真的可逆；`_modes` 元数据按真实内容改写；
 * 未知模式 exit 2；档位文件缺失 / 坏 JSON / 空配置 exit 1 且一个字节都不写。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'switch-mcp.cjs');

const LIGHT = {
  context7: { command: 'npx', args: ['-y', 'context7'] },
  github: { command: 'npx', args: ['-y', 'github'] },
  sentry: { command: 'npx', args: ['-y', 'sentry'] },
};
const FULL = {
  ...LIGHT,
  codegraph: { command: 'npx', args: ['-y', 'codegraph'] },
  supabase: { command: 'npx', args: ['-y', 'supabase'] },
  stripe: { command: 'npx', args: ['-y', 'stripe'] },
  resend: { command: 'npx', args: ['-y', 'resend'] },
  memory: { command: 'npx', args: ['-y', 'memory'] },
};

const profile = (servers, mode) => ({
  _comment: mode === 'light' ? 'light' : 'full',
  _modes: { current: mode, active_servers: Object.keys(servers) },
  mcpServers: servers,
});

function run(dir, mode) {
  const args = mode === undefined ? [SCRIPT] : [SCRIPT, mode];
  const res = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, MCP_CONFIG_DIR: dir },
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function scaffold({ live = LIGHT, light = LIGHT, full = FULL } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-switch-'));
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify(profile(live, 'light')));
  if (light) writeFileSync(join(dir, '.mcp.json.light'), JSON.stringify(profile(light, 'light')));
  if (full) writeFileSync(join(dir, '.mcp.json.full'), JSON.stringify(profile(full, 'full')));
  return dir;
}

const readLive = (dir) => JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
const liveNames = (dir) => Object.keys(readLive(dir).mcpServers);

describe('switch-mcp：真的能来回切', () => {
  it('light → full：live 变成完整档，_modes 元数据跟着真实内容改写', () => {
    const dir = scaffold();
    const { code, out } = run(dir, 'full');
    expect(code, out).toBe(0);
    expect(liveNames(dir)).toEqual(Object.keys(FULL));
    expect(readLive(dir)._modes).toEqual({ current: 'full', active_servers: Object.keys(FULL) });
    expect(out).toContain(`OK: Switched to FULL mode — ${Object.keys(FULL).length} active servers`);
    expect(out).toContain('before: 3 (context7, github, sentry)');
  });

  it('full → light 能真的切回去（改前 light 档被永久覆盖，这一步只会打印假话）', () => {
    const dir = scaffold();
    run(dir, 'full');
    const { code, out } = run(dir, 'light');
    expect(code, out).toBe(0);
    expect(liveNames(dir)).toEqual(Object.keys(LIGHT));
    expect(readLive(dir)._modes).toEqual({ current: 'light', active_servers: Object.keys(LIGHT) });
    expect(out).toContain('before: 8 (context7, github, sentry, codegraph');
  });

  it('已经在目标模式 → exit 0、打印 already、文件一个字节都不变', () => {
    const dir = scaffold();
    run(dir, 'light'); // 第一次真的写（fixture 里的 live 是紧凑 JSON，不算「已经是 light 档」）
    const before = readFileSync(join(dir, '.mcp.json'), 'utf8');
    const { code, out } = run(dir, 'light');
    expect(code, out).toBe(0);
    expect(out).toContain('MCP is already in light mode (3 active servers: context7, github, sentry)');
    expect(readFileSync(join(dir, '.mcp.json'), 'utf8')).toBe(before);
  });
});

describe('switch-mcp：坏输入不许假装成功', () => {
  it('未知模式 → exit 2，用法里带真实个数', () => {
    const dir = scaffold();
    const { code, out } = run(dir, 'ful');
    expect(code, out).toBe(2);
    expect(out).toContain('未知模式 "ful"');
    expect(out).toContain('# 3 MCPs (default, fast startup)');
    expect(out).toContain(`# ${Object.keys(FULL).length} MCPs (full features, slow startup)`);
    expect(liveNames(dir)).toEqual(Object.keys(LIGHT));
  });

  it('缺模式参数 → exit 2（改前默认 light 且只打印假话）', () => {
    const { code } = run(scaffold());
    expect(code).toBe(2);
  });

  it('档位文件缺失 → exit 1 并说清原因，不写坏数据', () => {
    const dir = scaffold({ full: null });
    const before = readFileSync(join(dir, '.mcp.json'), 'utf8');
    const { code, out } = run(dir, 'full');
    expect(code, out).toBe(1);
    expect(out).toContain('.mcp.json.full 读不到');
    expect(readFileSync(join(dir, '.mcp.json'), 'utf8')).toBe(before);
  });

  it('档位文件不是合法 JSON → exit 1', () => {
    const dir = scaffold();
    writeFileSync(join(dir, '.mcp.json.full'), '{ broken');
    const { code, out } = run(dir, 'full');
    expect(code, out).toBe(1);
    expect(out).toContain('不是合法 JSON');
  });

  it('档位文件里 mcpServers 是空的 → exit 1（拒绝把项目切成零个 MCP）', () => {
    const dir = scaffold();
    writeFileSync(join(dir, '.mcp.json.full'), JSON.stringify({ mcpServers: {} }));
    const { code, out } = run(dir, 'full');
    expect(code, out).toBe(1);
    expect(out).toContain('拒绝写入空配置');
  });
});

describe('switch-mcp：真仓库守卫', () => {
  it('.mcp.json.light 存在，且 live 就是 light 档（保证 light 模式可复现）', () => {
    expect(existsSync(join(ROOT, '.mcp.json.light'))).toBe(true);
    const live = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8'));
    const light = JSON.parse(readFileSync(join(ROOT, '.mcp.json.light'), 'utf8'));
    expect(Object.keys(light.mcpServers)).toEqual(Object.keys(live.mcpServers));
    expect(live._modes).toEqual({ current: 'light', active_servers: Object.keys(live.mcpServers) });
  });

  it('档位文件与文档真值一致：.mcp.json 3 个、.mcp.json.full 14 个', () => {
    const live = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8'));
    const full = JSON.parse(readFileSync(join(ROOT, '.mcp.json.full'), 'utf8'));
    expect(Object.keys(live.mcpServers)).toHaveLength(3);
    expect(Object.keys(full.mcpServers)).toHaveLength(14);
  });
});
