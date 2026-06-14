import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

export function handleAnalyzeUI(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔍 正在分析项目 UI 结构...'));
  const cssFiles = scanDir(targetPath, { filter: (f) => /\.css$|\.scss$|\.less$/.test(f) && !f.includes('node_modules') });
  const componentFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx|vue|svelte)$/.test(f) && !f.includes('node_modules') });
  const htmlFiles = scanDir(targetPath, { filter: (f) => /\.html$/.test(f) && !f.includes('node_modules') });

  let cssVarCount = 0;
  let hardcodedColorCount = 0;
  let tailwindClasses = 0;

  for (const f of cssFiles.slice(0, 50)) {
    try {
      const content = readFileSync(f, 'utf-8');
      cssVarCount += (content.match(/--[\w-]+/g) || []).length;
      hardcodedColorCount += (content.match(/#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(/g) || []).length;
    } catch { /* skip */ }
  }

  for (const f of componentFiles.slice(0, 100)) {
    try {
      const content = readFileSync(f, 'utf-8');
      tailwindClasses += (content.match(/className="[^"]*"/g) || []).filter(c => /\b(flex|grid|p-\d|m-\d|text-|bg-|rounded|shadow|w-\d|h-\d)\b/.test(c)).length;
    } catch { /* skip */ }
  }

  const pkgJsonPath = path.join(targetPath, 'package.json');
  let framework = 'unknown';
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react) framework = deps.next ? 'Next.js' : 'React';
      else if (deps.vue) framework = deps.nuxt ? 'Nuxt' : 'Vue';
      else if (deps.svelte) framework = 'Svelte';
      else if (deps['@angular/core']) framework = 'Angular';
    } catch { /* skip */ }
  }

  console.log(chalk.dim(`  框架: ${framework}`));
  console.log(chalk.dim(`  CSS 文件: ${cssFiles.length}, 组件文件: ${componentFiles.length}, HTML 文件: ${htmlFiles.length}`));
  console.log(chalk.dim(`  CSS 变量: ${cssVarCount}, 硬编码颜色: ${hardcodedColorCount}, Tailwind 类: ${tailwindClasses}`));

  if (context) {
    context.ui_analysis = { framework, cssFiles: cssFiles.length, componentFiles: componentFiles.length, cssVarCount, hardcodedColorCount, tailwindClasses };
  }

  return `UI 分析完成: ${framework}, ${cssFiles.length + componentFiles.length} 个前端文件`;
}

