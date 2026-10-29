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

/**
 * 字符串字面量抹成空格（长度与位置不变）：不抹掉的话，文案里的 `{` `}` 会把
 * 下面的括号栈搅乱，守卫就会漏报或乱报。
 */
function stripLiterals(code) {
  const out = [...code];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch !== '\'' && ch !== '"' && ch !== '`') {
      i += 1;
    } else {
      const quote = ch;
      i += 1;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') {
          out[i] = ' ';
          i += 1;
        }
        out[i] = ' ';
        i += 1;
      }
      i += 1;
    }
  }
  return out.join('');
}

const BLOCK_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with']);

/** `{` 前面那个 token 是不是「函数体」——`=> {` 与 `foo(...) {` 是，`if (...) {` 不是。 */
/** 取末尾的标识符。手写反向扫描而不是 `/(\w+)$/`：那个正则有二次回溯，会被 lint 判 super-linear。 */
function trailingIdentifier(text) {
  let end = text.trimEnd().length;
  let start = end;
  while (start > 0 && /[\w$]/.test(text[start - 1])) start -= 1;
  return text.slice(start, end);
}

function opensFunctionBody(code, openIndex) {
  const head = code.slice(0, openIndex).trimEnd();
  if (head.endsWith('=>')) return true;
  if (!head.endsWith(')')) return false;
  let depth = 0;
  for (let i = head.length - 1; i >= 0; i -= 1) {
    if (head[i] === ')') depth += 1;
    else if (head[i] === '(') {
      depth -= 1;
      if (depth === 0) {
        const word = trailingIdentifier(head.slice(0, i));
        return word ? !BLOCK_KEYWORDS.has(word) : false;
      }
    }
  }
  return false;
}

/**
 * 取处理器自己这层返回的对象字面量（不含 .map/.forEach 等回调里的返回）。
 * 回调里的 `return { ok: false }` 是内部数据，不属于「这一步的结论」。
 */
function handlerLevelObjectReturns(body) {
  const code = stripLiterals(body);
  const stack = [];
  const out = [];
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === '{') {
      stack.push(opensFunctionBody(code, i) ? 'fn' : 'block');
      continue;
    }
    if (ch === '}') {
      stack.pop();
      continue;
    }
    if (!code.startsWith('return', i) || /[\w$]/.test(code[i - 1] || '')) continue;
    const rest = code.slice(i + 6).trimStart();
    // 只认 `return {` 这种直接返回字面量。`return cond ? 'a' : 'b'` 之类不是对象返回，
    // 以前把三元当对象返回，`indexOf('{')` 抓到的是后面语句的花括号 —— 报了一批假红。
    if (!rest.startsWith('{')) continue;
    // 当前处在回调/嵌套函数里 → 不是处理器自己的结论
    if (stack.includes('fn')) continue;
    out.push({ index: i, objectStart: code.indexOf('{', i + 6) });
  }
  return out;
}

function objectTextAt(code, start) {
  let depth = 0;
  for (let i = start; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(start, i + 1);
    }
  }
  return null;
}

function collectObjectReturns() {
  const rows = [];
  for (const file of HANDLER_FILES) {
    const text = readFileSync(file, 'utf8');
    for (const name of NAMES) {
      const hit = bodyOf(text, name);
      if (!hit) continue;
      const code = stripLiterals(hit.body);
      const baseLine = text.slice(0, hit.offset).split('\n').length;
      for (const ret of handlerLevelObjectReturns(hit.body)) {
        const objectText = ret.objectStart === undefined ? null : objectTextAt(code, ret.objectStart);
        rows.push({
          file: file.slice(SRC.length + 1),
          name,
          line: baseLine + code.slice(0, ret.index).split('\n').length - 1,
          hasStatus: Boolean(objectText && /\{\s*status\s*[:,}]/.test(objectText)),
        });
      }
    }
  }
  return rows;
}

describe('处理器返回契约：对象是「结论」的载体，必须自带 status', () => {
  const rows = collectObjectReturns();

  it('巡检本身不能空跑', () => {
    // 实测：284 个处理器、约 348 处自己这层的对象返回。低于这个量级说明扫描器坏了，
    // 否则下面两条断言会在「什么都没扫到」的情况下自动变绿。
    expect(NAMES.size).toBeGreaterThan(200);
    expect(rows.length).toBeGreaterThan(200);
  });

  it('处理器自己这层返回对象时，必须显式写 status', () => {
    const bad = rows
      .filter((r) => !r.hasStatus)
      .map((r) => `${r.file}:${r.line} [${r.name}] return { … } 没写 status`);
    expect(bad, `这些返回值里没写 status —— 引擎只能拿正则猜这一步成不成：\n${bad.join(String.fromCodePoint(10))}`).toEqual([]);
  });
});
