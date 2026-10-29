import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyOfDefinition, collectSources, findDefinition, parseHandlerMap } from '../lib/param-contract.js';

// 维度：**handler 结论串 vs 状态旗标**。
//
// 引擎判状态的顺序是：显式 `{status}` → `lastStepFailed` → 文案正则启发式。
// 于是「返回一句裸字符串」的失败/未执行路径，状态完全由 `detectHandlerFailure` /
// `NOOP_RES` / `WARN_RES` 那几行正则决定 —— 而这些正则互相救场：
//   · `'npm 包名含非法字符,跳过自动更新(安全阻断)'` → 含「阻断」但被「跳过」救回 → pass
//   · `'Stryker 跳过: 执行失败'`                    → 含「失败」但被「跳过」救回 → noop
//   · `'Git diff 跳过（非 git 仓库）'`              → 记 noop，下游 has_frontend_changes=false 静默跳过
// 两类词（失败 / 没测成）都必须在 handler 里写成显式 status —— 结论由 handler 自己给。
// 这条守卫把「靠文案猜」挡在源码层。

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const FAIL_WORDS = /(失败|阻断|abort|错误|异常)/i;
// 「没测成」：跳过、未安装、未执行、未产生、未找到…… 这些都不是「通过」
const NOT_MEASURED = /(跳过|未执行|未获取|不可用|超时|未安装|未运行|不计为通过|未测量|未生成|未产生|未找到|对话模式|交给.*agent|待 agent|由 agent|需人工)/;
// 内部三态分类器（'fail' | 'skip' | 'pass'）是机器判词，不是给人看的结论，豁免
const MACHINE_VERDICTS = new Set(['pass', 'fail', 'skip', 'warn', 'noop', 'ok']);

const BARE_RETURN = /return\s+(`[^`]*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*;/g;

/** 裸字符串 return 里「状态只能靠正则猜」的那些 */
function bareStatusReturns(body) {
  const found = [];
  for (const match of body.matchAll(BARE_RETURN)) {
    const text = match[1].slice(1, -1).replace(/\\n/g, ' ');
    if (MACHINE_VERDICTS.has(text)) continue;
    if (!FAIL_WORDS.test(text) && !NOT_MEASURED.test(text)) continue;
    found.push(text.slice(0, 110));
  }
  return found;
}

function loadHandlers() {
  const sources = collectSources(SRC_DIR);
  const actionsSrc = readFileSync(join(SRC_DIR, 'actions.js'), 'utf-8');
  const handlers = new Map(parseHandlerMap(actionsSrc));
  return { sources, handlers };
}

function scanViolations() {
  const { sources, handlers } = loadHandlers();
  const violations = [];
  let resolved = 0;
  let literals = 0;
  for (const [action, handler] of handlers) {
    if (!handler) continue;
    const definition = findDefinition(sources, handler);
    if (!definition) continue;
    resolved += 1;
    literals += [...definition.body.matchAll(BARE_RETURN)].length;
    for (const text of bareStatusReturns(definition.body)) {
      violations.push(`${action} → ${handler} (${definition.file}): ${text}`);
    }
  }
  return { violations, resolved, literals };
}

describe('handler 的失败/未执行结论必须写成显式 status', () => {
  const { violations, resolved, literals } = scanViolations();

  it('扫描范围不是空转：handler 与裸字符串 return 都真被扫到了', () => {
    expect(resolved).toBeGreaterThan(60);
    expect(literals).toBeGreaterThan(150);
  });

  it('没有「失败 / 跳过 / 未安装 …」的裸字符串 return', () => {
    expect(violations, `这些 return 没写 status，状态只能靠文案正则猜：\n${violations.join('\n')}`).toEqual([]);
  });
});

