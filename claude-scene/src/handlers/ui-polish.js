import { readFileSync, writeFileSync } from "fs";
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';
import { PROJECT_ROOT } from '../lib/paths.js';
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

function handleInstallDeps(targetPath, theme) {
  if (theme === 'animal-island') {
    safeExec('npm install animal-island-ui', targetPath, { stdio: 'ignore' });
  }
  safeExec('npm install lucide-react animate.css', targetPath, { stdio: 'ignore' });
  return '依赖安装完成';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
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
      content = content.replace(/<button([^>]*?)>/gi, (_match, attrs) => {
        let preservedAttrs = attrs;
        const className = attrs.match(/className=["']([^"']*)["']/);
        let type = 'primary';
        if (className && className[1]) {
          if (className[1].match(/secondary|danger|warning/)) {
            type = className[1].match(/secondary|danger|warning/)[0];
          }
          // eslint-disable-next-line sonarjs/slow-regex
          preservedAttrs = preservedAttrs.replace(/\s*className=["'][^"']*["']/, '');
        }
        return `<Button type="${type}"${preservedAttrs}>`;
      });
      content = content.replace(/<\/button>/gi, '</Button>');
    } else if (pattern === '<select') {
      content = content.replace(/<select([^>]*?)>/gi, '<Select$1>');
      content = content.replace(/<\/select>/gi, '</Select>');
    }
  }
  if (fileComponents.size > 0) {
    const importLine = `import { ${[...fileComponents].join(', ')} } from 'animal-island-ui';`;
    const styleImport = "import 'animal-island-ui/style';";
    if (!content.includes("from 'animal-island-ui'")) {
      const importMatches = content.match(/^import .+$/gm);
      if (importMatches && importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        content = content.replace(lastImport, `${lastImport}\n${importLine}\n${styleImport}`);
      } else {
        content = `${importLine}\n${styleImport}\n\n${content}`;
      }
    }
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
    return '未发现可替换的组件（项目可能不包含 button/input/select 等标准元素）';
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

const UI_POLISH_ACTIONS = {
  installDeps:        { handler: handleInstallDeps,        args: ['targetPath', 'theme'] },
  applyDaisyUI:       { handler: (action, params, targetPath, context) => applyDaisyUI(action, params, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
  applyComponents:    { handler: handleApplyComponents,    args: ['targetPath', 'theme', 'context'] },
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
