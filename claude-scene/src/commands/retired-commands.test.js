import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 退役的东西不许继续以「活的」身份出现。
 *
 * 第二十四轮删了 `/hunt` `/e2e` `/monitor` `/analyze` 四个场景（合并进 `/review` 与 `/setup`），
 * 第二十六轮收尾时实测：`.codex/AGENTS.md`、`.zcode/AGENTS.md`、`ARCHITECTURE.md`、
 * `.claude/agents/security-engineer.md` 里仍然把 `/hunt` 当命令、把 `hunt` 当场景列出来 ——
 * 而 `claude-scene/scenes/hunt.json` 早就不存在了。文档让 agent 去跑一个不存在的场景，比不写更糟。
 *
 * 第二十六轮之后 opencode 整体退役（用户确认「opencode 本来就不用了」），
 * 于是 `.opencode/` 目录 + 生成器 + 部署脚本 + 校验器一起删除 —— 这里一并守住。
 *
 * 两条判据：
 *   ① 活的文档里出现 `/hunt` `/e2e` `/monitor` `/analyze` 时，同一行必须写明它是旧名/已合并；
 *   ② 退役的产物（opencode 那套文件、四个场景 JSON）不许复活。
 *
 * 明确排除的「快照 / 历史」产物：`.zcode/plugins/<包>/<版本>/`（已发布版本的冻结副本）、
 * `.claude/reports/*.md`（日期报告，描述的是当天状态）。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const RETIRED_COMMANDS = ['hunt', 'e2e', 'monitor', 'analyze', 'audit'];
// 同一行出现这些字样 = 已经交代清楚「它没了」，不算说谎
const MARKERS = ['旧名', '已合并', '已并入', '退役', '已删除', '原 ', 'merged', 'retired', 'was merged'];

/** 扫「活的文档」：改了会被 agent / 用户当真的那些。 */
function liveDocs() {
  const fixed = [
    'README.md',
    'README_EN.md',
    'CLAUDE.md',
    'AGENTS.md',
    'ARCHITECTURE.md',
    'docs/MULTIPLATFORM.md',
    '.codex/AGENTS.md',
    '.zcode/AGENTS.md',
    '.pi/skills/scene-runner/SKILL.md',
  ];
  const out = fixed.map((f) => join(ROOT, f)).filter((f) => existsSync(f));
  for (const dir of [
    join(ROOT, '.claude', 'commands'),
    join(ROOT, '.claude', 'agents'),
    join(ROOT, '.claude', 'rules', 'conditional'),
  ]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isFile() && name.endsWith('.md')) out.push(p);
    }
  }
  const skills = join(ROOT, '.claude', 'skills');
  if (existsSync(skills)) {
    for (const name of readdirSync(skills)) {
      const p = join(skills, name, 'SKILL.md');
      if (existsSync(p)) out.push(p);
    }
  }
  return out;
}

// 只认「代码格式的斜杠命令」`/hunt`：`audit/analyze 模式`、`templates/commands/analyze.md` 这类
// 带斜杠的普通写法不算，否则全是误报。
const retiredPattern = new RegExp('`/(' + RETIRED_COMMANDS.join('|') + ')`', 'u');
const noMarker = (line) => MARKERS.every((m) => !line.includes(m));