describe('判定器本身能失败（不是空转）', () => {
  it('裸字符串写「失败/跳过」→ 点名', () => {
    const body = `
      function handleX(params) {
        if (!params) return '提交跳过: push 被拒';
        if (params.a) return { status: 'fail', message: 'a 失败' };
        return \`扫描失败（未能扫描）: \${err.message}\`;
      }`;
    const hits = bareStatusReturns(body);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toContain('提交跳过');
    expect(hits[1]).toContain('扫描失败');
  });

  it('裸字符串把交接写成「就绪」→ 也点名（交给 agent ≠ 通过）', () => {
    const body = `
      function handleZ() {
        if (a) return '代码审查就绪（对话模式 Skill 调用）';
        if (b) return '视觉验证就绪（对话模式 Playwright 执行）';
        return 'CE Plugin 就绪（对话模式执行）';
      }`;
    const hits = bareStatusReturns(body);
    expect(hits).toHaveLength(3);
    expect(hits[0]).toContain('对话模式');
  });

  it('显式 status / 机器判词 / 普通通过文案 → 都不算', () => {
    const body = `
      function handleY(x) {
        if (x === 1) return { status: 'skip', message: '未安装 semgrep（不是通过）' };
        if (x === 2) return { status: 'fail', message: '失败' };
        if (x === 3) return 'fail';
        if (x === 4) return 'pass';
        return '检查完成: 0 个问题';
      }`;
    expect(bareStatusReturns(body)).toEqual([]);
  });

  it('bodyOfDefinition 只切这一个函数（邻函数的裸文案不算进来）', () => {
    const src = `
      function other() { return '别的函数跳过'; }
      function handleZ(params) { return { status: 'skip', message: params }; }`;
    const start = src.indexOf('function handleZ');
    const body = bodyOfDefinition(src, start);
    expect(body).not.toContain('别的函数跳过');
    expect(body).toContain("status: 'skip'");
    expect(bareStatusReturns(body)).toEqual([]);
  });
});

// ── 维度：warn 不许用来表示「没测」──
//
// `lib/acceptance-check.js` 的 `PASSING_RE = /^(pass|warn)$/`：一个验证步骤只要是
// warn，验收门禁就当作「已经审过」。于是把「验证未执行」写成 warn，等于用状态骗
// 门禁 —— 实测过一个「写文件 + verify」的探针场景：两步都没真执行，退出码 0。
// 「没测」的合法表达是 skip / noop（文案带「不是通过」），warn 只留给
// 「真的跑了、但有发现」这一种含义。
const UNMEASURED_WORDS = /(未测量|没有结论|不是通过|不算通过|未执行|未扫描|未跑成|无法判定|不可判定|没有结果|未获取|扫描范围为空|没有产出)/;

/** `status: 'warn'` 所在的字面量对象的起始 `{` 下标（往前找，越过相邻对象）。 */
function enclosingObjectStart(src, idx) {
  let depth = 0;
  for (let i = idx; i >= 0; i -= 1) {
    if (src[i] === '}') {
      depth += 1;
      continue;
    }
    if (src[i] !== '{') continue;
    if (depth === 0) return i;
    depth -= 1;
  }
  return -1;
}

/** 从 `{` 扫到配对的 `}`（跳过字符串/模板里的花括号）。 */
function objectAt(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') {
      depth += 1;
      continue;
    }
    if (c !== '}') continue;
    depth -= 1;
    if (depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

/** 所有 `status: 'warn'` 站点里文案带「没测」措辞的那些 */
function warnSitesSayingNothingMeasured(sources) {
  const found = [];
  let total = 0;
  for (const { file, src } of sources) {
    for (const match of src.matchAll(/status:\s*'warn'/g)) {
      total += 1;
      const open = enclosingObjectStart(src, match.index);
      if (open < 0) continue;
      const body = objectAt(src, open);
      if (!UNMEASURED_WORDS.test(body)) continue;
      const line = src.slice(0, match.index).split('\n').length;
      found.push(`${file}:${line} ${body.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  }
  return { found, total };
}

describe('warn 不许用来表示「没测」（验收门禁把 warn 当已审阅）', () => {
  const { sources } = loadHandlers();
  const { found, total } = warnSitesSayingNothingMeasured(sources);

  it('扫描范围不是空转：真找到了一大批 warn 站点', () => {
    expect(sources.length).toBeGreaterThan(20);
    expect(total).toBeGreaterThan(60);
  });

  it('warn 文案里没有「未执行 / 未测量 / 不是通过 …」', () => {
    expect(found, `这些 warn 说的是「没测」，应该写成 skip / noop：\n${found.join('\n')}`).toEqual([]);
  });

  it('判定器自己会失败：warn + 「验证未执行」→ 点名', () => {
    const sources = [
      {
        file: 'handlers/synthetic.js',
        src: `
          export function handleA(p) {
            if (p) return { status: 'warn', message: '验证未执行：没有 package.json' };
            return { status: 'warn', message: '审查完成: 3 个问题需要处理' };
          }`,
      },
    ];
    const { found: hits } = warnSitesSayingNothingMeasured(sources);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('验证未执行');
    expect(hits[0]).not.toContain('审查完成');
  });
});
