/**
 * Huashu single-file HTML prototype builder.
 * Generates one HTML file with embedded CSS + JS for clickable demo,
 * optionally validated by Playwright.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../safe-exec.js';
import { getStyle } from './style-library.js';

const DEVICE_FRAMES = {
  iphone: { width: 393, height: 852, name: 'iPhone 15 Pro', cssClass: 'frame-iphone' },
  android: { width: 412, height: 915, name: 'Android Pixel', cssClass: 'frame-android' },
  desktop: { width: 1440, height: 900, name: 'Desktop', cssClass: 'frame-desktop' },
  ipad: { width: 1024, height: 1366, name: 'iPad Pro', cssClass: 'frame-ipad' },
};

const STYLE_TOKENS = {
  'editorial-brutalism': {
    bg: '#FFFFFF', fg: '#000000', accent: '#0000EE', signal: '#FF433D',
    font: 'system-ui, -apple-system, sans-serif',
    radius: '0', borderWidth: '1px', cardShadow: 'none',
  },
  'neo-brutalism': {
    bg: '#F8E000', fg: '#08080D', accent: '#5200FF', signal: '#E1306C',
    font: 'system-ui, sans-serif',
    radius: '4px', borderWidth: '3px', cardShadow: '4px 4px 0 #000',
  },
  'minimal-mono': {
    bg: '#FFFFFF', fg: '#1A1A1A', accent: '#666666', signal: '#FF6600',
    font: 'system-ui, -apple-system, sans-serif',
    radius: '4px', borderWidth: '1px', cardShadow: 'none',
  },
  'apple-product': {
    bg: '#FFFFFF', fg: '#1D1D1F', accent: '#0066CC', signal: '#FF3B30',
    font: 'system-ui, -apple-system, "SF Pro Text", sans-serif',
    radius: '12px', borderWidth: '0', cardShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  'dark-tech-grid': {
    bg: '#0A0A0F', fg: '#E0E0E8', accent: '#00FF88', signal: '#FF00AA',
    font: '"JetBrains Mono", "Geist Mono", monospace',
    radius: '4px', borderWidth: '1px', cardShadow: '0 0 24px rgba(0,255,136,0.15)',
  },
};

function getTokens(styleId) {
  return STYLE_TOKENS[styleId] || STYLE_TOKENS['minimal-mono'];
}

export function buildPrototype({
  targetPath,
  requirement = 'Untitled prototype',
  styleId = 'minimal-mono',
  device = 'iphone',
  screens = ['Home', 'Detail', 'Profile'],
} = {}) {
  const style = getStyle(styleId);
  const tokens = getTokens(styleId);
  const frame = DEVICE_FRAMES[device] || DEVICE_FRAMES.iphone;

  const html = renderHtml({ requirement, style, tokens, frame, screens });
  const outDir = join(targetPath, '.claude', 'prototypes');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const slug = requirement.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'prototype';
  const file = join(outDir, `${slug}-${Date.now()}.html`);
  writeFileSync(file, html, 'utf8');

  console.log(chalk.green(`  ✅ huashu prototype 生成: ${file}`));
  console.log(chalk.dim(`     device=${frame.name} | style=${style ? style.name : styleId} | screens=${screens.length}`));
  return { file, frame, style: style?.id || styleId, screens };
}

function renderHtml({ requirement, style, tokens, frame, screens }) {
  const screenButtons = screens.map((s, i) => `<button class="nav-btn" data-screen="${i}" ${i === 0 ? 'aria-current="true"' : ''}>${s}</button>`).join('');
  const screenPanels = screens.map((s, i) => `
      <section class="screen" data-screen="${i}" ${i === 0 ? '' : 'hidden'}>
        <header><h1>${s}</h1></header>
        <div class="content">
          <p>${s} 屏幕内容占位。点击下方按钮切换 screens。</p>
          <button class="primary">主操作</button>
          <button class="secondary">次操作</button>
        </div>
      </section>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(requirement)}</title>
<style>
  :root {
    --bg: ${tokens.bg}; --fg: ${tokens.fg};
    --accent: ${tokens.accent}; --signal: ${tokens.signal};
    --font: ${tokens.font};
    --radius: ${tokens.radius}; --border-w: ${tokens.borderWidth};
    --card-shadow: ${tokens.cardShadow};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #e8e8ee; font-family: var(--font); display: grid; place-items: center; min-height: 100vh; padding: 24px; }
  .device { width: ${frame.width}px; height: ${frame.height}px; background: var(--bg); color: var(--fg); border-radius: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; position: relative; }
  .device.frame-desktop { border-radius: 12px; }
  .device-bezel { position: absolute; top: 0; left: 0; right: 0; height: 36px; background: var(--bg); z-index: 10; display: flex; justify-content: center; align-items: flex-end; padding-bottom: 8px; font-size: 12px; color: var(--fg); opacity: 0.7; }
  .screens { padding: 48px 16px 80px; height: 100%; overflow-y: auto; }
  .screen { animation: fadeIn 0.3s; }
  .screen[hidden] { display: none; }
  .screen h1 { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
  .screen .content { display: flex; flex-direction: column; gap: 12px; }
  .screen p { font-size: 15px; line-height: 1.5; opacity: 0.85; }
  button { font-family: var(--font); font-size: 15px; padding: 12px 20px; border: var(--border-w) solid var(--fg); background: transparent; color: var(--fg); border-radius: var(--radius); cursor: pointer; box-shadow: var(--card-shadow); }
  button.primary { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  button.secondary { background: var(--bg); color: var(--fg); }
  button:active { transform: translateY(2px); box-shadow: none; }
  nav { position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: var(--bg); border-top: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: space-around; align-items: center; z-index: 5; }
  .nav-btn { background: none; border: 0; padding: 8px 12px; font-size: 12px; color: var(--fg); opacity: 0.5; box-shadow: none; }
  .nav-btn[aria-current="true"] { opacity: 1; color: var(--accent); }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .credits { position: fixed; bottom: 16px; right: 16px; font-size: 11px; color: #999; }
</style>
</head>
<body>
<main class="device ${frame.cssClass}" data-prototype="${escapeHtml(requirement)}">
  <div class="device-bezel">${frame.name}</div>
  <div class="screens">${screenPanels}</div>
  <nav>${screenButtons}</nav>
</main>
<div class="credits">huashu prototype · style: ${escapeHtml(style ? style.name : 'minimal')}</div>
<script>
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.screen;
      document.querySelectorAll('.nav-btn').forEach(b => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'true');
      document.querySelectorAll('.screen').forEach(s => {
        s.hidden = s.dataset.screen !== target;
      });
    });
  });
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/**
 * Validate prototype with Playwright if available.
 * Returns { passed: boolean, output: string }.
 */
