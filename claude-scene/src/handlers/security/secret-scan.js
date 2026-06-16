import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../../lib/safe-exec.js';

const GHP = 'ghp_';
const GHPAT = 'github_pat_';
const PRIV = 'PRIVATE KEY-----';
const AKI = 'AKIA';
const APIK = 'api_key';
const APIK2 = 'apikey';
const EYJ = 'eyJ';

const SAFE_FILES = new Set([
  '.env.example',
  'claude-scene/.env.example',
  'claude-scene/src/handlers/code-analysis.js',
  'claude-scene/src/handlers/security-scanning.js',
  'claude-scene/src/handlers/security/secret-scan.js',
  'claude-scene/src/handlers/security/threat-scan.js',
  'claude-scene/src/handlers/security/npm-scan.js',
  'codewhale-config.toml',
  'package-lock.json',
  'claude-scene/package-lock.json',
  'test-security-files/xss-vulnerability.js',
  'test-security-files/sql-injection.js',
  'test-security-files/command-injection.js',
]);

const SECRET_SEARCHES = [
  { name: 'GitHub Token', needle: GHP },
  { name: 'GitHub PAT', needle: GHPAT },
  { name: 'AWS Key', needle: AKI },
  { name: 'Private Key', needle: PRIV },
  { name: 'Generic Secret', needle: APIK },
  { name: 'Generic Secret', needle: APIK2 },
  { name: 'JWT Token', needle: EYJ },
];

const HASH_RE = /^[0-9a-f]{7,}\s/;

export function handleGitLeaks(_action, _params, targetPath, context) {
  const findings = [];

  try {
    for (const { name, needle } of SECRET_SEARCHES) {
      try {
        const raw = safeExec(
          `git log --all --oneline --name-only -S "${needle}" 2>&1 || true`,
          targetPath,
          { stdio: 'pipe', maxBuffer: 5 * 1024 * 1024 }
        ).toString().trim();

        if (!raw) continue;

        const lines = raw.split('\n');
        const matchedFiles = new Set();
        let commitCount = 0;

        for (const line of lines) {
          if (HASH_RE.test(line)) { commitCount++; continue; }
          const f = line.trim();
          if (f && f.includes('.') && !SAFE_FILES.has(f)) {
            matchedFiles.add(f);
          }
        }

        if (matchedFiles.size > 0) {
          const existing = findings.find(f => f.name === name);
          if (existing) {
            existing.commits += commitCount;
          } else {
            findings.push({ name, commits: commitCount });
          }
          ;
        }
      } catch { /* search failed, skip */ }
    }

    if (!findings.length) {
      console.log(chalk.green('  ✅ Git 历史未发现密钥泄露'));
    }
    const hasLeaks = findings.length > 0;
    if (context) context.gitLeaksPassed = !hasLeaks;
    return `Git 密钥扫描完成: ${hasLeaks ? findings.map(f => `${f.name}(${f.commits})`).join(', ') : '无泄露'}`;
  } catch { /* Git not available */ }
  return 'Git 密钥扫描完成（git 不可用）';
}

export function handleSensitiveFileCheck(_action, _params, targetPath, context) {
  const findings = [];

  const sensitivePatterns = [
    { pattern: '.env', name: '.env 文件' },
    { pattern: '*.pem', name: 'PEM 私钥' },
    { pattern: '*.key', name: '密钥文件' },
    { pattern: 'credentials.json', name: '凭证文件' },
    { pattern: 'id_rsa*', name: 'SSH 私钥' },
    { pattern: '*.pfx', name: 'PFX 证书' },
    { pattern: '*.p12', name: 'P12 证书' },
    { pattern: 'service-account*.json', name: '服务账号密钥' },
    { pattern: '.env.local', name: '本地 .env' },
    { pattern: '.env.production', name: '生产 .env' },
  ];

  for (const { pattern, name } of sensitivePatterns) {
    try {
      const raw = safeExec(
        `git ls-files --cached --others --exclude-standard -- "${pattern}" 2>&1 || true`,
        targetPath,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim();

      if (raw) {
        const files = raw.split('\n').filter(Boolean);
        files.forEach(f => findings.push(`${name}: ${f}（已被 Git 追踪）`));
      }
    } catch { /* skip */ }
  }

  const gitignore = join(targetPath, '.gitignore');
  if (existsSync(gitignore)) {
    const content = readFileSync(gitignore, 'utf-8');
    const mustIgnore = ['.env', '*.pem', '*.key', 'credentials.json'];
    const missing = mustIgnore.filter(p => !content.includes(p));
    if (missing.length > 0) {
      findings.push(`.gitignore 缺失规则: ${missing.join(', ')}`);
    }
  } else {
    findings.push('.gitignore 文件不存在');
  }

  const envFiles = ['.env', '.env.local', '.env.production'];
  for (const f of envFiles) {
    const fp = join(targetPath, f);
    if (existsSync(fp) && findings.every(fi => !fi.includes(f)) && existsSync(gitignore) && !readFileSync(gitignore, 'utf-8').includes(f)) {
      findings.push(`${f} 存在但未被 gitignore`);
    }
  }

  if (findings.length > 0) {
    console.log(chalk.red(`  🔴 发现 ${findings.length} 处敏感文件暴露风险`));
    findings.slice(0, 8).forEach(f => console.log(chalk.dim(`    ${f}`)));
  } else {
    console.log(chalk.green('  ✅ 未发现敏感文件暴露'));
  }

  if (context) context.sensitiveFilePassed = findings.length === 0;
  return `敏感文件检查完成: ${findings.length ? `${findings.length} 处风险` : '安全'}`;
}
