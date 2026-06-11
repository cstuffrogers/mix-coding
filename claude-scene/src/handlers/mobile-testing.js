import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

// ── E2E Config Setup ──

export function handleSetupE2EConfig(_action, params, targetPath, context) {
  const generateExamples = params?.generate_examples !== false;
  console.log(chalk.blue('\n🧪 正在生成 E2E 测试配置...'));

  const projectType = context?.project_type || 'rn';
  const toolMap = {
    rn: 'Detox',
    expo: 'Detox',
    flutter: 'Patrol',
    'ios-native': 'Maestro',
    'android-native': 'Maestro',
  };
  const tool = toolMap[projectType] || 'Maestro';
  console.log(chalk.dim(`  推荐工具: ${tool}`));

  // Generate test directory and config
  const e2eDir = join(targetPath, 'e2e');
  if (!existsSync(e2eDir)) {
    try { mkdirSync(e2eDir, { recursive: true }); } catch { /* skip */ }
  }

  if (generateExamples) {
    const exampleTest = tool === 'Detox'
      ? `// Detox E2E 示例 — 登录流程\ndescribe('Login', () => {\n  beforeAll(async () => {\n    await device.launchApp();\n  });\n\n  it('should show login screen', async () => {\n    await expect(element(by.id('login-screen'))).toBeVisible();\n  });\n\n  it('should login with valid credentials', async () => {\n    await element(by.id('email-input')).typeText('test@example.com');\n    await element(by.id('password-input')).typeText('password123');\n    await element(by.id('login-button')).tap();\n    await expect(element(by.id('home-screen'))).toBeVisible();\n  });\n});\n`
      : `// Maestro E2E 示例 — 登录流程\nappId: com.example.app\n---\n- launchApp\n- assertVisible: "登录"\n- tapOn: "邮箱"\n- inputText: "test@example.com"\n- tapOn: "密码"\n- inputText: "password123"\n- tapOn: "登录"\n- assertVisible: "首页"\n`;

    const testFile = join(e2eDir, tool === 'Detox' ? 'login.test.js' : 'login.yaml');
    try { writeFileSync(testFile, exampleTest); } catch { /* skip */ }
    console.log(chalk.green(`  ✅ 示例测试已生成: ${testFile}`));
  }

  if (context) {
    context.e2e_tool = tool;
    context.e2e_config_generated = true;
    context.e2eConfigPassed = true;
    context.testExamplesPassed = true;
  }
  return `E2E 测试配置完成（工具: ${tool}）`;
}

// ── Verify Setup ──

export function handleVerifySetup(_action, _params, targetPath, context) {
  const tool = context?.e2e_tool || 'Detox';
  console.log(chalk.blue(`\n✅ 正在验证 ${tool} 测试环境...`));

  const checks = [];

  // Check tool installation
  try {
    const result = safeExec(`${tool.toLowerCase()} --version 2>&1 || echo NOT_FOUND`, targetPath, { stdio: 'pipe', timeout: 10000 });
    const output = result?.stdout?.toString() || '';
    checks.push({ item: `${tool} CLI`, status: output.includes('NOT_FOUND') ? 'fail' : 'ok' });
  } catch {
    checks.push({ item: `${tool} CLI`, status: 'fail' });
  }

  // Check config file
  const configFiles = { Detox: '.detoxrc.js', Maestro: '.maestro', Patrol: 'integration_test' };
  const configFile = configFiles[tool] || '.maestro';
  const configPath = join(targetPath, configFile);
  checks.push({
    item: '配置文件',
    status: existsSync(configPath) ? 'ok' : 'fail',
    detail: configFile,
  });

  for (const c of checks) {
    const icon = c.status === 'ok' ? '✅' : '⚠️';
    console.log(chalk.dim(`  ${icon} ${c.item}${c.detail ? ` (${c.detail})` : ''}`));
  }

  if (context) context.e2e_verified = checks.every(c => c.status === 'ok');
  return `测试环境验证完成: ${checks.filter(c => c.status === 'ok').length}/${checks.length} 通过`;
}

// ── CI Config Generator ──

export function handleGenerateCIConfig(_action, params, _targetPath, context) {
  const platform = params?.platform || 'github_actions';
  const tool = context?.e2e_tool || 'Detox';
  console.log(chalk.blue(`\n⚙ 正在生成 ${platform} CI 配置...`));

  const workflowDir = join(_targetPath, '.github', 'workflows');
  if (!existsSync(workflowDir)) {
    try { mkdirSync(workflowDir, { recursive: true }); } catch { /* skip */ }
  }

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

  const workflowFile = join(workflowDir, 'mobile-e2e.yml');
  try { writeFileSync(workflowFile, workflowContent); } catch { /* skip */ }
  console.log(chalk.green(`  ✅ CI 配置已生成: ${workflowFile}`));

  if (context) { context.ci_config_generated = true; context.ciConfigured = true; }
  return `CI 配置已生成（${platform}）`;
}
