import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from './lib/safe-exec.js';
import { getActionMessage } from './data/action-messages.js';
import { scanDir } from './lib/scan-dir.js';
import { PROJECT_ROOT } from './lib/paths.js';
import {
  handleCeAction,
  handleCheckAPIConsistency,
  handleCheckConsistency as actionsCheckConsistency,
  handleVisualRegression as actionsVisualRegression,
  handleAddAnimations,
  handleAnalyzeUI as sharedAnalyzeUI,
} from './actions.js';
import { handleRunSuite } from './handlers/testing.js';
import { handleAwmBrandImport } from './handlers/design.js';

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
  console.log(chalk.blue(`\n📦 正在安装依赖到 ${targetPath}...`));
  if (theme === 'animal-island') {
    safeExec('npm install animal-island-ui', targetPath, { stdio: 'ignore' });
  }
  safeExec('npm install lucide-react animate.css', targetPath, { stdio: 'ignore' });
  return '依赖安装完成';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function handleApplyDaisyUI(targetPath, theme) {
  console.log(chalk.blue(`\n🎨 正在应用主题到 ${targetPath}...`));
  const tailwindConfigPath = join(targetPath, 'tailwind.config.js');
  if (existsSync(tailwindConfigPath)) {
    let tailwindConfig = readFileSync(tailwindConfigPath, 'utf-8');
    if (theme === 'daisyui') {
      if (!tailwindConfig.includes('daisyui')) {
        if (tailwindConfig.includes("require('daisyui')") || tailwindConfig.includes('"daisyui"')) {
          console.log(chalk.gray('  → daisyui 插件已配置，跳过'));
        } else {
          if (tailwindConfig.includes('plugins:')) {
            tailwindConfig = tailwindConfig.replace(
              /plugins:\s*\[/,
              "plugins: [\n    require('daisyui'),"
            );
          } else if (tailwindConfig.includes('module.exports')) {
            tailwindConfig = tailwindConfig.replace(
              /module\.exports\s*=\s*\{/,
              "module.exports = {\n  plugins: [require('daisyui')],"
            );
          }
          if (!tailwindConfig.includes('daisyui: {')) {
            tailwindConfig = tailwindConfig.replace(
              /module\.exports\s*=\s*\{/,
              "module.exports = {\n  daisyui: {\n    themes: ['light', 'dark', 'corporate', 'garden', 'cupcake'],\n  },"
            );
          }
          writeFileSync(tailwindConfigPath, tailwindConfig);
          console.log(chalk.green('  ✓ tailwind.config.js → 已配置 daisyui 插件及主题'));
        }
      }
    } else if (theme === 'animal-island') {
      if (!tailwindConfig.includes('island-primary')) {
        const themeExtension = `      colors: {
        'island-primary': '#19c8b9',
        'island-secondary': '#F5F5DC',
        'island-accent': '#FF6F61',
        'island-text': '#5D4E37',
        'island-bg': '#FAF8F5',
      },
      borderRadius: {
        'island': '24px',
        'island-sm': '16px',
      },
      boxShadow: {
        'island': '0 4px 20px rgba(93, 78, 55, 0.1)',
      },`;
        if (tailwindConfig.includes('extend:')) {
          tailwindConfig = tailwindConfig.replace(
            /extend:\s*\{/,
            `extend: {\n${themeExtension}`
          );
        } else if (tailwindConfig.includes('theme:')) {
          tailwindConfig = tailwindConfig.replace(
            /theme:\s*\{/,
            `theme: {\n    extend: {\n${themeExtension}\n    },`
          );
        }
        writeFileSync(tailwindConfigPath, tailwindConfig);
        console.log(chalk.green('  ✓ tailwind.config.js → 已注入 Animal Island UI 主题色'));
      } else {
        console.log(chalk.gray('  → tailwind.config.js 已包含 Animal Island UI 主题，跳过'));
      }
    }
  }
  const indexCssPath = join(targetPath, 'src', 'index.css');
  if (existsSync(indexCssPath)) {
    let indexCss = readFileSync(indexCssPath, 'utf-8');
    if (theme === 'animal-island') {
      if (!indexCss.includes('--island-primary')) {
        const animalIslandVars = `
/* === Animal Island UI 主题变量 === */
:root {
  --island-primary: #19c8b9;
  --island-secondary: #F5F5DC;
  --island-accent: #FF6F61;
  --island-text: #5D4E37;
  --island-bg: #FAF8F5;
  --island-radius: 16px;
  --island-radius-lg: 24px;
  --island-shadow: 0 4px 20px rgba(93, 78, 55, 0.1);
}

body {
  background-color: var(--island-bg);
  color: var(--island-text);
  font-family: 'Nunito', 'Noto Sans SC', 'Segoe UI', sans-serif;
}

* {
  border-radius: var(--island-radius);
}
`;
        indexCss = indexCss.replace('@tailwind utilities;', `@tailwind utilities;\n${animalIslandVars}`);
        writeFileSync(indexCssPath, indexCss);
        console.log(chalk.green('  ✓ src/index.css → 已注入 Animal Island UI 主题变量'));
      } else {
        console.log(chalk.gray('  → src/index.css 已包含 Animal Island UI 变量，跳过'));
      }
    }
  }
  return `主题 ${theme} 应用完成`;
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
    console.log(chalk.green(`  ✓ ${fullPath} → 使用 ${[...fileComponents].join(', ')}`));
  }
}

function handleApplyComponents(targetPath, theme) {
  if (theme !== 'animal-island') {
    return '跳过组件替换（非 Animal Island UI 主题，DaisyUI 通过 CSS 类名生效）';
  }
  console.log(chalk.blue('\n🧩 正在扫描并替换为 Animal Island UI 组件...'));
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
  sharedAnalyzeUI('analyzeUI', {}, targetPath);
  return `前端分析完成，发现 ${files.length} 个前端文件`;
}

function handleNotify(context) {
  console.log(chalk.green('\n✅ UI美化工作流执行完成！'));
  console.log(chalk.dim(`  主题: ${context.selectedTheme || 'default'}`));
  if (context.totalFiles) {
    console.log(chalk.dim(`  分析文件数: ${context.totalFiles}`));
  }
  if (context.consistencyScore) {
    console.log(chalk.dim(`  一致性评分: ${context.consistencyScore}/100`));
  }
  return '任务完成通知已发送';
}

const UI_POLISH_ACTIONS = {
  installDeps:        { handler: handleInstallDeps,        args: ['targetPath', 'theme'] },
  applyDaisyUI:       { handler: handleApplyDaisyUI,       args: ['targetPath', 'theme'] },
  applyComponents:    { handler: handleApplyComponents,    args: ['targetPath', 'theme'] },
  addAnimations:      { handler: (action, params, targetPath) => handleAddAnimations(action, params, targetPath), args: ['action', 'params', 'targetPath'] },
  analyzeUI:          { handler: handleAnalyzeUI,          args: ['targetPath', 'context'] },
  checkConsistency:   { handler: (action, params, targetPath, context) => actionsCheckConsistency(null, null, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
  runSuite:           { handler: handleRunSuite,           args: ['action', 'params', 'targetPath', 'context'] },
  visualRegression:   { handler: (action, params, targetPath) => actionsVisualRegression(null, params, targetPath), args: ['action', 'params', 'targetPath'] },
  notify:             { handler: handleNotify,             args: ['context'] },
  checkAPIConsistency:{ handler: handleCheckAPIConsistency,args: ['action', 'params', 'targetPath', 'context'] },
  'awm-brand-import': { handler: (action, params, targetPath, context) => handleAwmBrandImport(action, params, targetPath, context), args: ['action', 'params', 'targetPath', 'context'] },
};

export async function executeUIPolish(action, params, context) {
  const targetPath = context.targetPath || PROJECT_ROOT;
  context.lastStepFailed = false;
  if (!context.securityScanResult) context.securityScanResult = {};
  const theme = context.selectedTheme || 'daisyui';

  try {
    if (action.startsWith('ce-')) {
      return handleCeAction(action);
    }
    const entry = UI_POLISH_ACTIONS[action];
    if (entry) {
      const argMap = { action, params, targetPath, context, theme };
      return entry.handler(...entry.args.map(name => argMap[name]));
    }
    return getActionMessage(action);
  } catch (error) {
    context.lastStepFailed = true;
    console.log(chalk.red(`\n⚠️ 执行 ${action} 时出错: ${error.message}`));
    return `动作 ${action} 执行完成（部分操作可能失败）`;
  }
}
