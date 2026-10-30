/**
 * 「外部工具」名单的真值解析器 —— 全仓只此一份判据。
 *
 * 为什么需要：同一个概念在仓库里有 7 份名单、5 个数字，而且**每份都跟自己自洽**：
 *
 *   | 名单                                     | 位置                             | 个数 |
 *   |------------------------------------------|----------------------------------|------|
 *   | 外部安全工具链（真值）                   | .claude/rules/conditional/security-toolchain.md | 33 |
 *   | 「外部工具链：N 个工具（…）」正文清单     | README.md:21                     | 29   |
 *   | 同上（英文）                             | README_EN.md:20                  | 26   |
 *   | 逐工具表（工具/类型/工作流/功能/阻断级别）| README.md:~454                   | 26   |
 *   | 同上（英文）                             | README_EN.md:~236                | 23   |
 *   | 外部工具（按类型，安装清单）              | README.md:~772                   | 28   |
 *   | 同上（英文）                             | README_EN.md:464                 | 25   |
 *
 * 29 与 26 这两行甚至能通过 `check-doc-counts` —— 因为它只比「声明的数字 vs 括号里点了几个名」，
 * **文件跟自己对齐**这件事被当成了「跟真值对齐」。真正的缺口是集合：正文清单里混进了两个
 * 不是安全工具的东西（Stagehand / mythos-agent），又少点了 6 个真工具，还把
 * `env-var-leak`（`actions.js` 与 `review.json` 里的真名）写成了 `env-leak-scanner`。
 *
 * 定义（写进文档、也写在这里，两边必须是同一套）：
 *   外部安全工具链 = security-toolchain.md 表格里 `| **名字** |` 的行数（引擎步骤由
 *                    check-tool-steps.cjs 校验，本文件只管名单）
 *   外部工具（按类型） = README「外部工具（按类型）」表的 Count 列之和（安装清单，
 *                        与安全工具链**不是同一个概念**：它含 act/restic/specify-cli，
 *                        也不含 codeguardian/critiq）
 *
 * 名单比对一律走 `normalize()`：大小写、空格、连字符、下划线不算差异
 * （`Lighthouse CI` / `lighthouse-ci` 是同一个东西），**但不做同义词映射** ——
 * 名字写错就该红，映射表只会把错写合法化。
 */
const fs = require('fs');
const path = require('path');

/** 扫不到东西时的下限。当前真值 33；低于这个数说明解析塌了，结论不可信。 */
const MIN_CANONICAL = 30;

const CANON_REL = path.join('.claude', 'rules', 'conditional', 'security-toolchain.md');

/** 名单名一律走这一个归一化：不区分大小写/空格/连字符/下划线。 */
function normalize(name) {
  return String(name).toLowerCase().replace(/[\s_\-·/]/gu, '');
}

function readText(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf-8');
  } catch {
    return null;
  }
}

/** security-toolchain.md 的工具行（`| **noleak** | npm CLI | … |`）→ 名字数组。 */
function parseCanonical(md) {
  if (typeof md !== 'string') return null;
  const names = [];
  for (const line of md.split(/\r?\n/u)) {
    const hit = /^\|\s*\*\*(.+?)\*\*\s*\|/u.exec(line);
    if (hit) names.push(hit[1].trim());
  }
  return names.length === 0 ? null : names;
}

/** 「**外部安全工具链**：N 个工具（a / b / c）」→ {declared, names}。 */
function parseToolchainBullet(doc, lang) {
  if (typeof doc !== 'string') return null;
  const re = lang === 'en'
    ? /\*\*External security toolchain\*\*: (\d+) tools \(([^)]*)\)/u
    : /\*\*外部安全工具链\*\*：(\d+) 个工具（([^）]*)）/u;
  const hit = re.exec(doc);
  if (!hit) return null;
  const names = hit[2].split('/').map(s => s.trim()).filter(Boolean);
  return { declared: Number(hit[1]), names };
}

/** 逐工具表（工具 | 类型 | 负责工作流 | 功能 | 阻断级别）→ 名字数组。 */
function parseSecurityTable(doc, lang) {
  if (typeof doc !== 'string') return null;
  const lines = doc.split(/\r?\n/u);
  const head = lang === 'en' ? /^\|\s*Tool\s*\|\s*Type\s*\|/u : /^\|\s*工具\s*\|\s*类型\s*\|/u;
  const start = lines.findIndex(line => head.test(line));
  if (start < 0) return null;
  const names = [];
  for (let i = start + 1; i < lines.length && lines[i].startsWith('|'); i += 1) {
    const line = lines[i];
    if (/^\|[\s|:-]+$/u.test(line)) continue;
    const cell = (line.split('|')[1] || '').replaceAll('**', '').trim();
    if (cell) names.push(cell);
  }
  return names.length === 0 ? null : names;
}

/**
 * 「外部工具（按类型）」表 → {declared, sum, rows:[{count, names}]}。
 * 这是**安装清单**，跟安全工具链不是同一个概念，只自查内部算术 + 中英两版是否同一批东西。
 */
