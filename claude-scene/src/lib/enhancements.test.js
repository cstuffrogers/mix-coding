// 「勾了会不会真执行」必须说清楚 —— 增强项的诚实性。
//
// 背景：`REGISTRY` 里 21 个增强键，只有 3 个被场景的 `condition: "enh_<key>"` 消费。
// 其余 18 个勾上以后只是往 context 里放一个没人读的 flag：菜单说「Stagehand 行为验证」，
// 跑起来一个字都不变，界面和日志都不提这件事。第二十九轮把它拆成两栏披露。
import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DETECTOR_HINTS,
  DETECTORS,
  ENHANCEMENT_KEYS,
  ENHANCEMENT_REGISTRY,
  applyEnhancements,
  consumedEnhKeys,
  partitionSelection,
} from './enhancements.js';
import { PROJECT_ROOT, listSceneIds, resolveScenePath } from './paths.js';
import { fileURLToPath, URL } from 'node:url';

// 文档在仓库根，按本文件位置定位。用 PROJECT_ROOT 会在 cwd=claude-scene 时
// 解析成 claude-scene/.claude/...（ENOENT）—— check 场景的冒烟步骤正是那样跑的。
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url)).slice(0, -1);

/** 场景里 `enh_*` 条件 → 触发它的那个 step（独立重算一遍，用于和文档对账） */
function liveSteps(scene) {
  const file = resolveScenePath(scene);
  const flow = JSON.parse(readFileSync(file, 'utf-8')).flow;
  const steps = Array.isArray(flow) ? flow : Object.values(flow);
  const map = new Map();
  for (const step of steps) {
    if (typeof step.condition !== 'string') continue;
    for (const hit of step.condition.matchAll(/\benh_([a-z0-9_]+)\b/gu)) map.set(hit[1], String(step.step));
  }
  return map;
}

const TOTAL_KEYS = Object.values(ENHANCEMENT_KEYS).reduce((n, keys) => n + keys.length, 0);

describe('consumedEnhKeys：只有写了 condition 的增强键才会变成步骤', () => {
  it('ui-polish 消费 huashu_expert_review（且只有它）', () => {
    expect([...consumedEnhKeys('ui-polish')]).toEqual(['huashu_expert_review']);
  });

  it('review 的四项一项都没被消费（勾了不触发任何步骤）', () => {
    const used = consumedEnhKeys('review');
    expect(used.size).toBe(0);
    for (const key of ENHANCEMENT_KEYS.review) expect(used.has(key.replace(/^enh_/u, ''))).toBe(false);
  });

  it('release 消费 deck 与 animation 两项', () => {
    expect([...consumedEnhKeys('release')].sort()).toEqual(['huashu_release_animation', 'huashu_release_deck']);
  });

  it('场景不存在或 JSON 读不出来时返回空集，不抛', () => {
    expect(consumedEnhKeys('no-such-scene').size).toBe(0);
  });

  it('不是「结构上不可能失败」：真仓库里确实有被消费的键，且覆盖 2 个场景', () => {
    const scenes = Object.keys(ENHANCEMENT_KEYS).filter((s) => consumedEnhKeys(s).size > 0);
    const total = scenes.reduce((n, s) => n + consumedEnhKeys(s).size, 0);
    expect(scenes.length).toBeGreaterThanOrEqual(2);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThan(TOTAL_KEYS);
  });
});

describe('partitionSelection：分栏是纯函数，不许合并成一栏', () => {
  it('按原顺序分栏', () => {
    const { live, inert } = partitionSelection(['a', 'b', 'c'], new Set(['b']));
    expect(live).toEqual(['b']);
    expect(inert).toEqual(['a', 'c']);
  });

  it('全 live / 全 inert / 空选择三种边界', () => {
    expect(partitionSelection(['a'], new Set(['a']))).toEqual({ live: ['a'], inert: [] });
    expect(partitionSelection(['a'], new Set())).toEqual({ live: [], inert: ['a'] });
    expect(partitionSelection([], new Set(['a']))).toEqual({ live: [], inert: [] });
  });
});

