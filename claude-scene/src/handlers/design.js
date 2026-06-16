import { writeFileSync, readFileSync, existsSync, readdirSync, cpSync } from 'fs';
import { join, basename, relative } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { ensureDir } from '../lib/fs-utils.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { scanDir } from '../lib/scan-dir.js';
import { proposeThreeDirections } from "../lib/huashu/html-direction-advisor.js";
import { runProtocol as runBrandProtocol } from '../lib/huashu/brand-protocol.js';
import { review as runExpertReview } from '../lib/huashu/expert-review.js';
import { buildPrototype, validateWithPlaywright } from '../lib/huashu/prototype-builder.js';
import { generateReleaseAnimation } from '../lib/huashu/motion-engine.js';
import { generateReleaseDeck } from '../lib/huashu/deck-exporter.js';
import { renderInfographic } from '../lib/huashu/infographic.js';

export function handleGenerateDesign(_action, params, targetPath, context) {
  const requirement = context?.prompt || params?.requirement || '';
  const category = params?.category || 'web';
  const proposal = proposeThreeDirections({ category, requirement });
  if (context) {
    context.huashu_proposal = proposal;
    context.open_design_executed = true;
  }
  // Persist proposal for downstream steps
  try {
    const dir = join(targetPath, '.claude', 'designs');
    ensureDir(dir);
    writeFileSync(join(dir, `proposal-${Date.now()}.json`), JSON.stringify(proposal, null, 2), 'utf8');
  } catch (e) {
    console.error(chalk.yellow(`  ⚠ 设计提案文件持久化失败: ${e.message}`));
  }
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
  if (params?.validate !== false) {
    validateWithPlaywright(targetPath, result.file);
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
  if (context.securityScanResult && context.securityScanResult.highSeverityFound !== undefined) {
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

  const findings = { good: [], warn: [] };

  // Quick static check: count CSS variable usage vs hardcoded values across all CSS files
  try {
    const cssFiles = scanDir(targetPath, {
      filter: (f) => f.endsWith('.css') && !f.includes('node_modules'),
    }).slice(0, 30);

    for (const p of cssFiles) {
      try {
        const content = readFileSync(p, 'utf-8');
        const varCount = (content.match(/var\(--[\w-]+\)/g) || []).length;
        const hexCount = (content.match(/#[0-9a-fA-F]{3,6}/g) || []).length;
        const relPath = relative(targetPath, p);
        if (hexCount > varCount) {
          console.log(chalk.yellow(`  ⚠ ${basename(p)}: 硬编码颜色(${hexCount}) > CSS变量(${varCount})，建议提取设计 Token`));
          findings.warn.push({ file: relPath, hexCount, varCount });
        } else if (varCount > 0) {
          console.log(chalk.green(`  ✅ ${basename(p)}: ${varCount} CSS 变量引用, ${hexCount} 硬编码值`));
          findings.good.push({ file: relPath, varCount, hexCount });
        }
      } catch { /* skip unreadable */ }
    }

    if (cssFiles.length === 0) {
      console.log(chalk.yellow('  ⚠ 未找到 CSS 文件进行一致性检查'));
    }
  } catch { /* non-critical */ }

  if (context) {
    context.consistency_findings = findings;
    context.consistency_warn_count = findings.warn.length;
  }

  return '设计一致性检查完成';
}

function checkExistingTokens(targetPath) {
  // Check for existing design token files
  const tokenFiles = ['.claude/designs/design-baseline.md', '.claude/designs/design-system.md',
    'src/assets/design-system/tokens.css', 'src/styles/tokens.css'];
  for (const f of tokenFiles) {
    if (existsSync(join(targetPath, f))) return f;
  }
  // Check if any CSS has CSS custom properties (design tokens)
  if (existsSync(join(targetPath, 'src'))) {
    for (const cssFile of scanDir(join(targetPath, 'src'), {
      filter: f => f.endsWith('.css') && !f.includes('node_modules'),
    }).slice(0, 20)) {
      try {
        const content = readFileSync(cssFile, 'utf-8');
        if ((content.match(/--[\w-]+:/g) || []).length >= 5) {
          return relative(targetPath, cssFile);
        }
      } catch { /* skip */ }
    }
  }
  return null;
}

export function handleExportAssets(_action, _params, targetPath, context) {
  const designDir = join(targetPath, 'src', 'assets', 'design-system');
  ensureDir(designDir);

  let exportedCount = 0;

  // 1. Export CSS custom properties (design tokens)
  const tokensCss = join(designDir, 'tokens.css');
  let cssContent = '/* Design Tokens — auto-generated */\n:root {\n';

  // Use Open Design brand CSS first (from od-brand-import), then AWM (from awm-brand-import)
  const brandCss = context?.od_brand_css || context?.awm_brand_css;
  if (brandCss) {
    writeFileSync(tokensCss, brandCss, 'utf-8');
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
          const cssMatch = md.match(/```css\n([\s\S]*?)```/);
          if (cssMatch) {
            tokensFromSkill = cssMatch[1];
          } else {
            const propLines = md.match(/^--[\w-]+:\s*[^;]+;/gm);
            if (propLines && propLines.length >= 5) {
              tokensFromSkill = ':root {\n  ' + propLines.join('\n  ') + '\n}\n';
            }
          }
          if (tokensFromSkill) {
            break;
          }
        } catch { /* unreadable */ }
      }
    }

    if (tokensFromSkill) {
      writeFileSync(tokensCss, tokensFromSkill, 'utf-8');
      exportedCount++;
    } else {
      // Check if project already has design tokens before writing defaults
      const existingTokens = checkExistingTokens(targetPath);
      if (existingTokens) {
        console.log(chalk.yellow('  ⚠ 项目已有设计 Token，跳过默认 token 写入以防覆盖'));
        console.log(chalk.dim(`    已有 token 文件: ${existingTokens}`));
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
        exportedCount++;
      }
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
  exportedCount++;

  return `设计资源导出完成: ${exportedCount} 个文件`;
}

export function handlePersist(_action, _params, targetPath, context) {
  const designDir = join(targetPath, '.claude', 'designs');
  ensureDir(designDir);
  writeFileSync(join(designDir, 'current.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    variant: context?.design_variant || 'unknown',
    selected: context?.design_selected || 'unknown',
  }, null, 2), 'utf-8');
  return '设计数据已持久化';
}

export function handleDesignInput(_action, params, _targetPath, context) {
  const { message: _message, key } = params || {};
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

export function handleAwmBrandList(_action, _params, _targetPath, _context) {
  for (const [key, info] of Object.entries(BRAND_INFO)) {
    console.log(chalk.cyan(`  ${key.padEnd(10)} — ${info.name.padEnd(12)} — ${info.description}`));
  }
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
    return '品牌导入已跳过';
  }

  const brandKey = brand.toLowerCase().trim();
  const brandFile = join(BRANDS_DIR, `${brandKey}.md`);

  if (!existsSync(brandFile)) {
    return `品牌 "${brand}" 未找到`;
  }

  const content = readFileSync(brandFile, 'utf-8');
  const cssVars = extractCssVars(content);
  const info = BRAND_INFO[brandKey];

  if (context) {
    context.user_selected_brand = brandKey;
    context.awm_brand_css = cssVars;
  }

  return `${info?.name || brand} 设计系统已导入`;
}

// ── Open Design (od) brand handlers ──

const OD_DESIGN_SYSTEMS_DIR = join(PROJECT_ROOT, 'open-design', 'design-systems');

export function handleOdBrandList(_action, _params, _targetPath, context) {
  if (!existsSync(OD_DESIGN_SYSTEMS_DIR)) {
    console.log(chalk.yellow('  open-design 设计系统目录未找到，跳过'));
    return 'open-design 品牌列表跳过（目录不存在）';
  }

  const entries = readdirSync(OD_DESIGN_SYSTEMS_DIR, { withFileTypes: true });
  const brands = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const designMd = join(OD_DESIGN_SYSTEMS_DIR, entry.name, 'DESIGN.md');
    let category = '';
    let displayName = entry.name;
    if (existsSync(designMd)) {
      try {
        const content = readFileSync(designMd, 'utf-8');
        const titleMatch = content.match(/^#\s*(.+)/m);
        if (titleMatch) displayName = titleMatch[1].replace(/^Design System Inspired by /i, '').trim();
        const catMatch = content.match(/^>\s*Category:\s*(.+)/m);
        if (catMatch) category = catMatch[1].trim();
      } catch { /* keep defaults */ }
    }
    brands.push({ key: entry.name, name: displayName, category });
  }

  brands.sort((a, b) => a.key.localeCompare(b.key));

  // Group by category
  const groups = {};
  for (const b of brands) {
    const cat = b.category || 'Uncategorized';
    if (!Object.hasOwn(groups, cat)) groups[cat] = [];
    groups[cat].push(b);
  }

  console.log(chalk.cyan(`\n  open-design 品牌设计系统（${brands.length} 个）：\n`));
  for (const [cat, list] of Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(chalk.yellow(`  ${cat}`));
    for (const b of list) {
      console.log(`    ${chalk.green(b.key.padEnd(18))} ${b.name}`);
    }
    console.log('');
  }

  if (context) {
    context.od_available_brands = brands.map(b => b.key);
    context.od_brand_count = brands.length;
  }

  return `open-design 品牌列表已展示（${brands.length} 个）`;
}

// ── Open Design brand picker (curated shortlist) ──

const BRAND_SHORTLIST = [
  { key: 'stripe',   name: 'Stripe',     accent: '#533afd', desc: '金融科技蓝紫 — 专业、可信赖、现代 SaaS 标杆' },
  { key: 'apple',    name: 'Apple',      accent: '#0071e3', desc: '极致简约 — 大面积留白、精准间距、无噪点' },
  { key: 'airbnb',   name: 'Airbnb',     accent: '#ff385c', desc: '温暖珊瑚粉 — 柔和圆角、照片驱动、家一般的感受' },
  { key: 'vercel',   name: 'Vercel',     accent: '#0070f3', desc: '深色科技风 — 几何精确、高对比、开发者审美' },
  { key: 'notion',   name: 'Notion',     accent: '#0075de', desc: '极简黑白 — 无阴影、纯字体层级、零装饰' },
  { key: 'github',   name: 'GitHub',     accent: '#0969da', desc: 'Primer 设计系统 — 稳健中性、开发者友好' },
  { key: 'supabase', name: 'Supabase',   accent: '#3ecf8e', desc: '深色底 + 翠绿强调 — 大胆、戏剧化、终端感' },
  { key: 'figma',    name: 'Figma',      accent: '#000000', desc: '单色工具风 — 黑即是强调色，图标驱动界面' },
  { key: 'spotify',  name: 'Spotify',    accent: '#1ed760', desc: '暗黑 + 荧光绿 — 音乐感、全圆角、氛围浓郁' },
  { key: 'shopify',  name: 'Shopify',    accent: '#36F4A4', desc: '纯黑底 + 霓虹绿 — 大胆、电商基因、全 pill 按钮' },
  { key: 'discord',  name: 'Discord',    accent: '#5865f2', desc: '模糊紫蓝 — 游戏社区、柔和暗色、圆润友好' },
  { key: 'slack',    name: 'Slack',      accent: '#4A154B', desc: '茄子紫 — 协作工具、多彩但不刺眼、亲和' },
  { key: 'uber',     name: 'Uber',       accent: '#000000', desc: '黑白系统 — 极简出行风、最强对比、无彩色干扰' },
];

export function handleOdBrandPick(_action, _params, _targetPath, context) {
  const available = context?.od_available_brands || [];
  const availableSet = new Set(available);
  const availablePick = BRAND_SHORTLIST.filter(b => availableSet.has(b.key));

  if (availablePick.length === 0) {
    console.log(chalk.yellow('  open-design: 精选品牌列表中无匹配品牌，回退到完整列表首项'));
    if (context) context.od_brand_shortlist = [];
    return '品牌精选列表为空（回退到自动选择）';
  }

  console.log(chalk.cyan.bold(`\n  🎨 Open Design 精选品牌（${availablePick.length} 个配色方案）：\n`));
  availablePick.forEach((b, i) => {
    const idx = chalk.dim(String(i + 1).padStart(2));
    const key = chalk.green(b.key.padEnd(12));
    const accent = chalk.hex(b.accent)('██');
    console.log(`    ${idx}. ${key} ${accent}  ${chalk.white(b.desc)}`);
  });
  console.log(chalk.dim(`\n  输入品牌 key（如 stripe、apple）或序号 1-${availablePick.length} 选择`));
  console.log(chalk.dim('  直接回车 = 自动选第 1 个\n'));

  if (context) {
    context.od_brand_shortlist = availablePick;
    context._awaiting_brand_selection = true;
    // Pre-set user_selected_brand to the first pick so downstream steps
    // (od-brand-import, awm-brand-import) work even without interactive input
    context.user_selected_brand = availablePick[0].key;
  }
  return `品牌精选列表已展示（${availablePick.length} 个，默认 ${availablePick[0].key}）`;
}

export function handleOdBrandImport(_action, params, _targetPath, context) {
  let brand = params?.brand || context?.user_selected_brand || context?.od_selected_brand;
  if (!brand || brand.toLowerCase() === 'skip') {
    // Auto-select: match project context → priority tier → first available brand
    const available = context?.od_available_brands || [];
    if (available.length === 0) {
      return 'open-design 品牌导入已跳过（无可用品牌）';
    }
    const prompt = (context?.prompt || '').toLowerCase();
    const mentioned = available.find(b => prompt.includes(b));
    if (mentioned) {
      brand = mentioned;
    } else {
      // Tiered priority: well-known brands with proven color palettes
      const priority = ['stripe', 'apple', 'airbnb', 'vercel', 'notion', 'github', 'supabase', 'figma', 'spotify', 'shopify', 'discord', 'slack', 'uber'];
      brand = priority.find(p => available.includes(p)) || available[0];
    }
    console.log(chalk.cyan(`  open-design: 自动选择品牌 "${brand}"（${available.length} 个可用，可设 user_selected_brand 覆盖）`));
  }

  const brandKey = brand.toLowerCase().trim();
  const brandDir = join(OD_DESIGN_SYSTEMS_DIR, brandKey);

  if (!existsSync(brandDir)) {
    return `open-design 品牌 "${brand}" 未找到（目录: ${brandDir}）`;
  }

  let imported = 0;
  const tokensCss = join(brandDir, 'tokens.css');
  const designMd = join(brandDir, 'DESIGN.md');
  const componentsHtml = join(brandDir, 'components.html');

  if (context) {
    if (existsSync(tokensCss)) {
      try {
        context.od_brand_css = readFileSync(tokensCss, 'utf-8');
        imported++;
      } catch { /* skip */ }
    }
    if (existsSync(designMd)) {
      try {
        context.od_brand_design_md = readFileSync(designMd, 'utf-8');
        imported++;
      } catch { /* skip */ }
    }
    if (existsSync(componentsHtml)) {
      try {
        context.od_brand_components = readFileSync(componentsHtml, 'utf-8');
        imported++;
      } catch { /* skip */ }
    }
    context.od_selected_brand = brandKey;
  }

  return `open-design 品牌 "${brandKey}" 已导入（${imported} 个文件）`;
}

// ── Open Design template handlers ──

const OD_TEMPLATES_DIR = join(PROJECT_ROOT, 'open-design', 'design-templates');

function readTemplateSKILL(templateDir) {
  const skillMd = join(templateDir, 'SKILL.md');
  if (!existsSync(skillMd)) return null;
  try {
    const content = readFileSync(skillMd, 'utf-8');
    // Parse frontmatter (handle both \n and \r\n)
    const NL = /\r?\n/;
    const fmMatch = content.match(new RegExp(`^---${NL.source}([\\s\\S]*?)${NL.source}---`));
    if (!fmMatch) return null;
    const fm = fmMatch[1];
    const name = (fm.match(/^name:\s*(.+)/m) || [])[1]?.trim() || basename(templateDir);
    // Multi-line description with | or single-line
    const descMulti = fm.match(new RegExp(`^description:\\s*\\|\\s*${NL.source}([\\s\\S]*?)(?=${NL.source}\\w+?:)`, 'm'));
    const desc = descMulti
      ? descMulti[1].trim()
      : (fm.match(/^description:\s*(.+)/m) || [])[1]?.trim() || '';
    const mode = (fm.match(/^\s+mode:\s*(.+)/m) || [])[1]?.trim() || 'prototype';
    const platform = (fm.match(/^\s+platform:\s*(.+)/m) || [])[1]?.trim() || 'desktop';
    const scenario = (fm.match(/^\s+scenario:\s*(.+)/m) || [])[1]?.trim() || '';
    const hasExample = existsSync(join(templateDir, 'example.html'));
    const hasAssets = existsSync(join(templateDir, 'assets'));
    const hasReferences = existsSync(join(templateDir, 'references'));
    return { key: basename(templateDir), name, description: desc, mode, platform, scenario, hasExample, hasAssets, hasReferences };
  } catch {
    return null;
  }
}

function printTemplateList(templates) {
  const groups = {};
  for (const t of templates) {
    const mode = t.mode || 'other';
    if (!Object.hasOwn(groups, mode)) groups[mode] = [];
    groups[mode].push(t);
  }
  console.log(chalk.cyan(`\n  open-design 设计模板（${templates.length} 个）：\n`));
  const modeLabels = { prototype: 'Web 原型', deck: 'PPT 演示', template: '页面模板', image: '图片', video: '视频', audio: '音频' };
  for (const [mode, list] of Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(chalk.yellow(`  ${modeLabels[mode] || mode}（${list.length} 个）`));
    for (const t of list) {
      const badges = [];
      if (t.hasExample) badges.push('\u{1F4C4}');
      if (t.hasAssets) badges.push('\u{1F4E6}');
      if (t.hasReferences) badges.push('\u{1F4CB}');
      console.log(`    ${chalk.green(t.key.padEnd(28))} ${t.name}  ${badges.join(' ')}`);
    }
    console.log('');
  }
}

function loadTemplateContext(templateDir, templateId, context) {
  context.od_selected_template = templateId;
  const skillMd = join(templateDir, 'SKILL.md');
  if (existsSync(skillMd)) {
    try { context.od_template_skill = readFileSync(skillMd, 'utf-8'); } catch { /* skip */ }
  }
  const refsDir = join(templateDir, 'references');
  if (existsSync(refsDir)) {
    context.od_template_references = {};
    try {
      for (const ref of readdirSync(refsDir)) {
        if (ref.endsWith('.md')) {
          context.od_template_references[ref] = readFileSync(join(refsDir, ref), 'utf-8');
        }
      }
    } catch { /* skip */ }
  }
}

export function handleOdTemplateList(_action, _params, _targetPath, context) {
  if (!existsSync(OD_TEMPLATES_DIR)) {
    console.log(chalk.yellow('  open-design 模板目录未找到，跳过'));
    return 'open-design 模板列表跳过（目录不存在）';
  }

  const templates = [];
  for (const entry of readdirSync(OD_TEMPLATES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const info = readTemplateSKILL(join(OD_TEMPLATES_DIR, entry.name));
    if (info) templates.push(info);
  }
  templates.sort((a, b) => a.key.localeCompare(b.key));

  printTemplateList(templates);

  if (context) {
    context.od_available_templates = templates.map(t => t.key);
    context.od_template_count = templates.length;
    context.od_templates_detail = templates;
  }
  return `open-design 模板列表已展示（${templates.length} 个）`;
}

export function handleOdTemplatePreview(_action, params, targetPath, context) {
  let templateId = params?.template || context?.od_selected_template || context?.user_selected_template;
  if (!templateId || templateId.toLowerCase() === 'skip') {
    const available = context?.od_available_templates || [];
    if (available.length === 0) {
      return '模板预览已跳过（无可用模板）';
    }
    templateId = available[0];
    console.log(chalk.cyan(`  open-design: 自动选择模板 "${templateId}"（${available.length} 个可用，可设 user_selected_template 覆盖）`));
  }

  const templateDir = join(OD_TEMPLATES_DIR, templateId.toLowerCase().trim());

  // Validate templateId doesn't contain shell metacharacters or path traversal
  if (!/^[\w\-./]+$/.test(templateId)) {
    return `模板 "${templateId}" 包含无效字符`;
  }
  if (!existsSync(templateDir)) {
    return `模板 "${templateId}" 未找到`;
  }

  const exampleHtml = join(templateDir, 'example.html');
  if (!existsSync(exampleHtml)) {
    return `模板 "${templateId}" 没有可预览的示例`;
  }

  const htmlContent = readFileSync(exampleHtml, 'utf-8');
  const previewDir = join(targetPath, '.claude', 'previews');
  ensureDir(previewDir);
  writeFileSync(join(previewDir, `template-${templateId}.html`), htmlContent, 'utf-8');

  // Copy assets if present
  const assetsDir = join(templateDir, 'assets');
  if (existsSync(assetsDir)) {
    try {
      cpSync(assetsDir, join(previewDir, 'assets'), { recursive: true });
    } catch { /* non-fatal */ }
  }

  // Inject template context for Claude
  if (context) {
    context.od_template_html = htmlContent;
    loadTemplateContext(templateDir, templateId, context);
  }

  // Open preview in browser
  try {
    const htmlPath = join(previewDir, `template-${templateId}.html`);
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', htmlPath], { stdio: 'ignore', windowsHide: true });
    } else if (process.platform === 'darwin') {
      spawn('open', [htmlPath], { stdio: 'ignore' });
    } else {
      spawn('xdg-open', [htmlPath], { stdio: 'ignore' });
    }
  } catch { /* non-fatal */ }

  return `模板 "${templateId}" 预览已打开：${relative(targetPath, join(previewDir, `template-${templateId}.html`))}`;
}

// ── Open Design skill loader ──

const OD_SKILLS_DIR = join(PROJECT_ROOT, 'open-design', 'skills');

export function handleOdSkillLoad(_action, params, _targetPath, context) {
  let skillName = params?.skill || context?.od_selected_skill;
  if (!skillName) {
    // Auto-load core design skill — try design-brief > color-expert > brand-guidelines > design-md
    const coreSkills = ['design-brief', 'color-expert', 'brand-guidelines', 'design-md'];
    skillName = coreSkills.find(s => existsSync(join(OD_SKILLS_DIR, s, 'SKILL.md')));
    if (!skillName) {
      return 'open-design skill 加载已跳过（未找到核心 Skill）';
    }
    console.log(chalk.cyan(`  open-design: 自动加载 Skill "${skillName}"（可设 od_selected_skill 覆盖）`));
  }

  const skillDir = join(OD_SKILLS_DIR, skillName.toLowerCase().trim());
  const skillMd = join(skillDir, 'SKILL.md');

  if (!existsSync(skillMd)) {
    return `open-design skill "${skillName}" 未找到`;
  }

  try {
    const content = readFileSync(skillMd, 'utf-8');
    if (context) {
      context.od_skill_name = skillName;
      context.od_skill_content = content;
    }
    return `open-design skill "${skillName}" 已加载（${content.length} 字节）`;
  } catch {
    return `open-design skill "${skillName}" 加载失败`;
  }
}

// ── Open Design device frame handlers ──

const OD_FRAMES_DIR = join(PROJECT_ROOT, 'open-design', 'assets', 'frames');

export function handleOdFrameList(_action, _params, _targetPath, context) {
  if (!existsSync(OD_FRAMES_DIR)) {
    console.log(chalk.yellow('  open-design frames 目录未找到，跳过'));
    return 'open-design 设备框架列表跳过（目录不存在）';
  }
  const frameFiles = readdirSync(OD_FRAMES_DIR).filter(f => f.endsWith('.html'));
  const frames = frameFiles.map(f => {
    const name = basename(f, '.html');
    try {
      const content = readFileSync(join(OD_FRAMES_DIR, f), 'utf-8');
      const titleMatch = content.match(/<title>(.+)<\/title>/);
      return { key: name, title: titleMatch ? titleMatch[1] : name };
    } catch { return { key: name, title: name }; }
  });

  console.log(chalk.cyan(`\n  open-design 设备框架（${frames.length} 个）：\n`));
  frames.forEach(f => console.log(`    ${chalk.green(f.key.padEnd(20))} ${f.title}`));

  if (context) {
    context.od_available_frames = frames.map(f => f.key);
    context.od_frame_count = frames.length;
  }
  return frames.length > 0
    ? `open-design 设备框架列表已展示（${frames.length} 个）`
    : 'open-design 设备框架目录为空（无可用框架）';
}

export function handleOdFrameApply(_action, params, targetPath, context) {
  let frameId = params?.frame || context?.od_selected_frame;
  if (!frameId || frameId.toLowerCase() === 'skip') {
    const available = context?.od_available_frames || [];
    if (available.length === 0) {
      return '设备框架应用已跳过（无可用框架）';
    }
    frameId = available.includes('iphone-15-pro') ? 'iphone-15-pro' : available[0];
    console.log(chalk.cyan(`  open-design: 自动选择框架 "${frameId}"（${available.length} 个可用）`));
  }

  const frameFile = join(OD_FRAMES_DIR, `${frameId}.html`);
  if (!existsSync(frameFile)) {
    return `框架 "${frameId}" 未找到`;
  }

  const frameHtml = readFileSync(frameFile, 'utf-8');
  const framesDir = join(targetPath, '.claude', 'designs', 'frames');
  ensureDir(framesDir);
  writeFileSync(join(framesDir, `${frameId}.html`), frameHtml, 'utf-8');

  // Also copy all frames so gallery can reference any
  const allFrames = readdirSync(OD_FRAMES_DIR).filter(f => f.endsWith('.html'));
  allFrames.forEach(f => {
    if (f !== `${frameId}.html`) {
      try { writeFileSync(join(framesDir, f), readFileSync(join(OD_FRAMES_DIR, f), 'utf-8'), 'utf-8'); } catch { /* skip */ }
    }
  });

  if (context) {
    context.od_frame_html = frameHtml;
    context.od_selected_frame = frameId;
  }

  return `设备框架已写入 .claude/designs/frames/（${allFrames.length} 个框架）`;
}

// ── Open Design prompt template handlers ──

const OD_PROMPTS_DIR = join(PROJECT_ROOT, 'open-design', 'prompt-templates');

export function handleOdPromptTemplateList(_action, _params, _targetPath, context) {
  const groups = {};
  for (const type of ['image', 'video']) {
    const typeDir = join(OD_PROMPTS_DIR, type);
    if (!existsSync(typeDir)) continue;
    const files = readdirSync(typeDir).filter(f => f.endsWith('.json'));
    groups[type] = files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(typeDir, f), 'utf-8'));
        return { key: data.id || basename(f, '.json'), title: data.title || basename(f, '.json'), category: data.category || '', type };
      } catch { return { key: basename(f, '.json'), title: basename(f, '.json'), category: '', type }; }
    });
  }

  const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
  console.log(chalk.cyan(`\n  open-design 提示词模板（${total} 个）：\n`));
  for (const [type, list] of Object.entries(groups)) {
    console.log(chalk.yellow(`  [${type}] (${list.length} 个)`));
    list.slice(0, 8).forEach(t => console.log(`    ${chalk.green(t.key.padEnd(40))} ${t.title}`));
    if (list.length > 8) console.log(`    ... 还有 ${list.length - 8} 个`);
    console.log('');
  }

  if (context) {
    context.od_available_prompts = groups;
    context.od_prompt_count = total;
  }
  return `open-design 提示词模板已展示（${total} 个：image ${groups.image?.length || 0} + video ${groups.video?.length || 0}）`;
}

