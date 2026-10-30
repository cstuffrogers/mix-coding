import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 入口文档的三类「点名」，每一条都得能被机器复核。
 *
 * 第三十四轮取证时发现，概览段是整份仓库唯一没人校验的一页：
 *   ① 工作流数字三个版本 —— README 写「25 个（Web 19 + 移动 6）」、
 *      README_EN 写「27 automated workflows (21 Web + 6 Mobile)」，
 *      同一个文件第 114 行又写「26 workflows」，而真值是 26（20 + 6）。
 *   ② 命令 ` /design` ` /simplify` 两年前就并进了 `/ui-polish` `/refactor`，
 *      `/enhance-prompt` 更是只存在于本机 gitignore 掉的 `open-design/` 克隆里 ——
 *      但两者都被写成「照抄就能跑」的命令（`.claude/commands/build.md` 甚至让 agent
 *      去跑 `/design` 建技术方案，那个命令不存在）。
 *   ③ 「另有 9 个功能已融入增强菜单（cicd/deps/setup/review/feature 内按需弹出）」
 *      —— 9 个里只有 `changelog`（`/release`、`/mobile-release`）与日志脱敏（`/review`）
 *      真的出现在场景 JSON 里；其余 7 个只有 `actions.js` 里的注册项，
 *      **没有任何场景步骤会调用它们**，用户永远触发不到。
 *
 * 所以三条判据：
 *   · 文档背书名号里的 `/命令` 必须是真命令、真 skill，或同行写明「旧名 / Skill 提供」；
 *   · 目录树里点名的 `xxx.json` 必须真的在场景目录里，注释里的数字必须是场景数；
 *   · 「已并入某场景」必须真在场景里、「不可达」必须真不可达（双向，谁改了代码都得来改文档）。
 *
 * 语料范围只挑「改了会被当真的」：读者入口 + agent 指令 + 命令/规则正文。
 * 刻意不扫 `progress.md` / `DECISIONS.md` / `docs/CHANGELOG.md`（台账，记录的是历史）
 * 与 `open-design/`（vendored 树，不是本仓库的话）。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCENE_DIRS = [join(ROOT, '.claude', 'scenes'), join(ROOT, 'claude-scene', 'scenes')];

/** 活的入口文档：用户与 agent 都会照着做的那种。 */
const FIXED_DOCS = [
  'README.md',
  'README_EN.md',
  'CLAUDE.md',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'INSTALL.md',
  'docs/MULTIPLATFORM.md',
];
const SCANNED_DIRS = [
  ['.claude', 'commands'],
  ['.claude', 'rules', 'conditional'],
  ['.claude', 'rules', 'od-craft'],
];

/** 同行出现这些字样 = 已经交代清楚「它从哪来 / 它没了」，不算把死命令写成活的。 */
const PROVENANCE = [
  '原 `',
  '旧名',
  '已退役',
  '已合并',
  '已并入',
  '已删除',
  '不存在',
  'there is no',
  'Skill 提供',
  '第三方',
  'Open Design',
  'open-design',
];

/**
 * 宿主 CLI 自带的斜杠命令（Claude Code 的 /compact /clear /rewind 等）。
 * 它们不是本仓库的命令，但文档里提到它们是合理的 —— 白名单只放「宿主确实有这个命令」。
 */
const HOST_COMMANDS = new Set(['compact', 'clear', 'rewind', 'help', 'config', 'init']);

/** `/command` 是「任意命令名」的占位符，不是某个具体命令。 */
const PLACEHOLDER_COMMANDS = new Set(['command']);

function liveDocs() {
  const docs = FIXED_DOCS.map((f) => join(ROOT, f)).filter((f) => existsSync(f));
  for (const parts of SCANNED_DIRS) {
    const dir = join(ROOT, ...parts);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.md')) docs.push(join(dir, name));
    }
  }
  return docs;
}

/** 真命令 + 真 skill（skill 用 `<名字>/SKILL.md` 判定；`speckit.clarify` 这类点号写法归一成横线）。 */
function knownCommands() {
  const names = new Set();
  const commands = join(ROOT, '.claude', 'commands');
  if (existsSync(commands)) {
    for (const f of readdirSync(commands)) {
      if (f.endsWith('.md')) names.add(f.replace(/\.md$/u, ''));
    }
  }
  const skills = join(ROOT, '.claude', 'skills');
  if (existsSync(skills)) {
    for (const entry of readdirSync(skills)) {
      if (existsSync(join(skills, entry, 'SKILL.md'))) names.add(entry);
    }
  }
  return names;
}

function sceneFiles() {
  const names = new Set();
  for (const dir of SCENE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.json')) names.add(f.replace(/\.json$/u, ''));
    }
  }
  return names;
}

