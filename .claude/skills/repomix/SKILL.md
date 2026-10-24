---
name: repomix
description: Pack a codebase into a single AI-friendly file (XML/Markdown) with directory tree and token stats. Use when you need to provide full codebase context to an LLM.
---

# Repomix

Pack your entire repository into a single file optimized for AI consumption.

## Usage

```bash
npx repomix [target] [--output <file>] [--style <xml|markdown>] [--include <patterns>] [--ignore <patterns>]
```

## Common Options

- `--output <file>`: Output file (default: repomix-output.xml)
- `--style <xml|markdown>`: Output format
- `--include <patterns>`: Include only matching files (glob)
- `--ignore <patterns>`: Exclude matching files (glob)
- `--remove-comments`: Strip comments
- `--remove-empty-lines`: Strip empty lines
- `--token-count`: Show token count estimate
- `--split-output <size>`: Split output into chunks

## Best Practices

1. Use `--include` to focus on relevant code (e.g., `src/**/*.js`)
2. Use `--ignore` to exclude tests, node_modules, build artifacts
3. Use `--style markdown` for readability in chat interfaces
4. Check token count — aim for < 100k tokens for best LLM performance

## Integration Points

- `/feature` step 1.5: Pack codebase before planning
- `/review` step 2.5: Pack codebase before analysis
- `/refactor` step 4.5: Pack target module before refactoring
