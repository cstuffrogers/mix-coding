/**
 * Huashu 40-style HTML-native library: 20 web + 20 deck styles.
 * Each style is HTML/CSS-only (no AI image generation required).
 * Sourced from huashu-design references/design-styles.md.
 */

const WEB_STYLES = [
  { id: 'editorial-brutalism', name: '媒体级粗野主义', temp: 'bold', fidelity: 98, fit: '媒体/AI产品发布/品牌官网', dna: '纯黑+纯白+超链接蓝, Helvetica/Inter 120px+巨号headline, 模块化网格+1px规则线', font: 'Inter + Geist Mono' },
  { id: 'neo-brutalism', name: '新粗野主义撞色信息流', temp: 'bold', fidelity: 95, fit: '媒体/活动landing/社区榜单', dna: '电光紫+品红+亮黄高饱和+纯黑, 几何无衬线大标题+衬线正文, 卡片化feed流+2-4px粗黑描边', font: 'Space Grotesk + Fraunces' },
  { id: 'memphis-maximalism', name: '孟菲斯复古拼贴', temp: 'bold', fidelity: 72, fit: '电商概念店/创意activity/Y2K复古', dna: '复古红/芥末黄/宝蓝撞色, 复古衬线+装饰字, 反网格拼贴策展+错位叠放', font: 'DM Serif Display + Bungee + Space Mono' },
  { id: 'candy-geometric', name: '糖果色凸起立体按钮', temp: 'bold', fidelity: 85, fit: '教育/语言学习/消费级App', dna: 'Duo绿+鸭子黄+天蓝糖果高饱和+白底, 超粗圆体, 大圆角+3D凸起按钮', font: 'Baloo 2 / Nunito' },
  { id: 'pure-css-art', name: '纯CSS几何插画', temp: 'bold', fidelity: 80, fit: '个人主页/创意404/技术博客', dna: '2-4色高对比扁平面, 粗几何无衬线标题, 图随视口变形彩蛋', font: 'Rubik / Archivo' },
  { id: 'bold-big-type', name: '巨型字黑白时装大字报', temp: 'bold', fidelity: 88, fit: '时装/品牌发布/创意作品集', dna: '纯黑白+1点缀色, 衬线巨号+紧字距, 1-2列大字报式排版', font: 'Fraunces / Playfair Display' },

  { id: 'glass-morphism', name: '玻璃质感半透叠层', temp: 'neutral', fidelity: 85, fit: 'SaaS dashboard/创意工具', dna: '渐变背景+磨砂玻璃半透卡片, 中性灰系字体, 多层悬浮叠加', font: 'Inter / Manrope' },
  { id: 'editorial-serif', name: '杂志衬线优雅排版', temp: 'neutral', fidelity: 95, fit: '文章/出版/精品品牌', dna: '米白+深咖+衬线, 大标题+drop cap, 双栏排版+图文交错', font: 'Playfair Display / Fraunces' },
  { id: 'aurora-gradient', name: '极光渐变背景', temp: 'neutral', fidelity: 90, fit: '科技/AI/创业landing', dna: '紫蓝粉极光渐变+暗底, 几何无衬线, 大圆形blur光斑+居中hero', font: 'Inter / Geist' },
  { id: 'modular-grid', name: '瑞士网格系统', temp: 'neutral', fidelity: 96, fit: '设计工作室/作品集/严肃媒体', dna: '黑白灰+1强调色, 极简无衬线, 12列网格严格对齐+留白', font: 'Helvetica/Inter / Söhne' },
  { id: 'dark-tech-grid', name: '暗色科技grid', temp: 'neutral', fidelity: 92, fit: '开发者工具/技术产品/playground', dna: '近黑+霓虹绿/青/紫, 等宽字+无衬线, 网格点阵背景+终端美学', font: 'JetBrains Mono / Geist Mono' },
  { id: 'pastel-card', name: '柔和粉彩卡片', temp: 'neutral', fidelity: 92, fit: '消费App/生活方式/个人产品', dna: '浅粉/淡蓝/薄荷绿低饱和, 圆体+衬线混排, 大圆角卡片+柔和阴影', font: 'Nunito / Manrope' },

  { id: 'minimal-mono', name: '极简单色禁欲', temp: 'quiet', fidelity: 98, fit: '高端品牌/精品工具/作品集', dna: '纯白底+黑灰文字+1强调色, 衬线/无衬线均可, 大留白+左对齐', font: 'Inter / Söhne / Garamond' },
  { id: 'notion-clean', name: 'Notion 文档清流', temp: 'quiet', fidelity: 96, fit: 'docs/帮助中心/SaaS工具', dna: '近白+暗灰文字+少量强调色, 系统无衬线+衬线引文, 文档式宽度限制+左侧目录', font: 'Inter / IBM Plex Sans' },
  { id: 'soft-neumorphism', name: '柔光新拟物', temp: 'quiet', fidelity: 78, fit: '工具App/控制面板/玩具型UI', dna: '同色系浅灰+蓝, 圆体, 双向阴影模拟凹凸+大圆角', font: 'Manrope / Nunito' },
  { id: 'monospace-zine', name: '终端等宽小报', temp: 'quiet', fidelity: 90, fit: '开发者博客/CLI产品/极客社区', dna: '近白+近黑+终端绿, 全等宽字, 60ch行宽+ASCII装饰', font: 'JetBrains Mono / Geist Mono' },
  { id: 'apple-product', name: 'Apple 产品页', temp: 'quiet', fidelity: 92, fit: '硬件/精品消费品/产品发布', dna: '纯白+深灰文字, SF Pro/Inter系, 大产品图+居中分段叙事', font: 'Inter / SF Pro fallback' },
  { id: 'editorial-magazine', name: '高端杂志编辑设计', temp: 'quiet', fidelity: 89, fit: '出版/文化/艺术机构', dna: '米白+暗色+1点缀, 衬线+装饰字, 多栏复杂排版+图说', font: 'Playfair / DM Serif' },

  { id: 'editorial-news', name: '严肃媒体新闻', temp: 'quiet', fidelity: 94, fit: '新闻/调研/深度报道', dna: '白底+衬线正文+无衬线导航, 1红色强调, 3-4列网格+文字密度高', font: 'Source Serif / IBM Plex Serif' },
  { id: 'product-marketing', name: '科技产品营销', temp: 'neutral', fidelity: 92, fit: 'SaaS/Dev tool/AI产品', dna: '白底+暗色文字+品牌色, 几何无衬线, hero+特性卡+social proof+CTA', font: 'Inter / Geist' },
];

