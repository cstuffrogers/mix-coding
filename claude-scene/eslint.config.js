import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  {
    ignores: ["coverage/**", "node_modules/**", "dist/**"],
  },
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  unicorn.configs["flat/recommended"],
  sonarjs.configs.recommended,
  {
    // Globally disable rules that try to deep-parse plugin internals (fails on modern JS syntax)
    rules: {
      "import/namespace": "off",
      "import/default": "off",
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
    },
  },
  {
    files: ["src/**/*.js", "check-imports.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "unicorn/filename-case": "off",
      "unicorn/prefer-module": "off",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/prefer-node-protocol": "off",
      "unicorn/import-style": "off",
      "unicorn/prefer-export-from": "off",
      "unicorn/catch-error-name": "off",
      "unicorn/text-encoding-identifier-case": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/prefer-string-replace-all": "off",
      "unicorn/prefer-number-properties": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/switch-case-braces": "off",
      "unicorn/prefer-at": "off",
      "unicorn/prefer-string-raw": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/no-for-loop": "off",
      "unicorn/no-array-sort": "off",
      "unicorn/prefer-regexp-test": "off",
      "unicorn/no-nested-ternary": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/explicit-length-check": "off",
      "sonarjs/no-nested-template-literals": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/os-command": "off",
    },
  },
];
