import { readFileSync, writeFileSync } from "fs";
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';
import { handleApplyLiquidGlass } from './liquid-glass.js';
import {
  handleCheckAPIConsistency,
  handleCheckConsistency as actionsCheckConsistency,
  handleVisualRegression as actionsVisualRegression,
  handleAddAnimations,
  handleAnalyzeUI as sharedAnalyzeUI,
  handleIconUpgrade,
  handleMicroInteractions,
  executeAction,
} from '../actions.js';
import { handleRunSuite } from './testing.js';
import { handleAwmBrandImport } from './design.js';
import { handleApplyDaisyUI as applyDaisyUI, handleApplyComponents as sharedApplyComponents } from './ui-tools.js';
import { handleInvokeSkill } from './skill-runner.js';
import { handleCheckGate } from './flow-control.js';

const COMPONENT_MAP = {
  '<button': { component: 'Button' },
  '<Button': { component: 'Button', skip: true },
  '<input type="text"': { component: 'Input', selfClose: true },
  '<input type="password"': { component: 'Input', selfClose: true, props: 'type="password"' },
  '<input type="email"': { component: 'Input', selfClose: true, props: 'type="email"' },
  '<input type="checkbox"': { component: 'Checkbox', selfClose: true },
  '<Checkbox': { component: 'Checkbox', skip: true },
  '<select': { component: 'Select' },
  '<Select': { component: 'Select', skip: true },
  '<Card': { component: 'Card', skip: true },
  '<Loading': { component: 'Loading', skip: true },
};

// 美化主题各自需要什么依赖：react 标记的只对 React/Next 工程有意义。
// 以前这里无条件 `npm install lucide-react animate.css`：非 React 工程也会去装，
// 一旦 npm 因为和美化毫无关系的 peer 冲突报错，整步就记 fail —— 美化还没开始就红了，
// 真正的原因（本项目就不是 React 工程）反而没人说出来。
export const UI_POLISH_INSTALL_PACKAGES = [
  { pkg: 'animate.css', react: false },
  { pkg: 'lucide-react', react: true },
  { pkg: 'animal-island-ui', react: true, theme: 'animal-island' },
  { pkg: 'liquid-glass-react', react: true, theme: 'liquid-glass' },
];

function readDeps(targetPath) {
  try {
    const pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf8'));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return null;
  }
}

export function isReactProject(targetPath) {
  const deps = readDeps(targetPath);
  if (!deps) return false;
  return Object.keys(deps).some(k => k === 'react' || k === 'next');
}

/** 选定主题 + 工程类型之后真正要装的包（顺序稳定，便于日志与断言） */
export function selectInstallPackages(theme, react) {
  return UI_POLISH_INSTALL_PACKAGES
    .filter(spec => (!spec.theme || spec.theme === theme) && (!spec.react || react))
    .map(spec => spec.pkg);
}

