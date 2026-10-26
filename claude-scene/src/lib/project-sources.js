// [patched:project-sources] 扫描根不能假设 <repo>/src
//
// 引擎里多个扫描器硬编码 join(targetPath, 'src')：
//   security/threat-scan.js  scanGrepPatterns / scanEslintSecurity
//   open-redirect.js         handleOpenRedirectScan
//   external-tool-checks.js  handleRecheckCli
// 前端在 frontend/*/、后端在 backend/ 的项目（例如本仓库）会扫到 0 个文件，
// 而「0 命中」又被当成「无问题」→ 空转也算通过。
// 这里统一提供项目源码清单，并要求调用方在清单为空时判定失败（assertSources）。
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';

export const CODE_EXTS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.go', '.rb', '.php', '.java', '.kt'];

// 点开头目录永远跳过；各语言/各端的产物目录需要在这里再排一次
// （android/ios 是 Capacitor 产物）。
const SKIP_SEGMENTS = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.git', '.claude', '.codegraph',
  'android', 'ios', '__pycache__', 'vendor', 'venv', '.venv', 'target', '.next',
  '.vite', 'test-results', 'playwright-report',
]);

// 项目自己声明哪些目录不是自己的源码（每行一个相对路径，# 开头为注释）：
//   <repo>/.claude/scene-scan-ignore
const IGNORE_FILE = '.claude/scene-scan-ignore';

export function loadScanIgnore(targetPath) {
  const file = join(targetPath, IGNORE_FILE);
  if (!existsSync(file)) return [];
  try {
    return readFileSync(file, 'utf-8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.replace(/^\.?\//, '').replace(/^\//, '').replace(/\/$/, '').toLowerCase());
  } catch {
    return [];
  }
}

const nestedRepoCache = new Map();

// 自带 .git 的子目录 = 嵌套仓库（submodule / vendored 第三方项目），不算本项目源码
function isNestedRepo(targetPath, relDir) {
  if (!relDir) return false;
  if (nestedRepoCache.has(relDir)) return nestedRepoCache.get(relDir);
  let found = false;
  const segs = relDir.split('/');
  for (let i = 1; i <= segs.length; i += 1) {
    if (existsSync(join(targetPath, ...segs.slice(0, i), '.git'))) {
      found = true;
      break;
    }
  }
  nestedRepoCache.set(relDir, found);
  return found;
}

// scanDir 一律跳过点开头的文件，所以 `.env.example` / `.eslintrc` 这类文件它根本看不到。
// 大多数扫描器不需要它们，但「不安全默认值」这类审计恰恰要看 .env* 与配置点文件，
// 所以这里自带一个 walker：点目录永远跳过，点文件按需纳入。
function walkFiles(rootDir, includeDotFiles) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_SEGMENTS.has(entry.name)) continue;
        visit(full);
      } else if (entry.isFile()) {
        if (entry.name.startsWith('.') && !includeDotFiles) continue;
        out.push(full);
      }
    }
  };
  visit(rootDir);
  return out;
}

/**
 * 项目文件清单。
 * @param {string} targetPath 项目根
 * @param {{exts?: string[], namePattern?: RegExp, includeDotFiles?: boolean}} [opts]
 *   namePattern 命中相对路径时无视 exts（用于 Dockerfile / Makefile 这类无扩展名文件）
 */
export function listProjectFiles(targetPath, opts = {}) {
  if (!existsSync(targetPath)) return [];
  const exts = opts.exts || CODE_EXTS;
  const want = exts.map((e) => e.toLowerCase());
  const ignore = loadScanIgnore(targetPath);
  return walkFiles(targetPath, Boolean(opts.includeDotFiles)).filter((file) => {
    const rel = relative(targetPath, file).split(sep).join('/').toLowerCase();
    const segs = rel.split('/');
    const extOk = want.some((ext) => rel.endsWith(ext)) || Boolean(opts.namePattern && opts.namePattern.test(rel));
    if (!extOk) return false;
    if (ignore.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) return false;
    const dir = segs.length > 1 ? segs.slice(0, -1).join('/') : '';
    return !isNestedRepo(targetPath, dir);
  });
}

export function listProjectCodeFiles(targetPath, exts = CODE_EXTS) {
  return listProjectFiles(targetPath, { exts });
}

export function codeRoots(targetPath, files, maxRoots = 8) {
  const roots = new Set();
  for (const file of files) {
    const rel = relative(targetPath, file).split(sep).join('/');
    const parts = rel.split('/');
    roots.add(parts.length > 1 ? parts[0] : '.');
  }
  return [...roots].slice(0, maxRoots);
}

export function assertSources(files, context, label) {
  if (files.length > 0) return true;
  console.log(`  ❌ ${label}: 扫描范围为 0 个源码文件（结果不可信，按失败处理）`);
  if (context) context.lastStepFailed = true;
  return false;
}