describe('幽灵增强键：场景里写的 enh_xxx 必须有对应的菜单项', () => {
  it('没有写错的 key 名，也没有「没菜单却 gated」的步骤', () => {
    const ghosts = [];
    let scanned = 0;
    for (const scene of listSceneIds()) {
      const declared = new Set((ENHANCEMENT_KEYS[scene] || []).map((k) => k.replace(/^enh_/u, '')));
      for (const key of consumedEnhKeys(scene)) {
        scanned += 1;
        if (!declared.has(key)) ghosts.push(`${scene}: enh_${key}（REGISTRY 里没这一项，该步骤永远不会跑）`);
      }
    }
    expect(scanned).toBeGreaterThanOrEqual(3); // 防空跑下限
    expect(ghosts).toEqual([]);
  });
});

describe('非交互模式：选了什么必须当场分成两栏打印出来', () => {
  it('有步骤消费 / 仅建议 分两行，且 flag 照样设上（对话模式还要用）', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const context = { targetPath: PROJECT_ROOT };
      await applyEnhancements('ui-polish', context, {});
      const out = spy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(out).toContain('场景里有步骤消费');
      expect(out).toContain('huashu_expert_review');
      expect(out).toContain('没有场景步骤消费');
      expect(out).toContain('CLI 下不会执行任何步骤');
      expect(out).toContain('impeccable_audit');
      // 披露不等于不设 flag：对话模式下的 agent 仍要能读到用户的勾选
      expect(context.enh_huashu_expert_review).toBe(true);
      expect(context.enh_impeccable_audit).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('一个都不选时也说一句，不许静默', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      // release 的四项默认全是 —（非交互模式只勾默认项），所以「一个都没选」
      await applyEnhancements('release', { targetPath: PROJECT_ROOT }, {});
      const out = spy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(out).toContain('没有启用任何增强项');
    } finally {
      spy.mockRestore();
    }
  });
});

const DOC = join(REPO_ROOT, '.claude', 'rules', 'conditional', 'enhancements.md');

