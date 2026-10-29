#!/usr/bin/env node
/**
 * check-tool-steps.cjs — 校验 README 外部工具表「负责工作流」列的每个 step 数是不是真的
 *
 * 背景（第 27 轮实测）：这张表长期写着 `/review` (step 4.10) / (step 4.12) / (step 4.15) / (step 3) —
 * 而 `claude-scene/scenes/review.json` 的 `flow` 里根本没有这些 `step` 值；还有整列指向 `/audit`
 * `/hunt` `/e2e` 这些**已经删掉的场景**。文档让 agent 去「看 step 4.15」，比不写更糟：
 * 它会把一段不存在的东西当成既有事实。
 *
 * 三条判据：
 *   ① 表里出现的 `/xxx` 必须是真实存在的 `claude-scene/scenes/xxx.json`（不许指向已退役的场景）；
 *   ② 紧跟在它后面的 `(step N)` 必须是该场景 `flow` 里某个条目的 `step` 值；
 *   ③ 「未接入」这种话不算引用，放行（但整表可核引用太少 → 说明表结构变了，exit 2 而不是假装通过）。
 *
 * 用法：
 *   node scripts/check-tool-steps.cjs                # 校验当前仓库
 *   node scripts/check-tool-steps.cjs <root>         # 校验指定仓库根
 *
 * 退出码：0 = 全对；1 = 有引用指向不存在的场景/步骤；2 = 扫不到东西（表结构变了）
 */
const fs = require('node:fs');
const path = require('node:path');

const RETIRED = new Set(['hunt', 'audit', 'e2e', 'monitor', 'analyze']);
const MIN_ROWS = 15; // 外链工具表至少这么多行，否则就是认错表了
const MIN_REFS = 20; // 全表至少这么多可核引用，否则视为结构漂移
const DOCS = [
  'README.md',
  'README_EN.md',
  '.claude/rules/conditional/security-toolchain.md',
];
const TABLE_HEAD = /^\|\s*\*?\*?(?:工具|Tool)\*?\*?\s*\|/u;

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const problems = [];
const die = (msg) => {
  console.error(`[扫不到东西] ${msg}`);
  process.exit(2);
};

if (!fs.existsSync(path.join(root, 'claude-scene', 'scenes'))) die(`没有 claude-scene/scenes：${root}`);

/** 场景 → 该场景 flow 里所有 step 值（字符串形态，便于精确比较） */
function loadSceneSteps() {
  const dir = path.join(root, 'claude-scene', 'scenes');
  const map = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
    const flow = parsed.flow || {};
    map.set(name.replace(/\.json$/u, ''), new Set(Object.values(flow).map((s) => String(s.step))));
  }
  return map;
}

/** 从「负责工作流」单元格里抽出所有 `/scene` + 紧随其后的 `(step N)` */
function refsInCell(cell) {
  const refs = [];
  const re = /`\/([a-z][a-z0-9-]*)`(?:\s*\(step\s*([0-9.]+)\))?/gu;
  for (const m of cell.matchAll(re)) refs.push({ scene: m[1], step: m[2] || null });
  return refs;
}

const sceneSteps = loadSceneSteps();
let rows = 0;
let checked = 0;

for (const doc of DOCS) {
  const file = path.join(root, doc);
  if (!fs.existsSync(file)) die(`读不到 ${doc}`);
  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/u);
  let inTable = false;
  lines.forEach((line, i) => {
    if (TABLE_HEAD.test(line)) {
      inTable = true;
      return;
    }
    if (!inTable) return;
    if (!line.startsWith('|')) {
      inTable = false;
      return;
    }
    const cells = line.split('|');
    if (cells.length < 6) return;
    const cell = cells[3] || '';
    if (!/`\//u.test(cell)) return; // 分隔行 / 表头行
    rows += 1;
    const where = `${doc}:${i + 1}`;
    for (const ref of refsInCell(cell)) {
      if (RETIRED.has(ref.scene)) {
        problems.push(`${where} 指向已退役的场景 /${ref.scene}（已并入 /review 或 /setup）`);
        continue;
      }
      if (!sceneSteps.has(ref.scene)) {
        problems.push(`${where} 引用了不存在的场景 /${ref.scene}（没有 claude-scene/scenes/${ref.scene}.json）`);
        continue;
      }
      if (ref.step === null) {
        checked += 1;
        continue;
      }
      const steps = sceneSteps.get(ref.scene);
      if (!steps.has(ref.step)) {
        problems.push(
          `${where} 写了 /${ref.scene} (step ${ref.step})，但该场景没有这个 step（真实值：${[...steps].join(', ')}）`,
        );
        continue;
      }
      checked += 1;
    }
  });
}

if (rows < MIN_ROWS) die(`工具表只认到 ${rows} 行（下限 ${MIN_ROWS}），表结构可能变了`);
if (checked < MIN_REFS) die(`只核到 ${checked} 个「场景/步骤」引用（下限 ${MIN_REFS}），引用格式可能变了`);

if (problems.length > 0) {
  console.error('[FAIL] README 工具表里的「负责工作流」有不存在的场景或步骤：');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const sceneCount = sceneSteps.size;
console.log(`[真值] 工具表 ${rows} 行 · 可核引用 ${checked} 处 · 场景 ${sceneCount} 个（全部对得上）`);
