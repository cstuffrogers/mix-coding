import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleApiDocs } from './docs.js';

/**
 * 第四十二轮收尾时留下的开放问题（b）：`handleApiDocs` 与 `handleChangelog` 同一个病。
 *
 * 旧实现的四条毛病：
 *   A. 无条件覆盖 `docs/api/<mod>.md` —— 手写一份，跑一次 `/docs api` 就销毁一次人工工作；
 *   B. 模块删了/改名了，旧文档永远躺在 `docs/api/` 里描述一个不存在的模块，没人会手动删；
 *   C. 只认 `export function|class|const|interface|type NAME`，`export default` /
 *      `export { … }` / `export * from` 一律「扫不到就当你没有」—— 文档标着「## 导出」，
 *      其实少了一大截，还算 pass；
 *   D. `catch` 里只 `console.log` 一句，然后落到 `skip` —— **出错了说「跳过」**，
 *      而且 pass 分支返回的是裸字符串，不带 `{status}`。
 *
 * 判据：手写的归人、生成的归生成器（标记识别）；回收只回收自己的；不认识的写法写在脸上；
 * 出错了就是 fail。
 */

const MARKER = '<!-- generated-by: mix-coding /docs api -->';
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mix-apidocs-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function apiFile(name) {
  return join(root, 'docs', 'api', name);
}

function seed(files) {
  for (const [rel, text] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  }
}

describe('handleApiDocs：手写的归人，生成的归生成器', () => {
  it('同名的没有生成标记 → 一个字节都不动，并说清跳过了哪份', () => {
    const handWritten = '# 我手写的 order 文档\n\n这里是人写的东西。\n';
    seed({
      'src/order.ts': 'export function createOrder() {}\n',
      'src/user.ts': 'export function createUser() {}\n',
      'docs/api/order.md': handWritten,
    });

    const r = handleApiDocs('api-docs', {}, root, {});

    expect(readFileSync(apiFile('order.md'), 'utf-8')).toBe(handWritten);
    expect(r.status).toBe('pass');
    expect(r.message).toContain('跳过 1 份手写文件');
    expect(r.message).toContain('order.md');
  });

  it('全是手写文件 → skip(input-invalid)，不算「生成成功」', () => {
    seed({ 'src/order.ts': 'export function createOrder() {}\n', 'docs/api/order.md': '# 手写\n' });

    const r = handleApiDocs('api-docs', {}, root, {});

    expect(r).toMatchObject({ status: 'skip', reason: 'input-invalid' });
    expect(r.message).toContain('一份都没覆盖');
  });

  it('skip 时也不把「顺手清理了几份过期产物」静默掉', () => {
    seed({
      'src/order.ts': 'export function createOrder() {}\n',
      'docs/api/order.md': '# 手写\n',
      'docs/api/ghost.md': `${MARKER}\n# ghost\n`,
    });

    const r = handleApiDocs('api-docs', {}, root, {});

    expect(r).toMatchObject({ status: 'skip', reason: 'input-invalid' });
    expect(existsSync(apiFile('ghost.md'))).toBe(false);
    expect(r.message).toContain('已清理 1 份过期产物');
  });

  it('生成物首屏带生成标记，第二次跑字节相等（幂等）', () => {
    seed({ 'src/order.ts': 'export function createOrder() {}\nexport const LIMIT = 10;\n' });

    handleApiDocs('api-docs', {}, root, {});
    const first = readFileSync(apiFile('order.md'), 'utf-8');
    handleApiDocs('api-docs', {}, root, {});
    const second = readFileSync(apiFile('order.md'), 'utf-8');

    expect(first.startsWith(MARKER)).toBe(true);
    expect(first.split(MARKER).length - 1).toBe(1);
    expect(first).toContain('createOrder');
    expect(first).toContain('LIMIT');
    expect(second).toBe(first);
  });

  it('自己生成的产物可以覆盖（带标记 → 允许重写）', () => {
    seed({ 'src/order.ts': 'export function createOrder() {}\n' });
    handleApiDocs('api-docs', {}, root, {});
    expect(readFileSync(apiFile('order.md'), 'utf-8')).toContain('createOrder');

    seed({ 'src/order.ts': 'export function createOrder() {}\nexport function refund() {}\n' });
    handleApiDocs('api-docs', {}, root, {});

    expect(readFileSync(apiFile('order.md'), 'utf-8')).toContain('refund');
  });
});

describe('handleApiDocs：过期产物与不认识的写法', () => {
  it('模块没了 → 带标记的旧文档被回收，手写的同类文件保留', () => {
    seed({
      'src/order.ts': 'export function createOrder() {}\n',
      'src/gone.ts': 'export function legacy() {}\n',
      'docs/api/mine.md': '# 手写笔记\n',
    });
    handleApiDocs('api-docs', {}, root, {});
    expect(existsSync(apiFile('gone.md'))).toBe(true);

    rmSync(join(root, 'src', 'gone.ts'));
    const r = handleApiDocs('api-docs', {}, root, {});

    expect(existsSync(apiFile('gone.md'))).toBe(false);
    expect(existsSync(apiFile('order.md'))).toBe(true);
    expect(existsSync(apiFile('mine.md'))).toBe(true);
    expect(r.message).toContain('清理 1 份过期产物');
    expect(r.status).toBe('pass');
  });

  it('不认识的导出写法（export default / export {…}）必须写在文档里，不许当没有', () => {
    seed({
      'src/mixed.ts': 'export function known() {}\nexport default function unknown() {}\nexport { a as b };\n',
    });

    handleApiDocs('api-docs', {}, root, {});
    const text = readFileSync(apiFile('mixed.md'), 'utf-8');

    expect(text).toContain('known');
    expect(text).toContain('## 未收录');
    expect(text).toContain('**2** 处本工具不认识的导出写法');
  });

  it('一条都没写出来（只有不认识的写法）→ skip(input-missing)，并说清为什么', () => {
    seed({ 'src/onlydefault.ts': 'export default function foo() {}\nexport * from "./x.js";\n' });

    const r = handleApiDocs('api-docs', {}, root, {});

    expect(r).toMatchObject({ status: 'skip', reason: 'input-missing' });
    expect(r.message).toContain('2 处');
    expect(existsSync(join(root, 'docs', 'api'))).toBe(false);
  });
});

describe('handleApiDocs：没输入、真出错要分清', () => {
  it('没有源文件目录 → skip(input-missing)', () => {
    seed({ 'README.md': '# x\n' });

    const r = handleApiDocs('api-docs', {}, root, {});

    expect(r).toMatchObject({ status: 'skip', reason: 'input-missing' });
    expect(r.message).toContain('没有源文件目录 src');
  });

  it('参数 include 指定别的目录时按它找', () => {
    seed({ 'lib/thing.js': 'export const x = 1;\n' });

    const r = handleApiDocs('api-docs', { include: 'lib' }, root, {});

    expect(r.status).toBe('pass');
    expect(r.message).toContain('1 个模块');
    expect(existsSync(apiFile('thing.md'))).toBe(true);
  });

  it('写不进去（docs/api 被一个文件占着）→ fail，不冒充 skip', () => {
    seed({ 'src/broken.ts': 'export function a() {}\n' });
    // `docs/api` 是文件不是目录 → 往它下面写会 ENOTDIR 抛错，必须落进 catch。
    writeFileSync(join(root, 'docs-api-blocker'), 'x');
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'api'), 'not a directory');

    const r = handleApiDocs('api-docs', {}, root, {});

    expect(r.status).toBe('fail');
    expect(r.message).toContain('API 文档生成失败');
  });
});
