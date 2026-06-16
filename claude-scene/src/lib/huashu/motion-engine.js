/**
 * Huashu motion engine adapter: wraps huashu render-video.js script
 * for generating MP4/GIF release animations.
 * Lazy-loads heavy deps (sharp, playwright) only when invoked.
 */
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../safe-exec.js';

const HUASHU_RENDER_SCRIPT = 'assets/huashu/render-video.js';

export function isAvailable(projectRoot) {
  return existsSync(join(projectRoot, HUASHU_RENDER_SCRIPT));
}

export function generateReleaseAnimation({
  targetPath,
  projectRoot,
  title = 'Release',
  version = 'v1.0.0',
  duration = 5,
  outputFormat = 'mp4',
} = {}) {
  if (!isAvailable(projectRoot)) {
    return { skipped: true, reason: 'render-script-missing' };
  }

  const outDir = join(targetPath, '.claude', 'animations');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const stageFile = join(outDir, `release-${Date.now()}.html`);
  writeFileSync(stageFile, buildReleaseStageHtml({ title, version, duration }), 'utf8');

  // Attempt to render via huashu's render-video.js
  const renderScript = join(projectRoot, HUASHU_RENDER_SCRIPT);
  const outFile = join(outDir, `release-${Date.now()}.${outputFormat}`);
  try {
    safeExec(`node "${renderScript}" --input "${stageFile}" --output "${outFile}" --duration ${duration} 2>&1`, projectRoot, { stdio: 'pipe' });
    if (existsSync(outFile)) {
      return { file: outFile, stage: stageFile };
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 渲染失败（缺少 sharp/playwright 依赖? ${e.message.split('\n', 1)[0]}）`));
  }

  return { file: null, stage: stageFile, manual: true };
}

function buildReleaseStageHtml({ title, version, duration }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { margin: 0; background: #0A0A0F; color: #E0E0E8; font-family: system-ui, -apple-system, sans-serif; height: 100vh; display: grid; place-items: center; overflow: hidden; }
  .stage { text-align: center; }
  .version { font-family: "JetBrains Mono", monospace; font-size: 14px; color: #00FF88; opacity: 0; animation: fadeIn 0.5s ${duration * 0.1}s forwards; }
  .title { font-size: 96px; font-weight: 800; letter-spacing: -2px; opacity: 0; transform: translateY(20px); animation: rise 1s ${duration * 0.25}s forwards; margin-top: 12px; }
  .tagline { font-size: 18px; color: #888; margin-top: 16px; opacity: 0; animation: fadeIn 0.8s ${duration * 0.6}s forwards; }
  @keyframes fadeIn { to { opacity: 1; } }
  @keyframes rise { to { opacity: 1; transform: none; } }
</style></head>
<body>
  <div class="stage">
    <div class="version">${version}</div>
    <div class="title">${title}</div>
    <div class="tagline">huashu motion-engine · ${duration}s</div>
  </div>
</body></html>`;
}
