import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

export function handleAnalyzeUI(_action, _params, targetPath, context) {
  const cssFiles = scanDir(targetPath, { filter: (f) => /\.css$|\.scss$|\.less$/.test(f) && !f.includes('node_modules') });
  const componentFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx|vue|svelte)$/.test(f) && !f.includes('node_modules') });

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

  if (context) {
    context.ui_analysis = { framework, cssFiles: cssFiles.length, componentFiles: componentFiles.length, cssVarCount, hardcodedColorCount, tailwindClasses };
  }

  return `UI 分析完成: ${framework}, ${cssFiles.length + componentFiles.length} 个前端文件`;
}

export function handleCheckConsistency(_action, _params, targetPath, context) {
  const cssFiles = scanDir(targetPath, { filter: (f) => /\.css$|\.scss$|\.less$/.test(f) }).slice(0, 100);
  const componentFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx|vue)$/.test(f) }).slice(0, 200);

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

  if (context) context.consistencyScore = consistencyScore;
  return `UI一致性检查完成（评分: ${consistencyScore}/100）`;
}

export function handleAddAnimations(_action, _params, targetPath) {

  // 1. 确保 animate.css import 存在
  const indexCssPath = path.join(targetPath, 'src', 'index.css');
  if (existsSync(indexCssPath)) {
    let indexCss = readFileSync(indexCssPath, 'utf-8');
    if (!indexCss.includes('animate.css')) {
      indexCss = `@import "animate.css";\n${indexCss}`;
      writeFileSync(indexCssPath, indexCss);
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
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }
    if (content.includes('animate__animated')) continue;

    const isScreen = screenDirs.some((d) => filePath.replace(/\\/g, '/').includes(`/${d}/`));
    let isModified = false;

    if (isScreen) {
      // 页面级组件：给容器区域加动画
      const topPatterns = [
        { tag: 'header', anim: 'animate__fadeInDown' },
        { tag: 'nav', anim: 'animate__fadeInDown' },
        { tag: 'section', anim: 'animate__fadeInUp' },
        { tag: 'main', anim: 'animate__fadeInUp' },
        { tag: 'article', anim: 'animate__fadeInUp' },
      ];
      for (const p of topPatterns) {
        const tagRe = new RegExp(`<${p.tag}\\b[^>]*className="([^"]*)"`, 'g');
        let tm;
        while ((tm = tagRe.exec(content)) !== null) {
          if (tm[1].includes('animate__')) continue;
          content = content.replace(
            tm[0],
            tm[0].replace('className="', `className="animate__animated ${p.anim} `)
          );
          isModified = true;
        }
      }
    }

    // 所有文件：给根 div 容器加 fadeIn（如果还没动画的话）
    if (!isModified && !content.includes('animate__')) {
      // 找第一个有 className 的顶层 JSX 容器（支持跨行）
      const rootMatch = content.match(/return\s*\(\s*[\s\S]*?<div\s+className="([^"]*)"/);
      if (rootMatch && !rootMatch[1].includes('animate__')) {
        content = content.replace(
          /(return\s*\(\s*<div\s+className=")([^"]*)(")/,
          '$1$2 animate__animated animate__fadeIn$3'
        );
        isModified = true;
      }
    }

    if (isModified) {
      writeFileSync(filePath, content);
      animatedFiles++;
    }
  }

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
  const sizeKeys = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']);
  const sizes = { xs: 14, sm: 16, base: 18, lg: 20, xl: 22, '2xl': 26, '3xl': 32, '4xl': 40, '5xl': 48 };
  const classes = className.split(/\s+/);
  for (const cls of classes) {
    if (cls.startsWith('text-')) {
      const key = cls.replace('text-', '');
      if (sizeKeys.has(key)) return sizes[key] || 20;
    }
  }
  return 20;
}

export function handleIconUpgrade(_action, _params, targetPath) {

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  let upgradedFiles = 0;
  let totalIcons = 0;
  const typeCounts = { materialSymbols: 0, materialIcons: 0, inlineSvg: 0 };

  // Regex patterns for different icon styles
  const patterns = [
    // Pattern 1: <span className="material-symbols-outlined ...">icon_name</span>
    {
      regex: /<span\s+className="material-symbols-outlined\s*([^"]*)"\s*>(\w+)<\/span>/g,
      type: 'materialSymbols',
      extract: (m) => ({ extraClasses: m[1] || '', iconName: m[2] }),
    },
    // Pattern 2: <span class="material-icons ...">icon_name</span> or <i class="material-icons ...">icon_name</i>
    {
      regex: /<(span|i)\s+className="material-icons\s*([^"]*)"\s*>(\w+)<\/(?:span|i)>/g,
      type: 'materialIcons',
      extract: (m) => ({ extraClasses: m[2] || '', iconName: m[3] }),
    },
  ];

  for (const filePath of jsxFiles) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }
    let isFileModified = false;
    let fileIcons = 0;

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let lastIndex = 0;

      while ((match = regex.exec(content)) !== null) {
        const { extraClasses, iconName } = pattern.extract(match);
        const lucideName = ICON_MAP[iconName];

        if (lucideName) {
          const size = sizeFromClass(extraClasses);
          const sizeKeys = new Set(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl']);
          const preservedClasses = extraClasses
            .split(/\s+/)
            .filter(c => c && c !== 'material-symbols-outlined' && c !== 'material-icons' && !sizeKeys.has(c))
            .join(' ');
          const classProp = preservedClasses ? ` className="${preservedClasses}"` : '';
          content = content.replace(match[0], `<${lucideName} size={${size}}${classProp} />`);
          fileIcons++;
          isFileModified = true;
          typeCounts[pattern.type]++;
        }
      }
    }

    // Pattern 3: Inline SVG — ensure consistent sizing (add className if bare)
    // Run independently of icon replacement status
    {
      const svgRegex = /<svg\b([^>]*)>/g;
      let svgMatch;
      let svgCount = 0;
      while ((svgMatch = svgRegex.exec(content)) !== null) {
        const attrs = svgMatch[1];
        if (/className=/.test(attrs)) continue;
        content = content.replace(svgMatch[0], svgMatch[0].replace('<svg', '<svg className="w-5 h-5 inline-block"'));
        svgCount++;
        isFileModified = true;
      }
      if (svgCount > 0) typeCounts.inlineSvg += svgCount;
      fileIcons += svgCount;
    }

    if (isFileModified) {
      // 添加 lucide-react import
      const iconsInFile = [];
      for (const lucideName of Object.values(ICON_MAP)) {
        const compRegex = new RegExp(`<${lucideName}\\s`, 'g');
        if (compRegex.test(content)) iconsInFile.push(lucideName);
      }

      if (iconsInFile.length > 0) {
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
    }
  }

  const parts = [];
  if (typeCounts.materialSymbols > 0) parts.push(`${typeCounts.materialSymbols} Material Symbols`);
  if (typeCounts.materialIcons > 0) parts.push(`${typeCounts.materialIcons} Material Icons`);
  if (typeCounts.inlineSvg > 0) parts.push(`${typeCounts.inlineSvg} inline SVG`);
  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  return `图标升级完成: ${upgradedFiles} 文件, ${totalIcons} 图标${detail}`;
}

