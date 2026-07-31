import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

export function countCssVariables(cssFiles) {
  let cssVarCount = 0;
  let hardcodedColorCount = 0;
  for (const f of cssFiles.slice(0, 50)) {
    try {
      const content = readFileSync(f, 'utf-8');
      cssVarCount += (content.match(/--[\w-]+/g) || []).length;
      hardcodedColorCount += (content.match(/#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(/g) || []).length;
    } catch { /* skip */ }
  }
  return { cssVarCount, hardcodedColorCount };
}

export function countTailwindClasses(componentFiles) {
  let tailwindClasses = 0;
  for (const f of componentFiles.slice(0, 100)) {
    try {
      const content = readFileSync(f, 'utf-8');
      tailwindClasses += (content.match(/className="[^"]*"/g) || []).filter(c => /\b(flex|grid|p-\d|m-\d|text-|bg-|rounded|shadow|w-\d|h-\d)\b/.test(c)).length;
    } catch { /* skip */ }
  }
  return tailwindClasses;
}

export function detectFramework(targetPath) {
  const pkgJsonPath = path.join(targetPath, 'package.json');
  if (!existsSync(pkgJsonPath)) return 'unknown';
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.react) return deps.next ? 'Next.js' : 'React';
    if (deps.vue) return deps.nuxt ? 'Nuxt' : 'Vue';
    if (deps.svelte) return 'Svelte';
    if (deps['@angular/core']) return 'Angular';
  } catch { /* skip */ }
  return 'unknown';
}

export function handleAnalyzeUI(_action, _params, targetPath, context) {
  const cssFiles = scanDir(targetPath, { filter: (f) => /\.css$|\.scss$|\.less$/.test(f) && !f.includes('node_modules') });
  const componentFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx|vue|svelte)$/.test(f) && !f.includes('node_modules') });

  const { cssVarCount, hardcodedColorCount } = countCssVariables(cssFiles);
  const tailwindClasses = countTailwindClasses(componentFiles);
  const framework = detectFramework(targetPath);

  if (context) {
    context.ui_analysis = { framework, cssFiles: cssFiles.length, componentFiles: componentFiles.length, cssVarCount, hardcodedColorCount, tailwindClasses };
  }

  return `UI 分析完成: ${framework}, ${cssFiles.length + componentFiles.length} 个前端文件`;
}

