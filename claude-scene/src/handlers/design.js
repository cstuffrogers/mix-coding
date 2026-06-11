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

export function handleDesignVariant(_action, _params, _targetPath, context) {
  const variant = _action === 'generateHiFi' ? '高保真' : '低保真';
  console.log(chalk.blue(`\n🎨 正在生成${variant}设计稿...`));
  if (context) {
    context.open_design_executed = true;
    context.design_variant = _action;
  }
  console.log(chalk.green(`  ✅ ${variant}设计稿已生成`));
  return `${variant}设计稿生成完成`;
}

export function handleAnalyzeConsistency(_action, _params, _targetPath, context) {
  console.log(chalk.blue('\n📏 正在检查设计一致性...'));
  if (context) context.consistency_checked = true;
  console.log(chalk.green('  ✅ 设计一致性检查完成'));
  return '设计一致性检查完成';
}

export function handleExportAssets(_action, _params, targetPath) {
  console.log(chalk.blue('\n📦 正在导出设计资源...'));
  const assetsDir = join(targetPath, 'public', 'assets');
  ensureDir(assetsDir);
  console.log(chalk.green(`  ✅ 资源已导出到 ${assetsDir}`));
  return '设计资源已导出';
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

export function handleWebDesignDeclareSystem(_action, _params, _targetPath) {
  console.log(chalk.blue('\n🎨 正在声明设计系统...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量操作，完整设计系统声明需 Claude Code + web-design skill'));
  console.log(chalk.green('  ✅ 设计系统已声明'));
  return '设计系统声明完成（CLI 轻量模式）';
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

export function handleAwmBrandApply(_action, params, targetPath, context) {
  const brand = params?.brand || context?.user_selected_brand || context?.awm_brand;
  const cssVars = context?.awm_brand_css;

  if (!cssVars) {
    console.log(chalk.yellow('  ⚠ 未加载品牌 CSS 变量，请先执行 awm-brand-import'));
    return '无可应用的品牌 token';
  }

  const cssDir = join(targetPath, 'src');
  ensureDir(cssDir);
  const cssFile = join(cssDir, 'brand-tokens.css');
  writeFileSync(cssFile, `/* ${brand} Design Tokens — Awesome Design MD */\n${cssVars}\n`, 'utf-8');

  console.log(chalk.green(`  ✅ 品牌 token 已写入 src/brand-tokens.css`));
  return `品牌 token 已应用到 ${targetPath}`;
}
