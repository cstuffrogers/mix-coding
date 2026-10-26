import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec, escapeArg } from '../../lib/safe-exec.js';

const SAFE_FILES = new Set([
  '.env.example',
  'claude-scene/.env.example',
  'claude-scene/src/handlers/code-analysis.js',
  'claude-scene/src/handlers/security-scanning.js',
  'claude-scene/src/handlers/security/secret-scan.js',
  'claude-scene/src/handlers/security/threat-scan.js',
  'claude-scene/src/handlers/security/npm-scan.js',
  'package-lock.json',
  'claude-scene/package-lock.json',
  'test-security-files/xss-vulnerability.js',
  'test-security-files/sql-injection.js',
  'test-security-files/command-injection.js',
]);

// 内容级正则 —— 前缀 needle 漏得太多：`sk-` 开头的 OpenAI/DeepSeek/Anthropic
// 风格密钥没有固定字面量，旧实现只能搜 "api_key" 这类普通单词，再靠白名单压噪，
// 结果真泄露（codewhale-config.toml 里的 sk-…）被整份漏掉。
// 正则只要求「前缀 + 足够长的字符」—— 占位符（${VAR} / your-key-here）不命中。
const KEY_PATTERNS = [
  { name: 'API Key(sk-)', re: 'sk-[A-Za-z0-9_-]{20,}' },
  { name: 'GitHub Token', re: 'ghp_[A-Za-z0-9]{20,}' },
  { name: 'GitHub PAT', re: 'github_pat_[A-Za-z0-9_]{20,}' },
  { name: 'AWS Access Key', re: 'AKIA[0-9A-Z]{16}' },
  { name: 'Private Key', re: '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  { name: 'JWT Token', re: 'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}' },
];

const HEX_COMMIT_RE = /^[0-9a-f]{7,}$/;
const GIT_ERR_RE = /^(?:fatal|error|warning):/i;
// 路径形态过滤：git grep 失败时会把 usage 文本吐到 stdout，只看「像路径」的行，
// 否则 `Private Key` 这种以 `-` 开头的模式会让 usage 行混进「泄露文件」列表。
const PATH_LIKE_RE = /^[\w./@-]+$/;

function gitLines(targetPath, cmd, maxBuffer = 5 * 1024 * 1024) {
  const raw = safeExec(`${cmd} 2>&1 || true`, targetPath, { stdio: 'pipe', maxBuffer }).toString();
  return raw.split(String.fromCodePoint(10)).map(line => line.trim()).filter(Boolean);
}

// HEAD 树里**当前仍是明文**的密钥文件。示例/占位符文件在白名单里，历史泄露不在 ——
// 「示例文件里带了真 key」正是最需要报的一种。
function currentLeaks(targetPath, { re }) {
  const files = [];
  for (const line of gitLines(targetPath, `git grep -l -I -E -e ${escapeArg(re)} HEAD`)) {
    if (GIT_ERR_RE.test(line)) continue;
    const file = line.replace(/^(?:HEAD|\w{7,40}):/, '');
    if (!PATH_LIKE_RE.test(file) || !file.includes('.') || SAFE_FILES.has(file)) continue;
    if (existsSync(join(targetPath, file))) files.push(file);
  }
  return files;
}

// 只存在于历史里的泄露。用 `git log -G <regex>`（匹配 diff 里新增/删除的行）而不是
// `-S <needle>`：-S 把「删掉密钥」的提交也算命中，而最新提交往往就是删掉的那次，
// 只看最近几个 commit 就会把真正的引入点漏到分页后面。
// 命中后在该 commit 的**整棵树**上 `git grep`（一次调用查全树）—— 不能拿
// `git show --name-only` 的文件列表自己截断：引入密钥的那个 commit 常常是一次性
// 导入几百个文件的初始提交，截断就把真正含有密钥的文件筛掉了（实测踩到）。
const HISTORY_SCAN_MAX_COMMITS = 40;

function grepAtCommit(targetPath, re, commit) {
  try {
    // 输出可能是 `013c00c:path` 也可能是 `path`：先去掉 `<commit>:` 前缀再按路径形态过滤
    // （否则冒号会把路径判成非路径，真泄露就被筛掉了）。
    return gitLines(targetPath, `git grep -l -I -E -e ${escapeArg(re)} ${escapeArg(commit)}`)
      .filter(line => !GIT_ERR_RE.test(line))
      .map(line => line.replace(`${commit}:`, ''))
      .filter(file => PATH_LIKE_RE.test(file) && file.includes('.'));
  } catch {
    return []; // 该提交里没有命中（git grep 无命中退出码 1）
  }
}

