import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/**
 * 「外部工具」名单一致性。
 *
 * 改前实测（同一个概念，7 份名单 / 5 个数字，而且**每份都跟自己自洽**）：
 *
 *   真值 security-toolchain.md 33 ｜ README 正文 29 ｜ README_EN 正文 26
 *   README 逐工具表 26 ｜ README_EN 逐工具表 23 ｜ README 按类型 28 ｜ README_EN 按类型 25
 *
 * 其中 29 与 26 这两行能通过 `check-doc-counts`，因为它只比「声明的数字 vs 括号里点了几个名」——
 * **文件跟自己对齐**被当成了「跟真值对齐」。缺口全在集合上：
 *   · 正文清单混进两个不是安全工具的东西（Stagehand / mythos-agent）
 *   · 少点 6 个真工具（jscpd / size-limit / Stryker / Spectral / markdownlint / codeguardian）
 *   · `env-var-leak`（`actions.js:347`、`review.json:382` 里的真名）被写成 `env-leak-scanner`，
 *     而同一份 README 的步骤清单里又是 `env-var-leak` —— 自己跟自己都对不上
 *
 * 现在判据只有一处（`scripts/lib/toolchain.cjs`），本文件既测它的解析/比对，也守真仓库的漂移。
 * 注意：夹具里的假工具名一律 `t0…t30`（31 个），是为了跨过 `MIN_CANONICAL = 30` 的下限 ——
 * 否则「扫描面塌了」和「名单对不上」两种结论分不开。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const require = createRequire(import.meta.url);
const { checkRoot, compareNames, normalize, parseToolchainBullet, MIN_CANONICAL } = require(
  join(ROOT, 'scripts', 'lib', 'toolchain.cjs'),
);

const N = MIN_CANONICAL + 1;

function tools(count) {
  return Array.from({ length: count }, (_, i) => `t${i}`);
}

function canonDoc(names) {
  const rows = names.map(n => `| **${n}** | npm CLI | 未接入 | 说明 ${n} |`);
  return ['# 外部安全工具链', '', '| 工具 | 类型 | 负责工作流 | 功能 |', '|---|---|---|---|', ...rows, ''].join('\n');
}

function zhDoc(names, declared = names.length) {
  const list = names.join(' / ');
  const rows = names.map(n => `| **${n}** | npm CLI | 未接入 | 说明 ${n} | — |`);
  return [
    `- ✅ **外部安全工具链**：${declared} 个工具（${list}）— 说明`,
    '',
    '## 🛡️ 外部安全工具链',
    '',
    '| 工具 | 类型 | 负责工作流 | 功能 | 阻断级别 |',
    '|------|------|-----------|------|---------|',
    ...rows,
    '',
    `### 外部工具（${names.length} 个，按类型）`,
    '',
    '| 类型 | 数量 | 工具 | 安装方式 |',
    '|------|------|------|---------|',
    `| **npm** | ${names.length} | ${names.map(n => `\`${n}\``).join('、')} | npm install |`,
    '',
  ].join('\n');
}

function enDoc(names, declared = names.length) {
  const list = names.join(' / ');
  const rows = names.map(n => `| **${n}** | npm CLI | Not wired | Function ${n} | — |`);
  return [
    `- ✅ **External security toolchain**: ${declared} tools (${list}) — notes`,
    '',
    '## 🛡️ External Security Toolchain',
    '',
    '| Tool | Type | Workflows | Function | Severity |',
    '|------|------|-----------|----------|----------|',
    ...rows,
    '',
    `### External Tools (${names.length}, by type)`,
    '',
    '| Type | Count | Tools | Install |',
    '|------|-------|-------|---------|',
    `| **npm** | ${names.length} | ${names.map(n => `\`${n}\``).join(', ')} | npm install |`,
    '',
  ].join('\n');
}

function scaffold({ canon, zh, en }) {
  const root = mkdtempSync(join(tmpdir(), 'toolchain-'));
  if (canon !== null) {
    mkdirSync(join(root, '.claude', 'rules', 'conditional'), { recursive: true });
    writeFileSync(join(root, '.claude', 'rules', 'conditional', 'security-toolchain.md'), canon);
  }
  if (zh !== null) writeFileSync(join(root, 'README.md'), zh);
  if (en !== null) writeFileSync(join(root, 'README_EN.md'), en);
  return root;
}

/** 完整一致的夹具（对照组：红必须红在改动处，不能红在别处）。 */
function good() {
  const names = tools(N);
  return { canon: canonDoc(names), zh: zhDoc(names), en: enDoc(names) };
}

