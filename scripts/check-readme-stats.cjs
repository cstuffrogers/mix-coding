#!/usr/bin/env node
/**
 * README 的场景数与步骤数必须和 `claude-scene/scenes/*.json` 对得上。
 *
 * 用法：node scripts/check-readme-stats.cjs [repoRoot]
 *
 * 退出码：
 *   0 = 两份 README 一致
 *   1 = 有不一致（多余行 / 漏列 / 步骤数不符 / 标题数字不符）
 *   2 = 扫描面塌了（没读到场景，或表格行数 < 20）—— 这时的「0 处不一致」不可信
 *
 * ── 为什么要有这个脚本 ──
 * 上一版是 `scripts/fix-readme-en.cjs`：114 行「34 → 35」「60 → 69」式的历史补丁，
 * 头一句写着「基于 scripts/scenes-stats.json 真实数据」，可它读进来的 `stats`
 * 一次都没用 —— 数字全是硬编码，而且锚点早就被自己改没了，重跑等于空转。
 * 更糟的是它自带「验证」：只验证自己那套硬编码数字。这就是打印「All step counts
 * verified」而 README 里躺着 3 个根本不存在的场景（hunt / e2e / monitor）的原因。
 *
 * 所以这里只做一件事：把真值和文档摊开对比。数字不对就红，不比就红不了。
 * 步骤数的定义只有一个 —— scene JSON 里 `flow` 的键数（引擎实际会遍历的步骤）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const SCENES_DIR = path.join(ROOT, 'claude-scene', 'scenes');
const MIN_SCENES = 20;
const MIN_ROWS = 20;

/** 文档里允许「不计步骤」的行（都不是引擎场景）。 */
const NON_SCENE_ROWS = new Set();

/**
 * 表格行数的塌面下限：绝对下限 MIN_ROWS，但不得高于真值的 80%。
 * 否则真值本身只有 20 个场景时，「漏列 2 行」会被当成「表格格式变了」——
 * 两种病要分开报：漏列是 exit 1（文档错了），认不出行才是 exit 2（脚本失效）。
 */
function rowFloor(truthSize) {
  return Math.min(MIN_ROWS, Math.floor(truthSize * 0.8));
}

/** 真值：slug → flow 键数。键用文件名，和 README 表格、命令名同一套标识。 */
function readTruth() {
  if (!fs.existsSync(SCENES_DIR)) return new Map();
  const truth = new Map();
  for (const file of fs.readdirSync(SCENES_DIR).filter((f) => f.endsWith('.json'))) {
    const scene = JSON.parse(fs.readFileSync(path.join(SCENES_DIR, file), 'utf-8'));
    const flow = scene.flow;
    if (!flow || typeof flow !== 'object') continue;
    truth.set(file.replace('.json', ''), Array.isArray(flow) ? flow.length : Object.keys(flow).length);
  }
  return truth;
}

/**
 * 文档格式差异：
 *   中文 README  `| **review** | 43 步 | …`  标题 `## 📋 26 个工作流场景`
 *   英文 README  `| **review** | 43 | …`      标题 `## 📋 26 Workflow Scenes (583 Steps Total)`
 */
const DOCS = [
  {
    file: 'README.md',
    label: '中文',
    heading: /^##\s*📋\s*(\d+)\s*个工作流场景\s*$/m,
    // 行为「**slug** | 12 步 |」或「**slug** | — |」；结尾的竖线不参与匹配 ——
    // 「— 步」这类写法也得认出来，否则会把它误报成「漏列」。
    row: /^\|\s*\*\*([\w-]+)\*\*\s*\|\s*(\d+\s*步|—|-)/gm,
    stepOf: (raw) => (/\d/.test(raw) ? Number.parseInt(raw, 10) : null),
  },
  {
    file: 'README_EN.md',
    label: '英文',
    heading: /^##\s*📋\s*(\d+)\s*Workflow Scenes\s*(?:\((\d+)\s*Steps Total\))?\s*$/m,
    row: /^\|\s*\*\*([\w-]+)\*\*\s*\|\s*(\d+|—|-)/gm,
    stepOf: (raw) => (/\d/.test(raw) ? Number.parseInt(raw, 10) : null),
  },
];

function checkDoc(doc, truth) {
  const file = path.join(ROOT, doc.file);
  if (!fs.existsSync(file)) return { problems: [`${doc.file} 不存在`], rows: 0 };
  const txt = fs.readFileSync(file, 'utf-8');
  const problems = [];

  const rows = [];
  for (const m of txt.matchAll(doc.row)) rows.push({ slug: m[1], step: doc.stepOf(m[2]), raw: m[2].trim() });

  const listed = new Map(rows.map((r) => [r.slug, r]));
  const total = [...truth.values()].reduce((sum, n) => sum + n, 0);

  const heading = doc.heading.exec(txt);
  if (!heading) {
    problems.push('找不到「## 📋 N (个)Workflow Scenes」标题 —— 没法核对场景总数');
  } else {
    const declared = Number.parseInt(heading[1], 10);
    if (declared !== truth.size) problems.push(`标题写 ${declared} 个场景，实际 ${truth.size} 个`);
    if (heading[2] !== undefined && Number.parseInt(heading[2], 10) !== total) {
      problems.push(`标题写 ${heading[2]} 步，实际 ${total} 步`);
    }
  }

  for (const row of rows) {
    if (NON_SCENE_ROWS.has(row.slug)) continue;
    if (!truth.has(row.slug)) {
      problems.push(`幽灵行：\`${row.slug}\` 没有对应的场景文件（也没有命令入口）`);
      continue;
    }
    if (row.step === null) {
      problems.push(`\`${row.slug}\` 没写步骤数（实际 ${truth.get(row.slug)}）`);
    } else if (row.step !== truth.get(row.slug)) {
      problems.push(`\`${row.slug}\` 步骤数写 ${row.step}，实际 ${truth.get(row.slug)}`);
    }
  }

  const missing = [...truth.keys()].filter((slug) => !listed.has(slug)).sort();
  if (missing.length > 0) problems.push(`漏列 ${missing.length} 个场景：${missing.join(', ')}`);

  return { problems, rows: rows.length };
}

function main() {
  const truth = readTruth();
  let exitCode = 0;

  if (truth.size < MIN_SCENES) {
    console.error(`❌ 只读到 ${truth.size} 个场景（下限 ${MIN_SCENES}）—— 这个「0 处不一致」不可信`);
    process.exit(2);
  }

  const total = [...truth.values()].reduce((sum, n) => sum + n, 0);
  console.log(`真值：${truth.size} 个场景 / ${total} 步（claude-scene/scenes/*.json 的 flow 键数）`);

  for (const doc of DOCS) {
    const { problems, rows } = checkDoc(doc, truth);
    const floor = rowFloor(truth.size);
    if (rows < floor) {
      console.error(`❌ ${doc.file}：只认出 ${rows} 行场景（下限 ${floor}）—— 表格格式变了，核对结果不可信`);
      exitCode = 2;
      continue;
    }
    if (problems.length === 0) {
      console.log(`✅ ${doc.file}（${doc.label}）：${rows} 行全部对得上`);
      continue;
    }
    exitCode = exitCode === 2 ? 2 : 1;
    console.error(`❌ ${doc.file}（${doc.label}）：${problems.length} 处对不上`);
    for (const p of problems) console.error(`   · ${p}`);
  }

  process.exit(exitCode);
}

main();