/** 场景 JSON 全文（含步骤里的 action 名）。 */
function sceneSources(scenes) {
  const out = new Map();
  for (const id of scenes) {
    for (const dir of SCENE_DIRS) {
      const file = join(dir, `${id}.json`);
      if (existsSync(file)) out.set(id, readFileSync(file, 'utf-8'));
    }
  }
  return out;
}

describe('入口文档点名的斜杠命令必须真的存在', () => {
  it('没有一行把不存在的命令写成「照抄就能跑」，除非写明旧名 / Skill 提供', () => {
    const known = knownCommands();
    expect(known.size, '一条命令都没读出来 = 解析失效，不是通过').toBeGreaterThan(20);

    const offenders = [];
    const seen = new Set();
    for (const file of liveDocs()) {
      const rel = file.slice(ROOT.length + 1).replaceAll('\\', '/');
      for (const [index, line] of readFileSync(file, 'utf-8').split('\n').entries()) {
        for (const m of line.matchAll(/`\/([a-z][a-z0-9.-]*)`/gu)) {
          const name = m[1].replaceAll('.', '-');
          seen.add(name);
          if (known.has(name) || HOST_COMMANDS.has(name) || PLACEHOLDER_COMMANDS.has(name)) continue;
          if (PROVENANCE.some((marker) => line.includes(marker))) continue;
          offenders.push(`${rel}:${index + 1} → /${m[1]}`);
        }
      }
    }

    expect(seen.size, '扫到的命令太少 = 正则失效或文档结构变了').toBeGreaterThan(25);
    expect(offenders, '这些文档让人去跑一个不存在的命令').toEqual([]);
  });
});

/** 目录树里 `scenes/` 那一段点名的 `xxx.json`（读不到那一段时返回 null）。 */
function treeJsonNames(doc) {
  const file = join(ROOT, doc);
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, 'utf-8').split(/\r?\n/u);
  const start = lines.findIndex((line) => line.includes('├── scenes/'));
  if (start === -1) return null;
  const names = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('│   │')) break;
    // 文件名以空格分隔，按 token 取比正则扫更不容易看走眼（也就不给 sonar 留回溯）
    for (const token of line.split(' ')) {
      const base = token.endsWith('.json') ? token.slice(0, -'.json'.length) : '';
      if (/^[a-z0-9-]+$/u.test(base)) names.push(base);
    }
  }
  return names;
}

