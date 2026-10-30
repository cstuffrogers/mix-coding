import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `.claude/commands/*.md` 里写的「N 步」必须等于场景真实的步数。
 *
 * 取证（2026-10-30）：一次对账就冒出 12 份文档对不上 —— `refactor.md` 写「24 步」而场景
 * 是 30 步，`loop.md` 写 12 步而场景 18 步，`setup.md` 写 9 步而场景 14 步，`mobile-e2e.md`
 * 的 frontmatter 写 `12-step` 而同文件正文写「13 步」。这些数字没有任何东西看着：
 * README 的步数有 `check-readme-stats.cjs` 守着，`.claude/commands/` 一个守卫都没有，
 * 于是场景每加两步，文档就落后两步，而任何「/check」都看不见。
 *
 * 判据：能核的数字就要核 —— 文档里当总数报的步数（frontmatter 的 `N-step workflow` 与
 * 正文首段的 `N 步…工作流`）一律与场景 `flow` 的条目数相等。
 * 刻意不碰子链条的步数（如 new-project 的 `18-step polish chain`、ui-polish 的
 * 「Phase 0 全部 10 步」）：那不是整条工作流的步数，正则分不清就会制造假红。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCENES = join(ROOT, 'claude-scene', 'scenes');
const COMMANDS = join(ROOT, '.claude', 'commands');

/** 场景的真实步数：`flow` 可能是对象也可能是数组，两种都算。 */
function sceneSteps() {
  const out = new Map();
  for (const file of readdirSync(SCENES).filter((f) => f.endsWith('.json'))) {
    const scene = JSON.parse(readFileSync(join(SCENES, file), 'utf-8'));
    const flow = scene.flow ?? {};
    const count = Array.isArray(flow) ? flow.length : Object.keys(flow).length;
    if (count > 0) out.set(file.replace('.json', ''), count);
  }
  return out;
}

/** frontmatter 里 `N-step workflow`（子链条常写成 `18-step polish chain`，不算）。 */
const FRONTMATTER_CLAIM = /(\d{1,3})-step workflow/;
/** 正文首段的 `N 步…工作流`（中间可以夹定语，如「全对话模式」）。 */
const INTRO_CLAIM = /(\d{1,3})\s*步[^：:，。]{0,8}工作流/;

describe('.claude/commands 的步数与场景一致', () => {
  it('文档里当总数报的步数都等于场景真实步数', () => {
    const steps = sceneSteps();
    const offenders = [];
    let checked = 0;

    for (const file of readdirSync(COMMANDS).filter((f) => f.endsWith('.md'))) {
      const id = file.replace('.md', '');
      const actual = steps.get(id);
      if (actual === undefined) continue;
      const lines = readFileSync(join(COMMANDS, file), 'utf-8').split('\n');
      const claims = [];
      const fm = lines[1] ?? '';
      const fmMatch = FRONTMATTER_CLAIM.exec(fm);
      if (fmMatch) claims.push(['frontmatter', fmMatch[1]]);
      for (const line of lines.slice(0, 20)) {
        const introMatch = INTRO_CLAIM.exec(line);
        if (introMatch) {
          claims.push(['intro', introMatch[1]]);
          break;
        }
      }
      for (const [where, claimed] of claims) {
        checked += 1;
        if (Number(claimed) !== actual) offenders.push(`${file} ${where} 写 ${claimed}，场景是 ${actual}`);
      }
    }

    // 自证非空跑：一份文档都没解析出来、或正则失配，这条断言就是假证据
    expect(checked, '一份文档的步数都没解析到 —— 正则塌了').toBeGreaterThanOrEqual(10);
    expect(offenders, '命令行文档的步数是过期的').toEqual([]);
  });

  it('场景自己的 description 里报的步数也对得上', () => {
    const steps = sceneSteps();
    const offenders = [];
    for (const file of readdirSync(SCENES).filter((f) => f.endsWith('.json'))) {
      const id = file.replace('.json', '');
      const scene = JSON.parse(readFileSync(join(SCENES, file), 'utf-8'));
      // 只认两位数以上的「N 步」：`5 步品牌资产清单` 这类是子步骤，不是总数
      const match = /(\d{2,3})\s*步/.exec(String(scene.description ?? ''));
      if (!match) continue;
      if (Number(match[1]) !== steps.get(id)) offenders.push(`${file} 写 ${match[1]}，实际 ${steps.get(id)}`);
    }
    expect(offenders, '场景 description 里的步数是过期的').toEqual([]);
  });
});