export function handleCheckConsistency(_action, _params, targetPath, context) {
  const cssFiles = scanDir(targetPath, { filter: (f) => /\.css$|\.scss$|\.less$/.test(f) }).slice(0, 100);
  const componentFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx|vue)$/.test(f) }).slice(0, 200);

  let totalHardcodedColors = 0;
  let totalInlineStyles = 0;

  cssFiles.forEach(cssFile => {
    try {
      const content = readFileSync(cssFile, 'utf-8');
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

function ensureAnimateCssImport(targetPath) {
  const indexCssPath = path.join(targetPath, 'src', 'index.css');
  if (existsSync(indexCssPath)) {
    let indexCss = readFileSync(indexCssPath, 'utf-8');
    if (!indexCss.includes('animate.css')) {
      indexCss = `@import "animate.css";\n${indexCss}`;
      writeFileSync(indexCssPath, indexCss);
    }
  }

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
}

const SCREEN_DIRS = ['screens', 'pages', 'views', 'components'];

function animateScreenElements(content) {
  let isModified = false;
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
  return { content, isModified };
}

function animateRootContainer(content) {
  const rootMatch = content.match(/return\s*\([\s\S]*?<div\s+className="([^"]*)"/);
  if (!rootMatch || rootMatch[1].includes('animate__')) return { content, isModified: false };
  const newContent = content.replace(
    /(return\s*\(\s*<div\s+className=")([^"]*)(")/,
    '$1$2 animate__animated animate__fadeIn$3'
  );
  return { content: newContent, isModified: true };
}

export function handleAddAnimations(_action, _params, targetPath) {
  ensureAnimateCssImport(targetPath);

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  let animatedFiles = 0;

  for (const filePath of jsxFiles) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }
    if (content.includes('animate__animated')) continue;

    const isScreen = SCREEN_DIRS.some((d) => filePath.replace(/\\/g, '/').includes(`/${d}/`));
    let isModified = false;

    if (isScreen) {
      const result = animateScreenElements(content);
      content = result.content;
      isModified = result.isModified;
    }

    if (!isModified && !content.includes('animate__')) {
      const result = animateRootContainer(content);
      content = result.content;
      isModified = result.isModified;
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

const ICON_SIZE_KEYS = new Set(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl']);

function replaceIconMatch(content, match, pattern, typeCounts) {
  const { extraClasses, iconName } = pattern.extract(match);
  const lucideName = ICON_MAP[iconName];
  if (!lucideName) return { content, replaced: false };

  const size = sizeFromClass(extraClasses);
  const preservedClasses = extraClasses
    .split(/\s+/)
    .filter(c => c && c !== 'material-symbols-outlined' && c !== 'material-icons' && !ICON_SIZE_KEYS.has(c))
    .join(' ');
  const classProp = preservedClasses ? ` className="${preservedClasses}"` : '';
  const newContent = content.replace(match[0], `<${lucideName} size={${size}}${classProp} />`);
  typeCounts[pattern.type]++;
  return { content: newContent, replaced: true };
}

function processInlineSvgTags(content, typeCounts) {
  let svgCount = 0;
  let isModified = false;
  const svgRegex = /<svg\b([^>]*)>/g;
  let svgMatch;
  while ((svgMatch = svgRegex.exec(content)) !== null) {
    const attrs = svgMatch[1];
    if (/className=/.test(attrs)) continue;
    content = content.replace(svgMatch[0], svgMatch[0].replace('<svg', '<svg className="w-5 h-5 inline-block"'));
    svgCount++;
    isModified = true;
  }
  if (svgCount > 0) typeCounts.inlineSvg += svgCount;
  return { content, svgCount, isModified };
}

function ensureLucideImport(content) {
  if (content.includes("from 'lucide-react'")) return content;
  const iconsInFile = [];
  for (const lucideName of Object.values(ICON_MAP)) {
    const compRegex = new RegExp(`<${lucideName}\\s`, 'g');
    if (compRegex.test(content)) iconsInFile.push(lucideName);
  }
  if (iconsInFile.length === 0) return content;
  const importMatches = content.match(/^import\s+\S.*$/gm);
  if (!importMatches) return content;
  const lastImport = importMatches[importMatches.length - 1];
  const lucideImport = `import { ${[...new Set(iconsInFile)].join(', ')} } from 'lucide-react';`;
  return content.replace(lastImport, `${lastImport}\n${lucideImport}`);
}

const ICON_PATTERNS = [
  {
    regex: /<span\s+className="material-symbols-outlined[ \t]*([^"]{0,200})"[ \t]*>(\w+)<\/span>/g,
    type: 'materialSymbols',
    extract: (m) => ({ extraClasses: m[1] || '', iconName: m[2] }),
  },
  {
    regex: /<(span|i)\s+className="material-icons[ \t]*([^"]{0,200})"[ \t]*>(\w+)<\/(?:span|i)>/g,
    type: 'materialIcons',
    extract: (m) => ({ extraClasses: m[2] || '', iconName: m[3] }),
  },
];

function processIconFile(filePath, typeCounts) {
  let content;
  try { content = readFileSync(filePath, 'utf-8'); } catch { return null; }
  let isFileModified = false;
  let fileIcons = 0;

  for (const pattern of ICON_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(content)) !== null) {
      const result = replaceIconMatch(content, match, pattern, typeCounts);
      if (result.replaced) {
        content = result.content;
        fileIcons++;
        isFileModified = true;
      }
    }
  }

  const svgResult = processInlineSvgTags(content, typeCounts);
  if (svgResult.isModified) {
    content = svgResult.content;
    fileIcons += svgResult.svgCount;
    isFileModified = true;
  }

  if (!isFileModified) return null;

  content = ensureLucideImport(content);
  writeFileSync(filePath, content);
  return { content, fileIcons };
}

function buildIconSummary(upgradedFiles, totalIcons, typeCounts) {
  const parts = [];
  if (typeCounts.materialSymbols > 0) parts.push(`${typeCounts.materialSymbols} Material Symbols`);
  if (typeCounts.materialIcons > 0) parts.push(`${typeCounts.materialIcons} Material Icons`);
  if (typeCounts.inlineSvg > 0) parts.push(`${typeCounts.inlineSvg} inline SVG`);
  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  return `图标升级完成: ${upgradedFiles} 文件, ${totalIcons} 图标${detail}`;
}

export function handleIconUpgrade(_action, _params, targetPath) {
  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  let upgradedFiles = 0;
  let totalIcons = 0;
  const typeCounts = { materialSymbols: 0, materialIcons: 0, inlineSvg: 0 };

  for (const filePath of jsxFiles) {
    const result = processIconFile(filePath, typeCounts);
    if (result) {
      upgradedFiles++;
      totalIcons += result.fileIcons;
    }
  }

  return buildIconSummary(upgradedFiles, totalIcons, typeCounts);
}