function historyLeaks(targetPath, patterns) {
  const combined = `(${patterns.map(p => p.re).join('|')})`;
  const compiled = patterns.map(p => ({ name: p.name, re: new RegExp(p.re) }));
  const hits = new Map();
  const commits = gitLines(targetPath, `git log --all -G ${escapeArg(combined)} --format=%h`)
    .filter(line => HEX_COMMIT_RE.test(line))
    .slice(0, HISTORY_SCAN_MAX_COMMITS);
  for (const commit of commits) {
    // 每个 commit 只 grep 一次（组合正则），命中后再回读内容只为区分是哪种密钥 ——
    // 六个模式各 grep 一遍在大仓里要慢六倍（实测 1.6s/次）。
    for (const file of grepAtCommit(targetPath, combined, commit)) {
      if (hits.has(file)) continue;
      const content = safeExec(`git show ${escapeArg(`${commit}:${file}`)} 2>&1 || true`, targetPath, {
        stdio: 'pipe', maxBuffer: 5 * 1024 * 1024,
      }).toString();
      const matched = compiled.find(p => p.re.test(content));
      hits.set(file, { commit, label: `${matched ? matched.name : '密钥'}: ${file}`, file });
    }
  }
  return [...hits.values()];
}

function scanHead(targetPath) {
  const live = [];
  for (const pattern of KEY_PATTERNS) {
    for (const file of currentLeaks(targetPath, pattern)) {
      live.push({ label: `${pattern.name}: ${file}`, file });
    }
  }
  return live;
}

function gitHeadAvailable(targetPath) {
  try {
    return gitLines(targetPath, 'git rev-parse --verify HEAD').some(line => HEX_COMMIT_RE.test(line));
  } catch {
    return false;
  }
}

// 报告分两档：当前还在（要立刻处理）与只在历史里（改代码无效，只能轮换密钥）。
function reportLeaks(live, hist) {
  if (live.length) {
    console.log(chalk.red(`  🔴 当前仍有 ${live.length} 处明文密钥`));
    for (const item of live.slice(0, 8)) console.log(chalk.dim(`    ${item.label}`));
  }
  if (hist.length) {
    console.log(chalk.yellow(`  ⚠ ${hist.length} 处密钥已从工作区移除，但仍留在 Git 历史里`));
    for (const item of hist.slice(0, 8)) console.log(chalk.dim(`    ${item.label}（提交 ${item.commit}）`));
  }
}

function leakSummary(live, hist) {
  if (!live.length && !hist.length) return 'Git 密钥扫描完成: 未发现明文密钥';
  const parts = [];
  if (live.length) parts.push(`当前 ${live.length} 个文件仍是明文`);
  if (hist.length) parts.push(`${hist.length} 个文件仅在历史里（需轮换密钥，改代码无效）`);
  return `Git 密钥扫描完成: ${parts.join('；')}`;
}

export function handleGitLeaks(_action, _params, targetPath, context) {
  const available = gitHeadAvailable(targetPath);
  let live = [];
  let hist = [];

  if (available) {
    try {
      live = scanHead(targetPath);
    } catch { live = []; /* 单坑：git grep 不可用就当没有，不虚构发现 */ }
    try {
      hist = historyLeaks(targetPath, KEY_PATTERNS);
    } catch { hist = []; }
    // 同一个文件可能既在 HEAD 又在历史：只按「当前还在」报一次，避免重复计数。
    const liveFiles = new Set(live.map(item => item.file));
    hist = hist.filter(item => !liveFiles.has(item.file));
    reportLeaks(live, hist);
    if (!live.length && !hist.length) console.log(chalk.green('  ✅ HEAD 树与 Git 历史均未发现明文密钥'));
  }

  if (context) context.gitLeaksPassed = available && !live.length && !hist.length;

  return available ? leakSummary(live, hist) : 'Git 密钥扫描完成（git 不可用或无提交）';
}


function checkGitignoreRules(targetPath, findings) {
  const gitignore = join(targetPath, '.gitignore');
  if (!existsSync(gitignore)) {
    findings.push('.gitignore 文件不存在');
    return null;
  }
  const content = readFileSync(gitignore, 'utf-8');
  const mustIgnore = ['.env', '*.pem', '*.key', 'credentials.json'];
  const missing = mustIgnore.filter(p => !content.includes(p));
  if (missing.length > 0) {
    findings.push(`.gitignore 缺失规则: ${missing.join(', ')}`);
  }
  return content;
}

function checkUnignoredEnvFiles(targetPath, gitignoreContent, findings) {
  const envFiles = ['.env', '.env.local', '.env.production'];
  for (const f of envFiles) {
    const fp = join(targetPath, f);
    const isNotReported = findings.every(fi => !fi.includes(f));
    if (existsSync(fp) && isNotReported && gitignoreContent && !gitignoreContent.includes(f)) {
      findings.push(`${f} 存在但未被 gitignore`);
    }
  }
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
        raw.split('\n').filter(Boolean).forEach(f => findings.push(`${name}: ${f}（已被 Git 追踪）`));
      }
    } catch { /* skip */ }
  }

  const gitignoreContent = checkGitignoreRules(targetPath, findings);
  checkUnignoredEnvFiles(targetPath, gitignoreContent, findings);

  if (findings.length > 0) {
    console.log(chalk.red(`  🔴 发现 ${findings.length} 处敏感文件暴露风险`));
    findings.slice(0, 8).forEach(f => console.log(chalk.dim(`    ${f}`)));
  } else {
    console.log(chalk.green('  ✅ 未发现敏感文件暴露'));
  }

  if (context) context.sensitiveFilePassed = findings.length === 0;
  return `敏感文件检查完成: ${findings.length ? `${findings.length} 处风险` : '安全'}`;
}