export function validateWithPlaywright(targetPath, prototypeFile) {
  console.log(chalk.dim('  尝试 Playwright 验证原型可点击...'));
  try {
    safeExec(`npx playwright --version 2>&1`, targetPath, { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow('  ⚠ Playwright 未安装，跳过自动验证'));
    return { passed: null, reason: 'no-playwright' };
  }
  const testFile = join(targetPath, '.claude', 'prototypes', `validate-${Date.now()}.spec.js`);
  const testContent = `
import { test, expect } from '@playwright/test';
test('prototype loads and navigates', async ({ page }) => {
  await page.goto('file://${prototypeFile.replace(/\\/g, '/')}');
  await expect(page.locator('.device')).toBeVisible();
  const navBtns = page.locator('.nav-btn');
  const count = await navBtns.count();
  for (let i = 0; i < count; i++) {
    await navBtns.nth(i).click();
    await expect(page.locator(\`.screen[data-screen="\${i}"]\`)).toBeVisible();
  }
});`;
  writeFileSync(testFile, testContent, 'utf8');
  try {
    safeExec(`npx playwright test ${testFile} 2>&1`, targetPath, { stdio: 'pipe' });
    console.log(chalk.green('  ✅ Playwright 验证通过'));
    return { passed: true };
  } catch (e) {
    console.log(chalk.yellow('  ⚠ Playwright 验证失败（可能是浏览器未装）'));
    return { passed: false, reason: e.message || 'playwright-failed' };
  }
}