function problemsOf(result) {
  return result.problems.join('\n');
}

describe('外部工具名单：真仓库守卫', () => {
  it('7 份名单全部与真值一致（正文清单 / 逐工具表 / 按类型表 × 中英）', () => {
    const result = checkRoot(ROOT);
    expect(result.problems).toStrictEqual([]);
    expect(result.code).toBe(0);
  });

  it('真值不是空跑：至少 30 个工具，4 个名单都解析出了名字', () => {
    const result = checkRoot(ROOT);
    // 防空跑：下限断言保护的是「这次真的读到了东西」
    expect(result.facts.length).toBeGreaterThanOrEqual(6);
    // facts[0] = 「真值（security-toolchain.md）: 33 个工具」，只有一个数字
    expect(Number.parseInt(String(result.facts[0]).match(/\d+/u)[0], 10)).toBeGreaterThanOrEqual(MIN_CANONICAL);
  });

  it('正文清单里不许再出现那两个「不是安全工具」的增强探测器名', () => {
    const zh = require('node:fs').readFileSync(join(ROOT, 'README.md'), 'utf-8');
    const bullet = parseToolchainBullet(zh, 'zh');
    expect(bullet.declared).toBe(33);
    expect(bullet.names).not.toContain('Stagehand');
    expect(bullet.names).not.toContain('mythos-agent');
  });

  it('工具名只用引擎里的真名：env-var-leak（不是 env-leak-scanner）', () => {
    const actions = require('node:fs').readFileSync(join(ROOT, 'claude-scene', 'src', 'actions.js'), 'utf-8');
    expect(actions).toContain("'env-var-leak'");
    const zh = require('node:fs').readFileSync(join(ROOT, 'README.md'), 'utf-8');
    expect(zh).not.toContain('env-leak-scanner');
  });
});

