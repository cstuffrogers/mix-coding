import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC_DIR = join(__dirname, '..');
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

function readOrNull(filePath) {
  try { return readFileSync(filePath, 'utf-8'); } catch { return null; }
}

// ═══════════════════════════════════════════════════
// Pass 1: inline arrow stubs in actions.js
// ═══════════════════════════════════════════════════
function detectInlineStubs() {
  const actionsPath = join(SRC_DIR, 'actions.js');
  const src = readOrNull(actionsPath);
  if (!src) return { mcp: [], mp: [], rawCount: 0 };

  const lines = src.split('\n');
  const stubs = [];

  for (const line of lines) {
    const msgMatch = line.match(/\(\s*_a\s*,\s*_p\s*\)\s*=>\s*'([^']+)'/);
    if (!msgMatch) continue;
    const keyMatch = line.match(/^\s*['"]?([-\w]+)['"]?\s*:/);
    if (!keyMatch) continue;
    stubs.push({ key: keyMatch[1], msg: msgMatch[1] });
  }

  const mcpNames = new Set([
    'listIssues', 'listPullRequests', 'search', 'getDocumentation',
    'getSchema', 'getPaymentFlow', 'getEmailTemplate', 'searchRepositories',
  ]);

  const mcp = [];
  const mp = [];
  const seenMCP = new Set();
  const seenMP = new Set();

  for (const { key, msg } of stubs) {
    if (mcpNames.has(key)) {
      if (!seenMCP.has(key)) { seenMCP.add(key); mcp.push({ key, msg }); }
    } else {
      const base = key.replace(/^mp-?/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      if (!seenMP.has(base)) { seenMP.add(base); mp.push({ key, msg }); }
    }
  }

  return { mcp, mp, rawCount: stubs.length };
}

// ═══════════════════════════════════════════════════
// Pass 2: CE action stub
// ═══════════════════════════════════════════════════
function detectCeStub() {
  const fcPath = join(SRC_DIR, 'handlers', 'flow-control.js');
  const src = readOrNull(fcPath);
  if (!src) return { isStub: false, ceActions: [], details: 'flow-control.js 不可读' };

  // Use next-export boundary extraction (same as P3) instead of brittle [^}]*
  const fnRe = /export function handleCeAction\s*\([^)]*\)\s*\{/;
  const fnMatch = fnRe.exec(src);
  if (!fnMatch) return { isStub: false, ceActions: [], details: '未找到 handleCeAction' };

  const braceIdx = src.indexOf('{', fnMatch.index + fnMatch[0].length - 1);
  if (braceIdx === -1) return { isStub: false, ceActions: [], details: '无法解析函数体' };

  const body = extractFunctionBody(src, braceIdx);
  const hasContextCheck = /context/.test(body);
  const hasExternalCall = /safeExec|execSync|fetch|spawn|exec\(|import\(|existsSync|writeFileSync|readFileSync/.test(body);

  return {
    isStub: !hasContextCheck && !hasExternalCall,
    ceActions: ['ce-compound', 'ce-plan', 'ce-review', 'ce-debug', 'ce-brainstorm', 'ce-work'],
    details: hasExternalCall ? '有外部调用' : hasContextCheck ? '已检查 context' : '无 context 检查 + 无外部调用 — 空转',
  };
}

// ═══════════════════════════════════════════════════
// Pass 3: logic-density scan — find all exported
// functions across handler files whose body does nothing
// beyond logging + static-string return.
// Uses next-function-boundary extraction (avoids brace matching).
// ═══════════════════════════════════════════════════

const MEANINGFUL_LINE = /\b(readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|statSync|appendFileSync|writeSync|rmSync)\b|safeExec\b|\bexecSync\b|\bspawn\b|\bfetch\b|\.(map|filter|reduce|forEach|find|sort|some|every|flatMap)\s*\(|\bfor\s*\(|\bwhile\s*\(|\bif\s*\(|\btry\s*\{|await\s+\w+\(|import\s*\(|\bnew\s+\w+|JSON\.(parse|stringify)\b|\.(match|replace|split|join)\s*\(|\breturn\s+[^'"`\d]|Object\.(keys|values|entries|assign)\s*\(|\bprocess\.(chdir|cwd|env\.)|\brequire\s*\(|return\s+\w+\s*\(/;

function isTrivialLine(line) {
  const s = line.trim();
  if (!s) return true;
  if (s.startsWith('//')) return true;
  if (s === '{' || s === '}') return true;
  if (/^console\.(log|warn|error|info|debug|trace|dir|table)\s*\(/.test(s)) return true;
  if (/^chalk\.\w+\s*\(/.test(s)) return true;
  if (/^return\s+(['"`][^'"`]*['"`]|\d+|true|false|null|undefined)\s*;?$/.test(s)) return true;
  return false;
}

function extractFunctionBody(src, startIndex) {
  // Find the end: next 'export function' at top level, or end of file
  // This avoids complex brace matching completely
  const nextExport = src.slice(startIndex + 1).search(/^export\s+(async\s+)?function\s+\w+/m);
  if (nextExport >= 0) {
    return src.slice(startIndex, startIndex + 1 + nextExport);
  }
  return src.slice(startIndex);
}

function detectPseudoStubs() {
  const handlersDir = join(SRC_DIR, 'handlers');
  if (!existsSync(handlersDir)) return { stubs: [], total: 0 };

  const allStubs = [];
  let totalFuncs = 0;

  const files = readdirSync(handlersDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const src = readOrNull(join(handlersDir, file));
    if (!src) continue;

    const funcRe = /^export\s+(async\s+)?function\s+(\w+)\s*\(/gm;
    let m;
    while ((m = funcRe.exec(src)) !== null) {
      const funcName = m[2];
      totalFuncs++;

      const braceIdx = src.indexOf('{', m.index + m[0].length);
      if (braceIdx === -1) continue;

      const body = extractFunctionBody(src, braceIdx);
      const lines = body.split('\n');
      let meaningful = 0;
      for (const line of lines) {
        if (!isTrivialLine(line) && MEANINGFUL_LINE.test(line)) {
          meaningful++;
        }
      }

      if (meaningful < 1) {
        allStubs.push({ name: funcName, file, snippet: body.replace(/[\r\n]/g, ' ').trim().slice(0, 140) });
      }
    }
  }

  return { stubs: allStubs, total: totalFuncs };
}

// ═══════════════════════════════════════════════════
// Pass 4: external tool health check
// ═══════════════════════════════════════════════════
const TOOL_CHECKS = {
  // ── Core security tools ──
  noleak: { check: 'npx noleak --version 2>&1 || echo NOT_FOUND', type: 'security' },
  'seraphim-audit': { check: 'pip show seraphim-audit 2>&1 || echo NOT_FOUND', type: 'security' },

  skillspector: { check: 'pip show skillspector 2>&1 || echo NOT_FOUND', type: 'security' },
  // ── Quality tools ──
  lychee: { check: 'lychee --version 2>&1 || echo NOT_FOUND', type: 'quality' },
  knip: { check: 'npx knip --version 2>&1 || echo NOT_FOUND', type: 'quality' },
  'deprecated-deps': { check: 'npm --version 2>&1 || echo NOT_FOUND', type: 'quality' },
  'lighthouse-ci': { check: 'npx @lhci/cli --version 2>&1 || echo NOT_FOUND', type: 'quality' },
  clearible: { check: 'npx clearible --version 2>&1 || echo NOT_FOUND', type: 'quality' },
  // ── Accessibility ──
  'pa11y-ci': { check: 'npx pa11y-ci --version 2>&1 || echo NOT_FOUND', type: 'a11y' },
  // ── Regex security ──
  'recheck-cli': { check: 'npx recheck-cli --version 2>&1 || echo NOT_FOUND', type: 'security' },
  // ── Mobile (需要额外运行时: Java/Ruby) ──
  mobsfscan: { check: 'pip show mobsfscan 2>&1 || echo NOT_FOUND', type: 'mobile', optional: true },
  dependencycheck: { check: 'npx dependency-check --version 2>&1 || echo NOT_FOUND', type: 'mobile', optional: true },
};

function detectToolHealth() {
  const results = { available: [], missing: [], optional_missing: [], errors: [] };
  for (const [name, { check, type, optional }] of Object.entries(TOOL_CHECKS)) {
    try {
      const result = safeExec(check, SRC_DIR, { stdio: 'pipe', timeout: 15000 }).toString();
      if (result.includes('NOT_FOUND')) {
        if (optional) results.optional_missing.push({ name, type });
        else results.missing.push({ name, type });
      } else {
        results.available.push({ name, type, version: result.trim().split('\n', 1)[0].slice(0, 60) });
      }
    } catch {
      if (optional) results.optional_missing.push({ name, type });
      else results.missing.push({ name, type });
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════
// Pass 5: npm dependency health (oss-health-scan)
// ═══════════════════════════════════════════════════
function detectDepHealth(targetPath) {
  if (!existsSync(join(targetPath, 'package.json'))) return { skipped: true, reason: '无 package.json' };
  try {
    const raw = safeExec('npx oss-health-scan --threshold 40 --json', targetPath, {
      stdio: 'pipe', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    }).toString();
    const json = JSON.parse(raw);
    const results = json.results || [];
    return {
      skipped: false, scanned: json.scanned || 0,
      critical: results.filter(r => r.deprecated || r.risk_level === 'critical')
        .map(r => ({ name: r.name, score: r.health_score, reason: r.deprecated ? `废弃: ${r.deprecatedMsg || '无说明'}` : `健康评分 ${r.health_score}` })),
      warning: results.filter(r => !r.deprecated && r.risk_level === 'warning')
        .map(r => ({ name: r.name, score: r.health_score, lastPublish: r.lastPublish })),
      healthy: results.filter(r => !r.deprecated && r.risk_level !== 'critical' && r.risk_level !== 'warning').length,
    };
  } catch (e) {
    return { skipped: true, reason: e.message.slice(0, 120) };
  }
}

// ═══════════════════════════════════════════════════
// Pass 6: CE plugin availability
// ═══════════════════════════════════════════════════
function checkCePlugin(_targetPath) {
  // CE plugin lives at project root .claude/, not necessarily at targetPath
  return existsSync(join(PROJECT_ROOT, '.claude', 'plugins', 'compound-engineering.json'));
}

// ═══════════════════════════════════════════════════
// Pass 7: knip — AST-level dead code + import resolution
// Falls back to regex import check if knip unavailable
// ═══════════════════════════════════════════════════
function detectImportIssues(_targetPath) {
  // Always run knip from claude-scene/ which has proper knip config
  const knipRoot = join(SRC_DIR, '..');
  try {
    const raw = safeExec('npx knip --reporter json', knipRoot, {
      stdio: 'pipe', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    }).toString();
    return parseKnipOutput(raw);
  } catch (e) {
    // knip exits 1 when it finds issues — check stdout for JSON
    if (e.stdout) {
      try { return parseKnipOutput(e.stdout.toString()); } catch { /* fall through */ }
    }
    // Fallback: regex-based import check
    return detectImportIssuesFallback();
  }
}

function parseKnipOutput(raw) {
  const data = JSON.parse(raw);
  const issues = data.issues || [];
  let unusedFiles = 0;
  const unusedExports = [], unresolved = [], unlisted = [], unusedDeps = [];

  for (const issue of issues) {
    if (issue.files) unusedFiles += issue.files.length;
    if (issue.exports) unusedExports.push(...issue.exports.map(e => ({ file: issue.file, symbol: e.name || JSON.stringify(e) })));
    if (issue.unresolved) unresolved.push(...issue.unresolved.map(u => ({ file: issue.file, target: u.name || JSON.stringify(u) })));
    if (issue.unlisted) unlisted.push(...issue.unlisted.map(u => ({ file: issue.file, name: u.name || JSON.stringify(u) })));
    if (issue.dependencies) unusedDeps.push(...issue.dependencies.map(d => ({ name: d.name || JSON.stringify(d) })));
  }

  return { knip: true, unusedFiles, unusedExports, unresolved, unlisted, unusedDeps, ok: !unresolved.length && !unlisted.length };
}

// Fallback when knip unavailable: regex import check limited to actions.js
function detectImportIssuesFallback() {
  const actionsPath = join(SRC_DIR, 'actions.js');
  const src = readOrNull(actionsPath);
  if (!src) return { knip: false, broken: [], missing: [], summary: 'actions.js 不可读' };

  const brokenExports = [];
  const missingFiles = [];
  const importRe = /import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
    const rawPath = m[2];
    if (!rawPath.startsWith('.')) continue;
    const resolved = join(dirname(actionsPath), rawPath);
    const fileSrc = readOrNull(resolved);
    if (!fileSrc) { missingFiles.push({ file: rawPath, imported: names.join(', ') }); continue; }
    for (const name of names) {
      const isExported = new RegExp(
        `export\\s+(async\\s+)?function\\s+${name}\\b|` +
        `export\\s+(const|let|var)\\s+${name}\\b|` +
        `export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`
      ).test(fileSrc);
      if (!isExported) brokenExports.push({ file: rawPath, missing_export: name });
    }
  }
  return { knip: false, broken: brokenExports, missing: missingFiles, ok: !brokenExports.length && !missingFiles.length };
}

// ═══════════════════════════════════════════════════
// Pass 8: scene-to-registry cross-reference — verify
// every action referenced in scene JSON exists in
// ACTION_REGISTRY or is a ce-* prefixed action
// ═══════════════════════════════════════════════════
function detectOrphanActions() {
  const actionsPath = join(SRC_DIR, 'actions.js');
  const src = readOrNull(actionsPath);
  if (!src) return { orphans: [], sceneCount: 0, summary: 'actions.js 不可读' };

  const registryKeys = new Set();
  // Match all property keys in ACTION_REGISTRY object literal
  const keyRe = /^\s*['"]?([-\w]+)['"]?\s*:/gm;
  // Find the ACTION_REGISTRY block
  const registryMatch = src.match(/const ACTION_REGISTRY\s*=\s*\{([\s\S]*?)\n\};/);
  if (registryMatch) {
    const block = registryMatch[1];
    let km;
    while ((km = keyRe.exec(block)) !== null) {
      registryKeys.add(km[1]);
    }
  }

  // Also include ce-* prefix (handled by dispatch bypass)
  const ceActions = new Set(['ce-compound', 'ce-plan', 'ce-review', 'ce-debug', 'ce-brainstorm', 'ce-work']);

  const scenesDir = join(PROJECT_ROOT, '.claude', 'scenes');
  if (!existsSync(scenesDir)) return { orphans: [], sceneCount: 0, summary: 'scenes 目录不存在' };

  const orphans = [];
  let sceneCount = 0;
  const sceneFiles = readdirSync(scenesDir).filter(f => f.endsWith('.json'));

  for (const f of sceneFiles) {
    try {
      const scene = JSON.parse(readFileSync(join(scenesDir, f), 'utf-8'));
      const flow = scene.flow || [];
      sceneCount++;
      for (const step of flow) {
        const action = step.action;
        if (!action) continue;
        if (registryKeys.has(action)) continue;
        if (action.startsWith('ce-') && ceActions.has(action)) continue;
        orphans.push({ scene: scene.scene_id || f, step: step.step, action });
      }
    } catch { /* corrupt JSON, skip */ }
  }

  return { orphans, sceneCount, ok: orphans.length === 0 };
}

// ═══════════════════════════════════════════════════
// Pass 9: handler static safety — verify each handler
// function body is non-trivial (not just console.log)
// Static-only to avoid triggering workflow side effects
// ═══════════════════════════════════════════════════
function detectHandlerCrashes() {
  const actionsPath = join(SRC_DIR, 'actions.js');
  const src = readOrNull(actionsPath);
  if (!src) return { crashes: [], summary: 'actions.js 不可读' };

  const handlerToModule = new Map();
  const importRe = /import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
    const modPath = m[2];
    if (!modPath.startsWith('.')) continue;
    for (const name of names) {
      handlerToModule.set(name, join(dirname(actionsPath), modPath));
    }
  }

  // Find registry entries mapping action→handler
  const regMatch = src.match(/const ACTION_REGISTRY\s*=\s*\{([\s\S]*?)\n\};/);
  const crashes = [];
  if (!regMatch) return { crashes, summary: '未找到 ACTION_REGISTRY' };

  const block = regMatch[1];
  const entryRe = /^\s*['"]?([-\w]+)['"]?\s*:\s*(\w+)/gm;
  let em;
  const testedHandlers = new Set();

  // Skip handlers already covered by Pass 3 (pseudo-stub detection)
  const pseudoStubs = new Set(['handleReviewFull', 'handleVerifyVisual', 'handleAiFriendlyReview']);

  while ((em = entryRe.exec(block)) !== null) {
    const handlerName = em[2];
    if (!handlerToModule.has(handlerName)) continue; // inline stub
    if (testedHandlers.has(handlerName)) continue;
    if (pseudoStubs.has(handlerName)) continue; // covered by Pass 3
    testedHandlers.add(handlerName);

    const modPath = handlerToModule.get(handlerName);
    const modSrc = readOrNull(modPath);
    if (!modSrc) {
      crashes.push({ handler: handlerName, file: modPath.replace(SRC_DIR, '.'), error: '模块文件不可读' });
      continue;
    }

    // Check: function is exported (directly or via barrel re-export)
    const isDirectExport = new RegExp(`export\\s+(async\\s+)?function\\s+${handlerName}\\b`).test(modSrc);
    const isBarrelExport = new RegExp(`export\\s*\\{[^}]*\\b${handlerName}\\b[^}]*\\}\\s*from\\s*'([^']+)'`).test(modSrc);
    if (!isDirectExport && !isBarrelExport) {
      crashes.push({ handler: handlerName, file: modPath.replace(SRC_DIR, '.'), error: '未找到导出函数' });
      continue;
    }

    // Only analyze body for directly-exported functions, skip barrel re-exports
    if (!isDirectExport) continue;

    // Check: function body is non-trivial (more than just print+return)
    const fnBodyMatch = modSrc.match(new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${handlerName}\\s*\\([^)]*\\)\\s*\\{([^}]*(?:\\{[^}]*\\}[^}]*)*)\\}`, 's'
    ));
    if (!fnBodyMatch) continue; // Can't parse, skip

    const body = fnBodyMatch[1];
    const code = body
      .replace(/console\.(log|warn|error|info|debug)\s*\([^)]*\)/g, '')
      .replace(/chalk\.\w+\s*\([^)]*\)/g, '')
      .replace(/return\s+['"`][^'"`]*['"`]\s*;?/g, '')
      .replace(/\s+/g, '')
      .trim();

    if (code.length < 5) {
      crashes.push({ handler: handlerName, file: modPath.replace(SRC_DIR, '.'), error: '函数体过于简单(疑似空转)' });
    }
  }

  return { crashes, ok: crashes.length === 0, tested: testedHandlers.size };
}

// ═══════════════════════════════════════════════════
// Pass 10: MCP config validation
// ═══════════════════════════════════════════════════
function detectMcpIssues(_targetPath) {
  const mcpPath = join(PROJECT_ROOT, '.claude', 'mcp.json');
  if (!existsSync(mcpPath)) return { errors: [], warnings: [], infos: [], summary: 'mcp.json 不存在', total: 0, okCount: 0, ok: true };

  let config;
  try {
    config = JSON.parse(readFileSync(mcpPath, 'utf-8'));
  } catch (e) {
    return { errors: [{ server: 'mcp.json', issue: `JSON 解析失败: ${e.message}` }], warnings: [], infos: [], ok: false, total: 0, okCount: 0 };
  }

  const servers = config.mcpServers || {};
  const errors = [];
  const warnings = [];
  const infos = [];
  let okCount = 0;

  for (const [name, cfg] of Object.entries(servers)) {
    const serverErrors = [];
    const serverWarnings = [];
    const serverInfos = [];

    if (!cfg.command) {
      serverErrors.push('缺少 command 字段');
    } else {
      // Check local file references in args (these are real errors)
      if (cfg.args && Array.isArray(cfg.args)) {
        for (const arg of cfg.args) {
          if (typeof arg === 'string' && arg.startsWith('./')) {
            const absPath = join(PROJECT_ROOT, arg);
            if (!existsSync(absPath)) {
              serverErrors.push(`本地文件不存在: ${arg}`);
            }
          }
        }
      }

      // Command existence check — warning only (Docker might not be running, etc.)
      if (!cfg.args || cfg.args.every(a => !(typeof a === 'string' && a.startsWith('./')))) {
        try {
          safeExec(`${cfg.command} --version 2>&1 || echo PATH_MISSING`, SRC_DIR, { stdio: 'pipe', timeout: 10000 });
        } catch {
          // npx/Docker/gem commands may fail for env reasons — warning not error
          serverWarnings.push(`命令 '${cfg.command}' 不可用（可能未安装或未运行）`);
        }
      }
    }

    // Env var checks — informational only (API keys are optional)
    if (cfg.env) {
      for (const envVal of Object.values(cfg.env)) {
        const envName = typeof envVal === 'string' ? envVal.replace(/^\$\{env:/, '').replace(/\}$/, '') : '';
        if (envName && !process.env[envName]) {
          serverInfos.push(`环境变量未设置: ${envName} (API Key 未配置)`);
        }
      }
    }

    if (serverErrors.length) {
      errors.push({ server: name, issues: serverErrors });
      if (serverWarnings.length) warnings.push({ server: name, issues: serverWarnings });
      if (serverInfos.length) infos.push({ server: name, issues: serverInfos });
    } else if (serverWarnings.length) {
      warnings.push({ server: name, issues: serverWarnings });
      if (serverInfos.length) infos.push({ server: name, issues: serverInfos });
    } else if (serverInfos.length) {
      infos.push({ server: name, issues: serverInfos });
    } else {
      okCount++;
    }
  }

  const issueCount = errors.length + warnings.length;
  return { errors, warnings, infos, ok: errors.length === 0, total: Object.keys(servers).length, okCount, issueCount };
}

// ═══════════════════════════════════════════════════
// Pass runners — each runs + prints a group of related passes
// ═══════════════════════════════════════════════════

function runStubDetection() {
  const { mcp, mp, rawCount } = detectInlineStubs();
  const ce = detectCeStub();
  const { stubs: pseudoStubs, total: totalHandlerFuncs } = detectPseudoStubs();
  const handlerFileCount = readdirSync(join(SRC_DIR, 'handlers')).filter(f => f.endsWith('.js')).length;

  if (mcp.length || mp.length) {
    console.log(chalk.yellow(`  📋 Pass 1 — 内联桩: ${rawCount} 原始 (${mcp.length} MCP + ${mp.length} MP 去重)`));
    for (const s of mcp) console.log(chalk.dim(`     ${s.key}`));
    for (const s of mp) console.log(chalk.dim(`     ${s.key}`));
  } else {
    console.log(chalk.green('  ✅ Pass 1 — 内联桩: 无'));
  }

  if (ce.isStub) {
    console.log(chalk.yellow(`  🟡 Pass 2 — CE 空转: ${ce.ceActions.join(', ')}`));
  } else {
    console.log(chalk.green('  ✅ Pass 2 — CE 分发: 正常'));
  }

  if (pseudoStubs.length) {
    console.log(chalk.yellow(`  🟡 Pass 3 — 逻辑密度: ${pseudoStubs.length}/${totalHandlerFuncs} 个函数疑似空转 (扫描 ${handlerFileCount} 文件)`));
    for (const s of pseudoStubs.slice(0, 6)) console.log(chalk.dim(`     ${s.name} @ ${s.file}`));
    if (pseudoStubs.length > 6) console.log(chalk.dim(`     ... 还有 ${pseudoStubs.length - 6} 个`));
  } else {
    console.log(chalk.green(`  ✅ Pass 3 — 逻辑密度: ${totalHandlerFuncs} 个函数全部通过`));
  }

  return {
    catA: mcp.length + mp.length,
    catB: ce.isStub ? 1 : 0,
    catC: pseudoStubs.length,
  };
}

function runToolAndDepHealth(targetPath) {
  const toolHealth = detectToolHealth();
  const missCount = toolHealth.missing.length;
  const optMissCount = toolHealth.optional_missing.length;
  const availCount = toolHealth.available.length;

  if (missCount) {
    console.error(chalk.dim(`     缺失: ${toolHealth.missing.map(t => t.name).join(', ')}`));
  }
  if (optMissCount) {
    console.log(chalk.dim(`     可选缺失: ${toolHealth.optional_missing.map(t => t.name).join(', ')}`));
  }

  const depHealth = detectDepHealth(targetPath);
  let criticalDeps = 0;
  let warnDeps = 0;
  if (depHealth.skipped) {
    console.log(chalk.dim(`  ⏭ Pass 5 — 依赖健康: ${depHealth.reason}`));
  } else if (depHealth.critical.length || depHealth.warning.length) {
    criticalDeps = depHealth.critical.length;
    warnDeps = depHealth.warning.length;
    console.log(chalk.yellow(`  ⚠ Pass 5 — 依赖健康: ${depHealth.scanned} 包, ${criticalDeps}严重 ${warnDeps}警告`));
    for (const d of depHealth.critical) console.log(chalk.yellow(`     🔴 ${d.name}: ${d.reason}`));
  } else {
    console.log(chalk.green(`  ✅ Pass 5 — 依赖健康: ${depHealth.scanned} 包全部健康`));
  }

  return { missCount, availCount, criticalDeps, warnDeps };
}

function runProjectHealth(targetPath) {
  const ceAvailable = checkCePlugin(targetPath);
  if (ceAvailable) {
    console.log(chalk.green('  ✅ Pass 6 — CE Plugin: 已安装'));
  } else {
    console.log(chalk.yellow('  ⚠ Pass 6 — CE Plugin: 未安装'));
  }

  const importIssues = detectImportIssues(targetPath);
  let importBroken = 0;
  let unusedFilesCount = 0;
  let unusedDepsCount = 0;
  let knipUnresolved = 0;
  let knipUnlisted = 0;
  let isDeadCodePassed = true;

  if (importIssues.knip) {
    const { unusedExports, unresolved, unlisted, unusedDeps, unusedFiles } = importIssues;
    importBroken = unresolved.length + unlisted.length + unusedExports.length;
    unusedFilesCount = unusedFiles;
    unusedDepsCount = unusedDeps.length;
    knipUnresolved = unresolved.length;
    knipUnlisted = unlisted.length;
    const hasIssues = unresolved.length || unlisted.length || unusedExports.length;
    if (hasIssues) {
      console.log(chalk.yellow(`  ⚠ Pass 7 — knip: ${unresolved.length}未解析 ${unlisted.length}未声明 ${unusedExports.length}未用导出 ${unusedDeps.length}未用依赖 ${unusedFiles}死文件`));
      for (const u of unresolved.slice(0, 4)) console.log(chalk.yellow(`     🔴 ${u.target} ← ${u.file}`));
      for (const u of unlisted.slice(0, 3)) console.log(chalk.yellow(`     🟡 ${u.name} (在 ${u.file} 中使用但未声明)`));
      for (const u of unusedExports.slice(0, 3)) console.log(chalk.dim(`     ⬜ ${u.symbol} @ ${u.file}`));
      if (importBroken > 7) console.log(chalk.dim(`     ... 共 ${importBroken} 项`));
    } else {
      console.log(chalk.green(`  ✅ Pass 7 — knip: 0未解析 0未声明 (${unusedFiles}死文件 ${unusedDeps.length}未用依赖)`));
    }
    isDeadCodePassed = importBroken === 0 && unusedDepsCount === 0;
  } else if (importIssues.ok) {
    console.log(chalk.green('  ✅ Pass 7 — 导入链: 全部有效'));
  } else {
    if (importIssues.missing && importIssues.missing.length) {
      console.error(chalk.red(`  🔴 Pass 7 — 缺失文件: ${importIssues.missing.length}`));
      for (const i of importIssues.missing) console.error(chalk.dim(`     ${i.file}: ${i.imported}`));
    }
    if (importIssues.broken && importIssues.broken.length) {
      console.log(chalk.red(`  🔴 Pass 7 — 导出断裂: ${importIssues.broken.length}`));
      for (const i of importIssues.broken) console.log(chalk.dim(`     ${i.file}: ${i.missing_export}`));
    }
    importBroken = (importIssues.missing ? importIssues.missing.length : 0) + (importIssues.broken ? importIssues.broken.length : 0);
    isDeadCodePassed = importBroken === 0;
  }

  const { orphans, sceneCount, ok: orphanOk } = detectOrphanActions();
  const orphanCount = orphans.length;
  if (orphanOk) {
    console.log(chalk.green(`  ✅ Pass 8 — 场景引用: ${sceneCount} 场景全部有效`));
  } else if (orphanCount) {
    for (const o of orphans.slice(0, 8)) {
      console.log(chalk.dim(`     ${o.scene}:${o.step} → ${o.action} (不存在)`));
    }
  }

  return { ceAvailable, importBroken, unusedFilesCount, unusedDepsCount, knipUnresolved, knipUnlisted, deadCodePassed: isDeadCodePassed, orphanCount };
}

function runSafetyChecks(targetPath) {
  const smoke = detectHandlerCrashes();
  const crashCount = smoke.crashes ? smoke.crashes.length : 0;
  if (smoke.ok) {
    console.log(chalk.green(`  ✅ Pass 9 — Handler 冒烟: ${smoke.tested} 个全部通过`));
  } else if (crashCount) {
    for (const c of smoke.crashes.slice(0, 5)) {
      console.error(chalk.dim(`     ${c.handler} @ ${c.file}: ${c.error}`));
    }
  }

  const mcpConfig = detectMcpIssues(targetPath);
  const mcpIssueCount = mcpConfig.issueCount || 0;
  if (mcpConfig.total === 0) {
    console.log(chalk.dim(`  ⏭ Pass 10 — MCP 配置: ${mcpConfig.summary || '无配置'}`));
  } else if (mcpConfig.ok) {
    if (mcpConfig.infos.length) {
      for (const s of mcpConfig.infos) console.log(chalk.dim(`     ℹ ${s.server}: ${s.issues.join('; ')}`));
    }
  } else {
    const parts = [];
    if (mcpConfig.errors.length) parts.push(`${mcpConfig.errors.length} 错误`);
    if (mcpConfig.warnings.length) parts.push(`${mcpConfig.warnings.length} 警告`);
    if (mcpConfig.infos.length) parts.push(`${mcpConfig.infos.length} 信息`);
  }

  return { crashCount, mcpIssueCount };
}

function computeAndStore(stubs, tools, project, safety, targetPath, context) {
  const handlerStubs = stubs.catA + stubs.catB + stubs.catC;
  const totalIssues = handlerStubs + tools.missCount + tools.criticalDeps
    + (project.ceAvailable ? 0 : 1) + project.importBroken + project.unusedDepsCount
    + project.orphanCount + safety.crashCount + safety.mcpIssueCount;

  if (totalIssues === 0) {
    console.log(chalk.green('\n  🎉 全部 10 道检查通过！'));
  } else {
    console.log(chalk.yellow(`\n  ⚠ 共 ${totalIssues} 个问题待处理`));
  }

  if (context) {
    context.handlerVerificationComplete = true;
    context.handlerVerificationStubCount = handlerStubs;
    context.handlerVerificationTotalIssues = totalIssues;
    context.toolHealthResult = { available: tools.availCount, missing: tools.missCount, optionalMissing: 0, required: 0 };
    context.depHealthResult = { critical: tools.criticalDeps, warning: tools.warnDeps };
    context.importIssues = project.importBroken;
    context.orphanActions = project.orphanCount;
    context.handlerCrashes = safety.crashCount;
    context.mcpIssues = safety.mcpIssueCount;
    context.cePluginAvailable = project.ceAvailable;
    context.knipUnusedFiles = project.unusedFilesCount;
    context.knipUnusedDeps = project.unusedDepsCount;
    context.knipUnresolved = project.knipUnresolved;
    context.knipUnlisted = project.knipUnlisted;
    context.deadCodePassed = project.deadCodePassed;
  }

  return totalIssues;
}

// ═══════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════
export function handleVerifyHandlers(_action, _params, targetPath, context) {
  const stubs = runStubDetection();
  const tools = runToolAndDepHealth(targetPath);
  const project = runProjectHealth(targetPath);
  const safety = runSafetyChecks(targetPath);

  const totalIssues = computeAndStore(stubs, tools, project, safety, targetPath, context);

  return `10 道检查完成: ${totalIssues} 个问题`;
}
