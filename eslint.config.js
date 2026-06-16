import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.mcp/*/dist/',
      '.mcp/*/build/',
      'coverage/',
      // Subprojects with their own ESLint configs
      'open-design/',
      'codegraph-win32-x64/',
      '.codegraph/',
      'ecc/',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-prototype-builtins': 'error',
    },
  },
];
