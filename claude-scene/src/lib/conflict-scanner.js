import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

// 禁用 frontmatter 字段 — 会导致 skill 静默加载失败 (见 memory: skill-frontmatter-format)
const FORBIDDEN_FIELDS = ['paths', 'effort', 'when-to-use'];

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fields = {};
  match[1].split(/\r?\n/).forEach((line) => {
    // eslint-disable-next-line sonarjs/super-linear-regex
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  });
  return fields;
}

function listSkillDirs(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir)
    .filter((f) => {
      const p = join(skillsDir, f);
      return statSync(p).isDirectory();
    })
    .map((f) => ({ name: f, path: join(skillsDir, f) }));
}

function tokenizeDescription(desc) {
  if (!desc) return new Set();
  const sepRe = new RegExp('[\\s,;:.()\'"\\u3000-\\u30ff\\uff00-\\uffef]+');
  return new Set(
    desc.toLowerCase().split(sepRe).filter((t) => t.length > 2)
  );
}

function jaccardSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function checkSkillHard(skill, skillsDir, seen, hard) {
  const skillMd = join(skill.path, 'SKILL.md');
  if (!existsSync(skillMd)) {
    const hasSubDirs = readdirSync(skill.path).some((f) => statSync(join(skill.path, f)).isDirectory());
    if (hasSubDirs) return null;
    hard.push({ type: 'skill-missing-skillmd', skill: skill.name, message: `${skill.name}/SKILL.md 缺失` });
    return null;
  }
  const content = readFileSync(skillMd, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    hard.push({ type: 'skill-no-frontmatter', skill: skill.name, message: `${skill.name} 无 frontmatter` });
    return null;
  }
  if (!fm.name) {
    hard.push({ type: 'skill-missing-name', skill: skill.name, message: `${skill.name} 缺 name 字段` });
  }
  if (seen.has(fm.name)) {
    hard.push({ type: 'skill-duplicate-name', skill: fm.name, message: `skill 重名: ${fm.name} (${seen.get(fm.name)} 与 ${skill.path})` });
  } else {
    seen.set(fm.name, skill.path);
  }
  const bad = FORBIDDEN_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(fm, f));
  if (bad.length) {
    hard.push({ type: 'skill-forbidden-field', skill: skill.name, fields: bad, message: `${skill.name} 含禁用 frontmatter 字段: ${bad.join(', ')}` });
  }
  return { name: skill.name, tokens: tokenizeDescription(fm.description) };
}

export function scanSkillConflicts(skillsDir) {
  const hard = [];
  const soft = [];
  const seen = new Map();
  const skills = listSkillDirs(skillsDir);
  const tokensBySkill = [];

  for (const skill of skills) {
    const entry = checkSkillHard(skill, skillsDir, seen, hard);
    if (entry) tokensBySkill.push(entry);
  }

  for (let i = 0; i < tokensBySkill.length; i++) {
    for (let j = i + 1; j < tokensBySkill.length; j++) {
      const sim = jaccardSimilarity(tokensBySkill[i].tokens, tokensBySkill[j].tokens);
      if (sim > 0.6) {
        soft.push({ type: 'skill-trigger-overlap', skills: [tokensBySkill[i].name, tokensBySkill[j].name], similarity: sim, message: `触发词重叠 ${(sim * 100).toFixed(0)}%: ${tokensBySkill[i].name} / ${tokensBySkill[j].name}` });
      }
    }
  }

  return { hard, soft };
}

export function scanMcpConflicts(mcpJsonPath) {
  const hard = [];
  const soft = [];
  if (!existsSync(mcpJsonPath)) {
    return { hard, soft };
  }
  let config;
  try {
    config = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
  } catch {
    hard.push({ type: 'mcp-invalid-json', message: '.mcp.json 解析失败' });
    return { hard, soft };
  }
  const servers = config.mcpServers || {};
  const seenCmd = new Map();
  for (const [name, def] of Object.entries(servers)) {
    const cmd = def.command;
    if (cmd && seenCmd.has(cmd)) {
      soft.push({ type: 'mcp-duplicate-command', command: cmd, servers: [seenCmd.get(cmd), name], message: `MCP 复用命令 ${cmd} (${seenCmd.get(cmd)} / ${name})` });
    } else if (cmd) {
      seenCmd.set(cmd, name);
    }
    if (cmd && cmd !== 'npx' && cmd !== 'uvx' && !existsSync(cmd)) {
      hard.push({ type: 'mcp-command-missing', server: name, command: cmd, message: `MCP ${name} 命令不存在: ${cmd}` });
    }
  }
  return { hard, soft };
}

export function scanCommandSkillNameClash(commandsDir, skillsDir) {
  const hard = [];
  if (!existsSync(commandsDir) || !existsSync(skillsDir)) return { hard, soft: [] };
  const commands = new Set(readdirSync(commandsDir).map((f) => f.replace(/\.md$/, '')));
  const skills = new Set(listSkillDirs(skillsDir).map((s) => s.name));
  for (const c of commands) {
    if (skills.has(c)) {
      hard.push({ type: 'command-skill-clash', name: c, message: `command 与 skill 同名: ${c}` });
    }
  }
  return { hard, soft: [] };
}

export function scanAllConflicts(projectRoot) {
  const skillsDir = join(projectRoot, '.claude', 'skills');
  const commandsDir = join(projectRoot, '.claude', 'commands');
  const mcpJson = join(projectRoot, '.mcp.json');
  const skillResult = scanSkillConflicts(skillsDir);
  const mcpResult = scanMcpConflicts(mcpJson);
  const clashResult = scanCommandSkillNameClash(commandsDir, skillsDir);
  return {
    hard: [...skillResult.hard, ...mcpResult.hard, ...clashResult.hard],
    soft: [...skillResult.soft, ...mcpResult.soft, ...clashResult.soft],
  };
}
