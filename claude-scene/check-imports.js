import { readFileSync } from 'node:fs';

const files = [
  'src/actions.js', 'src/index.js', 'src/ui-polish.js', 'src/commands/start.js',
  'src/commands/list.js', 'src/commands/show.js', 'src/commands/fork.js',
  'src/handlers/code-analysis.js', 'src/handlers/testing.js', 'src/handlers/design.js',
  'src/handlers/git.js', 'src/handlers/issues.js', 'src/handlers/quality.js',
  'src/handlers/review.js', 'src/handlers/ui-tools.js', 'src/handlers/memory.js',
  'src/handlers/deps.js',
  'src/handlers/memory/claude-mem.js', 'src/handlers/memory/agentmemory.js',
  'src/handlers/memory/nexo.js', 'src/handlers/memory/codegraph.js',
  'src/handlers/memory/project-memory.js',
];

for (const f of files) {
  try {
    const content = readFileSync(f, 'utf8');
    const importMatch = [...content.matchAll(/import\s+\{([^}\n]{1,500})\}\s+from\s+['"]([^'"\n]{1,200})['"]/g)];
    for (const m of importMatch) {
      const names = m[1].split(',').map(n => {
        const parts = n.trim().split(/[ \t]{1,4}as[ \t]{1,4}/);
        return { alias: (parts[1] || parts[0]).trim() };
      });
      for (const { alias } of names) {
        const restContent = content.replace(m[0], '');
        const escaped = alias.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        // Bounded by literal escaped name; no backtracking risk.
        const regex = new RegExp(`\\b${escaped}\\b`, 'g');
        const count = (restContent.match(regex) || []).length;
        if (count === 0) {
          console.log(`${f}: UNUSED import "${alias}"`);
        }
      }
    }
  } catch (error) { console.error(f, error.message); }
}