export function handleMicroInteractions(_action, _params, targetPath) {

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  }).slice(0, 200);

  let modifiedFiles = 0;

  for (const filePath of jsxFiles) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }
    let isFileModified = false;

    // 1. 给带 onClick 的可点击元素加 hover/active 效果
    // Two-pass: find elements with onClick, then check className
    const elRegex = /<(div|button|a|span|li)\b([^>]*?)>/g;
    let match;
    while ((match = elRegex.exec(content)) !== null) {
      const fullTag = match[0];
      const attrs = match[2];
      if (!/onClick=/.test(attrs)) continue;
      const classMatch = attrs.match(/className="([^"]*)"/);
      if (!classMatch) continue;
      const existingClasses = classMatch[1];
      // 跳过已经有效果的
      if (/hover:/.test(existingClasses) && /active:/.test(existingClasses)) continue;

      let extraClasses = '';
      if (!/hover:-translate-y/.test(existingClasses)) extraClasses += ' hover:-translate-y-0.5';
      if (!/hover:shadow/.test(existingClasses)) extraClasses += ' hover:shadow-lg';
      if (!/active:scale/.test(existingClasses)) extraClasses += ' active:scale-[0.98]';
      if (!/transition/.test(existingClasses)) extraClasses += ' transition-all duration-200';

      if (extraClasses) {
        const newTag = fullTag.replace(
          `className="${existingClasses}"`,
          `className="${existingClasses}${extraClasses}"`
        );
        content = content.replace(fullTag, newTag);
        isFileModified = true;
      }
    }

    // 2. 给带 cursor-pointer 的元素加 hover 效果
    const cursorLines = content.match(/className="[^"]*cursor-pointer[^"]*"/g);
    if (cursorLines) {
      for (const cls of cursorLines) {
        if (!cls.includes('hover:') && !cls.includes('transition')) {
          const enhanced = cls.replace(/"$/, ' hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200"');
          content = content.replace(cls, enhanced);
          isFileModified = true;
        }
      }
    }

    if (isFileModified) {
      writeFileSync(filePath, content);
      modifiedFiles++;
    }
  }

  return `微交互注入完成，${modifiedFiles} 个文件`;
}

function runPlaywrightVisual(targetPath, context) {
  try {
    safeExec('npx playwright test --grep visual 2>&1', targetPath, { stdio: 'inherit' });
    if (context) context.visualRegressionPassed = true;
  } catch {
    if (context) context.visualRegressionPassed = false;
  }
}

export function handleVisualRegression(_action, params, targetPath, context) {
  const viewports = params?.viewports || ['desktop'];

  const screenshotsDir = path.join(targetPath, 'screenshots');
  if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

  const packagePath = path.join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    if (context) context.visualRegressionPassed = false;
    return '视觉回归测试完成（无 package.json）';
  }

  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    if (pkg.devDependencies?.playwright || pkg.dependencies?.playwright) {
      // Check that visual tests actually exist before running
      const testDir = path.join(targetPath, 'tests');
      const e2eDir = path.join(targetPath, 'e2e');
      let testFiles = [];
      for (const d of [testDir, e2eDir, targetPath]) {
        if (existsSync(d)) {
          testFiles.push(...scanDir(d, { filter: f => /\.(spec|test)\.(js|ts|jsx|tsx)$/.test(f) && !f.includes('node_modules') }));
        }
      }
      const visualTests = testFiles.filter(f => {
        try { return /visual/i.test(readFileSync(f, 'utf-8')); } catch { return false; }
      });
      if (visualTests.length === 0) {
        if (context) context.visualRegressionPassed = false;
        console.log(chalk.yellow(`  ⚠ 未找到视觉回归测试（${testFiles.length} 个测试文件中无 visual 标签），请添加 Playwright screenshot 测试`));
        return '视觉回归测试完成（无匹配测试文件 — 需要手动添加 visual 测试）';
      }
      runPlaywrightVisual(targetPath, context);
      return `视觉回归测试完成 (${viewports.join(', ')}, ${visualTests.length} 个视觉测试)`;
    }
  } catch { /* unreadable file */ }

  if (context) context.visualRegressionPassed = false;
  return '视觉回归测试完成（需要手动安装 Playwright）';
}