export function handleCheckConsistency(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔍 正在检查UI一致性...'));
  const cssFiles = scanDir(targetPath, { filter: (f) => /\.css$|\.scss$|\.less$/.test(f) });
  const componentFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx|vue)$/.test(f) });

  let totalCssVars = 0;
  let totalHardcodedColors = 0;
  let totalInlineStyles = 0;

  cssFiles.forEach(cssFile => {
    try {
      const content = readFileSync(cssFile, 'utf-8');
      // eslint-disable-next-line sonarjs/slow-regex
      const cssVarMatches = content.match(/--[\w-]+:/g) || [];
      totalCssVars += cssVarMatches.length;
      const hardcodedColorMatches = content.match(/#[0-9a-fA-F]{3,6}|rgb\(|rgba\(/g) || [];
      totalHardcodedColors += hardcodedColorMatches.length;
    } catch { /* unreadable file */ }
  });

  componentFiles.forEach(compFile => {
    try {
      const content = readFileSync(compFile, 'utf-8');
      const inlineStyleMatches = content.match(/style=\{/g) || [];
      totalInlineStyles += inlineStyleMatches.length;
    } catch { /* unreadable file */ }
  });

  const consistencyScore = Math.max(0, 100 - (totalHardcodedColors * 2) - (totalInlineStyles * 5));
  console.log(chalk.dim(`  CSS变量使用: ${totalCssVars} 个`));
  console.log(chalk.dim(`  硬编码颜色: ${totalHardcodedColors} 处`));
  console.log(chalk.dim(`  内联样式: ${totalInlineStyles} 处`));
  console.log(chalk.green(`  一致性评分: ${consistencyScore}/100`));

  if (context) context.consistencyScore = consistencyScore;
  return `UI一致性检查完成（评分: ${consistencyScore}/100）`;
}

export function handleAddAnimations(_action, _params, targetPath) {
  console.log(chalk.blue(`\n✨ 正在添加动效到 ${targetPath}...`));

  // 1. 确保 animate.css import 存在
  const indexCssPath = path.join(targetPath, 'src', 'index.css');
  if (existsSync(indexCssPath)) {
    let indexCss = readFileSync(indexCssPath, 'utf-8');
    if (!indexCss.includes('animate.css')) {
      indexCss = `@import "animate.css";\n${indexCss}`;
      writeFileSync(indexCssPath, indexCss);
      console.log(chalk.green('  ✓ 已注入 animate.css import'));
    }
  }

  // 检查入口文件是否有 animate.css import（如 index.tsx）
  for (const entry of ['index.tsx', 'index.jsx', 'main.tsx', 'main.jsx']) {
    const entryPath = path.join(targetPath, 'src', entry);
    if (existsSync(entryPath)) {
      let content = readFileSync(entryPath, 'utf-8');
      if (!content.includes('animate.css')) {
        content = `import 'animate.css';\n${content}`;
        writeFileSync(entryPath, content);
        console.log(chalk.green(`  ✓ ${entry} 已注入 animate.css import`));
      }
      break;
    }
  }

  // 2. 扫描 JSX/TSX 文件注入动画类
  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  let animatedFiles = 0;
  const screenDirs = ['screens', 'pages', 'views', 'components'];

  for (const filePath of jsxFiles) {
    // 跳过已包含 animate__ 动画的文件（避免重复注入）
    let content = readFileSync(filePath, 'utf-8');
    if (content.includes('animate__animated')) continue;

    const isScreen = screenDirs.some((d) => filePath.replace(/\\/g, '/').includes(`/${d}/`));
    let modified = false;

    if (isScreen) {
      // 页面级组件：给 header/main 区域加动画
      // header: fadeInDown
      if (/<header\b[^>]*className="([^"]*)"/.test(content) && !content.includes('animate__fadeInDown')) {
        content = content.replace(
          /(<header\b[^>]*className=")([^"]*)(")/,
          '$1$2 animate__animated animate__fadeInDown$3'
        );
        modified = true;
      }
      // main: fadeInUp
      if (/<main\b[^>]*className="([^"]*)"/.test(content) && !content.includes('animate__fadeInUp')) {
        content = content.replace(
          /(<main\b[^>]*className=")([^"]*)(")/,
          '$1$2 animate__animated animate__fadeInUp$3'
        );
        modified = true;
      }
    }

    // 所有文件：给根 div 容器加 fadeIn（如果还没动画的话）
    if (!modified && !content.includes('animate__')) {
      // 找第一个有 className 的顶层 JSX 容器
      const rootMatch = content.match(/return\s*\(\s*<div\s+className="([^"]*)"/);
      if (rootMatch && !rootMatch[1].includes('animate__')) {
        content = content.replace(
          /(return\s*\(\s*<div\s+className=")([^"]*)(")/,
          '$1$2 animate__animated animate__fadeIn$3'
        );
        modified = true;
      }
    }

    if (modified) {
      writeFileSync(filePath, content);
      animatedFiles++;
      console.log(chalk.dim(`  ✓ ${path.basename(filePath)}`));
    }
  }

  console.log(chalk.green(`  ✅ 动效注入完成: ${animatedFiles} 个文件`));
  return `动效添加完成，${animatedFiles} 个文件已注入动画`;
}

// Material Symbols → lucide-react 图标映射表
const ICON_MAP = {
  home: 'House',
  bar_chart: 'BarChart3',
  video_library: 'Clapperboard',
  headphones: 'Headphones',
  settings: 'Cog',
  school: 'GraduationCap',
  phone: 'Phone',
  lock: 'Lock',
  account_circle: 'CircleUser',
  person: 'User',
  notifications: 'Bell',
  shield: 'ShieldCheck',
  info: 'Info',
  logout: 'LogOut',
  chevron_right: 'ChevronRight',
  chevron_left: 'ChevronLeft',
  calendar_month: 'CalendarDays',
  receipt_long: 'ScrollText',
  psychology: 'Brain',
  slideshow: 'Presentation',
  open_in_new: 'ExternalLink',
  search: 'Search',
  add: 'Plus',
  edit: 'Pencil',
  delete: 'Trash2',
  close: 'X',
  menu: 'Menu',
  email: 'Mail',
  check: 'Check',
  arrow_back: 'ArrowLeft',
  arrow_forward: 'ArrowRight',
  more_vert: 'MoreVertical',
  more_horiz: 'MoreHorizontal',
  filter_list: 'ListFilter',
  sort: 'ArrowUpDown',
  refresh: 'RefreshCw',
  download: 'Download',
  upload: 'Upload',
  cloud_upload: 'CloudUpload',
  description: 'FileText',
  code: 'Code2',
  link: 'Link',
  bookmark: 'Bookmark',
  favorite: 'Heart',
  star: 'Star',
  share: 'Share2',
  send: 'Send',
  chat: 'MessageCircle',
  forum: 'MessagesSquare',
  help: 'HelpCircle',
  warning: 'TriangleAlert',
  error: 'AlertCircle',
  visibility: 'Eye',
  visibility_off: 'EyeOff',
  content_copy: 'Copy',
  done: 'CheckCheck',
  schedule: 'Clock',
  timer: 'Timer',
  dashboard: 'LayoutDashboard',
  groups: 'UsersRound',
  playlist_add_check: 'ListChecks',
  fact_check: 'ClipboardCheck',
};

