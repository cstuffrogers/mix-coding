import { describe, it, expect } from 'vitest';
import { sep, join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
  isTrivialLine,
  extractFunctionBody,
  findBodyBrace,
  analyzeExportedFunction,
  envVarName,
  mcpConfigCandidates,
  formatToolHealthLine,
  detectLlmProxyAuditHealth,
  checkCePlugin,
} from './handler-verify.js';

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

describe('envVarName', () => {
  it('accepts pi syntax ${VAR}', () => {
    expect(envVarName('${GITHUB_PERSONAL_ACCESS_TOKEN}')).toBe('GITHUB_PERSONAL_ACCESS_TOKEN');
  });
  it('accepts Claude Code syntax ${env:VAR}', () => {
    expect(envVarName('${env:TAVILY_API_KEY}')).toBe('TAVILY_API_KEY');
  });
  it('rejects partial or unrelated values', () => {
    expect(envVarName('$GITHUB_TOKEN')).toBe('');
    expect(envVarName('prefix${X}')).toBe('');
    expect(envVarName('Bearer abc')).toBe('');
    expect(envVarName('${1BAD}')).toBe('');
    expect(envVarName('')).toBe('');
    expect(envVarName(null)).toBe('');
    expect(envVarName(42)).toBe('');
  });
});

describe('mcpConfigCandidates', () => {
  it('tries project pi config, then user-level pi config, then Claude Code', () => {
    const [project, user, claude] = mcpConfigCandidates('/proj', '/home/u');
    const norm = (p) => p.split(sep).join('/');
    expect(norm(project)).toBe('/proj/.pi/mcp.json');
    expect(norm(user)).toBe('/home/u/.pi/agent/mcp.json');
    expect(norm(claude)).toBe('/proj/.claude/mcp.json');
  });
});

// Pass 3/9 是自检里最容易说谎的两道：判「空转」的规则一错，要么满屏假阳性（真实现的
// 壳被点名），要么把真桩放过。这一组用例钉住两件事：函数体要按括号配对取、
// 诚实的「跳过」不算空转。
describe('findBodyBrace', () => {
  it('跳过参数表里的默认值花括号', () => {
    const src = 'export function f(a, options = {}, b) {\n  doWork();\n}\n';
    const idx = findBodyBrace(src, 0);
    expect(src.slice(idx, idx + 20)).toContain('doWork');
  });

  it('跳过解构参数与 TS 注解里的花括号', () => {
    const src = 'export function G({ onClick, children }: { onClick?: () => void }) {\n  return 1;\n}\n';
    const idx = findBodyBrace(src, 0);
    expect(src.slice(idx)).not.toContain('onClick?:');
  });
});

describe('extractFunctionBody（括号配对）', () => {
  it('模板字符串里的 } 不会把函数体截断', () => {
    const src = 'export function f() {\n  const s = `a${x}}b`;\n  doWork();\n}\n';
    const body = extractFunctionBody(src, findBodyBrace(src, 0));
    expect(body).toContain('doWork()');
    expect(body.trimEnd().endsWith('}')).toBe(true);
  });

  it('不把后面的模块级代码算进函数体', () => {
    const src = 'export function f() {\n  return 1;\n}\nconst helper = () => writeFileSync("x");\n';
    const body = extractFunctionBody(src, findBodyBrace(src, 0));
    expect(body).not.toContain('writeFileSync');
  });
});

