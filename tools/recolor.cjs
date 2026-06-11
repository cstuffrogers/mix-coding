#!/usr/bin/env node
/**
 * 批量替换 Tailwind 硬编码颜色类 → DaisyUI 语义类 / 玻璃科技感 utility
 * 用法: node recolor.js <target_dir>
 */
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node recolor.js <target_dir>');
  process.exit(1);
}

// 替换规则（顺序敏感：先长串后短串、先具体后通用）
const rules = [
  // ===== 背景：白色卡片 → 玻璃卡片 =====
  [/\bbg-white\b(?!\/)/g, 'bg-base-100/60 backdrop-blur-xl'],
  [/\bbg-white\/(\d+)\b/g, 'bg-base-100/$1 backdrop-blur-xl'],

  // ===== 灰阶背景 → base 层级 =====
  [/\bbg-(gray|slate|zinc|neutral|stone)-50\b/g, 'bg-base-200/40'],
  [/\bbg-(gray|slate|zinc|neutral|stone)-100\b/g, 'bg-base-200/60'],
  [/\bbg-(gray|slate|zinc|neutral|stone)-200\b/g, 'bg-base-300/70'],
  [/\bbg-(gray|slate|zinc|neutral|stone)-300\b/g, 'bg-base-300'],
  [/\bbg-(gray|slate|zinc|neutral|stone)-400\b/g, 'bg-neutral'],
  [/\bbg-(gray|slate|zinc|neutral|stone)-(500|600|700|800|900)\b/g, 'bg-neutral'],

  // ===== 灰阶文字 → base-content =====
  [/\btext-(gray|slate|zinc|neutral|stone)-(950|900)\b/g, 'text-base-content'],
  [/\btext-(gray|slate|zinc|neutral|stone)-(700|800)\b/g, 'text-base-content/90'],
  [/\btext-(gray|slate|zinc|neutral|stone)-(600|500)\b/g, 'text-base-content/70'],
  [/\btext-(gray|slate|zinc|neutral|stone)-(400|300)\b/g, 'text-base-content/50'],
  [/\btext-(gray|slate|zinc|neutral|stone)-(200|100|50)\b/g, 'text-base-content/30'],

  // ===== 灰阶边框 =====
  [/\bborder-(gray|slate|zinc|neutral|stone)-(50|100)\b/g, 'border-base-content/10'],
  [/\bborder-(gray|slate|zinc|neutral|stone)-(200|300)\b/g, 'border-base-content/15'],
  [/\bborder-(gray|slate|zinc|neutral|stone)-(400|500|600|700|800|900)\b/g, 'border-base-content/30'],

  // ===== 分隔线 / divide =====
  [/\bdivide-(gray|slate|zinc|neutral|stone)-(100|200|300)\b/g, 'divide-base-content/10'],

  // ===== 主品牌蓝 → primary =====
  [/\bbg-(blue|indigo|sky)-(500|600|700)\b/g, 'bg-primary'],
  [/\bbg-(blue|indigo|sky)-(50|100)\b/g, 'bg-primary/10'],
  [/\bbg-(blue|indigo|sky)-(200|300|400)\b/g, 'bg-primary/30'],
  [/\bbg-(blue|indigo|sky)-(800|900)\b/g, 'bg-primary/80'],
  [/\btext-(blue|indigo|sky)-(500|600|700|800|900)\b/g, 'text-primary'],
  [/\btext-(blue|indigo|sky)-(300|400)\b/g, 'text-primary'],
  [/\btext-(blue|indigo|sky)-(50|100|200)\b/g, 'text-primary/70'],
  [/\bborder-(blue|indigo|sky)-(400|500|600|700)\b/g, 'border-primary'],
  [/\bborder-(blue|indigo|sky)-(100|200|300)\b/g, 'border-primary/40'],
  [/\bring-(blue|indigo|sky)-(400|500|600)\b/g, 'ring-primary'],
  [/\bfrom-(blue|indigo|sky)-(400|500|600|700)\b/g, 'from-primary'],
  [/\bto-(blue|indigo|sky)-(400|500|600|700)\b/g, 'to-primary'],
  [/\bvia-(blue|indigo|sky)-(400|500|600|700)\b/g, 'via-primary'],

  // ===== 紫色 → secondary =====
  [/\bbg-(purple|violet|fuchsia)-(500|600|700)\b/g, 'bg-secondary'],
  [/\bbg-(purple|violet|fuchsia)-(50|100)\b/g, 'bg-secondary/10'],
  [/\bbg-(purple|violet|fuchsia)-(200|300|400)\b/g, 'bg-secondary/30'],
  [/\btext-(purple|violet|fuchsia)-(500|600|700|800)\b/g, 'text-secondary'],
  [/\btext-(purple|violet|fuchsia)-(300|400)\b/g, 'text-secondary'],
  [/\bborder-(purple|violet|fuchsia)-(400|500|600)\b/g, 'border-secondary'],
  [/\bfrom-(purple|violet|fuchsia)-(400|500|600|700)\b/g, 'from-secondary'],
  [/\bto-(purple|violet|fuchsia)-(400|500|600|700)\b/g, 'to-secondary'],

  // ===== 青/水鸭 → accent =====
  [/\bbg-(cyan|teal)-(500|600|700)\b/g, 'bg-accent'],
  [/\bbg-(cyan|teal)-(50|100)\b/g, 'bg-accent/10'],
  [/\btext-(cyan|teal)-(500|600|700|800)\b/g, 'text-accent'],
  [/\bborder-(cyan|teal)-(400|500|600)\b/g, 'border-accent'],
  [/\bfrom-(cyan|teal)-(400|500|600|700)\b/g, 'from-accent'],
  [/\bto-(cyan|teal)-(400|500|600|700)\b/g, 'to-accent'],

  // ===== 绿 → success =====
  [/\bbg-(green|emerald|lime)-(500|600|700)\b/g, 'bg-success'],
  [/\bbg-(green|emerald|lime)-(50|100)\b/g, 'bg-success/10'],
  [/\bbg-(green|emerald|lime)-(200|300|400)\b/g, 'bg-success/30'],
  [/\btext-(green|emerald|lime)-(500|600|700|800)\b/g, 'text-success'],
  [/\btext-(green|emerald|lime)-(300|400)\b/g, 'text-success'],
  [/\bborder-(green|emerald|lime)-(400|500|600)\b/g, 'border-success'],
  [/\bfrom-(green|emerald|lime)-(400|500|600|700)\b/g, 'from-success'],
  [/\bto-(green|emerald|lime)-(400|500|600|700)\b/g, 'to-success'],

  // ===== 黄/橙 → warning =====
  [/\bbg-(yellow|amber|orange)-(500|600|700)\b/g, 'bg-warning'],
  [/\bbg-(yellow|amber|orange)-(50|100)\b/g, 'bg-warning/10'],
  [/\bbg-(yellow|amber|orange)-(200|300|400)\b/g, 'bg-warning/30'],
  [/\btext-(yellow|amber|orange)-(500|600|700|800)\b/g, 'text-warning'],
  [/\btext-(yellow|amber|orange)-(300|400)\b/g, 'text-warning'],
  [/\bborder-(yellow|amber|orange)-(400|500|600)\b/g, 'border-warning'],
  [/\bfrom-(yellow|amber|orange)-(400|500|600|700)\b/g, 'from-warning'],
  [/\bto-(yellow|amber|orange)-(400|500|600|700)\b/g, 'to-warning'],

  // ===== 红/玫瑰/粉 → error =====
  [/\bbg-(red|rose|pink)-(500|600|700)\b/g, 'bg-error'],
  [/\bbg-(red|rose|pink)-(50|100)\b/g, 'bg-error/10'],
  [/\bbg-(red|rose|pink)-(200|300|400)\b/g, 'bg-error/30'],
  [/\btext-(red|rose|pink)-(500|600|700|800)\b/g, 'text-error'],
  [/\btext-(red|rose|pink)-(300|400)\b/g, 'text-error'],
  [/\bborder-(red|rose|pink)-(400|500|600)\b/g, 'border-error'],
  [/\bfrom-(red|rose|pink)-(400|500|600|700)\b/g, 'from-error'],
  [/\bto-(red|rose|pink)-(400|500|600|700)\b/g, 'to-error'],

  // ===== 阴影：浅阴影在暗底无效，强化为发光 =====
  [/\bshadow-sm\b/g, 'shadow-sm shadow-primary/10'],
  [/\bshadow-md\b/g, 'shadow-lg shadow-primary/15'],
  [/\bshadow-lg\b/g, 'shadow-xl shadow-primary/20'],
];

let scanned = 0, modified = 0, replacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      walk(full);
    } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
      scanned++;
      const orig = fs.readFileSync(full, 'utf8');
      let out = orig;
      let fileReplacements = 0;
      for (const [pattern, replacement] of rules) {
        out = out.replace(pattern, (match) => {
          fileReplacements++;
          return typeof replacement === 'function' ? replacement(match) : replacement;
        });
      }
      if (out !== orig) {
        fs.writeFileSync(full, out, 'utf8');
        modified++;
        replacements += fileReplacements;
      }
    }
  }
}

walk(targetDir);
console.log(`Scanned: ${scanned}  Modified: ${modified}  Replacements: ${replacements}`);
