import { describe, it, expect, vi } from 'vitest';
import { runDiagnostic } from './review.js';

// 对话模式开关：交接类步骤在「对话里跑」和「CLI 里跑」是两条完全不同的路径，
// 以前对话路径返回裸字符串「就绪」→ 被文案启发式判成 pass。
const conv = vi.hoisted(() => ({ on: false }));
vi.mock('../lib/platform.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isConversationMode: () => conv.on };
});

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

/**
 * 交接类步骤在对话模式下不执行任何东西 —— 它只是把活交给 agent。
 * 这一类以前返回裸字符串「…就绪（对话模式 …）」→ deriveStepStatus 判 pass，
 * 汇总里于是有 2 步「审查/视觉验证」根本没跑却算通过。
 */
describe('对话模式下的交接步骤不是 pass', () => {
  it('handleReviewFull → noop（引擎没查任何东西）', async () => {
    const { handleReviewFull } = await import('./review.js');
    conv.on = true;
    const r = handleReviewFull('reviewFull', {}, process.cwd());
    conv.on = false;
    expect(r.status).toBe('noop');
    expect(r.message).toContain('不计为通过');
  });

  it('handleVerifyVisual → noop', async () => {
    const { handleVerifyVisual } = await import('./review.js');
    conv.on = true;
    const r = handleVerifyVisual('verifyVisual', {}, process.cwd());
    conv.on = false;
    expect(r.status).toBe('noop');
    expect(r.message).toContain('Playwright');
    expect(r.message).toContain('不计为通过');
  });

  it('CLI 模式下走真实分支：没有 package.json → skip（不是交接 noop）', async () => {
    const { handleVerifyVisual } = await import('./review.js');
    const { mkdtempSync, rmSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = mkdtempSync(join(tmpdir(), 'mix-review-conv-'));
    conv.on = false;
    try {
      const r = handleVerifyVisual('verifyVisual', {}, dir);
      expect(r.status).toBe('skip');
      expect(r.message).toContain('package.json');
      expect(JSON.stringify(r)).not.toContain('交给对话模式');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