/** 从文档表格里取出 `${scene}:${key}` → 第 4 列（「场景步骤」） */
function docClaims() {
  const lines = readFileSync(DOC, 'utf-8').replaceAll('\r\n', '\n').split('\n');
  const claimed = new Map();
  let scene = '';
  for (const line of lines) {
    const head = line.match(/^### `\/([a-z0-9-]+)`$/u);
    if (head) {
      scene = head[1];
      continue;
    }
    const row = line.match(/^\| \d+ \| `([a-z0-9_]+)` — .* \| [✓—] \| (.+) \|$/u);
    if (row) claimed.set(`${scene}:${row[1]}`, row[2]);
  }
  return claimed;
}

/** 逐行对账，返回文档里说不通的行（空数组 = 全对） */
function docMismatches(claimed) {
  const wrong = [];
  for (const [scene, keys] of Object.entries(ENHANCEMENT_KEYS)) {
    const live = liveSteps(scene);
    for (const key of keys) {
      const encoded = key.replace(/^enh_/u, '');
      const cell = claimed.get(`${scene}:${encoded}`);
      if (live.has(encoded)) {
        const want = `✓ step ${live.get(encoded)}`;
        if (cell !== want) wrong.push(`${scene}:${encoded} 文档写「${cell}」，实际应是「${want}」`);
      } else if (!String(cell).startsWith('仅建议')) {
        wrong.push(`${scene}:${encoded} 文档写「${cell}」，但场景里没有步骤消费它`);
      }
    }
  }
  return wrong;
}

describe('文档对账：enhancements.md 的「场景步骤」列 = 场景 JSON 真值', () => {
  it('21 行逐行对账，写 ✓ step N 的 N 必须真是那个 step', () => {
    const claimed = docClaims();
    expect(claimed.size).toBe(TOTAL_KEYS); // 表格既不许漏行，也不许多行
    expect(docMismatches(claimed)).toEqual([]);
  });
});

// ── 精简版：一行一场景的紧凑视图，agent 每次会话都会读，错了代价最高 ──

/** 按代码真值生成「- **scene**: `key` ✓ step N · …」的一行 */
function expectedLine(scene) {
  const live = liveSteps(scene);
  const parts = ENHANCEMENT_REGISTRY[scene].map(({ key, default: def }) => {
    const step = live.get(key);
    return `\`${key}\`${def ? ' ✓' : ''}${step ? ` step ${step}` : ' ⌾'}`;
  });
  return `- **${scene}**: ${parts.join(' · ')}`;
}

/** 实际被 REGISTRY 引用的探测器名（按函数源码里的 `DETECTORS.x` 判定） */
function usedDetectors() {
  // 第 31 轮起读 `needs`，不再用正则猜 `when` 的函数体 —— `when` 已从 `needs` 派生，
  // 源码里没有 `DETECTORS.xxx` 字样了，旧写法会判出「被用到 0 个」。
  const all = Object.values(ENHANCEMENT_REGISTRY).flat();
  return Object.keys(DETECTORS).filter((name) => all.some((e) => e.needs === name));
}

describe('文档对账：enhancements-summary.md 的每行 = REGISTRY + 场景 JSON', () => {
  const DOC = join(REPO_ROOT, '.claude', 'rules', 'conditional', 'enhancements-summary.md');
  const text = () => readFileSync(DOC, 'utf-8').replaceAll('\r\n', '\n');

  it('每行菜单都跟代码逐字对上（场景集合、默认勾选、step N、⌾）', () => {
    const lines = text().split('\n').filter((l) => l.startsWith('- **'));
    const want = Object.keys(ENHANCEMENT_REGISTRY).map((s) => expectedLine(s));
    expect(lines, '精简版文档的菜单行与代码不一致，按上面 want 重新生成').toEqual(want);
  });

  it('「没有增强项的场景」清单 = 盘上场景 − REGISTRY 场景', () => {
    const listed = text().split('\n').find((l) => l.startsWith('check ')) || '';
    const registered = new Set(Object.keys(ENHANCEMENT_REGISTRY));
    const want = listSceneIds().filter((s) => !registered.has(s)).join(' ');
    expect(listed.trim()).toBe(want);
  });

  it('退役场景名不许在这份文档里当活的出现', () => {
    const retired = new Set(['audit', 'analyze', 'hunt', 'monitor', 'e2e', 'design', 'prototype', 'changelog']);
    const ghost = text().split('\n').filter((l) => l.startsWith('- **')
      && retired.has(l.slice(4, l.indexOf('**', 4))));
    expect(ghost).toEqual([]);
  });

  it('探测器数量与名单 = 代码真值（不能手抄「4 个」）', () => {
    const used = usedDetectors();
    const dead = Object.keys(DETECTORS).filter((n) => !used.includes(n));
    // 防空跑：探测器和引用都得解出东西来
    expect(Object.keys(DETECTORS).length).toBeGreaterThanOrEqual(5);
    expect(used.length).toBeGreaterThanOrEqual(4);
    const body = text();
    expect(body, '文档写的探测器个数与代码不符').toContain(`用到 ${used.length} 个`);
    expect(body, '文档写的死探测器个数与代码不符').toContain(`另外 ${dead.length} 个`);
    for (const name of dead) expect(body).toContain(`\`${name}\``);
  });
});

// ── 第三十一轮：缺席也要说为什么 ──────────────────────────────────
//
// 上一轮解决的是「勾了会不会执行」，这一轮解决「**根本没出现**」：
// `when(ctx)` 返回 false 时这一项被 `filter` 静默丢掉 —— 菜单里少了几项，
// 而 CLI 一个字都不说。用户只能猜「是不是配置漏了」。
// 现在探测器不满足的项会单独披露，并给出「依赖哪个探测器 + 它到底缺什么」。

describe('缺席也要披露：探测器不满足的增强项不许默默消失', () => {
  /** 造一个空项目目录（哪些探测器命中完全由这个目录决定，不吃宿主环境） */
  function mkProject(files = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'enh-unavailable-'));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return dir;
  }

  /** 收一份 applyEnhancements 的输出（不许漏 mockRestore，否则后面所有用例的日志都被吞） */
  async function capture(scene, context, options) {
    const out = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => out.push(args.join(' ')));
    try {
      await applyEnhancements(scene, context, options);
    } finally {
      spy.mockRestore();
    }
    return out.join('\n');
  }

  it('每个探测器都有一句人话解释（新探测器不许只带回一个 false）', () => {
    const missing = Object.keys(DETECTORS).filter((name) => !DETECTOR_HINTS[name]?.trim());
    expect(missing).toEqual([]);
    // 反空跑：提示表不许塌成一个空对象
    expect(Object.keys(DETECTOR_HINTS).length).toBeGreaterThanOrEqual(5);
  });

  /** 单项自检：needs 指向真探测器、有解释文案；没 needs 的必须无条件可用 */
  function entryProblems(scene, entry) {
    const where = `${scene}:${entry.key}`;
    if (typeof entry.when !== 'function') return [`${where} 没有派生 when`];
    if (!entry.needs) return entry.when() === true ? [] : [`${where} 没声明 needs 却探测为 false`];
    const problems = [];
    if (typeof DETECTORS[entry.needs] !== 'function') problems.push(`${where} 依赖不存在的探测器 ${entry.needs}`);
    if (!DETECTOR_HINTS[entry.needs]) problems.push(`${where} 依赖的探测器没有解释文案`);
    return problems;
  }

  it('每项声明的 needs 都在探测器表里；没声明 needs 的必须无条件可用', () => {
    const flat = Object.entries(ENHANCEMENT_REGISTRY).flatMap(([scene, list]) => list.map((e) => [scene, e]));
    const bad = flat.flatMap(([scene, entry]) => entryProblems(scene, entry));
    expect(flat).toHaveLength(21); // 防空跑
    expect(bad).toEqual([]);
  });

  it('空项目里 ui-polish 的两项不可用 → 逐项点名原因，且 flag 不设', async () => {
    const context = { targetPath: mkProject() };
    const text = await capture('ui-polish', context, {});
    expect(text).toContain('未提供的增强项（本机不满足条件，既不进菜单也不会执行）');
    expect(text).toContain(`huashu_expert_review —— ${DETECTOR_HINTS.uiFiles}`);
    expect(text).toContain(`stagehand_interaction —— ${DETECTOR_HINTS.stagehand}`);
    expect(context.enh_huashu_expert_review).toBeUndefined();
    // 可用且默认勾选的那项照旧生效 —— 披露缺席不能顺手把在场的也灭了
    expect(context.enh_impeccable_audit).toBe(true);
  });

  it('--enh 点名了不可用项 → 明说没启用（这比默认项缺席更该说）', async () => {
    const context = { targetPath: mkProject() };
    const text = await capture('ui-polish', context, { enh: 'huashu_expert_review' });
    expect(text).toContain('--enh 里这些增强项本机不满足条件，没有启用: huashu_expert_review');
    expect(context.enh_huashu_expert_review).toBeUndefined();
  });

  it('整个场景一项都不可用 → 仍然说话（以前 early return，一个字都没有）', async () => {
    const context = { targetPath: mkProject() };
    const text = await capture('new-project', context, {});
    expect(text).toContain(`stagehand_scaffold —— ${DETECTOR_HINTS.stagehand}`);
    expect(text).toContain('没有启用任何增强项');
  });

  it('条件满足时不冒充「未提供」：给了 stagehand 依赖就回到菜单里', async () => {
    const context = {
      targetPath: mkProject({ 'package.json': JSON.stringify({ dependencies: { '@browserbasehq/stagehand': '^3' } }) }),
    };
    const text = await capture('new-project', context, {});
    expect(text).not.toContain('未提供的增强项');
    // 该项 default 是 false，没 --enh 就不勾 —— 但它是「可提供」，所以不出现在缺席清单里
    expect(context.enh_stagehand_scaffold).toBeUndefined();
  });
});

