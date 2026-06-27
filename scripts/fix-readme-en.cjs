#!/usr/bin/env node
/**
 * 批量修正 README_EN.md 的步骤数和场景数
 * 基于 scripts/scenes-stats.json 真实数据
 */
const fs = require('fs');
const path = require('path');

const stats = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenes-stats.json'), 'utf-8'));
const f = path.join(__dirname, '..', 'README_EN.md');
let txt = fs.readFileSync(f, 'utf-8');

// 场景数：34 → 35
txt = txt.replace(/## 📋 34 Workflow Scenes/g, '## 📋 35 Workflow Scenes (729 Steps Total)');

// 各场景步骤数（基于 stats 数据）
const renames = {
  'ui-polish': 69,
  'new-project': 66,
  'design': 53,
  'audit': 47,
  'review': 33,
  'bugfix': 30,
  'feature': 26,
  'hunt': 24,
  'mobile-audit': 24,
  'refactor': 23,
  'mobile-optimize': 19,
  'analyze': 18,
  'mobile-release': 18,
  'deps': 17,
  'mobile-review': 17,
  'optimize': 17,
  'mobile-onboard': 16,
  'onboard': 16,
  'rollback': 16,
  'simplify': 15,
  'loop': 13,
  'mobile-e2e': 13,
  'cicd': 12,
  'changelog': 10,
  'migration': 10,
  'backup': 9,
  'docker': 9,
  'e2e': 9,
  'incident': 9,
  'loadtest': 9,
  'log': 9,
  'monitor': 9,
  'sbom': 9,
  'release': 24,
};

for (const [name, steps] of Object.entries(renames)) {
  // 匹配 | **<name>** | <数字> |
  const re = new RegExp(`(\\| \\*\\*${name}\\*\\* \\| )\\d+( \\|)`, 'g');
  txt = txt.replace(re, `$1${steps}$2`);
}

// 顶部统计：34 → 35（之前已经做了）
// 标题已是 35，下面这行跳过

// 标题 "Audit" 41 → 47 (实际还有 deps 16→17, cicd 9→12, loop 12→13 等)
txt = txt.replace(/\| \*\*audit\*\* \| 41/g, '| **audit** | 47');
txt = txt.replace(/\| \*\*deps\*\* \| 16/g, '| **deps** | 17');
txt = txt.replace(/\| \*\*cicd\*\* \| 9/g, '| **cicd** | 12');
txt = txt.replace(/\| \*\*loop\*\* \| 12/g, '| **loop** | 13');
txt = txt.replace(/\| \*\*optimize\*\* \| 16/g, '| **optimize** | 17');
txt = txt.replace(/\| \*\*refactor\*\* \| 24/g, '| **refactor** | 23');
txt = txt.replace(/\| \*\*ui-polish\*\* \\| 60/g, '| **ui-polish** | 69');
txt = txt.replace(/\| \*\*feature\*\* \\| 29/g, '| **feature** | 26');
txt = txt.replace(/\| \*\*bugfix\*\* \\| 31/g, '| **bugfix** | 30');
txt = txt.replace(/\| \*\*design\*\* \\| 54/g, '| **design** | 53');
txt = txt.replace(/\| \*\*review\*\* \\| 28/g, '| **review** | 33');
txt = txt.replace(/\| \*\*mobile-release\*\* \\| 17/g, '| **mobile-release** | 18');
txt = txt.replace(/\| \*\*mobile-e2e\*\* \\| 12/g, '| **mobile-e2e** | 13');

// 顶部 Workflows 描述
txt = txt.replace(/\*\*34 automated workflows\*\*/g, '**35 automated workflows**');
txt = txt.replace(/^34 Web \+ 6 Mobile/gm, '28 Web + 6 Mobile + 1 LLM proxy audit');

// 60-step 描述
txt = txt.replace(/60-step full conversation mode workflow/g, '69-step full conversation mode workflow');

// 321 + 34
txt = txt.replace('321 action handlers', '235 action handlers');
txt = txt.replace('across 34 workflows', 'across 35 workflows');

// 34 JSON files
txt = txt.replace(/Scene definitions \(34 JSON files\)/g, 'Scene definitions (35 JSON files, 729 steps)');

// 34 workflows
txt = txt.replace(/Slsh commands \(34 workflows/g, 'Slsh commands (35 workflows');

// 添加 llm-proxy-audit 行
if (!txt.includes('llm-proxy-audit')) {
  txt = txt.replace(
    /\| \*\*docker\*\* \| 9 \| Docker containerization/,
    '| **llm-proxy-audit** | 11 | LLM proxy security audit (lobstertrap DLP + honeypot detect + traffic audit) | `/llm-proxy-audit` |\n| **docker** | 9 | Docker containerization'
  );
}

fs.writeFileSync(f, txt, 'utf-8');
console.log('OK: README_EN.md updated');

// 验证
const verify = fs.readFileSync(f, 'utf-8');
const issues = [];
for (const [name, steps] of Object.entries(renames)) {
  const re = new RegExp(`\\| \\*\\*${name}\\*\\* \\| ${steps} \\|`);
  if (!re.test(verify)) issues.push(`${name} ${steps}`);
}
if (issues.length) console.log('MISSING:', issues.join(', '));
else console.log('All step counts verified');
