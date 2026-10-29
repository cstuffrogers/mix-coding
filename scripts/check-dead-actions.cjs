/**
 * 场景 → 动作 死引用扫描：scene JSON 里写的 action 必须有实现（注册表 / 场景本地表 / 伪动作 / shell）。
 *
 * 用法：node scripts/check-dead-actions.cjs [root]
 *
 * 退出码（以前恒为 0：扫出 4 条死引用照样「通过」）：
 *   0 = 没有死引用
 *   1 = 有死引用（清单已打印）
 *   2 = 扫描面塌了（场景太少 / 动作引用太少，结论不可信）
 *
 * 判定依据还是「源码里真有这个 key」，但伪动作名单改从 src/data/pseudo-actions.js 读 ——
 * 与引擎自检共用一份。以前两边各写一份字面量，selectModes / selectSetupKind 在 4 个场景里
 * 被报成死引用（假红）；而脚本又没有退出码，于是这个假红也没人看得见（假绿）。
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

// 扫描面塌了的判定下限（当前实际：场景 26 个、动作引用 583 条）。
const MIN_SCENES = 20;
const MIN_REFS = 400;

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

// 动作存在 = 在 actions.js / ui-polish.js 里真有一个 `name:` 键（裸键、单引号、双引号都算）。
function actionExistsIn(src, action) {
  if (!src) return false;
  const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyPattern = '(?:^|[\\s,{])(?:\'' + escaped + '\'|"' + escaped + '"|' + escaped + ')\\s*:';
  return new RegExp(keyPattern, 'm').test(src);
}

async function loadPseudoActions() {
  // Windows 上动态 import 必须走 file:// URL，直接给盘符路径会报 unsupported protocol 'e:'
  const file = pathToFileURL(path.join(ROOT, 'claude-scene/src/data/pseudo-actions.js')).href;
  try {
    const mod = await import(file);
    return mod.PSEUDO_ACTIONS;
  } catch {
    // 读不到名单就不能判定伪动作 —— 这本身是扫描面塌了，不能当作「没有伪动作」继续
    return null;
  }
}

function sceneSteps(scenesDir, file) {
  const scene = JSON.parse(fs.readFileSync(path.join(scenesDir, file), 'utf-8'));
  const flow = scene.flow;
  if (!flow || typeof flow !== 'object') return [];
  return Object.values(flow).filter((step) => step && step.action);
}

async function main() {
  const scenesDir = path.join(ROOT, '.claude/scenes');
  const sceneFiles = fs.existsSync(scenesDir)
    ? fs.readdirSync(scenesDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    : [];
  const actionsSrc = readOrNull(path.join(ROOT, 'claude-scene/src/actions.js'));
  const uiPolishSrc = readOrNull(path.join(ROOT, 'claude-scene/src/handlers/ui-polish.js'));
  const pseudoActions = await loadPseudoActions();

  const actionExists = (action) => {
    if (pseudoActions && pseudoActions.has(action)) return true;
    if (actionExistsIn(actionsSrc, action)) return true;
    if (actionExistsIn(uiPolishSrc, action)) return true;
    // shell 命令（git diff 之类）不是注册表动作
    return action.includes(' ');
  };

  const deadActions = [];
  let totalRefs = 0;
  for (const file of sceneFiles) {
    for (const step of sceneSteps(scenesDir, file)) {
      totalRefs += 1;
      if (!actionExists(step.action)) {
        const desc = (step.description || '').slice(0, 60);
        deadActions.push({ file, action: step.action, desc });
      }
    }
  }

  console.log(`Scenes: ${sceneFiles.length}   Action references: ${totalRefs}`);
  console.log(`Dead references: ${deadActions.length}`);
  for (const d of deadActions) {
    console.log(`  ${d.file}: "${d.action}" — ${d.desc}`);
  }

  // 空跑自检：0 个场景 / 0 条引用时「0 dead」和真干净长得一样。
  const collapsed = [];
  if (!pseudoActions) collapsed.push('伪动作表读不到（claude-scene/src/data/pseudo-actions.js）');
  if (sceneFiles.length < MIN_SCENES) collapsed.push(`场景 ${sceneFiles.length} 个（下限 ${MIN_SCENES}）`);
  if (totalRefs < MIN_REFS) collapsed.push(`动作引用 ${totalRefs} 条（下限 ${MIN_REFS}）`);
  if (collapsed.length > 0) {
    console.error(`❌ 扫描面塌了：${collapsed.join(' / ')} —— 这个 ${deadActions.length} dead 不可信，先查路径`);
    process.exit(2);
  }

  if (deadActions.length > 0) {
    console.error(`❌ ${deadActions.length} 条死引用 —— 补实现或改场景`);
    process.exit(1);
  }
  console.log('OK: 每个场景动作都有实现');
}

main().catch((error) => {
  console.error(`❌ 扫描失败：${error && error.message ? error.message : error}`);
  process.exit(2);
});
