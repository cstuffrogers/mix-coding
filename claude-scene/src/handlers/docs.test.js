import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleDevDocs } from './docs.js';

/**
 * 第三十八轮：`/docs arch` 生成器的四个真缺陷。
 *
 * 现场证物是仓库里那份 `docs/architecture.md`（本轮已退役）：页头写「自动生成于 2026-06-05」，
 * 正文却被手改过一半，里面还有三段**是本仓库的自传**——
 * 「| `src/commands/` | CLI 命令入口（list/start/show/fork） |」「## 数据流」「支持 28 个自动化工作流」。
 * 这三段是模板里硬编码的字符串，所以在**任何**目标项目跑 `/docs arch` 都会被写进去：
 * 给一个 React 项目写「本项目支持 28 个自动化工作流」，而真值是 26。
 *
 * 四个缺陷：
 *   A. 硬编码本仓库自传（模块说明 / 数据流 / 工作流条数），而且是错的条数；
 *   B. 目录树静默 `slice(0, 80)`，不写省略标记 —— 生成物看起来完整，其实只有第一段；
 *   C. 依赖表静默 `slice(0, 30)`，同上；
 *   D. 技术栈探测不到就写「待补充」，照样记 pass；且会无条件覆盖已有的手写文件。
 *
 * 判据：生成物必须自报「我是生成物」，必须说清截断，不许在别人的项目里写我们的自传，
 * 也不许覆盖手写内容 —— 覆盖一次就等于销毁一次人工工作。
 */

const MARKER = '<!-- generated-by: mix-coding /docs arch -->';
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mix-devdocs-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function archFile() {
  return join(root, 'docs', 'architecture.md');
}

function generated() {
  return readFileSync(archFile(), 'utf-8');
}

function seedSrc() {
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'app.ts'), 'export const a = 1;\n');
}

describe('handleDevDocs：生成器不许在别人的项目里写我们的自传', () => {
  it('三节自传一个都不留（模块说明 / 数据流 / 工作流条数）', () => {
    seedSrc();
    handleDevDocs('dev-docs', {}, root, {});

    const text = generated();
    for (const phrase of ['28 个自动化工作流', '模块说明', '数据流', 'src/commands/', 'src/handlers/']) {
      expect(text, `生成物里还留着本仓库的自传：${phrase}`).not.toContain(phrase);
    }
  });

  it('生成物自报身份：首屏有生成标记和日期', () => {
    seedSrc();
    handleDevDocs('dev-docs', {}, root, {});

    const text = generated();
    expect(text).toContain(MARKER);
    expect(text).toMatch(/自动生成于 \d{4}-\d{2}-\d{2}/);
  });

  it('目录树被截断时显式说清省略了多少项', () => {
    for (let i = 0; i < 100; i++) writeFileSync(join(root, `f${String(i).padStart(3, '0')}.txt`), 'x');
    handleDevDocs('dev-docs', {}, root, {});

    // 根目录 100 个文件，保留 80 项 → 省略 20 项（目录树在创建 docs/ 之前扫，所以没有多余项）
    expect(generated()).toContain('已省略 20 项');
  });

  it('依赖表被截断时显式说清「前 30 个 / 共 N 个」', () => {
    const deps = {};
    for (let i = 0; i < 40; i++) deps[`dep-${i}`] = '^1.0.0';
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: deps }));
    seedSrc();
    handleDevDocs('dev-docs', {}, root, {});

    const text = generated();
    expect(text).toContain('共 40 个');
    expect(text).toContain('前 30 个');
  });

  it('技术栈探测不到就说未识别，不写含糊的「待补充」', () => {
    seedSrc();
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }));
    handleDevDocs('dev-docs', {}, root, {});

    const text = generated();
    expect(text).toContain('未识别');
    expect(text).not.toContain('待补充');
  });
});

describe('handleDevDocs：覆盖手写文件等于销毁人工工作', () => {
  it('已有手写 docs/architecture.md（没有生成标记）→ skip，一个字节都不动', () => {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(archFile(), '# 我手写的架构\n\n这里写了本项目的报告产物契约。\n');
    const before = readFileSync(archFile());
    seedSrc();

    const result = handleDevDocs('dev-docs', {}, root, {});

    expect(result).toMatchObject({ status: 'skip', reason: 'input-invalid' });
    expect(result.message).toContain('手写');
    expect(readFileSync(archFile()).equals(before), '手写文件被改动了').toBe(true);
  });

  it('上一次自己生成的产物可以覆盖，且标记不重复', () => {
    seedSrc();
    handleDevDocs('dev-docs', {}, root, {});
    const again = handleDevDocs('dev-docs', {}, root, {});

    expect(again).not.toMatchObject({ status: 'skip' });
    const text = generated();
    expect(text.split(MARKER).length - 1, '生成标记被重复写入').toBe(1);
  });

  it('目标目录里没有任何可写的结构 → skip，不写一份空架构文档冒充成功', () => {
    writeFileSync(join(root, '.keep'), 'x');

    const result = handleDevDocs('dev-docs', {}, root, {});

    expect(result).toMatchObject({ status: 'skip', reason: 'input-missing' });
    expect(existsSync(archFile()), '空目录也写出了架构文档').toBe(false);
  });
});