describe('README 目录树里点名的场景文件与数字必须是真的', () => {
  const scenes = sceneFiles();

  it('树里列出的每个 xxx.json 都是真实场景文件', () => {
    expect(scenes.size, '场景目录读不到').toBeGreaterThan(20);
    const offenders = [];
    let checked = 0;
    for (const doc of ['README.md', 'README_EN.md']) {
      const listed = treeJsonNames(doc);
      expect(listed, `${doc}：目录树里没找到 scenes/ 那一段`).not.toBeNull();
      for (const base of listed) {
        checked += 1;
        if (!scenes.has(base)) offenders.push(`${doc} → ${base}.json`);
      }
    }
    expect(checked, '一棵树都没扫到 = 结构变了').toBeGreaterThan(20);
    expect(offenders, '目录树里点名的场景文件不存在').toEqual([]);
  });

  it('树里注释的场景数 = 真实场景数', () => {
    const patterns = [
      ['README.md', /# 场景定义（(\d+) 个 JSON/u],
      ['README_EN.md', /# Scene definitions \((\d+) JSON files/u],
    ];
    const offenders = [];
    for (const [name, re] of patterns) {
      const file = join(ROOT, name);
      if (!existsSync(file)) continue;
      const m = re.exec(readFileSync(file, 'utf-8'));
      expect(m, `${name}：目录树里「场景定义（N 个 JSON）」那句没认出来`).not.toBeNull();
      if (Number(m[1]) !== scenes.size) offenders.push(`${name} 写 ${m[1]}，实际 ${scenes.size}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('「哪些功能并进了哪个场景」必须双向可验', () => {
  /**
   * 真步骤：文档说「X 并入 Y」时，X 必须真的出现在 Y 的 JSON 里。
   * 改场景就等于改这条断言 —— 这是故意的：把 feature 挪走就必须回来改文档。
   */
  const MERGED_INTO_SCENE = [
    ['changelog', ['release', 'mobile-release']],
    ['log-sanit', ['review']],
  ];

  /**
   * 只有注册、没有场景步骤的 7 个历史功能（README 里明说「不可达」）。
   * 一旦有人把它们接进场景，这条会红 —— 那时 README 那句话就变成假的了。
   */
  const UNREACHABLE_ACTIONS = [
    'setup-backup',
    'backup',
    'sbom',
    'generate-sbom',
    'loadtest',
    'load-test',
    'migration-review',
    'migrationReview',
    'llm-proxy-report',
  ];
  const UNREACHABLE_FEATURES = ['backup', 'docker', 'sbom', 'loadtest', 'incident', 'migration', 'llm-proxy-audit'];

  const scenes = sceneFiles();
  const src = sceneSources(scenes);

  it('「并入某场景」的每一项都真的在那个场景的 JSON 里', () => {
    expect(src.size, '场景 JSON 一份都没读到').toBeGreaterThan(20);
    const offenders = [];
    for (const [token, hosts] of MERGED_INTO_SCENE) {
      for (const host of hosts) {
        if (!src.has(host)) {
          offenders.push(`场景 ${host} 不存在`);
          continue;
        }
        if (!src.get(host).includes(token)) offenders.push(`${token} 不在 ${host}.json 里`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('「不可达」的 7 项：动作注册了，但没有任何场景步骤调用', () => {
    const actions = readFileSync(join(ROOT, 'claude-scene', 'src', 'actions.js'), 'utf-8');
    const notRegistered = UNREACHABLE_ACTIONS.filter((a) => !actions.includes(`'${a}'`) && !actions.includes(`${a}:`));
    expect(notRegistered, '这些动作根本没注册，「只注册了没接上」的说法就不成立').toEqual([]);

    const reached = [];
    for (const [id, source] of src) {
      for (const action of UNREACHABLE_ACTIONS) {
        if (source.includes(`"${action}"`)) reached.push(`${action} → ${id}`);
      }
    }
    expect(reached, '有场景开始调用它们了 —— 请同时改掉 README 里「不可达」那句').toEqual([]);
  });

  it('README 两份都写明了这 7 项的去向，且用词是「不可达」', () => {
    const zh = readFileSync(join(ROOT, 'README.md'), 'utf-8');
    const en = readFileSync(join(ROOT, 'README_EN.md'), 'utf-8');
    expect(zh).toContain('不可达');
    expect(en).toContain('unreachable');
    const missing = UNREACHABLE_FEATURES.filter((f) => !zh.includes(f));
    expect(missing, 'README 的「不可达」清单少了这些功能').toEqual([]);
  });
});

/**
 * 第三十七轮：**易变的外部热度数字不是文档**。
 *
 * 取证：活的文档里躺着 45 处 GitHub star 数（README.md 17、README_EN.md 14、
 * `.claude/rules/conditional/security-toolchain.md` 9、`ARCHITECTURE.md` 1、
 * `docs/补充.md` 1），外加两处互相矛盾的上游品牌库条数 —— `ARCHITECTURE.md` 写
 * 「129 brand-level design systems」，`.claude/commands/ui-polish.md` 写「152 品牌设计系统」。
 * 同一个上游、两个数字，说明它们从来没有人真的数过；而 star 数每次上游涨粉就会过期，
 * 本机也核不了。写进文档只是把「我记得当时是这样」冒充成事实。
 *
 * 判据：活的文档不许出现 star 数，也不许给上游品牌库写死条数。
 * 台账（`progress.md` / `DECISIONS.md` / `docs/CHANGELOG.md`）记录的是历史，不在此列。
 * 刻意不拦「35 presets / 2000+ icons」这类功能规模数字：那是能力描述，
 * 一台正则分不清它和本仓库自己的真值（26 个场景 / 585 步），拦了只会制造假红。
 */
describe('易变的外部热度数字不进活的文档', () => {
  const STAR_COUNT = /\d[\d.,]{0,16}\s{0,2}k?\+?\s{0,2}stars/i;
  const CATALOGUE_SIZE = /\d{1,6}\s{0,2}(?:brand-level design systems?|品牌设计系统)/iu;
  const ARCHIVED_MARK = '> **归档**';

  /** 活的 markdown：入口文档 + docs/*.md（去掉台账与带「归档」横幅的历史提案）+ 命令/规则正文。 */
  function livingMarkdown() {
    const out = liveDocs();
    const docsDir = join(ROOT, 'docs');
    if (existsSync(docsDir)) {
      for (const name of readdirSync(docsDir)) {
        if (!name.endsWith('.md') || name === 'CHANGELOG.md') continue;
        out.push(join(docsDir, name));
      }
    }
    return out.filter((file) => !readFileSync(file, 'utf-8').includes(ARCHIVED_MARK));
  }

  it('没有一行拿 star 数或上游条数当事实', () => {
    const docs = livingMarkdown();
    // 自证非空跑：一个文件都没读到、或正则失配，这条断言就变成假证据
    expect(docs.length, '活的文档一个都没读到').toBeGreaterThan(40);

    const offenders = [];
    for (const file of docs) {
      const rel = file.slice(ROOT.length + 1).replaceAll(String.fromCodePoint(92), '/');
      for (const [index, line] of readFileSync(file, 'utf-8').split('\n').entries()) {
        if (STAR_COUNT.test(line) || CATALOGUE_SIZE.test(line)) offenders.push(`${rel}:${index + 1}`);
      }
    }
    expect(offenders, '这些行把会过期的外部数字写成了事实').toEqual([]);
  });
});