describe('退役命令：活的文档里不许当成还活着', () => {
  it('没有一行把已退役命令（/hunt /e2e /monitor /analyze /audit）当现存命令，除非写明旧名/已合并', () => {
    const offenders = [];
    for (const file of liveDocs()) {
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/u);
      lines.forEach((line, i) => {
        if (retiredPattern.test(line) && noMarker(line)) {
          offenders.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, '这些行还在把退役命令当活的用').toEqual([]);
  });

  it('五个已合并的场景 JSON 不许回来', () => {
    const scenes = join(ROOT, 'claude-scene', 'scenes');
    for (const slug of RETIRED_COMMANDS) {
      expect(existsSync(join(scenes, `${slug}.json`)), `scenes/${slug}.json 不该存在`).toBe(false);
    }
    // 反过来：真场景还在（塌面守卫）
    expect(readdirSync(scenes).filter((f) => f.endsWith('.json')).length).toBeGreaterThanOrEqual(20);
  });
});

describe('opencode 退役：整条链路不许复活', () => {
  const GONE = [
    '.opencode',
    'scripts/generate-opencode-config.cjs',
    'scripts/setup-opencode-global.sh',
    'scripts/check-opencode-config.cjs',
    'claude-scene/src/commands/opencode-config.test.js',
  ];

  it('生成器 / 部署脚本 / 校验器 / 目录 / 测试都已删除', () => {
    for (const rel of GONE) expect(existsSync(join(ROOT, rel)), `${rel} 不该存在`).toBe(false);
  });

  // 测试文件可以提这些名字（它就是用来断言「不存在」的），生产代码不许提
  const SCANNABLE = /\.(js|cjs|mjs|json|sh|ya?ml)$/u;
  const skipped = (name) => name === 'node_modules' || name === '.git' || /\.test\.js$/u.test(name);

  // `claude-scene/src/lib/platform.js` 保留 `OPENCODE=1` → 配置目录名 `.opencode` 的映射：
  // 删了它，在 opencode 里跑引擎会变成「未知宿主」；这行是识别，不是支持。
  const hitsIn = (p, text) =>
    GONE.filter((rel) => text.includes(rel) && !(rel === '.opencode' && p.endsWith(`lib${sep}platform.js`)));

  // 返回「实际扫过的文件数」：万一哪天路径写错扫不到东西，下面的下限断言会炸，
  // 而不是拿到一个空的 offenders 数组就宣布干净。
  const walk = (dir, offenders) => {
    let scanned = 0;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (skipped(name)) continue;
      if (statSync(p).isDirectory()) {
        scanned += walk(p, offenders);
        continue;
      }
      if (!SCANNABLE.test(name)) continue;
      scanned += 1;
      for (const rel of hitsIn(p, readFileSync(p, 'utf-8'))) offenders.push(`${relative(ROOT, p)} → ${rel}`);
    }
    return scanned;
  };

  it('没有代码再引用这些已删文件', () => {
    const offenders = [];
    let scanned = 0;
    for (const dir of [join(ROOT, 'scripts'), join(ROOT, 'claude-scene', 'src')]) {
      if (existsSync(dir)) scanned += walk(dir, offenders);
    }
    expect(scanned, '扫过的文件太少 = 路径写错了，不是「干净」').toBeGreaterThan(100);
    const pkg = readFileSync(join(ROOT, 'package.json'), 'utf-8');
    expect(pkg.includes('opencode'), 'package.json 不该再有 opencode 脚本').toBe(false);
    expect(offenders).toEqual([]);
  });

  it('文档不再宣称 opencode 的配置数量（106 命令 / 38 工作流对齐）', () => {
    const docs = ['README.md', 'README_EN.md', 'CLAUDE.md', 'AGENTS.md', 'docs/MULTIPLATFORM.md', '.claude/knowledge/index.json'];
    const offenders = [];
    for (const rel of docs) {
      const p = join(ROOT, rel);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, 'utf-8');
      if (/106 命令|38 工作流|38 \.md|108 ?命令|38 .*100% 对齐/u.test(text)) offenders.push(rel);
    }
    expect(offenders, '这些文档还在宣称 opencode 的假数字').toEqual([]);
  });

  it('CLAUDE.md / MULTIPLATFORM.md 明确写着「退役」，而不是悄悄不提', () => {
    const md = readFileSync(join(ROOT, 'docs/MULTIPLATFORM.md'), 'utf-8');
    expect(md).toContain('已退役');
    const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf-8');
    expect(claude).toContain('已退役');
    // ADR 的修订要留痕，不许直接改写历史结论
    const adr = readFileSync(join(ROOT, 'DECISIONS.md'), 'utf-8');
    expect(adr).toContain('2026-07-01');
    expect(adr).toContain('已撤销');
  });
});

