import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { ensureDir } from '../lib/fs-utils.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { proposeThreeDirections, renderProposal } from '../lib/huashu/html-direction-advisor.js';
import { runProtocol as runBrandProtocol } from '../lib/huashu/brand-protocol.js';
import { review as runExpertReview } from '../lib/huashu/expert-review.js';
import { buildPrototype, validateWithPlaywright } from '../lib/huashu/prototype-builder.js';
import { generateReleaseAnimation } from '../lib/huashu/motion-engine.js';
import { generateReleaseDeck } from '../lib/huashu/deck-exporter.js';
import { renderInfographic } from '../lib/huashu/infographic.js';

export function handleGenerateDesign(_action, params, targetPath, context) {
  console.log(chalk.blue('\n🎨 正在生成AI设计方案...'));
  const requirement = context?.prompt || params?.requirement || '';
  const category = params?.category || 'web';
  const proposal = proposeThreeDirections({ category, requirement });
  console.log(renderProposal(proposal));
  if (context) {
    context.huashu_proposal = proposal;
    context.design_directions = ['A', 'B', 'C'];
    context.open_design_executed = true;
  }
  // Persist proposal for downstream steps
  try {
    const dir = join(targetPath, '.claude', 'designs');
    ensureDir(dir);
    writeFileSync(join(dir, `proposal-${Date.now()}.json`), JSON.stringify(proposal, null, 2), 'utf8');
  } catch { /* non-fatal */ }
  return '三方向设计提案已生成（huashu advisor）';
}

export function handleHuashuBrandProtocol(_action, params, targetPath, context) {
  const requirement = context?.prompt || params?.requirement || '';
  return runBrandProtocol({ targetPath, requirement, context });
}

export function handleHuashuExpertReview(_action, _params, targetPath, context) {
  return runExpertReview({ targetPath, context });
}

export function handleHuashuPrototype(_action, params, targetPath, context) {
  const requirement = context?.prompt || params?.requirement || 'Untitled prototype';
  const styleId = params?.styleId || context?.huashu_style_id || 'minimal-mono';
  const device = params?.device || context?.huashu_device || 'iphone';
  const screens = params?.screens || ['Home', 'Detail', 'Profile'];
  const result = buildPrototype({ targetPath, requirement, styleId, device, screens });
  if (context) context.huashu_prototype_file = result.file;
  if (params?.validate !== false) {
    const validation = validateWithPlaywright(targetPath, result.file);
    if (context) context.huashu_prototype_validation = validation;
  }
  return result;
}

export function handleHuashuReleaseAnimation(_action, params, targetPath, context) {
  const projectRoot = params?.projectRoot || targetPath;
  const title = params?.title || context?.releaseTitle || context?.version || 'Release';
  const version = params?.version || context?.version || 'v1.0.0';
  return generateReleaseAnimation({
    targetPath,
    projectRoot,
    title,
    version,
    duration: params?.duration || 5,
    outputFormat: params?.outputFormat || 'mp4',
  });
}

export function handleHuashuReleaseDeck(_action, params, targetPath, context) {
  const projectRoot = params?.projectRoot || targetPath;
  const title = params?.title || context?.releaseTitle || 'Release';
  const version = params?.version || context?.version || 'v1.0.0';
  const highlights = params?.highlights || context?.changelog_highlights || [];
  return generateReleaseDeck({ targetPath, projectRoot, title, version, highlights });
}

export function handleHuashuInfographic(_action, params, targetPath, context) {
  const title = params?.title || context?.report_title || 'Project Health';
  const subtitle = params?.subtitle || context?.report_subtitle || `生成于 ${new Date().toLocaleString()}`;
  const metrics = params?.metrics || context?.report_metrics || deriveMetricsFromContext(context);
  const sections = params?.sections || context?.report_sections || [];
  return renderInfographic({ targetPath, title, subtitle, metrics, sections });
}

function deriveMetricsFromContext(context = {}) {
  const m = [];
  if (context.huashu_review) {
    const r = context.huashu_review;
    m.push({ label: '设计总分', value: `${r.percent}%` });
  }
  if (context.securityScanResult) {
    m.push({
      label: '安全问题',
      value: context.securityScanResult.highSeverityFound ? 'HIGH' : 'OK',
      delta: context.securityScanResult.highSeverityFound ? '需修复' : '已通过',
      deltaPositive: !context.securityScanResult.highSeverityFound,
    });
  }
  if (typeof context.codeMetricsFindings === 'number') {
    m.push({ label: '复杂度问题', value: String(context.codeMetricsFindings) });
  }
  if (typeof context.antiPatternFindings === 'number') {
    m.push({ label: '反模式', value: String(context.antiPatternFindings) });
  }
  return m;
}

