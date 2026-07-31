import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  return { default: { blue: noop, cyan: noop, green: noop, yellow: noop, red: noop, dim: noop } };
});

// Mock readCodeFiles so each test feeds synthetic file contents into the handler.
// stripCommentsAndStrings and CTRL_FLOW stay real — they are pure helpers we rely on.
let mockFiles = [];
vi.mock('../lib/code-analysis-utils.js', () => ({
  readCodeFiles: () => mockFiles,
  stripCommentsAndStrings: (code) => {
    // Minimal but faithful strip: drop single-line comments + single/double
    // quoted strings so god_object/long_method heuristics behave realistically.
    return code
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/'[^']*'/g, '""')
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '""');
  },
  CTRL_FLOW: new Set(['if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try', 'finally', 'return', 'throw', 'new', 'const', 'let', 'var']),
}));

import { handleDetectAntiPatterns } from './code-metrics.js';

function setFiles(files) {
  mockFiles = files.map((f) => (typeof f === 'string' ? { path: f, content: '' } : f));
}

describe('handleDetectAntiPatterns', () => {
  beforeEach(() => {
    mockFiles = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns zero findings on an empty src directory', () => {
    setFiles([]);
    const result = handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', {});
    expect(result).toBe('反模式检测完成: 0 个问题');
  });

  it('skips test files entirely (no god_object / long_method checks)', () => {
    // A huge test file that would normally trip god_object + long_method.
    const big = 'class Foo {\n' + '  m1() {}\n'.repeat(40) + '}\n';
    setFiles([{ path: '/proj/src/foo.test.js', content: big }]);
    const ctx = {};
    const result = handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
    expect(ctx.antiPatternFindings).toBe(0);
    expect(result).toBe('反模式检测完成: 0 个问题');
  });

  it('skips spec files', () => {
    const big = 'class Foo {\n' + '  m1() {}\n'.repeat(40) + '}\n';
    setFiles([{ path: '/proj/src/foo.spec.ts', content: big }]);
    const ctx = {};
    handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
    expect(ctx.antiPatternFindings).toBe(0);
  });

  describe('god_object', () => {
    it('flags a large file with many methods (>300 lines AND >5 methods)', () => {
      // methodsRe only matches methods at line start (no indent), so fixtures
      // use unindented signatures — that is what triggers the heuristic.
      const lines = ['class Foo {'];
      for (let i = 0; i < 40; i++) lines.push(`m${i}() {`);
      while (lines.length < 310) lines.push('x();');
      for (let i = 0; i < 40; i++) lines.push('}');
      setFiles([{ path: '/proj/src/big.js', content: lines.join('\n') }]);
      const ctx = {};
      const result = handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBeGreaterThanOrEqual(1);
      expect(result).toContain('反模式检测完成');
    });

    it('flags a file with very high method count (>30) even when short', () => {
      const lines = ['class Bar {'];
      for (let i = 0; i < 35; i++) lines.push(`m${i}() {}`);
      lines.push('}');
      setFiles([{ path: '/proj/src/many.js', content: lines.join('\n') }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBeGreaterThanOrEqual(1);
    });

    it('does NOT flag data/config files even with many methods', () => {
      const lines = ['class Data {'];
      for (let i = 0; i < 35; i++) lines.push(`m${i}() {}`);
      lines.push('}');
      setFiles([{ path: '/proj/src/config/constants.js', content: lines.join('\n') }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      // god_object exempt, no long_method bodies > 50, no dups >=3
      expect(ctx.antiPatternFindings).toBe(0);
    });

    it('does NOT flag a file without class/function declaration', () => {
      // No leading class/function — hasClassOrFunc is false.
      const lines = [];
      for (let i = 0; i < 35; i++) lines.push(`m${i}() {}`);
      while (lines.length < 310) lines.push('x();');
      setFiles([{ path: '/proj/src/plain.js', content: lines.join('\n') }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBe(0);
    });

    it('does NOT flag when method count is low and file is small', () => {
      const content = 'class Small {\na() {}\nb() {}\n}\n';
      setFiles([{ path: '/proj/src/small.js', content }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBe(0);
    });
  });

  describe('long_method', () => {
    it('flags a function longer than 50 lines', () => {
      const lines = ['function longFunc() {'];
      while (lines.length < 60) lines.push('  doSomething();');
      lines.push('}');
      setFiles([{ path: '/proj/src/long.js', content: lines.join('\n') }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBeGreaterThanOrEqual(1);
    });

    it('flags an arrow function longer than 50 lines', () => {
      const lines = ['const longArrow = (x) => {'];
      while (lines.length < 60) lines.push('  doSomething();');
      lines.push('};');
      setFiles([{ path: '/proj/src/arrow.js', content: lines.join('\n') }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBeGreaterThanOrEqual(1);
    });

    it('does NOT flag a short function', () => {
      const content = 'function short() {\n  return 1;\n}\n';
      setFiles([{ path: '/proj/src/short.js', content }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBe(0);
    });

    it('does not run long_method when pattern is excluded', () => {
      const lines = ['function longFunc() {'];
      while (lines.length < 60) lines.push('  doSomething();');
      lines.push('}');
      setFiles([{ path: '/proj/src/long.js', content: lines.join('\n') }]);
      const ctx = {};
      // Only god_object requested — long_method body must be skipped.
      handleDetectAntiPatterns('detectAntiPatterns', { patterns: ['god_object'] }, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBe(0);
    });
  });

  describe('duplicate_code', () => {
    it('flags lines repeated >= 3 times', () => {
      const content = [
        'function f() {',
        '  doDuplicateThing();',
        '  doDuplicateThing();',
        '  doDuplicateThing();',
        '}',
      ].join('\n');
      setFiles([{ path: '/proj/src/dup.js', content }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBeGreaterThanOrEqual(1);
    });

    it('does NOT flag lines repeated < 3 times', () => {
      const content = [
        'function f() {',
        '  doThing();',
        '  doThing();',
        '}',
      ].join('\n');
      setFiles([{ path: '/proj/src/nodup.js', content }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBe(0);
    });

    it('ignores short / comment / import lines for duplicate detection', () => {
      const content = [
        'import x from "y";',
        '// a comment',
        ' * star comment',
        'short',
        'short',
        'short',
        'short',
        'short',
      ].join('\n');
      setFiles([{ path: '/proj/src/ignore.js', content }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBe(0);
    });

    it('does not run duplicate_code when pattern is excluded', () => {
      const content = [
        'function f() {',
        '  doDuplicateThing();',
        '  doDuplicateThing();',
        '  doDuplicateThing();',
        '}',
      ].join('\n');
      setFiles([{ path: '/proj/src/dup.js', content }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', { patterns: ['god_object'] }, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBe(0);
    });
  });

  describe('context / return value', () => {
    it('sets antiPatternFindings on context when provided', () => {
      setFiles([{ path: '/proj/src/long.js', content: 'function f() {\n' + '  x();\n'.repeat(55) + '}\n' }]);
      const ctx = {};
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', ctx);
      expect(ctx).toHaveProperty('antiPatternFindings');
      expect(typeof ctx.antiPatternFindings).toBe('number');
    });

    it('works without a context object (no throw)', () => {
      setFiles([{ path: '/proj/src/long.js', content: 'function f() {\n' + '  x();\n'.repeat(55) + '}\n' }]);
      expect(() => handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj')).not.toThrow();
    });

    it('uses default patterns when params.patterns is undefined', () => {
      // Default patterns = all three. A long method should be detected.
      setFiles([{ path: '/proj/src/long.js', content: 'function f() {\n' + '  x();\n'.repeat(55) + '}\n' }]);
      const ctx = {};
      const result = handleDetectAntiPatterns('detectAntiPatterns', undefined, '/proj', ctx);
      expect(ctx.antiPatternFindings).toBeGreaterThanOrEqual(1);
      expect(result).toBe(`反模式检测完成: ${ctx.antiPatternFindings} 个问题`);
    });

    it('logs a found line for each pattern with findings', () => {
      const logs = [];
      vi.mocked(console.log).mockImplementation((s) => logs.push(String(s)));
      setFiles([{ path: '/proj/src/long.js', content: 'function f() {\n' + '  x();\n'.repeat(55) + '}\n' }]);
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', {});
      // long_method found -> a warning line; the other two -> "未发现" dim lines.
      expect(logs.some((l) => l.includes('long_method'))).toBe(true);
      expect(logs.some((l) => l.includes('未发现'))).toBe(true);
    });

    it('logs all-clear lines when nothing found', () => {
      const logs = [];
      vi.mocked(console.log).mockImplementation((s) => logs.push(String(s)));
      setFiles([{ path: '/proj/src/clean.js', content: 'function f() { return 1; }\n' }]);
      handleDetectAntiPatterns('detectAntiPatterns', {}, '/proj', {});
      expect(logs.filter((l) => l.includes('未发现'))).toHaveLength(3);
    });
  });
});
