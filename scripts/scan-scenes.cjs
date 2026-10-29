#!/usr/bin/env node
/**
 * 统计所有 scene 的真实步骤数，写成 scripts/scenes-stats.json（键 = 场景文件名 slug，
 * 与 README 表格、命令名同一套标识；下游校验脚本 scripts/check-readme-stats.cjs 直接比对）。
 *
 * 用法：node scripts/scan-scenes.cjs [sceneDir] [outFile]
 *
 * 退出码：
 *   0 = 统计成功并已写盘
 *   1 = 读到坏场景（JSON 解析失败 / 没有 flow）
 *   2 = 结论塌了（场景太少，或某个场景 0 步）—— 这时**不覆盖**已有 stats 文件
 *
 * 以前的两个毛病：
 *   ① 只认 `data.flow.length`。可 flow 早就从数组改成了对象（{ stepId: step }）：
 *      于是每一步都算出 undefined，JSON.stringify 直接把这个字段丢掉 ——
 *      写出来的 stats 里每个场景都「没有 steps 字段」，而屏幕上一片正常。
 *   ② 不管算出来什么都照写。数据坏了也只是安静地把好文件覆盖成坏文件。
 */
const fs = require('fs');
const path = require('path');

const MIN_SCENES = 20;
const SCENES_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', '.claude', 'scenes');
const OUT = process.argv[3] ? path.resolve(process.argv[3]) : path.join(__dirname, 'scenes-stats.json');

/** flow 可能是数组（老格式）也可能是对象（现格式）；不认识的形状返回 null，不猜。 */
function countSteps(flow) {
  if (Array.isArray(flow)) return flow.length;
  if (flow && typeof flow === 'object') return Object.keys(flow).length;
  return null;
}

function readScene(file) {
  const raw = fs.readFileSync(path.join(SCENES_DIR, file), 'utf-8');
  const data = JSON.parse(raw);
  return { data, steps: countSteps(data.flow) };
}

function main() {
  const files = fs.existsSync(SCENES_DIR)
    ? fs.readdirSync(SCENES_DIR).filter((f) => f.endsWith('.json')).sort()
    : [];
  const result = {};
  const broken = [];

  for (const file of files) {
    let scene;
    try {
      scene = readScene(file);
    } catch (error) {
      broken.push(`${file}: ${error && error.message ? error.message : error}`);
      continue;
    }
    const { data, steps } = scene;
    if (steps === null || steps === 0) {
      broken.push(`${file}: 没有可统计的 flow（steps=${steps}）`);
      continue;
    }
    // 键用文件名（slug），不用场景的中文 display name：下游（README 表格、命令名）
    // 认的都是 slug；以前拿 data.name 当键，任何对齐工具都匹配不上，
    // 于是脚本只能把数字硬编码 —— 那才是上一版 fix-readme-en.cjs 的成因。
    const slug = file.replace('.json', '');
    result[slug] = { file, name: data.name || slug, steps, desc: data.description || '' };
  }

  const sorted = Object.entries(result).sort((a, b) => b[1].steps - a[1].steps);
  const totalSteps = sorted.reduce((sum, [, info]) => sum + info.steps, 0);

  console.log('| Scene | Steps | File |');
  console.log('|-------|-------|------|');
  for (const [name, info] of sorted) {
    console.log(`| ${name} | ${info.steps} | ${info.file} |`);
  }
  console.log(`\nTotal scenes: ${files.length}`);
  console.log(`Total steps: ${totalSteps}`);

  if (files.length < MIN_SCENES) {
    console.error(`❌ 只读到 ${files.length} 个场景（下限 ${MIN_SCENES}）—— 不覆盖 ${path.basename(OUT)}`);
    process.exit(2);
  }
  if (broken.length > 0) {
    console.error(`❌ ${broken.length} 个场景读不出步骤数（不许用坏数据覆盖 stats）：`);
    for (const b of broken) console.error(`  ${b}`);
    process.exit(1);
  }

  fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(sorted), null, 2));
  console.log(`已写入 ${path.basename(OUT)}：${sorted.length} 个场景 / ${totalSteps} 步`);
}

main();
