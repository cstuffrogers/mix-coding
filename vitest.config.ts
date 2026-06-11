import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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