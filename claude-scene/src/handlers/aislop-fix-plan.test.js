import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { planAutoFix, readDisabledRules } from './aislop.js';
// 回归：543 处「可修复」全是 console-leftover / narrative-comment 那类
// 「fix = 删行」的规则；只看条数放行的话，safe 模式修 0 处，
// 不带 safe 会删掉 344 行注释和整片 console.log。
describe('planAutoFix 按规则判断能不能自动修', () => {
  const diag = (rule, engine, fixable = true) => ({ rule, engine, fixable });

  it('只有机械重写类规则时才放行', () => {
    const plan = planAutoFix([
      diag('ruff/F401', 'lint'),
      diag('ruff/I001', 'lint'),
      diag('python-formatting', 'format'),
      diag('ai-slop/unused-import', 'ai-slop'),
    ]);
    expect(plan.ok).toBe(true);
    expect(plan.reason).toBe('ok');
    expect(plan.fixable).toBe(4);
  });

  it('删代码/删注释类规则一律拦住，并列出是哪几条', () => {
    const plan = planAutoFix([
      diag('ai-slop/console-leftover', 'ai-slop'),
      diag('ruff/F401', 'lint'),
    ]);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe('risky-rules');
    expect(plan.risky.map((r) => r.rule)).toContain('ai-slop/console-leftover');
  });

  it('配置里主动关掉的规则也算危险（fix 不认 config，会照删）', () => {
    const plan = planAutoFix(
      [diag('ai-slop/narrative-comment', 'ai-slop')],
      { configDisabledRules: new Set(['ai-slop/narrative-comment']) },
    );
    expect(plan.reason).toBe('config-ignored');
    expect(plan.disabled[0].rule).toBe('ai-slop/narrative-comment');
  });

  it('超上限时说明是条数问题，不是规则问题', () => {
    const many = Array.from({ length: 5 }, () => diag('ruff/F401', 'lint'));
    const plan = planAutoFix(many, { maxFindings: 3 });
    expect(plan.reason).toBe('over-limit');
    expect(plan.fixable).toBe(5);
  });

  it('没有可修复项时不动手', () => {
    expect(planAutoFix([{ rule: 'x/y', engine: 'x', fixable: false }]).reason).toBe('nothing');
  });
});

describe('readDisabledRules 读 .aislop/config.yml', () => {
  it('取出值为 off 的规则 id，其余忽略', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aislop-cfg-'));
    mkdirSync(join(dir, '.aislop'), { recursive: true });
    writeFileSync(join(dir, '.aislop', 'config.yml'), [
      'rules:',
      '  ai-slop/console-leftover: "off"',
      '  ai-slop/narrative-comment: off',
      '  security/hardcoded-secret: error',
      '',
    ].join('\n'));
    const rules = readDisabledRules(dir);
    expect([...rules].sort()).toEqual(['ai-slop/console-leftover', 'ai-slop/narrative-comment']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('没有配置文件时返回空集', () => {
    expect(readDisabledRules('/nonexistent-path-xyz').size).toBe(0);
  });
});

// 关键回归：`scan` 认 .aislop/config.yml（关掉的规则不出现在诊断里），
// 但 `aislop fix` 不认 —— 只看诊断就会放行，实测一次删掉 494 行。
describe('planAutoFix 不信任「config 已经把危险规则藏起来」', () => {
  it('诊断里只剩安全规则，但只要配置关过规则就拒跑 fix', () => {
    // 不依赖 cwd 里有没有 .aislop/config.yml，避免同一份测试在不同工作目录结果不一致
    const clean = planAutoFix([{ engine: 'lint', rule: 'ruff/F401', fixable: true }], { configDisabledRules: new Set() });
    const withConfig = planAutoFix(
      [{ engine: 'lint', rule: 'ruff/F401', fixable: true }],
      { configDisabledRules: new Set(['ai-slop/console-leftover']) },
    );

    expect(clean.ok).toBe(true);
    expect(withConfig.ok).toBe(false);
    expect(withConfig.reason).toBe('config-ignored');
    expect(withConfig.disabled[0].rule).toBe('ai-slop/console-leftover');
  });
});
