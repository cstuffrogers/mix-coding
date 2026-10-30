import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import chalk from 'chalk';
import { PACKAGE_ROOT, USER_DATA_DIR } from '../lib/paths.js';

/**
 * CLI-mode Skill content display.
 * Skills can't execute without Claude Code's AI runtime, but we can read
 * their SKILL.md files and display the checklist/rules/guidelines so the
 * user gets structured reference material.
 */

// Skill name → relative path from project root (.claude/skills/)
const SKILL_PATHS = {
  'review-checklist': '.claude/skills/review-checklist/SKILL.md',
  'sec-bug-hunt': '.claude/skills/sec-bug-hunt/SKILL.md',
  'impeccable': '.claude/skills/impeccable/SKILL.md',
  'web-design-engineer': '.claude/skills/web-design-engineer/SKILL.md',
  'ai-friendly-web-design': '.claude/skills/ai-friendly-web-design/SKILL.md',
  'constitution-reference': '.claude/skills/constitution-reference/SKILL.md',
  'awesome-design-md': '.claude/skills/awesome-design-md/SKILL.md',
  'mobile-ui-review': '.claude/skills/mobile-ui-review/SKILL.md',
  'review': '.claude/skills/mattpocock/skills/skills/in-progress/review/SKILL.md',
  'webapp-testing': '.claude/skills/mattpocock/skills/skills/deprecated/qa/SKILL.md',
  // Trail of Bits security skills, vendored under CC BY-SA 4.0 (see each
  // directory's NOTICE.md - they are NOT under this repo's Elastic License).
  'property-based-testing': '.claude/skills/property-based-testing/SKILL.md',
  'variant-analysis': '.claude/skills/variant-analysis/SKILL.md',
  'sharp-edges': '.claude/skills/sharp-edges/SKILL.md',
  'insecure-defaults': '.claude/skills/insecure-defaults/SKILL.md',
  // MIT（非 CC BY-SA）：elayadesign/ai-design-skills 的落地页设计系统，
  // 署名与改动清单见目录内 NOTICE.md。
  'landing-page-design': '.claude/skills/landing-page-design/SKILL.md',
};

/**
 * 把 skill 名解析为已存在的文件路径。
 *
 * 原来只有 `targetPath/..` 一种候选，那仅在「引擎仓库自身当目标」时成立。
 * 真实项目（/tmp/vuln 之类）下 `targetPath/..` 指向别处，于是每个 invokeSkill
 * 步骤都报「无 SKILL.md」静默降级成 noop —— 技能形同不存在。
 *
 * 优先级与场景查找一致（项目覆盖 → 用户级 → 包内）：
 *   1. targetPath/relPath      目标项目自带的技能（覆盖引擎版本）
 *   2. targetPath/../relPath   兼容旧行为（引擎目录作为 targetPath）
 *   3. PACKAGE_ROOT/../relPath 仓库内开发布局（<repo>/.claude/skills）
 *   4. USER_DATA_DIR/relPath   全局安装（~/.mix-coding/.claude/skills）
 *   5. PACKAGE_ROOT/relPath    技能随包分发
 */
export function resolveSkillCandidates(skillName, targetPath) {
  const relPath = SKILL_PATHS[skillName];
  if (!relPath) return [];
  return [
    join(targetPath, relPath),
    join(targetPath, '..', relPath),
    join(PACKAGE_ROOT, '..', relPath),
    join(USER_DATA_DIR, relPath),
    join(PACKAGE_ROOT, relPath),
  ];
}

/** 解析后的技能目录（含 references/），找不到返回 null。 */
export function resolveSkillDir(skillName, targetPath) {
  const file = resolveSkillPath(skillName, targetPath);
  return file ? dirname(file) : null;
}

function resolveSkillPath(skillName, targetPath) {
  const candidates = resolveSkillCandidates(skillName, targetPath);
  return candidates.find((p) => existsSync(p)) || null;
}

function extractChecklist(content) {
  const items = [];
  const lines = content.split('\n');
  let currentSection = '';
  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)/);
    if (sectionMatch) { currentSection = sectionMatch[1]; continue; }
    const itemMatch = line.match(/^-\s*\[ \]\s+(.+)/);
    if (itemMatch) {
      items.push({ section: currentSection, text: itemMatch[1] });
    }
  }
  return items;
}