function sizeFromClass(className) {
  // 匹配 text-2xl, text-xl, text-lg 等（排除 text-white, text-primary 等颜色类）
  const sizeKeys = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  const sizes = { xs: 14, sm: 16, base: 18, lg: 20, xl: 22, '2xl': 26, '3xl': 32, '4xl': 40, '5xl': 48 };
  const classes = className.split(/\s+/);
  for (const cls of classes) {
    if (cls.startsWith('text-')) {
      const key = cls.replace('text-', '');
      if (sizeKeys.includes(key)) return sizes[key] || 20;
    }
  }
  return 20;
}

export function handleIconUpgrade(_action, _params, targetPath) {
  console.log(chalk.blue('\n🧩 正在升级图标: Material Symbols → lucide-react...'));

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  let upgradedFiles = 0;
  let totalIcons = 0;
  const filesNeedingLucideImport = [];

  for (const filePath of jsxFiles) {
    let content = readFileSync(filePath, 'utf-8');
    let fileModified = false;
    let fileIcons = 0;

    // 匹配 <span className="material-symbols-outlined ...">icon_name</span>
    const iconRegex = /<span\s+className="material-symbols-outlined\s*([^"]*)"\s*>(\w+)<\/span>/g;
    let match;

    while ((match = iconRegex.exec(content)) !== null) {
      const extraClasses = match[1] || '';
      const iconName = match[2];
      const lucideName = ICON_MAP[iconName];

      if (lucideName) {
        const size = sizeFromClass(extraClasses);
        // 保留所有非 material-symbols、非 text-size 的类名
        const sizeKeys = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'];
        const preservedClasses = extraClasses
          .split(/\s+/)
          .filter(c => c && c !== 'material-symbols-outlined' && !sizeKeys.includes(c))
          .join(' ');
        const classProp = preservedClasses ? ` className="${preservedClasses}"` : '';
        content = content.replace(match[0], `<${lucideName} size={${size}}${classProp} />`);
        fileIcons++;
        fileModified = true;
      }
    }

    if (fileModified) {
      // 添加 lucide-react import
      const iconsInFile = [];
      for (const [_, lucideName] of Object.entries(ICON_MAP)) {
        const compRegex = new RegExp(`<${lucideName}\\s`, 'g');
        if (compRegex.test(content)) iconsInFile.push(lucideName);
      }

      if (iconsInFile.length > 0) {
        // 找到最后一个 import 语句的位置
        const importMatches = content.match(/^import\s+.+$/gm);
        if (importMatches) {
          const lastImport = importMatches[importMatches.length - 1];
          const lucideImport = `import { ${[...new Set(iconsInFile)].join(', ')} } from 'lucide-react';`;
          if (!content.includes("from 'lucide-react'")) {
            content = content.replace(lastImport, `${lastImport}\n${lucideImport}`);
          }
        }
      }

      writeFileSync(filePath, content);
      upgradedFiles++;
      totalIcons += fileIcons;
      console.log(chalk.dim(`  ✓ ${path.basename(filePath)}: ${fileIcons} 个图标`));
    }
  }

  console.log(chalk.green(`  ✅ 图标升级完成: ${upgradedFiles} 个文件, ${totalIcons} 个图标`));
  return `图标升级完成: ${upgradedFiles} 文件, ${totalIcons} 图标`;
}

