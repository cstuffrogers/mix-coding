import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { countCssVariables, countTailwindClasses, detectFramework, handleReconcileDesignTokens } from './ui-tools.js';

let tmp;
beforeEach(() => {
  tmp = join(process.cwd(), `.ui-tools-tmp-${randomBytes(4).toString('hex')}`);
  mkdirSync(tmp, { recursive: true });
});
afterEach(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ok */ } });

describe('countCssVariables', () => {
  it('counts CSS custom properties and hardcoded colors separately', () => {
    const css = join(tmp, 'a.css');
    writeFileSync(css, ':root { --color-paper: #fff; --accent: rgb(0,0,0); } .x { color: #abc; background: rgba(0,0,0,.5); }');
    const r = countCssVariables([css]);
    expect(r.cssVarCount).toBe(2);
    expect(r.hardcodedColorCount).toBe(4); // #fff, rgb(, #abc, rgba(
  });

  it('returns zeros for an unreadable file without throwing', () => {
    const r = countCssVariables([join(tmp, 'missing.css')]);
    expect(r.cssVarCount).toBe(0);
    expect(r.hardcodedColorCount).toBe(0);
  });

  it('caps at 50 files', () => {
    const files = Array.from({ length: 60 }, (_, i) => {
      const f = join(tmp, `f${i}.css`);
      writeFileSync(f, '--v: 1');
      return f;
    });
    // Only first 50 are read; ensure no throw on 60.
    const r = countCssVariables(files);
    expect(r.cssVarCount).toBe(50);
  });
});

describe('countTailwindClasses', () => {
  it('counts className strings containing layout/utility classes', () => {
    const f = join(tmp, 'c.jsx');
    writeFileSync(f, '<div className="flex p-4 bg-white rounded">a</div><span className="text-sm">b</span><i className="custom-thing">c</i>');
    expect(countTailwindClasses([f])).toBe(2);
  });

  it('ignores className without recognized utility tokens', () => {
    const f = join(tmp, 'c.jsx');
    writeFileSync(f, '<div className="custom-only">a</div>');
    expect(countTailwindClasses([f])).toBe(0);
  });
});

describe('detectFramework', () => {
  it('detects Next.js when react + next are present', () => {
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ dependencies: { react: '18', next: '14' } }));
    expect(detectFramework(tmp)).toBe('Next.js');
  });
  it('detects plain React without next', () => {
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ dependencies: { react: '18' } }));
    expect(detectFramework(tmp)).toBe('React');
  });
  it('detects Nuxt vs Vue', () => {
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ dependencies: { vue: '3', nuxt: '3' } }));
    expect(detectFramework(tmp)).toBe('Nuxt');
    const tmp2 = join(tmp, 'p2'); mkdirSync(tmp2, { recursive: true });
    writeFileSync(join(tmp2, 'package.json'), JSON.stringify({ dependencies: { vue: '3' } }));
    expect(detectFramework(tmp2)).toBe('Vue');
  });
  it('returns unknown when package.json is missing', () => {
    expect(detectFramework(join(tmp, 'nope'))).toBe('unknown');
  });
  it('returns unknown for malformed package.json', () => {
    writeFileSync(join(tmp, 'package.json'), '{ not json');
    expect(detectFramework(tmp)).toBe('unknown');
  });
});

