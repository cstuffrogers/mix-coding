import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleSecBugHunt, handleLogSanitization, _collectEslintMessages } from './threat-scan.js';

// 这个文件只固化「规则到底扫不扫得到」：VULN_PATTERNS 里加了一条规则，
// 正则不生效是最典型的静默失败 —— 扫描照样输出「未发现问题」。
describe('threat-scan 规则命中', () => {
  let root;

  let logged;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'threat-'));
    logged = [];
    // 明细行走 console.log，返回值只有一句汇总 —— 断言要看明细。
    vi.spyOn(console, 'log').mockImplementation(line => { logged.push(String(line)); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('开放重定向：直取 / 模板串 / Python 三种写法都命中，安全写法不误报', async () => {
    writeFileSync(join(root, 'app.js'), [
      "app.get('/login', (req, res) => res.redirect(req.query.next));",
      "app.get('/a', (req, res) => res.redirect(`/home?x=${req.query.x}`));",
      "app.get('/b', (req, res) => res.redirect('/safe'));",
    ].join('\n'));
    writeFileSync(join(root, 'app.py'), "def go(request):\n    return redirect(request.args.get('next'))\n");

    const output = await handleSecBugHunt('a', {}, root, {});
    const detail = logged.join('');
    expect(detail).toContain('开放重定向: redirect 目标直接取自请求参数: 1 处');
    expect(detail).toContain('开放重定向: redirect 模板串里拼请求参数: 1 处');
    expect(detail).toContain('开放重定向(Python)');
    // 常量目标不能被算成漏洞
    expect(detail).not.toContain("redirect('/safe')");
    // 契约变更：改成显式 { status, message }（以前靠 NOOP_RES 正则猜状态）。
    // 这三条是 high/critical → 必须 fail（review 报告与场景口径不能两套）。
    expect(output.status).toBe('fail');
    expect(output.message).toContain('3 类问题');
  });

  it('空扫描范围按失败处理，不谎报「没有漏洞」', async () => {
    const output = await handleSecBugHunt('a', {}, join(root, 'not-exist'), {});
    expect(output.status).toBe('fail');
    expect(output.message).toContain('未找到任何源码文件');
  });

  // 旧正则要求「引号后面紧跟 +」，于是 execSync('ls ' + dir) 这种最常见的
  // 拼接写法一个都扫不到 —— 检测器长期假绿，报告里永远 0 处命令注入。
  it('命令注入：拼接 / 插值命中，argv 数组、注释示例、RegExp.exec 不误报', async () => {
    writeFileSync(join(root, 'c.js'), [
      "execSync('ls ' + dir);",
      'execSync(`ls ${dir}`);',
      "spawnSync('ls', [dir]);",
      "// 文档里的反例 execSync('ls ' + dir) 不可执行",
      "const m = /x/.exec(dir + 'y');",
    ].join('\n'));

    const output = await handleSecBugHunt('a', {}, root, {});
    const detail = logged.join('');
    expect(detail).toContain('命令注入: exec/spawn 拼接字符串: 1 处');
    expect(detail).toContain('命令注入: exec/spawn 模板串插值: 1 处');
    expect(output.status).toBe('fail');
    expect(output.message).toContain('2 类问题');
  });

  // --no-config-lookup 在部分 eslint 版本/配置形态下不生效，项目自己的 lint 规则
  // （sonarjs/*、import-x/*）会被当成「安全 HIGH」，security 门禁永远 FAIL。
  it('ESLint 向量只认显式传入的安全规则，lint 噪音与解析错误分开计', () => {
    const out = [];
    const parsed = [{
      filePath: '/p/a.js',
      messages: [
        { ruleId: 'no-eval' },
        { ruleId: 'sonarjs/no-os-command-from-path' },
        { ruleId: 'import-x/no-named-as-default-member' },
        { ruleId: null, fatal: true, message: 'Parsing error' },
      ],
    }];

    const parseErrors = _collectEslintMessages(parsed, ['no-eval: error', 'no-new-func: error'], out);

    expect(parseErrors).toBe(1);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(1);
    expect(out[0].rules).toEqual(['no-eval']);
  });

  // 旧实现 shell 出 grep -r .，把 vendored 的嵌套仓库也扫进来，
  // 报出来的「泄露」全是别人的代码 —— 只能靠改第三方源码消掉。
  it('日志脱敏只扫本项目源码：自带 .git 的嵌套目录不算本项目', async () => {
    writeFileSync(join(root, 'own.js'), "console.log('token', apiToken);\n");
    mkdirSync(join(root, 'vendored', '.git'), { recursive: true });
    writeFileSync(join(root, 'vendored', 'other.js'), "console.log('token', apiToken);\n");

    const output = await handleLogSanitization('a', {}, root, {});
    const detail = logged.join('');

    expect(output).toContain('1 处泄露');
    expect(detail).toContain('own.js:1');
    expect(detail).not.toContain('vendored');
  });
});
