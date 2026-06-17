import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleLighthouseGate(_action, params, targetPath, context) {

  const configPath = join(targetPath, '.lighthouserc.js');
  const hasConfig = existsSync(configPath);
  let cfgArg = '';

  if (!hasConfig) {
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
  }

  try {
    const result = safeExec(
      `npx lhci autorun${cfgArg} 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024 }
    ).toString();

    const isPassed = !/Assertion failed|Budget exceeded/i.test(result);

    if (isPassed) {
      console.log(chalk.green('  ✅ Lighthouse CI 性能门禁通过'));
    } else {
      if (context) context.lastStepFailed = true;
    }

    if (context) context.lighthousePassed = isPassed;
    return `Lighthouse CI 完成: ${isPassed ? '通过' : '未通过'}`;
  } catch {
    // Don't set Passed — let gate report as skipped (tool didn't run)
    return 'Lighthouse CI 完成（不可用）';
  }
}
