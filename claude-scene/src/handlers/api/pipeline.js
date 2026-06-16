import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { safeExec } from '../../lib/safe-exec.js';
import { scanDir } from '../../lib/scan-dir.js';
import { normalizePath, matchEndpoint as specMatchEndpoint } from './spec-utils.js';

export function redoclyLint(specFile, targetPath) {
  try {
    const result = safeExec(`npx @redocly/cli lint "${specFile}" --format=stylish 2>&1 || true`, targetPath, { stdio: 'pipe' }).toString();
    const redoclyIssues = result.split('\n').filter(l =>
      /^\s*(error|warning|✗|⚠)/i.test(l.trim()) &&
      !/npm\s+(ERR|error|WARN)/i.test(l)
    );
    if (redoclyIssues.length > 0) {
      const errors = redoclyIssues.slice(0, 20).map(l => l.trim());
      return { passed: false, errors, output: result };
    }
    if (!/validating/i.test(result)) {
      return { passed: false, errors: ['Redocly CLI 未正确执行（可能未安装或输出格式不识别）'], output: result };
    }
    return { passed: true, errors: [], output: result };
  } catch {
    return { passed: false, errors: ['Redocly CLI 执行异常（可能未安装或目录不存在）'], output: '' };
  }
}

export function redoclyBundle(specFile, targetPath) {
  const outFile = join(targetPath, 'openapi.bundled.yaml');
  try {
    safeExec(`npx @redocly/cli bundle "${specFile}" -o "${outFile}" 2>&1 || true`, targetPath, { stdio: 'pipe' });
    if (existsSync(outFile)) return outFile;
    return null;
  } catch {
    return null;
  }
}

export function openapiTypeScript(specFile, targetPath) {
  const typesDir = join(targetPath, 'src', 'types');
  const outFile = join(typesDir, 'api-types.ts');
  try {
    if (!existsSync(typesDir)) mkdirSync(typesDir, { recursive: true });
    safeExec(`npx openapi-typescript "${specFile}" -o "${outFile}" 2>&1 || true`, targetPath, { stdio: 'pipe' });
    if (existsSync(outFile)) return { success: true, outputPath: 'src/types/api-types.ts' };
    return { success: false, outputPath: '' };
  } catch {
    return { success: false, outputPath: '' };
  }
}

export function runCrossReference(frontendCalls, serverEndpoints, issues, totalChecks) {
  if (frontendCalls.length === 0) return totalChecks;

  const methodIndex = new Map();
  for (const [key, ep] of serverEndpoints) {
    const norm = normalizePath(ep.path);
    if (!methodIndex.has(norm)) methodIndex.set(norm, []);
    methodIndex.get(norm).push({ key, method: ep.method, schemaFields: ep.schemaFields });
  }

  for (const call of frontendCalls) {
    totalChecks++;
    const matched = specMatchEndpoint(call, methodIndex);
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

  for (const [key, ep] of serverEndpoints) {
    totalChecks++;
    const matched = frontendCalls.some(c => {
      if (c.method !== ep.method) return false;
      const cNorm = normalizePath(c.path);
      const epNorm = normalizePath(ep.path);
      if (cNorm === epNorm) return true;
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

function segmentsMatch(template, concrete) {
  for (let i = 0; i < template.length; i++) {
    if (template[i].startsWith('{')) continue;
    if (template[i] !== concrete[i]) return false;
  }
  return true;
}

// Normalize path + matchEndpoint imported from spec-utils; segmentsMatch kept here for cross-reference

export function writeSkipReport(targetPath, context) {
  const report = buildSkipReport(targetPath);
  writeFileSync(join(targetPath, 'api-consistency-report.md'), report, 'utf-8');
  if (context) context.apiConsistencyScore = null;
}

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

export function calculateScore(lintResult, typesResult, issues) {
  let score = 100;
  if (lintResult && !lintResult.passed) score -= 20;
  if (typesResult && !typesResult.success) score -= 15;
  score -= issues.critical.length * 20;
  score -= issues.high.length * 5;
  return Math.max(0, score);
}

export function buildReport({ specFile, lintResult, typesResult, endpoints, schemas, frontendCalls, issues, totalChecks, score }) {
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