function processClickableElement(content, match) {
  const fullTag = match[0];
  const attrs = match[2];
  if (!/onClick=/.test(attrs)) return { content, isModified: false };
  const classMatch = attrs.match(/className="([^"]*)"/);
  if (!classMatch) return { content, isModified: false };
  const existingClasses = classMatch[1];
  if (/hover:/.test(existingClasses) && /active:/.test(existingClasses)) return { content, isModified: false };

  let extraClasses = '';
  if (!/hover:-translate-y/.test(existingClasses)) extraClasses += ' hover:-translate-y-0.5';
  if (!/hover:shadow/.test(existingClasses)) extraClasses += ' hover:shadow-lg';
  if (!/active:scale/.test(existingClasses)) extraClasses += ' active:scale-[0.98]';
  if (!/transition/.test(existingClasses)) extraClasses += ' transition-all duration-200';

  if (!extraClasses) return { content, isModified: false };
  const newTag = fullTag.replace(
    `className="${existingClasses}"`,
    `className="${existingClasses}${extraClasses}"`
  );
  return { content: content.replace(fullTag, newTag), isModified: true };
}

function addClickInteractionClasses(content) {
  let isModified = false;
  const elRegex = /<(div|button|a|span|li)\b([^>]*?)>/g;
  let match;
  while ((match = elRegex.exec(content)) !== null) {
    const result = processClickableElement(content, match);
    if (result.isModified) {
      content = result.content;
      isModified = true;
    }
  }
  return { content, isModified };
}

function addCursorPointerClasses(content) {
  let isModified = false;
  const cursorLines = content.match(/className="[^"]*cursor-pointer[^"]*"/g);
  if (cursorLines) {
    for (const cls of cursorLines) {
      if (!cls.includes('hover:') && !cls.includes('transition')) {
        const enhanced = cls.replace(/"$/, ' hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200"');
        content = content.replace(cls, enhanced);
        isModified = true;
      }
    }
  }
  return { content, isModified };
}

export function handleMicroInteractions(_action, _params, targetPath) {
  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  }).slice(0, 200);

  let modifiedFiles = 0;

  for (const filePath of jsxFiles) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }

    const clickResult = addClickInteractionClasses(content);
    content = clickResult.content;
    let isFileModified = clickResult.isModified;

    const cursorResult = addCursorPointerClasses(content);
    if (cursorResult.isModified) {
      content = cursorResult.content;
      isFileModified = true;
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

function findVisualTestFiles(targetPath) {
  const testDir = path.join(targetPath, 'tests');
  const e2eDir = path.join(targetPath, 'e2e');
  let testFiles = [];
  for (const d of [testDir, e2eDir, targetPath]) {
    if (existsSync(d)) {
      testFiles.push(...scanDir(d, { filter: f => /\.(spec|test)\.(js|ts|jsx|tsx)$/.test(f) && !f.includes('node_modules') }));
    }
  }
  return testFiles.filter(f => {
    try { return /visual/i.test(readFileSync(f, 'utf-8')); } catch { return false; }
  });
}

function hasPlaywright(pkg) {
  return !!(pkg.devDependencies?.playwright || pkg.dependencies?.playwright);
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
    if (!hasPlaywright(pkg)) throw new Error('no playwright');

    const visualTests = findVisualTestFiles(targetPath);
    if (visualTests.length === 0) {
      if (context) context.visualRegressionPassed = false;
      return '视觉回归测试完成（无匹配测试文件 — 需要手动添加 visual 测试）';
    }
    runPlaywrightVisual(targetPath, context);
    return `视觉回归测试完成 (${viewports.join(', ')}, ${visualTests.length} 个视觉测试)`;
  } catch { /* unreadable file or no playwright */ }

  if (context) context.visualRegressionPassed = false;
  return '视觉回归测试完成（需要手动安装 Playwright）';
}

export { handleCheckAPIConsistency } from './api-consistency.js';

