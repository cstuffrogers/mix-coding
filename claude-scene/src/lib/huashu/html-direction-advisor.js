/**
 * Huashu 3-direction advisor: proposes 3 design directions in parallel
 * using complementary logics (seconds-roulette / real-world reference / top-designer).
 * Adapted from huashu-design SKILL.md Phase 3-5.
 */
import chalk from 'chalk';
import { rouletteThreeDirections, styleSummary } from './style-library.js';

const TOP_DESIGNERS = [
  { name: 'Kenya Hara (Muji)', philosophy: '白·空·禅', signature: '极致留白, 减法美学, 中性色调' },
  { name: 'Massimo Vignelli', philosophy: '瑞士网格', signature: 'Helvetica, 严格网格, 红黑白3色限制' },
  { name: 'Stefan Sagmeister', philosophy: '叛逆装置', signature: '手作质感, 反规则排版, 强情绪表达' },
  { name: 'Jonathan Ive (Apple)', philosophy: '产品至上', signature: '大留白, 居中hero, 产品本身即设计' },
  { name: 'Paula Scher (Pentagram)', philosophy: '字体即海报', signature: '巨号字, 字体叙事, 印刷品质感' },
  { name: 'Dieter Rams (Braun)', philosophy: '少, 但更好', signature: '功能优先, 中性色, 几何精确' },
];

const REAL_WORLD_REFS = [
  { name: 'Stripe', category: 'fintech/SaaS', signature: '渐变+插画+严谨排版, 紫蓝调' },
  { name: 'Linear', category: 'productivity', signature: '暗色+精致细节+功能动效' },
  { name: 'Vercel', category: 'devtools', signature: '黑白+几何插画+终端美学' },
  { name: 'Anthropic', category: 'AI/research', signature: '米白+衬线+学术克制' },
  { name: 'Notion', category: 'productivity', signature: '近白+文档式+大量留白' },
  { name: 'Apple.com', category: 'consumer', signature: '产品页, 居中hero, 渐进式叙事' },
  { name: 'Bloomberg Businessweek', category: 'editorial', signature: '巨号Helvetica+硬色块' },
];

export function proposeThreeDirections({ category = 'web', requirement = '' } = {}) {
  const styles = rouletteThreeDirections(category);
  // eslint-disable-next-line sonarjs/pseudo-random -- non-cryptographic, UI variety selection
  const designer = TOP_DESIGNERS[Math.floor(Math.random() * TOP_DESIGNERS.length)];
  // eslint-disable-next-line sonarjs/pseudo-random -- non-cryptographic, UI variety selection
  const ref = REAL_WORLD_REFS[Math.floor(Math.random() * REAL_WORLD_REFS.length)];

  return {
    A: {
      logic: '现实参照（获奖站迁移）',
      reference: ref,
      style: styles.A_stable,
      rationale: `参照 ${ref.name}（${ref.category}），稳妥底盘`,
    },
    B: {
      logic: '40 风格库中性温度',
      style: styles.B_balanced,
      rationale: '平衡方向, 与 A 拉差异',
    },
    C: {
      logic: '秒数轮盘 + 顶级设计师哲学',
      designer,
      style: styles.C_bold,
      rationale: `${designer.name} 的 ${designer.philosophy} 哲学 + 大胆风格强制注入, 打破默认极简偏差`,
    },
    requirement,
    category,
  };
}

export function renderProposal(proposal) {
  const lines = [chalk.bold.cyan('\n🎨 三方向设计提案（huashu advisor）\n')];
  if (proposal.requirement) {
    lines.push(
      chalk.dim(`需求: ${proposal.requirement}`),
      chalk.dim(`类别: ${proposal.category}\n`),
    );
  }
  for (const key of ['A', 'B', 'C']) {
    const d = proposal[key];
    const block = [chalk.bold(`方向 ${key} · ${d.logic}`)];
    if (d.reference) block.push(chalk.dim(`  参照: ${d.reference.name} (${d.reference.signature})`));
    if (d.designer) block.push(chalk.dim(`  设计师: ${d.designer.name} — ${d.designer.signature}`));
    block.push(
      styleSummary(d.style).split('\n').map(l => '  ' + l).join('\n'),
      chalk.dim(`  → ${d.rationale}\n`),
    );
    lines.push(...block);
  }
  return lines.join('\n');
}

export function chooseDirection(proposal, key) {
  return proposal[key] || null;
}
