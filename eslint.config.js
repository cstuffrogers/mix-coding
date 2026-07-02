import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";

const IGNORED_DIRS = [
  "**/node_modules/**",
  "**/coverage/**",
  "**/dist/**",
  ".huashu-extract/**",
  "assets/huashu/**",
  ".claude/skills/impeccable/**",
  ".specify/**",
  "**/*.umd.js",
  "**/*.min.js",
  ".claude/",
  ".codex/",
  ".zcode/",
  ".opencode/",
  ".github/",
  ".husky/",
  "open-design/**",
  "scripts/**",
  ".mcp/**",
];

export default [
  { ignores: IGNORED_DIRS },
  js.configs.recommended,
  sonarjs.configs.recommended,
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-undef": "warn",
      "sonarjs/no-nested-template-literals": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/os-command": "off",
      "sonarjs/no-os-command-from-path": "off",
      "sonarjs/no-ignored-exceptions": "off",
    },
  },
];
