import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  DEFAULT_RULE_PACK,
  SEMGREP_CHUNK,
  chunkScanTargets,
  parseSemgrepJson,
  resolveSemgrepConfig,
} from './deep-review-tools.js';

describe('deep-review-tools', () => {
  describe('rule pack', () => {
    it('ships a rule pack with logic/IO rules', async () => {
      const { readFileSync } = await import('fs');
      const yaml = readFileSync(DEFAULT_RULE_PACK, 'utf-8');
      expect(yaml).toContain('logic-sql-string-concat');
      expect(yaml).toContain('io-json-parse-request-body');
      expect(yaml).toContain('io-path-from-request');
      // Non-ASCII makes Windows Python (GBK default) abort with
      // UnicodeDecodeError before any rule runs, so keep the pack ASCII-only.
      // eslint-disable-next-line no-control-regex
      expect(/^[\u0000-\u007F]*$/m.test(yaml)).toBe(true);
    });
  });

  describe('parseSemgrepJson', () => {
    it('flattens results and shortens rule ids', () => {
      const raw = JSON.stringify({
        results: [{
          check_id: 'a.b.c.logic-dynamic-code-exec',
          path: 'src/x.js',
          start: { line: 12 },
          extra: { severity: 'ERROR', message: 'eval of request input\nmore detail' },
        }],
        errors: [],
      });
      const { findings, ruleErrors, parseFailed } = parseSemgrepJson(raw);
      expect(parseFailed).toBe(false);
      expect(ruleErrors).toEqual([]);
      expect(findings).toEqual([{
        rule: 'logic-dynamic-code-exec',
        file: 'src/x.js',
        line: 12,
        severity: 'ERROR',
        message: 'eval of request input',
      }]);
    });

    it('reports rule load errors instead of dropping them silently', () => {
      const raw = JSON.stringify({
        results: [],
        errors: [{ rule_id: 'bad-rule', message: 'Rule parse error' }],
      });
      const { ruleErrors, findings } = parseSemgrepJson(raw);
      expect(findings).toEqual([]);
      expect(ruleErrors).toEqual(['bad-rule']);
    });

    it('flags unparseable output rather than reporting zero findings', () => {
      const { parseFailed, findings } = parseSemgrepJson('semgrep: command not found');
      expect(parseFailed).toBe(true);
      expect(findings).toEqual([]);
    });

    // 旧实现把 errors 全叫「规则加载失败」，于是目标文件语法解析错误
    // （impeccable 里的 .mjs）被读成「规则坏了」——两类问题要分开报。
    it('目标文件解析失败不算规则加载失败', () => {
      const raw = JSON.stringify({
        results: [],
        errors: [{ code: 3, message: 'Syntax error at line x.mjs:21:', path: '.agents/x.mjs' }],
      });
      const { ruleErrors, parseErrors } = parseSemgrepJson(raw);
      expect(ruleErrors).toEqual([]);
      expect(parseErrors).toEqual(['.agents/x.mjs']);
    });

    it('tolerates missing start/extra blocks', () => {
      const raw = JSON.stringify({ results: [{ check_id: 'r.one' }] });
      const { findings } = parseSemgrepJson(raw);
      expect(findings[0]).toMatchObject({ rule: 'one', line: 0, severity: 'WARNING' });
    });
  });

  // 扫描目标错了 semgrep 会静默地什么都不扫（或者扫进 node_modules 拖到超时），
  // 这两种都不会报错，只会让「0 处命中」看起来像安全。
  //
  // 契约变更（有理由）：以前给它「源码顶层目录 + --exclude 列表」，根目录有根级
  // 文件时目标回落到 `.`，semgrep 不看 exclude 之外的点目录，于是
  // .agents/skills/*/scripts 里第三方浏览器脚本的 17 处 innerHTML 被算成
  // 本项目的缺陷（假红）。现在和 ESLint 一样：**交文件清单，不交目录**。
  describe('chunkScanTargets', () => {
    it('按批切开，路径原样保留（不给 semgrep 目录）', () => {
      const files = ['src/a.js', 'src/b.ts', 'lib/c.js'];
      expect(chunkScanTargets(files, 2)).toEqual([['src/a.js', 'src/b.ts'], ['lib/c.js']]);
    });

    it('默认批次大小内不拆', () => {
      const files = Array.from({ length: SEMGREP_CHUNK }, () => 'src/a.js');
      expect(chunkScanTargets(files)).toHaveLength(1);
      expect(chunkScanTargets([...files, 'src/z.js'])).toHaveLength(2);
    });

    it('没有文件时给空数组（调用方据此判失败，而不是扫全仓库）', () => {
      expect(chunkScanTargets([])).toEqual([]);
    });
  });

  describe('_semgrepArgs 等价契约：点目录里的文件不会被交给 semgrep', () => {
    it('listProjectCodeFiles 的清单本身就不含点目录', async () => {
      const { listProjectCodeFiles } = await import('../lib/project-sources.js');
      const dir = mkdtempSync(join(tmpdir(), 'semgrep-dot-'));
      try {
        mkdirSync(join(dir, 'src'), { recursive: true });
        mkdirSync(join(dir, '.agents', 'skills', 'x'), { recursive: true });
        writeFileSync(join(dir, 'src', 'a.js'), 'export const a = 1;\n');
        // 夹具内容拼出来：如果在本文件里直接写 `document.body.innerHTML = x`，
        // 本项目自己的 XSS 扫描会把这条测试源码当成真的 innerHTML 注入（假红）。
        const vendored = ['document.body.innerHTML', '= x;'].join(' ');
        writeFileSync(join(dir, '.agents', 'skills', 'x', 'b.js'), vendored + '\n');
        const files = listProjectCodeFiles(dir);
        expect(files.some(f => f.includes('.agents'))).toBe(false);
        expect(files.some(f => f.endsWith('a.js'))).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('resolveSemgrepConfig', () => {
    it('prefers a project-local semgrep config', () => {
      const dir = mkdtempSync(join(tmpdir(), 'semgrep-cfg-'));
      try {
        writeFileSync(join(dir, '.semgrep.yml'), 'rules: []\n');
        expect(resolveSemgrepConfig(dir)).toEqual({
          config: join(dir, '.semgrep.yml'),
          source: 'project',
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('falls back to the engine pack', () => {
      const dir = mkdtempSync(join(tmpdir(), 'semgrep-cfg-'));
      try {
        expect(resolveSemgrepConfig(dir)).toEqual({
          config: DEFAULT_RULE_PACK,
          source: 'engine',
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('result wording drives the engine status classifier', () => {
    // start.js picks the step status from the result string:
    //   NOOP_RES -> noop, WARN_RES -> warn, /失败|阻断/ -> fail.
    // A scan that found blocking defects must not read as a plain pass, and
    // its wording must not contain 阻断 (that would be classified as failure).
    const NOOP_RES = [/不可用/i, /未安装/, /已?跳过/];
    // Mirrors start.js WARN_RES verbatim so the contract stays honest.
    // eslint-disable-next-line sonarjs/super-linear-regex
    const WARN_RES = [/\d+\s*[个处类].{0,30}?(?:问题|漏洞|警告|气味|发现|重复)/i];
    const FAIL_RES = /(失败|阻断|abort|FAIL)/i;

    const classify = (msg) => {
      if (FAIL_RES.test(msg)) return 'fail';
      if (NOOP_RES.some(re => re.test(msg))) return 'noop';
      if (WARN_RES.some(re => re.test(msg))) return 'warn';
      return 'pass';
    };

    it('classifies a skip message as noop', () => {
      expect(classify('Semgrep 跳过: 未安装')).toBe('noop');
      expect(classify('CodeQL 跳过: 未安装')).toBe('noop');
    });

    it('classifies findings as warn, not pass and not fail', () => {
      expect(classify('Semgrep 逻辑/IO 扫描完成: 9 处发现（高危 5 处）')).toBe('warn');
    });

    it('does not let a defect report read as failure', () => {
      expect(FAIL_RES.test('Semgrep 逻辑/IO 扫描完成: 9 处发现（高危 5 处）')).toBe(false);
      // Same trap for the property-testing step: a found counterexample is a
      // defect report, not a failure of the step.
      expect(classify('属性测试执行完成: 1 处发现（存在不变量违反，已收缩出最小反例）')).toBe('warn');
    });
  });
});
