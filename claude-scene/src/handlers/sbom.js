import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';
import { statusForFindings } from '../lib/finding-verdict.js';

const RESTRICTIVE_LICENSES = ['GPL', 'AGPL', 'LGPL', 'SSPL', 'BUSL', 'Elastic', 'CC BY-NC'];

function isRestrictive(license) {
  if (!license) return false;
  const upper = license.toUpperCase();
  return RESTRICTIVE_LICENSES.some((r) => upper.includes(r));
}

function parseLicenses(raw) {
  const result = [];
  try {
    const data = JSON.parse(raw);
    for (const [name, info] of Object.entries(data)) {
      const licenses = info.licenses || 'UNKNOWN';
      result.push({ name, version: info.version || '?', licenses, repository: info.repository || '', restrictive: isRestrictive(licenses) });
    }
  } catch { return []; }
  return result;
}

function runLicenseChecker(targetPath) {
  try {
    const stdout = safeExec('npx --yes license-checker --json', targetPath, { stdio: 'pipe', timeout: 60000 });
    return stdout.toString();
  } catch { return null; }
}

function runCycloneDX(targetPath) {
  try {
    safeExec('npx --yes @cyclonedx/cyclonedx-npm --output-file sbom.json', targetPath, { stdio: 'pipe', timeout: 60000 });
    const sbomPath = join(targetPath, 'sbom.json');
    if (existsSync(sbomPath)) return sbomPath;
    return null;
  } catch { return null; }
}

function generateManualSBOM(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  let pkg = {};
  if (existsSync(pkgPath)) {
    try { pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')); } catch { /* ignore */ }
  }
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    metadata: { component: { name: pkg.name || 'unknown', version: pkg.version || '0.0.0' } },
    components: [],
  };
}

function generateLicenseReport(deps) {
  const restrictive = deps.filter((d) => d.restrictive);
  let report = '# License Compliance Report\n\n';
  report += `Generated: ${new Date().toISOString().split('T', 1)[0]}\n`;
  report += `Total dependencies: ${deps.length}\n`;

  if (restrictive.length > 0) {
    report += `\n## Restrictive Licenses Found: ${restrictive.length}\n\n`;
    for (const d of restrictive) {
      report += `- **${d.name}@${d.version}**: ${d.licenses} — ${d.repository || 'no repository'}\n`;
    }
  } else {
    report += '\n## No Restrictive Licenses Found\n\nAll dependencies use permissive licenses.\n';
  }

  report += '\n## Full License Summary\n\n';
  const byLicense = {};
  for (const d of deps) {
    byLicense[d.licenses] = (byLicense[d.licenses] || 0) + 1;
  }
  for (const [lic, count] of Object.entries(byLicense).sort()) {
    report += `- ${lic}: ${count}\n`;
  }

  return report;
}

export function handleSetupSBOM(_action, _params, targetPath, context) {

  const pkgPath = join(targetPath, 'package.json');
  if (!existsSync(pkgPath)) {
    // 非 npm 项目 = 没生成过，不是「生成失败」。以前写 sbomGenerated = false
    // （门禁 sbom 读出差失败，假红）外加一个没人读的 sbomSkipped（负债）。
    return { status: 'skip', message: 'SBOM 跳过：非 npm 项目（没有 package.json，不是失败）' };
  }

  let dependencies = [];

  // License check
  const rawLicenses = runLicenseChecker(targetPath);
  if (rawLicenses) {
    dependencies = parseLicenses(rawLicenses);
  } else {
    console.log(chalk.yellow('  ⚠ license-checker 执行失败'));
  }

  // SBOM generation
  let sbomPath = runCycloneDX(targetPath);
  if (sbomPath) {
    console.log(chalk.green('  ✅ CycloneDX SBOM 已生成 (sbom.json)'));
  } else {
    try {
      const manualSbom = generateManualSBOM(targetPath);
      sbomPath = join(targetPath, 'sbom.json');
      writeFileSync(sbomPath, JSON.stringify(manualSbom, null, 2), 'utf-8');
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ 手动 SBOM 生成失败: ${e.message}`));
    }
  }

  // License report
  if (dependencies.length > 0) {
    const report = generateLicenseReport(dependencies);
    const reportPath = join(targetPath, 'license-report.md');
    try {
      writeFileSync(reportPath, report, 'utf-8');
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ 许可证报告生成失败: ${e.message}`));
    }
  }

  const restrictive = dependencies.filter((d) => d.restrictive);
  if (restrictive.length > 0) {
    console.log(chalk.yellow(`  ⚠ 发现 ${restrictive.length} 个限制性许可证: ${restrictive.map((d) => d.licenses).join(', ')}`));
  }

  if (context) {
    context.sbomGenerated = true;
    context.sbomPath = sbomPath;
    context.licenseIssuesFound = restrictive.length > 0;
    context.restrictiveLicenses = restrictive.map((d) => `${d.name}:${d.licenses}`);
  }

  return restrictive.length > 0
    ? {
        status: statusForFindings(restrictive.length),
        message: `SBOM 和许可证报告已生成: ${restrictive.length} 个限制性许可证（${restrictive.map((d) => d.licenses).join(', ')}）需人工确认`,
      }
    : 'SBOM 和许可证报告已生成';
}
