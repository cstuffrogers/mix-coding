import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { safeExec } from '../lib/safe-exec.js';

// ── 工具/配置映射 ──

const TOOL_BY_PROJECT = {
  rn: 'Detox',
  expo: 'Detox',
  flutter: 'Patrol',
  'ios-native': 'Detox',
  'android-native': 'Detox',
};

/** Detox 的配置文件 / 示例用例路径；Patrol 用 integration_test 目录。 */
const ARTIFACTS = {
  Detox: { config: '.detoxrc.js', example: join('e2e', 'login.test.js') },
  Patrol: { config: 'integration_test', example: join('integration_test', 'app_test.dart') },
};

const DETOX_CONFIG = `/** Detox 配置（claude-scene mobile-e2e 生成，按项目实际情况调整） */
module.exports = {
  testRunner: { args: { config: 'e2e/jest.config.js', _: ['e2e'] } },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/App.app',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
    },
  },
  devices: {
    simulator: { type: 'ios.simulator', device: { type: 'iPhone 15' } },
    emulator: { type: 'android.emulator', device: { avdName: 'Pixel_7_API_34' } },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
  },
};
`;

const DETOX_EXAMPLE = `// Detox E2E 示例 — 登录流程（claude-scene 生成，选择器请按项目实际 id 调整）
describe('Login', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should show login screen', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
  });

  it('should login with valid credentials', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();
  });
});
`;

const PATROL_EXAMPLE = `// Patrol E2E 示例（claude-scene 生成，选择器请按项目实际调整）
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

void main() {
  patrolTest('登录流程', (PatrolIntegrationTestBase $) async {
    app.main();
    await $.pumpAndSettle();
    await $.enterText(find.byKey(const Key('email-input')), 'test@example.com');
    await $.enterText(find.byKey(const Key('password-input')), 'password123');
    await $.tap(find.byKey(const Key('login-button')));
    await $.pumpAndSettle();
    expect(find.byKey(const Key('home-screen')), findsOneWidget);
  });
}
`;

function toolFor(projectType) {
  return TOOL_BY_PROJECT[projectType] || 'Detox';
}