function extractSections(content) {
  const sections = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (m && !m[1].startsWith('Setup') && !m[1].startsWith('Location') && !m[1].startsWith('How to')) {
      sections.push(m[1]);
    }
  }
  return sections;
}

function getDisplayName(content, skillName) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  const fmName = frontmatter.match(/^name:\s*(.+)/m);
  return fmName ? fmName[1].trim() : skillName;
}

function printChecklist(content) {
  const checklist = extractChecklist(content);
  if (!checklist.length) return checklist;
  const groups = new Map();
  for (const item of checklist) {
    if (!groups.has(item.section)) groups.set(item.section, []);
    groups.get(item.section).push(item.text);
  }
  for (const [, items] of groups) {
    for (const item of items.slice(0, 12)) {
      console.log(chalk.dim(`      ☐ ${item}`));
    }
  }
  return checklist;
}

function printSections(content) {
  const sections = extractSections(content);
  if (!sections.length) return sections;
  for (const s of sections) {
    console.log(chalk.dim(`      ${s}`));
  }
  return sections;
}

export function handleInvokeSkill(_action, params, targetPath, context) {
  const skillName = params?.skill || 'unknown';
  // 场景里同一个 skill 反复调用时，用 subcommand（shape/critique/polish/layout…）
  // 或 dimensions 区分不同模式。以前这两个键没人读 —— 十几个步骤在引擎眼里
  // 完全一样，模式信息白白丢掉。这里至少要把它们带进结论和 context。
  //
  // 第十三轮：ui-polish 的 18 个步骤写的是 `command: "critique" / "layout" / …`，
  // 意图和 subcommand 完全一样，只是键名不同 —— 以前一个字节都没人读。
  // 两个键都认（subcommand 优先），谁也不许再当装饰品。
  const subcommand = params?.subcommand ?? params?.command;
  const dimensions = Array.isArray(params?.dimensions) ? params.dimensions : [];
  const modeNote = [
    subcommand ? `模式 ${subcommand}` : '',
    dimensions.length ? `维度 ${dimensions.join('/')}` : '',
  ].filter(Boolean).join('，');

  const hasCliAlternative = ['sec-bug-hunt', 'ai-friendly-web-design', 'mobile-ui-review'].includes(skillName);
  if (hasCliAlternative) {
    // 以前返回「已由对应 handler 执行」→ 引擎看到「已…执行」记 ✓ pass。
    // 但这里只是「有这个替代方案」，本步骤自己没执行任何东西 —— 那是另一个步骤的事。
    return { status: 'noop', reason: 'delegated', message: `Skill "${skillName}" 有 CLI 静态替代方案（由对应 handler 执行，本步骤不重复执行）` };
  }

  const skillPath = resolveSkillPath(skillName, targetPath);
  if (!skillPath || !existsSync(skillPath)) {
    // 原因照实写：本机没有这个 skill 的文件 = 缺依赖，不是「条件不满足」。
    return { status: 'skip', reason: 'tool-missing', message: `Skill "${skillName}" 跳过：本机没有它的 SKILL.md（对话模式下由 agent 直接调用）` };
  }

  const content = readFileSync(skillPath, 'utf-8');
  const displayName = getDisplayName(content, skillName);
  const checklist = printChecklist(content);
  const sections = printSections(content);

  if (context) {
    context[`skill_${skillName}_checklist`] = checklist;
    context[`skill_${skillName}_sections`] = sections;
    context[`skill_${skillName}_name`] = displayName;
    if (subcommand) context[`skill_${skillName}_subcommand`] = subcommand;
    if (dimensions.length) context[`skill_${skillName}_dimensions`] = dimensions;
  }

  // 展示清单 ≠ 执行 skill：以前这句带「已展示」被判 ✓ pass，汇总里就多了一个
  // 实际没发生的「审查清单已加载并生效」。清单进了 context 供对话模式使用 = noop。
  return {
    status: 'noop',
    // 判定权在处理器：这句本来就写着「具体执行需对话模式」，那就把原因也声明出来，
    // 别让引擎只能记「处理器判为无事可做但没声明原因」。
    reason: 'conversation-mode',
    message: `Skill "${displayName}" 参考内容已载入 context（${checklist.length} 项清单${modeNote ? `，${modeNote}` : ''}）— 具体执行需对话模式`,
  };
}