describe('增强项登记表只能指向存在的场景', () => {
  const REGISTRY_FILE = join(ROOT, 'claude-scene', 'src', 'lib', 'enhancements.js');
  const SCENE_DIR = join(ROOT, 'claude-scene', 'scenes');

  /** REGISTRY 的顶层键 = 场景名（`  review: [` 这种两空格缩进的条目） */
  function registryKeys() {
    const src = readFileSync(REGISTRY_FILE, 'utf-8');
    return [...src.matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?: \[$/gmu)].map((m) => m[1]);
  }

  it('每个增强项分组都挂在一个真实存在的场景上', () => {
    const keys = registryKeys();
    // 解析失效时 keys 会是空数组 —— 那不算「通过」
    expect(keys, '一个键都没解析出来 = 解析失效，不是通过').toContain('review');
    const orphans = keys.filter((k) => !existsSync(join(SCENE_DIR, `${k}.json`)));
    expect(orphans, '这些增强项挂在根本没有的场景上，永远不会被触发').toEqual([]);
  });

  it('已退役的四个场景不许有增强项分组（REGISTRY[scene] 查不到就永不触发）', () => {
    const keys = new Set(registryKeys());
    const back = ['audit', 'analyze', 'hunt', 'monitor'].filter((k) => keys.has(k));
    expect(back, '这些键对应的场景 JSON 已经删了，增强项配置是死配置').toEqual([]);
  });
});

describe('增强项文档与 REGISTRY 一一对应（文档不许比代码长出来）', () => {
  const REGISTRY_FILE = join(ROOT, 'claude-scene', 'src', 'lib', 'enhancements.js');
  const DOC = join(ROOT, '.claude', 'rules', 'conditional', 'enhancements.md');
  const SCENE_DIR = join(ROOT, 'claude-scene', 'scenes');

  function regSceneKeys() {
    const src = readFileSync(REGISTRY_FILE, 'utf-8');
    const out = new Map();
    let scene = null;
    for (const line of src.split(/\r?\n/u)) {
      const head = /^ {2}'?([a-z0-9-]+)'?: \[$/u.exec(line);
      if (head) {
        scene = head[1];
        out.set(scene, []);
        continue;
      }
      if (/^ {2}\],$/u.test(line)) {
        scene = null;
        continue;
      }
      const key = /^\s+key: '([a-z_0-9]+)',$/u.exec(line);
      if (key && scene) out.get(scene).push(key[1]);
    }
    return out;
  }

  it('文档里的每个场景节都等于 REGISTRY 的顶层键', () => {
    const fromCode = [...regSceneKeys().keys()].sort();
    const fromDoc = [...readFileSync(DOC, 'utf-8').matchAll(/^### `\/([a-z0-9-]+)`$/gmu)].map((m) => m[1]).sort();
    expect(fromDoc, 'REGISTRY 有的场景没写进文档，或文档写着 REGISTRY 没有的场景').toEqual(fromCode);
  });

  it('文档列出的增强项 key 与 code 一一对应（既不许少写，也不许多编）', () => {
    const fromCode = [...regSceneKeys().values()].flat();
    const fromDoc = [...readFileSync(DOC, 'utf-8').matchAll(/^\| \d+ \| `([a-z_0-9]+)` — /gmu)].map((m) => m[1]);
    // 同一个 key 可以出现在不同场景（如 huashu_expert_review 在 ui-polish 和 review 都有），
    // 所以比的是「多重集相等」，不是集合相等。
    expect(fromDoc.sort(), '文档表格里的 key 与 code 的 key 必须一一对应').toEqual(fromCode.sort());
  });

  it('「无增强场景」列表 = 场景总数 − REGISTRY 键（自己算，不手抄）', () => {
    const scenes = readdirSync(SCENE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/u, ''))
      .sort();
    const withEnh = new Set(regSceneKeys().keys());
    const expected = scenes.filter((s) => !withEnh.has(s));
    const doc = readFileSync(DOC, 'utf-8');
    const section = doc.slice(doc.indexOf('## 无增强场景'));
    const listed = [...section.matchAll(/`([a-z0-9-]+)`/gu)].map((m) => m[1]);
    expect(listed.sort(), '照代码算出来的「无增强场景」和文档写的不一样').toEqual(expected);
  });
});
