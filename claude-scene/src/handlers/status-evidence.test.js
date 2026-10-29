import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_REGISTRY } from '../actions.js';
import { deriveStepStatus } from '../commands/start.js';

/**
 * 处理器的「证据」巡检：注册过的处理器，只要还拿裸字符串当返回值，
 * 它的状态就只能由引擎拿正则去猜（NOOP_RES / WARN_RES / detectHandlerFailure）。
 * 猜错的两种后果都是真的：
 *   - 扫出泄露/死链/缺口，文案里没有「失败/问题」这类词 → 记 ✓ pass（假绿）；
 *   - 什么都没做（文件已存在/没新增/没有可预览的内容）→ 也记 ✓ pass（假绿）。
 *
 * 所以：裸字符串可以留（那是给人看的消息），但**写着结论的句子**必须收进
 * `{ status, message }`。下面两个词表就是「这句话里已经写着结论」的信号。
 */
const FINDING_WORDS = /(死链|泄露|违规|未测试|覆盖率不足|可疑|漏洞|超限|超出|不一致|缺口)/;
const IDLE_WORDS = /(未新增|未覆盖|无需|没有可|未变化|未改动|没有可替换)/;

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOTS = [SRC, join(SRC, 'security'), join(SRC, 'mobile')];
const HANDLER_FILES = ROOTS.flatMap((root) => readdirSync(root)
  .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
  .map((f) => join(root, f)));

const NAMES = new Set(Object.values(ACTION_REGISTRY).map((fn) => fn.name).filter(Boolean));

function namePattern(name) {
  return new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=)`);
}

/** 花括号配对取函数体（够用：这些处理器里没有模板里嵌花括号的边界情况） */
function bodyOf(text, name) {
  const hit = namePattern(name).exec(text);
  if (!hit) return null;
  const open = text.indexOf('{', hit.index);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open, i + 1), offset: open };
    }
  }
  return null;
}

/** 裸字符串 return 的字面量（`${...}` 换成 1，好让 WARN_RES 的数字句式也能命中） */
function literalReturns(body) {
  const out = [];
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('return ')) continue;
    const rest = trimmed.slice(7).trim();
    if (!/^['"`]/.test(rest)) continue;
    const quote = rest[0];
    const end = rest.lastIndexOf(quote);
    if (end <= 0) continue;
    const raw = rest.slice(1, end);
    out.push({ line: index, raw, rendered: raw.replace(/\$\{[^}]*\}/g, '1') });
  }
  return out;
}

function collect() {
  const rows = [];
  for (const file of HANDLER_FILES) {
    const text = readFileSync(file, 'utf8');
    for (const name of NAMES) {
      const hit = bodyOf(text, name);
      if (!hit) continue;
      const baseLine = text.slice(0, hit.offset).split('\n').length;
      for (const lit of literalReturns(hit.body)) {
        rows.push({ file: file.slice(SRC.length + 1), name, line: baseLine + lit.line, ...lit });
      }
    }
  }
  return rows;
}

describe('处理器状态证据：被判 pass 的裸字符串里不许已经写着结论', () => {
  const rows = collect();

  it('巡检本身不能空跑（否则这条守卫是摆设）', () => {
    expect(NAMES.size).toBeGreaterThan(200);
    expect(HANDLER_FILES.length).toBeGreaterThan(50);
    // 裸字符串还有一堆（大部分是「已完成」这类正当消息）—— 只要还能扫到就行
    expect(rows.length).toBeGreaterThan(50);
  });

  it('文案里已经写着「有发现」的分支，必须显式布 warn/fail', () => {
    const bad = rows
      .filter((r) => FINDING_WORDS.test(r.rendered) && deriveStepStatus(r.rendered, {}).stepStatus === 'pass')
      .map((r) => `${r.file}:${r.line} [${r.name}] ${r.raw}`);
    expect(bad, `这些分支会被记成 pass（文案里有发现，状态却是通过）：\n${bad.join(String.fromCodePoint(10))}`).toEqual([]);
  });

  it('文案里已经写着「什么都没做」的分支，必须显式布 noop/skip', () => {
    const bad = rows
      .filter((r) => IDLE_WORDS.test(r.rendered) && deriveStepStatus(r.rendered, {}).stepStatus === 'pass')
      .map((r) => `${r.file}:${r.line} [${r.name}] ${r.raw}`);
    expect(bad, `这些分支会被记成 pass（什么都没做却算通过）：\n${bad.join(String.fromCodePoint(10))}`).toEqual([]);
  });
});
