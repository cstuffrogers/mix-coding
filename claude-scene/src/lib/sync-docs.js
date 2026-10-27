import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from "path";
import { loadScenes, generateWorkflowTable, generateSkipEnhancementList, generateSceneTable } from './doc-generators.js';

// ── File syncer ─────────────────────────────────────────────────

/**
 * 行尾归一化：仓库里 .claude/scenes/README.md 是 CRLF，其余多是 LF。
 * 旧实现拿 LF 去匹配 CRLF 文件，标记明明在也被报成 missing-marker ——
 * 「同步不了」和「没标记」混成一件事，人只会去加一层本来就有的标记。
 */
function normalizeEol(content) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  return { lf: content.split('\r\n').join('\n'), eol };
}

function restoreEol(content, eol) {
  return eol === '\n' ? content : content.split('\n').join(eol);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markerRegex(sectionName) {
  const startTag = `<!-- AUTO-SYNC:${sectionName}-START -->`;
  const endTag = `<!-- AUTO-SYNC:${sectionName}-END -->`;
  return {
    startTag,
    endTag,
    re: new RegExp(`${escapeRegExp(startTag)}\\n[\\s\\S]*?\\n${escapeRegExp(endTag)}`),
  };
}

function syncSection(filePath, sectionName, newContent) {
  if (!existsSync(filePath)) return 'missing-file';

  const raw = readFileSync(filePath, 'utf-8');
  const { lf, eol } = normalizeEol(raw);
  const { startTag, endTag, re } = markerRegex(sectionName);
  if (!re.test(lf)) return 'missing-marker';

  const replacement = `${startTag}\n${newContent}\n${endTag}`;
  const next = lf.replace(re, replacement);
  if (next === lf) return 'unchanged';
  writeFileSync(filePath, restoreEol(next, eol), 'utf-8');
  return 'updated';
}

function updateSceneCounts(filePath, count) {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, 'utf-8');
  // 以前这里有一条「第一个数字已经等于 count 就早退」的优化：正文里写着 26 个场景
  // 就直接 return，于是同一份文件里其他地方（目录锚点 #25-个场景…）的旧数字
  // 永远修不了 —— 数字看着对了，链接却是断的。现在一律重算，没变化才早退。
  const next = content
    .replace(/(\d{1,5})( 个场景)/g, `${count}$2`)
    .replace(/（\d{1,5} 个 \.md）/g, `（${count} 个 .md）`)
    // 目录锚点里是 `#25-个场景…`（连字符不是空格），上面那条正则碰不到它。
    .replace(/#\d{1,5}-个场景/g, `#${count}-个场景`);
  if (next === content) return [];
  writeFileSync(filePath, next, 'utf-8');
  return [`${filePath.split(String.fromCodePoint(92)).slice(-1)[0]}#场景计数`];
}

// ── Main entry ──────────────────────────────────────────────────

export function syncAllDocs(projectRoot) {
  const scenesDir = join(projectRoot, '.claude', 'scenes');

  // 以前这里把每个 syncSection 的返回值直接丢掉、自己也不返回任何东西，
  // CLI 跑完一个字都不打印 —— 「同步了什么」和「什么都没干」长得一模一样。
  const report = { updated: [], unchanged: [], missingMarker: [], missingFile: [], manual: [] };
  const rel = (file) => file.replace(projectRoot, '').split(String.fromCodePoint(92)).join('/');
  const BUCKETS = {
    updated: 'updated',
    unchanged: 'unchanged',
    'missing-marker': 'missingMarker',
    'missing-file': 'missingFile',
  };
  const run = (file, section, content, status) => {
    const result = status || syncSection(file, section, content);
    report[BUCKETS[result]].push(`${rel(file)}#${section}`);
  };

  // 有些区块故意不托管：CLAUDE.md 的工作流速查是人写的两列表格，生成的表格格式
  // 不同，自动改写等于把人排的版推翻。没有标记 → manual（不算缺失）；有人加上
  // AUTO-SYNC 标记 → 自动接管。
  const manualRun = (file, section, content) => {
    const result = syncSection(file, section, content);
    if (result === 'missing-marker') {
      report.manual.push(`${rel(file)}#${section}`);
      return;
    }
    run(file, section, content, result);
  };

  if (!existsSync(scenesDir)) {
    report.missingFile.push('.claude/scenes');
    return report;
  }

  const scenes = loadScenes(scenesDir);

  // 1~2. CLAUDE.md 的两个区块：人工托管（共享文档，不自动覆写人的排版）
  manualRun(join(projectRoot, 'CLAUDE.md'), 'WORKFLOW-TABLE', generateWorkflowTable(scenes));
  const skipLists = generateSkipEnhancementList(scenes);
  manualRun(
    join(projectRoot, 'CLAUDE.md'),
    'SKIP-ENHANCEMENT-LIST',
    `${skipLists.line1}\n${skipLists.line2}`,
  );
  // 3. 原先还同步 .claude/rules/workflows.md（命令表/跳过清单/触发段），但那个文件早就
  //    不存在了 —— 三个目标永远进 missingFile，等于每次同步都在报假警。删掉，别留僵尸。

  // 4. scenes/README.md — scene table
  run(join(projectRoot, '.claude', 'scenes', 'README.md'), 'SCENE-TABLE', generateSceneTable(scenes));

  // 5. 场景计数
  report.updated.push(...updateSceneCounts(join(projectRoot, '.claude', 'scenes', 'README.md'), scenes.length));
  report.updated.push(...updateSceneCounts(join(projectRoot, 'docs', 'tools-inventory.md'), scenes.length));

  return report;
}
