import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

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
};

function resolveSkillPath(skillName, targetPath) {
  const relPath = SKILL_PATHS[skillName];
  if (!relPath) return null;
  // targetPath is the project under analysis; skills live one level up
  // (e.g., targetPath=e:/auto-coding/claude-scene, skills at e:/auto-coding/.claude/skills/)
  return join(targetPath, '..', relPath);
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

export function handleInvokeSkill(_action, params, targetPath, context) {
  const skillName = params?.skill || 'unknown';

  // Skills with dedicated CLI handlers — these run fine, no need to display content
  const hasCliAlternative = ['sec-bug-hunt', 'ai-friendly-web-design', 'mobile-ui-review'].includes(skillName);
  if (hasCliAlternative) {
    return `Skill "${skillName}" 有 CLI 静态替代方案，已由对应 handler 执行`;
  }

  const skillPath = resolveSkillPath(skillName, targetPath);

  if (!skillPath || !existsSync(skillPath)) {
    return `Skill "${skillName}" 需要在对话模式中执行，CLI 模式跳过（无 SKILL.md）`;
  }

  const content = readFileSync(skillPath, 'utf-8');

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  const fmName = frontmatter.match(/^name:\s*(.+)/m);
  const displayName = fmName ? fmName[1].trim() : skillName;

  const checklist = extractChecklist(content);
  if (checklist.length > 0) {
    // Group by section
    const groups = new Map();
    for (const item of checklist) {
      if (!groups.has(item.section)) groups.set(item.section, []);
      groups.get(item.section).push(item.text);
    }
    for (const [_section, items] of groups) {
      for (const item of items.slice(0, 12)) {
        console.log(chalk.dim(`      ☐ ${item}`));
      }
    }
  }

  // Show section overview
  const sections = extractSections(content);
  if (sections.length > 0) {
    for (const s of sections) {
      console.log(chalk.dim(`      ${s}`));
    }
  }

  // Store parsed skill data on context for downstream AI reference
  if (context) {
    context[`skill_${skillName}_checklist`] = checklist;
    context[`skill_${skillName}_sections`] = sections;
    context[`skill_${skillName}_name`] = displayName;
  }

  return `Skill "${displayName}" 参考内容已展示（${checklist.length} 项清单）— 完整执行需对话模式`;
}
