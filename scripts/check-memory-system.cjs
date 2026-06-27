#!/usr/bin/env node
/**
 * 记忆系统状态扫描器
 * 一次性查清 MemPalace / hooks / settings / MCP 配置
 * 用法：node scripts/check-memory-system.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();

const checks = [];
function check(name, fn) {
  try {
    const r = fn();
    checks.push({ name, status: r.status, detail: r.detail });
  } catch (e) {
    checks.push({ name, status: 'ERROR', detail: e.message });
  }
}

// === 1. MemPalace MCP 配置 ===
check('MemPalace MCP in .mcp.json', () => {
  const p = path.join(ROOT, '.mcp.json');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: '.mcp.json not found' };
  const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const servers = cfg.mcpServers || {};
  if (servers.mempalace) {
    return { status: 'OK', detail: `command: ${servers.mempalace.command}` };
  }
  return { status: 'MISS', detail: 'mempalace not configured' };
});

// === 2. hooks 目录（两个位置） ===
check('Project hooks: .claude/hooks/', () => {
  const p = path.join(ROOT, '.claude/hooks');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: 'directory not found' };
  const files = fs.readdirSync(p);
  return { status: 'OK', detail: `${files.length} files: ${files.slice(0, 3).join(', ')}...` };
});

check('User hooks: ~/.claude/hooks/', () => {
  const p = path.join(HOME, '.claude/hooks');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: 'user hooks not found' };
  const files = fs.readdirSync(p);
  return { status: 'OK', detail: `${files.length} files: ${files.slice(0, 5).join(', ')}` };
});

// === 3. settings.json hooks 配置 ===
check('Project .claude/settings.json', () => {
  const p = path.join(ROOT, '.claude/settings.json');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: 'not found' };
  const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (cfg.hooks) {
    const types = Object.keys(cfg.hooks);
    return { status: 'OK', detail: `${types.length} hook types: ${types.join(', ')}` };
  }
  return { status: 'EMPTY', detail: 'no hooks config' };
});

check('Project .claude/settings.local.json', () => {
  const p = path.join(ROOT, '.claude/settings.local.json');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: 'not found' };
  const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const has = Object.keys(cfg);
  return { status: 'OK', detail: `keys: ${has.join(', ')}` };
});

check('User ~/.claude/settings.json', () => {
  const p = path.join(HOME, '.claude/settings.json');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: 'not found' };
  const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (cfg.hooks) {
    return { status: 'OK', detail: `${Object.keys(cfg.hooks).length} hook types` };
  }
  return { status: 'EMPTY', detail: 'no hooks' };
});

// === 4. mempalace CLI 可用性 ===
check('mempalace CLI on PATH', () => {
  // 检查常见的安装位置
  const candidates = [
    path.join(HOME, 'go/bin/mempalace.exe'),
    path.join(HOME, '.local/bin/mempalace'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'mempalace', 'mempalace.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return { status: 'OK', detail: `found: ${c}` };
  }
  return { status: 'MISS', detail: 'mempalace CLI not installed' };
});

// === 5. mempalace hook 文件 ===
check('MemPalace hook scripts', () => {
  const p = path.join(HOME, '.claude/hooks');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: 'hooks dir not found' };
  const files = fs.readdirSync(p).filter(f => f.includes('mempalace'));
  return { status: 'OK', detail: `${files.length} files: ${files.join(', ')}` };
});

// === 6. MCP server 启动测试 ===
check('MCP servers count', () => {
  const p = path.join(ROOT, '.mcp.json');
  if (!fs.existsSync(p)) return { status: 'MISS', detail: '.mcp.json not found' };
  const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const count = Object.keys(cfg.mcpServers || {}).length;
  return { status: 'INFO', detail: `${count} servers configured` };
});

// === 输出 ===
const STATUS_ICON = {
  OK: '✅',
  MISS: '❌',
  EMPTY: '⚠️ ',
  ERROR: '💥',
  INFO: 'ℹ️ ',
};

console.log('\n=== Memory System Status ===\n');
for (const c of checks) {
  const icon = STATUS_ICON[c.status] || '?';
  console.log(`${icon}  ${c.name}`);
  console.log(`    ${c.detail}`);
}
console.log('');
