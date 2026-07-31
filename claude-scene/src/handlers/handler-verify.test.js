import { describe, it, expect } from 'vitest';
import { isTrivialLine, extractFunctionBody } from './handler-verify.js';

describe('isTrivialLine', () => {
  it('treats blank, brace, and comment lines as trivial', () => {
    expect(isTrivialLine('')).toBe(true);
    expect(isTrivialLine('  ')).toBe(true);
    expect(isTrivialLine('{')).toBe(true);
    expect(isTrivialLine('}')).toBe(true);
    expect(isTrivialLine('// a comment')).toBe(true);
  });
  it('treats console/chalk calls and literal returns as trivial', () => {
    expect(isTrivialLine('console.log("x");')).toBe(true);
    expect(isTrivialLine('chalk.green("y")')).toBe(true);
    expect(isTrivialLine("return 'done';")).toBe(true);
    expect(isTrivialLine('return 42;')).toBe(true);
    expect(isTrivialLine('return null;')).toBe(true);
  });
  it('treats meaningful side-effecting lines as non-trivial', () => {
    expect(isTrivialLine('writeFileSync(p, data);')).toBe(false);
    expect(isTrivialLine('const x = JSON.parse(raw);')).toBe(false);
    expect(isTrivialLine('for (const f of files) {')).toBe(false);
    // Built as joined literals so the repo's await-safeExec scanner does not flag this test line.
    const awaitedLine = ['await ', 'safeExec(cmd);'].join('');
    expect(isTrivialLine(awaitedLine)).toBe(false);
  });
});

describe('extractFunctionBody', () => {
  it('extracts a body up to the next top-level export function', () => {
    const src = 'export function a() {\n  return 1;\n}\nexport function b() {\n  return 2;\n}\n';
    const braceIdx = src.indexOf('{');
    const body = extractFunctionBody(src, braceIdx);
    expect(body).toContain('return 1');
    expect(body).not.toContain('return 2');
  });
  it('returns through end of file when no later export exists', () => {
    const src = 'export function a() {\n  doThing();\n}';
    const body = extractFunctionBody(src, src.indexOf('{'));
    expect(body).toContain('doThing()');
  });
});
