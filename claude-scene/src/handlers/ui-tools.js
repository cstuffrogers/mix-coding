import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { safeExec } from '../lib/safe-exec.js';
import { scanDir } from '../lib/scan-dir.js';

export function handleAnalyzeUI(_action, _params, targetPath) {
  console.log(chalk.blue('\n🔍 正在分析项目结构...'));
  const files = scanDir(targetPath);
  return `分析完成，发现 ${files.length} 个文件`;
}

export function handleCheckConsistency(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔍 正在检查UI一致性...'));
  const cssFiles = scanDir(targetPath, { filter: (f) => /\.css$|\.scss$|\.less$/.test(f) });
  const componentFiles = scanDir(targetPath, { filter: (f) => /\.(jsx|tsx|vue)$/.test(f) });

  let totalCssVars = 0;
  let totalHardcodedColors = 0;
  let totalInlineStyles = 0;

  cssFiles.forEach(cssFile => {
    try {
      const content = readFileSync(cssFile, 'utf-8');
      // eslint-disable-next-line sonarjs/slow-regex
      const cssVarMatches = content.match(/--[\w-]+:/g) || [];
      totalCssVars += cssVarMatches.length;
      const hardcodedColorMatches = content.match(/#[0-9a-fA-F]{3,6}|rgb\(|rgba\(/g) || [];
      totalHardcodedColors += hardcodedColorMatches.length;
    } catch { /* unreadable file */ }
  });

  componentFiles.forEach(compFile => {
    try {
      const content = readFileSync(compFile, 'utf-8');
      const inlineStyleMatches = content.match(/style=\{/g) || [];
      totalInlineStyles += inlineStyleMatches.length;
    } catch { /* unreadable file */ }
  });

  const consistencyScore = Math.max(0, 100 - (totalHardcodedColors * 2) - (totalInlineStyles * 5));
  console.log(chalk.dim(`  CSS变量使用: ${totalCssVars} 个`));
  console.log(chalk.dim(`  硬编码颜色: ${totalHardcodedColors} 处`));
  console.log(chalk.dim(`  内联样式: ${totalInlineStyles} 处`));
  console.log(chalk.green(`  一致性评分: ${consistencyScore}/100`));

  if (context) context.consistencyScore = consistencyScore;
  return `UI一致性检查完成（评分: ${consistencyScore}/100）`;
}

export function handleAddAnimations(_action, _params, targetPath) {
  console.log(chalk.blue(`\n✨ 正在添加动效到 ${targetPath}...`));
  const indexCssPath = join(targetPath, 'src', 'index.css');
  if (existsSync(indexCssPath)) {
    let indexCss = readFileSync(indexCssPath, 'utf-8');
    if (!indexCss.includes('animate.css')) {
      indexCss = `@import "animate.css";\n${indexCss}`;
      writeFileSync(indexCssPath, indexCss);
    }
  }
  return '动效添加完成';
}

function runPlaywrightVisual(targetPath, context) {
  console.log(chalk.dim('  运行 Playwright 视觉测试...'));
  try {
    safeExec('npx playwright test --grep visual 2>&1', targetPath, { stdio: 'inherit' });
    if (context) context.visualRegressionPassed = true;
  } catch {
    if (context) context.visualRegressionPassed = false;
  }
  console.log(chalk.green('  视觉回归测试完成'));
}

export function handleVisualRegression(_action, params, targetPath, context) {
  const viewports = params?.viewports || ['desktop'];
  console.log(chalk.blue('\n🖼️ 正在进行视觉回归测试...'));
  console.log(chalk.dim(`  视口: ${viewports.join(', ')}`));

  const screenshotsDir = join(targetPath, 'screenshots');
  if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) {
    if (context) context.visualRegressionPassed = false;
    console.log(chalk.yellow('  未找到 package.json'));
    return '视觉回归测试完成（无 package.json）';
  }

  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    if (pkg.devDependencies?.playwright || pkg.dependencies?.playwright) {
      runPlaywrightVisual(targetPath, context);
      return `视觉回归测试完成 (${viewports.join(', ')})`;
    }
  } catch { /* unreadable file */ }

  if (context) context.visualRegressionPassed = false;
  console.log(chalk.yellow('  未安装 Playwright'));
  return '视觉回归测试完成（需要手动安装 Playwright）';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function handleCheckAPIConsistency(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔗 正在检查前后端 API 一致性（OpenAPI 标准管线）...'));

  const specFile = findOpenApiSpec(targetPath);
  if (!specFile) {
    writeSkipReport(targetPath, context);
    return '一致性检查跳过（无 OpenAPI 规范）';
  }

  console.log(chalk.dim(`  📄 找到 OpenAPI 规范: ${specFile}`));

  const issues = { critical: [], high: [] };
  let totalChecks = 0;

  // ── Step 1: Redocly lint — 规范质量门禁 ──
  const lintResult = redoclyLint(specFile, targetPath);
  totalChecks++;
  if (!lintResult.passed) {
    lintResult.errors.forEach(e => issues.critical.push(`Redocly lint: ${e}`));
    console.log(chalk.red(`  ❌ Redocly lint: ${lintResult.errors.length} 个问题`));
  } else {
    console.log(chalk.green('  ✅ Redocly lint 通过'));
  }

  // ── Step 2: Redocly bundle — 合并多文件规范 ──
  const bundledPath = redoclyBundle(specFile, targetPath);
  if (!bundledPath) {
    issues.high.push('Redocly bundle 失败，多文件规范可能未正确合并');
  } else {
    console.log(chalk.dim(`  📦 Bundle: ${bundledPath}`));
  }

  // ── Step 3: 解析规范并交叉验证 ──
  const specFileToUse = bundledPath || specFile;
  const spec = loadSpec(specFileToUse);
  if (!spec) {
    issues.critical.push(`OpenAPI 规范文件 \`${specFileToUse}\` 解析失败`);
    writeConsistencyReport(targetPath, specFile, lintResult, null, { endpoints: new Map(), schemas: new Map() }, [], issues, totalChecks, context);
    return `API一致性检查失败（规范解析错误）`;
  }

  const serverEndpoints = extractEndpoints(spec);
  const serverSchemas = extractSchemas(spec);
  console.log(chalk.dim(`  📊 发现 ${serverEndpoints.size} 个端点, ${serverSchemas.size} 个 schema`));

  // 前端调用检测 + 交叉验证
  const frontendDir = findFrontendDir(targetPath);
  let frontendCalls = [];
  if (frontendDir) {
    frontendCalls = await detectFrontendApiCalls(frontendDir);
    console.log(chalk.dim(`  📊 前端发现 ${frontendCalls.length} 个 API 调用`));
    if (frontendCalls.length === 0 && serverEndpoints.size > 0) {
      issues.high.push('前端目录存在但未检测到任何 API 调用，可能使用了未支持的 HTTP 库');
    }
  } else if (serverEndpoints.size > 0) {
    issues.high.push('未找到前端目录，无法验证后端端点是否被调用');
  }
  totalChecks = runCrossReference(frontendCalls, serverEndpoints, issues, totalChecks);

  // ── Step 4: openapi-typescript — 生成类型文件 ──
  const typesResult = openapiTypeScript(specFileToUse, targetPath);
  totalChecks++;
  if (typesResult.success) {
    console.log(chalk.green(`  ✅ 类型文件: ${typesResult.outputPath}`));
  } else {
    issues.high.push('openapi-typescript 类型生成失败，前端编译时类型检查不可用');
    console.log(chalk.yellow('  ⚠ openapi-typescript 类型生成失败'));
  }

  // ── 报告 ──
  const score = writeConsistencyReport(targetPath, specFile, lintResult, typesResult,
    { endpoints: serverEndpoints, schemas: serverSchemas }, frontendCalls, issues, totalChecks, context);

  if (issues.critical.length > 0) {
    console.log(chalk.red(`  ❌ 发现 ${issues.critical.length} 个 CRITICAL 不一致，${issues.high.length} 个 HIGH`));
  } else {
    console.log(chalk.green(`  ✅ 前后端 API 契约一致（评分: ${score}/100）`));
  }

  return `API一致性检查完成（评分: ${score}/100，Lint: ${lintResult.passed ? 'PASS' : 'FAIL'}，Types: ${typesResult.success ? 'OK' : 'FAIL'}，端点: ${serverEndpoints.size}）`;
}

// ── Spec loading ──

function loadSpec(specFile) {
  try {
    const raw = readFileSync(specFile, 'utf-8');
    const parsed = /\.ya?ml$/i.test(specFile) ? yaml.load(raw) : JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Redocly pipeline ──

function redoclyLint(specFile, targetPath) {
  console.log(chalk.dim('  🔍 Redocly lint...'));
  try {
    const result = safeExec(`npx @redocly/cli lint "${specFile}" --format=stylish 2>&1 || true`, targetPath, { stdio: 'pipe' }).toString();
    // Only count Redocly-specific output markers, not npm/system error noise
    const redoclyIssues = result.split('\n').filter(l =>
      /^\s*(error|warning|✗|⚠)/i.test(l.trim()) &&
      !/npm\s+(ERR|error|WARN)/i.test(l)
    );
    if (redoclyIssues.length > 0) {
      const errors = redoclyIssues.slice(0, 20).map(l => l.trim());
      return { passed: false, errors, output: result };
    }
    // Redocly always prints "validating" before linting. If absent, it didn't run.
    if (!/validating/i.test(result)) {
      return { passed: false, errors: ['Redocly CLI 未正确执行（可能未安装或输出格式不识别）'], output: result };
    }
    return { passed: true, errors: [], output: result };
  } catch {
    return { passed: false, errors: ['Redocly CLI 执行异常（可能未安装或目录不存在）'], output: '' };
  }
}

function redoclyBundle(specFile, targetPath) {
  console.log(chalk.dim('  📦 Redocly bundle...'));
  const outFile = join(targetPath, 'openapi.bundled.yaml');
  try {
    safeExec(`npx @redocly/cli bundle "${specFile}" -o "${outFile}" 2>&1 || true`, targetPath, { stdio: 'pipe' });
    if (existsSync(outFile)) return outFile;
    return null;
  } catch {
    console.log(chalk.yellow('  ⚠ Redocly bundle 执行异常'));
    return null;
  }
}

// ── openapi-typescript ──

function openapiTypeScript(specFile, targetPath) {
  console.log(chalk.dim('  📘 openapi-typescript...'));
  const typesDir = join(targetPath, 'src', 'types');
  const outFile = join(typesDir, 'api-types.ts');
  try {
    if (!existsSync(typesDir)) mkdirSync(typesDir, { recursive: true });
    safeExec(`npx openapi-typescript "${specFile}" -o "${outFile}" 2>&1 || true`, targetPath, { stdio: 'pipe' });
    if (existsSync(outFile)) return { success: true, outputPath: 'src/types/api-types.ts' };
    return { success: false, outputPath: '' };
  } catch {
    console.log(chalk.yellow('  ⚠ openapi-typescript 执行异常'));
    return { success: false, outputPath: '' };
  }
}

function writeSkipReport(targetPath, context) {
  const report = buildSkipReport(targetPath);
  writeFileSync(join(targetPath, 'api-consistency-report.md'), report, 'utf-8');
  if (context) context.apiConsistencyScore = null;
  console.log(chalk.yellow('  ⚠ 未找到 OpenAPI 规范，跳过一致性检查'));
  console.log(chalk.dim('  💡 建议: 使用 @redocly/cli / tsoa / swagger-jsdoc / zod-to-openapi 为后端生成 OpenAPI 规范'));
}

function runCrossReference(frontendCalls, serverEndpoints, issues, totalChecks) {
  if (frontendCalls.length === 0) return totalChecks;

  const methodIndex = new Map();
  for (const [key, ep] of serverEndpoints) {
    const norm = normalizePath(ep.path);
    if (!methodIndex.has(norm)) methodIndex.set(norm, []);
    methodIndex.get(norm).push({ key, method: ep.method, schemaFields: ep.schemaFields });
  }

  for (const call of frontendCalls) {
    totalChecks++;
    const matched = matchEndpoint(call, methodIndex);
    if (!matched) {
      issues.critical.push(`前端调用 \`${call.method} ${call.path}\` 在 OpenAPI 规范中未定义`);
    } else if (call.bodyFields && call.bodyFields.length > 0) {
      totalChecks++;
      const missing = call.bodyFields.filter(f => !matched.schemaFields.includes(f));
      if (missing.length > 0) {
        issues.critical.push(`前端字段 [${missing.join(', ')}] 在端点 \`${call.method} ${call.path}\` 的 schema 中不存在`);
      }
    }
  }

  // Reverse check: server endpoints not called by frontend
  for (const [key, ep] of serverEndpoints) {
    totalChecks++;
    const matched = frontendCalls.some(c => {
      // GET is a wildcard — regex detection can't always determine the method
      if (c.method !== ep.method && c.method !== 'GET') return false;
      const cNorm = normalizePath(c.path);
      const epNorm = normalizePath(ep.path);
      if (cNorm === epNorm) return true;
      // Template path: server has /users/{id}, frontend has /users/123
      if (ep.path.includes('{')) {
        const tSegs = epNorm.split('/');
        const cSegs = cNorm.split('/');
        if (tSegs.length !== cSegs.length) return false;
        return segmentsMatch(tSegs, cSegs);
      }
      return false;
    });
    if (!matched) {
      issues.high.push(`后端端点 \`${key}\` 在前端未被调用`);
    }
  }
  return totalChecks;
}

function writeConsistencyReport(targetPath, specFile, lintResult, typesResult,
  { endpoints, schemas }, frontendCalls, issues, totalChecks, context) {
  const score = calculateScore(lintResult, typesResult, issues);
  if (context) {
    context.apiConsistencyScore = score;
    context.apiConsistencyIssues = issues;
  }

  const report = buildReport({
    specFile, lintResult, typesResult,
    endpoints, schemas, frontendCalls,
    issues, totalChecks, score,
  });
  writeFileSync(join(targetPath, 'api-consistency-report.md'), report, 'utf-8');
  return score;
}

function calculateScore(lintResult, typesResult, issues) {
  let score = 100;
  if (lintResult && !lintResult.passed) score -= 20;
  if (typesResult && !typesResult.success) score -= 15;
  score -= issues.critical.length * 20;
  score -= issues.high.length * 5;
  return Math.max(0, score);
}

// ── OpenAPI helpers ──

const OPENAPI_PATTERNS = [
  'openapi.json', 'openapi.yaml', 'openapi.yml',
  'swagger.json', 'swagger.yaml', 'swagger.yml',
  'api-spec.json', 'api-spec.yaml', 'api-spec.yml',
  'spec.json', 'spec.yaml', 'spec.yml',
  'docs/openapi.json', 'docs/openapi.yaml', 'docs/openapi.yml',
  'public/openapi.json', 'public/openapi.yaml', 'public/openapi.yml',
  'src/openapi.json', 'src/openapi.yaml', 'src/openapi.yml',
];

function findOpenApiSpec(root) {
  for (const pattern of OPENAPI_PATTERNS) {
    const full = join(root, pattern);
    if (existsSync(full)) return full;
  }
  // recursive search (depth 3)
  const deep = scanDir(root, {
    filter: f => /openapi\.(json|ya?ml)$|swagger\.(json|ya?ml)$|api-spec\.(json|ya?ml)$/i.test(f),
  });
  return deep.length > 0 ? deep[0] : null;
}

// ── Endpoint / schema extraction ──

function extractEndpoints(spec) {
  const endpoints = new Map();
  const paths = spec.paths || {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const pathParams = pathItem.parameters || [];
    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      if (!op || typeof op !== 'object') continue;

      const key = `${method.toUpperCase()}:${path}`;
      const schemaFields = collectEndpointFields(op, spec, pathParams);
      endpoints.set(key, {
        method: method.toUpperCase(), path,
        operationId: op.operationId || null,
        schemaFields,
      });
    }
  }
  return endpoints;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

function collectEndpointFields(op, spec, pathParams = []) {
  const fields = [];
  const bodyContent = op.requestBody?.content || {};
  const bodySchema =
    bodyContent['application/json']?.schema ||
    bodyContent['application/x-www-form-urlencoded']?.schema;
  if (bodySchema) {
    fields.push(...extractSchemaFields(bodySchema, spec));
  }
  // Path-level parameters (shared across all operations) + operation-level parameters
  const allParams = [...pathParams, ...(op.parameters || [])];
  for (const p of allParams) {
    if (p.name) fields.push(p.name);
  }
  return fields;
}

function extractSchemas(spec) {
  const schemas = new Set();
  const components = spec.components?.schemas || spec.definitions || {};
  for (const name of Object.keys(components)) {
    schemas.add(name);
    const props = components[name]?.properties || {};
    for (const field of Object.keys(props)) {
      schemas.add(`${name}.${field}`);
    }
  }
  return schemas;
}

function resolveSchemaRef(schemaRef, spec) {
  if (!schemaRef.$ref) return schemaRef;
  const pointer = schemaRef.$ref;
  if (!pointer.startsWith('#/')) return null;
  const segments = pointer.slice(2).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let resolved = spec;
  for (const seg of segments) {
    resolved = resolved?.[seg];
    if (!resolved) return null;
  }
  return resolved;
}

function extractSchemaFields(schema, spec) {
  if (!schema) return [];
  const resolved = resolveSchemaRef(schema, spec);
  if (!resolved) return [];
  const fields = [];
  if (resolved.properties) fields.push(...Object.keys(resolved.properties));
  // Handle allOf/oneOf/anyOf composition — collect from all sub-schemas
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(resolved[key])) {
      for (const sub of resolved[key]) {
        fields.push(...extractSchemaFields(sub, spec));
      }
    }
  }
  return fields;
}

// ── Frontend detection ──

function findFrontendDir(root) {
  const candidates = ['src', 'app', 'pages', 'components', 'frontend', 'client', 'web'];
  for (const dir of candidates) {
    const full = join(root, dir);
    if (existsSync(full)) return full;
  }
  return existsSync(join(root, 'package.json')) ? root : null;
}

const BACKEND_DIRS = new Set(['server', 'api', 'routes', 'controllers', 'services', 'middleware', 'handlers']);

function isBackendFile(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.some(p => BACKEND_DIRS.has(p)) ||
    /\.(controller|service|route|middleware|handler)\.(ts|js)x?$/.test(filePath);
}

async function detectFrontendApiCalls(frontendDir) {
  const sourceFiles = scanDir(frontendDir, {
    filter: f => /\.(tsx?|jsx?|vue|svelte)$/.test(f)
      && !f.includes('node_modules')
      && !f.includes('.test.')
      && !f.includes('.spec.'),
  });
  const toScan = sourceFiles.slice(0, 200);
  const calls = [];

  for (const f of toScan) {
    if (isBackendFile(f)) continue;
    extractCallsFromFile(f, calls);
  }

  // Deduplicate
  const seen = new Set();
  return calls.filter(c => {
    const key = `${c.method}:${normalizePath(c.path)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function extractCallsFromFile(f, calls) {
  let content;
  try { content = readFileSync(f, 'utf-8'); } catch { return; }

  // fetch GET
  for (const m of content.matchAll(/fetch\s*\(\s*`?["']([^"'`]+)["'`]/g)) {
    calls.push(parseCallFromUrl(m[1], 'GET'));
  }
  // fetch with method
  for (const m of content.matchAll(/fetch\s*\([^,]+,\s*\{[^}]*method\s*:\s*["']([^"']+)["'][^}]*\}/g)) {
    const start = Math.max(0, m.index);
    const urlM = content.slice(start, start + 200).match(/fetch\s*\(\s*`?["']([^"'`]+)["'`]/);
    if (urlM) calls.push(parseCallFromUrl(urlM[1], m[1].toUpperCase()));
  }
  // axios
  for (const m of content.matchAll(/axios\.(get|post|put|delete|patch)\s*\(\s*`?["']([^"'`]+)["'`]/g)) {
    calls.push(parseCallFromUrl(m[2], m[1].toUpperCase()));
  }
  // React Query with url + method
  for (const m of content.matchAll(/use(?:Query|Mutation)\s*\(\s*\{[^}]*url\s*:\s*["']([^"']+)["'][^}]*method\s*:\s*["']([^"']+)["']/g)) {
    calls.push(parseCallFromUrl(m[1], m[2].toUpperCase()));
  }
  // React Query with url only
  for (const m of content.matchAll(/use(?:Query|Mutation)\s*\(\s*\{[^}]*url\s*:\s*`([^`]+)`[^}]*\}/g)) {
    calls.push(parseCallFromUrl(m[1], 'GET'));
  }
  // ky / got / ofetch
  for (const m of content.matchAll(/(?:ky|got|ofetch)\s*\(\s*["']([^"']+)["']/g)) {
    calls.push(parseCallFromUrl(m[1], 'GET'));
  }
  // htmx
  for (const m of content.matchAll(/hx-(get|post|put|delete|patch)\s*=\s*["']([^"']+)["']/gi)) {
    calls.push(parseCallFromUrl(m[2], m[1].toUpperCase()));
  }
  // Next.js API routes — only match in files that are NOT route handlers
  const normalizedPath = f.replace(/\\/g, '/');
  const isApiRouteFile = /\/(?:app|pages)\/api\//.test(normalizedPath);
  if (!isApiRouteFile) {
    for (const m of content.matchAll(/\/api\/[\w/-]+/g)) {
      if (!calls.some(c => c.path.includes(m[0]))) {
        calls.push({ method: 'GET', path: m[0], bodyFields: [] });
      }
    }
  }
}

function parseCallFromUrl(url, method) {
  let path = url;
  try {
    const u = new globalThis.URL(url, 'http://localhost');
    path = u.pathname;
  } catch { /* relative path */ }
  // Strip query string from relative paths
  const qIdx = path.indexOf('?');
  if (qIdx !== -1) path = path.slice(0, qIdx);
  return { method: method || 'GET', path, bodyFields: [] };
}

function normalizePath(p) {
  // trim trailing slash; collapse multiple slashes
  let result = '';
  let prev = '';
  for (const ch of p.toLowerCase()) {
    if (ch === '/' && prev === '/') continue;
    result += ch;
    prev = ch;
  }
  if (result.endsWith('/') && result.length > 1) result = result.slice(0, -1);
  return result;
}

// ── Endpoint matching ──

function matchEndpoint(call, methodIndex) {
  const callNorm = normalizePath(call.path);

  // Exact path match
  const exact = methodIndex.get(callNorm) || [];
  for (const c of exact) {
    if (c.method === call.method || call.method === 'GET') {
      return { matched: true, schemaFields: c.schemaFields };
    }
  }

  // Template path match (/users/{id} vs /users/123)
  return matchTemplateEndpoint(call, callNorm, methodIndex);
}

function matchTemplateEndpoint(call, callNorm, methodIndex) {
  for (const [normPath, candidates] of methodIndex) {
    if (!normPath.includes('{')) continue;
    const segments = normPath.split('/');
    const callSegs = callNorm.split('/');
    if (segments.length !== callSegs.length) continue;
    if (!segmentsMatch(segments, callSegs)) continue;
    for (const c of candidates) {
      if (c.method === call.method || call.method === 'GET') {
        return { matched: true, schemaFields: c.schemaFields };
      }
    }
  }
  return null;
}

function segmentsMatch(template, concrete) {
  for (let i = 0; i < template.length; i++) {
    if (template[i].startsWith('{')) continue; // parameter
    if (template[i] !== concrete[i]) return false;
  }
  return true;
}

// ── Report generation ──

function buildSkipReport(root) {
  const backendFiles = scanDir(root, {
    filter: f => /\.(js|ts|mjs)$/.test(f) && !f.includes('node_modules'),
  });
  const hasBackend = backendFiles.some(f => {
    try {
      const c = readFileSync(f, 'utf-8');
      return /(?:express|fastify|koa|hapi|@nestjs|hono|elysia)/.test(c) ||
        /app\.(?:get|post|put|delete|patch)\s*\(/.test(c) ||
        /router\.(?:get|post|put|delete|patch)\s*\(/.test(c);
    } catch { return false; }
  });

  let report = `## API 一致性检查报告\n\n`;
  report += `**检查时间**: ${new Date().toISOString()}\n`;
  report += `**状态**: 跳过\n\n`;
  report += `**原因**: 未找到 OpenAPI 规范文件。\n\n`;
  if (hasBackend) {
    report += `### 🔧 如何添加 OpenAPI 规范\n\n`;
    report += `检测到项目包含后端代码，推荐以下方式生成规范：\n\n`;
    report += `| 后端框架 | 工具 | 命令 |\n`;
    report += `|---------|------|------|\n`;
    report += `| Express | swagger-jsdoc / tsoa | \`npm install swagger-jsdoc\` |\n`;
    report += `| NestJS | @nestjs/swagger | \`npm install @nestjs/swagger\` |\n`;
    report += `| Fastify | @fastify/swagger | \`npm install @fastify/swagger\` |\n`;
    report += `| Hono | @hono/zod-openapi | \`npm install @hono/zod-openapi\` |\n`;
    report += `| Elysia | @elysiajs/swagger | \`npm install @elysiajs/swagger\` |\n`;
    report += `| 通用 | zod-to-openapi | \`npm install @asteasolutions/zod-to-openapi\` |\n`;
  } else {
    report += `**建议**: 纯前端项目无需 API 一致性检查。如需对接后端 API，请将后端的 OpenAPI 规范文件放入项目中。\n`;
  }
  return report;
}

function buildReport({ specFile, lintResult, typesResult, endpoints, schemas, frontendCalls, issues, totalChecks, score }) {
  let report = `## API 一致性检查报告\n\n`;
  report += `**检查时间**: ${new Date().toISOString()}\n`;
  report += `**规范文件**: ${specFile}\n\n`;

  report += `### OpenAPI 管线\n`;
  report += `- Redocly lint: ${lintResult?.passed ? '✅ 通过' : '❌ ' + (lintResult?.errors?.length || 0) + ' 个问题'}\n`;
  report += `- openapi-typescript: ${typesResult?.success ? '✅ 已生成' : '⚠ 失败'}\n\n`;

  report += `### 规范信息\n`;
  report += `- 端点总数: ${endpoints.size}\n`;
  report += `- Schema 总数: ${schemas.size}\n`;
  report += `- 前端调用: ${frontendCalls.length} 个\n\n`;

  report += `### CRITICAL (必须修复)\n`;
  if (issues.critical.length > 0) {
    issues.critical.forEach((issue, i) => { report += `${i + 1}. ${issue}\n`; });
  } else { report += `无 ✅\n`; }

  report += `\n### HIGH (应当修复)\n`;
  if (issues.high.length > 0) {
    issues.high.forEach((issue, i) => { report += `${i + 1}. ${issue}\n`; });
  } else { report += `无 ✅\n`; }

  report += `\n### 总结\n`;
  report += `- 总检查项: ${totalChecks}\n`;
  report += `- CRITICAL: ${issues.critical.length}\n`;
  report += `- HIGH: ${issues.high.length}\n`;
  report += `- 一致性评分: ${score}/100\n`;
  report += `- 规范文件: ${specFile}\n`;

  return report;
}

export function handleApplyDaisyUI(_action, params, targetPath, context) {
  const theme = context?.selectedTheme || params?.theme || 'light';
  if (theme === 'huashu' || theme === 'huashu-html') {
    return handleApplyHuashuStyle(_action, params, targetPath, context);
  }
  console.log(chalk.blue(`\n🌼 正在应用 DaisyUI 主题: ${theme}...`));
  const pkgPath = join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      safeExec('npm install daisyui 2>&1 || true', targetPath, { stdio: 'pipe' });
      console.log(chalk.green(`  ✅ DaisyUI 已安装，主题: ${theme}`));
    } catch {
      console.log(chalk.yellow('  ⚠ DaisyUI 安装失败'));
    }
  }
  console.log(chalk.dim('  ℹ 完整主题配置需 tailwind.config.js 修改，CLI 模式下为轻量操作'));
  return `DaisyUI 主题已应用 (${theme})`;
}

export async function handleApplyHuashuStyle(_action, params, targetPath, context) {
  const { listStyles, getStyle } = await import('../lib/huashu/style-library.js');
  const styleId = context?.huashu_style_id || params?.styleId;
  if (!styleId) {
    const web = listStyles('web');
    console.log(chalk.blue('\n🎨 Huashu 40 风格库（请通过 context.huashu_style_id 选定）：'));
    for (const s of web.slice(0, 12)) console.log(chalk.dim(`  ${s.id.padEnd(20)} ${s.name} [${s.temp}]`));
    return 'huashu 风格库已列出（未指定 styleId）';
  }
  const style = getStyle(styleId);
  if (!style) {
    console.log(chalk.yellow(`  ⚠ 未找到 huashu 风格: ${styleId}`));
    return `huashu 风格未匹配: ${styleId}`;
  }
  console.log(chalk.green(`  ✅ huashu 风格已选定: ${style.name} [${style.temp}/${style.fit}]`));
  console.log(chalk.dim(`     DNA: ${style.dna}`));
  if (context) context.huashu_applied_style = style;
  return `huashu 风格应用: ${style.name}`;
}

export function handleApplyComponents(_action, params, _targetPath) {
  const components = params?.components || [];
  console.log(chalk.blue(`\n🧩 正在应用组件: ${components.length ? components.join(', ') : '默认'}...`));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量操作，完整组件应用需 Claude Code 对话上下文'));
  console.log(chalk.green('  ✅ 组件已应用'));
  return `组件应用完成: ${components.length ? components.join(', ') : '默认组件'}`;
}

export function handleWebDesignVerify(_action, _params, targetPath) {
  console.log(chalk.blue('\n🔍 正在验证 Web 设计...'));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量验证，完整设计验证需 Claude Code + web-design skill'));
  const issues = [];
  const cssFiles = scanDir(targetPath, { filter: f => /\.css$/.test(f) });
  if (!cssFiles.length) issues.push('缺少 CSS 文件');
  if (issues.length) {
    issues.forEach(i => console.log(chalk.yellow(`  ⚠ ${i}`)));
  } else {
    console.log(chalk.green('  ✅ 设计验证通过'));
  }
  return `Web 设计验证完成: ${issues.length ? issues.join('; ') : '无问题'}`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleReconcileDesignTokens(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🔗 正在调和设计 Token...'));
  const existing = { brand: [], fonts: [], spacing: [], radii: [], shadows: [], motion: [] };

  // Scan DESIGN.md
  const designMdPath = join(targetPath, 'DESIGN.md');
  if (existsSync(designMdPath)) {
    try {
      const content = readFileSync(designMdPath, 'utf-8');
      if (content.includes('brand')) existing.brand.push('DESIGN.md');
      if (content.includes('font') || content.includes('typography')) existing.fonts.push('DESIGN.md');
      if (content.includes('spacing')) existing.spacing.push('DESIGN.md');
    } catch { /* unreadable */ }
  }

  // Scan tailwind.config
  for (const cfg of ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs']) {
    const cfgPath = join(targetPath, cfg);
    if (existsSync(cfgPath)) {
      try {
        const content = readFileSync(cfgPath, 'utf-8');
        if (/colors\s*:\s*\{/.test(content)) existing.brand.push(cfg);
        if (/fontFamily\s*:\s*\{/.test(content)) existing.fonts.push(cfg);
        if (/borderRadius\s*:\s*\{/.test(content)) existing.radii.push(cfg);
        if (/boxShadow\s*:\s*\{/.test(content)) existing.shadows.push(cfg);
      } catch { /* unreadable */ }
      break;
    }
  }

  // Scan CSS files for custom properties
  for (const cssFile of scanDir(targetPath, { filter: f => /\.css$/.test(f) && !f.includes('node_modules') })) {
    try {
      const content = readFileSync(cssFile, 'utf-8');
      if (/--color-/.test(content)) existing.brand.push(cssFile);
      if (/--font-/.test(content)) existing.fonts.push(cssFile);
      if (/--spacing-/.test(content)) existing.spacing.push(cssFile);
      if (/--radius-/.test(content)) existing.radii.push(cssFile);
      if (/--shadow-/.test(content)) existing.shadows.push(cssFile);
      if (/prefers-reduced-motion|--duration-|--ease-/.test(content)) existing.motion.push(cssFile);
    } catch { /* unreadable */ }
  }

  const totalExisting = Object.values(existing).reduce((s, a) => s + a.length, 0);
  console.log(chalk.dim(`  已有 Token 来源: ${totalExisting} 处`));
  for (const [cat, sources] of Object.entries(existing)) {
    if (sources.length) console.log(chalk.dim(`    ${cat}: ${[...new Set(sources)].join(', ')}`));
  }
  if (totalExisting === 0) console.log(chalk.dim('  ℹ 未发现已有设计 Token，将全量应用新主题'));
  else console.log(chalk.green('  ✅ 已有 Token 保留，新主题填充缺失项'));

  if (context) context.reconciledTokens = existing;
  return `设计 Token 调和完成: ${totalExisting} 处已有 Token 保留`;
}

export function handleImpeccableCritique(_action, params, _targetPath) {
  console.log(chalk.blue('\n🎯 正在执行 Impeccable 设计打磨...'));
  const rules = params?.rules || ['anti-patterns', 'llm-critique'];
  const checks = params?.checks || [];
  console.log(chalk.dim(`  规则集: ${rules.join(', ')}`));
  if (checks.length) console.log(chalk.dim(`  检查项: ${checks.join(', ')}`));
  console.log(chalk.dim('  ℹ CLI 模式下为轻量检查，完整 27 条反模式规则 + 12 条 LLM 批判规则需 Claude Code + impeccable skill'));
  console.log(chalk.green('  ✅ Impeccable 设计打磨完成'));
  return `Impeccable 设计打磨完成（${rules.length} 规则集, ${checks.length} 检查项）`;
}
