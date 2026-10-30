import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 场景技能的「触发面」是 description，而 description 之前没有任何东西看着。
 *
 * 第四十轮的起点是一个用户问题：「我在 percho 里输入『做视觉设计』，会自动调用 ui-polish 吗？」
 * 答案是不稳 —— 旧 description 只列了斜杠命令，用户说人话时模型没依据把请求接到场景上。
 * 补上「人话 → 场景」映射之后，同一个坑还在：**映射里写错一个场景名，症状是「偶尔不灵」**，
 * 没有任何东西会红。本文件把这段文本变成可核的：
 *
 *   1. 每一处 `…→<场景>` 的目标必须是真存在的场景（`ui_polish` 这种下划线写法、改名后的
 *      旧 id、手滑的 `ui-polishh` 都在这里现形）；
 *   2. 映射条数有下限 —— 哪天有人把这段删掉，断言先红，而不是等用户发现「怎么不灵了」；
 *   3. 中英两份副本都要有（pi 按语言/副本挑一份加载，只改一份等于只在一半场景生效）。
 *
 * 说明边界：**这测不了「模型会不会真的选中它」** —— 那是一次模型判断。这里只保证文本本身
 * 没有说谎：目标存在、映射在、两份都在。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** 技能目录里同名文件可能不止一份（pi 的发现目录 + 仓库内副本）。 */
const SKILL_COPIES = [
  { label: 'zh (.pi)', path: join(ROOT, '.pi', 'skills', 'scene-runner', 'SKILL.md') },
  { label: 'en (.agents)', path: join(ROOT, '.agents', 'skills', 'scene-runner', 'SKILL.md') },
];

/** 场景 id → 文件，用来校验映射目标。 */
function sceneIds() {
  const dir = join(ROOT, 'claude-scene', 'scenes');
  return new Set(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')));
}

/** frontmatter 里的 description（可能跨行，取到下一个 `key:` 或 `---` 为止）。 */
function description(text) {
  const match = /^description:\s*([\s\S]*?)(?:\n[a-z_]+:|\n---)/m.exec(text);
  return match ? match[1] : '';
}

describe('scene-runner 的触发面（description）', () => {
  it('每一处「人话 → 场景」的目标都是真场景', () => {
    const ids = sceneIds();
    expect(ids.size, '场景目录读不到 —— 这条断言没有意义').toBeGreaterThanOrEqual(20);
    const offenders = [];
    let arrows = 0;
    for (const copy of SKILL_COPIES) {
      const text = readFileSync(copy.path, 'utf-8');
      const desc = description(text);
      expect(desc, `${copy.label} 没有 description`).not.toBe('');
      for (const m of desc.matchAll(/→\s*([A-Za-z0-9_*-]+)/g)) {
        arrows += 1;
        const target = m[1];
        if (target.endsWith('*')) continue; // `/mobile-*` 这类通配
        if (!ids.has(target)) offenders.push(`${copy.label}: →${target} 不是真场景`);
      }
    }
    // 映射被整段删掉、或正则失配，都要在这里红 —— 否则「目标都存在」是空话
    expect(arrows, '两份副本里一条「→场景」映射都没解析到').toBeGreaterThanOrEqual(8);
    expect(offenders).toEqual([]);
  });

  it('description 里点名的斜杠命令都能落到场景', () => {
    const ids = sceneIds();
    const offenders = [];
    for (const copy of SKILL_COPIES) {
      const desc = description(readFileSync(copy.path, 'utf-8'));
      for (const m of desc.matchAll(/\/([a-z][a-z0-9-]*)/g)) {
        const name = m[1];
        if (name.endsWith('-')) continue; // `/mobile-*` 通配
        // 命令名与场景名一致是本仓库的约定（/mobile-e2e → mobile-e2e）
        if (!ids.has(name)) offenders.push(`${copy.label}: /${name} 没有同名场景`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('关键触发词不许被删掉（用户最先说的那几句）', () => {
    const zh = description(readFileSync(SKILL_COPIES[0].path, 'utf-8'));
    const en = description(readFileSync(SKILL_COPIES[1].path, 'utf-8'));
    // 中文副本：用户原话「做视觉设计」必须真的能落到 ui-polish 上
    expect(zh).toMatch(/视觉设计[^。]*→\s*ui-polish/);
    expect(zh).toContain('bugfix');
    // 英文副本同样是触发面（pi 按副本加载，只改一份等于一半失效）
    expect(en).toMatch(/visual design[^.]*ui-polish/i);
  });
});