function installDaisyIfNeeded(targetPath) {
  const pkgPath = path.join(targetPath, 'package.json');
  if (!existsSync(pkgPath)) return;
  try {
    safeExec('npm install daisyui 2>&1 || true', targetPath, { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow('  ⚠ DaisyUI npm 安装失败（可能已安装）'));
  }
}

function addDaisyuiPlugin(tw) {
  if (tw.includes('daisyui')) return tw;
  if (tw.includes('plugins:')) {
    return tw.replace(/plugins:\s*\[/, "plugins: [\n    require('daisyui'),");
  }
  if (tw.includes('module.exports')) {
    return tw.replace(/module\.exports\s*=\s*\{/, "module.exports = {\n  plugins: [require('daisyui')],");
  }
  return tw;
}

function addDaisyuiThemes(tw) {
  if (tw.includes('daisyui:')) return tw;
  return tw.replace(
    /module\.exports\s*=\s*\{/,
    "module.exports = {\n  daisyui: {\n    themes: ['light', 'dark', 'corporate', 'garden', 'cupcake', 'business'],\n  },"
  );
}

function applyIslandTailwindConfig(tw, keepColors) {
  if (tw.includes('island-primary')) return tw;
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
    return tw.replace(/extend:\s*\{/, `extend: {\n${extBlock}`);
  }
  if (tw.includes('theme:')) {
    return tw.replace(/theme:\s*\{/, `theme: {\n    extend: {\n${extBlock}\n    },`);
  }
  return tw;
}

function injectIslandCss(targetPath, keepColors, keepFonts) {
  const indexCssPath = path.join(targetPath, 'src', 'index.css');
  if (!existsSync(indexCssPath)) return;
  let css = readFileSync(indexCssPath, 'utf-8');
  if (css.includes('--island-primary')) return;
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

export function handleApplyDaisyUI(_action, params, targetPath, context) {
  const theme = context?.selectedTheme || params?.theme || 'light';
  const isHuashu = theme === 'huashu' || theme === 'huashu-html';
  if (isHuashu) {
    return handleApplyHuashuStyle(_action, params, targetPath, context);
  }

  installDaisyIfNeeded(targetPath);

  const reconciledValues = context?.reconciledValues || {};
  const keepColors = reconciledValues.colors || {};
  const keepFonts = reconciledValues.fonts || {};

  const tailwindPath = path.join(targetPath, 'tailwind.config.js');
  if (existsSync(tailwindPath)) {
    let tw = readFileSync(tailwindPath, 'utf-8');
    const originalTw = tw;

    tw = addDaisyuiPlugin(tw);
    tw = addDaisyuiThemes(tw);

    const isAnimalIsland = theme === 'animal-island';
    if (isAnimalIsland) {
      tw = applyIslandTailwindConfig(tw, keepColors);
    } else {
      console.log(chalk.green('  ✓ tailwind.config.js → daisyui 插件及主题已配置'));
    }

    if (tw !== originalTw) {
      writeFileSync(tailwindPath, tw);
    }
  } else {
    console.log(chalk.yellow('  ⚠ 未找到 tailwind.config.js，跳过 Tailwind 配置'));
  }

  if (theme === 'animal-island') {
    injectIslandCss(targetPath, keepColors, keepFonts);
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

const CARD_CLASS_PATTERNS = /\b(card|Card|tile|Tile|panel|Panel|module|Module|item-card|list-item|grid-item)\b/;

const COMPONENT_PRESETS = {
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

function extractBrandTokens(odCss) {
  const brandTokens = {};
  if (!odCss) return brandTokens;
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
  return brandTokens;
}

function injectBrandTokensCss(brandTokens, targetPath) {
  if (!Object.values(brandTokens).some(Boolean)) return;
  const indexCssPath = path.join(targetPath, 'src', 'index.css');
  if (existsSync(indexCssPath)) {
    let css = readFileSync(indexCssPath, 'utf-8');
    if (css.includes('--od-accent')) return;
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
    return;
  }
  const tokensPath = path.join(targetPath, 'src', 'od-tokens.css');
  if (!existsSync(tokensPath)) {
    try { mkdirSync(path.join(targetPath, 'src'), { recursive: true }); } catch { /* dir exists */ }
    writeFileSync(tokensPath, brandCssToTokenBlock(brandTokens));
  }
}

function enhanceButtons(content, style) {
  let isModified = false;
  let count = 0;
  const buttonRegex = /<button\b([^>]*?)className="([^"]*)"/g;
  let match;
  while ((match = buttonRegex.exec(content)) !== null) {
    const existingClasses = match[2];
    const hasBg = /bg-/.test(existingClasses);
    const hasRounded = /rounded-/.test(existingClasses);
    if (hasBg && hasRounded) continue;
    if (existingClasses.includes('btn-') || existingClasses.includes('btn ')) continue;
    const newClasses = existingClasses + (existingClasses ? ' ' : '') + style.button;
    content = content.replace(
      `<button${match[1]}className="${match[2]}"`,
      `<button${match[1]}className="${newClasses}"`
    );
    isModified = true;
    count++;
  }
  return { content, isModified, count };
}

function enhanceInputs(content, style) {
  let isModified = false;
  let count = 0;
  const inputRegex = /<input\b([^>]*?)className="([^"]*)"/g;
  let match;
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
    isModified = true;
    count++;
  }
  return { content, isModified, count };
}

function enhanceCards(content, style) {
  let isModified = false;
  let count = 0;
  const divRegex = /<(div|article|section)\b([^>]*?)className="([^"]*)"/g;
  let match;
  while ((match = divRegex.exec(content)) !== null) {
    const tag = match[1];
    const attrs = match[2];
    const existingClasses = match[3];
    const isCard = CARD_CLASS_PATTERNS.test(existingClasses)
      || (/(bg-white|bg-gray-50|bg-slate-50)\b/.test(existingClasses) && /\b(border|shadow|rounded)\b/.test(existingClasses))
      || (/(rounded|shadow)\b/.test(existingClasses) && /\b(bg-|border)\b/.test(existingClasses));
    if (!isCard) continue;
    if (/(hover:shadow|transition-shadow)/.test(existingClasses)) continue;
    const newClasses = existingClasses + ' ' + style.card;
    content = content.replace(
      `<${tag}${attrs}className="${existingClasses}"`,
      `<${tag}${attrs}className="${newClasses}"`
    );
    isModified = true;
    count++;
  }
  return { content, isModified, count };
}

function enhanceSections(content, brandTokens) {
  let isModified = false;
  const sectionRegex = /<section\b([^>]*?)className="([^"]*)"/g;
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    const existingClasses = match[2];
    if (!/(py-|px-|p-\d|space-y-)/.test(existingClasses)) continue;
    if (/transition/.test(existingClasses)) continue;
    const px = brandTokens.border ? 'border-' + colorToTailwind(brandTokens.border) : 'border-gray-100';
    if (!content.includes(match[0] + ' border-t')) {
      const newClasses = existingClasses + ' border-t ' + px;
      content = content.replace(
        `<section${match[1]}className="${existingClasses}"`,
        `<section${match[1]}className="${newClasses}"`
      );
      isModified = true;
    }
  }
  return { content, isModified };
}