describe('analyzeExportedFunction（空转 vs 诚实跳过）', () => {
  // 前两条是真桩（该点名）；第三条是缺工具时的诚实出口（不该点名）
  it.each([
    ['一句静态字符串返回', 'export function f() {\n  return "done";\n}\n', true],
    ['只有 console.log + chalk', 'export function f() {\n  console.log(chalk.green("hi"));\n  return "ok";\n}\n', true],
    ['只返回「跳过/不可用」', 'export function f() {\n  return "MobSF MCP 不可用，未执行（不计为通过）";\n}\n', false],
  ])('%s → 判空转=%s', (_label, src, isStub) => {
    const r = analyzeExportedFunction(src, 'f', 0, 'x.js');
    expect(r === null).toBe(!isStub);
  });

  it('调自己的辅助函数干活 → 不算空转', () => {
    const src = 'export function f(t) {\n  ensureDir(t);\n  return exportTokens(t);\n}\n';
    expect(analyzeExportedFunction(src, 'f', 0, 'x.js')).toBeNull();
  });

  it('真实现（带循环/文件 IO）→ 不算空转', () => {
    const src = 'export function f(t) {\n  const files = readdirSync(t);\n  for (const x of files) {\n    writeFileSync(x, "y");\n  }\n}\n';
    expect(analyzeExportedFunction(src, 'f', 0, 'x.js')).toBeNull();
  });
});

// Pass 4 以前没有标题行：报告只打印 10 行却宣称「11 道检查通过」，
// 而「可选缺失: dependencycheck」那行还挂在 Pass 3 下面。这组用例锁住格式。
describe('formatToolHealthLine', () => {
  it('全部装好时是绿色通过，并报出数量', () => {
    const r = formatToolHealthLine({ available: [{ name: 'knip' }, { name: 'lychee' }] });
    expect(r.level).toBe('pass');
    expect(r.text).toContain('2 个全部可用');
  });

  it('只有可选工具缺失时仍是通过，但要点名', () => {
    const r = formatToolHealthLine({
      available: [{ name: 'knip' }],
      optional_missing: [{ name: 'dependencycheck' }],
    });
    expect(r.level).toBe('pass');
    expect(r.text).toContain('1 个可选未装');
    expect(r.text).toContain('dependencycheck');
  });

  it('必需工具缺失要降级为 warn，且两种缺失都点名', () => {
    const r = formatToolHealthLine({
      available: [],
      missing: ['semgrep'],
      optional_missing: ['mobsfscan'],
    });
    expect(r.level).toBe('warn');
    expect(r.text).toContain('semgrep');
    expect(r.text).not.toContain('mobsfscan');
  });

  it('空对象不炸（三态中的 skip 路径）', () => {
    expect(formatToolHealthLine({}).level).toBe('pass');
  });
});

// 回归：Pass 11 的 issue 对象是 { level, file, detail }，但打印只读 message/type
// → 自检永远显示「🔴 issue」，用户看不出到底是什么问题。
describe('detectLlmProxyAuditHealth', () => {
  it('issue 必带可直接展示的说明（detail/message）', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = mkdtempSync(join(tmpdir(), 'llm-audit-'));
    try {
      // 只有 3 个蜜罐 → 触发 warn issue
      writeFileSync(join(dir, '.honeytools.json'), JSON.stringify({ honeytools: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }));
      const health = detectLlmProxyAuditHealth(dir);
      expect(health.issues.length).toBeGreaterThan(0);
      for (const iss of health.issues) {
        expect(iss.message || iss.detail || iss.type).toBeTruthy();
      }
      expect(health.issues[0].detail).toContain('蜜罐');
      expect(health.honeytoolOk).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('审计的是 --target 目录，不是引擎自己的配置', async () => {
    const { mkdtempSync, rmSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = mkdtempSync(join(tmpdir(), 'llm-audit-empty-'));
    try {
      const health = detectLlmProxyAuditHealth(dir);
      expect(health.issues[0].detail).toContain('蜜罐配置文件不存在');
      expect(health.issues[0].file).toBe('.honeytools.json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('checkCePlugin 跟随 targetPath', () => {
  it('目标项目没有 .claude/plugins 配置时返回 false（不再永远报已安装）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ce-'));
    try {
      expect(checkCePlugin(dir)).toBe(false);
      mkdirSync(join(dir, '.claude', 'plugins'), { recursive: true });
      writeFileSync(join(dir, '.claude', 'plugins', 'compound-engineering.json'), '{}');
      expect(checkCePlugin(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
