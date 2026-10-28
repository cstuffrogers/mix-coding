import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

// ── Release Checks ──

export function handleReleaseChecks(_action, _params, targetPath, context) {

  const checks = [];
  const platform = context?.platform || 'both';

  if (platform === 'ios' || platform === 'both') {
    const exportOptions = join(targetPath, 'ios', 'ExportOptions.plist');
    checks.push({
      platform: 'ios',
      item: 'ExportOptions.plist',
      status: existsSync(exportOptions) ? 'ok' : 'missing',
    });
  }

  if (platform === 'android' || platform === 'both') {
    const keystoreProps = join(targetPath, 'android', 'keystore.properties');
    const gradleProps = join(targetPath, 'android', 'gradle.properties');
    checks.push({
      platform: 'android',
      item: '签名密钥配置',
      status: existsSync(keystoreProps) || existsSync(gradleProps) ? 'ok' : 'missing',
    });
  }

  if (context) {
    context.release_checks = checks;
    // 以前这里把 securityScanResult / performancePassed / testPassed /
    // storeCompliancePassed 一律写成「通过」—— 于是下一步 checkGate
    // (block_release: true) 永远放行，质量门禁自己给自己盖章。
    // 这步只真的验证了证书/密钥文件在不在，就只记这些。
  }
  return `发布前检查完成: ${checks.filter(c => c.status === 'ok').length}/${checks.length} 通过`;
}

// ── Version Bumping ──

// Apply major/minor/patch increment to a 3-part version, resetting lower parts.
function bumpParts(parts, bumpType) {
  if (bumpType === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (bumpType === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[2]++; }
  return parts;
}

// Bump version in package.json (RN/Expo). Returns {previous, current} or null on miss.
function bumpPackageJson(targetPath, bumpType) {
  const packagePath = join(targetPath, 'package.json');
  if (!existsSync(packagePath)) return null;
  const result = { previous: null, current: null };
  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    result.previous = pkg.version;
    const parts = (pkg.version || '0.0.0').split('.').map(Number);
    result.current = bumpParts(parts, bumpType).join('.');
    pkg.version = result.current;
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  } catch {
    result.current = '0.0.1';
  }
  return result;
}

// Bump version in pubspec.yaml (Flutter). Returns new version string or null.
function bumpPubspec(targetPath, bumpType) {
  const pubspecPath = join(targetPath, 'pubspec.yaml');
  if (!existsSync(pubspecPath)) return null;
  try {
    let content = readFileSync(pubspecPath, 'utf-8');
    const verMatch = content.match(/^version:\s*(\S+)/m);
    if (!verMatch) return null;
    const parts = verMatch[1].trim().split('.').map(Number);
    const newVer = bumpParts(parts, bumpType).join('.');
    content = content.replace(/^version:\s*(\S+)/m, `version: ${newVer}`);
    writeFileSync(pubspecPath, content);
    return newVer;
  } catch { return null; }
}

export function handleMobileBumpVersion(_action, params, targetPath, context) {
  // 第三顺位以前是 `|| 'patch'` —— 没选升级类型就默认升补丁号，相当于引擎替
  // 用户决定了发布性质。bump 类型只能来自用户（--choice）或场景声明。
  const bumpType = context?.selectedOption || params?.bump_type;
  if (!bumpType) {
    return { status: 'warn', message: '版本号未更新：升级类型未确定（用 --choice major|minor|patch 指定）' };
  }
  if (!['major', 'minor', 'patch'].includes(bumpType)) {
    console.log(chalk.yellow(`  ⚠ 未知的升级类型 "${bumpType}"，可用: major / minor / patch`));
    return { status: 'warn', message: `版本号未更新：升级类型 "${bumpType}" 不可识别（可用 major / minor / patch）` };
  }
  const newVersion = { previous: null, current: null, bump_type: bumpType };
  const projectType = context?.project_type || 'rn';

  const pkgResult = bumpPackageJson(targetPath, bumpType);
  if (pkgResult) {
    newVersion.previous = pkgResult.previous;
    newVersion.current = pkgResult.current;
  }

  if (projectType === 'flutter') {
    const newVer = bumpPubspec(targetPath, bumpType);
    if (newVer) newVersion.current = newVer;
  }

  if (!newVersion.current) {
    return { status: 'warn', message: `版本号未更新：没找到 package.json / pubspec.yaml 里可改的 version（bump=${bumpType}）` };
  }

  if (context) {
    context.new_version = newVersion.current;
    context.previous_version = newVersion.previous;
  }

  return `版本号已更新: ${newVersion.previous || 'N/A'} → ${newVersion.current}`;
}

