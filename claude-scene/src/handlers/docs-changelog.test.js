import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * `handleChangelog` 此前**零测试覆盖**，而它比 `handleDevDocs` 更危险：
 * `handleDevDocs` 至少还有覆盖保护，它没有 —— 而且它对手写文件的破坏是结构性的：
 *
 *   readFileSync(changelogPath).split('\n').slice(1)   // 只丢掉第一行标题
 *
 * 于是旧内容原封不动拼在新内容后面，每跑一次顶部就多一段
 * `## Unreleased (2026-xx-xx)` + `## Fixed`。本仓库 `docs/CHANGELOG.md` 用的是
 * `###` 层级，跑一次就被压平成 `# Changelog` 下的十几个平级 `##`。
 *
 * 这些断言走引擎真读的那个函数（`handleChangelog`），不碰内部小工具。
 */

const mockExec = vi.fn();
vi.mock('../lib/safe-exec.js', () => ({
  safeExec: (...args) => mockExec(...args),
}));

const { handleChangelog } = await import('./docs.js');

const BEGIN = '<!-- generated-by: mix-coding /docs changelog -->';
const END = '<!-- /generated-by -->';

let root;
let gitLog;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mix-changelog-'));
  gitLog = ['abc1234 feat: 加一个功能', 'def5678 fix: 修一个 bug'].join('\n');
  mockExec.mockImplementation(() => gitLog);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  mockExec.mockReset();
});

function changelog() {
  return join(root, 'docs', 'CHANGELOG.md');
}

function written() {
  return readFileSync(changelog(), 'utf-8');
}

describe('handleChangelog：重复跑不许把文件叠成千层饼', () => {
  it('跑两次只有一段生成区，标记各出现一次', () => {
    const first = handleChangelog('changelog', { version: '1.0.0' }, root, {});
    expect(first.status).toBe('pass');
    const once = written();
    const again = handleChangelog('changelog', { version: '1.0.0' }, root, {});
    expect(again.status).toBe('pass');

    const text = written();
    expect(text.split(BEGIN).length - 1).toBe(1);
    expect(text.split(END).length - 1).toBe(1);
    expect(text.split('### Features').length - 1).toBe(1);
    expect(text, '第二次跑把第一次的内容又拼了一遍').not.toBe(once + '\n' + once);
    // 内容一样、字节也得一样：只多一个空行，评审里就永远挂着一个「无变化」的 diff
    expect(text).toBe(once);
  });

  it('标记之外的手写内容原样保留', () => {
    handleChangelog('changelog', { version: '1.0.0' }, root, {});
    const withNotes = written() + '\n## 手写补记（不许被吃）\n\n- 2026-10-30 人工补一条\n';
    writeFileSync(changelog(), withNotes);

    handleChangelog('changelog', { version: '1.1.0' }, root, {});

    const text = written();
    expect(text).toContain('手写补记（不许被吃）');
    expect(text).toContain('## 1.1.0');
    expect(text).not.toContain('## 1.0.0');
  });
});

describe('handleChangelog：手写 CHANGELOG 不许碰', () => {
  it('已有手写 docs/CHANGELOG.md（没有生成标记）→ skip，一字节不动', () => {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(changelog(), '# Changelog\n\n## 1.0.0 (2026-01-01)\n\n### Fixed\n\n- 手写的条目\n');
    const before = readFileSync(changelog());

    const result = handleChangelog('changelog', { version: '2.0.0' }, root, {});

    expect(result).toMatchObject({ status: 'skip', reason: 'input-invalid' });
    expect(result.message).toContain('手写');
    expect(readFileSync(changelog()).equals(before), '手写 CHANGELOG 被改动了').toBe(true);
  });
});

describe('handleChangelog：生成的正文', () => {
  it('版本标题 + 中文分组用 ###，日期是真日期', () => {
    handleChangelog('changelog', { version: '2.3.4' }, root, {});

    const text = written();
    expect(text).toMatch(/## 2\.3\.4 \(\d{4}-\d{2}-\d{2}\)/u);
    expect(text).toContain('### Features');
    expect(text).toContain('### Bug Fixes');
    expect(text).toContain('- 加一个功能');
    // `### Features` 本身就含 `## Features` 这个子串，所以断行首行尾，而不断子串
    expect(text).not.toMatch(/^## Features$/mu);
  });

  it('--since 会变成 git log 的范围，而不是被忽略', () => {
    handleChangelog('changelog', { since: 'v1.0.0' }, root, {});
    expect(mockExec.mock.calls[0][0]).toContain('v1.0.0..HEAD');
  });

  it('一条提交都没有 → skip，不写一份只有标题的 CHANGELOG', () => {
    gitLog = '';

    const result = handleChangelog('changelog', {}, root, {});

    expect(result).toMatchObject({ status: 'skip', reason: 'input-missing' });
    expect(existsSync(changelog()), '零提交也写出了 CHANGELOG').toBe(false);
  });

  it('空仓库（git log 自己失败）不算警告，算没东西可写', () => {
    // 现场跑出来的：还没有任何提交时 `git log` 是 throw，不是返回空串。
    // 以前一律落到 warn —— 「仓库是空的」和「生成失败了」被当成同一件事。
    mockExec.mockImplementation(() => {
      throw new Error("fatal: your current branch 'main' does not have any commits yet");
    });

    const result = handleChangelog('changelog', {}, root, {});

    expect(result).toMatchObject({ status: 'skip', reason: 'input-missing' });
    expect(result.message).toContain('还没有任何提交');
    expect(existsSync(changelog())).toBe(false);
  });

  it('git 自己报错 → warn，不冒充成功', () => {
    mockExec.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const result = handleChangelog('changelog', {}, root, {});

    expect(result).toMatchObject({ status: 'warn' });
    expect(result.message).toContain('not a git repository');
  });
});
