#!/usr/bin/env node
/**
 * 完整设置 mempalace，让 Claude Code 真正能用
 * 1. 验证 CLI
 * 2. 配 PATH
 * 3. 启动 MCP server
 * 4. 测试
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOME = os.homedir();
const UV_BIN = path.join(HOME, '.local', 'bin');

function step(n, msg) {
  console.log(`\n=== Step ${n}: ${msg} ===`);
}

function tryExec(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000,
      ...opts,
    });
  } catch (e) {
    return e.message;
  }
}

// === Step 1: 验证 mempalace CLI ===
step(1, 'Verify mempalace CLI');
const mp = path.join(UV_BIN, 'mempalace.exe');
const mpMcp = path.join(UV_BIN, 'mempalace-mcp.exe');
if (fs.existsSync(mp)) {
  console.log(`OK  mempalace.exe:  ${mp}`);
} else {
  console.log(`ERR mempalace.exe NOT found`);
}
if (fs.existsSync(mpMcp)) {
  console.log(`OK  mempalace-mcp.exe: ${mpMcp}`);
} else {
  console.log(`ERR mempalace-mcp.exe NOT found`);
}

// === Step 2: 测版本 ===
step(2, 'Test mempalace --version');
const ver = tryExec(`"${mp}" --version`);
console.log(ver.split('\n').slice(0, 3).join('\n'));

// === Step 3: 检查 PATH 配置 ===
step(3, 'Check PATH');
const pathEnv = process.env.PATH || process.env.Path || '';
const hasUvBin = pathEnv.includes(UV_BIN);
console.log(`PATH contains ${UV_BIN}: ${hasUvBin ? 'YES' : 'NO'}`);
if (!hasUvBin) {
  console.log('RECOMMEND: Add to system PATH:');
  console.log(`  setx PATH "%PATH%;${UV_BIN}"`);
}

// === Step 4: 测 mempalace 命令（不带路径）===
step(4, 'Test mempalace without full path');
const bareTest = tryExec('mempalace --version');
if (bareTest.includes('not found') || bareTest.includes('not recognized')) {
  console.log('WARN: mempalace not on PATH (use full path or add to PATH)');
} else {
  console.log('OK: mempalace accessible without full path');
  console.log(bareTest.split('\n').slice(0, 2).join('\n'));
}

// === Step 5: 更新 .mcp.json ===
step(5, 'Update .mcp.json to use full path');
const mcpPath = path.join(__dirname, '..', '.mcp.json');
if (fs.existsSync(mcpPath)) {
  const cfg = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
  const mp = cfg.mcpServers?.mempalace;
  if (mp) {
    console.log(`Current mempalace MCP config:`);
    console.log(`  command: ${mp.command}`);
    console.log(`  args:    ${JSON.stringify(mp.args)}`);

    // 改用全路径 + shell wrapper (Windows 兼容)
    cfg.mcpServers.mempalace = {
      ...mp,
      command: mpMcp,
      args: mp.args || [],
    };

    fs.writeFileSync(mcpPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    console.log(`OK: Updated to use full path: ${mpMcp}`);
  } else {
    console.log('WARN: mempalace not in .mcp.json');
  }
}

// === Step 6: 测 MCP server 启动 ===
step(6, 'Test mempalace-mcp startup');
// 不能用 head，Windows 没有 head 命令；改用 --version 测
const mcpTest = tryExec(`"${mpMcp}" --version`);
console.log(mcpTest.split('\n').slice(0, 5).join('\n'));

// === Step 7: 总结 ===
console.log('\n=== Summary ===');
console.log('Next steps:');
console.log('  1. Restart Claude Code / Trae IDE to load new .mcp.json');
console.log('  2. Test with: "list my mempalace memories"');
console.log('  3. Or use mcp__mempalace__search tool directly');
console.log('');
console.log('If MCP fails to start:');
console.log(`  - Manually verify: "${mpMcp}" --help`);
console.log(`  - Check Claude Code logs for errors`);
console.log(`  - Or add to PATH: setx PATH "%PATH%;${UV_BIN}"`);
