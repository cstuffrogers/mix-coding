import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { handlePropertyTestScout } from './logic-testing.js';

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pts-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const pkg = (deps) => writeFileSync(
  join(dir, 'package.json'),
  JSON.stringify({ name: 't', version: '1.0.0', devDependencies: deps }),
);

const testFile = (rel, body) => {
  const full = join(dir, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
};

describe('handlePropertyTestScout', () => {
  it('skips when no property library is installed', () => {
    pkg({ vitest: '^4.0.0' });
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result).toContain('跳过');
    expect(result).toContain('fast-check');
    expect(ctx.propertyTestSkipped).toBe(true);
    expect(ctx.propertyTestRan).toBeUndefined();
  });

  it('skips when the library is installed but nothing references it', () => {
    pkg({ 'fast-check': '^4.0.0', vitest: '^4.0.0' });
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result).toContain('跳过');
    expect(result).toContain('未找到属性测试用例');
    expect(ctx.propertyTestSkipped).toBe(true);
  });

  it('skips when a file imports the library but declares no test case', () => {
    // A reference without it()/test() makes the runner exit non-zero with
    // "No test files found". That is a missing test, not a failing one.
    pkg({ 'fast-check': '^4.0.0', vitest: '^4.0.0' });
    testFile('src/x.prop.test.js', "import fc from 'fast-check';\n// no cases\n");
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result).toContain('跳过');
    expect(result).toContain('没有可执行的');
    expect(ctx.propertyTestSkipped).toBe(true);
    expect(ctx.propertyTestRan).toBeUndefined();
    // Spawns a real runner in a temp project; give it room to boot.
  }, 60000);

  it('skips when no test runner is available', () => {
    pkg({ 'fast-check': '^4.0.0' });
    testFile('src/x.prop.test.js', "import fc from 'fast-check';\n");
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result).toContain('未找到测试运行器');
    expect(ctx.propertyTestSkipped).toBe(true);
  });

  it('detects hypothesis in a python project', () => {
    writeFileSync(join(dir, 'requirements.txt'), 'hypothesis==6.100.0\npytest\n');
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    // Detected, but no property test file exists yet.
    expect(result).toContain('跳过');
    expect(result).toContain('hypothesis');
    expect(ctx.propertyTestSkipped).toBe(true);
  });

  it('never reports pass without having actually run something', () => {
    pkg({ vitest: '^4.0.0' });
    const ctx = {};
    handlePropertyTestScout(null, null, dir, ctx);
    expect(ctx.propertyTestRan).toBeUndefined();
    expect(ctx.propertyTestSkipped).toBe(true);
  });
});