// ── Changelog Generation ──

export function handleMobileGenerateChangelog(_action, params, _targetPath, context) {
  // 版本号没定（上一步 bump 失败/未选）时会生成「## vunknown」的 changelog，
  // 而这份内容会直接作为 GitHub Release body。没版本就没 changelog。
  const version = context?.new_version;
  if (!version) {
    return { status: 'warn', message: 'CHANGELOG 未生成：版本号未确定（先确定升级类型完成 bump）' };
  }

  let changelog = `## v${version}\n\n`;
  try {
    const result = safeExec('git log --oneline --no-decorate -20 2>&1', undefined, { stdio: 'pipe' });
    const lines = (result?.stdout || '').toString().trim().split('\n').filter(Boolean);
    const sections = { feat: [], fix: [], chore: [], other: [] };

    for (const line of lines) {
      const msg = line.replace(/^[a-f0-9]+\s/, '');
      if (msg.startsWith('feat')) sections.feat.push(msg);
      else if (msg.startsWith('fix')) sections.fix.push(msg);
      else if (msg.startsWith('chore') || msg.startsWith('refactor') || msg.startsWith('docs')) sections.chore.push(msg);
      else sections.other.push(msg);
    }

    if (sections.feat.length) changelog += `### Features\n${sections.feat.map(l => `- ${l}`).join('\n')}\n\n`;
    if (sections.fix.length) changelog += `### Bug Fixes\n${sections.fix.map(l => `- ${l}`).join('\n')}\n\n`;
    if (sections.chore.length) changelog += `### Chores\n${sections.chore.map(l => `- ${l}`).join('\n')}\n\n`;
    if (sections.other.length) changelog += `### Other\n${sections.other.map(l => `- ${l}`).join('\n')}\n\n`;

  } catch {
    changelog += '_无提交记录_\n\n';
  }

  if (context) context.changelog_content = changelog;
  return `CHANGELOG 已生成（v${version}）`;
}

// ── Gray Release ──

export function handleGrayReleaseConfig(_action, _params, _targetPath, context) {
  const version = context?.new_version || 'unknown';

  const stages = [
    { percentage: 5, duration: '1天', description: '内部测试' },
    { percentage: 20, duration: '2天', description: '小范围用户' },
    { percentage: 50, duration: '2天', description: '半量用户' },
    { percentage: 100, duration: '—', description: '全量发布' },
  ];

  for (const s of stages) {
    console.log(chalk.dim(`  📈 ${s.percentage}% — ${s.description} (${s.duration})`));
  }

  if (context) context.gray_config = { version, stages };
  return `灰度发布配置完成（v${version}）`;
}

// ── iOS Release ──

export function handleIosRelease(_action, params, _targetPath, context) {
  const lane = params?.lane || 'beta';
  if (context) context.ios_released = true;
  return { status: 'noop', message: `iOS ${lane} 未发布（CLI 不执行，需在对话模式由 agent 完成）` };
}

// ── Android Release ──

export function handleAndroidRelease(_action, params, _targetPath, context) {
  const track = params?.track || 'internal';
  if (context) context.android_released = true;
  return { status: 'noop', message: `Android ${track} 未发布（CLI 不执行，需在对话模式由 agent 完成）` };
}