export { handleCheckAPIConsistency } from './api-consistency.js';

export function handleApplyDaisyUI(_action, params, targetPath, context) {
  const theme = context?.selectedTheme || params?.theme || 'light';
  if (theme === 'huashu' || theme === 'huashu-html') {
    return handleApplyHuashuStyle(_action, params, targetPath, context);
  }

  // Install daisyui if package.json exists
  const pkgPath = path.join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      safeExec('npm install daisyui 2>&1 || true', targetPath, { stdio: 'pipe' });
    } catch {
      console.log(chalk.yellow('  ⚠ DaisyUI npm 安装失败（可能已安装）'));
    }
  }

  const reconciledValues = context?.reconciledValues || {};
  const keepColors = reconciledValues.colors || {};
  const keepFonts = reconciledValues.fonts || {};

  const tailwindPath = path.join(targetPath, 'tailwind.config.js');
  if (existsSync(tailwindPath)) {
    let tw = readFileSync(tailwindPath, 'utf-8');
    const originalTw = tw;

    // Add daisyui plugin if not present
    if (!tw.includes('daisyui')) {
      if (tw.includes('plugins:')) {
        tw = tw.replace(/plugins:\s*\[/, "plugins: [\n    require('daisyui'),");
      } else if (tw.includes('module.exports')) {
        tw = tw.replace(/module\.exports\s*=\s*\{/, "module.exports = {\n  plugins: [require('daisyui')],");
      }
    }

    // Add daisyui themes config if not present
    if (!tw.includes('daisyui:')) {
      tw = tw.replace(
        /module\.exports\s*=\s*\{/,
        "module.exports = {\n  daisyui: {\n    themes: ['light', 'dark', 'corporate', 'garden', 'cupcake', 'business'],\n  },"
      );
    }

    // For animal-island, inject custom color tokens (skip if already present or kept by reconcile)
    if (theme === 'animal-island' && !tw.includes('island-primary')) {
      const islandColors = {
        'island-primary': keepColors.primary || '#19c8b9',
        'island-secondary': keepColors.secondary || '#F5F5DC',
        'island-accent': keepColors.accent || '#FF6F61',
        'island-text': keepColors.text || '#5D4E37',
        'island-bg': keepColors.background || '#FAF8F5',
      };
      const colorLines = Object.entries(islandColors)
        .map(([k, v]) => `        '${k}': '${v}',`).join('\n');
      const extBlock = `      colors: {\n${colorLines}\n      },\n      borderRadius: {\n        'island': '24px',\n        'island-sm': '16px',\n      },\n      boxShadow: {\n        'island': '0 4px 20px rgba(93, 78, 55, 0.1)',\n      },`;

      if (tw.includes('extend:')) {
        tw = tw.replace(/extend:\s*\{/, `extend: {\n${extBlock}`);
      } else if (tw.includes('theme:')) {
        tw = tw.replace(/theme:\s*\{/, `theme: {\n    extend: {\n${extBlock}\n    },`);
      }
    } else if (theme !== 'animal-island') {
      console.log(chalk.green('  ✓ tailwind.config.js → daisyui 插件及主题已配置'));
    }

    // Only write if content actually changed
    if (tw !== originalTw) {
      writeFileSync(tailwindPath, tw);
    }
  } else {
    console.log(chalk.yellow('  ⚠ 未找到 tailwind.config.js，跳过 Tailwind 配置'));
  }

  // Inject CSS variables into index.css for animal-island
  if (theme === 'animal-island') {
    const indexCssPath = path.join(targetPath, 'src', 'index.css');
    if (existsSync(indexCssPath)) {
      let css = readFileSync(indexCssPath, 'utf-8');
      if (!css.includes('--island-primary')) {
        const vars = `
/* === Animal Island UI 主题变量 === */
:root {
  --island-primary: ${keepColors.primary || '#19c8b9'};
  --island-secondary: ${keepColors.secondary || '#F5F5DC'};
  --island-accent: ${keepColors.accent || '#FF6F61'};
  --island-text: ${keepColors.text || '#5D4E37'};
  --island-bg: ${keepColors.background || '#FAF8F5'};
  --island-radius: 16px;
  --island-radius-lg: 24px;
  --island-shadow: 0 4px 20px rgba(93, 78, 55, 0.1);
}

body {
  background-color: var(--island-bg);
  color: var(--island-text);
  font-family: ${keepFonts.body || "'Nunito', 'Noto Sans SC', 'Segoe UI', sans-serif"};
}

* {
  border-radius: var(--island-radius);
}
`;
        css = css.replace('@tailwind utilities;', `@tailwind utilities;\n${vars}`);
        writeFileSync(indexCssPath, css);
      }
    }
  }

  return `DaisyUI 主题已应用 (${theme}) — tailwind.config.js 已配置`;
}

export async function handleApplyHuashuStyle(_action, params, targetPath, context) {
  const { listStyles, getStyle, generateCSSVariables } = await import('../lib/huashu/style-library.js');
  const styleId = context?.huashu_style_id || params?.styleId;
  if (!styleId) {
    listStyles('web');
    return 'huashu 风格库已列出（未指定 styleId）';
  }
  const style = getStyle(styleId);
  if (!style) {
    return `huashu 风格未匹配: ${styleId}`;
  }
  if (context) context.huashu_applied_style = style;

  if (!style.cssTokens) {
    return `huashu 风格已选定（无 CSS token）: ${style.name}`;
  }

  // Generate and write CSS token file
  const cssContent = generateCSSVariables(style);
  const stylesDir = path.join(targetPath, 'src', 'styles');
  const cssFile = path.join(stylesDir, `huashu-${styleId}.css`);

  try {
    if (!existsSync(stylesDir)) mkdirSync(stylesDir, { recursive: true });
    writeFileSync(cssFile, cssContent);
  } catch (err) {
    console.error(chalk.red(`  ✗ 写入 CSS 文件失败: ${err.message}`));
    return `huashu 风格应用部分失败: ${style.name}`;
  }

  // Inject @import into src/index.css if it exists
  const indexCssPath = path.join(targetPath, 'src', 'index.css');
  if (existsSync(indexCssPath)) {
    let indexCss = readFileSync(indexCssPath, 'utf-8');
    const importLine = `@import './styles/huashu-${styleId}.css';`;
    if (!indexCss.includes(importLine)) {
      indexCss = `${importLine}\n${indexCss}`;
      writeFileSync(indexCssPath, indexCss);
    }
  }

  // Inject color tokens into tailwind.config.js if it exists
  const tailwindPath = path.join(targetPath, 'tailwind.config.js');
  if (existsSync(tailwindPath)) {
    let tw = readFileSync(tailwindPath, 'utf-8');
    const palette = style.cssTokens.palette || {};
    const colorEntries = Object.entries(palette).map(([k, v]) => `        'hs-${k}': '${v}',`).join('\n');
    const extBlock = `      colors: {\n${colorEntries}\n      },`;
    if (!tw.includes('hs-primary') && tw.includes('extend:')) {
      tw = tw.replace(/extend:\s*\{/, `extend: {\n${extBlock}`);
      writeFileSync(tailwindPath, tw);
    }
  }

  return `huashu 风格已应用: ${style.name} → src/styles/huashu-${styleId}.css`;
}

export function handleApplyComponents(_action, params, targetPath, context) {
  const theme = context?.selectedTheme || params?.theme || 'light';

  // ── Extract brand tokens from od_brand_css ──
  const brandTokens = {};
  const odCss = context?.od_brand_css || '';
  if (odCss) {
    const extract = (name) => {
      const m = odCss.match(new RegExp(`--${name}\\s*:\\s*([^;]+)`));
      return m ? m[1].trim() : null;
    };
    brandTokens.accent = extract('accent');
    brandTokens.bg = extract('bg');
    brandTokens.surface = extract('surface');
    brandTokens.fg = extract('fg');
    brandTokens.muted = extract('muted');
    brandTokens.border = extract('border');
    brandTokens.radius = extract('radius-sm') || extract('radius');
    brandTokens.shadow = extract('elev-raised') || extract('elev');
  }

  // ── Apply brand tokens to index.css ──
  if (Object.values(brandTokens).some(Boolean)) {
    const indexCssPath = path.join(targetPath, 'src', 'index.css');
    if (existsSync(indexCssPath)) {
      let css = readFileSync(indexCssPath, 'utf-8');
      if (!css.includes('--od-accent')) {
        const vars = `
/* === Open Design 品牌 Token === */
:root {
  --od-accent: ${brandTokens.accent || '#6366f1'};
  --od-bg: ${brandTokens.bg || '#ffffff'};
  --od-surface: ${brandTokens.surface || brandTokens.bg || '#f9fafb'};
  --od-fg: ${brandTokens.fg || '#111827'};
  --od-muted: ${brandTokens.muted || '#6b7280'};
  --od-border: ${brandTokens.border || '#e5e7eb'};
  --od-radius: ${brandTokens.radius || '0.5rem'};
  --od-shadow: ${brandTokens.shadow || '0 1px 3px rgba(0,0,0,0.1)'};
}
`;
        css = css.replace(/@tailwind utilities;/, `@tailwind utilities;\n${vars}`);
        writeFileSync(indexCssPath, css);
        console.log(chalk.green('  ✓ 品牌 CSS Token 已注入 src/index.css'));
      }
    } else {
      // No index.css — write standalone tokens file
      const tokensPath = path.join(targetPath, 'src', 'od-tokens.css');
      if (!existsSync(tokensPath)) {
        try { mkdirSync(path.join(targetPath, 'src'), { recursive: true }); } catch { /* dir exists */ }
        writeFileSync(tokensPath, brandCssToTokenBlock(brandTokens));
        console.log(chalk.green('  ✓ 品牌 CSS Token 已写入 src/od-tokens.css'));
      }
    }
  }

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  // ── Card style based on brand tokens ──
  const accent = brandTokens.accent || '#6366f1';
  const cardShadow = brandTokens.shadow || '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)';
  const cardRadius = brandTokens.radius || '0.75rem';
  const cardBorder = brandTokens.border || '#e5e7eb';

  // Theme-specific style presets
  const presets = {
    'animal-island': {
      button: 'rounded-2xl shadow-md hover:shadow-lg active:shadow-sm transition-all duration-300 font-medium',
      input: 'rounded-xl border-2 border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-200 transition-all duration-200',
      select: 'rounded-xl border-2 border-green-200 focus:border-green-400 transition-all duration-200',
      card: 'rounded-2xl shadow-md border border-green-100 bg-white hover:shadow-lg transition-shadow duration-300',
    },
    corporate: {
      button: 'rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-semibold tracking-wide',
      input: 'rounded-lg border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all',
      select: 'rounded-lg border-gray-300 focus:border-blue-500 transition-all',
      card: 'rounded-lg shadow-sm border border-gray-200 bg-white hover:shadow-md transition-shadow duration-200',
    },
    light: {
      button: 'rounded-lg shadow-sm hover:shadow-md transition-all duration-200',
      input: 'rounded-lg border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 transition-all',
      select: 'rounded-lg border-gray-200 focus:border-indigo-400 transition-all',
      card: 'rounded-xl shadow-sm border border-gray-100 bg-white hover:shadow-md transition-shadow duration-200',
    },
    dark: {
      button: 'rounded-lg shadow-sm hover:shadow-md transition-all duration-200',
      input: 'rounded-lg border-gray-600 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 transition-all bg-gray-800 text-gray-100',
      select: 'rounded-lg border-gray-600 focus:border-indigo-400 transition-all bg-gray-800 text-gray-100',
      card: 'rounded-xl shadow-md border border-gray-700 bg-gray-800 hover:shadow-lg transition-shadow duration-200',
    },
    garden: {
      button: 'rounded-xl shadow-sm hover:shadow-md transition-all duration-200',
      input: 'rounded-xl border-2 border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-200 transition-all',
      select: 'rounded-xl border-2 border-green-200 focus:border-green-400 transition-all',
      card: 'rounded-2xl shadow-sm border border-green-100 bg-white hover:shadow-md transition-shadow duration-300',
    },
    cupcake: {
      button: 'rounded-full shadow-sm hover:shadow-md transition-all duration-200 font-medium',
      input: 'rounded-full border-2 border-pink-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all',
      select: 'rounded-full border-2 border-pink-200 focus:border-pink-400 transition-all',
      card: 'rounded-3xl shadow-sm border border-pink-100 bg-white hover:shadow-md transition-shadow duration-300',
    },
    business: {
      button: 'rounded-md shadow-sm hover:shadow-md transition-all duration-150 font-semibold',
      input: 'rounded-md border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all',
      select: 'rounded-md border-gray-300 focus:border-blue-600 transition-all',
      card: 'rounded-md shadow border border-gray-200 bg-white hover:shadow-md transition-shadow duration-150',
    },
  };
  const style = presets[theme] || presets.corporate;

  let enhancedFiles = 0;
  let totalElements = 0;
  let cardCount = 0;

  // Detect card-like div patterns
  const cardClassPatterns = /\b(card|Card|tile|Tile|panel|Panel|module|Module|item-card|list-item|grid-item)\b/;

  for (const filePath of jsxFiles) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }
    let isFileModified = false;

    // ── Enhance <button> elements ──
    const buttonRegex = /<button\b([^>]*?)className="([^"]*)"/g;
    let match;
    while ((match = buttonRegex.exec(content)) !== null) {
      const existingClasses = match[2];
      if (/bg-/.test(existingClasses) && /rounded-/.test(existingClasses)) continue;
      if (existingClasses.includes('btn-') || existingClasses.includes('btn ')) continue;
      const newClasses = existingClasses + (existingClasses ? ' ' : '') + style.button;
      content = content.replace(
        `<button${match[1]}className="${match[2]}"`,
        `<button${match[1]}className="${newClasses}"`
      );
      isFileModified = true;
      totalElements++;
    }

    // ── Enhance <input> elements ──
    const inputRegex = /<input\b([^>]*?)className="([^"]*)"/g;
    while ((match = inputRegex.exec(content)) !== null) {
      const existingClasses = match[2];
      if (/rounded-/.test(existingClasses)) continue;
      const typeMatch = match[0].match(/type\s*=\s*["'](submit|button|hidden|checkbox|radio)["']/);
      if (typeMatch) continue;
      const newClasses = existingClasses + (existingClasses ? ' ' : '') + style.input;
      content = content.replace(
        `<input${match[1]}className="${match[2]}"`,
        `<input${match[1]}className="${newClasses}"`
      );
      isFileModified = true;
      totalElements++;
    }

    // ── Enhance card-like <div>/<article>/<section> ──
    const divRegex = /<(div|article|section)\b([^>]*?)className="([^"]*)"/g;
    while ((match = divRegex.exec(content)) !== null) {
      const tag = match[1];
      const attrs = match[2];
      const existingClasses = match[3];
      // Match common card patterns: class contains card/tile/panel, or has bg-white+border, or has rounded+shadow
      const isCard = cardClassPatterns.test(existingClasses)
        || (/(bg-white|bg-gray-50|bg-slate-50)\b/.test(existingClasses) && /\b(border|shadow|rounded)\b/.test(existingClasses))
        || (/(rounded|shadow)\b/.test(existingClasses) && /\b(bg-|border)\b/.test(existingClasses));
      if (!isCard) continue;
      if (/(hover:shadow|transition-shadow)/.test(existingClasses)) continue; // already enhanced

      const newClasses = existingClasses + ' ' + style.card;
      content = content.replace(
        `<${tag}${attrs}className="${existingClasses}"`,
        `<${tag}${attrs}className="${newClasses}"`
      );
      isFileModified = true;
      totalElements++;
      cardCount++;
    }

    // ── Enhance sections with role="region" or landmark sections ──
    const sectionRegex = /<section\b([^>]*?)className="([^"]*)"/g;
    while ((match = sectionRegex.exec(content)) !== null) {
      const existingClasses = match[2];
      // Only enhance sections that look like content containers
      if (!/(py-|px-|p-\d|space-y-)/.test(existingClasses)) continue;
      if (/transition/.test(existingClasses)) continue;
      const px = brandTokens.border ? 'border-' + colorToTailwind(brandTokens.border) : 'border-gray-100';
      // Add subtle top border separator between sections
      if (!content.includes(match[0] + ' border-t')) {
        const newClasses = existingClasses + ' border-t ' + px;
        content = content.replace(
          `<section${match[1]}className="${existingClasses}"`,
          `<section${match[1]}className="${newClasses}"`
        );
        isFileModified = true;
      }
    }

    if (isFileModified) {
      writeFileSync(filePath, content);
      enhancedFiles++;
    }
  }

  if (cardCount > 0) console.log(chalk.green(`  ✓ ${cardCount} 个卡片已增强（阴影+圆角+hover 效果）`));
  return `组件增强完成: ${enhancedFiles} 文件, ${totalElements} 元素 (${theme}${cardCount ? ', ' + cardCount + ' cards' : ''})`;
}