/** 写文件并如实返回结果，不吞异常。 */
function writeArtifact(targetPath, rel, content) {
  try {
    const full = join(targetPath, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
    return { ok: true, rel };
  } catch (e) {
    return { ok: false, rel, error: e.message };
  }
}

// ── E2E Config Setup ──

function ensureConfig(tool, targetPath) {
  const paths = ARTIFACTS[tool];
  const configPath = join(targetPath, paths.config);
  if (existsSync(configPath)) return [];
  // Patrol 没有独立配置文件，「配置」就是 integration_test/ 目录本身。
  if (tool === 'Patrol') {
    try { mkdirSync(configPath, { recursive: true }); return []; } catch (e) { return [{ ok: false, rel: paths.config, error: e.message }]; }
  }
  return [writeArtifact(targetPath, paths.config, DETOX_CONFIG)];
}

function setupMessage(tool, paths, { okConfig, okExample, isGenerateExamples }) {
  if (!okConfig) {
    return { status: 'warn', message: `E2E 配置未生成：${paths.config} 不存在（工具 ${tool}）` };
  }
  const parts = [`配置 ${paths.config}`];
  if (okExample) parts.push(`示例 ${paths.example}`);
  else if (!isGenerateExamples) parts.push('示例用例未生成（generate_examples: false）');
  else parts.push('示例用例缺失');
  return {
    status: okExample || !isGenerateExamples ? 'pass' : 'warn',
    message: `E2E 测试配置完成（工具: ${tool}）：${parts.join('，')}`,
  };
}

export function handleSetupE2EConfig(_action, params, targetPath, context) {
  const isGenerateExamples = params?.generate_examples !== false;
  const tool = toolFor(context?.project_type);
  const paths = ARTIFACTS[tool];

  // 配置文件是这一步的本体：以前只建了个 e2e/ 目录 + 示例，
  // 却写 e2e_config_generated / e2eConfigPassed = true，下一步 verifySetup
  // 去查 .detoxrc.js 必然失败 —— 自己先盖章再自己打脸。
  const results = ensureConfig(tool, targetPath);
  if (isGenerateExamples) {
    results.push(writeArtifact(targetPath, paths.example, tool === 'Patrol' ? PATROL_EXAMPLE : DETOX_EXAMPLE));
  }

  const okConfig = existsSync(join(targetPath, paths.config));
  const okExample = existsSync(join(targetPath, paths.example));
  const failed = results.filter((r) => !r.ok);

  if (context) {
    context.e2e_tool = tool;
    context.e2e_config_generated = okConfig;
    context.e2eConfigPassed = okConfig;
    // 没让生成示例时不能把一个「假」当失败发下去（那是假红），也不该记通过。
    context.testExamplesPassed = okExample ? true : (isGenerateExamples ? false : undefined);
    context.e2eConfigured = okConfig && okExample;
  }

  if (failed.length) {
    return {
      status: 'warn',
      message: `E2E 配置未完成（${tool}）：${failed.map((f) => `${f.rel}: ${f.error}`).join('; ')}`,
    };
  }
  return setupMessage(tool, paths, { okConfig, okExample, isGenerateExamples });
}

// ── Verify Setup ──

export function handleVerifySetup(_action, _params, targetPath, context) {
  const tool = context?.e2e_tool || 'Detox';
  const paths = ARTIFACTS[tool] || ARTIFACTS.Detox;

  const checks = [];

  try {
    const result = safeExec(`${tool.toLowerCase()} --version`, targetPath, { stdio: 'pipe', timeout: 10000 });
    const output = result?.stdout?.toString() || result?.toString() || '';
    checks.push({ item: `${tool} CLI`, status: output.trim() ? 'ok' : 'fail', detail: output.trim().slice(0, 60) });
  } catch (e) {
    const reason = String(e.message || '').split('\n')[0].slice(0, 80);
    checks.push({ item: `${tool} CLI`, status: 'fail', detail: `未安装或无法运行（${reason}）` });
  }

  // Patrol 的「配置」就是一个目录，不能拿文件存在性去判。
  const configPath = join(targetPath, paths.config);
  const configOk = tool === 'Patrol'
    ? existsSync(configPath) && existsSync(join(targetPath, paths.example))
    : existsSync(configPath);
  checks.push({ item: '配置文件', status: configOk ? 'ok' : 'fail', detail: paths.config });

  const passed = checks.filter((c) => c.status === 'ok').length;
  if (context) context.e2e_verified = passed === checks.length;
  if (context) context.setupConfigured = passed === checks.length;

  // 「0/2 通过」以前不含「失败」字样，会被记成 pass。
  if (passed < checks.length) {
    const bad = checks.filter((c) => c.status !== 'ok')
      .map((c) => `${c.item}${c.detail ? `（${c.detail}）` : ''}`).join('; ');
    return { status: 'fail', message: `测试环境验证未通过: ${passed}/${checks.length}（${bad}）` };
  }
  return `测试环境验证完成: ${passed}/${checks.length} 通过`;
}

// ── CI Config Generator ──

export function handleGenerateCIConfig(_action, params, targetPath, context) {
  const platform = params?.platform || 'github_actions';
  const tool = context?.e2e_tool || 'Detox';

  const workflowFile = join('.github', 'workflows', 'mobile-e2e.yml');
  const workflowContent = `name: Mobile E2E Tests
on:
  pull_request:
    paths:
      - 'src/**'
      - 'e2e/**'
      - 'package.json'
  push:
    branches: [main]

jobs:
  e2e-${tool.toLowerCase()}:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Run ${tool} Tests
        run: npx ${tool.toLowerCase()} test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-results
          path: artifacts/
`;

  const written = writeArtifact(targetPath, workflowFile, workflowContent);
  const ok = written.ok && existsSync(join(targetPath, workflowFile));

  if (context) {
    context.ci_config_generated = ok;
    context.ciConfigured = ok;
  }

  // 写失败以前照样 ciConfigured = true 并报「CI 配置已生成」。
  if (!ok) {
    return {
      status: 'warn',
      message: `CI 配置未生成：${workflowFile} 写入失败（${written.error || '文件未落盘'}）`,
    };
  }
  return `CI 配置已生成（${platform}）：${workflowFile}`;
}
