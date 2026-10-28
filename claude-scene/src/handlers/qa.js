import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * QA workflow handlers.
 */

export function handleMapRoutes(_action, params, targetPath, context) {
  if (params?.source !== 'git_diff') return { status: 'skip', message: '路由映射未执行：未指定 source' };
  const files = context?.gitDiffFiles || [];
  const frontendExts = ['.tsx', '.jsx', '.vue', '.html', '.css', '.scss'];
  const frontendFiles = files.filter((f) => frontendExts.some((ext) => f.endsWith(ext)));
  // Heuristic: derive page routes from src/pages, src/views, or src/app
  const pages = [];
  for (const dir of ['src/pages', 'src/views', 'src/app']) {
    // 以前读的是 context.targetPath（引擎并不保证写过）而把形参 targetPath 丢掉 ——
    // 于是路由永远在 cwd 下找，目标项目不是 cwd 时一个页面也扫不到还报「映射完成」。
    const dirPath = join(targetPath || context?.targetPath || '.', dir);
    if (!existsSync(dirPath)) continue;
    try {
      for (const f of readdirSync(dirPath)) {
        const base = f.replace(/\.(tsx?|jsx?|vue|html)$/, '').replace(/^index$/, '');
        if (base) pages.push(`/${base}`);
      }
    } catch { /* ignore */ }
  }
  if (context) context.routePages = pages;
  const changeNote = frontendFiles.length === 0 ? '（本次 diff 里没有前端文件变更）' : '';
  return { status: 'pass', message: `路由映射: ${pages.length} 个页面候选${changeNote}` };
}

export function handleLoadPages(_action, _params, _targetPath, context) {
  if (!context?.has_frontend_changes) return '跳过（无前端变更）';
  const pages = context?.routePages || [];
  if (context) context.pagesLoaded = pages.slice(0, 5);
  return `页面加载候选: ${pages.length} 个（CLI 模式跳过实际浏览器访问）`;
}

export function handleTestInteractions(_action, params, _targetPath, context) {
  if (!context?.has_frontend_changes) return { status: 'skip', message: '交互流程检测未执行：无前端变更' };
  // 以前报「N 个流程已识别」，其实一个流程都没跑 —— flows 只是场景里抄下来的名字。
  // 真跑流程要浏览器（Playwright/MCP），CLI 侧只能把它们登记成「待测」。
  const flows = params?.flows || ['form-submit', 'navigation'];
  if (context) context.interactionFlows = flows;
  return {
    status: 'noop',
    message: `交互流程未检测（需浏览器）：已登记 ${flows.length} 个待测流程（${flows.join('、')}）`,
  };
}

export function handleVisualCheck(_action, params, _targetPath, context) {
  if (!context?.has_frontend_changes) return '跳过（无前端变更）';
  const checks = params?.checks || ['layout', 'styling'];
  if (context) context.visualChecks = checks;
  return `视觉检查候选: ${checks.join(', ')}（CLI 模式跳过截图对比）`;
}

export function handleA11yScan(_action, _params, targetPath) {
  const srcDir = join(targetPath, 'src');
  if (!existsSync(srcDir)) return '跳过（无 src/ 目录）';
  let n = 0;
  for (const ext of ['.tsx', '.jsx']) {
    try {
      const files = [];
      function walk(d) {
        for (const f of readdirSync(d)) {
          const fp = join(d, f);
          if (statSync(fp).isDirectory()) walk(fp);
          else if (fp.endsWith(ext)) files.push(fp);
        }
      }
      walk(srcDir);
      for (const f of files) {
        const c = readFileSync(f, 'utf8');
        if (c.match(/<img[^>]*>/) && !c.match(/alt=/)) n++;
      }
    } catch { /* ignore */ }
  }
  return `无障碍快速扫描完成: ${n} 处可疑问题（静态启发式，不替代 pa11y-ci）`;
}

export function handleClassifyBugs(_action, params, _targetPath, context) {
  const levels = params?.levels || ['BLOCKER', 'MAJOR', 'MINOR'];
  const buckets = { BLOCKER: [], MAJOR: [], MINOR: [], INFO: [] };
  if (context?.interactionFlows) {
    context.interactionFlows.forEach((f) => buckets.MAJOR.push(f));
  }
  if (context?.visualChecks) {
    context.visualChecks.forEach((f) => buckets.MINOR.push(f));
  }
  if (context?.has_frontend_changes) {
    buckets.INFO.push('frontend-changed');
  }
  if (context) context.bugBuckets = buckets;
  // 这里没有任何 bug 数据：只是把待测流程/视觉项登记成待验证条目。
  // 说「Bug 分类完成: N 条」会让人以为 N 个缺陷已经分好级了。
  const total = Object.values(buckets).flat().length;
  return {
    status: 'noop',
    message: total === 0
      ? `Bug 分类未执行：没有任何缺陷数据（只支持 ${levels.length} 个等级: ${levels.join('/')}）`
      : `Bug 分类未执行：${total} 条待验证项只是登记（前端变更/待测流程），不是已确认缺陷`,
  };
}

export function handleGenerateQAReport(_action, _params, targetPath, context) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = join(targetPath, '.claude', 'qa');
  const outPath = join(outDir, `qa-report-${ts}.md`);
  try {
    mkdirSync(outDir, { recursive: true });
    const buckets = context?.bugBuckets || { BLOCKER: [], MAJOR: [], MINOR: [], INFO: [] };
    const md = [
      '# QA Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      `- Frontend changes: ${context?.has_frontend_changes ? 'Yes' : 'No'}`,
      `- Total classifications: ${Object.values(buckets).flat().length}`,
      '',
      '## Buckets',
      ...Object.entries(buckets).map(([k, v]) => `- **${k}**: ${v.length > 0 ? v.join(', ') : '—'}`),
      '',
      '> CLI mode: browser-dependent steps (visual check, interaction test) skipped.',
      '> Run in conversation mode for full Playwright/MCP execution.',
    ];
    writeFileSync(outPath, md.join('\n'), 'utf8');
    if (context) context.qaReportPath = outPath;
    return `QA 报告已生成: ${outPath}`;
  } catch (e) {
    return `QA 报告生成失败: ${e.message}`;
  }
}