export function handleApplyComponents(_action, params, targetPath, context) {
  const theme = context?.selectedTheme || params?.theme || 'light';

  const brandTokens = extractBrandTokens(context?.od_brand_css || '');
  injectBrandTokensCss(brandTokens, targetPath);

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  });

  const style = COMPONENT_PRESETS[theme] || COMPONENT_PRESETS.corporate;

  let enhancedFiles = 0;
  let totalElements = 0;
  let cardCount = 0;

  for (const filePath of jsxFiles) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }
    let isFileModified = false;

    const btnResult = enhanceButtons(content, style);
    if (btnResult.isModified) {
      content = btnResult.content;
      isFileModified = true;
      totalElements += btnResult.count;
    }

    const inputResult = enhanceInputs(content, style);
    if (inputResult.isModified) {
      content = inputResult.content;
      isFileModified = true;
      totalElements += inputResult.count;
    }

    const cardResult = enhanceCards(content, style);
    if (cardResult.isModified) {
      content = cardResult.content;
      isFileModified = true;
      totalElements += cardResult.count;
      cardCount += cardResult.count;
    }

    const sectionResult = enhanceSections(content, brandTokens);
    if (sectionResult.isModified) {
      content = sectionResult.content;
      isFileModified = true;
    }

    if (isFileModified) {
      writeFileSync(filePath, content);
      enhancedFiles++;
    }
  }

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

function checkCssIssues(cssFiles) {
  const issues = [];
  for (const cssFile of cssFiles.slice(0, 30)) {
    let content;
    try { content = readFileSync(cssFile, 'utf-8'); } catch { continue; }
    const hasCssVars = /--[\w-]+/.test(content);
    if (!hasCssVars) {
      issues.push(`${path.basename(cssFile)}: 未使用 CSS 变量（建议用设计 Token）`);
    }
    const hasHardcoded = /#[0-9a-fA-F]{3,6}/g.test(content);
    if (hasHardcoded && !hasCssVars) {
      issues.push(`${path.basename(cssFile)}: 硬编码颜色较多，建议提取为 CSS 变量`);
    }
  }
  return issues;
}

function countInlineStyles(jsxFiles) {
  let count = 0;
  for (const f of jsxFiles) {
    let content;
    try { content = readFileSync(f, 'utf-8'); } catch { continue; }
    const matches = content.match(/style=\{\{/g);
    if (matches) count += matches.length;
  }
  return count;
}

export function handleWebDesignVerify(_action, _params, targetPath, context) {
  const issues = [];
  const cssFiles = scanDir(targetPath, {
    filter: (f) => f.endsWith('.css') && !f.includes('node_modules'),
  });

  if (!cssFiles.length) {
    issues.push('缺少 CSS 文件');
  }

  issues.push(...checkCssIssues(cssFiles));

  const jsxFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx)$/.test(f) && !f.includes('node_modules'),
  }).slice(0, 100);
  const inlineStyleCount = countInlineStyles(jsxFiles);
  if (inlineStyleCount > 5) {
    issues.push(`${inlineStyleCount} 处内联样式，建议迁移到 Tailwind 类`);
  }

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

