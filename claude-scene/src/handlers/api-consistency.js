import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { findOpenApiSpec, loadSpec, extractEndpoints, extractSchemas } from './api/spec-utils.js';
import { findFrontendDir, detectFrontendApiCalls } from './api/frontend-detect.js';
import { redoclyLint, redoclyBundle, openapiTypeScript, runCrossReference, writeSkipReport, calculateScore, buildReport } from './api/pipeline.js';

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

  const lintResult = redoclyLint(specFile, targetPath);
  totalChecks++;
  if (!lintResult.passed) {
    lintResult.errors.forEach(e => issues.critical.push(`Redocly lint: ${e}`));
    console.log(chalk.red(`  ❌ Redocly lint: ${lintResult.errors.length} 个问题`));
  } else {
    console.log(chalk.green('  ✅ Redocly lint 通过'));
  }

  const bundledPath = redoclyBundle(specFile, targetPath);
  if (!bundledPath) {
    issues.high.push('Redocly bundle 失败，多文件规范可能未正确合并');
  } else {
    console.log(chalk.dim(`  📦 Bundle: ${bundledPath}`));
  }

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

  const typesResult = openapiTypeScript(specFileToUse, targetPath);
  totalChecks++;
  if (typesResult.success) {
    console.log(chalk.green(`  ✅ 类型文件: ${typesResult.outputPath}`));
  } else {
    issues.high.push('openapi-typescript 类型生成失败，前端编译时类型检查不可用');
    console.log(chalk.yellow('  ⚠ openapi-typescript 类型生成失败'));
  }

  const score = writeConsistencyReport(targetPath, specFile, lintResult, typesResult,
    { endpoints: serverEndpoints, schemas: serverSchemas }, frontendCalls, issues, totalChecks, context);

  if (issues.critical.length > 0) {
    console.log(chalk.red(`  ❌ 发现 ${issues.critical.length} 个 CRITICAL 不一致，${issues.high.length} 个 HIGH`));
  } else {
    console.log(chalk.green(`  ✅ 前后端 API 契约一致（评分: ${score}/100）`));
  }

  return `API一致性检查完成（评分: ${score}/100，Lint: ${lintResult.passed ? 'PASS' : 'FAIL'}，Types: ${typesResult.success ? 'OK' : 'FAIL'}，端点: ${serverEndpoints.size}）`;
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
