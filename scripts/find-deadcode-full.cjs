#!/usr/bin/env node
/**
 * 全面死代码扫描器
 * 扫描：handlers / scenes / commands / skills / mcp / rules
 * 用法：node scripts/find-deadcode-full.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = {};

// 收集所有 .js / .json / .md 内容作为引用源
function walkSrc(dir, results) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  function walk(d) {
    for (const item of fs.readdirSync(d)) {
      const p = path.join(d, item);
      try {
        if (fs.statSync(p).isDirectory()) {
          walk(p);
        } else if (/\.(js|json|md|cjs|mjs)$/.test(p)) {
          out.push(p);
        }
      } catch (e) {}
    }
  }
  walk(dir);
  return out;
}

const searchDirs = [
  'claude-scene/src',
  '.claude/scenes',
  '.claude/commands',
  '.claude/skills',
  '.claude/hooks',
];

let combined = '';
for (const d of searchDirs) {
  const files = walkSrc(path.join(ROOT, d), results);
  for (const f of files) {
    try {
      combined += fs.readFileSync(f, 'utf-8') + '\n';
    } catch (e) {}
  }
}

function isReferenced(name) {
  return combined.includes(name);
}

// === 扫描 handlers ===
function scanHandlers() {
  const handlersDir = path.join(ROOT, 'claude-scene/src/handlers');
  if (!fs.existsSync(handlersDir)) return [];
  const items = [];
  function walk(d) {
    for (const item of fs.readdirSync(d)) {
      const p = path.join(d, item);
      if (fs.statSync(p).isDirectory()) {
        walk(p);
      } else if (p.endsWith('.js') && !p.endsWith('.test.js')) {
        items.push(p);
      }
    }
  }
  walk(handlersDir);
  return items;
}

// === 扫描 scenes ===
function scanScenes() {
  const dir = path.join(ROOT, '.claude/scenes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(dir, f));
}

// === 扫描 commands ===
function scanCommands() {
  const dir = path.join(ROOT, '.claude/commands');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(dir, f));
}

// === 扫描 skills ===
function scanSkills() {
  const dir = path.join(ROOT, '.claude/skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
    .map(f => path.join(dir, f));
}

// === 扫描 MCP servers ===
function scanMcp() {
  const files = [
    path.join(ROOT, '.mcp.json'),
    path.join(ROOT, '.claude/mcp.json'),
  ];
  const out = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    try {
      const cfg = JSON.parse(fs.readFileSync(f, 'utf-8'));
      const servers = cfg.mcpServers || cfg.servers || {};
      for (const name of Object.keys(servers)) {
        out.push({ name, file: f });
      }
    } catch (e) {}
  }
  return out;
}

const handlers = scanHandlers();
const scenes = scanScenes();
const commands = scanCommands();
const skills = scanSkills();
const mcpServers = scanMcp();

console.log('\n=== Dead Code Report ===\n');

const deadHandlers = handlers.filter(h => {
  const name = path.basename(h, '.js');
  return !isReferenced(name);
});

const deadScenes = scenes.filter(s => {
  const name = path.basename(s, '.json');
  return !isReferenced(name);
});

const deadCommands = commands.filter(c => {
  const name = path.basename(c, '.md');
  return !isReferenced(name);
});

const deadSkills = skills.filter(s => {
  const name = path.basename(s);
  return !isReferenced(name);
});

const deadMcp = mcpServers.filter(s => !isReferenced(s.name));

function relPath(p) {
  return path.relative(ROOT, p);
}

function reportSection(title, items, formatter) {
  console.log(`--- ${title}: ${items.length} dead ---`);
  if (items.length === 0) {
    console.log('  (none)');
  } else {
    for (const it of items) {
      console.log(`  ${formatter(it)}`);
    }
  }
  console.log('');
}

reportSection('Handlers (claude-scene/src/handlers)', deadHandlers, h => {
  const size = fs.statSync(h).size;
  return `${(size / 1024).toFixed(1).padStart(6)} KB  ${relPath(h)}`;
});

reportSection('Scenes (.claude/scenes)', deadScenes, s => {
  const size = fs.statSync(s).size;
  return `${(size / 1024).toFixed(1).padStart(6)} KB  ${relPath(s)}`;
});

reportSection('Commands (.claude/commands)', deadCommands, c => {
  const size = fs.statSync(c).size;
  return `${(size / 1024).toFixed(1).padStart(6)} KB  ${relPath(c)}`;
});

reportSection('Skills (.claude/skills)', deadSkills, s => {
  const size = fs.statSync(s).size;
  return `${(size / 1024).toFixed(1).padStart(6)} KB  ${relPath(s)}`;
});

reportSection('MCP Servers', deadMcp, m => `${m.name} (in ${relPath(m.file)})`);

console.log('=== Summary ===');
const totalDead =
  deadHandlers.length + deadScenes.length + deadCommands.length +
  deadSkills.length + deadMcp.length;
console.log(`Total dead: ${totalDead}`);
console.log(`  Handlers: ${deadHandlers.length} / ${handlers.length}`);
console.log(`  Scenes:   ${deadScenes.length} / ${scenes.length}`);
console.log(`  Commands: ${deadCommands.length} / ${commands.length}`);
console.log(`  Skills:   ${deadSkills.length} / ${skills.length}`);
console.log(`  MCP:      ${deadMcp.length} / ${mcpServers.length}`);