export function handleOdPromptTemplateLoad(_action, params, _targetPath, context) {
  let promptId = params?.prompt || context?.od_selected_prompt;
  if (!promptId) {
    const groups = context?.od_available_prompts || {};
    const available = [...(groups.image || []), ...(groups.video || [])].map(t => t.key);
    if (available.length === 0) {
      return '提示词模板加载已跳过（无可用模板）';
    }
    promptId = available[0];
    console.log(chalk.cyan(`  open-design: 自动选择提示词模板 "${promptId}"（${available.length} 个可用，可设 od_selected_prompt 覆盖）`));
  }

  for (const type of ['image', 'video']) {
    const filePath = join(OD_PROMPTS_DIR, type, `${promptId}.json`);
    if (existsSync(filePath)) {
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        if (context) {
          context.od_prompt_template = data;
          context.od_selected_prompt = promptId;
        }
        return `提示词模板 "${data.title || promptId}" 已加载（${type}）`;
      } catch { return `提示词模板 "${promptId}" 解析失败`; }
    }
  }
  return `提示词模板 "${promptId}" 未找到`;
}

// ── Open Design deck template handlers ──

const OD_DECKS_DIR = join(PROJECT_ROOT, 'open-design', 'templates');

export function handleOdDeckList(_action, _params, _targetPath, context) {
  if (!existsSync(OD_DECKS_DIR)) {
    console.log(chalk.yellow('  open-design decks 目录未找到，跳过'));
    return 'open-design 演示文稿模板列表跳过（目录不存在）';
  }
  const decks = [];

  const htmlFiles = readdirSync(OD_DECKS_DIR).filter(f => f.endsWith('.html'));
  htmlFiles.forEach(f => {
    const name = basename(f, '.html');
    try {
      const content = readFileSync(join(OD_DECKS_DIR, f), 'utf-8');
      const titleMatch = content.match(/<title>(.+)<\/title>/);
      decks.push({ key: name, title: titleMatch ? titleMatch[1] : name, type: 'deck' });
    } catch { decks.push({ key: name, title: name, type: 'deck' }); }
  });

  const laDir = join(OD_DECKS_DIR, 'live-artifacts');
  if (existsSync(laDir)) {
    readdirSync(laDir).filter(d => !d.startsWith('.')).forEach(d => {
      decks.push({ key: `live-artifacts/${d}`, title: d, type: 'live-artifact' });
    });
  }

  console.log(chalk.cyan(`\n  open-design 演示文稿模板（${decks.length} 个）：\n`));
  for (const d of decks) console.log(`    ${chalk.green(d.key.padEnd(30))} ${d.title}  [${d.type}]`);

  if (context) {
    context.od_available_decks = decks.map(d => d.key);
    context.od_deck_count = decks.length;
  }
  return `open-design 演示文稿模板已展示（${decks.length} 个）`;
}