// ── 第三十一轮（续）：文档不许写会过期的机器状态 ────────────────────
//
// `enhancements.md` 与 `enhancements-summary.md` 都曾写死「本机 mythos-agent 与 gepa
// 均未安装 → 相关项不会出现在菜单里」。这句话在 gepa 装上之后就变成了假话，
// 而它恰好是 agent 每次会话都会读的那两份文件。
// 现在机器状态由运行期披露，文档只说明「会有这段披露」。

describe('两份增强文档不许记录机器状态', () => {
  const DOCS = [
    join(REPO_ROOT, '.claude', 'rules', 'conditional', 'enhancements.md'),
    join(REPO_ROOT, '.claude', 'rules', 'conditional', 'enhancements-summary.md'),
  ];

  it('不许再断言某个工具「未安装 / 没装」（会过期的事实不进文档）', () => {
    const claims = [];
    for (const file of DOCS) {
      for (const [i, line] of readFileSync(file, 'utf-8').split(/\r?\n/u).entries()) {
        if (/(?:mythos-agent|gepa|stagehand|critiq)[^。\n]{0,24}(?:未安装|没装)/iu.test(line)) {
          claims.push(`${file.split(/[\\/]/u).pop()}:${i + 1}`);
        }
      }
    }
    expect(claims).toEqual([]);
  });

  it('两份文档都要指向「运行期披露」这段输出（不然读者不知道去哪看）', () => {
    for (const file of DOCS) {
      expect(readFileSync(file, 'utf-8'), `${file} 没写运行期披露`).toContain('未提供的增强项');
    }
  });
});
