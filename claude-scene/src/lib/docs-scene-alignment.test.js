import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * 文档 ↔ 入口 ↔ 场景 三方对齐。
 *
 * 这类漂移引擎自己发现不了：`/spec` 在 CLAUDE.md 的流程里，但 `.claude/scenes/`
 * 下没有 spec.json —— 它是 Claude Code 的 slash command（`.claude/commands/spec.md`），
 * 不是引擎场景。引擎自检跑再多次也不会红，因为没有任何一处把文档当输入。
 *
 * 断言两条：
 *   1. 文档承诺的每个 `/命令` 都有落地入口（slash command 文件 ∪ 引擎场景 ∪ 文档
 *      明确写了「已融入」的合并项 ∪ 宿主内置）
 *   2. 每个引擎场景都有命令入口 —— 否则用户根本调不到它
 *
 * 两张名单都必须「活」：修掉的东西要删掉，否则测试失败（台账不变烂）。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = join(HERE, '..', '..');
const REPO_ROOT = join(ENGINE_ROOT, '..');

/** 命令 → 场景（CLAUDE.md 写了模式复用的，按它写的映射）。 */
const ALIASES = {
  audit: 'review',        // /audit → /review 的 full_audit 模式
  design: 'ui-polish',    // /design → /ui-polish 的 ai_design 模式
  polish: 'ui-polish',
  simplify: 'refactor',   // /simplify → /refactor 的 simplify 模式
};

/** CLAUDE.md 明确写了「已融入 X」的命令：不作为独立入口存在。 */
const MERGED_INTO = new Set([
  'backup', 'docker',      // → cicd
  'sbom',                  // → deps
  'changelog',             // → release
  'loadtest',              // → setup
  'migration',             // → review
  'llm-proxy-audit',       // → review
]);

/** 宿主（Claude Code / shell）内置，不是本仓库的入口。 */
const HOST_BUILTINS = new Set(['clear', 'init', 'help', 'compact', 'config']);

function commandsDir() {
  const dir = join(REPO_ROOT, '.claude', 'commands');
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', '')),
  );
}

/** 命令名也可能以 skill 形式存在（例如 enhance-prompt）。 */
function skillNames() {
  const names = new Set();
  const roots = [
    join(REPO_ROOT, '.claude', 'skills'),
    join(REPO_ROOT, 'open-design', 'skills'),
    join(REPO_ROOT, '.agents', 'skills'),
    join(REPO_ROOT, '.pi', 'skills'),
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (entry === '_examples') continue;
      if (existsSync(join(root, entry, 'SKILL.md'))) names.add(entry);
    }
  }
  return names;
}

function sceneNames() {
  const names = new Set();
  for (const dir of [join(ENGINE_ROOT, 'scenes'), join(REPO_ROOT, '.claude', 'scenes')]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      names.add(file.replace('.json', ''));
    }
  }
  return names;
}

function documentedCommands() {
  const commands = new Set();
  for (const doc of ['AGENTS.md', 'CLAUDE.md']) {
    const path = join(REPO_ROOT, doc);
    if (!existsSync(path)) continue;
    for (const m of readFileSync(path, 'utf8').matchAll(/`(\/[a-z][a-z-]*)`/g)) {
      commands.add(m[1].slice(1));
    }
  }
  return commands;
}

const commands = commandsDir();
const scenes = sceneNames();
const documented = documentedCommands();
const skills = skillNames();

describe('文档 ↔ 入口 ↔ 场景 对齐', () => {
  it('扫到了文档、命令、场景（防空跑）', () => {
    expect(documented.size).toBeGreaterThanOrEqual(15);
    expect(commands.size).toBeGreaterThanOrEqual(20);
    expect(scenes.size).toBeGreaterThanOrEqual(20);
  });

  it('文档承诺的每个命令都有落地入口', () => {
    const hasEntry = (cmd) => commands.has(cmd)
      || skills.has(cmd)
      || scenes.has(ALIASES[cmd] ?? cmd)
      || MERGED_INTO.has(cmd)
      || HOST_BUILTINS.has(cmd);
    const missing = [...documented].filter((cmd) => !hasEntry(cmd));
    expect(
      missing,
      `文档承诺了但没有入口：${missing.join(', ')}\n` +
        '（补 .claude/commands/<cmd>.md、补场景，或从文档删掉）',
    ).toEqual([]);
  });

  it('每个引擎场景都有命令入口（否则用户调不到）', () => {
    const unreachable = [...scenes].filter((scene) => !commands.has(scene));
    expect(unreachable, `场景没有对应的 .claude/commands/<自己>.md：${unreachable.join(', ')}`).toEqual([]);
  });

  it('名单不变烂：已融入项必须仍被文档提及', () => {
    const stale = [...MERGED_INTO].filter((cmd) => !documented.has(cmd));
    expect(stale, `这些「已融入」项文档里已不提了，请从 MERGED_INTO 删除：${stale.join(', ')}`).toEqual([]);
  });
});
