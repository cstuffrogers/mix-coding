/**
 * Huashu deck exporter: HTML deck → editable PPTX adapter.
 * Wraps huashu html2pptx.js script. Lazy-loads pptxgenjs.
 */
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../safe-exec.js';

const HUASHU_PPTX_SCRIPT = 'assets/huashu/html2pptx.js';

export function isAvailable(projectRoot) {
  return existsSync(join(projectRoot, HUASHU_PPTX_SCRIPT));
}

export function generateReleaseDeck({
  targetPath,
  projectRoot,
  title = 'Release',
  version = 'v1.0.0',
  highlights = [],
} = {}) {
  const outDir = join(targetPath, '.claude', 'decks');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const deckHtml = join(outDir, `release-${Date.now()}.html`);
  writeFileSync(deckHtml, buildDeckHtml({ title, version, highlights }), 'utf8');
  console.log(chalk.blue(`\n📊 huashu deck-exporter: HTML deck 已生成`));
  console.log(chalk.dim(`  HTML: ${deckHtml}`));

  if (!isAvailable(projectRoot)) {
    console.log(chalk.yellow('  ⚠ html2pptx.js 不在 assets/huashu/, PPTX 导出跳过'));
    return { html: deckHtml, pptx: null };
  }

  const pptxFile = deckHtml.replace(/\.html$/, '.pptx');
  try {
    const script = join(projectRoot, HUASHU_PPTX_SCRIPT);
    safeExec(`node "${script}" --input "${deckHtml}" --output "${pptxFile}" 2>&1`, projectRoot, { stdio: 'pipe' });
    if (existsSync(pptxFile)) {
      console.log(chalk.green(`  ✅ PPTX 导出: ${pptxFile}`));
      return { html: deckHtml, pptx: pptxFile };
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ PPTX 导出失败（需 pptxgenjs: npm i pptxgenjs）: ${e.message.split('\n', 1)[0]}`));
  }
  return { html: deckHtml, pptx: null, manual: true };
}

function buildDeckHtml({ title, version, highlights }) {
  const slides = [
    `<section class="slide cover"><h1>${escape(title)}</h1><div class="version">${escape(version)}</div></section>`,
    ...highlights.map((h, i) => `<section class="slide" data-i="${i + 1}"><h2>${escape(h.title || ('亮点 ' + (i + 1)))}</h2><p>${escape(h.body || '')}</p></section>`),
    `<section class="slide closing"><h2>Thank you</h2><p>huashu deck-exporter</p></section>`,
  ];
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escape(title)}</title><style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f4f4f7; }
  .deck { display: grid; gap: 24px; padding: 24px; }
  .slide { width: 1920px; height: 1080px; transform: scale(0.45); transform-origin: top left; background: #FFFFFF; color: #1A1A1A; padding: 96px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 8px 40px rgba(0,0,0,0.08); position: relative; }
  .slide.cover { background: #08080D; color: #FFFFFF; }
  .slide.cover h1 { font-size: 200px; font-weight: 900; letter-spacing: -8px; line-height: 0.95; }
  .slide.cover .version { font-family: "JetBrains Mono", monospace; font-size: 28px; color: #00FF88; margin-top: 24px; }
  .slide h2 { font-size: 96px; font-weight: 800; letter-spacing: -2px; margin-bottom: 32px; }
  .slide p { font-size: 36px; line-height: 1.4; color: #444; max-width: 70%; }
  .slide.closing { background: #08080D; color: #FFFFFF; text-align: center; align-items: center; }
</style></head>
<body><div class="deck">${slides.join('')}</div></body></html>`;
}

function escape(s) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