describe('handleReconcileDesignTokens', () => {
  it('skips with a message when context is missing', () => {
    const res = handleReconcileDesignTokens({}, {}, tmp, null);
    expect(res).toBe('设计 Token 调和跳过（缺少上下文）');
  });

  it('returns zero-count message and writes context fields on an empty project', () => {
    const ctx = {};
    const res = handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(res).toBe('设计 Token 调和完成: 0 处已有 Token 保留');
    expect(ctx.reconciledTokens).toBeDefined();
    expect(ctx.reconciledValues).toBeDefined();
    expect(ctx.reconciledTokens.brand).toEqual([]);
    expect(ctx.reconciledValues.colors).toEqual({});
  });

  it('detects open-design brand CSS from context when >=5 vars present', () => {
    const ctx = {
      od_brand_css: ':root { --brand-color: 1; --font-sans: 2; --spacing-md: 3; --radius-lg: 4; --shadow-sm: 5; --duration-fast: 6; }',
    };
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    // All six token categories pushed because vars contain font/spacing/radius/shadow/duration.
    expect(ctx.reconciledTokens.brand).toContain('open-design:brand (context)');
    expect(ctx.reconciledTokens.fonts).toContain('open-design:font (context)');
    expect(ctx.reconciledTokens.spacing).toContain('open-design:spacing (context)');
    expect(ctx.reconciledTokens.radii).toContain('open-design:radius (context)');
    expect(ctx.reconciledTokens.shadows).toContain('open-design:shadow (context)');
    expect(ctx.reconciledTokens.motion).toContain('open-design:motion (context)');
  });

  it('ignores open-design brand CSS when fewer than 5 vars', () => {
    const ctx = { od_brand_css: ':root { --a: 1; --b: 2; }' };
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(ctx.reconciledTokens.brand).not.toContain('open-design:brand (context)');
  });

  it('detects tokens in .claude/designs/ design-baseline.md and design-system.md', () => {
    const designsDir = join(tmp, '.claude', 'designs');
    mkdirSync(designsDir, { recursive: true });
    writeFileSync(join(designsDir, 'design-baseline.md'), '# Palette\n oklch(0.5 0.1 240); typography font; spacing; radius; shadow; motion duration easing;');
    writeFileSync(join(designsDir, 'design-system.md'), '# color #fff; typeface font; spacing; border-radius; elevation; animation;');
    const ctx = {};
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    // Each design file should be referenced in brand (color regex hits both).
    expect(ctx.reconciledTokens.brand.length).toBeGreaterThanOrEqual(2);
    expect(ctx.reconciledTokens.fonts.length).toBeGreaterThanOrEqual(2);
    expect(ctx.reconciledTokens.spacing.length).toBeGreaterThanOrEqual(2);
    expect(ctx.reconciledTokens.radii.length).toBeGreaterThanOrEqual(2);
    expect(ctx.reconciledTokens.shadows.length).toBeGreaterThanOrEqual(2);
    expect(ctx.reconciledTokens.motion.length).toBeGreaterThanOrEqual(2);
  });

  it('detects brand/font/spacing tokens in DESIGN.md', () => {
    writeFileSync(join(tmp, 'DESIGN.md'), 'brand guidelines. font typography. spacing scale.');
    const ctx = {};
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(ctx.reconciledTokens.brand).toContain('DESIGN.md');
    expect(ctx.reconciledTokens.fonts).toContain('DESIGN.md');
    expect(ctx.reconciledTokens.spacing).toContain('DESIGN.md');
  });

  it('detects tokens in tailwind.config.js and stops at the first config found', () => {
    writeFileSync(join(tmp, 'tailwind.config.js'), 'module.exports = { theme: { colors: {}, fontFamily: {}, borderRadius: {}, boxShadow: {} } }');
    writeFileSync(join(tmp, 'tailwind.config.ts'), '// should not be read');
    const ctx = {};
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(ctx.reconciledTokens.brand).toContain('tailwind.config.js');
    expect(ctx.reconciledTokens.fonts).toContain('tailwind.config.js');
    expect(ctx.reconciledTokens.radii).toContain('tailwind.config.js');
    expect(ctx.reconciledTokens.shadows).toContain('tailwind.config.js');
  });

  it('detects tokens in tailwind.config.mjs when js/ts absent', () => {
    writeFileSync(join(tmp, 'tailwind.config.mjs'), 'export default { theme: { colors: {}, fontFamily: {} } }');
    const ctx = {};
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(ctx.reconciledTokens.brand).toContain('tailwind.config.mjs');
    expect(ctx.reconciledTokens.fonts).toContain('tailwind.config.mjs');
  });

  it('scans CSS files: pushes existing-token sources and extracts values by category', () => {
    writeFileSync(join(tmp, 'a.css'), `
      :root {
        --color-primary: #6366f1;
        --font-sans: Inter;
        --spacing-md: 16px;
        --radius-lg: 8px;
        --shadow-sm: 0 1px 2px;
        --duration-fast: 150ms;
      }
      @media (prefers-reduced-motion) {}
    `);
    const ctx = {};
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(ctx.reconciledTokens.brand.length).toBeGreaterThanOrEqual(1);
    expect(ctx.reconciledTokens.fonts.length).toBeGreaterThanOrEqual(1);
    expect(ctx.reconciledTokens.spacing.length).toBeGreaterThanOrEqual(1);
    expect(ctx.reconciledTokens.radii.length).toBeGreaterThanOrEqual(1);
    expect(ctx.reconciledTokens.shadows.length).toBeGreaterThanOrEqual(1);
    expect(ctx.reconciledTokens.motion.length).toBeGreaterThanOrEqual(1);
    // Value extraction: --color-primary is a color (includes 'color' and 'primary').
    expect(ctx.reconciledValues.colors['color-primary']).toBe('#6366f1');
    expect(ctx.reconciledValues.fonts['font-sans']).toBe('Inter');
    expect(ctx.reconciledValues.spacing['spacing-md']).toBe('16px');
    expect(ctx.reconciledValues.radii['radius-lg']).toBe('8px');
    expect(ctx.reconciledValues.shadows['shadow-sm']).toBe('0 1px 2px');
    expect(ctx.reconciledValues.motion['duration-fast']).toBe('150ms');
  });

  it('routes CSS vars into colors via bg/background/text name keywords', () => {
    writeFileSync(join(tmp, 'b.css'), ':root { --accent-bg: red; --text-strong: black; --secondary: blue; }');
    const ctx = {};
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(ctx.reconciledValues.colors['accent-bg']).toBe('red');
    expect(ctx.reconciledValues.colors['text-strong']).toBe('black');
    expect(ctx.reconciledValues.colors['secondary']).toBe('blue');
  });

  it('routes font-family and gap/motion-ease CSS vars into their categories', () => {
    writeFileSync(join(tmp, 'c.css'), ':root { --family-display: serif; --gap-row: 10px; --ease-out: cubic-bezier(0,0,0,1); }');
    const ctx = {};
    handleReconcileDesignTokens({}, {}, tmp, ctx);
    expect(ctx.reconciledValues.fonts['family-display']).toBe('serif');
    expect(ctx.reconciledValues.spacing['gap-row']).toBe('10px');
    expect(ctx.reconciledValues.motion['ease-out']).toBe('cubic-bezier(0,0,0,1)');
  });

  it('survives an unreadable design file without throwing (catch branch)', () => {
    const designsDir = join(tmp, '.claude', 'designs');
    mkdirSync(designsDir, { recursive: true });
    // Create a path that exists as a directory (readFileSync throws on dir).
    mkdirSync(join(designsDir, 'design-baseline.md'), { recursive: true });
    const ctx = {};
    expect(() => handleReconcileDesignTokens({}, {}, tmp, ctx)).not.toThrow();
  });

  it('aggregates totalExisting across all sources in the return message', () => {
    writeFileSync(join(tmp, 'DESIGN.md'), 'brand font spacing');
    writeFileSync(join(tmp, 'a.css'), ':root { --color-x: red; --font-y: serif; }');
    const ctx = {};
    const res = handleReconcileDesignTokens({}, {}, tmp, ctx);
    const match = res.match(/调和完成: (\d+) 处/);
    expect(match).not.toBeNull();
    const total = Number(match[1]);
    const expected = ctx.reconciledTokens.brand.length
      + ctx.reconciledTokens.fonts.length
      + ctx.reconciledTokens.spacing.length
      + ctx.reconciledTokens.radii.length
      + ctx.reconciledTokens.shadows.length
      + ctx.reconciledTokens.motion.length;
    expect(total).toBe(expected);
    expect(total).toBeGreaterThan(0);
  });
});