const DECK_STYLES = [
  { id: 'editorial-deck', name: '编辑式幻灯片', temp: 'bold', fidelity: 95, fit: '产品发布/调研报告', dna: '纯黑白+1强调, 巨号衬线+紧字距, 1-2 key idea 满版' },
  { id: 'data-dashboard', name: '数据仪表板deck', temp: 'neutral', fidelity: 90, fit: '财报/增长复盘/B轮投递', dna: '近白+冷蓝, 等宽字数字, 4-6 数据卡片+迷你图' },
  { id: 'startup-pitch', name: '硅谷创业 pitch', temp: 'bold', fidelity: 94, fit: '融资/产品演示', dna: '深蓝/紫底+亮黄, 几何无衬线, hero截图+大标题+social proof' },
  { id: 'minimal-keynote', name: '极简 Keynote', temp: 'quiet', fidelity: 98, fit: '主题演讲/分享会', dna: '纯白+深灰+1强调, 大字+居中, 1屏1 idea' },
  { id: 'dark-mode-tech', name: '暗黑技术分享', temp: 'neutral', fidelity: 95, fit: 'DevRel/技术talk', dna: '近黑+霓虹+终端绿, 等宽字, 代码块+架构图为主' },
  { id: 'magazine-spread', name: '杂志跨页式', temp: 'bold', fidelity: 85, fit: '文化品牌/视觉设计', dna: '米白+深咖+点缀, 衬线大标题+drop cap, 图文 50/50 跨页' },
  { id: 'corporate-blue', name: '企业蓝商务', temp: 'quiet', fidelity: 96, fit: '公司汇报/客户提案', dna: '白底+企业蓝+灰文字, 无衬线, 标准 16:9+清晰层级' },
  { id: 'editorial-mono', name: '黑白报纸风deck', temp: 'bold', fidelity: 90, fit: '观点演讲/思想分享', dna: '纯白+纯黑+1红色, 衬线标题+无衬线正文, 报纸排版' },
  { id: 'gradient-glass', name: '渐变玻璃deck', temp: 'neutral', fidelity: 82, fit: '设计/创意工具发布', dna: '渐变背景+玻璃卡片, 现代无衬线, 居中hero+悬浮元素' },
  { id: 'illustration-deck', name: '插画驱动deck', temp: 'bold', fidelity: 70, fit: '教育/友好品牌', dna: '糖果色+大圆角, 圆体, 大插画+少量文字, AI生图兜底' },
  { id: 'data-journalism', name: '数据新闻式', temp: 'neutral', fidelity: 88, fit: '研究报告/数据故事', dna: '米白+冷色, 衬线+无衬线混排, 图表为主+小段叙事' },
  { id: 'modern-minimal', name: '现代极简deck', temp: 'quiet', fidelity: 96, fit: '团队周会/简洁汇报', dna: '近白+黑+1强调, 现代无衬线, 大留白+精简文字' },
  { id: 'tech-architecture', name: '架构图为王deck', temp: 'neutral', fidelity: 92, fit: '系统设计/技术架构', dna: '白+深灰+品牌色, 等宽字, 整页架构图+少量说明' },
  { id: 'launch-cinematic', name: '发布会电影感', temp: 'bold', fidelity: 75, fit: '产品发布/品牌片', dna: '深色+电影感渐变, 大字+电影字幕, 全屏视觉hero' },
  { id: 'editorial-academic', name: '学术演讲风', temp: 'quiet', fidelity: 93, fit: '论文答辩/学术会议', dna: '白+深蓝+灰, 衬线为主, 严谨结构+引用规范' },
  { id: 'product-marketing-deck', name: '产品营销deck', temp: 'neutral', fidelity: 94, fit: '销售/客户演示', dna: '白+品牌色, 无衬线, hero+特性+案例+CTA结构' },
  { id: 'editorial-narrative', name: '叙事散文deck', temp: 'quiet', fidelity: 90, fit: 'TED分享/人生故事', dna: '米白+暗色, 大衬线+居中, 1屏1句话叙事' },
  { id: 'bold-typography-deck', name: '巨字 typography deck', temp: 'bold', fidelity: 95, fit: '创意演讲/设计分享', dna: '黑白+1色, 巨号字+紧字距, 字本身就是视觉' },
  { id: 'corporate-multinational', name: '跨国企业标准', temp: 'quiet', fidelity: 97, fit: '500强/正式汇报', dna: '企业蓝+标准灰, 无衬线, 标准模板+清晰层级+脚注' },
  { id: 'editorial-handmade', name: '手作粗糙deck', temp: 'bold', fidelity: 75, fit: '独立创作/手工品牌', dna: '米色+手绘色, 手写字混排, 不规则边缘+手作质感' },
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
  // eslint-disable-next-line sonarjs/pseudo-random -- non-cryptographic, UI variety selection
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
