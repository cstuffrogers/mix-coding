#!/usr/bin/env node
// 一次性修复 recolor 留下的 bg-base-100/$1 字面 bug
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
if (!targetDir) { console.error('Usage'); process.exit(1); }

let n = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules','dist','.git'].includes(e.name)) continue;
      walk(f);
    } else if (/\.(tsx|jsx)$/.test(e.name)) {
      const orig = fs.readFileSync(f, 'utf8');
      // 把 bg-base-100/$1 backdrop-blur-xl 还原为 bg-base-100/60 backdrop-blur-xl (反向恢复合理默认)
      const out = orig.replace(/bg-base-100\/\$1\b/g, () => { n++; return 'bg-base-100/60'; });
      if (out !== orig) fs.writeFileSync(f, out, 'utf8');
    }
  }
}
walk(targetDir);
console.log('Fixed literal $1 count:', n);
