#!/usr/bin/env node
/**
 * 第二轮：给已替换为 base-100/* 的卡片容器加玻璃+悬浮，按钮加发光
 */
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
if (!targetDir) { console.error('Usage: node glassify.cjs <dir>'); process.exit(1); }

const rules = [
  // 已经是 bg-base-100/* backdrop-blur-xl 的容器，叠加 glass-card 风格阴影
  [/className="([^"]*?)bg-base-100\/60 backdrop-blur-xl([^"]*?rounded-(?:lg|xl|2xl))([^"]*)"/g,
    'className="$1bg-base-100/60 backdrop-blur-xl border border-base-content/10 shadow-xl shadow-primary/10$2$3"'],

  // primary 按钮：加发光
  [/className="([^"]*?)bg-primary(?!\/)([^"]*?)"/g, (m, p1, p2) => {
    if (p1.includes('shadow-primary') || p2.includes('shadow-primary')) return m;
    if (/rounded/.test(p1 + p2)) {
      return `className="${p1}bg-primary shadow-lg shadow-primary/40 hover:shadow-primary/60 transition-shadow${p2}"`;
    }
    return m;
  }],

  // secondary 按钮：加紫色发光
  [/className="([^"]*?)bg-secondary(?!\/)([^"]*?)"/g, (m, p1, p2) => {
    if (p1.includes('shadow-secondary') || p2.includes('shadow-secondary')) return m;
    if (/rounded/.test(p1 + p2)) {
      return `className="${p1}bg-secondary shadow-lg shadow-secondary/40 hover:shadow-secondary/60 transition-shadow${p2}"`;
    }
    return m;
  }],

  // bg-gradient-to-* primary→secondary 已生成，叠加 glow
  [/\bbg-gradient-to-(r|br|tr) from-primary to-secondary\b/g,
    'bg-gradient-to-$1 from-primary to-secondary shadow-lg shadow-primary/30'],
];

let scanned = 0, modified = 0, replacements = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules','dist','.git'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
      scanned++;
      const orig = fs.readFileSync(full, 'utf8');
      let out = orig;
      let n = 0;
      for (const [pattern, replacement] of rules) {
        out = out.replace(pattern, (...args) => { n++; return typeof replacement === 'function' ? replacement(...args) : replacement.replace(/\$(\d)/g, (_, i) => args[i]); });
      }
      if (out !== orig) { fs.writeFileSync(full, out, 'utf8'); modified++; replacements += n; }
    }
  }
}
walk(targetDir);
console.log(`Scanned: ${scanned}  Modified: ${modified}  Replacements: ${replacements}`);
