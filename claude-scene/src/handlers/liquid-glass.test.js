import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleApplyLiquidGlass } from './liquid-glass.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'liquid-glass-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('handleApplyLiquidGlass', () => {
  it('生成 GlassExample.tsx 与 README.md（无 package.json 时跳过安装不中断）', () => {
    // tmpDir 没有 package.json → 依赖安装应被跳过，但脚手架应继续生成
    const result = handleApplyLiquidGlass(tmpDir, {});
    expect(result).toContain('Liquid Glass 应用完成');
    expect(existsSync(join(tmpDir, 'src', 'components', 'liquid-glass', 'GlassExample.tsx'))).toBe(true);
    expect(existsSync(join(tmpDir, 'src', 'components', 'liquid-glass', 'README.md'))).toBe(true);
    expect(result).toContain('跳过依赖安装');
  });

  it('示例组件包含 LiquidGlass 包装与关键 props', () => {
    handleApplyLiquidGlass(tmpDir, {});
    const example = readFileSync(join(tmpDir, 'src', 'components', 'liquid-glass', 'GlassExample.tsx'), 'utf8');
    expect(example).toContain("import LiquidGlass from 'liquid-glass-react'");
    expect(example).toContain('export function GlassCard');
    expect(example).toContain('export function GlassButton');
    expect(example).toContain('displacementScale');
    expect(example).toContain('aberrationIntensity');
  });

  it('README 记录浏览器兼容性限制', () => {
    handleApplyLiquidGlass(tmpDir, {});
    const readme = readFileSync(join(tmpDir, 'src', 'components', 'liquid-glass', 'README.md'), 'utf8');
    expect(readme).toContain('liquid-glass-react');
    expect(readme).toContain('Safari/Firefox');
    expect(readme).toContain('mouseContainer');
  });

  it('写入 context.liquid_glass_applied 标记', () => {
    const context = {};
    handleApplyLiquidGlass(tmpDir, context);
    expect(context.liquid_glass_applied).toBe(true);
  });

  it('幂等：重复调用覆盖旧文件不报错', () => {
    handleApplyLiquidGlass(tmpDir, {});
    const result = handleApplyLiquidGlass(tmpDir, {});
    expect(result).toContain('Liquid Glass 应用完成');
  });

  it('目标目录已有 src/components 时不冲突', () => {
    mkdirSync(join(tmpDir, 'src', 'components'), { recursive: true });
    writeFileSync(join(tmpDir, 'src', 'components', 'Button.tsx'), 'export const Button = () => null\n', 'utf8');
    handleApplyLiquidGlass(tmpDir, {});
    expect(existsSync(join(tmpDir, 'src', 'components', 'Button.tsx'))).toBe(true);
    expect(existsSync(join(tmpDir, 'src', 'components', 'liquid-glass', 'GlassExample.tsx'))).toBe(true);
  });
});
