#!/usr/bin/env node
/**
 * 场景的「运行时视图」的唯一定义（第 28 轮）。
 *
 * 改前实测：仓库里有**两份**同名场景 JSON —— `.claude/scenes/*.json`（项目覆盖层）
 * 与 `claude-scene/scenes/*.json`（随包内置），26 个文件逐字节相同。引擎按
 * `claude-scene/src/lib/paths.js` 的 `getSceneDirs()` / `listSceneIds()` 取
 * 「两层合并、项目覆盖层优先」，所以**真正会跑的是 `.claude/scenes` 那一份**；
 * 而校验脚本各读各的：
 *
 *   check-readme-stats / check-action-stats / check-doc-counts / check-tool-steps → claude-scene/scenes
 *   check-dead-actions / find-deadcode-full / scan-scenes                        → .claude/scenes
 *
 * 于是往 `.claude/scenes/review.json` 里加一步（运行时立刻变成 44 步），
 * `check-readme-stats` 仍然报「583 步…全部对得上」—— 它核的是**永远不会被执行的那份**。
 * 这就是假绿：数字对得上，但它对的不是跑起来的东西。
 *
 * 这里复刻引擎那套合并规则，只有一个来源：显式覆盖 → 项目覆盖层 → 包内置。
 * 少一层 `~/.mix-coding/scenes`：这些脚本核的是**本仓库**的文档，用户级目录不参与。
 */
const fs = require('node:fs');
const path = require('node:path');

/** 目录里至少有一个场景 JSON 才算「这一层有场景」 */
function hasScenes(dir) {
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
}

/**
 * 按优先级从高到低返回「真的有场景」的层。
 * @returns {Array<{ dir: string, tier: string }>}
 */
function sceneTiers(root) {
  const explicit = process.env.MIX_CODING_SCENES_DIR;
  if (explicit) {
    const dir = path.resolve(explicit);
    return hasScenes(dir) ? [{ dir, tier: 'MIX_CODING_SCENES_DIR 指定的目录' }] : [];
  }
  return [
    { dir: path.join(root, '.claude', 'scenes'), tier: '.claude/scenes（项目覆盖层）' },
    { dir: path.join(root, 'claude-scene', 'scenes'), tier: 'claude-scene/scenes（随包内置）' },
  ].filter((t) => hasScenes(t.dir));
}

/**
 * 场景的运行时视图：合并所有层，同名场景只保留优先级最高的那份（引擎行为）。
 *
 * 为什么要合并、而不是「只读覆盖层」：真实项目里的 `.claude/scenes` 只放**要覆盖**的
 * 那几个场景。只读覆盖层会把真值缩小成「这个项目覆盖了几个场景」，校验器就会误报
 * 「扫描面塌了」。
 *
 * @returns {{ scenes: Map<string, { file: string, tier: string }>, dirs: string[], source: string }}
 */
function resolveScenes(root) {
  const tiers = sceneTiers(root);
  const scenes = new Map();
  for (const { dir, tier } of tiers) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const slug = name.replace(/\.json$/u, '');
      if (scenes.has(slug)) continue; // 高层已占位：低层同名副本是死副本
      scenes.set(slug, { file: path.join(dir, name), tier });
    }
  }
  return {
    scenes,
    dirs: tiers.map((t) => t.dir),
    source: tiers.length === 0
      ? '两层都没有场景 JSON'
      : tiers.map((t) => t.tier).join(' + '),
  };
}

module.exports = { sceneTiers, resolveScenes };