describe('外部工具名单：夹具（对照组 + 每种漂移都要红）', () => {
  it('对照组：三份都对齐 → 0', () => {
    const { code } = checkRoot(scaffold(good()));
    expect(code).toBe(0);
  });

  it('正文清单少点一个工具 → 1，且指名道姓', () => {
    const fixture = good();
    const names = tools(N).slice(1);
    const result = checkRoot(scaffold({ ...fixture, zh: zhDoc(names) }));
    expect(result.code).toBe(1);
    expect(problemsOf(result)).toContain('README.md 正文清单（外部安全工具链）：真值里有、这里没有 —— t0');
  });

  it('工具名写错（env-leak-scanner 式）→ 1，既报多也报少', () => {
    const names = [...tools(N - 1), 'env-leak-scanner'];
    const fixture = { canon: canonDoc(tools(N)), zh: zhDoc(names), en: enDoc(tools(N)) };
    const result = checkRoot(scaffold(fixture));
    expect(result.code).toBe(1);
    expect(problemsOf(result)).toContain('真值里没有，这里写了 —— env-leak-scanner');
    expect(problemsOf(result)).toContain('真值里有、这里没有 —— t30');
  });

  it('声明的数字跟点名数不一致 → 1（老 checker 唯一会红的路径）', () => {
    const names = tools(N);
    const fixture = { canon: canonDoc(names), zh: zhDoc(names, N - 1), en: enDoc(names) };
    const result = checkRoot(scaffold(fixture));
    expect(result.code).toBe(1);
    expect(problemsOf(result)).toContain(`写「${N - 1} 个」，实际点名 ${N} 个`);
  });

  it('逐工具表漏行 → 1（表跟正文各说各话）', () => {
    const names = tools(N);
    const zh = zhDoc(names).replace(`| **t0** | npm CLI | 未接入 | 说明 t0 | — |\n`, '');
    const result = checkRoot(scaffold({ canon: canonDoc(names), zh, en: enDoc(names) }));
    expect(result.code).toBe(1);
    expect(problemsOf(result)).toContain('README.md 逐工具表：真值里有、这里没有 —— t0');
  });

  it('同一名单重复点名 → 1', () => {
    const names = [...tools(N - 1), 't0'];
    const fixture = { canon: canonDoc(tools(N)), zh: zhDoc(names), en: enDoc(tools(N)) };
    const result = checkRoot(scaffold(fixture));
    expect(result.code).toBe(1);
    expect(problemsOf(result)).toContain('重复点名 —— t0');
  });

  it('按类型表 Count 跟列出的名字数不符 → 1', () => {
    const names = tools(N);
    const zh = zhDoc(names).replace(`| **npm** | ${N} |`, `| **npm** | ${N + 1} |`)
      .replace(`### 外部工具（${N} 个，按类型）`, `### 外部工具（${N + 1} 个，按类型）`);
    const result = checkRoot(scaffold({ canon: canonDoc(names), zh, en: enDoc(names) }));
    expect(result.code).toBe(1);
    expect(problemsOf(result)).toContain('Count 写');
  });

  it('中英按类型表不是同一批东西 → 1', () => {
    const names = tools(N);
    const en = enDoc(names).replace(`\`t0\`,` , '`zzz`,');
    const result = checkRoot(scaffold({ canon: canonDoc(names), zh: zhDoc(names), en }));
    expect(result.code).toBe(1);
    expect(problemsOf(result)).toContain('英文版有、中文版没有 —— zzz');
  });

  it('真值少于下限 → 2（宁可说「结论不可信」，也不假装对得上）', () => {
    const names = tools(MIN_CANONICAL - 1);
    const result = checkRoot(scaffold({ canon: canonDoc(names), zh: zhDoc(names), en: enDoc(names) }));
    expect(result.code).toBe(2);
    expect(problemsOf(result)).toContain('扫描面塌了');
  });

  it('README 读不到 → 2', () => {
    const names = tools(N);
    const result = checkRoot(scaffold({ canon: canonDoc(names), zh: null, en: enDoc(names) }));
    expect(result.code).toBe(2);
    expect(problemsOf(result)).toContain('名单没认出来');
  });

  it('标题格式变了（正文清单认不出来）→ 2，不是 1', () => {
    const names = tools(N);
    const zh = zhDoc(names).replace('**外部安全工具链**：', '**外部工具链**：');
    const result = checkRoot(scaffold({ canon: canonDoc(names), zh, en: enDoc(names) }));
    expect(result.code).toBe(2);
    expect(problemsOf(result)).toContain('README.md 正文清单（外部安全工具链）：名单没认出来');
  });
});

describe('外部工具名单：纯函数', () => {
  it('normalize 只忽略大小写/空格/连字符/下划线，不做同义词映射', () => {
    expect(normalize('Lighthouse CI')).toBe(normalize('lighthouse-ci'));
    expect(normalize('env-var-leak')).toBe(normalize('env_var_leak'));
    // 写错就该报错，映射表只会把错写合法化
    expect(normalize('env-leak-scanner')).not.toBe(normalize('env-var-leak'));
  });

  it('compareNames 三个结论都要给：缺、多、重复', () => {
    const { missing, extra, dupes } = compareNames(['a', 'b', 'c'], ['a', 'd', 'd']);
    expect(missing).toStrictEqual(['b', 'c']);
    expect(extra).toStrictEqual(['d']);
    expect(dupes).toStrictEqual(['d']);
  });
});
