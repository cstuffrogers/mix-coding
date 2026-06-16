/**
 * Huashu 40-style HTML-native library: 20 web + 20 deck styles.
 * Each style is HTML/CSS-only (no AI image generation required).
 * Sourced from huashu-design references/design-styles.md.
 *
 * v2: Added cssTokens to every style so handleApplyHuashuStyle can generate real CSS.
 */

const WEB_STYLES = [
  {
    id: 'editorial-brutalism', name: '媒体级粗野主义', temp: 'bold', fidelity: 98,
    fit: '媒体/AI产品发布/品牌官网',
    dna: '纯黑+纯白+超链接蓝, Helvetica/Inter 120px+巨号headline, 模块化网格+1px规则线',
    font: 'Inter + Geist Mono',
    cssTokens: {
      palette: { primary: '#000000', secondary: '#ffffff', accent: '#0000EE', background: '#ffffff', text: '#000000', muted: '#666666', border: '#000000' },
      typography: { family: 'Inter, Helvetica, sans-serif', mono: 'Geist Mono, monospace', headingWeight: '900', bodySize: '1.125rem', lineHeight: '1.5' },
      spacing: { section: '6rem', gap: '2rem', pageWidth: '100%' },
      radius: { default: '0', card: '0', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'neo-brutalism', name: '新粗野主义撞色信息流', temp: 'bold', fidelity: 95,
    fit: '媒体/活动landing/社区榜单',
    dna: '电光紫+品红+亮黄高饱和+纯黑, 几何无衬线大标题+衬线正文, 卡片化feed流+2-4px粗黑描边',
    font: 'Space Grotesk + Fraunces',
    cssTokens: {
      palette: { primary: '#7B2FBE', secondary: '#E8005A', accent: '#FFE600', background: '#FFFBF0', text: '#1A1A1A', muted: '#555555', border: '#1A1A1A' },
      typography: { family: 'Space Grotesk, sans-serif', mono: 'monospace', headingWeight: '800', bodySize: '1.0625rem', lineHeight: '1.6' },
      spacing: { section: '4rem', gap: '1.5rem', pageWidth: '1200px' },
      radius: { default: '0', card: '4px', button: '4px' },
      shadows: { default: '3px 3px 0 #1A1A1A', card: '4px 4px 0 #1A1A1A', button: '2px 2px 0 #1A1A1A' },
    },
  },
  {
    id: 'memphis-maximalism', name: '孟菲斯复古拼贴', temp: 'bold', fidelity: 72,
    fit: '电商概念店/创意activity/Y2K复古',
    dna: '复古红/芥末黄/宝蓝撞色, 复古衬线+装饰字, 反网格拼贴策展+错位叠放',
    font: 'DM Serif Display + Bungee + Space Mono',
    cssTokens: {
      palette: { primary: '#CC2936', secondary: '#F4B41A', accent: '#1E3A8A', background: '#FFF8F0', text: '#2D1B0E', muted: '#8B7355', border: '#CC2936' },
      typography: { family: 'DM Serif Display, serif', mono: 'Space Mono, monospace', headingWeight: '700', bodySize: '1.0625rem', lineHeight: '1.55' },
      spacing: { section: '5rem', gap: '2rem', pageWidth: '1100px' },
      radius: { default: '12px', card: '16px', button: '24px' },
      shadows: { default: '2px 4px 8px rgba(204,41,54,0.15)', card: '4px 6px 12px rgba(0,0,0,0.08)', button: '2px 4px 6px rgba(204,41,54,0.2)' },
    },
  },
  {
    id: 'candy-geometric', name: '糖果色凸起立体按钮', temp: 'bold', fidelity: 85,
    fit: '教育/语言学习/消费级App',
    dna: 'Duo绿+鸭子黄+天蓝糖果高饱和+白底, 超粗圆体, 大圆角+3D凸起按钮',
    font: 'Baloo 2 / Nunito',
    cssTokens: {
      palette: { primary: '#58CC02', secondary: '#FFC800', accent: '#1CB0F6', background: '#FFFFFF', text: '#3C3C3C', muted: '#AFAFAF', border: '#E5E5E5' },
      typography: { family: 'Nunito, Baloo 2, sans-serif', mono: 'monospace', headingWeight: '800', bodySize: '1.0625rem', lineHeight: '1.55' },
      spacing: { section: '3rem', gap: '1.25rem', pageWidth: '960px' },
      radius: { default: '16px', card: '20px', button: '16px' },
      shadows: { default: '0 4px 0 #D1D1D1', card: '0 6px 0 #E0E0E0', button: '0 4px 0 rgba(88,204,2,0.3)' },
    },
  },
  {
    id: 'pure-css-art', name: '纯CSS几何插画', temp: 'bold', fidelity: 80,
    fit: '个人主页/创意404/技术博客',
    dna: '2-4色高对比扁平面, 粗几何无衬线标题, 图随视口变形彩蛋',
    font: 'Rubik / Archivo',
    cssTokens: {
      palette: { primary: '#FF6B35', secondary: '#004E89', accent: '#1A936F', background: '#F8F4E6', text: '#1A1A1A', muted: '#666666', border: '#1A1A1A' },
      typography: { family: 'Rubik, Archivo, sans-serif', mono: 'monospace', headingWeight: '800', bodySize: '1rem', lineHeight: '1.5' },
      spacing: { section: '5rem', gap: '2rem', pageWidth: '1000px' },
      radius: { default: '0', card: '0', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'bold-big-type', name: '巨型字黑白时装大字报', temp: 'bold', fidelity: 88,
    fit: '时装/品牌发布/创意作品集',
    dna: '纯黑白+1点缀色, 衬线巨号+紧字距, 1-2列大字报式排版',
    font: 'Fraunces / Playfair Display',
    cssTokens: {
      palette: { primary: '#000000', secondary: '#FFFFFF', accent: '#D4A853', background: '#FFFFFF', text: '#000000', muted: '#888888', border: '#000000' },
      typography: { family: 'Fraunces, Playfair Display, serif', mono: 'monospace', headingWeight: '900', bodySize: '1.125rem', lineHeight: '1.4' },
      spacing: { section: '8rem', gap: '3rem', pageWidth: '900px' },
      radius: { default: '0', card: '0', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'glass-morphism', name: '玻璃质感半透叠层', temp: 'neutral', fidelity: 85,
    fit: 'SaaS dashboard/创意工具',
    dna: '渐变背景+磨砂玻璃半透卡片, 中性灰系字体, 多层悬浮叠加',
    font: 'Inter / Manrope',
    cssTokens: {
      palette: { primary: '#6366F1', secondary: '#8B5CF6', accent: '#EC4899', background: '#0F0F23', text: '#E2E8F0', muted: '#94A3B8', border: 'rgba(255,255,255,0.12)' },
      typography: { family: 'Inter, Manrope, sans-serif', mono: 'monospace', headingWeight: '600', bodySize: '1rem', lineHeight: '1.6' },
      spacing: { section: '4rem', gap: '1.5rem', pageWidth: '1200px' },
      radius: { default: '16px', card: '20px', button: '12px' },
      shadows: { default: '0 8px 32px rgba(0,0,0,0.12)', card: '0 8px 32px rgba(0,0,0,0.18), backdrop-filter blur(16px)', button: '0 4px 12px rgba(99,102,241,0.3)' },
    },
  },
  {
    id: 'editorial-serif', name: '杂志衬线优雅排版', temp: 'neutral', fidelity: 95,
    fit: '文章/出版/精品品牌',
    dna: '米白+深咖+衬线, 大标题+drop cap, 双栏排版+图文交错',
    font: 'Playfair Display / Fraunces',
    cssTokens: {
      palette: { primary: '#8B4513', secondary: '#D4A574', accent: '#C41E3A', background: '#FDF8F2', text: '#3C2415', muted: '#8B7355', border: '#D4C4B0' },
      typography: { family: 'Playfair Display, Fraunces, serif', mono: 'monospace', headingWeight: '700', bodySize: '1.125rem', lineHeight: '1.7' },
      spacing: { section: '5rem', gap: '2.5rem', pageWidth: '720px' },
      radius: { default: '2px', card: '4px', button: '2px' },
      shadows: { default: 'none', card: '0 2px 8px rgba(139,69,19,0.06)', button: 'none' },
    },
  },
  {
    id: 'aurora-gradient', name: '极光渐变背景', temp: 'neutral', fidelity: 90,
    fit: '科技/AI/创业landing',
    dna: '紫蓝粉极光渐变+暗底, 几何无衬线, 大圆形blur光斑+居中hero',
    font: 'Inter / Geist',
    cssTokens: {
      palette: { primary: '#A78BFA', secondary: '#60A5FA', accent: '#F472B6', background: '#0A0A1A', text: '#E2E8F0', muted: '#94A3B8', border: 'rgba(255,255,255,0.08)' },
      typography: { family: 'Inter, Geist, sans-serif', mono: 'monospace', headingWeight: '700', bodySize: '1.0625rem', lineHeight: '1.6' },
      spacing: { section: '6rem', gap: '2rem', pageWidth: '1100px' },
      radius: { default: '12px', card: '16px', button: '8px' },
      shadows: { default: '0 0 40px rgba(167,139,250,0.15)', card: '0 4px 24px rgba(0,0,0,0.3)', button: '0 0 20px rgba(167,139,250,0.25)' },
    },
  },
  {
    id: 'modular-grid', name: '瑞士网格系统', temp: 'neutral', fidelity: 96,
    fit: '设计工作室/作品集/严肃媒体',
    dna: '黑白灰+1强调色, 极简无衬线, 12列网格严格对齐+留白',
    font: 'Helvetica/Inter / Söhne',
    cssTokens: {
      palette: { primary: '#000000', secondary: '#F5F5F5', accent: '#FF3B30', background: '#FFFFFF', text: '#1A1A1A', muted: '#999999', border: '#E5E5E5' },
      typography: { family: 'Inter, Helvetica, Söhne, sans-serif', mono: 'monospace', headingWeight: '600', bodySize: '1rem', lineHeight: '1.5' },
      spacing: { section: '6rem', gap: '1.5rem', pageWidth: '1200px' },
      radius: { default: '0', card: '0', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'dark-tech-grid', name: '暗色科技grid', temp: 'neutral', fidelity: 92,
    fit: '开发者工具/技术产品/playground',
    dna: '近黑+霓虹绿/青/紫, 等宽字+无衬线, 网格点阵背景+终端美学',
    font: 'JetBrains Mono / Geist Mono',
    cssTokens: {
      palette: { primary: '#00FF41', secondary: '#00D4FF', accent: '#BF5AF2', background: '#0D1117', text: '#C9D1D9', muted: '#8B949E', border: '#30363D' },
      typography: { family: 'Geist Mono, JetBrains Mono, monospace', mono: 'JetBrains Mono, monospace', headingWeight: '600', bodySize: '0.9375rem', lineHeight: '1.6' },
      spacing: { section: '4rem', gap: '1.5rem', pageWidth: '1100px' },
      radius: { default: '6px', card: '8px', button: '6px' },
      shadows: { default: '0 0 0 1px #30363D', card: '0 0 0 1px #30363D, 0 4px 12px rgba(0,0,0,0.4)', button: '0 0 0 1px #30363D' },
    },
  },
  {
    id: 'pastel-card', name: '柔和粉彩卡片', temp: 'neutral', fidelity: 92,
    fit: '消费App/生活方式/个人产品',
    dna: '浅粉/淡蓝/薄荷绿低饱和, 圆体+衬线混排, 大圆角卡片+柔和阴影',
    font: 'Nunito / Manrope',
    cssTokens: {
      palette: { primary: '#F4A4B4', secondary: '#A4D8F0', accent: '#B8E0D2', background: '#FFFAFB', text: '#4A3F45', muted: '#B0A3A8', border: '#F0E0E5' },
      typography: { family: 'Nunito, Manrope, sans-serif', mono: 'monospace', headingWeight: '700', bodySize: '1.0625rem', lineHeight: '1.6' },
      spacing: { section: '3.5rem', gap: '1.5rem', pageWidth: '1000px' },
      radius: { default: '16px', card: '24px', button: '16px' },
      shadows: { default: '0 4px 16px rgba(180,160,170,0.1)', card: '0 8px 24px rgba(180,160,170,0.12)', button: '0 4px 12px rgba(180,160,170,0.15)' },
    },
  },
  {
    id: 'minimal-mono', name: '极简单色禁欲', temp: 'quiet', fidelity: 98,
    fit: '高端品牌/精品工具/作品集',
    dna: '纯白底+黑灰文字+1强调色, 衬线/无衬线均可, 大留白+左对齐',
    font: 'Inter / Söhne / Garamond',
    cssTokens: {
      palette: { primary: '#1A1A1A', secondary: '#F5F5F5', accent: '#D4A853', background: '#FFFFFF', text: '#1A1A1A', muted: '#999999', border: '#EBEBEB' },
      typography: { family: 'Inter, Söhne, Garamond, sans-serif', mono: 'monospace', headingWeight: '500', bodySize: '1rem', lineHeight: '1.6' },
      spacing: { section: '8rem', gap: '3rem', pageWidth: '800px' },
      radius: { default: '0', card: '0', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'notion-clean', name: 'Notion 文档清流', temp: 'quiet', fidelity: 96,
    fit: 'docs/帮助中心/SaaS工具',
    dna: '近白+暗灰文字+少量强调色, 系统无衬线+衬线引文, 文档式宽度限制+左侧目录',
    font: 'Inter / IBM Plex Sans',
    cssTokens: {
      palette: { primary: '#37352F', secondary: '#F7F6F3', accent: '#2383E2', background: '#FFFFFF', text: '#37352F', muted: '#9B9A97', border: '#E9E9E7' },
      typography: { family: 'Inter, IBM Plex Sans, sans-serif', mono: 'monospace', headingWeight: '600', bodySize: '1rem', lineHeight: '1.625' },
      spacing: { section: '3rem', gap: '1rem', pageWidth: '708px' },
      radius: { default: '3px', card: '4px', button: '3px' },
      shadows: { default: 'none', card: '0 1px 3px rgba(0,0,0,0.06)', button: 'none' },
    },
  },
  {
    id: 'soft-neumorphism', name: '柔光新拟物', temp: 'quiet', fidelity: 78,
    fit: '工具App/控制面板/玩具型UI',
    dna: '同色系浅灰+蓝, 圆体, 双向阴影模拟凹凸+大圆角',
    font: 'Manrope / Nunito',
    cssTokens: {
      palette: { primary: '#6C8EBF', secondary: '#E8ECF1', accent: '#6C8EBF', background: '#E8ECF1', text: '#2D3748', muted: '#8899AA', border: '#D1D9E4' },
      typography: { family: 'Manrope, Nunito, sans-serif', mono: 'monospace', headingWeight: '600', bodySize: '1rem', lineHeight: '1.55' },
      spacing: { section: '3rem', gap: '1.5rem', pageWidth: '900px' },
      radius: { default: '16px', card: '24px', button: '16px' },
      shadows: { default: '6px 6px 12px #D1D9E4, -6px -6px 12px #FFFFFF', card: '8px 8px 16px #D1D9E4, -8px -8px 16px #FFFFFF', button: '4px 4px 8px #D1D9E4, -2px -2px 6px #FFFFFF' },
    },
  },
  {
    id: 'monospace-zine', name: '终端等宽小报', temp: 'quiet', fidelity: 90,
    fit: '开发者博客/CLI产品/极客社区',
    dna: '近白+近黑+终端绿, 全等宽字, 60ch行宽+ASCII装饰',
    font: 'JetBrains Mono / Geist Mono',
    cssTokens: {
      palette: { primary: '#00CC33', secondary: '#F0F0EA', accent: '#FF6600', background: '#FAFAF8', text: '#222222', muted: '#777777', border: '#DDDDD5' },
      typography: { family: 'JetBrains Mono, Geist Mono, monospace', mono: 'JetBrains Mono, monospace', headingWeight: '700', bodySize: '0.9375rem', lineHeight: '1.65' },
      spacing: { section: '4rem', gap: '2rem', pageWidth: '660px' },
      radius: { default: '0', card: '0', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'apple-product', name: 'Apple 产品页', temp: 'quiet', fidelity: 92,
    fit: '硬件/精品消费品/产品发布',
    dna: '纯白+深灰文字, SF Pro/Inter系, 大产品图+居中分段叙事',
    font: 'Inter / SF Pro fallback',
    cssTokens: {
      palette: { primary: '#0071E3', secondary: '#F5F5F7', accent: '#0071E3', background: '#FFFFFF', text: '#1D1D1F', muted: '#86868B', border: '#D2D2D7' },
      typography: { family: 'Inter, SF Pro, -apple-system, sans-serif', mono: 'monospace', headingWeight: '600', bodySize: '1.0625rem', lineHeight: '1.5' },
      spacing: { section: '8rem', gap: '3rem', pageWidth: '980px' },
      radius: { default: '12px', card: '18px', button: '24px' },
      shadows: { default: 'none', card: '0 4px 16px rgba(0,0,0,0.06)', button: 'none' },
    },
  },
  {
    id: 'editorial-magazine', name: '高端杂志编辑设计', temp: 'quiet', fidelity: 89,
    fit: '出版/文化/艺术机构',
    dna: '米白+暗色+1点缀, 衬线+装饰字, 多栏复杂排版+图说',
    font: 'Playfair / DM Serif',
    cssTokens: {
      palette: { primary: '#2D1B0E', secondary: '#F5EDE0', accent: '#C9A96E', background: '#FBF7F0', text: '#2D1B0E', muted: '#8B7355', border: '#E0D5C5' },
      typography: { family: 'Playfair Display, DM Serif Display, serif', mono: 'monospace', headingWeight: '700', bodySize: '1.0625rem', lineHeight: '1.7' },
      spacing: { section: '6rem', gap: '2.5rem', pageWidth: '1100px' },
      radius: { default: '0', card: '2px', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'editorial-news', name: '严肃媒体新闻', temp: 'quiet', fidelity: 94,
    fit: '新闻/调研/深度报道',
    dna: '白底+衬线正文+无衬线导航, 1红色强调, 3-4列网格+文字密度高',
    font: 'Source Serif / IBM Plex Serif',
    cssTokens: {
      palette: { primary: '#1A1A1A', secondary: '#FFFFFF', accent: '#CC0000', background: '#FFFFFF', text: '#1A1A1A', muted: '#666666', border: '#D8D8D8' },
      typography: { family: 'Source Serif, IBM Plex Serif, serif', mono: 'monospace', headingWeight: '700', bodySize: '1.0625rem', lineHeight: '1.6' },
      spacing: { section: '3rem', gap: '1rem', pageWidth: '1200px' },
      radius: { default: '0', card: '0', button: '0' },
      shadows: { default: 'none', card: 'none', button: 'none' },
    },
  },
  {
    id: 'product-marketing', name: '科技产品营销', temp: 'neutral', fidelity: 92,
    fit: 'SaaS/Dev tool/AI产品',
    dna: '白底+暗色文字+品牌色, 几何无衬线, hero+特性卡+social proof+CTA',
    font: 'Inter / Geist',
    cssTokens: {
      palette: { primary: '#6366F1', secondary: '#F8FAFC', accent: '#F59E0B', background: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: '#E2E8F0' },
      typography: { family: 'Inter, Geist, sans-serif', mono: 'monospace', headingWeight: '700', bodySize: '1.0625rem', lineHeight: '1.55' },
      spacing: { section: '5rem', gap: '2rem', pageWidth: '1140px' },
      radius: { default: '8px', card: '12px', button: '8px' },
      shadows: { default: '0 1px 3px rgba(0,0,0,0.06)', card: '0 4px 16px rgba(0,0,0,0.06)', button: '0 2px 8px rgba(99,102,241,0.2)' },
    },
  },
];

const DECK_STYLES = [
  { id: 'editorial-deck', name: '编辑式幻灯片', temp: 'bold', fidelity: 95, fit: '产品发布/调研报告', dna: '纯黑白+1强调, 巨号衬线+紧字距, 1-2 key idea 满版', font: 'Fraunces',
    cssTokens: { palette: { primary: '#000', secondary: '#FFF', accent: '#D4A853', background: '#FFF', text: '#000' }, typography: { family: 'Fraunces, serif', headingWeight: '900' } } },
  { id: 'data-dashboard', name: '数据仪表板deck', temp: 'neutral', fidelity: 90, fit: '财报/增长复盘/B轮投递', dna: '近白+冷蓝, 等宽字数字, 4-6 数据卡片+迷你图', font: 'Inter',
    cssTokens: { palette: { primary: '#2563EB', secondary: '#F0F4FF', accent: '#3B82F6', background: '#F8FAFC', text: '#1E293B' }, typography: { family: 'Inter, sans-serif', headingWeight: '600' } } },
  { id: 'startup-pitch', name: '硅谷创业 pitch', temp: 'bold', fidelity: 94, fit: '融资/产品演示', dna: '深蓝/紫底+亮黄, 几何无衬线, hero截图+大标题+social proof', font: 'Inter',
    cssTokens: { palette: { primary: '#FFD700', secondary: '#1E1B4B', accent: '#FFD700', background: '#1E1B4B', text: '#E2E8F0' }, typography: { family: 'Inter, sans-serif', headingWeight: '700' } } },
  { id: 'minimal-keynote', name: '极简 Keynote', temp: 'quiet', fidelity: 98, fit: '主题演讲/分享会', dna: '纯白+深灰+1强调, 大字+居中, 1屏1 idea', font: 'Inter',
    cssTokens: { palette: { primary: '#1A1A1A', secondary: '#FFF', accent: '#007AFF', background: '#FFF', text: '#1A1A1A' }, typography: { family: 'Inter, sans-serif', headingWeight: '600' } } },
  { id: 'dark-mode-tech', name: '暗黑技术分享', temp: 'neutral', fidelity: 95, fit: 'DevRel/技术talk', dna: '近黑+霓虹+终端绿, 等宽字, 代码块+架构图为主', font: 'JetBrains Mono',
    cssTokens: { palette: { primary: '#00FF41', secondary: '#0D1117', accent: '#00D4FF', background: '#0D1117', text: '#C9D1D9' }, typography: { family: 'JetBrains Mono, monospace', headingWeight: '600' } } },
  { id: 'magazine-spread', name: '杂志跨页式', temp: 'bold', fidelity: 85, fit: '文化品牌/视觉设计', dna: '米白+深咖+点缀, 衬线大标题+drop cap, 图文 50/50 跨页', font: 'Playfair Display',
    cssTokens: { palette: { primary: '#3C2415', secondary: '#FDF8F2', accent: '#C41E3A', background: '#FDF8F2', text: '#3C2415' }, typography: { family: 'Playfair Display, serif', headingWeight: '700' } } },
  { id: 'corporate-blue', name: '企业蓝商务', temp: 'quiet', fidelity: 96, fit: '公司汇报/客户提案', dna: '白底+企业蓝+灰文字, 无衬线, 标准 16:9+清晰层级', font: 'Inter',
    cssTokens: { palette: { primary: '#1E40AF', secondary: '#EFF6FF', accent: '#2563EB', background: '#FFF', text: '#1E293B' }, typography: { family: 'Inter, sans-serif', headingWeight: '600' } } },
  { id: 'editorial-mono', name: '黑白报纸风deck', temp: 'bold', fidelity: 90, fit: '观点演讲/思想分享', dna: '纯白+纯黑+1红色, 衬线标题+无衬线正文, 报纸排版', font: 'Playfair + Inter',
    cssTokens: { palette: { primary: '#000', secondary: '#FFF', accent: '#CC0000', background: '#FFF', text: '#000' }, typography: { family: 'Playfair Display, serif', headingWeight: '700' } } },
  { id: 'gradient-glass', name: '渐变玻璃deck', temp: 'neutral', fidelity: 82, fit: '设计/创意工具发布', dna: '渐变背景+玻璃卡片, 现代无衬线, 居中hero+悬浮元素', font: 'Inter',
    cssTokens: { palette: { primary: '#A78BFA', secondary: '#0F0F23', accent: '#F472B6', background: '#0F0F23', text: '#E2E8F0' }, typography: { family: 'Inter, sans-serif', headingWeight: '700' } } },
  { id: 'illustration-deck', name: '插画驱动deck', temp: 'bold', fidelity: 70, fit: '教育/友好品牌', dna: '糖果色+大圆角, 圆体, 大插画+少量文字, AI生图兜底', font: 'Nunito',
    cssTokens: { palette: { primary: '#58CC02', secondary: '#FFC800', accent: '#1CB0F6', background: '#FFF', text: '#3C3C3C' }, typography: { family: 'Nunito, sans-serif', headingWeight: '800' } } },
  { id: 'data-journalism', name: '数据新闻式', temp: 'neutral', fidelity: 88, fit: '研究报告/数据故事', dna: '米白+冷色, 衬线+无衬线混排, 图表为主+小段叙事', font: 'Source Serif + Inter',
    cssTokens: { palette: { primary: '#1E3A5F', secondary: '#F5F0EB', accent: '#E07A5F', background: '#F5F0EB', text: '#2D1B0E' }, typography: { family: 'Source Serif, serif', headingWeight: '600' } } },
  { id: 'modern-minimal', name: '现代极简deck', temp: 'quiet', fidelity: 96, fit: '团队周会/简洁汇报', dna: '近白+黑+1强调, 现代无衬线, 大留白+精简文字', font: 'Inter',
    cssTokens: { palette: { primary: '#1A1A1A', secondary: '#F8F8F8', accent: '#007AFF', background: '#FFF', text: '#1A1A1A' }, typography: { family: 'Inter, sans-serif', headingWeight: '500' } } },
  { id: 'tech-architecture', name: '架构图为王deck', temp: 'neutral', fidelity: 92, fit: '系统设计/技术架构', dna: '白+深灰+品牌色, 等宽字, 整页架构图+少量说明', font: 'JetBrains Mono',
    cssTokens: { palette: { primary: '#2563EB', secondary: '#F1F5F9', accent: '#3B82F6', background: '#FFF', text: '#0F172A' }, typography: { family: 'JetBrains Mono, monospace', headingWeight: '600' } } },
  { id: 'launch-cinematic', name: '发布会电影感', temp: 'bold', fidelity: 75, fit: '产品发布/品牌片', dna: '深色+电影感渐变, 大字+电影字幕, 全屏视觉hero', font: 'Inter',
    cssTokens: { palette: { primary: '#FFFFFF', secondary: '#0A0A0A', accent: '#D4A853', background: '#0A0A0A', text: '#E5E5E5' }, typography: { family: 'Inter, sans-serif', headingWeight: '900' } } },
  { id: 'editorial-academic', name: '学术演讲风', temp: 'quiet', fidelity: 93, fit: '论文答辩/学术会议', dna: '白+深蓝+灰, 衬线为主, 严谨结构+引用规范', font: 'Times New Roman',
    cssTokens: { palette: { primary: '#0F2B46', secondary: '#F8FAFC', accent: '#2563EB', background: '#FFF', text: '#0F2B46' }, typography: { family: 'Times New Roman, serif', headingWeight: '700' } } },
  { id: 'product-marketing-deck', name: '产品营销deck', temp: 'neutral', fidelity: 94, fit: '销售/客户演示', dna: '白+品牌色, 无衬线, hero+特性+案例+CTA结构', font: 'Inter',
    cssTokens: { palette: { primary: '#6366F1', secondary: '#F8FAFC', accent: '#F59E0B', background: '#FFF', text: '#0F172A' }, typography: { family: 'Inter, sans-serif', headingWeight: '700' } } },
  { id: 'editorial-narrative', name: '叙事散文deck', temp: 'quiet', fidelity: 90, fit: 'TED分享/人生故事', dna: '米白+暗色, 大衬线+居中, 1屏1句话叙事', font: 'Playfair Display',
    cssTokens: { palette: { primary: '#2D1B0E', secondary: '#FBF7F0', accent: '#C9A96E', background: '#FBF7F0', text: '#2D1B0E' }, typography: { family: 'Playfair Display, serif', headingWeight: '700' } } },
  { id: 'bold-typography-deck', name: '巨字 typography deck', temp: 'bold', fidelity: 95, fit: '创意演讲/设计分享', dna: '黑白+1色, 巨号字+紧字距, 字本身就是视觉', font: 'Inter',
    cssTokens: { palette: { primary: '#000', secondary: '#FFF', accent: '#FF3B30', background: '#FFF', text: '#000' }, typography: { family: 'Inter, sans-serif', headingWeight: '900' } } },
  { id: 'corporate-multinational', name: '跨国企业标准', temp: 'quiet', fidelity: 97, fit: '500强/正式汇报', dna: '企业蓝+标准灰, 无衬线, 标准模板+清晰层级+脚注', font: 'Inter',
    cssTokens: { palette: { primary: '#003366', secondary: '#F0F4F8', accent: '#0066CC', background: '#FFF', text: '#1E293B' }, typography: { family: 'Inter, sans-serif', headingWeight: '600' } } },
  { id: 'editorial-handmade', name: '手作粗糙deck', temp: 'bold', fidelity: 75, fit: '独立创作/手工品牌', dna: '米色+手绘色, 手写字混排, 不规则边缘+手作质感', font: 'Caveat',
    cssTokens: { palette: { primary: '#8B4513', secondary: '#FFF8DC', accent: '#FF6347', background: '#FFF8DC', text: '#3C2415' }, typography: { family: 'Caveat, cursive', headingWeight: '700' } } },
];

export const ALL_STYLES = [...WEB_STYLES, ...DECK_STYLES];

export function listStyles(category = 'all') {
  if (category === 'web') return WEB_STYLES;
  if (category === 'deck') return DECK_STYLES;
  return ALL_STYLES;
}

export function getStyle(id) {
  return ALL_STYLES.find(s => s.id === id);
}

export function pickByTemperature(category, temp) {
  return listStyles(category).filter(s => s.temp === temp);
}

/**
 * Roulette pick: force bold direction injection (huashu's anti-default-minimalism mechanism).
 * Returns one bold style + one neutral + one quiet for 3-direction proposal.
 */
export function rouletteThreeDirections(category = 'web') {
  const pool = listStyles(category);
  const bold = pool.filter(s => s.temp === 'bold');
  const neutral = pool.filter(s => s.temp === 'neutral');
  const quiet = pool.filter(s => s.temp === 'quiet');
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return {
    A_stable: pick(quiet),
    B_balanced: pick(neutral),
    C_bold: pick(bold),
  };
}

export function styleSummary(style) {
  return `${style.name} [${style.temp}·还原${style.fidelity}%]\n  适配: ${style.fit}\n  DNA: ${style.dna}`;
}

export function generateCSSVariables(style, prefix = 'hs') {
  const t = style.cssTokens;
  if (!t) return '';

  const palette = t.palette || {};
  const typo = t.typography || {};
  const spacing = t.spacing || {};
  const radius = t.radius || {};
  const shadows = t.shadows || {};

  const lines = [
    '/* === Huashu Design Tokens === */',
    `/* Style: ${style.name} [${style.temp}] */`,
    `/* DNA: ${style.dna} */`,
    '',
    ':root {',
  ];

  // Palette
  for (const [key, val] of Object.entries(palette)) {
    lines.push(`  --${prefix}-${key}: ${val};`);
  }

  // Typography
  if (typo.family) lines.push(`  --${prefix}-font-family: ${typo.family};`);
  if (typo.mono) lines.push(`  --${prefix}-font-mono: ${typo.mono};`);
  if (typo.headingWeight) lines.push(`  --${prefix}-heading-weight: ${typo.headingWeight};`);
  if (typo.bodySize) lines.push(`  --${prefix}-body-size: ${typo.bodySize};`);
  if (typo.lineHeight) lines.push(`  --${prefix}-line-height: ${typo.lineHeight};`);

  // Spacing
  if (spacing.section) lines.push(`  --${prefix}-section-spacing: ${spacing.section};`);
  if (spacing.gap) lines.push(`  --${prefix}-element-gap: ${spacing.gap};`);
  if (spacing.pageWidth) lines.push(`  --${prefix}-page-width: ${spacing.pageWidth};`);

  // Radius
  if (radius.default) lines.push(`  --${prefix}-radius: ${radius.default};`);
  if (radius.card) lines.push(`  --${prefix}-radius-card: ${radius.card};`);
  if (radius.button) lines.push(`  --${prefix}-radius-button: ${radius.button};`);

  // Shadows
  if (shadows.default) lines.push(`  --${prefix}-shadow: ${shadows.default};`);
  if (shadows.card) lines.push(`  --${prefix}-shadow-card: ${shadows.card};`);
  if (shadows.button) lines.push(`  --${prefix}-shadow-button: ${shadows.button};`);

  lines.push('}', '');

  return lines.join('\n');
}
