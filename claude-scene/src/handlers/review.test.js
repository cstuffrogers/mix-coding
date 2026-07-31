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
