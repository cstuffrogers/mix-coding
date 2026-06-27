#!/usr/bin/env node
/**
 * 扫描所有 scene 的真实步骤数
 */
const fs = require('fs');
const path = require('path');

const SCENES_DIR = path.join(__dirname, '..', '.claude', 'scenes');
const files = fs.readdirSync(SCENES_DIR).filter(f => f.endsWith('.json')).sort();

const result = {};
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(SCENES_DIR, f), 'utf-8'));
  const name = data.name || f.replace('.json', '');
  const steps = data.flow ? data.flow.length : 0;
  result[name] = { file: f, steps, desc: data.description || '' };
}

// 按步骤数排序
const sorted = Object.entries(result).sort((a, b) => b[1].steps - a[1].steps);

console.log('| Scene | Steps | File |');
console.log('|-------|-------|------|');
for (const [name, info] of sorted) {
  console.log(`| ${name} | ${info.steps} | ${info.file} |`);
}

console.log(`\nTotal scenes: ${files.length}`);
console.log(`Total steps: ${sorted.reduce((s, [,i]) => s + i.steps, 0)}`);

// 输出 JSON 供后续使用
fs.writeFileSync(
  path.join(__dirname, '..', 'scripts', 'scenes-stats.json'),
  JSON.stringify(result, null, 2)
);