export function handleOdDeckLoad(_action, params, targetPath, context) {
  let deckId = params?.deck || context?.od_selected_deck;
  if (!deckId) {
    const available = context?.od_available_decks || [];
    if (available.length === 0) {
      return '演示文稿加载已跳过（无可用模板）';
    }
    deckId = available[0];
    console.log(chalk.cyan(`  open-design: 自动选择演示文稿 "${deckId}"`));
  }

  // Validate deckId doesn't contain shell metacharacters or path traversal
  if (!/^[\w\-./]+$/.test(deckId)) {
    return `演示文稿 "${deckId}" 包含无效字符`;
  }

  if (deckId.startsWith('live-artifacts/')) {
    const sourcePath = join(OD_DECKS_DIR, deckId);
    const destDir = join(targetPath, '.claude', 'designs', 'decks', deckId.replace('live-artifacts/', ''));
    ensureDir(destDir);
    try {
      cpSync(sourcePath, destDir, { recursive: true });
    } catch { return `演示文稿 "${deckId}" 复制失败`; }
  } else {
    const sourcePath = join(OD_DECKS_DIR, `${deckId}.html`);
    if (!existsSync(sourcePath)) {
      return `演示文稿 "${deckId}" 未找到`;
    }
    const deckHtml = readFileSync(sourcePath, 'utf-8');
    const decksDir = join(targetPath, '.claude', 'designs', 'decks');
    ensureDir(decksDir);
    writeFileSync(join(decksDir, `${deckId}.html`), deckHtml, 'utf-8');
  }

  if (context) {
    context.od_selected_deck = deckId;
  }
  return `演示文稿 "${deckId}" 已写入 .claude/designs/decks/`;
}