// Collect open-design brand tokens carried in context (loaded by od-brand-import).
// Treats the CSS var list as authoritative only when it has enough vars to be meaningful.
function collectOdBrandTokens(context, existing) {
  if (!context?.od_brand_css) return;
  const odVars = context.od_brand_css.match(/--[\w-]+/g) || [];
  if (odVars.length < 5) return;
  existing.brand.push('open-design:brand (context)');
  if (odVars.some(v => v.includes('font') || v.includes('family'))) existing.fonts.push('open-design:font (context)');
  if (odVars.some(v => v.includes('spacing'))) existing.spacing.push('open-design:spacing (context)');
  if (odVars.some(v => v.includes('radius'))) existing.radii.push('open-design:radius (context)');
  if (odVars.some(v => v.includes('shadow'))) existing.shadows.push('open-design:shadow (context)');
  if (odVars.some(v => v.includes('duration') || v.includes('ease') || v.includes('motion'))) existing.motion.push('open-design:motion (context)');
}

// Detect which token categories a piece of file content references, by regex per category.
function pushCategoryMatches(content, fileRef, existing) {
  if (/palette|color|#[0-9a-f]{3,8}|oklch|hsl|rgb/i.test(content)) existing.brand.push(fileRef);
  if (/typography|font|typeface/i.test(content)) existing.fonts.push(fileRef);
  if (/spacing/i.test(content)) existing.spacing.push(fileRef);
  if (/radius|border-radius/i.test(content)) existing.radii.push(fileRef);
  if (/shadow|elevation/i.test(content)) existing.shadows.push(fileRef);
  if (/motion|duration|easing|animation/i.test(content)) existing.motion.push(fileRef);
}

// Scan .claude/designs/ (open-design Skill output) — treat as authoritative existing tokens.
function collectDesignsDirTokens(targetPath, existing) {
  for (const p of [path.join(targetPath, '.claude', 'designs', 'design-baseline.md'), path.join(targetPath, '.claude', 'designs', 'design-system.md')]) {
    if (!existsSync(p)) continue;
    try {
      pushCategoryMatches(readFileSync(p, 'utf-8'), p, existing);
    } catch { /* unreadable */ }
  }
}

// Scan root DESIGN.md for brand/font/spacing mentions (lighter-weight subset).
function collectDesignMdTokens(targetPath, existing) {
  const designMdPath = path.join(targetPath, 'DESIGN.md');
  if (!existsSync(designMdPath)) return;
  try {
    const content = readFileSync(designMdPath, 'utf-8');
    if (content.includes('brand')) existing.brand.push('DESIGN.md');
    if (content.includes('font') || content.includes('typography')) existing.fonts.push('DESIGN.md');
    if (content.includes('spacing')) existing.spacing.push('DESIGN.md');
  } catch { /* unreadable */ }
}

// Scan the first present tailwind config; its theme keys declare existing token groups.
function collectTailwindConfigTokens(targetPath, existing) {
  for (const cfg of ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs']) {
    const cfgPath = path.join(targetPath, cfg);
    if (!existsSync(cfgPath)) continue;
    try {
      const content = readFileSync(cfgPath, 'utf-8');
      if (/colors\s*:\s*\{/.test(content)) existing.brand.push(cfg);
      if (/fontFamily\s*:\s*\{/.test(content)) existing.fonts.push(cfg);
      if (/borderRadius\s*:\s*\{/.test(content)) existing.radii.push(cfg);
      if (/boxShadow\s*:\s*\{/.test(content)) existing.shadows.push(cfg);
    } catch { /* unreadable */ }
    break; // only the first present config is authoritative
  }
}

// Route a single CSS custom property name/value into the matching value bucket by keyword.
function classifyCssVarValue(name, val, values) {
  const isColor = name.includes('color') || name.includes('primary') || name.includes('secondary') || name.includes('accent') || name.includes('bg') || name.includes('background') || name.includes('text');
  if (isColor) values.colors[name] = val;
  else if (name.includes('font') || name.includes('family')) values.fonts[name] = val;
  else if (name.includes('spacing') || name.includes('gap')) values.spacing[name] = val;
  else if (name.includes('radius')) values.radii[name] = val;
  else if (name.includes('shadow') || name.includes('elevation')) values.shadows[name] = val;
  else if (name.includes('duration') || name.includes('ease') || name.includes('motion')) values.motion[name] = val;
}

// Record which token-source markers a CSS file declares (one push per matched marker).
function pushCssTokenSources(content, cssFile, existing) {
  if (/--color-/.test(content)) existing.brand.push(cssFile);
  if (/--font-/.test(content)) existing.fonts.push(cssFile);
  if (/--spacing-/.test(content)) existing.spacing.push(cssFile);
  if (/--radius-/.test(content)) existing.radii.push(cssFile);
  if (/--shadow-/.test(content)) existing.shadows.push(cssFile);
  if (/prefers-reduced-motion|--duration-|--ease-/.test(content)) existing.motion.push(cssFile);
}

// Single-pass CSS scan: record which files declare existing tokens, then extract their values.
function collectCssFileTokens(targetPath, existing, values) {
  for (const cssFile of scanDir(targetPath, { filter: f => f.endsWith('.css') && !f.includes('node_modules') })) {
    try {
      const content = readFileSync(cssFile, 'utf-8');
      pushCssTokenSources(content, cssFile, existing);

      // eslint-disable-next-line sonarjs/super-linear-regex
      for (const [, name, val] of content.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
        classifyCssVarValue(name, val.trim(), values);
      }
    } catch { /* unreadable */ }
  }
}

export function handleReconcileDesignTokens(_action, _params, targetPath, context) {
  if (!context) {
    return '设计 Token 调和跳过（缺少上下文）';
  }
  const existing = { brand: [], fonts: [], spacing: [], radii: [], shadows: [], motion: [] };
  const values = { colors: {}, fonts: {}, spacing: {}, radii: {}, shadows: {}, motion: {} };

  collectOdBrandTokens(context, existing);
  collectDesignsDirTokens(targetPath, existing);
  collectDesignMdTokens(targetPath, existing);
  collectTailwindConfigTokens(targetPath, existing);
  collectCssFileTokens(targetPath, existing, values);

  const totalExisting = existing.brand.length + existing.fonts.length + existing.spacing.length
    + existing.radii.length + existing.shadows.length + existing.motion.length;

  context.reconciledTokens = existing;
  context.reconciledValues = values;
  return `设计 Token 调和完成: ${totalExisting} 处已有 Token 保留`;
}

function fixColorSoftening(content, basename, issues) {
  let isModified = false;
  const hasBlackText = /text-black|#000000|#0{3}\b/.test(content);
  if (hasBlackText) {
    content = content
      .replace(/text-black/g, 'text-neutral-900')
      .replace(/#000000/gi, '#171717')
      .replace(/#000\b(?!\d)/gi, '#171717');
    isModified = true;
    issues.fixed.push(`${basename}: 纯黑→neutral-900`);
  }
  const hasWhiteBg = /\bbg-white\b/.test(content);
  if (hasWhiteBg) {
    content = content.replace(/\bbg-white\b/g, 'bg-neutral-50');
    isModified = true;
    issues.fixed.push(`${basename}: bg-white→bg-neutral-50`);
  }
  return { content, isModified };
}

function checkAiPatterns(content, basename, issues) {
  if (/purple-\d+|indigo-\d+|violet-\d+/.test(content)) {
    issues.warned.push(`${basename}: 检测到紫色系渐变（AI塑料感），建议替换为品牌色`);
  }
  if (/backdrop-blur/.test(content) && /\bbg-white\/\d+|\bbg-opacity-|rgba\(255/.test(content)) {
    issues.warned.push(`${basename}: 检测到玻璃态默认使用，确认是否必要（非必要时建议移除）`);
  }
  if (/0[1-9]\s*[·•/]\s*[A-Z]/.test(content)) {
    issues.warned.push(`${basename}: 检测到编号章节标记（AI套路），确认是否真实有序（是则保留）`);
  }
  const cardMatches = content.match(/card|Card/g) || [];
  const hasDenseCards = cardMatches.length > 6 && /className="[^"]*card[^"]*"/i.test(content);
  if (hasDenseCards) {
    issues.warned.push(`${basename}: 检测到密集卡片布局，确认是否存在嵌套卡片（AI套路）`);
  }
  const hasHeroMetrics = /text-[5-9]xl/.test(content) && /text-xs/.test(content) && /\d{1,3}%|\d{1,3}[KMB]\+/.test(content);
  if (hasHeroMetrics) {
    issues.warned.push(`${basename}: 检测到英雄指标模板（AI套路），建议替换为真实数据叙事`);
  }
}

function addTransitionToInteractions(content, basename, issues) {
  const hasOnClick = /onClick/.test(content);
  const hasTransition = /transition/.test(content);
  if (!hasOnClick || hasTransition) return { content, isModified: false };
  const newContent = content.replace(
    /(<(?:div|button|a|span|li)\b[^>]*?onClick=\{[^}]*\}[^>]*?className=")([^"]*)("[^>]*?>)/g,
    (match, prefix, existingClasses, suffix) => {
      if (/transition/.test(existingClasses)) return match;
      return `${prefix}${existingClasses} transition-colors duration-200${suffix}`;
    }
  );
  issues.fixed.push(`${basename}: 交互元素补 transition`);
  return { content: newContent, isModified: true };
}

const THICK_BORDER_COLORS = 'red|blue|green|purple|pink|indigo|violet|cyan|teal|orange|amber|yellow|lime|emerald|sky|fuchsia|rose';
const THICK_BORDER_RE = new RegExp(`\\bborder-l-(?:${THICK_BORDER_COLORS})-\\d00\\b`, 'g');

function fixBordersAndGradients(content, basename, issues) {
  let isModified = false;
  const original = content;
  content = content.replace(/\bborder-l-[2-9]\b/g, 'border-l border-l-2');
  content = content.replace(/\bborder-r-[2-9]\b/g, 'border-r border-r-2');
  if (content !== original) isModified = true;

  if (THICK_BORDER_RE.test(content)) {
    content = content.replace(THICK_BORDER_RE, 'border border-gray-200');
    isModified = true;
    issues.fixed.push(`${basename}: 侧边彩色描边→完整边框`);
  }

  const hasGradientText = (/bg-clip-text/.test(content) || /background-clip:\s*text/.test(content)) && /bg-gradient-/.test(content);
  if (hasGradientText) {
    content = content.replace(/\bbg-clip-text\s*/g, '')
      .replace(/\bbackground-clip:\s*text;?\s*/g, '')
      .replace(/\bbg-gradient-to-\w+\b/g, 'bg-current')
      .replace(/\bfrom-\w+-\d+\b/g, '')
      .replace(/\bto-\w+-\d+\b/g, '')
      .replace(/text-transparent/g, 'font-bold');
    isModified = true;
    issues.fixed.push(`${basename}: 渐变文字→纯色+字重`);
  }

  return { content, isModified };
}

function fixEyebrowClasses(content, basename, issues) {
  let isModified = false;
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
  return { content, isModified };
}

function fixHardcodedHexColors(content, basename, issues) {
  let isModified = false;
  const hardcodedHex = content.match(/#[0-9a-fA-F]{6}/g) || [];
  if (hardcodedHex.length <= 8) return { content, isModified };
  const hexCounts = {};
  hardcodedHex.forEach(h => { hexCounts[h] = (hexCounts[h] || 0) + 1; });
  const repeatedHex = Object.entries(hexCounts).filter(([, c]) => c >= 3).map(([h]) => h);
  for (const hex of repeatedHex) {
    const isAccent = hex.toLowerCase() === '#6366f1' || hex.toLowerCase() === '#4f46e5';
    if (isAccent) {
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
  return { content, isModified };
}

function processImpeccableFile(filePath, issues) {
  let content;
  try { content = readFileSync(filePath, 'utf-8'); } catch { return; }
  const basename = path.basename(filePath);

  const colorResult = fixColorSoftening(content, basename, issues);
  if (colorResult.isModified) content = colorResult.content;

  checkAiPatterns(content, basename, issues);

  const transitionResult = addTransitionToInteractions(content, basename, issues);
  if (transitionResult.isModified) content = transitionResult.content;

  const borderResult = fixBordersAndGradients(content, basename, issues);
  if (borderResult.isModified) content = borderResult.content;

  const eyebrowResult = fixEyebrowClasses(content, basename, issues);
  if (eyebrowResult.isModified) content = eyebrowResult.content;

  const hexResult = fixHardcodedHexColors(content, basename, issues);
  if (hexResult.isModified) content = hexResult.content;

  const isModified = colorResult.isModified || transitionResult.isModified || borderResult.isModified || eyebrowResult.isModified || hexResult.isModified;
  if (isModified) writeFileSync(filePath, content);
}

export function handleImpeccableCritique(_action, _params, targetPath, context) {
  const issues = { fixed: [], warned: [] };

  const frontendFiles = scanDir(targetPath, {
    filter: (f) => /\.(jsx|tsx|css|html)$/.test(f) && !f.includes('node_modules'),
  }).slice(0, 200);

  for (const filePath of frontendFiles) {
    processImpeccableFile(filePath, issues);
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