function parseByTypeTable(doc, lang) {
  if (typeof doc !== 'string') return null;
  const lines = doc.split(/\r?\n/u);
  const head = lang === 'en'
    ? /^###\s+External Tools \((\d+), by type\)/u
    : /^###\s+外部工具（(\d+) 个，按类型）/u;
  const at = lines.findIndex(line => head.test(line));
  if (at < 0) return null;
  const declared = Number(head.exec(lines[at])[1]);
  const rows = [];
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('### ') || line.startsWith('---')) break;
    if (!line.startsWith('|') || /^\|[\s|:-]+$/u.test(line) || /^\|\s*(?:类型|Type)\s*\|/u.test(line)) continue;
    const cells = line.split('|');
    const count = Number.parseInt(cells[2], 10);
    const toolCell = (cells[3] || '').replace(/（[^）]*）/gu, '').replace(/\([^)]*\)/gu, '');
    const names = [...toolCell.matchAll(/`([^`]+)`/gu)].map(m => m[1].trim()).filter(Boolean);
    if (Number.isFinite(count)) rows.push({ count, names });
  }
  if (rows.length === 0) return null;
  return { declared, sum: rows.reduce((acc, row) => acc + row.count, 0), rows };
}

/** 用 normalize 比对两份名单。 */
function compareNames(canonical, names) {
  const have = new Set(names.map(normalize));
  const want = new Set(canonical.map(normalize));
  const missing = canonical.filter(n => !have.has(normalize(n)));
  // 多出来的名字去重：同一个错名点两次是同一件事，报两遍只是噪音
  const extra = [...new Set(names.filter(n => !want.has(normalize(n))))];
  const dupes = [...new Set(names.filter((n, i) => names.findIndex(m => normalize(m) === normalize(n)) !== i))];
  return { missing, extra, dupes };
}

/** 把仓库里所有名单读出来（解析失败 = null，交给调用方判「塌面」）。 */
function collectLists(root) {
  const canonText = readText(root, CANON_REL);
  const zhDoc = readText(root, 'README.md');
  const enDoc = readText(root, 'README_EN.md');
  return {
    canonical: parseCanonical(canonText),
    lists: [
      { id: 'readme-bullet', label: 'README.md 正文清单（外部安全工具链）', ...(parseToolchainBullet(zhDoc, 'zh') || {}) },
      { id: 'readme-en-bullet', label: 'README_EN.md 正文清单', ...(parseToolchainBullet(enDoc, 'en') || {}) },
      { id: 'readme-table', label: 'README.md 逐工具表', names: parseSecurityTable(zhDoc, 'zh') },
      { id: 'readme-en-table', label: 'README_EN.md 逐工具表', names: parseSecurityTable(enDoc, 'en') },
    ],
    byType: {
      zh: parseByTypeTable(zhDoc, 'zh'),
      en: parseByTypeTable(enDoc, 'en'),
    },
  };
}

/**
 * 跑完整判据。
 * @returns {{code: 0|1|2, problems: string[], facts: string[]}}
 *   0 = 全部对得上；1 = 有名单跟真值对不上；2 = 扫描面塌了（读不到文档 / 名单没认出来 / 数量少得离谱）
 */
function checkRoot(root) {
  const problems = [];
  const facts = [];
  const { canonical, lists, byType } = collectLists(root);

  if (!canonical) {
    return { code: 2, problems: [`真值读不到：${CANON_REL} 里没有「| **工具名** |」行`], facts };
  }
  if (canonical.length < MIN_CANONICAL) {
    return {
      code: 2,
      problems: [`真值只有 ${canonical.length} 个工具（下限 ${MIN_CANONICAL}），扫描面塌了，结论不可信`],
      facts,
    };
  }
  facts.push(`真值（security-toolchain.md）: ${canonical.length} 个工具`);

  for (const list of lists) {
    if (!list.names) {
      return { code: 2, problems: [...problems, `${list.label}：名单没认出来（标题或表格格式变了？）`], facts };
    }
    const { missing, extra, dupes } = compareNames(canonical, list.names);
    if (list.declared !== undefined && list.declared !== list.names.length) {
      problems.push(`${list.label}：写「${list.declared} 个」，实际点名 ${list.names.length} 个`);
    }
    if (missing.length > 0) problems.push(`${list.label}：真值里有、这里没有 —— ${missing.join(', ')}`);
    if (extra.length > 0) problems.push(`${list.label}：真值里没有，这里写了 —— ${extra.join(', ')}`);
    if (dupes.length > 0) problems.push(`${list.label}：重复点名 —— ${dupes.join(', ')}`);
    facts.push(`${list.label}: ${list.names.length} 个`);
  }

  for (const [lang, table] of Object.entries(byType)) {
    if (!table) {
      return { code: 2, problems: [...problems, `外部工具（按类型，${lang}）：表格没认出来`], facts };
    }
    if (table.declared !== table.sum) {
      problems.push(`外部工具（按类型，${lang}）：标题写「${table.declared} 个」，Count 列加起来 ${table.sum}`);
    }
    for (const [i, row] of table.rows.entries()) {
      if (row.count !== row.names.length) {
        problems.push(`外部工具（按类型，${lang}）第 ${i + 1} 行：Count 写 ${row.count}，列了 ${row.names.length} 个（${row.names.join(' / ')}）`);
      }
    }
    facts.push(`外部工具（按类型，${lang}）: ${table.sum} 个`);
  }

  if (byType.zh && byType.en) {
    const zhNames = byType.zh.rows.flatMap(row => row.names);
    const enNames = byType.en.rows.flatMap(row => row.names);
    const { missing, extra } = compareNames(zhNames, enNames);
    if (missing.length > 0) problems.push(`外部工具（按类型）：中文版有、英文版没有 —— ${missing.join(', ')}`);
    if (extra.length > 0) problems.push(`外部工具（按类型）：英文版有、中文版没有 —— ${extra.join(', ')}`);
  }

  return { code: problems.length === 0 ? 0 : 1, problems, facts };
}

module.exports = {
  MIN_CANONICAL,
  CANON_REL,
  normalize,
  parseCanonical,
  parseToolchainBullet,
  parseSecurityTable,
  parseByTypeTable,
  compareNames,
  collectLists,
  checkRoot,
};