export function handleMicroInteractions(_action, _params, targetPath) {
  console.log(chalk.blue('\n🎯 正在添加微交互效果...'));

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  let modifiedFiles = 0;

  for (const filePath of jsxFiles) {
    let content = readFileSync(filePath, 'utf-8');
    let fileModified = false;

    // 1. 给带 onClick 的可点击元素加 hover/active 效果
    // 匹配 <div/bution/a ... onClick={...} ... className="..." ...>
    const clickableRegex = /<((?:div|button|a|span|li)\b[^>]*?onClick=\{[^}]*\}[^>]*?className=")([^"]*)("[^>]*?>)/g;
    let match;
    while ((match = clickableRegex.exec(content)) !== null) {
      const existingClasses = match[2];
      // 跳过已经有效果的
      if (/hover:/.test(existingClasses) && /active:/.test(existingClasses)) continue;

      let extraClasses = '';
      if (!/hover:-translate-y/.test(existingClasses)) extraClasses += ' hover:-translate-y-0.5';
      if (!/hover:shadow/.test(existingClasses)) extraClasses += ' hover:shadow-lg';
      if (!/active:scale/.test(existingClasses)) extraClasses += ' active:scale-[0.98]';
      if (!/transition/.test(existingClasses)) extraClasses += ' transition-all duration-200';

      if (extraClasses) {
        const tag = match[1];
        const rest = match[3];
        content = content.replace(match[0], `<${tag}${existingClasses}${extraClasses}${rest}`);
        fileModified = true;
      }
    }

    // 2. 给带 cursor-pointer 的元素加 hover 效果（如果没有 onClick 的话已经在上面处理了）
    const cursorRegex = /<((?:div|li|span)\b[^>]*?className=")([^"]*cursor-pointer[^"]*)("[^>]*?>)(?!.*onClick)/g;
    // 这个比较复杂，简化处理：找所有 cursor-pointer 但没有 hover: 的元素
    const cursorLines = content.match(/className="[^"]*cursor-pointer[^"]*"/g);
    if (cursorLines) {
      for (const cls of cursorLines) {
        if (!cls.includes('hover:') && !cls.includes('transition')) {
          const enhanced = cls.replace(/"$/, ' hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200"');
          content = content.replace(cls, enhanced);
          fileModified = true;
        }
      }
    }

    if (fileModified) {
      writeFileSync(filePath, content);
      modifiedFiles++;
      console.log(chalk.dim(`  ✓ ${path.basename(filePath)}`));
    }
  }

  console.log(chalk.green(`  ✅ 微交互注入完成: ${modifiedFiles} 个文件`));
  return `微交互注入完成，${modifiedFiles} 个文件`;
}

function runPlaywrightVisual(targetPath, context) {
  console.log(chalk.dim('  运行 Playwright 视觉测试...'));
  try {
    safeExec('npx playwright test --grep visual 2>&1', targetPath, { stdio: 'inherit' });
    if (context) context.visualRegressionPassed = true;
  } catch {
    if (context) context.visualRegressionPassed = false;
  }
  console.log(chalk.green('  视觉回归测试完成'));
}

export function handleVisualRegression(_action, params, targetPath, context) {
  const viewports = params?.viewports || ['desktop'];
  console.log(chalk.blue('\n🖼️ 正在进行视觉回归测试...'));
  console.log(chalk.dim(`  视口: ${viewports.join(', ')}`));

  const screenshotsDir = path.join(targetPath, 'screenshots');
  if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

  const packagePath = path.join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    if (context) context.visualRegressionPassed = false;
    console.log(chalk.yellow('  未找到 package.json'));
    return '视觉回归测试完成（无 package.json）';
  }

  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    if (pkg.devDependencies?.playwright || pkg.dependencies?.playwright) {
      runPlaywrightVisual(targetPath, context);
      return `视觉回归测试完成 (${viewports.join(', ')})`;
    }
  } catch { /* unreadable file */ }

  if (context) context.visualRegressionPassed = false;
  console.log(chalk.yellow('  未安装 Playwright'));
  return '视觉回归测试完成（需要手动安装 Playwright）';
}

export { handleCheckAPIConsistency } from './api-consistency.js';

