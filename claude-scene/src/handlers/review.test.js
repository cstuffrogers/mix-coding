import { describe, it, expect } from 'vitest';
import { runDiagnostic } from './review.js';

describe('runDiagnostic', () => {
  it('returns stdout for a succeeding command', () => {
    // A portable command that prints to stdout on both bash and node cross-platform.
    const out = runDiagnostic('node -e "process.stdout.write(\'ok\')"', process.cwd());
    expect(out).toContain('ok');
  });

  it('returns captured stdout/stderr for a non-zero exit instead of throwing', () => {
    // Prints to stderr then exits 1 — execSync throws, runDiagnostic must recover.
    const out = runDiagnostic('node -e "process.stderr.write(\'boom\'); process.exit(1)"', process.cwd());
    expect(out).toContain('boom');
  });

  it('recovers from a failing command instead of throwing', () => {
    // Non-zero exit / missing binary: runDiagnostic must not throw; it returns
    // captured output (which may include the shell's "not found" message on Windows).
    const out = runDiagnostic('definitely-not-a-real-binary-xyz123', process.cwd());
    expect(typeof out).toBe('string');
    expect(() => out).not.toThrow();
  });
});

describe('审查报告里的不安全默认值候选', () => {
  async function runWith(context) {
    const { handleGenerateReviewReport } = await import('./review.js');
    const { mkdtempSync, readFileSync, readdirSync, rmSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = mkdtempSync(join(tmpdir(), 'revrep-'));
    try {
      await handleGenerateReviewReport(null, {}, dir, context);
      const reviewsDir = join(dir, '.claude', 'reviews');
      const file = readdirSync(reviewsDir).find((f) => f.endsWith('.md'));
      return readFileSync(join(reviewsDir, file), 'utf-8');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('有候选时写出候选清单，并标明需逐条证伪', async () => {
    const report = await runWith({
      insecureDefaultsCandidates: [
        { file: 'src/app.js', line: 2, categories: ['fallback-secrets'], snippet: "const K = 'x'" },
      ],
    });
    expect(report).toContain('不安全默认值候选');
    expect(report).toContain('需逐条证伪');
    expect(report).toContain('src/app.js:2');
  });

  it('没有候选时不写这一节', async () => {
    const report = await runWith({});
    expect(report).not.toContain('不安全默认值候选');
  });
});
