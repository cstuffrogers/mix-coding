#!/usr/bin/env node
/**
 * 死代码扫描器 - 找出未被引用的 handler / scene / command / skill
 * 用法：node scripts/find-deadcode.js [--json]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IS_JSON = process.argv.includes('--json');

// 收集所有引用源
const scenes = fs.readdirSync(path.join(ROOT, '.claude/scenes'))
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(ROOT, '.claude/scenes', f));

const commands = fs.readdirSync(path.join(ROOT, '.claude/commands'))
  .filter(f => f.endsWith('.md'))
  .map(f => path.join(ROOT, '.claude/commands', f));

const handlersDir = path.join(ROOT, 'claude-scene/src/handlers');
const handlerFiles = fs.readdirSync(handlersDir)
  .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))
  .map(f => path.join(handlersDir, f));

// 收集所有 handlers 目录（含子目录）
const handlerSubDirs = ['memory', 'mobile', 'security', 'api']
  .map(d => path.join(handlersDir, d))
  .filter(d => fs.existsSync(d));

const allHandlers = [...handlerFiles];
for (const dir of handlerSubDirs) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir)
      .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))
      .forEach(f => allHandlers.push(path.join(dir, f)));
  }
}

// 收集引用内容
const allReferenceContent = [];
const allRefPaths = [];

// 主代码库
const libPath = path.join(ROOT, 'claude-scene/src');
function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const p = path.join(dir, item);
    if (fs.statSync(p).isDirectory()) {
      walkDir(p);
    } else if (p.endsWith('.js')) {
      allRefPaths.push(p);
      allReferenceContent.push(fs.readFileSync(p, 'utf-8'));
    }
  }
}
walkDir(libPath);
walkDir(path.join(ROOT, '.claude/scenes'));
walkDir(path.join(ROOT, '.claude/commands'));

// 合并所有引用
const combined = allReferenceContent.join('\n');

function basename(filepath) {
  return path.basename(filepath, '.js');
}

function isReferenced(handlerPath) {
  const name = basename(handlerPath);
  // 多种引用方式
  const checks = [
    name,                          // 直接 require
    `handlers/${name}`,            // 相对路径
    `./${name}`,                   // 当前目录
    `handlers\\${name}`,           // Windows 路径
  ];
  return checks.some(c => combined.includes(c));
}

const dead = allHandlers.filter(h => !isReferenced(h));

// 输出
if (IS_JSON) {
  console.log(JSON.stringify({
    total: allHandlers.length,
    dead: dead.map(d => path.relative(ROOT, d)),
    deadCount: dead.length
  }, null, 2));
} else {
  console.log(`\n[Dead Code Scanner]`);
  console.log(`Total handlers: ${allHandlers.length}`);
  console.log(`Dead handlers:  ${dead.length}\n`);
  if (dead.length === 0) {
    console.log('OK: No dead handlers found.');
  } else {
    console.log('Suspected dead code (not referenced anywhere):');
    for (const d of dead) {
      const size = fs.statSync(d).size;
      console.log(`  ${size.toString().padStart(6)} B  ${path.relative(ROOT, d)}`);
    }
    const totalDead = dead.reduce((s, d) => s + fs.statSync(d).size, 0);
    console.log(`\nTotal dead size: ${(totalDead / 1024).toFixed(1)} KB`);
  }
}
