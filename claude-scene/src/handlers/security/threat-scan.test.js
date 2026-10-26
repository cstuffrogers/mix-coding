import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleSecBugHunt } from './threat-scan.js';

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
    expect(output).toContain('3 类问题');
  });

  it('空扫描范围按失败处理，不谎报「没有漏洞」', async () => {
    const output = await handleSecBugHunt('a', {}, join(root, 'not-exist'), {});
    expect(output).toContain('未找到任何源码文件');
  });
});
