#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 已知无效或常见误写图标名 → 正确 Material Symbols 名
const KNOWN_BAD = new Set([
  'flame', 'fire',         // → local_fire_department
  'trophy',                // → emoji_events
  'target', 'bullseye',    // → my_location 或 gps_fixed
  'rocket',                // → rocket_launch
  'message',               // → mail / chat
  'bell',                  // → notifications
  'gear', 'cog',           // → settings
  'graph', 'chart',        // → bar_chart / monitoring
  'heart',                 // → favorite
  'cross', 'x',            // → close
  'check',                 // → check (valid actually)
  'arrow-right',           // → arrow_forward
  'arrow-left',            // → arrow_back
  'plus',                  // → add
  'minus',                 // → remove
  'pencil',                // → edit
  'trash',                 // → delete
]);

const targets = process.argv.slice(2);
if (!targets.length) { console.error('Usage: scan-icons.cjs <dir1> [dir2] ...'); process.exit(1); }

const findings = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules','dist','.git'].includes(e.name)) continue;
      walk(f);
    } else if (/\.(tsx|jsx)$/.test(e.name)) {
      const content = fs.readFileSync(f, 'utf8');
      // 匹配 <span class="material-symbols-outlined">NAME</span> 形式
      // 以及 {item.icon} 这种间接引用我们追溯到 icon: 'NAME' 字段
      const re1 = /material-symbols-outlined[^>]*>\s*\{?([\w_-]+)\}?\s*</g;
      const re2 = /icon:\s*['"]([\w_-]+)['"]/g;
      let m;
      while ((m = re1.exec(content)) !== null) {
        const name = m[1];
        if (!/^[a-z_]+$/.test(name)) continue; // 跳过 JSX 表达式
        const line = content.substring(0, m.index).split('\n').length;
        findings.push({ file: f, line, name, ctx: 'span' });
      }
      while ((m = re2.exec(content)) !== null) {
        const name = m[1];
        const line = content.substring(0, m.index).split('\n').length;
        findings.push({ file: f, line, name, ctx: 'icon:field' });
      }
    }
  }
}
targets.forEach(walk);

// 输出全部 + 标记可疑
const bad = findings.filter(f => KNOWN_BAD.has(f.name));
console.log('\n=== 全部图标引用 (' + findings.length + ' 处) ===');
const byName = {};
findings.forEach(f => { byName[f.name] = (byName[f.name] || 0) + 1; });
Object.entries(byName).sort((a,b) => b[1] - a[1]).forEach(([n,c]) => console.log(`  ${c.toString().padStart(3)} × ${n}${KNOWN_BAD.has(n) ? '  ⚠️ 无效' : ''}`));

console.log('\n=== ⚠️  无效图标 (' + bad.length + ' 处) ===');
bad.forEach(f => console.log(`  ${f.file}:${f.line}  [${f.ctx}]  ${f.name}`));
