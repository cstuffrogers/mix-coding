import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';
import { ensureDir } from '../lib/fs-utils.js';
import { scanAllConflicts } from '../lib/conflict-scanner.js';

function run(cmd, cwd) {
  try {
    return safeExec(`${cmd} 2>&1 || true`, cwd, { stdio: 'pipe' }).toString().trim();
  } catch {
    return '';
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// 扫描 npm 过期包 (MCP + claude-scene deps 共用 npm registry)
function scanNpm(targetPath) {
  const result = run('npm outdated --json', targetPath);
  if (!result || result === '{}') return [];
  try {
    const outdated = JSON.parse(result);
    return Object.entries(outdated).map(([name, info]) => ({
      type: 'npm',
      name,
      current: info.current || '?',
      latest: info.latest || '?',
      bumpLevel: bumpLevel(info.current, info.latest),
    }));
  } catch {
    return [];
  }
}

function parseSemver(version) {
  const parts = String(version || '0')
    .replace(/^\D+/, '')
    .split('.');
  return [
    parseInt(parts[0]) || 0,
    parseInt(parts[1]) || 0,
    parseInt(parts[2]) || 0,
  ];
}

export function bumpLevel(current, latest) {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (l[0] > c[0]) return 'major';
  if (l[1] > c[1]) return 'minor';
  return 'patch';
}

// 扫描 skill 上游版本: 读 tool-versions.md 的上游来源 + SKILL.md version
function scanSkills(projectRoot) {
  const skillsDir = join(projectRoot, '.claude', 'skills');
  if (!existsSync(skillsDir)) return [];
  const results = [];
  for (const name of readdirSync(skillsDir)) {
    const skillMd = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(skillMd)) continue;
    const content = readFileSync(skillMd, 'utf8');
    // eslint-disable-next-line sonarjs/super-linear-regex
    const vMatch = content.match(/^version:\s*(.+)$/m);
    const version = vMatch ? vMatch[1].trim() : '未标';
    results.push({ type: 'skill', name, current: version, latest: null, upstreamChecked: false });
  }
  return results;
}

// 扫描外部 CLI 工具版本
function scanCliTools() {
  const tools = [
    { name: 'mobsfscan', cmd: 'mobsfscan --version' },
    { name: 'specify', cmd: 'specify --version' },
    { name: 'ruff', cmd: 'ruff --version' },
    { name: 'sqlfluff', cmd: 'sqlfluff --version' },
    { name: 'trivy', cmd: 'trivy --version' },
    { name: 'gitleaks', cmd: 'gitleaks version' },
    { name: 'shellcheck', cmd: 'shellcheck --version' },
  ];
  return tools.map((t) => {
    const out = run(t.cmd, process.cwd());
    // eslint-disable-next-line sonarjs/super-linear-regex
    const vMatch = out.match(/v?(\d+\.\d+\.\d+)/);
    return { type: 'cli', name: t.name, current: vMatch ? vMatch[1] : '未装', latest: null, upstreamChecked: false };
  }).filter((t) => t.current !== '未装');
}

export function handleScanUpdates(_action, _params, targetPath, context) {
  const projectRoot = targetPath || process.cwd();
  const npmPkgs = scanNpm(join(projectRoot, 'claude-scene'));
  const skills = scanSkills(projectRoot);
  const cliTools = scanCliTools();

  const all = [...npmPkgs, ...skills, ...cliTools];
  const updatable = all.filter((r) => r.bumpLevel === 'patch' || r.bumpLevel === 'minor');
  const majorPending = all.filter((r) => r.bumpLevel === 'major');

  if (context) {
    context.updateScanResult = { all, updatable, majorPending };
    context.updateCounts = {
      npm: npmPkgs.length,
      skill: skills.length,
      cli: cliTools.length,
      updatable: updatable.length,
      majorPending: majorPending.length,
    };
  }

  console.log(chalk.dim(`    npm 过期: ${npmPkgs.length} · skill: ${skills.length} · CLI: ${cliTools.length}`));
  console.log(chalk.green(`    可自动更新 (patch/minor): ${updatable.length}`));
  console.log(chalk.yellow(`    待确认 (major): ${majorPending.length}`));
  updatable.slice(0, 10).forEach((r) => {
    console.log(chalk.dim(`      ${r.name}: ${r.current} → ${r.latest} [${r.bumpLevel}]`));
  });
  return `扫描完成: ${all.length} 项,可更新 ${updatable.length},待确认 major ${majorPending.length}`;
}

export function handleDetectConflicts(_action, _params, targetPath, context) {
  const projectRoot = targetPath || process.cwd();
  const result = scanAllConflicts(projectRoot);
  if (context) {
    context.conflictResult = result;
    context.hasHardConflict = result.hard.length > 0;
  }
  result.hard.forEach((h) => console.log(chalk.red(`    [硬冲突] ${h.message}`)));
  result.soft.forEach((s) => console.log(chalk.yellow(`    [软冲突] ${s.message}`)));
  if (result.hard.length) {
    return `检测到 ${result.hard.length} 个硬冲突,已阻断更新`;
  }
  return `冲突检测通过: 硬 0 · 软 ${result.soft.length}`;
}

// npm 包名 + @version 只允许安全字符,阻断 shell 注入
const NPM_PKG_RE = /^@?[a-zA-Z0-9][a-zA-Z0-9._/-]*@[a-zA-Z0-9.\-+]+$/;

export function handleAutoUpdateSafe(_action, _params, targetPath, context) {
  if (context?.hasHardConflict) {
    return '存在硬冲突,跳过自动更新';
  }
  const scan = context?.updateScanResult;
  if (!scan || scan.updatable.length === 0) {
    return '无 patch/minor 可自动更新';
  }
  const npmUpdatable = scan.updatable.filter((r) => r.type === 'npm');
  const updated = [];
  if (npmUpdatable.length) {
    const safe = npmUpdatable.every((r) => NPM_PKG_RE.test(`${r.name}@${r.latest}`));
    if (!safe) {
      return 'npm 包名含非法字符,跳过自动更新(安全阻断)';
    }
    const pkgs = npmUpdatable.map((r) => `${r.name}@${r.latest}`);
    try {
      safeExec(`npm install ${pkgs.join(' ')}`, join(targetPath, 'claude-scene'), { stdio: 'pipe' });
      npmUpdatable.forEach((r) => updated.push({ ...r, joinMode: '全部替换' }));
    } catch {
      return 'npm 安装失败,未自动更新';
    }
  }
  if (context) context.autoUpdated = updated;
  console.log(chalk.green(`    已自动更新 ${updated.length} 项`));
  return `自动更新 ${updated.length} 项 (patch/minor)`;
}

export function handleWriteUpdateLog(_action, _params, targetPath, context) {
  const projectRoot = targetPath || process.cwd();
  const updatesDir = join(projectRoot, '.claude', 'updates');
  ensureDir(updatesDir);
  const logPath = join(updatesDir, `${today()}.md`);

  const scan = context?.updateScanResult || { all: [], updatable: [], majorPending: [] };
  const conflict = context?.conflictResult || { hard: [], soft: [] };
  const updated = context?.autoUpdated || [];
  const counts = context?.updateCounts || {};

  const lines = [];
  lines.push(`# 系统资源更新日志 — ${today()}`);
  lines.push('');
  lines.push('## 执行摘要');
  lines.push(`- 扫描资源: npm ${counts.npm || 0} · skill ${counts.skill || 0} · CLI ${counts.cli || 0}`);
  lines.push(`- 冲突: 硬 ${conflict.hard.length} · 软 ${conflict.soft.length}`);
  lines.push(`- 已自动更新: ${updated.length} 项 (patch/minor)`);
  lines.push(`- 待确认: ${scan.majorPending.length} 项 (major)`);
  lines.push('');

  lines.push('## 已自动更新');
  if (updated.length) {
    lines.push('| 资源 | 类型 | 旧版本 | 新版本 | 加入方式 |');
    lines.push('|------|------|--------|--------|---------|');
    updated.forEach((r) => {
      lines.push(`| ${r.name} | ${r.type} | ${r.current} | ${r.latest} | ${r.joinMode} |`);
    });
  } else {
    lines.push('(无)');
  }
  lines.push('');

  lines.push('## 待确认 (major,未自动更新)');
  if (scan.majorPending.length) {
    lines.push('| 资源 | 类型 | 本地 | 上游 | 破坏性风险 |');
    lines.push('|------|------|------|------|-----------|');
    scan.majorPending.forEach((r) => {
      lines.push(`| ${r.name} | ${r.type} | ${r.current} | ${r.latest} | 跨 major,可能不兼容 |`);
    });
  } else {
    lines.push('(无)');
  }
  lines.push('');

  lines.push('## 冲突检测');
  lines.push('### 硬冲突 (已阻断)');
  lines.push(conflict.hard.length ? conflict.hard.map((h) => `- ${h.message}`).join('\n') : '(无)');
  lines.push('');
  lines.push('### 软冲突 (仅警告)');
  lines.push(conflict.soft.length ? conflict.soft.map((s) => `- ${s.message}`).join('\n') : '(无)');
  lines.push('');

  lines.push('## 验证结果');
  lines.push(`- npm test: ${context?.testPassed ? '✅ 通过' : '⚠ 未验证'}`);
  lines.push(`- /check: ${context?.checkPassed ? '✅ 通过' : '⚠ 未验证'}`);

  writeFileSync(logPath, lines.join('\n'), 'utf8');
  if (context) context.updateLogPath = logPath;
  return `更新日志已写入: ${logPath}`;
}

export function handleUpdateReport(_action, _params, _targetPath, context) {
  const scan = context?.updateScanResult || { updatable: [], majorPending: [] };
  const conflict = context?.conflictResult || { hard: [], soft: [] };
  const updated = context?.autoUpdated || [];
  console.log(chalk.bold('\n=== /update 报告 ==='));
  console.log(chalk.green(`已自动更新: ${updated.length} 项`));
  console.log(chalk.yellow(`待确认 (major): ${scan.majorPending.length} 项`));
  console.log(chalk.red(`硬冲突: ${conflict.hard.length} · 软冲突: ${conflict.soft.length}`));
  if (context?.updateLogPath) {
    console.log(chalk.dim(`日志: ${context.updateLogPath}`));
  }
  return `更新报告: 自动 ${updated.length} · 待确认 ${scan.majorPending.length} · 硬冲突 ${conflict.hard.length}`;
}
