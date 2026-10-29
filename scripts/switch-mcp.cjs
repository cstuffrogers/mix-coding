#!/usr/bin/env node
/**
 * 切换 MCP 配置模式
 *   npm run mcp:switch -- light   # 只启用 .mcp.json 里那几个（默认，启动快）
 *   npm run mcp:switch -- full    # 换成 .mcp.json.full（完整档，启动慢）
 *
 * 数量一律从文件里数出来再打印 —— 以前这里把个数写死在字符串里（和 .mcp.json 实际数量不符），
 * 于是 `light` 分支每次都打印一句「已经是 light 模式（4 个启用）」的假话，却什么也没做。
 */
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'light';
const mcpPath = path.join(__dirname, '..', '.mcp.json');
const fullPath = path.join(__dirname, '..', '.mcp.json.full');

function serverNames(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Object.keys(parsed.mcpServers || {});
  } catch {
    return null;
  }
}

const active = serverNames(mcpPath);
if (!active) {
  console.error('ERROR: .mcp.json not found or unreadable (cannot count active servers).');
  process.exit(1);
}

if (mode === 'light') {
  console.log(`MCP is already in light mode (${active.length} active servers: ${active.join(', ')}).`);
  console.log('To switch to full: npm run mcp:switch -- full');
  process.exit(0);
}

if (mode === 'full') {
  const full = serverNames(fullPath);
  if (!full) {
    console.error('ERROR: .mcp.json.full not found or unreadable. Run setup first.');
    process.exit(1);
  }
  fs.copyFileSync(fullPath, mcpPath);
  console.log(`OK: Switched to FULL mode (${full.length} active servers: ${full.join(', ')}).`);
  console.log('NOTE: Restart Claude Code to apply.');
  console.log('WARNING: Full mode may cause 1-5 min startup time (codegraph index, npx downloads, browser launch).');
  process.exit(0);
}

console.log('Usage:');
console.log(`  npm run mcp:switch -- light    # ${active.length} MCPs (default, fast startup)`);
const full = serverNames(fullPath);
console.log(`  npm run mcp:switch -- full     # ${full ? full.length : '?'} MCPs (full features, slow startup)`);
