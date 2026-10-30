import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * 第三十三轮：**死配置与死文档必须死透**。
 *
 * 这一轮之前仓库里躺着两样「还在被描述、但早就不干活」的东西：
 *   1. `.claude/mcp-enable.json` —— 4 份文档把它写成「每次启动场景时自动启用对应 MCP」，
 *      实际上**没有任何一行代码读它**（全仓库提到它的只有 md），映射里 6 个场景已退役、
 *      8 个现存场景没有映射。真正生效的只有 `.mcp.json` / `.mcp.json.full` + `npm run mcp:switch`。
 *   2. `docs/tools-inventory.md` —— 802 行手写机器状态，自己跟自己都对不上（MCP 13 / 14 / 18，
 *      命令 89 / 95，skills 37 / 39，场景 18 / 26 / 27 / 28），工具矩阵里还有早就删除的
 *      `env-leak-scanner`，工作流列写着已退役的 `hunt` / `audit`。
 *
 * 两样都整份删除。本文件守着三件事：
 *   A. 删掉的东西不许复活（文件不存在，且没有代码去读它）；
 *   B. 活文档不许再把它们写成还在生效 —— 只有台账（progress / DECISIONS / CHANGELOG）
 *      与带「归档」横幅的历史提案允许出现这些死名字；
 *   C. 顺手把同一类「文档里点名的文件根本不存在」的病根堵住：活文档里点名的
 *      `.claude/rules/*.md` 必须真的存在，入口文档里的相对链接必须能解析。
 *
 * 每条判断都带「自证非空跑」的下限断言 —— 一个结构上不可能失败的检查等于假证据。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** 已退役的产物：文件必须不存在，且不许有任何代码去读它。 */
const RETIRED = [
  {
    path: '.claude/mcp-enable.json',
    why: '没有任何代码读取；24 条映射里 6 条指向已退役场景、8 个现存场景没有映射',
  },
  {
    path: 'docs/tools-inventory.md',
    why: '802 行手写快照，内部自相矛盾，还写着已退役场景与已删除工具',
  },
];

/**
 * 台账：记录「哪一轮删了什么、为什么」。它们是历史，不是现状，必须允许出现死名字。
 * 这是一份**文件**白名单，不是**路径**白名单 —— 新增一份文档提到死名字只会变红，
 * 逼着人当场决定「这是历史记录还是又一份假文档」。
 */
const HISTORY = new Set(['progress.md', 'DECISIONS.md', 'docs/CHANGELOG.md']);

const ENTRY_DOCS = ['README.md', 'README_EN.md', 'ARCHITECTURE.md', 'INSTALL.md', 'CLAUDE.md', 'AGENTS.md'];
const DOC_DIRS = ['docs', join('.claude', 'rules'), join('.claude', 'scenes'), join('.claude', 'commands')];
const CODE_DIRS = ['claude-scene/src', 'scripts', '.husky'];
const CODE_EXTS = ['.js', '.cjs'];
const ARCHIVED_MARK = '> **归档**';
const SELF = 'claude-scene/src/commands/retired-artifacts.test.js';

const rel = (file) => file.slice(ROOT.length + 1).split(String.fromCodePoint(92)).join('/');

function walk(dir, ext, out, sink) {
  const files = out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, files, sink);
    else if (ext.some((e) => entry.name.endsWith(e))) files.push(full);
  }
  return sink ? sink(files) : files;
}

const docsIn = (dir) => walk(join(ROOT, dir), ['.md'], [], (files) => files);

/** 全部「现行文档」：入口文档 + docs/ 与 .claude/{rules,scenes,commands} 下的 md。 */
function allDocs() {
  return [...ENTRY_DOCS.map((f) => join(ROOT, f)), ...DOC_DIRS.flatMap((dir) => docsIn(dir))];
}

/** 现行 = 去掉台账与带「归档」横幅的历史提案。 */
function liveDocs() {
  return allDocs().filter((file) => {
    if (HISTORY.has(rel(file))) return false;
    return !readFileSync(file, 'utf8').includes(ARCHIVED_MARK);
  });
}

function codeFiles() {
  const files = CODE_DIRS.flatMap((dir) => walk(join(ROOT, dir), CODE_EXTS, []));
  return [...files, join(ROOT, 'package.json')];
}

describe('已退役的配置 / 文档不许复活', () => {
  for (const { path: target, why } of RETIRED) {
    it(`${target} 必须不存在（${why}）`, () => {
      expect(existsSync(join(ROOT, target)), `${target} 又回来了`).toBe(false);
    });
  }

  it('没有任何代码去读退役文件（注释里交代历史不算「读」）', () => {
    const files = codeFiles();
    // 自证非空跑：源码目录读不到东西时这条断言会变成永远为真的假证据
    expect(files.length).toBeGreaterThan(80);

    const offenders = [];
    for (const file of files) {
      // 本文件自己持有退役名单（RETIRED 里的 path 字符串）—— 它不读这些路径，
      // 只是在断言它们不存在。真正的「读」发生在别的文件，那里不会被放过。
      if (rel(file) === SELF) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const [index, line] of lines.entries()) {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue;
        for (const { path: target } of RETIRED) {
          const base = target.split('/').pop();
          if (line.includes(base)) offenders.push(`${rel(file)}:${index + 1}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('活文档不许再把退役机制写成还在生效', () => {
    const docs = liveDocs();
    expect(docs.length).toBeGreaterThan(40);

    const offenders = [];
    for (const file of docs) {
      const text = readFileSync(file, 'utf8');
      for (const { path: target } of RETIRED) {
        const base = target.split('/').pop();
        if (text.includes(base)) offenders.push(`${rel(file)} 提到 ${base}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('文档里点名的东西必须存在', () => {
  // 只认「真文件路径」：`x.md.bak` 这类备份名不算（负向先行断言排除 . 与词字符）
  const RULE_REF = /\.claude\/rules\/[\w/-]+\.md(?![.\w-])/g;

  it('活文档点名的 .claude/rules/*.md 必须存在', () => {
    const refs = [];
    for (const file of liveDocs()) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(RULE_REF)) refs.push({ file: rel(file), ref: match[0] });
    }
    // 自证非空跑：一条都匹配不到时，下面的断言什么也没验证
    expect(refs.length).toBeGreaterThan(3);

    const missing = refs
      // 引用可能带 `../../` 前缀（相对文档自身位置），一律按仓库根解析
      .filter(({ ref }) => {
        const fromRoot = ref.slice(ref.indexOf('.claude/'));
        return !existsSync(join(ROOT, fromRoot));
      })
      .map(({ file, ref }) => `${file} → ${ref}`);
    expect(missing).toEqual([]);
  });

  const LINK = /\]\(([^)\s]+)\)/g;

  it('入口文档里的相对链接必须能解析', () => {
    const dead = [];
    let scanned = 0;

    for (const name of ENTRY_DOCS) {
      const file = join(ROOT, name);
      for (const match of readFileSync(file, 'utf8').matchAll(LINK)) {
        const target = match[1];
        const external = /^[a-z]+:/i.test(target) || target.startsWith('#') || target.includes('*');
        if (external) continue;
        const localPath = decodeURIComponent(target.split('#')[0]);
        if (!localPath) continue;
        scanned += 1;
        if (!existsSync(join(dirname(file), localPath))) dead.push(`${name} → ${target}`);
      }
    }

    expect(scanned).toBeGreaterThan(20);
    expect(dead).toEqual([]);
  });
});
