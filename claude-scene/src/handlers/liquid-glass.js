import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';
import { ensureDir } from '../lib/fs-utils.js';

// Liquid Glass（liquid-glass-react）脚手架：
// 不做正则改写 JSX（风险高），而是生成可直接引用的示例组件 + 使用文档，
// 由会话模式下的 agent 或开发者按页面逐个套用 <LiquidGlass> 包装。
const LIQUID_GLASS_EXAMPLE = `import LiquidGlass from 'liquid-glass-react'

/**
 * Liquid Glass 示例卡片 —— Apple 液态玻璃效果。
 * 需要背景有内容/图片时效果最佳；Safari/Firefox 仅部分支持（位移不可见）。
 */
export function GlassCard() {
  return (
    <LiquidGlass
      displacementScale={70}
      blurAmount={0.125}
      saturation={140}
      aberrationIntensity={2}
      elasticity={0.15}
      cornerRadius={24}
      padding="24px"
    >
      <div>
        <h3 className="text-white font-semibold">液态玻璃卡片</h3>
        <p className="text-white/80">背景内容透过玻璃折射，边缘带高光与色散。</p>
      </div>
    </LiquidGlass>
  )
}

/** 按钮形态：更小位移、全圆角、低弹性 */
export function GlassButton({ onClick, children }: { onClick?: () => void; children?: React.ReactNode }) {
  return (
    <LiquidGlass
      displacementScale={64}
      blurAmount={0.1}
      saturation={130}
      aberrationIntensity={2}
      elasticity={0.35}
      cornerRadius={100}
      padding="8px 16px"
      onClick={onClick}
    >
      <span className="text-white font-medium">{children ?? 'Click Me'}</span>
    </LiquidGlass>
  )
}
`

const LIQUID_GLASS_README = `# Liquid Glass 使用指南

组件库：[liquid-glass-react](https://github.com/rdev/liquid-glass-react)（Apple 液态玻璃效果）

## 快速上手

\`\`\`tsx
import LiquidGlass from 'liquid-glass-react'
import { GlassCard, GlassButton } from './components/liquid-glass/GlassExample'
\`\`\`

## 常用 Props

| Prop | 默认 | 说明 |
|------|------|------|
| displacementScale | 70 | 位移/折射强度 |
| blurAmount | 0.125 | 磨砂程度（0-1） |
| saturation | 140 | 饱和度提升（%） |
| aberrationIntensity | 2 | 色散强度 |
| elasticity | 0.15 | 弹性（Apple "liquid" 手感） |
| cornerRadius | 24 | 圆角 |
| padding | '24px' | 内边距 |
| mouseContainer | - | 鼠标跟随容器 ref |

## 注意事项

- **Safari/Firefox 仅部分支持**：位移（displacement）不可见，仅剩模糊/饱和度。
- 需要背景有内容（图片/渐变/彩色区块）时效果才明显，纯色背景上几乎不可见。
- 大面积使用会拖慢渲染（每个实例一个 WebGL 上下文），优先用于卡片/按钮/导航等小面积元素。
- React >= 18。SSR 环境需动态导入（组件依赖浏览器 API）。
`

export function handleApplyLiquidGlass(targetPath, context) {
  const results = [];

  // 1. 安装依赖（幂等；无 package.json 时跳过，避免 npm 向上冒泡污染其他包）
  const hasPkg = existsSync(join(targetPath, 'package.json'));
  if (hasPkg) {
    try {
      safeExec('npm install liquid-glass-react', targetPath, { stdio: 'ignore' });
      results.push('依赖 liquid-glass-react 安装完成');
    } catch (e) {
      results.push(`依赖安装失败: ${e.message}`);
    }
  } else {
    results.push('跳过依赖安装（目标目录无 package.json；请先 npm init 或手动安装）');
  }

  // 2. 生成示例组件（src/components/liquid-glass/）
  const componentDir = join(targetPath, 'src', 'components', 'liquid-glass');
  try {
    ensureDir(componentDir);
    writeFileSync(join(componentDir, 'GlassExample.tsx'), LIQUID_GLASS_EXAMPLE, 'utf8');
    writeFileSync(join(componentDir, 'README.md'), LIQUID_GLASS_README, 'utf8');
    results.push('示例组件生成完成: src/components/liquid-glass/GlassExample.tsx');
  } catch (e) {
    results.push(`示例组件生成失败: ${e.message}`);
  }

  if (context) {
    context.liquid_glass_applied = true;
  }
  return `Liquid Glass 应用完成：${results.join('；')}`;
}