export function handleAnalyzeConsistency(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📏 正在检查设计一致性...'));
  if (context) context.consistency_checked = true;

  // Quick static check: count CSS variable usage vs hardcoded values
  try {
    const { readFileSync, existsSync } = require('fs');
    const { join } = require('path');
    const cssPath = join(targetPath, 'src', 'index.css');
    const globalsPath = join(targetPath, 'src', 'app', 'globals.css');
    for (const p of [cssPath, globalsPath, join(targetPath, 'styles', 'globals.css')]) {
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf-8');
        const varCount = (content.match(/var\(--[\w-]+\)/g) || []).length;
        const hexCount = (content.match(/#[0-9a-fA-F]{3,6}/g) || []).length;
        if (hexCount > varCount) {
          console.log(chalk.yellow(`  ⚠ ${path.basename(p)}: 硬编码颜色(${hexCount}) > CSS变量(${varCount})，建议提取设计 Token`));
        } else if (varCount > 0) {
          console.log(chalk.green(`  ✅ ${path.basename(p)}: ${varCount} CSS 变量引用, ${hexCount} 硬编码值`));
        }
      }
    }
  } catch { /* non-critical */ }

  console.log(chalk.green('  ✅ 设计一致性检查完成'));
  return '设计一致性检查完成';
}

export function handleExportAssets(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📦 正在导出设计资源...'));
  const designDir = join(targetPath, 'src', 'assets', 'design-system');
  ensureDir(designDir);

  let exportedCount = 0;

  // 1. Export CSS custom properties (design tokens)
  const tokensCss = join(designDir, 'tokens.css');
  let cssContent = '/* Design Tokens — auto-generated */\n:root {\n';

  // Use AWM brand CSS if available (from awm-brand-import step)
  const brandCss = context?.awm_brand_css;
  if (brandCss) {
    writeFileSync(tokensCss, brandCss, 'utf-8');
    console.log(chalk.green(`  ✓ tokens.css (品牌: ${context.user_selected_brand || 'custom'})`));
    exportedCount++;
  } else {
    // Try open-design Skill output first (.claude/designs/design-baseline.md)
    const baselinePath = join(targetPath, '.claude', 'designs', 'design-baseline.md');
    const systemPath = join(targetPath, '.claude', 'designs', 'design-system.md');
    let tokensFromSkill = null;
    for (const p of [baselinePath, systemPath]) {
      if (existsSync(p)) {
        try {
          const md = readFileSync(p, 'utf-8');
          // Extract CSS custom properties from Skill output markdown
          const cssMatch = md.match(/```css\n([\s\S]*?)```/);
          if (cssMatch) {
            tokensFromSkill = cssMatch[1];
          } else {
            // Extract individual --prop: value lines
            const propLines = md.match(/^--[\w-]+:\s*[^;]+;/gm);
            if (propLines && propLines.length >= 5) {
              tokensFromSkill = ':root {\n  ' + propLines.join('\n  ') + '\n}\n';
            }
          }
          if (tokensFromSkill) {
            console.log(chalk.dim(`  ℹ 从 open-design Skill 输出加载 Token (${path.basename(p)})`));
            break;
          }
        } catch { /* unreadable */ }
      }
    }

    if (tokensFromSkill) {
      writeFileSync(tokensCss, tokensFromSkill, 'utf-8');
      console.log(chalk.green('  ✓ tokens.css (open-design Skill)'));
      exportedCount++;
    } else {
      // Fallback: generate default design tokens
      const tokens = {
        '--color-primary': '#3B82F6',
        '--color-primary-light': '#60A5FA',
        '--color-primary-dark': '#2563EB',
        '--color-secondary': '#8B5CF6',
        '--color-accent': '#F59E0B',
        '--color-bg': '#F9FAFB',
        '--color-surface': '#FFFFFF',
        '--color-text': '#171717',
        '--color-text-muted': '#6B7280',
        '--color-border': '#E5E7EB',
        '--color-success': '#10B981',
        '--color-warning': '#F59E0B',
        '--color-error': '#EF4444',
        '--font-sans': 'system-ui, -apple-system, sans-serif',
        '--font-mono': 'ui-monospace, monospace',
        '--radius-sm': '0.25rem',
        '--radius-md': '0.5rem',
        '--radius-lg': '0.75rem',
        '--shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
        '--shadow-md': '0 4px 6px rgba(0,0,0,0.1)',
        '--shadow-lg': '0 10px 15px rgba(0,0,0,0.1)',
        '--spacing-xs': '0.25rem',
        '--spacing-sm': '0.5rem',
        '--spacing-md': '1rem',
        '--spacing-lg': '1.5rem',
        '--spacing-xl': '2rem',
      };
      for (const [key, value] of Object.entries(tokens)) {
        cssContent += `  ${key}: ${value};\n`;
      }
      cssContent += '}\n';
      writeFileSync(tokensCss, cssContent, 'utf-8');
      console.log(chalk.green(`  ✓ tokens.css (${Object.keys(tokens).length} 个默认 Token)`));
      exportedCount++;
    }
  }

  // 2. Export design spec markdown
  const specFile = join(designDir, 'design-spec.md');
  const variant = context?.design_variant || context?.design_selected || '未选择';
  const timestamp = new Date().toISOString().slice(0, 19);
  writeFileSync(specFile, [
    '# Design Specification',
    '',
    `- **生成时间**: ${timestamp}`,
    `- **方案**: ${variant}`,
    `- **风格**: ${context?.huashu_applied_style?.name || '默认'}`,
    context?.huashu_proposal ? `\n## 设计提案\n\n\`\`\`json\n${JSON.stringify(context.huashu_proposal, null, 2)}\n\`\`\`` : '',
    '',
    '## 设计 Token',
    '',
    '见 `tokens.css` — 通过 CSS 自定义属性导入：',
    '',
    '```css',
    "@import './tokens.css';",
    '```',
  ].join('\n'), 'utf-8');
  console.log(chalk.green(`  ✓ design-spec.md`));
  exportedCount++;

  console.log(chalk.green(`  ✅ 设计资源导出完成: ${exportedCount} 个文件 → ${designDir}`));
  return `设计资源导出完成: ${exportedCount} 个文件`;
}

export function handlePersist(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n💾 正在持久化设计数据...'));
  if (context) context.design_persisted = true;
  const designDir = join(targetPath, '.claude', 'designs');
  ensureDir(designDir);
  writeFileSync(join(designDir, 'current.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    variant: context?.design_variant || 'unknown',
    selected: context?.design_selected || 'unknown',
  }, null, 2), 'utf-8');
  console.log(chalk.green('  ✅ 设计数据已保存'));
  return '设计数据已持久化';
}