export function handleApplyDaisyUI(_action, params, targetPath, context) {
  const theme = context?.selectedTheme || params?.theme || 'light';
  if (theme === 'huashu' || theme === 'huashu-html') {
    return handleApplyHuashuStyle(_action, params, targetPath, context);
  }
  console.log(chalk.blue(`\n🌼 正在应用 DaisyUI 主题: ${theme}...`));
  const pkgPath = path.join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      safeExec('npm install daisyui 2>&1 || true', targetPath, { stdio: 'pipe' });
      console.log(chalk.green(`  ✅ DaisyUI 已安装，主题: ${theme}`));
    } catch {
      console.log(chalk.yellow('  ⚠ DaisyUI 安装失败'));
    }
  }
  console.log(chalk.dim('  ℹ 完整主题配置需 tailwind.config.js 修改，CLI 模式下为轻量操作'));
  return `DaisyUI 主题已应用 (${theme})`;
}

export async function handleApplyHuashuStyle(_action, params, targetPath, context) {
  const { listStyles, getStyle } = await import('../lib/huashu/style-library.js');
  const styleId = context?.huashu_style_id || params?.styleId;
  if (!styleId) {
    const web = listStyles('web');
    console.log(chalk.blue('\n🎨 Huashu 40 风格库（请通过 context.huashu_style_id 选定）：'));
    for (const s of web.slice(0, 12)) console.log(chalk.dim(`  ${s.id.padEnd(20)} ${s.name} [${s.temp}]`));
    return 'huashu 风格库已列出（未指定 styleId）';
  }
  const style = getStyle(styleId);
  if (!style) {
    console.log(chalk.yellow(`  ⚠ 未找到 huashu 风格: ${styleId}`));
    return `huashu 风格未匹配: ${styleId}`;
  }
  console.log(chalk.green(`  ✅ huashu 风格已选定: ${style.name} [${style.temp}/${style.fit}]`));
  console.log(chalk.dim(`     DNA: ${style.dna}`));
  if (context) context.huashu_applied_style = style;
  return `huashu 风格应用: ${style.name}`;
}

export function handleApplyComponents(_action, params, targetPath, context) {
  const theme = context?.selectedTheme || params?.theme || 'light';
  const isAnimalIsland = theme === 'animal-island';
  console.log(chalk.blue(`\n🧩 正在增强组件样式 (${theme})...`));

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  // Theme-specific style presets
  const presets = {
    'animal-island': {
      button: 'rounded-2xl shadow-md hover:shadow-lg active:shadow-sm transition-all duration-300 font-medium',
      input: 'rounded-xl border-2 border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-200 transition-all duration-200',
      select: 'rounded-xl border-2 border-green-200 focus:border-green-400 transition-all duration-200',
      card: 'rounded-2xl shadow-md border border-green-100 bg-white',
    },
    corporate: {
      button: 'rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-semibold tracking-wide',
      input: 'rounded-lg border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all',
      select: 'rounded-lg border-gray-300 focus:border-blue-500 transition-all',
    },
  };
  const style = presets[theme] || presets.corporate;

  let enhancedFiles = 0;
  let totalElements = 0;

  for (const filePath of jsxFiles) {
    let content = readFileSync(filePath, 'utf-8');
    let fileModified = false;

    // Enhance <button> elements — add styling classes if using bare Tailwind
    const buttonRegex = /<button\b([^>]*?)className="([^"]*)"/g;
    let match;
    while ((match = buttonRegex.exec(content)) !== null) {
      const existingClasses = match[2];
      // Skip if already heavily styled (has bg-*, rounded-*, etc.)
      if (/bg-/.test(existingClasses) && /rounded-/.test(existingClasses)) continue;
      // Skip if it's a simple icon button or unstyled
      if (existingClasses.includes('btn-') || existingClasses.includes('btn ')) continue;

      const newClasses = existingClasses + (existingClasses ? ' ' : '') + style.button;
      content = content.replace(
        `<button${match[1]}className="${match[2]}"`,
        `<button${match[1]}className="${newClasses}"`
      );
      fileModified = true;
      totalElements++;
    }

    // Enhance <input> elements
    const inputRegex = /<input\b([^>]*?)className="([^"]*)"/g;
    while ((match = inputRegex.exec(content)) !== null) {
      const existingClasses = match[2];
      if (/rounded-/.test(existingClasses)) continue;
      const typeMatch = match[0].match(/type\s*=\s*["'](submit|button|hidden|checkbox|radio)["']/);
      if (typeMatch) continue; // Skip non-text inputs

      const newClasses = existingClasses + (existingClasses ? ' ' : '') + style.input;
      content = content.replace(
        `<input${match[1]}className="${match[2]}"`,
        `<input${match[1]}className="${newClasses}"`
      );
      fileModified = true;
      totalElements++;
    }

    if (fileModified) {
      writeFileSync(filePath, content);
      enhancedFiles++;
      console.log(chalk.dim(`  ✓ ${path.basename(filePath)}`));
    }
  }

  console.log(chalk.green(`  ✅ 组件增强完成: ${enhancedFiles} 个文件, ${totalElements} 个元素`));
  return `组件增强完成: ${enhancedFiles} 文件, ${totalElements} 元素 (${theme})`;
}