function reactMajorOf(targetPath) {
  const spec = String(readDeps(targetPath)?.react ?? '');
  const m = spec.match(/(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

/**
 * npm 的报错是几十行日志，整段塞进步骤消息只会把结论淹没。
 * 但只留第一行也不行 —— 第一行固定是 `Command failed: <cmd>`，真正的原因
 * （ERESOLVE / 404 / EACCES）在第二轮。所以跳过壳行取第一条实质错误。
 */
function firstReasonOf(error) {
  const lines = String(error?.message || error)
    .split(/[\r\n]+/)
    .map(l => l.trim());
  const reason = lines.find(l => l && !l.startsWith('Command failed'));
  return (reason || '无错误输出').slice(0, 160);
}

function handleInstallDeps(targetPath, theme) {
  const react = isReactProject(targetPath);
  const pkgs = selectInstallPackages(theme, react);
  // 兜底：将来若某主题只剩 React 专属包，不能执行不带参数的 `npm install`（= 装全量），
  // 更不能记 pass —— 什么都没装就叫完成是假绿。
  if (pkgs.length === 0) {
    return { status: 'skip', message: `依赖安装跳过：本工程不是 React/Next，主题 ${theme} 需要的组件库都用不上` };
  }

  // liquid-glass-react 的 peerDeps 是 react >=19，React 18 工程必须带 --legacy-peer-deps。
  const legacyPeer = pkgs.includes('liquid-glass-react') && reactMajorOf(targetPath) < 19;
  const cmd = `npm install ${pkgs.join(' ')}${legacyPeer ? ' --legacy-peer-deps' : ''}`;
  try {
    safeExec(cmd, targetPath, { stdio: 'ignore' });
  } catch (e) {
    // 装不上 = 美化依赖没就位。说清缺什么，不把 npm 堆栈当结论，也不假装通过。
    return { status: 'warn', message: `依赖安装未完成：${cmd} 失败（${firstReasonOf(e)}），后续美化组件可能不可用` };
  }
  // 非 React 工程少装的库要写出来，否则「依赖安装完成: animate.css」会让人
  // 以为 lucide-react 也装上了，后续图标美化失败时又是一头雾水。
  const skipped = react ? '' : '（跳过 lucide-react 等 React 专属库：本工程不是 React/Next）';
  return `依赖安装完成: ${pkgs.join(' ')}${skipped}`;
}

// Promote <button> → <Button>, inferring type from className and stripping it.
function replaceButtonTags(content) {
  content = content.replace(/<button([^>]*?)>/gi, (_match, attrs) => {
    let preservedAttrs = attrs;
    const className = attrs.match(/className=["']([^"']*)["']/);
    let type = 'primary';
    if (className && className[1]) {
      if (className[1].match(/secondary|danger|warning/)) {
        type = className[1].match(/secondary|danger|warning/)[0];
      }
      // eslint-disable-next-line sonarjs/super-linear-regex
      preservedAttrs = preservedAttrs.replace(/\s+className=["'][^"']*["']/, '');
    }
    return `<Button type="${type}"${preservedAttrs}>`;
  });
  return content.replace(/<\/button>/gi, '</Button>');
}

// Promote <select> → <Select>.
function replaceSelectTags(content) {
  content = content.replace(/<select([^>]*?)>/gi, '<Select$1>');
  return content.replace(/<\/select>/gi, '</Select>');
}

// Prepend component imports after the last existing import, or at top of file.
function injectComponentImports(content, fileComponents) {
  if (content.includes("from 'animal-island-ui'")) return content;
  const importLine = `import { ${[...fileComponents].join(', ')} } from 'animal-island-ui';`;
  const styleImport = "import 'animal-island-ui/style';";
  const importMatches = content.match(/^import .+$/gm);
  if (importMatches && importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    return content.replace(lastImport, `${lastImport}\n${importLine}\n${styleImport}`);
  }
  return `${importLine}\n${styleImport}\n\n${content}`;
}

function replaceInFile(fullPath, componentsUsed, modifiedFiles) {
  let content = readFileSync(fullPath, 'utf-8');
  const fileComponents = new Set();
  for (const [pattern, config] of Object.entries(COMPONENT_MAP)) {
    if (config.skip) continue;
    if (!content.includes(pattern)) continue;

    fileComponents.add(config.component);
    componentsUsed.add(config.component);

    if (config.selfClose) {
      const typeMatch = pattern.match(/type="([^"]*)"/);
      const typeVal = typeMatch ? typeMatch[1] : 'text';
      const extraProps = config.props || '';
      const regex = new RegExp(`<input[^>]*type="${typeVal}"([^>]*?)\\/?>`, 'gi');
      content = content.replace(regex, (_match, attrs) => {
        return `<${config.component} ${extraProps}${attrs.trim() ? ` ${attrs.trim()}` : ''} />`;
      });
    } else if (pattern === '<button') {
      content = replaceButtonTags(content);
    } else if (pattern === '<select') {
      content = replaceSelectTags(content);
    }
  }
  if (fileComponents.size > 0) {
    content = injectComponentImports(content, fileComponents);
    writeFileSync(fullPath, content);
    modifiedFiles.push(fullPath);
  }
}

function handleApplyComponents(targetPath, theme, context) {
  if (theme !== 'animal-island') {
    // Delegate to shared applyComponents for all other themes (light, dark, corporate, garden, cupcake, business, etc.)
    return sharedApplyComponents('applyComponents', { theme }, targetPath, context);
  }
  const componentsUsed = new Set();
  const modifiedFiles = [];

  const jsxFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx)$/.test(f) });
  for (const fullPath of jsxFiles) {
    replaceInFile(fullPath, componentsUsed, modifiedFiles);
  }

  if (componentsUsed.size === 0) {
    // 什么都没替换却 return 裸字符串 → 记 pass。「没找到可改的东西」是 noop，
    // 不是「做完了」。
    return { status: 'noop', message: '未发现可替换的组件（项目可能不包含 button/input/select 等标准元素）' };
  }
  return `组件替换完成：${modifiedFiles.length} 个文件被修改，使用了 ${[...componentsUsed].join(', ')} 组件`;
}

function handleAnalyzeUI(targetPath, context) {
  const files = scanDir(targetPath, { filter: (f) => /\.(jsx?|tsx?|css|html)$/.test(f) });
  if (context) context.totalFiles = files.length;
  // Also run shared analysis for consistency
  sharedAnalyzeUI('analyzeUI', {}, targetPath, context);
  return `前端分析完成，发现 ${files.length} 个前端文件`;
}

