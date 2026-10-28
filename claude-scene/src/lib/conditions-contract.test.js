import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONDITION_PREDICATES, conditionIdentifiers, evaluateCondition } from '../lib/conditions.js';

/**
 * 场景条件的双向契约。第五轮守的是「场景 params 写了没人读」，这一轮是它的镜像：
 * 条件表达式读的东西没人写。
 *
 * 两条都曾经真实发生过（都是「静默跳过」级别的假信号，dry-run 全绿也看不出来）：
 *   1) 条件里引用一个不存在的谓词名（拼错/删了）→ `evalClause` 落到 `return false`
 *      → 步骤永远「条件不满足」地跳过，日志与正常跳过一模一样；
 *   2) 谓词表里躺着一个没人用的谓词 → 以后有人照抄它写条件，结果是恒假
 *      （`fixes_applied` / `high_severity_found` 读的 `securityScanResult` 从来没人写）。
 *
 * 判定口径：条件里的每个标识符，要么是内置谓词（可现场求值），要么是 context 上
 * 真被写过的键。动态写入的键（`enh_*`、`setup_kind`）在这里显式列名并写理由，
 * 不许用「至少通过 N 个」这种宽松断言。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');
const REPO = join(SRC, '..', '..');

// ── 动态写入的上下文键：不是字面量 `context.x = y`，但确有写入方 ──
const DYNAMIC_WRITERS = new Map([
  ['enh_', 'lib/enhancements.js：`context[`enh_${key}`] = true`（用户勾选的增强项）'],
  ['setup_kind', 'commands/start.js handleSingleChoice：`context[contextKey] = override.id`（--kind e2e/monitor/property）'],
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue;
      walk(p, out);
    } else if (name.endsWith('.js') && !name.includes('.test.')) out.push(p);
  }
  return out;
}

/** 引擎里所有「往 context 上写键」的地方：字面量赋值 + buildSceneContext 的返回对象。 */
function collectWriters() {
  const keys = new Set();
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf-8');
    for (const m of src.matchAll(/\b(?:context|ctx)\s*\??\.\s*(\w+)\s*=(?!=)/g)) keys.add(m[1]);
    if (!file.endsWith('start.js')) continue;
    // buildSceneContext 的返回对象字面量：`    key: value,` 形态
    const start = src.indexOf('export function buildSceneContext');
    if (start === -1) continue;
    const body = src.slice(start, src.indexOf('\n}', start));
    for (const m of body.matchAll(/^\s{4}(\w+):/gm)) keys.add(m[1]);
  }
  return keys;
}

function isDynamicWriter(id) {
  for (const prefix of DYNAMIC_WRITERS.keys()) {
    if (prefix.endsWith('_') ? id.startsWith(prefix) : id === prefix) return true;
  }
  return false;
}

function scenePaths() {
  const paths = [];
  for (const dir of [join(REPO, 'claude-scene', 'scenes'), join(REPO, '.claude', 'scenes')]) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.json')) paths.push(join(dir, name));
    }
  }
  return paths;
}

function sceneConditions() {
  const out = [];
  for (const file of scenePaths()) {
    const scene = JSON.parse(readFileSync(file, 'utf-8'));
    for (const step of scene.flow || []) {
      if (typeof step.condition === 'string' && step.condition.trim()) {
        out.push({
          file: file.slice(REPO.length + 1),
          where: `${scene.scene_id || scene.workflow || '?'}:${step.step}`,
          condition: step.condition,
        });
      }
    }
  }
  return out;
}

const predicates = new Set(CONDITION_PREDICATES);

describe('场景条件契约', () => {
  const writers = collectWriters();

  it('条件里引用的每个标识符都能求值（谓词或真被写过的 ctx 键）', () => {
    const unknown = [];
    for (const { file, where, condition } of sceneConditions()) {
      for (const id of conditionIdentifiers(condition)) {
        if (predicates.has(id) || writers.has(id) || isDynamicWriter(id)) continue;
        unknown.push(`${file} ${where}: 条件 "${condition}" 引用了 ${id}（既不是谓词，也没有任何地方往 context 上写它）→ 恒假`);
      }
    }
    expect(unknown, `未定义的条件标识符：\n${unknown.join('\n')}`).toEqual([]);
  });

  it('内置谓词必须至少被一个场景条件用到（定义了没人读 = 将来的恒假陷阱）', () => {
    const used = new Set();
    const modeIncludes = new Set();
    for (const { condition } of sceneConditions()) {
      for (const id of conditionIdentifiers(condition)) used.add(id);
      // 场景里大量用 `selected_modes.includes('ai_design')` 这种直写形式；
      // 同名的谓词是它的别名，只要行为完全一致就可以不算「没人读」。
      for (const m of condition.matchAll(/includes\('(\w+)'\)/g)) modeIncludes.add(m[1]);
    }
    const unused = CONDITION_PREDICATES.filter((name) => {
      if (used.has(name)) return false;
      if (!modeIncludes.has(name)) return true;
      // 别名也必须真的等价于 selected_modes.includes(name)，不许白拿免死金牌
      return !(
        evaluateCondition(name, { selected_modes: [name] }) === true
        && evaluateCondition(name, { selected_modes: [] }) === false
      );
    });
    expect(
      unused,
      `这些谓词没有任何场景条件引用，请接线或删除：\n${unused.join('\n')}\n`
      + `（若确实要保留，请在 DYNAMIC_WRITERS 旁写明理由，不要放宽断言）`,
    ).toEqual([]);
  });

  it('动态写入的键必须真的存在写入方', () => {
    const files = Object.fromEntries(
      [...DYNAMIC_WRITERS].map(([id, reason]) => [id, reason]),
    );
    for (const [id, reason] of Object.entries(files)) {
      expect(reason, `${id} 缺写入方说明`).toMatch(/\.js/);
    }
    // enh_ 前缀：enhancements.js 里必须真有 computed write
    const enh = readFileSync(join(SRC, 'lib', 'enhancements.js'), 'utf-8');
    expect(enh).toMatch(/context\[`enh_\$\{/);
    // setup_kind：start.js 的 actionMap 里必须真映射到它
    const start = readFileSync(join(SRC, 'commands', 'start.js'), 'utf-8');
    expect(start).toMatch(/selectSetupKind:\s*'setup_kind'/);
  });
});