function brandCssToTokenBlock(tokens) {
  return `/* === Open Design 品牌 Token === */
:root {
  --od-accent: ${tokens.accent || '#6366f1'};
  --od-bg: ${tokens.bg || '#ffffff'};
  --od-surface: ${tokens.surface || tokens.bg || '#f9fafb'};
  --od-fg: ${tokens.fg || '#111827'};
  --od-muted: ${tokens.muted || '#6b7280'};
  --od-border: ${tokens.border || '#e5e7eb'};
  --od-radius: ${tokens.radius || '0.5rem'};
  --od-shadow: ${tokens.shadow || '0 1px 3px rgba(0,0,0,0.1)'};
}
`;
}

function colorToTailwind(hex) {
  // Approximate hex to Tailwind color name
  const map = {
    '#e5e7eb': 'gray-200', '#d1d5db': 'gray-300', '#9ca3af': 'gray-400',
    '#f3f4f6': 'gray-100', '#f9fafb': 'gray-50',
    '#fee2e2': 'red-100', '#fecaca': 'red-200',
    '#dbeafe': 'blue-100', '#bfdbfe': 'blue-200',
    '#dcfce7': 'green-100', '#bbf7d0': 'green-200',
    '#fef3c7': 'amber-100', '#fde68a': 'amber-200',
  };
  return map[hex] || 'gray-200';
}

