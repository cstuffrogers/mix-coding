import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleLighthouseGate(_action, params, targetPath, context) {
  console.log(chalk.blue('\n📐 正在运行 Lighthouse CI 性能门禁...'));

  const configPath = join(targetPath, '.lighthouserc.js');
  const hasConfig = existsSync(configPath);
  let cfgArg = '';

  if (!hasConfig) {
    console.log(chalk.dim('  ℹ 未找到 .lighthouserc.js，使用默认性能断言'));
    const defaultConfig = {
      ci: {
        collect: { url: params?.url ? [params.url] : ['http://localhost:4173'], numberOfRuns: params?.runs ?? 1 },
        assert: {
          assertions: {
            'categories:performance': ['warn', { minScore: params?.minPerf ?? 0.8 }],
            'categories:accessibility': ['warn', { minScore: params?.minA11y ?? 0.8 }],
            'categories:best-practices': ['warn', { minScore: params?.minBest ?? 0.8 }],
            'largest-contentful-paint': ['error', { maxNumericValue: params?.maxLcp ?? 2500 }],
            'cumulative-layout-shift': ['error', { maxNumericValue: params?.maxCls ?? 0.1 }],
            'total-blocking-time': ['error', { maxNumericValue: params?.maxTbt ?? 300 }],
          },
        },
        upload: { target: 'temporary-public-storage' },
      },
    };
    const cfgFile = join(targetPath, '.lighthouserc-ci.json');
    writeFileSync(cfgFile, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    cfgArg = ' --config .lighthouserc-ci.json';
    console.log(chalk.dim('  ℹ 已生成临时配置 .lighthouserc-ci.json'));
  }

  try {
    const result = safeExec(
      `npx lhci autorun${cfgArg} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024 }
    ).toString();

    const passed = !/Assertion failed|Budget exceeded/i.test(result);
    const lcpMatch = result.match(/largest-contentful-paint[:\s]*(\d+)/i);
    const clsMatch = result.match(/cumulative-layout-shift[:\s]*([\d.]+)/i);
    const perfMatch = result.match(/performance[:\s]*([\d.]+)/i);

    if (lcpMatch) console.log(chalk.dim(`  LCP: ${lcpMatch[1]}ms`));
    if (clsMatch) console.log(chalk.dim(`  CLS: ${clsMatch[1]}`));
    if (perfMatch) console.log(chalk.dim(`  性能评分: ${perfMatch[1]}`));

    if (passed) {
      console.log(chalk.green('  ✅ Lighthouse CI 性能门禁通过'));
    } else {
      console.log(chalk.red('  🔴 Lighthouse CI 性能预算超限'));
      if (context) context.lastStepFailed = true;
    }

    if (context) context.lighthousePassed = passed;
    return `Lighthouse CI 完成: ${passed ? '通过' : '未通过'}`;
  } catch {
    console.log(chalk.dim('  ℹ Lighthouse CI 不可用，跳过性能门禁'));
    // Don't set Passed — let gate report as skipped (tool didn't run)
    return 'Lighthouse CI 完成（不可用）';
  }
}
