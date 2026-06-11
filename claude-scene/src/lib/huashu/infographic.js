/**
 * Huashu infographic renderer: renders project metrics (audit/analyze/review)
 * into a single-file HTML "infographic card" with editorial-brutalism aesthetic.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export function renderInfographic({
  targetPath,
  title = 'Project Health',
  subtitle = '',
  metrics = [],
  sections = [],
} = {}) {
  const outDir = join(targetPath, '.claude', 'infographics');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${slugify(title)}-${Date.now()}.html`);

  const html = buildHtml({ title, subtitle, metrics, sections });
  writeFileSync(file, html, 'utf8');
  console.log(chalk.green(`  ✅ huashu infographic 生成: ${file}`));
  return { file };
}

function slugify(s) {
  return String(s).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').slice(0, 40) || 'infographic';
}

function escape(s) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function buildHtml({ title, subtitle, metrics, sections }) {
  const metricCards = metrics.map(m => `
    <div class="metric">
      <div class="metric-value">${escape(m.value)}</div>
      <div class="metric-label">${escape(m.label)}</div>
      ${m.delta ? `<div class="metric-delta ${m.deltaPositive ? 'up' : 'down'}">${escape(m.delta)}</div>` : ''}
    </div>`).join('');

  const sectionBlocks = sections.map(s => `
    <section class="block">
      <h2>${escape(s.title)}</h2>
      ${s.body ? `<p>${escape(s.body)}</p>` : ''}
      ${s.items ? `<ul>${s.items.map(i => `<li>${escape(i)}</li>`).join('')}</ul>` : ''}
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escape(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; background: #FFFFFF; color: #000000; padding: 48px; max-width: 1200px; margin: 0 auto; }
  header { border-bottom: 4px solid #000; padding-bottom: 24px; margin-bottom: 48px; }
  h1 { font-size: 80px; font-weight: 900; letter-spacing: -3px; line-height: 0.95; }
  .subtitle { font-size: 18px; color: #666; margin-top: 12px; font-family: "JetBrains Mono", monospace; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; margin-bottom: 48px; }
  .metric { border: 2px solid #000; padding: 24px; }
  .metric-value { font-size: 56px; font-weight: 800; letter-spacing: -2px; line-height: 1; }
  .metric-label { font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 8px; color: #333; }
  .metric-delta { font-size: 13px; margin-top: 8px; font-family: monospace; }
  .metric-delta.up { color: #0a7d28; } .metric-delta.down { color: #c2381a; }
  .block { margin-bottom: 40px; }
  .block h2 { font-size: 36px; font-weight: 800; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
  .block p { font-size: 17px; line-height: 1.55; margin-bottom: 12px; max-width: 70ch; }
  .block ul { list-style: none; }
  .block li { padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 15px; }
  footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid #ccc; font-size: 12px; color: #999; font-family: monospace; }
</style>
</head>
<body>
<header>
  <h1>${escape(title)}</h1>
  ${subtitle ? `<div class="subtitle">${escape(subtitle)}</div>` : ''}
</header>
<div class="metrics">${metricCards}</div>
${sectionBlocks}
<footer>huashu infographic · ${new Date().toISOString()}</footer>
</body>
</html>`;
}
