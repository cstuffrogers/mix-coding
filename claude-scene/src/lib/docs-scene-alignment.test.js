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
 * 断言四条：
 *   1. 文档承诺的每个 `/命令` 都有落地入口（slash command 文件 ∪ 引擎场景 ∪ 文档
 *      明确写了「已融入」的合并项 ∪ 宿主内置）
 *   2. 每个引擎场景都有命令入口 —— 否则用户根本调不到它
 *   3. **菜单里标成「场景」的只许是真场景** —— `/hunt`、`/analyze` 这类旧名可以出现
 *      在「已合并」表里，但 ./commands/others.md 的「类型=场景」和 scene-runner 的
 *      「Command | Scene」表里写它们，就是许诺一个跑不起来的入口
 *   4. 名单不变烂
 *
 * 扫描面对齐现实：不只看 AGENTS/CLAUDE，还看两份 README、`.claude/commands/*.md`、
 * `.claude/rules/conditional/*.md`、两份 scene-runner SKILL —— 这些才是 agent 与
 * 用户真正读到的入口清单。README 曾长期写着 `/hunt` `/e2e` `/monitor` 三个不存在的
 * 场景，正因为没有任何一处把 README 当输入。
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

/**
 * 不是独立入口、但也没有彻底消失的历史命令。两种成因，别混（第三十四轮取证）：
 *   · `MERGED_INTO_SCENE` —— 真的并进场景了：名字就写在那份场景 JSON 的步骤/模式里；
 *   · `UNREACHABLE_ACTIONS` —— 只有在 `actions.js` 里注册的 handler，**没有任何场景步骤
 *     会调用它们**，用户永远触发不到（README / CLAUDE.md 明说「不可达」）。
 * 前一类的双向真值在 `commands/doc-claims.test.js`（并入的必须真在场景里）；
 * 这一类在这里只需要「文档还认这些名字」，免得悄悄从文档消失。
 */
const MERGED_INTO_SCENE = new Set([
  'changelog',             // → release / mobile-release 的步骤
  'hunt',                  // → review 的 security_deep 模式（默认开启）
  'analyze',               // → review 的 analyze-only 模式
  'e2e',                   // → setup --kind e2e（默认）
  'monitor',               // → setup --kind monitor
  'property',              // → setup --kind property
]);
const UNREACHABLE_ACTIONS = new Set([
  'backup', 'docker',      // 当年想去 cicd 分组，分组本身已删
  'sbom',                  // 想去 deps 分组
  'loadtest',              // 想去 setup 分组
  'migration',             // 想去 review 分组
  'llm-proxy-audit',       // 想去 review 分组
  'incident',              // 只有 incident-runbook handler
]);
const NOT_STANDALONE = MERGED_INTO_SCENE.union(UNREACHABLE_ACTIONS);

/** 宿主（Claude Code / shell）内置，不是本仓库的入口。 */
const HOST_BUILTINS = new Set([
  'clear', 'init', 'help', 'compact', 'config', // 会话控制
  'rewind',                                     // Claude Code 自带 checkpoint 回滚
]);

/** 入口清单类文档：用户/agent 照着它敲命令，所以必须逐条核对。 */
const DOC_FILES = ['AGENTS.md', 'CLAUDE.md', 'README.md', 'README_EN.md'];

/** scene-runner 的场景表：skill 目录里同名文件可能不止一份，全都算入口清单。 */
const SCENE_RUNNER_DOCS = [
  join(REPO_ROOT, '.agents', 'skills', 'scene-runner', 'SKILL.md'),
  join(REPO_ROOT, '.pi', 'skills', 'scene-runner', 'SKILL.md'),
];

function docFiles() {
  const files = DOC_FILES.map((f) => join(REPO_ROOT, f));
  for (const dir of [join(REPO_ROOT, '.claude', 'commands'), join(REPO_ROOT, '.claude', 'rules', 'conditional')]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) files.push(join(dir, f));
  }
  files.push(...SCENE_RUNNER_DOCS);
  return files.filter((f) => existsSync(f));
}

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
  for (const path of docFiles()) {
    for (const m of readFileSync(path, 'utf8').matchAll(/`(\/[a-z][a-z0-9-]*)`/g)) {
      commands.add(m[1].slice(1));
    }
  }
  return commands;
}

/**
 * 菜单里「标成场景」的行：
 *   scene-runner SKILL   `| /review | review | … |`   ← 第二列是场景名
 *   others.md 类型表     `| 4 | /review | 场景 |`     ← 第三列写「场景」
 * 返回 [{ file, cmd, scene }]，scene 为 null 表示只声明了「这是场景」没给场景名。
 */
function sceneMenuRows() {
  const rows = [];
  const sceneCell = /^\|\s*\/?([a-z][\w-]*)\s*\|\s*([a-z][\w-]*)\s*\|/;
  const roleCell = /^\|\s*\d+\s*\|\s*\/?([a-z][\w-]*)\s*\|\s*场景\s*\|/;
  for (const path of docFiles()) {
    const isSceneRunner = SCENE_RUNNER_DOCS.includes(path);
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const byRole = roleCell.exec(line);
      if (byRole) {
        rows.push({ file: path, cmd: byRole[1], scene: null });
        continue;
      }
      // 「| /cmd | 名字 |」这种形状只有 scene-runner 的场景表在用；README 里同形状的
      // 是「命令 → 工具」表，第二列不是场景名，硬套会造出一堆假的「列了旧名」。
      if (!isSceneRunner) continue;
      const byScene = sceneCell.exec(line);
      if (byScene) rows.push({ file: path, cmd: byScene[1], scene: byScene[2] });
    }
  }
  return rows;
}

const commands = commandsDir();
const scenes = sceneNames();
const documented = documentedCommands();
const skills = skillNames();
const menuRows = sceneMenuRows();

describe('文档 ↔ 入口 ↔ 场景 对齐', () => {
  it('扫到了文档、命令、场景（防空跑）', () => {
    expect(documented.size).toBeGreaterThanOrEqual(15);
    expect(commands.size).toBeGreaterThanOrEqual(20);
    expect(scenes.size).toBeGreaterThanOrEqual(20);
    expect(menuRows.length, '菜单行一个都没认出来，下面的场景菜单校验就是空跑').toBeGreaterThanOrEqual(20);
  });

  it('文档承诺的每个命令都有落地入口', () => {
    const hasEntry = (cmd) => commands.has(cmd)
      || skills.has(cmd)
      || scenes.has(ALIASES[cmd] ?? cmd)
      || NOT_STANDALONE.has(cmd)
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

  it('菜单里标成「场景」的必须真能跑（不许列旧名）', () => {
    const resolvesToScene = (cmd) => scenes.has(ALIASES[cmd] ?? cmd);
    const liars = menuRows.filter((row) => (row.scene === null
      ? !resolvesToScene(row.cmd)
      : !scenes.has(row.scene) || !resolvesToScene(row.cmd)));
    expect(
      liars.map((r) => `${r.file}: /${r.cmd}${r.scene ? ` → ${r.scene}` : ''}`),
      '这些行把不存在的东西标成了场景（旧名请写进「已合并命令」表）',
    ).toEqual([]);
  });

  it('名单不变烂：并进场景的 / 不可达的历史项都必须仍被文档提及', () => {
    const stale = [...NOT_STANDALONE].filter((cmd) => !documented.has(cmd));
    expect(stale, `这些历史项文档里已不提了，请从 NOT_STANDALONE 删除：${stale.join(', ')}`).toEqual([]);
  });
});
