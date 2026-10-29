#!/usr/bin/env node
/**
 * 切换 MCP 配置模式（可逆）
 *   npm run mcp:switch -- light   # 只启用 light 档那几个（默认，启动快）
 *   npm run mcp:switch -- full    # 换成 full 档（完整功能，启动慢）
 *
 * 两份档位各是一个**文件**：
 *   .mcp.json.light  ← light 档（3 个左右，快）
 *   .mcp.json.full   ← full 档（14 个，慢）
 * 当前生效的是 .mcp.json 本身。
 *
 * 以前这里没有 light 档文件：`full` 直接拿 full 覆盖 .mcp.json，把 light 档**永久覆盖掉**，
 * 再执行 `light` 只会打印一句「already in light mode (N active servers)」——
 * 假话 + 不可逆 + 退出码 0（假绿）。现在：
 *   - `light` / `full` 都从对应档位文件复制，真的双向可逆；
 *   - 复制后把 `_modes` 元数据（current / active_servers）按真实内容改写，元数据不会撒谎；
 *   - 未知模式 → 用法 + 退出码 2（不再「打印用法然后假装成功」）；
 *   - 档位文件缺失 / 解析失败 / 一个服务器都没有 → 退出码 1 并说清原因，绝不写入坏数据。
 *
 * 所有个数都从文件里数出来再打印，不许写死。
 * 测试用 MCP_CONFIG_DIR 指向临时目录，不碰真实仓库。
 */
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = process.env.MCP_CONFIG_DIR || path.join(__dirname, '..');

const MODES = {
  light: { label: 'LIGHT', file: '.mcp.json.light' },
  full: { label: 'FULL', file: '.mcp.json.full' },
};

const livePath = path.join(CONFIG_DIR, '.mcp.json');

function readProfile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { error: `${path.basename(file)} 读不到（先跑 setup 生成档位文件）` };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: `${path.basename(file)} 不是合法 JSON：${e.message}` };
  }
  const servers = parsed.mcpServers && typeof parsed.mcpServers === 'object' ? parsed.mcpServers : null;
  if (!servers) return { error: `${path.basename(file)} 里没有 mcpServers 对象` };
  const names = Object.keys(servers);
  if (names.length === 0) return { error: `${path.basename(file)} 的 mcpServers 是空的（拒绝写入空配置）` };
  return { parsed, names };
}

function currentNames() {
  const live = readProfile(livePath);
  return live.error ? null : live.names;
}

/** 生成要写入的完整内容：档位文件原样 + 按真实内容改写的 _modes 元数据。 */
function renderProfile(profile, modeKey) {
  const out = { ...profile, _modes: { current: modeKey, active_servers: Object.keys(profile.mcpServers || {}) } };
  // _comment 只在原来就有的时候保留语义，内容跟着模式变，不留旧的「怎么切回去」的过时说明
  out._comment =
    modeKey === 'light'
      ? 'LIGHTWEIGHT mode: 只有 light 档的服务器。切回完整档：npm run mcp:switch -- full'
      : 'FULL mode: 完整档服务器。切回轻量档：npm run mcp:switch -- light';
  return `${JSON.stringify(out, null, 2)}\n`;
}

function usage(reason) {
  if (reason) console.error(`ERROR: ${reason}`);
  console.log('Usage:');
  for (const [key, m] of Object.entries(MODES)) {
    const profile = readProfile(path.join(CONFIG_DIR, m.file));
    const count = profile.error ? '?' : String(profile.names.length);
    const hint = key === 'light' ? 'default, fast startup' : 'full features, slow startup';
    console.log(`  npm run mcp:switch -- ${key.padEnd(5)} # ${count} MCPs (${hint})`);
  }
}

const mode = process.argv[2];
if (!mode || !MODES[mode]) {
  usage(mode ? `未知模式 "${mode}"（只支持 ${Object.keys(MODES).join(' / ')}）` : '缺少模式参数');
  process.exit(2);
}

const target = MODES[mode];
const profile = readProfile(path.join(CONFIG_DIR, target.file));
if (profile.error) {
  console.error(`ERROR: ${profile.error}`);
  process.exit(1);
}

const next = renderProfile(profile.parsed, mode);
const current = currentNames();
const sameContent = (() => {
  try {
    return fs.readFileSync(livePath, 'utf8') === next;
  } catch {
    return false;
  }
})();

if (sameContent) {
  console.log(`MCP is already in ${mode} mode (${profile.names.length} active servers: ${profile.names.join(', ')}).`);
  process.exit(0);
}

try {
  fs.writeFileSync(livePath, next);
} catch (e) {
  console.error(`ERROR: 写入 ${path.basename(livePath)} 失败：${e.message}`);
  process.exit(1);
}

const from = current ? `${current.length} (${current.join(', ')})` : '未知';
console.log(`OK: Switched to ${target.label} mode — ${profile.names.length} active servers: ${profile.names.join(', ')}`);
console.log(`     before: ${from}`);
console.log('NOTE: Restart Claude Code to apply.');
if (mode === 'full') {
  console.log('WARNING: Full mode may cause 1-5 min startup time (codegraph index, npx downloads, browser launch).');
} else {
  console.log('To switch back to full: npm run mcp:switch -- full');
}
