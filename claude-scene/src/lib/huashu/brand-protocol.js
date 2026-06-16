/**
 * Huashu Brand Asset Protocol: 5-step hard flow for any brand-specific design.
 * Adapted from huashu-design references/brand-asset-protocol.md.
 * Triggered when task mentions concrete brand/product names.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Detect brand mentions: capitalized product names, .com domains, well-known brands.
const KNOWN_BRANDS = [
  'apple', 'google', 'microsoft', 'amazon', 'meta', 'facebook', 'twitter', 'tesla',
  'stripe', 'linear', 'vercel', 'anthropic', 'openai', 'notion', 'figma', 'adobe',
  'github', 'gitlab', 'slack', 'discord', 'shopify', 'square',
  'dji', 'sony', 'samsung', 'xiaomi', 'huawei', 'oppo', 'vivo',
  'nike', 'adidas', 'gucci', 'louis vuitton', 'chanel',
  'lovart', 'huasheng', 'claude',
];

export function detectBrandMention(text = '') {
  if (!text) return null;
  const lower = text.toLowerCase();
  const found = KNOWN_BRANDS.filter(b => lower.includes(b));
  if (found.length > 0) return { type: 'known', brands: found };
  // Capitalized 2-word product names like "Pocket 4", "Galaxy S25"
  const productPattern = /\b([A-Z][a-z]+(?:\s+[A-Z0-9][a-z0-9]*){0,2})\b/g;
  const matches = [...text.matchAll(productPattern)].map(m => m[1]).filter(s => s.length > 3);
  if (matches.length > 0) return { type: 'inferred', brands: [...new Set(matches)].slice(0, 5) };
  return null;
}

export const ASSET_PRIORITY = [
  { key: 'logo', priority: 1, required: 'always', source: '<brand>.com/brand · <brand>.com/press · brand.<brand>.com · 官网 header inline SVG' },
  { key: 'product_image', priority: 2, required: 'physical_product', source: '产品详情页 hero · 官方 YouTube launch film 截帧 · 官方新闻稿附图' },
  { key: 'ui_screenshot', priority: 2, required: 'digital_product', source: 'App Store/Google Play 截图 · 官网 screenshots · 演示视频截帧' },
  { key: 'color_palette', priority: 3, required: 'helpful', source: '官网 inline CSS · Tailwind config · brand guidelines PDF' },
  { key: 'typography', priority: 4, required: 'helpful', source: 'brand guidelines · 网站 font-family stack' },
  { key: 'tone_keywords', priority: 5, required: 'self_check', source: 'agent 自检用' },
];

export function generateAssetChecklist(brand) {
  return `关于 ${brand}，你手上有以下哪些资料？我按优先级列：
1. Logo（SVG / 高清 PNG）—— 任何品牌必备
2. 产品图 / 官方渲染图 —— 实体产品必备
3. UI 截图 / 界面素材 —— 数字产品必备
4. 色值清单（HEX / RGB / 品牌色盘）
5. 字体清单（Display / Body）
6. Brand guidelines PDF / Figma design system / 品牌官网链接

有的直接发我，没有的我去搜/抓/生成。`;
}

export function writeBrandSpec(targetPath, brand, assets = {}) {
  const dir = join(targetPath, '.claude', 'brand-specs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `${brand.toLowerCase().replace(/\s+/g, '-')}.md`);
  const content = `# Brand Spec: ${brand}

> 由 huashu brand-asset-protocol 生成
> 生成时间: ${new Date().toISOString()}

## 资产清单状态

| 资产 | 优先级 | 状态 | 路径/值 |
|------|--------|------|---------|
| Logo | P1 | ${assets.logo ? '✅ 已提供' : '⚠ 待补'} | ${assets.logo || '-'} |
| 产品图 | P2 | ${assets.product_image ? '✅ 已提供' : '⚠ 待补'} | ${assets.product_image || '-'} |
| UI 截图 | P2 | ${assets.ui_screenshot ? '✅ 已提供' : '⚠ 待补'} | ${assets.ui_screenshot || '-'} |
| 主色值 | P3 | ${assets.color_palette ? '✅ 已提供' : '⚠ 待补'} | ${assets.color_palette || '-'} |
| 字体 | P4 | ${assets.typography ? '✅ 已提供' : '⚠ 待补'} | ${assets.typography || '-'} |
| 气质关键词 | P5 | ${assets.tone_keywords ? '✅ 已提供' : '⚠ 待补'} | ${assets.tone_keywords || '-'} |

## 兜底策略

- 资产缺失时：先停下问用户索取，不要 generic 填充
- 实在拿不到：明确告知用户使用的替代方案（CSS 剪影/通用插画/纯排版方案）
- 严禁 AI 生成 logo
`;
  writeFileSync(file, content, 'utf8');
  return file;
}

export function runProtocol({ targetPath, requirement = '', context = {} } = {}) {
  const detection = detectBrandMention(requirement);
  if (!detection) {
    return { triggered: false };
  }

  const brand = detection.brands[0];
  const specFile = writeBrandSpec(targetPath, brand, {});

  if (context) {
    context.brand_protocol_triggered = true;
    context.detected_brands = detection.brands;
    context.brand_spec_file = specFile;
  }

  return {
    triggered: true,
    brand,
    detection,
    spec_file: specFile,
    checklist: generateAssetChecklist(brand),
  };
}
