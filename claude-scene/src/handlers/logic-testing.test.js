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

// 第十轮：handlePropertyTestScout 以前还会写 propertyTestSkipped / propertyTestRan，
// 两个键没有任何读者（gate-flags.js 只看 propertyTestPassed）。断言改成看**真正
// 传导到门禁的那个值**：跳过时 propertyTestPassed 必须保持 undefined（门禁会如实记
// skipped），而不应该先把它置成 false 造成「没跑 = 不通过」。
describe('handlePropertyTestScout', () => {
  it('skips when no property library is installed', () => {
    pkg({ vitest: '^4.0.0' });
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('跳过');
    expect(result.message).toContain('fast-check');
    expect(ctx.propertyTestPassed).toBeUndefined();
  });

  it('skips when the library is installed but nothing references it', () => {
    pkg({ 'fast-check': '^4.0.0', vitest: '^4.0.0' });
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('跳过');
    expect(result.message).toContain('未找到属性测试用例');
    expect(ctx.propertyTestPassed).toBeUndefined();
  });

  it('skips when a file imports the library but declares no test case', () => {
    // A reference without it()/test() makes the runner exit non-zero with
    // "No test files found". That is a missing test, not a failing one.
    pkg({ 'fast-check': '^4.0.0', vitest: '^4.0.0' });
    testFile('src/x.prop.test.js', "import fc from 'fast-check';\n// no cases\n");
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('跳过');
    expect(result.message).toContain('没有可执行的');
    expect(ctx.propertyTestPassed).toBeUndefined();
    // Spawns a real runner in a temp project; give it room to boot.
  }, 60000);

  it('skips when no test runner is available', () => {
    pkg({ 'fast-check': '^4.0.0' });
    testFile('src/x.prop.test.js', "import fc from 'fast-check';\n");
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    expect(result.status).toBe('skip');
    expect(result.message).toContain('未找到测试运行器');
    expect(ctx.propertyTestPassed).toBeUndefined();
  });

  it('detects hypothesis in a python project', () => {
    writeFileSync(join(dir, 'requirements.txt'), 'hypothesis==6.100.0\npytest\n');
    const ctx = {};
    const result = handlePropertyTestScout(null, null, dir, ctx);
    // Detected, but no property test file exists yet.
    expect(result.status).toBe('skip');
    expect(result.message).toContain('跳过');
    expect(result.message).toContain('hypothesis');
    expect(ctx.propertyTestPassed).toBeUndefined();
  });

  it('never reports pass without having actually run something', () => {
    pkg({ vitest: '^4.0.0' });
    const ctx = {};
    handlePropertyTestScout(null, null, dir, ctx);
    expect(ctx.propertyTestPassed).toBeUndefined();
  });
});
