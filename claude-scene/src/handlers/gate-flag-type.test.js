import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 第十一轮的常驻守卫：门禁旗标（gate-flags.js 里的 *Passed / *Configured / ...）
// 只允许是 true / false / undefined。
//
// 来历：evalStandardGate 以前写成 `value !== false → passed`，于是
// `context.loadTestPassed = null`（负载测试没跑）被报成「✓ 通过」。
// 门禁层已经改成「只有 === true 才算通过」，这里再从**写入侧**堵一遍：
// 任何 handler 都不许往门禁旗标里塞字符串/数字/null —— 那种值没有语义，
// 只会在下一个读它的地方被误读成「通过」。
const HERE = dirname(fileURLToPath(import.meta.url)); // claude-scene/src/handlers
const SRC = join(HERE, '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js') && !name.includes('.test.')) out.push(full);
  }
  return out;
}

function gateFlagNames() {
  const src = readFileSync(join(SRC, 'data', 'gate-flags.js'), 'utf-8');
  return new Set([...src.matchAll(/'(\w+(?:Passed|Configured|Created|Generated))'/g)].map((m) => m[1]));
}

function engineSources() {
  return walk(SRC).map((file) => ({ file, src: readFileSync(file, 'utf-8') }));
}

describe('门禁旗标只写布尔值', () => {
  it('扫描范围与旗标表都不是空的（防止断言空转）', () => {
    expect(engineSources().length).toBeGreaterThan(100);
    const flags = gateFlagNames();
    expect(flags.size).toBeGreaterThan(40);
    expect(flags.has('lintPassed')).toBe(true);
    expect(flags.has('loadTestPassed')).toBe(true);
  });

  it('没有任何 handler 给门禁旗标赋非布尔值', () => {
    const flags = gateFlagNames();
    const offenders = [];
    for (const { file, src } of engineSources()) {
      const lines = src.split('\n');
      lines.forEach((line, index) => {
        // 锚定行首的 context.<flag> = ...；贪婪抓到行尾再自己剥分号，
        // 避免 `(.+?);?\s*$` 那种回淶爆炸（sonarjs/super-linear-regex）。
        const m = line.match(/context\.(\w+)\s*=(.*)$/);
        if (!m || !flags.has(m[1])) return;
        if (m[2].startsWith('=')) return; // 这是 == / === 比较，不是赋值
        const rhs = m[2].replace(/;\s*$/, '').trim();
        // 允许：true/false/undefined/变量、布尔表达式、函数调用（返回值由调用方保证）
        const isBooleanLiteral = /^(?:true|false|undefined|null)$/.test(rhs);
        if (isBooleanLiteral && rhs !== 'null') return;
        if (isBooleanLiteral && rhs === 'null') {
          offenders.push(`${file}:${index + 1} ${m[1]} = null（null 不是「没测」，请留 undefined）`);
          return;
        }
        // 明显是字符串/数字字面量 → 违规
        if (/^['"`]/.test(rhs) || /^-?\d/.test(rhs)) {
          offenders.push(`${file}:${index + 1} ${m[1]} = ${rhs}`);
        }
      });
    }
    expect(offenders.join('\n')).toBe('');
  });
});