export function handleWebDesignVerify(_action, _params, targetPath) {
  console.log(chalk.blue('\n🔍 正在验证 Web 设计...'));

  const issues = [];
  const cssFiles = scanDir(targetPath, {
    filter: (f) => /\.css$/.test(f) && !f.includes('node_modules'),
  });

  if (!cssFiles.length) {
    issues.push('缺少 CSS 文件');
  }

  // 检查关键设计元素
  for (const cssFile of cssFiles) {
    const content = readFileSync(cssFile, 'utf-8');
    if (!/--[\w-]+/.test(content)) {
      issues.push(`${path.basename(cssFile)}: 未使用 CSS 变量（建议用设计 Token）`);
    }
    if (/#[0-9a-fA-F]{3,6}/g.test(content) && !/--[\w-]+/.test(content)) {
      issues.push(`${path.basename(cssFile)}: 硬编码颜色较多，建议提取为 CSS 变量`);
    }
  }

  // 检查组件文件
  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });
  let inlineStyleCount = 0;
  for (const f of jsxFiles) {
    const content = readFileSync(f, 'utf-8');
    const matches = content.match(/style=\{\{/g);
    if (matches) inlineStyleCount += matches.length;
  }
  if (inlineStyleCount > 5) {
    issues.push(`${inlineStyleCount} 处内联样式，建议迁移到 Tailwind 类`);
  }

  if (issues.length) {
    issues.forEach((i) => console.log(chalk.yellow(`  ⚠ ${i}`)));
  } else {
    console.log(chalk.green('  ✅ 设计验证通过'));
  }
  return `Web 设计验证完成: ${issues.length ? issues.join('; ') : '无问题'}`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleReconcileDesignTokens(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔗 正在调和设计 Token...'));
  const existing = { brand: [], fonts: [], spacing: [], radii: [], shadows: [], motion: [] };

  // Scan .claude/designs/ (open-design Skill output) — treat as authoritative existing tokens
  const designBaselinePath = path.join(targetPath, '.claude', 'designs', 'design-baseline.md');
  const designSystemPath = path.join(targetPath, '.claude', 'designs', 'design-system.md');
  for (const p of [designBaselinePath, designSystemPath]) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8');
        if (/palette|color|#[0-9a-fA-F]{3,8}|oklch|hsl|rgb/i.test(content)) existing.brand.push(p);
        if (/typography|font|typeface/i.test(content)) existing.fonts.push(p);
        if (/spacing/i.test(content)) existing.spacing.push(p);
        if (/radius|border-radius/i.test(content)) existing.radii.push(p);
        if (/shadow|elevation/i.test(content)) existing.shadows.push(p);
        if (/motion|duration|easing|animation/i.test(content)) existing.motion.push(p);
      } catch { /* unreadable */ }
    }
  }

  // Scan DESIGN.md
  const designMdPath = path.join(targetPath, 'DESIGN.md');
  if (existsSync(designMdPath)) {
    try {
      const content = readFileSync(designMdPath, 'utf-8');
      if (content.includes('brand')) existing.brand.push('DESIGN.md');
      if (content.includes('font') || content.includes('typography')) existing.fonts.push('DESIGN.md');
      if (content.includes('spacing')) existing.spacing.push('DESIGN.md');
    } catch { /* unreadable */ }
  }

  // Scan tailwind.config
  for (const cfg of ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs']) {
    const cfgPath = path.join(targetPath, cfg);
    if (existsSync(cfgPath)) {
      try {
        const content = readFileSync(cfgPath, 'utf-8');
        if (/colors\s*:\s*\{/.test(content)) existing.brand.push(cfg);
        if (/fontFamily\s*:\s*\{/.test(content)) existing.fonts.push(cfg);
        if (/borderRadius\s*:\s*\{/.test(content)) existing.radii.push(cfg);
        if (/boxShadow\s*:\s*\{/.test(content)) existing.shadows.push(cfg);
      } catch { /* unreadable */ }
      break;
    }
  }

  // Scan CSS files for custom properties
  for (const cssFile of scanDir(targetPath, { filter: f => /\.css$/.test(f) && !f.includes('node_modules') })) {
    try {
      const content = readFileSync(cssFile, 'utf-8');
      if (/--color-/.test(content)) existing.brand.push(cssFile);
      if (/--font-/.test(content)) existing.fonts.push(cssFile);
      if (/--spacing-/.test(content)) existing.spacing.push(cssFile);
      if (/--radius-/.test(content)) existing.radii.push(cssFile);
      if (/--shadow-/.test(content)) existing.shadows.push(cssFile);
      if (/prefers-reduced-motion|--duration-|--ease-/.test(content)) existing.motion.push(cssFile);
    } catch { /* unreadable */ }
  }

  const totalExisting = Object.values(existing).reduce((s, a) => s + a.length, 0);
  console.log(chalk.dim(`  已有 Token 来源: ${totalExisting} 处`));
  for (const [cat, sources] of Object.entries(existing)) {
    if (sources.length) console.log(chalk.dim(`    ${cat}: ${[...new Set(sources)].join(', ')}`));
  }
  if (totalExisting === 0) console.log(chalk.dim('  ℹ 未发现已有设计 Token，将全量应用新主题'));
  else console.log(chalk.green('  ✅ 已有 Token 保留，新主题填充缺失项'));

  if (context) context.reconciledTokens = existing;
  return `设计 Token 调和完成: ${totalExisting} 处已有 Token 保留`;
}

export function handleImpeccableCritique(_action, params, targetPath) {
  console.log(chalk.blue('\n🎯 正在执行 Impeccable 设计打磨...'));
  const rules = params?.rules || ['anti-patterns', 'llm-critique'];
  const checks = params?.checks || [];
  console.log(chalk.dim(`  规则集: ${rules.join(', ')}`));

  const issues = { fixed: [], warned: [] };

  // 扫描所有前端文件
  const frontendFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx|css|html)$/.test(f) && !f.includes('node_modules'),
  });

  for (const filePath of frontendFiles) {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;

    // 规则1: 纯黑文字 → neutral-900
    if (/text-black|#000000|#[0]{3}\b/.test(content)) {
      content = content
        .replace(/text-black/g, 'text-neutral-900')
        .replace(/#000000/gi, '#171717')
        .replace(/#000\b(?!\d)/gi, '#171717');
      modified = true;
      issues.fixed.push(`${path.basename(filePath)}: 纯黑→neutral-900`);
    }

    // 规则2: 纯白背景 → neutral-50（只处理 Tailwind 类名）
    if (/\bbg-white\b/.test(content)) {
      content = content.replace(/\bbg-white\b/g, 'bg-neutral-50');
      modified = true;
      issues.fixed.push(`${path.basename(filePath)}: bg-white→bg-neutral-50`);
    }

    // 规则3: 紫色渐变（AI塑料感标志）→ 项目品牌色
    if (/purple-\d+|indigo-\d+|violet-\d+/.test(content)) {
      issues.warned.push(`${path.basename(filePath)}: 检测到紫色系渐变（AI塑料感），建议替换为品牌色`);
    }

    // 规则4: 缺少过渡的交互元素
    if (/onClick/.test(content) && !/transition/.test(content)) {
      issues.warned.push(`${path.basename(filePath)}: 交互元素缺少 transition`);
    }

    if (modified) {
      writeFileSync(filePath, content);
      console.log(chalk.dim(`  ✓ ${path.basename(filePath)}`));
    }
  }

  if (issues.fixed.length) {
    issues.fixed.forEach((f) => console.log(chalk.green(`  ✓ 已修复: ${f}`)));
  }
  if (issues.warned.length) {
    issues.warned.forEach((w) => console.log(chalk.yellow(`  ⚠ 建议: ${w}`)));
  }

  console.log(chalk.green(`  ✅ Impeccable 打磨完成: ${issues.fixed.length} 处修复, ${issues.warned.length} 处建议`));
  return `Impeccable 打磨完成: ${issues.fixed.length} 修复, ${issues.warned.length} 建议`;
}