export function handleDesignInput(_action, params, _targetPath, context) {
  const { message, key } = params || {};
  console.log(chalk.yellow('\n📥 ' + (message || '请输入')));
  if (key && context) context[key] = params?.default || '';
  return '设计输入已接收';
}

// ── Awesome Design MD handlers ──

const BRANDS_DIR = join(PROJECT_ROOT, '.claude', 'skills', 'awesome-design-md', 'brands');

const BRAND_INFO = {
  vercel: { name: 'Vercel', description: '现代 SaaS 仪表板' },
  linear: { name: 'Linear', description: '任务管理 / Issue Tracker' },
  stripe: { name: 'Stripe', description: '金融 / 支付 / Dashboard' },
  notion: { name: 'Notion', description: '内容 / 知识库 / 协作' },
  apple: { name: 'Apple', description: '极简 / 高端 / 营销站' },
};

export function handleAwmBrandList(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n🎨 可用品牌设计系统：\n'));
  for (const [key, info] of Object.entries(BRAND_INFO)) {
    console.log(chalk.cyan(`  ${key.padEnd(10)} — ${info.name.padEnd(12)} — ${info.description}`));
  }
  console.log(chalk.dim('\n  输入品牌名（如 Vercel）或 skip 跳过'));
  if (context) context.awm_brands = Object.keys(BRAND_INFO);
  // Interactive step — the caller (Claude Code / Scene runner) captures user input
  return '品牌列表已展示';
}

function extractCssVars(mdContent) {
  const cssMatch = mdContent.match(/```css\n([\s\S]*?)\n```/);
  return cssMatch ? cssMatch[1] : '';
}

export function handleAwmBrandImport(_action, params, _targetPath, context) {
  const brand = params?.brand || context?.user_selected_brand;
  if (!brand || brand.toLowerCase() === 'skip') {
    console.log(chalk.dim('  ℹ Awesome Design MD: 跳过品牌导入'));
    return '品牌导入已跳过';
  }

  const brandKey = brand.toLowerCase().trim();
  const brandFile = join(BRANDS_DIR, `${brandKey}.md`);

  if (!existsSync(brandFile)) {
    console.log(chalk.yellow(`  ⚠ 品牌 "${brand}" 不存在，可用: ${Object.keys(BRAND_INFO).join(', ')}`));
    return `品牌 "${brand}" 未找到`;
  }

  const content = readFileSync(brandFile, 'utf-8');
  const cssVars = extractCssVars(content);
  const info = BRAND_INFO[brandKey];

  if (context) {
    context.user_selected_brand = brandKey;
    context.awm_brand_content = content;
    context.awm_brand_css = cssVars;
  }

  console.log(chalk.green(`  ✅ 已加载 ${info?.name || brand} 设计系统（颜色/字体/间距/组件）`));
  return `${info?.name || brand} 设计系统已导入`;
}

