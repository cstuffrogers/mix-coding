import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 第 9 种假绿：处理器明明「没跑成」，却 return 一段纯字符串。
// 引擎只能靠措辞去猜状态，猜不到就记 pass —— 屏幕上出现绿色 ✔，汇总行也把它算进 pass。
// 这类步骤必须自己布状态（{ status: 'skip' | 'warn', message }），不交给措辞推断。
const NOT_RUN_MARKERS = [
  '需在对话',
  '本轮未执行',
  '本轮未运行',
  '本轮未测量',
  'CLI 下未',
  '需手动/对话执行',
  '未执行安装',
];

const HANDLERS_DIR = join(import.meta.dirname, '..', 'handlers');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith('.js') && !name.endsWith('.test.js') ? [full] : [];
  });
}

// 只认「return 一个裸字符串」的写法；`return { status: ..., message: '...' }` 是正确姿势。
// 不能要求 return 在行首：`if (!installed) return '...';` 那种一样会把状态洗成 pass。
const BARE_STRING_RETURN = /\breturn\s+[`'"]/;

describe('没跑成的步骤不许用裸字符串 return', () => {
  it('处理器里没有「未执行/需在对话」这类消息走裸字符串', () => {
    const offenders = [];
    for (const file of walk(HANDLERS_DIR)) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (!BARE_STRING_RETURN.test(line)) return;
        const hit = NOT_RUN_MARKERS.find((marker) => line.includes(marker));
        if (hit) offenders.push(`${relative(HANDLERS_DIR, file)}:${index + 1} 命中「${hit}」`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('断言本身不是空跑：样本里必须扫到足够多的处理器文件', () => {
    // 目录写错/被改名时上面那条会「0 违规 → 绿」，这里把它钉住。
    expect(walk(HANDLERS_DIR).length).toBeGreaterThan(40);
  });
});
