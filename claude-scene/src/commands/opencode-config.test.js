import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * opencode 全局配置那份「说明书」不许说谎。
 *
 * `.opencode/deploy-global.cjs` 把 `scripts/generate-opencode-config.cjs` 里手写的命令表
 * 写进 `~/.config/opencode/opencode.json`，agent 真的会照着模板去读 `.claude/commands/X.md`、
 * 真的会按模板里写的「N 步」去执行。改前实测：
 *   - `/hunt` `/e2e` `/monitor` 三个模板指向**已删除**的命令文件（hunt 早被合进 /review）
 *   - `/review` 模板写「86行33步」，真实 80 行 / 43 步；`/loop` 写 10 步实际 18；`/deps` 16 实际 17
 *   - 表头注释写「38 .md-referenced commands」，README 写「108 命令 + 17 MCP，38 工作流」，
 *     而生成器的真值是 106 命令 / 17 MCP / 1 provider / 38 个引用 .md
 * 这些都不该靠人肉记 —— 交给 check-opencode-config.cjs。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-opencode-config.cjs');

function run({ root, config } = {}) {
  const args = [SCRIPT];
  if (root) args.push(root);
  if (config) args.push('--config', config);
  const res = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

// fixture 的量：命令 60（下限 50）/ 命令文件 21（下限 20）/ 引用 .md 20（下限 15）/ 场景 21（下限 20）
const N = { commands: 60, mdCommands: 21, refs: 21, scenes: 21, steps: 2 };
const names = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

function generatorSource(over = {}) {
  const refs = over.refs ?? names('cmd', N.refs);
  const claims = over.claims ?? names('cmd', 3).map((f) => ({ file: f, steps: over.claimSteps ?? N.steps }));
  const lines = ['const commands = {', '  // ---- 手写的命令表 ----'];
  for (const r of refs) lines.push(`  '/${r}': { description: 'x', template: '先完整读取 .claude/commands/${r}.md 获取详细工作流。' },`);
  for (const c of claims) {
    lines.push(
      `  '/${c.file}-step': { description: 'y', template: '先完整读取 .claude/commands/${c.file}.md 获取详细工作流（${c.steps}步）。' },`,
    );
  }
  lines.push('};', 'module.exports = { commands };', '');
  return lines.join('\n');
}

function generatedConfig(over = {}) {
  const command = {};
  for (let i = 1; i <= (over.commands ?? N.commands); i += 1) {
    const ref = i <= (over.mdRefs ?? N.refs) ? `.claude/commands/cmd${i}.md` : '';
    command[`/c${i}`] = ref ? { description: 'd', template: `读 ${ref}` } : { description: 'd', template: 'no file' };
  }
  return {
    command,
    mcp: Object.fromEntries(names('m', over.mcp ?? 5).map((k) => [k, {}])),
    provider: Object.fromEntries(names('p', over.providers ?? 1).map((k) => [k, {}])),
  };
}

function readme({ commands = N.commands, mdRefs = N.refs, mcp = 5, providers = 1, row } = {}) {
  const line =
    row ??
    `| **opencode 全局配置** | [scripts/setup-opencode-global.sh](./scripts/setup-opencode-global.sh) | ` +
      `${commands} 命令（其中 ${mdRefs} 个直接引用本仓库 \`.claude/commands/*.md\`）· ${mcp} MCP · ${providers} Provider，由生成器现场统计 | 全平台 |`;
  return ['# 项目', '', '| 工具 | 文件 | 功能 | 平台 |', '|---|---|---|---|', line, '', '---', ''].join('\n');
}

const SETUP_SH = [
  '#!/usr/bin/env sh',
  'node -e "const c = JSON.parse(fs.readFileSync(process.argv[1], \'utf8\'));',
  'const n = (o) => Object.keys(o || {}).length;',
  'console.log(n(c.command));" "$CONFIG_FILE"',
  '',
].join('\n');

/** 造一份「处处对得上」的仓库骨架 + 生成好的配置 JSON。 */
function scaffold(over = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'opencode-config-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'commands'), { recursive: true });
  mkdirSync(join(dir, 'claude-scene', 'scenes'), { recursive: true });

  for (const n of names('cmd', over.commandFiles ?? N.mdCommands)) {
    writeFileSync(join(dir, '.claude', 'commands', `${n}.md`), '# cmd\n');
  }
  for (const n of names('cmd', over.sceneFiles ?? N.scenes)) {
    writeFileSync(join(dir, 'claude-scene', 'scenes', `${n}.json`), JSON.stringify({ flow: { a: 1, b: 2 } }));
  }
  writeFileSync(join(dir, 'scripts', 'generate-opencode-config.cjs'), generatorSource(over));
  // 没有 .opencode/deploy-global.cjs 时必须用 --config，否则 checker 该报「扫不到东西」
  if (over.withDeploy) mkdirSync(join(dir, '.opencode'), { recursive: true });
  // 文档里的数字与生成结果要能分别弄错：over.doc 只改文档，over 改生成结果
  writeFileSync(join(dir, 'README.md'), readme(over.doc ?? {}));
  writeFileSync(join(dir, 'scripts', 'setup-opencode-global.sh'), over.setupSh ?? SETUP_SH);

  const configPath = join(dir, 'generated.json');
  writeFileSync(configPath, JSON.stringify(generatedConfig(over)));
  return { dir, configPath };
}

/** 正常一次跑：骨架 + --config。 */
function runFixture(over = {}) {
  const { dir, configPath } = scaffold(over);
  return { ...run({ root: dir, config: configPath }), dir };
}

describe('check-opencode-config：模板指向的命令文件与步骤数', () => {
  it('处处对得上 → exit 0，并打印真值', () => {
    const { code, out } = runFixture();
    expect(code, out).toBe(0);
    expect(out).toContain('[真值] 命令 60 · MCP 5 · Provider 1 · 引用 .md 21 处');
    expect(out).toContain('[ok] opencode 全局配置的说明书与仓库一致');
  });

  it('模板引用了不存在的命令文件（幽灵 .md）→ exit 1 并点名', () => {
    const { code, out } = runFixture({ refs: [...names('cmd', N.refs), 'hunt'] });
    expect(code, out).toBe(1);
    expect(out).toContain('模板引用了不存在的命令文件：hunt');
  });

  it('真实命令文件没被任何模板引用 → exit 1 并点名', () => {
    // cmd21 被从 refs 里踢掉（换成不存在的 cmdX），但文件还在磁盘上
    const { code, out } = runFixture({ refs: [...names('cmd', N.refs - 1), 'cmdX'] });
    expect(code, out).toBe(1);
    expect(out).toContain('真实命令文件没被任何模板引用：cmd21');
  });

  it('「N 步」写错 → exit 1 并点名（写 3 实际 2）', () => {
    const { code, out } = runFixture({ claimSteps: 3 });
    expect(code, out).toBe(1);
    expect(out).toContain('「cmd1」写了 3 步，场景实际 2 步');
  });

  it('步骤数声明指向没有场景的命令 → exit 1（不许无从核对就放过）', () => {
    const claims = [{ file: 'cmd99', steps: 2 }];
    const { code, out } = runFixture({ claims });
    expect(code, out).toBe(1);
    expect(out).toContain('「cmd99」写的是 2 步，但没有这个场景可核对');
  });
});

describe('check-opencode-config：文档里写死的计数', () => {
  const drift = [
    ['命令数写成 108', { doc: { commands: 108 } }, 'README 的 opencode 命令数：写了 108，实际 60'],
    ['引用 .md 条数写成 38', { doc: { mdRefs: 38 } }, 'README 的「引用本仓库 .md」条数：写了 38，实际 21'],
    ['MCP 数写成 17', { doc: { mcp: 17 } }, 'README 的 opencode MCP 数：写了 17，实际 5'],
    ['Provider 数写成 4', { doc: { providers: 4 } }, 'README 的 opencode Provider 数：写了 4，实际 1'],
  ];
  for (const [title, over, needle] of drift) {
    it(`${title} → exit 1 并点名`, () => {
      const { code, out } = runFixture(over);
      expect(code, out).toBe(1);
      expect(out).toContain(needle);
    });
  }

  it('README 那行被改写认不出 → exit 2（认不出 ≠ 对得上）', () => {
    const { code, out } = runFixture({ doc: { row: '| **opencode 全局配置** | 若干命令 | 全平台 |' } });
    expect(code, out).toBe(2);
    expect(out).toContain('认不出计数');
  });

  it('setup 脚本又用 grep 数 description 当命令数 → exit 1', () => {
    const setupSh = ['#!/usr/bin/env sh', `CMD_COUNT=$(grep -c '"description"' "$CONFIG_FILE")`, 'JSON.parse c.command', ''].join(
      '\n',
    );
    const { code, out } = runFixture({ setupSh });
    expect(code, out).toBe(1);
    expect(out).toContain('又用 grep 数行来当命令数了');
  });

  it('setup 脚本不再从配置 JSON 数命令 → exit 1', () => {
    const { code, out } = runFixture({ setupSh: '#!/usr/bin/env sh\necho hi\n' });
    expect(code, out).toBe(1);
    expect(out).toContain('不再从配置 JSON 里数 command 键');
  });
});

describe('check-opencode-config：扫不到东西时必须 exit 2', () => {
  it('生成器源码读不到 → exit 2', () => {
    const { dir, configPath } = scaffold();
    rmSync(join(dir, 'scripts', 'generate-opencode-config.cjs'));
    const { code, out } = run({ root: dir, config: configPath });
    expect(code, out).toBe(2);
    expect(out).toContain('[扫不到东西]');
  });

  it('既没有 --config 也没有生成器 → exit 2', () => {
    const { dir } = scaffold();
    const { code, out } = run({ root: dir });
    expect(code, out).toBe(2);
    expect(out).toContain('读不到生成器');
  });

  it('--config 指向的文件不存在 → exit 2', () => {
    const { dir } = scaffold();
    const { code, out } = run({ root: dir, config: join(dir, 'nope.json') });
    expect(code, out).toBe(2);
    expect(out).toContain('读不到指定的配置');
  });

  it('命令文件太少（塌面）→ exit 2', () => {
    const { code, out } = runFixture({ commandFiles: 5, sceneFiles: 5 });
    expect(code, out).toBe(2);
    expect(out).toContain('只读到 5 个命令文件（下限 20）');
  });

  it('场景太少（塌面）→ exit 2', () => {
    const { code, out } = runFixture({ sceneFiles: 5 });
    expect(code, out).toBe(2);
    expect(out).toContain('只读到 5 个场景（下限 20）');
  });

  it('生成结果里命令太少（塌面）→ exit 2', () => {
    const { code, out } = runFixture({ commands: 10, mdRefs: 10 });
    expect(code, out).toBe(2);
    expect(out).toContain('生成结果只有 10 个命令（下限 50）');
  });
});

describe('check-opencode-config：真仓库守卫', () => {
  it('真仓库与真实生成器一致（漂移守卫）', () => {
    const { code, out } = run();
    expect(code, out).toBe(0);
    expect(out).toContain('[ok] opencode 全局配置的说明书与仓库一致');
  }, 120_000);

  it('生成器源码里不再指向已删除的 hunt / e2e / monitor 命令文件', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'generate-opencode-config.cjs'), 'utf8');
    for (const ghost of ['hunt.md', 'e2e.md', 'monitor.md']) {
      expect(src.includes(`.claude/commands/${ghost}`), `不许再引用已删除的 ${ghost}`).toBe(false);
    }
  });

  it('旧的假数字不许回来（108 命令 / 86行33步 / 38 .md-referenced 注释）', () => {
    const readmeText = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const src = readFileSync(join(ROOT, 'scripts', 'generate-opencode-config.cjs'), 'utf8');
    expect(readmeText.includes('108 命令'), 'README 不许再写 108 命令').toBe(false);
    expect(src.includes('86行33步'), '生成器不许再写 86行33步').toBe(false);
    expect(src.includes('38 .md-referenced commands'), '生成器不许再写死 .md 引用条数').toBe(false);
  });
});