export function handleWebDesignVerify(_action, _params, targetPath, context) {

  const issues = [];
  const cssFiles = scanDir(targetPath, {
    filter: (f) => f.endsWith('.css') && !f.includes('node_modules'),
  });

  if (!cssFiles.length) {
    issues.push('缺少 CSS 文件');
  }

  // 检查关键设计元素
  for (const cssFile of cssFiles.slice(0, 30)) {
    let content;
    try { content = readFileSync(cssFile, 'utf-8'); } catch { continue; }
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
  }).slice(0, 100);
  let inlineStyleCount = 0;
  for (const f of jsxFiles) {
    let content;
    try { content = readFileSync(f, 'utf-8'); } catch { continue; }
    const matches = content.match(/style=\{\{/g);
    if (matches) inlineStyleCount += matches.length;
  }
  if (inlineStyleCount > 5) {
    issues.push(`${inlineStyleCount} 处内联样式，建议迁移到 Tailwind 类`);
  }

  // Store in context so downstream steps can reference the results
  if (context) {
    context.design_verify_issues = issues;
    context.design_verify_pass = issues.length === 0;
  }

  if (issues.length) {
    for (const i of issues) console.log(chalk.yellow(`  ⚠ ${i}`));
  } else {
    console.log(chalk.green('  ✅ 设计验证通过'));
  }
  return `Web 设计验证完成: ${issues.length ? issues.join('; ') : '无问题'}`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleReconcileDesignTokens(_action, _params, targetPath, context) {
  if (!context) {
    console.log(chalk.yellow('  ⚠ 设计 Token 调和跳过（context 未定义）'));
    return '设计 Token 调和跳过（缺少上下文）';
  }
  const existing = { brand: [], fonts: [], spacing: [], radii: [], shadows: [], motion: [] };

  // Check open-design brand CSS in context (loaded by od-brand-import)
  if (context?.od_brand_css) {
    const odVars = context.od_brand_css.match(/--[\w-]+/g) || [];
    if (odVars.length >= 5) {
      existing.brand.push('open-design:brand (context)');
      if (odVars.some(v => v.includes('font') || v.includes('family'))) existing.fonts.push('open-design:font (context)');
      if (odVars.some(v => v.includes('spacing'))) existing.spacing.push('open-design:spacing (context)');
      if (odVars.some(v => v.includes('radius'))) existing.radii.push('open-design:radius (context)');
      if (odVars.some(v => v.includes('shadow'))) existing.shadows.push('open-design:shadow (context)');
      if (odVars.some(v => v.includes('duration') || v.includes('ease') || v.includes('motion'))) existing.motion.push('open-design:motion (context)');
    }
  }

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

  // Single-pass CSS scan: detect existing tokens + extract values
  const values = { colors: {}, fonts: {}, spacing: {}, radii: {}, shadows: {}, motion: {} };

  for (const cssFile of scanDir(targetPath, { filter: f => f.endsWith('.css') && !f.includes('node_modules') })) {
    try {
      const content = readFileSync(cssFile, 'utf-8');
      if (/--color-/.test(content)) existing.brand.push(cssFile);
      if (/--font-/.test(content)) existing.fonts.push(cssFile);
      if (/--spacing-/.test(content)) existing.spacing.push(cssFile);
      if (/--radius-/.test(content)) existing.radii.push(cssFile);
      if (/--shadow-/.test(content)) existing.shadows.push(cssFile);
      if (/prefers-reduced-motion|--duration-|--ease-/.test(content)) existing.motion.push(cssFile);

      for (const [, name, val] of content.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
        if (name.includes('color') || name.includes('primary') || name.includes('secondary') || name.includes('accent') || name.includes('bg') || name.includes('background') || name.includes('text')) {
          values.colors[name] = val.trim();
        } else if (name.includes('font') || name.includes('family')) {
          values.fonts[name] = val.trim();
        } else if (name.includes('spacing') || name.includes('gap')) {
          values.spacing[name] = val.trim();
        } else if (name.includes('radius')) {
          values.radii[name] = val.trim();
        } else if (name.includes('shadow') || name.includes('elevation')) {
          values.shadows[name] = val.trim();
        } else if (name.includes('duration') || name.includes('ease') || name.includes('motion')) {
          values.motion[name] = val.trim();
        }
      }
    } catch { /* unreadable */ }
  }

  const totalExisting = existing.brand.length + existing.fonts.length + existing.spacing.length + existing.radii.length + existing.shadows.length + existing.motion.length;

  if (context) {
    context.reconciledTokens = existing;
    context.reconciledValues = values;
  }
  return `设计 Token 调和完成: ${totalExisting} 处已有 Token 保留`;
}

export function handleImpeccableCritique(_action, _params, targetPath, context) {
  const checks = _params?.checks || [];

  const issues = { fixed: [], warned: [] };

  // Scan frontend files with upper limit
  const frontendFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx|css|html)$/.test(f) && !f.includes('node_modules'),
  }).slice(0, 200);

  for (const filePath of frontendFiles) {
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    let isModified = false;
    const basename = path.basename(filePath);

    // 规则1: 纯黑文字 → neutral-900
    if (/text-black|#000000|#[0]{3}\b/.test(content)) {
      content = content
        .replace(/text-black/g, 'text-neutral-900')
        .replace(/#000000/gi, '#171717')
        .replace(/#000\b(?!\d)/gi, '#171717');
      isModified = true;
      issues.fixed.push(`${basename}: 纯黑→neutral-900`);
    }

    // 规则2: 纯白背景 → neutral-50
    if (/\bbg-white\b/.test(content)) {
      content = content.replace(/\bbg-white\b/g, 'bg-neutral-50');
      isModified = true;
      issues.fixed.push(`${basename}: bg-white→bg-neutral-50`);
    }

    // 规则3: 紫色/靛蓝渐变（AI塑料感标志）
    if (/purple-\d+|indigo-\d+|violet-\d+/.test(content)) {
      issues.warned.push(`${basename}: 检测到紫色系渐变（AI塑料感），建议替换为品牌色`);
    }

    // 规则4: 缺少过渡的交互元素 → 自动注入 transition
    if (/onClick/.test(content) && !/transition/.test(content)) {
      // Add transition to tailwind className on elements with onClick
      content = content.replace(
        /(<(?:div|button|a|span|li)\b[^>]*?onClick=\{[^}]*\}[^>]*?className=")([^"]*)("[^>]*?>)/g,
        (match, prefix, existingClasses, suffix) => {
          if (/transition/.test(existingClasses)) return match;
          return `${prefix}${existingClasses} transition-colors duration-200${suffix}`;
        }
      );
      isModified = true;
      issues.fixed.push(`${basename}: 交互元素补 transition`);
    }

    // 规则5: 侧边彩色描边 → 自动替换为完整边框
    content = content.replace(
      /\bborder-l-(2|3|4|5|6|7|8|9)\b/g, 'border-l border-l-2'
    ).replace(
      /\bborder-r-(2|3|4|5|6|7|8|9)\b/g, 'border-r border-r-2'
    );
    // Replace thick colored left borders with full bordered-card style
    const thickBorderRegex = /\bborder-l-(?:red|blue|green|purple|pink|indigo|violet|cyan|teal|orange|amber|yellow|lime|emerald|sky|fuchsia|rose)-\d00\b/g;
    if (thickBorderRegex.test(content)) {
      content = content.replace(thickBorderRegex, 'border border-gray-200');
      isModified = true;
      issues.fixed.push(`${basename}: 侧边彩色描边→完整边框`);
    }

    // 规则6: 渐变文字 → 自动替换为纯色+字重
    if ((/bg-clip-text/.test(content) || /background-clip:\s*text/.test(content)) && /bg-gradient-/.test(content)) {
      content = content.replace(
        /\bbg-clip-text\s*/g, ''
      ).replace(
        /\bbackground-clip:\s*text;?\s*/g, ''
      ).replace(
        /\bbg-gradient-to-\w+\b/g, 'bg-current'
      ).replace(
        /\bfrom-\w+-\d+\b/g, ''
      ).replace(
        /\bto-\w+-\d+\b/g, ''
      ).replace(
        /text-transparent/g, 'font-bold'
      );
      isModified = true;
      issues.fixed.push(`${basename}: 渐变文字→纯色+字重`);
    }

    // 规则7: 玻璃态默认使用 — warn only (may be intentional)
    if (/backdrop-blur/.test(content) && /\bbg-white\/\d+|\bbg-opacity-|rgba\(255/.test(content)) {
      issues.warned.push(`${basename}: 检测到玻璃态默认使用，确认是否必要（非必要时建议移除）`);
    }

    // 规则8: 小字大写眼眉 → 自动替换为 text-sm font-medium
    const eyebrowRegex = /className="([^"]*)\btext-xs\b([^"]*)\buppercase\b([^"]*)\btracking-wid(?:er|est)?\b([^"]*)"/g;
    let eyebrowMatch;
    while ((eyebrowMatch = eyebrowRegex.exec(content)) !== null) {
      const newClasses = [eyebrowMatch[1], eyebrowMatch[2], eyebrowMatch[3], eyebrowMatch[4]]
        .join(' ')
        .replace(/\btext-xs\b/, 'text-sm')
        .replace(/\bupper\s?case\b/, '')
        .replace(/\btracking-wid(?:er|est)?\b/, 'font-medium')
        .replace(/\s+/g, ' ')
        .trim();
      content = content.replace(eyebrowMatch[0], `className="${newClasses}"`);
      isModified = true;
      issues.fixed.push(`${basename}: 小字大写眼眉→text-sm font-medium`);
    }

    // 规则9: 编号章节标记 — warn only
    if (/0[1-9]\s*[·•/·]\s*[A-Z]/.test(content)) {
      issues.warned.push(`${basename}: 检测到编号章节标记（AI套路），确认是否真实有序（是则保留）`);
    }

    // 规则10: 硬编码颜色值 → 减少到 CSS 变量引用
    const hardcodedHex = content.match(/#[0-9a-fA-F]{6}/g) || [];
    if (hardcodedHex.length > 8) {
      // Replace repeated identical hex values with od-accent / neutral references
      const hexCounts = {};
      hardcodedHex.forEach(h => { hexCounts[h] = (hexCounts[h] || 0) + 1; });
      const repeatedHex = Object.entries(hexCounts).filter(([, c]) => c >= 3).map(([h]) => h);
      for (const hex of repeatedHex) {
        if (hex.toLowerCase() === '#6366f1' || hex.toLowerCase() === '#4f46e5') {
          content = content.replace(new RegExp(hex, 'gi'), 'var(--od-accent)');
        } else if (/^#(1[0-7]|0[0-7]|0{2})[0-9a-f]{4}$/i.test(hex)) {
          content = content.replace(new RegExp(hex, 'gi'), 'var(--od-fg)');
        }
      }
      if (repeatedHex.length > 0) {
        isModified = true;
        issues.fixed.push(`${basename}: ${repeatedHex.length} 处重复硬编码颜色→CSS变量`);
      } else if (hardcodedHex.length > 12) {
        issues.warned.push(`${basename}: ${hardcodedHex.length} 处硬编码颜色，建议抽取为 CSS 变量`);
      }
    }

    // 规则11: 密集卡片布局检测 — warn only
    if ((content.match(/card|Card/g) || []).length > 6 && /className="[^"]*card[^"]*"/i.test(content)) {
      issues.warned.push(`${basename}: 检测到密集卡片布局，确认是否存在嵌套卡片（AI套路）`);
    }

    // 规则12: 英雄指标模板检测 — warn only
    if (/text-[5-9]xl/.test(content) && /text-xs/.test(content) && /\d{1,3}%|\d{1,3}[KMB]\+/.test(content)) {
      issues.warned.push(`${basename}: 检测到英雄指标模板（AI套路），建议替换为真实数据叙事`);
    }

    if (isModified) {
      writeFileSync(filePath, content);
    }
  }

  if (issues.fixed.length) {
    issues.fixed.forEach((f) => console.log(chalk.green(`  ✓ 已修复: ${f}`)));
  }
  if (issues.warned.length) {
    issues.warned.forEach((w) => console.log(chalk.yellow(`  ⚠ 建议: ${w}`)));
  }

  if (context) {
    context.impeccable_fixed = issues.fixed.length;
    context.impeccable_warned = issues.warned.length;
    context.impeccable_issues = issues;
  }

  return `Impeccable 打磨完成: ${issues.fixed.length} 修复, ${issues.warned.length} 建议`;
}
