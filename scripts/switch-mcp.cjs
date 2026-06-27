#!/usr/bin/env node
/**
 * 切换 MCP 配置模式
 *   npm run mcp:switch -- light   # 4 个 MCP（默认）
 *   npm run mcp:switch -- full    # 14 个 MCP（完整）
 */
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'light';
const mcpPath = path.join(__dirname, '..', '.mcp.json');
const fullPath = path.join(__dirname, '..', '.mcp.json.full');

if (!fs.existsSync(fullPath)) {
  console.error('ERROR: .mcp.json.full not found. Run setup first.');
  process.exit(1);
}

if (mode === 'light') {
  // 已经在 light 模式（我们刚改成 light），但用户可能想确保
  console.log('MCP is already in light mode (4 active servers).');
  console.log('To switch to full: npm run mcp:switch -- full');
  process.exit(0);
}

if (mode === 'full') {
  fs.copyFileSync(fullPath, mcpPath);
  console.log('OK: Switched to FULL mode (14 active servers).');
  console.log('NOTE: Restart Claude Code to apply.');
  console.log('WARNING: Full mode may cause 1-5 min startup time (codegraph index, npx downloads, browser launch).');
  process.exit(0);
}

console.log('Usage:');
console.log('  npm run mcp:switch -- light    # 4 MCPs (default, fast startup)');
console.log('  npm run mcp:switch -- full     # 14 MCPs (full features, slow startup)');