function handleNotify(context) {
  if (context.totalFiles !== undefined) {
    console.log(chalk.dim(`  分析文件数: ${context.totalFiles}`));
  }
  if (context.consistencyScore !== undefined) {
    console.log(chalk.dim(`  一致性评分: ${context.consistencyScore}/100`));
  }
  return '任务完成通知已发送';
}

function handleApplyDaisyUIComponents(targetPath, theme, context) {
  return applyDaisyUI('applyDaisyUI', {}, targetPath, context);
}

function handleRemoveHardcodedColors(targetPath) {
  const files = scanDir(targetPath, { filter: (f) => /\.(jsx?|tsx?|css)$/.test(f) });
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  let found = 0;
  for (const f of files) {
    const content = readFileSync(f, 'utf-8');
    const matches = content.match(hexRe);
    if (matches) found += matches.length;
  }
  return `硬编码颜色扫描完成，发现 ${found} 处 hex 颜色引用`;
}

function handleVerifyIconUpgrade(targetPath) {
  const files = scanDir(targetPath, { filter: (f) => /\.(jsx?|tsx?|html)$/.test(f) });
  let materialRefs = 0;
  for (const f of files) {
    const content = readFileSync(f, 'utf-8');
    materialRefs += (content.match(/Material (Symbols|Icons)|material-symbols|material-icons|class="material/gi) || []).length;
  }
  return materialRefs === 0
    ? '验证通过: Material Icons/Symbols 引用数为 0'
    // 「仍有 N 处」以前只是普通文本 → 记 ✓ pass。没清干净就是没达成目标，至少得 ⚡ warn。
    : { status: 'warn', message: `验证完成: 仍有 ${materialRefs} 处 Material Icons/Symbols 引用` };
}

function handleVerifyDaisyUIComponents(targetPath) {
  const files = scanDir(targetPath, { filter: (f) => /\.(jsx?|tsx?)$/.test(f) });
  // 不带 g：带 g 的正则 .test() 会留下 lastIndex，在 for 循环里逐文件复用会漏判
  // （第二个文件从上次命中的下标往后找），统计结果就是假的。
  const daisyClasses = /\b(btn|btn-primary|card|input-bordered|badge|tabs|select-bordered|textarea-bordered|btn-ghost)\b/;
  let withDaisy = 0, total = files.filter(f => /\.(jsx|tsx)$/.test(f)).length;
  for (const f of files) {
    if (/\.(jsx|tsx)$/.test(f) && daisyClasses.test(readFileSync(f, 'utf-8'))) withDaisy++;
  }
  const pct = total ? Math.round(withDaisy / total * 100) : 0;
  return `验证完成: ${withDaisy}/${total} 组件文件使用 DaisyUI 类 (${pct}%)`;
}

function handleVerifyAnimations(targetPath) {
  const viewFiles = scanDir(targetPath, { filter: (f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes('node_modules') });
  const animRe = /\b(animate-in|slide-in-from-bottom|slide-in-from-top|fade-in|slide-in-from-left|slide-in-from-right)\b/;
  let withAnim = 0;
  for (const f of viewFiles) {
    if (animRe.test(readFileSync(f, 'utf-8'))) withAnim++;
  }
  const pct = viewFiles.length ? Math.round(withAnim / viewFiles.length * 100) : 0;
  // Also check for animate.css
  let animateCssRefs = 0;
  for (const f of viewFiles) {
    animateCssRefs += (readFileSync(f, 'utf-8').match(/animate\.css|animate__/gi) || []).length;
  }
  const animMsg = animateCssRefs === 0 ? 'animate.css 引用为 0' : `仍有 ${animateCssRefs} 处 animate.css 引用`;
  const message = `验证完成: ${withAnim}/${viewFiles.length} 视图文件使用自定义动画 (${pct}%), ${animMsg}`;
  // 目标是「不再有 animate.css 引用」：还剩就是没做完，别按 pass 放过。
  return animateCssRefs === 0 ? message : { status: 'warn', message };
}

function handleVerifyMicroInteractions(targetPath) {
  const files = scanDir(targetPath, { filter: (f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes('node_modules') });
  const microRe = /\b(hover:-translate-y-0\.5|hover:shadow-lg|active:scale-\[0\.98\]|transition-colors|hover-lift|hover-glow|active-press)\b/;
  let withMicro = 0;
  for (const f of files) {
    if (microRe.test(readFileSync(f, 'utf-8'))) withMicro++;
  }
  let transitionAll = 0;
  for (const f of files) {
    transitionAll += (readFileSync(f, 'utf-8').match(/transition-all/gi) || []).length;
  }
  return `验证完成: ${withMicro}/${files.length} 文件使用微交互类, transition-all 出现 ${transitionAll} 次`;
}

function handleVerifyNoHardcodedIndigo(targetPath) {
  const files = scanDir(targetPath, { filter: (f) => /\.(jsx?|tsx?|css)$/.test(f) && !f.includes('node_modules') });
  const indigoRe = /#6366f1|#4f46e5|#8b5cf6|#7c3aed|#a855f7/gi;
  let found = 0;
  for (const f of files) {
    found += (readFileSync(f, 'utf-8').match(indigoRe) || []).length;
  }
  return found === 0
    ? '验证通过: 硬编码 indigo 色在项目源码中为 0'
    : { status: 'warn', message: `验证完成: 仍有 ${found} 处硬编码 indigo 色` };
}

function handleCompletionGate(action, params, targetPath, context) {
  return handleCheckGate(action, params, targetPath, context);
}

function handleBrowserScreenshot() {
  return '浏览器截图需 Playwright MCP（对话模式执行），CLI 模式跳过';
}

export const UI_POLISH_ACTIONS = {
  installDeps:        { handler: handleInstallDeps,        args: ['targetPath', 'theme'] },
  applyDaisyUI:       { handler: (action, params, targetPath, context) => applyDaisyUI(action, params, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
  applyDaisyUIComponents: { handler: handleApplyDaisyUIComponents, args: ['targetPath', 'theme', 'context'] },
  applyComponents:    { handler: handleApplyComponents,    args: ['targetPath', 'theme', 'context'] },
  applyLiquidGlass:   { handler: handleApplyLiquidGlass,   args: ['targetPath', 'context'] },
  iconUpgrade:        { handler: (action, params, targetPath) => handleIconUpgrade(action, params, targetPath), args: ['action', 'params', 'targetPath'] },
  addAnimations:      { handler: (action, params, targetPath) => handleAddAnimations(action, params, targetPath), args: ['action', 'params', 'targetPath'] },
  microInteractions:  { handler: (action, params, targetPath) => handleMicroInteractions(action, params, targetPath), args: ['action', 'params', 'targetPath'] },
  analyzeUI:          { handler: handleAnalyzeUI,          args: ['targetPath', 'context'] },
  checkConsistency:   { handler: (action, params, targetPath, context) => actionsCheckConsistency(null, null, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
  runSuite:           { handler: handleRunSuite,           args: ['action', 'params', 'targetPath', 'context'] },
  visualRegression:   { handler: (action, params, targetPath, context) => actionsVisualRegression(null, params, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
  notify:             { handler: handleNotify,             args: ['context'] },
  checkAPIConsistency:{ handler: handleCheckAPIConsistency,args: ['action', 'params', 'targetPath', 'context'] },
  'awm-brand-import': { handler: (action, params, targetPath, context) => handleAwmBrandImport(action, params, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
  invokeSkill:       { handler: (action, params, targetPath, context) => handleInvokeSkill(action, params, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
  removeHardcodedColors:  { handler: handleRemoveHardcodedColors, args: ['targetPath'] },
  verifyIconUpgrade:       { handler: handleVerifyIconUpgrade,    args: ['targetPath'] },
  verifyDaisyUIComponents: { handler: handleVerifyDaisyUIComponents, args: ['targetPath'] },
  verifyAnimations:        { handler: handleVerifyAnimations,     args: ['targetPath'] },
  verifyMicroInteractions: { handler: handleVerifyMicroInteractions, args: ['targetPath'] },
  verifyNoHardcodedIndigo: { handler: handleVerifyNoHardcodedIndigo, args: ['targetPath'] },
  completionGate:   { handler: handleCompletionGate, args: ['action', 'params', 'targetPath', 'context'] },
  browser_screenshot:{ handler: handleBrowserScreenshot, args: [] },
};

export async function executeUIPolish(action, params, context) {
  if (!context.targetPath) {
    console.error(chalk.red('\n⚠️ 错误: context.targetPath 未定义，无法确定目标项目路径'));
    return '动作执行失败（缺少 targetPath）';
  }
  const targetPath = context.targetPath;
  context.lastStepFailed = false;
  if (!context.securityScanResult) context.securityScanResult = {};
  const theme = context.selectedTheme || 'daisyui';

  try {
    const entry = UI_POLISH_ACTIONS[action];
    if (entry) {
      const argMap = { action, params, targetPath, context, theme };
      return entry.handler(...entry.args.map(name => argMap[name]));
    }
    // Fall through to full ACTION_REGISTRY for all other actions
    // (od-brand-*, reconcileDesignTokens, exportAssets, review, etc.)
    return executeAction('ui-polish', action, params, context, targetPath);
  } catch (error) {
    context.lastStepFailed = true;
    console.error(chalk.red(`\n⚠️ 执行 ${action} 时出错: ${error.message}`));
    return `动作 ${action} 执行完成（部分操作可能失败）`;
  }
}
