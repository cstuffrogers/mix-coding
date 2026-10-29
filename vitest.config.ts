import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // 单条用例的超时预算。默认 5s 对「真的去起子进程」的用例偏紧：
    // handleGitLeaks / 全量 handler 冒烟 / property-test 侦察都会 spawn git、node、npm，
    // 在 Windows + 杀软 + 并行的环境里偶尔 5s 打出超时 —— 那是假红（拦住提交却查不出问题），
    // 和假绿一样糟。这里只调时间预算，不动任何断言。
    testTimeout: 15_000,
    include: ['claude-scene/src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: [
      'node_modules',
      '.mcp',
      'open-design',
      'Archon-dev',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
  },
});