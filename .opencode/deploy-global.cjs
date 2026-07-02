#!/usr/bin/env node
/**
 * deploy-global.cjs — Generate opencode global config and write to ~/.config/opencode/opencode.json
 *
 * Detects Pencil MCP, injects env var API keys, and produces a clean UTF-8 JSON (no BOM).
 *
 * Usage:
 *   node .opencode/deploy-global.cjs                  # auto-detect Pencil
 *   PENCIL_PATH=/custom/path node .opencode/deploy-global.cjs
 *   node .opencode/deploy-global.cjs --dry-run        # print to stdout only
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isDryRun = process.argv.includes('--dry-run');
const outputPath = isDryRun ? null : path.join(os.homedir(), '.config/opencode/opencode.json');
const generator = path.join(__dirname, '..', 'scripts', 'generate-opencode-config.cjs');
const baseDir = path.join(__dirname, '..');

// --- Detect Pencil MCP ---
function detectPencil() {
  if (process.env.PENCIL_PATH && fs.existsSync(process.env.PENCIL_PATH)) return process.env.PENCIL_PATH;

  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', '.pencil/mcp/visual_studio_code/out/mcp-server-windows-x64.exe'),
    path.join(os.homedir(), '.pencil/mcp/visual_studio_code/out/mcp-server-windows-x64.exe'),
    path.join(os.homedir(), '.pencil/mcp/visual_studio_code/out/mcp-server-darwin-arm64'),
    path.join(os.homedir(), '.pencil/mcp/visual_studio_code/out/mcp-server-linux-x64')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const pencilPath = detectPencil();
const pencilFlag = pencilPath ? ` --pencil "${pencilPath.replace(/\\/g, '/')}"` : '';

// --- Run generator ---
const cmd = `node "${generator}"${pencilFlag}`;
let output;
try {
  output = execSync(cmd, { cwd: baseDir });
} catch (e) {
  console.error('Error running generator:', e.message);
  process.exit(1);
}

// --- Inject API keys from env (replace placeholders) ---
const envMap = {
  GITHUB_PERSONAL_ACCESS_TOKEN: 'GITHUB_TOKEN',
  TAVILY_API_KEY: 'TAVILY_API_KEY',
  CONTEXT7_API_KEY: 'CONTEXT7_API_KEY',
  SENTRY_AUTH_TOKEN: 'SENTRY_AUTH_TOKEN',
  SUPABASE_ACCESS_TOKEN: 'SUPABASE_ACCESS_TOKEN',
  STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
  RESEND_API_KEY: 'RESEND_API_KEY',
  MOBSF_URL: 'MOBSF_URL',
  MOBSF_API_KEY: 'MOBSF_API_KEY',
  BEARER_API_KEY: 'BEARER_API_KEY'
};

let result = output.toString('utf8');
for (const [placeholder, envVar] of Object.entries(envMap)) {
  if (process.env[envVar]) {
    result = result.split('${' + placeholder + '}').join(process.env[envVar]);
  }
}

// --- Write or dry-run ---
if (isDryRun) {
  process.stdout.write(result);
  return;
}

const configDir = path.dirname(outputPath);
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(outputPath, result, 'utf8');

const config = JSON.parse(result);
console.log('Written: ' + outputPath);
console.log('Commands: ' + Object.keys(config.command).length);
console.log('MCP: ' + Object.keys(config.mcp).length);
console.log('Providers: ' + (config.provider ? Object.keys(config.provider).length : 0));
console.log('Has Pencil: ' + !!config.mcp.pencil);
console.log('.md refs: ' + Object.values(config.command).filter(v => v.template && v.template.includes('.claude/commands')).length);
console.log('Has BOM: ' + (Buffer.from(result).slice(0, 3).toString() === '\uFEFF'));
