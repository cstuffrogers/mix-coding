import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncAllDocs } from './sync-docs.js';

const LF = String.fromCodePoint(10);
const CR = String.fromCodePoint(13);
const CRLF = CR + LF;
const README_TARGET = '/.claude/scenes/README.md#SCENE-TABLE';

let root;

function scene(id, description) {
  return JSON.stringify({ scene_id: id, description, flow: [{ step: 1, action: 'noop' }] });
}

function tableSection(name, body) {
  return [
    `<!-- AUTO-SYNC:${name}-START -->`,
    body,
    `<!-- AUTO-SYNC:${name}-END -->`,
  ].join(LF);
}

function buildProject({ readmeEol = LF, withReadmeMarkers = true, claudeMd, inventory } = {}) {
  mkdirSync(join(root, '.claude', 'scenes'), { recursive: true });
  writeFileSync(join(root, '.claude', 'scenes', 'a-scene.json'), scene('a-scene', '甲场景'));
  writeFileSync(join(root, '.claude', 'scenes', 'b-scene.json'), scene('b-scene', '乙场景'));

  const readmeBody = withReadmeMarkers
    ? `# 场景表${LF}${LF}${tableSection('SCENE-TABLE', '| 旧 | 旧 | 旧 |')}${LF}`
    : `# 场景表${LF}${LF}| 旧 | 旧 | 旧 |${LF}`;
  writeFileSync(join(root, '.claude', 'scenes', 'README.md'), readmeBody.split(LF).join(readmeEol));

  if (claudeMd !== undefined) writeFileSync(join(root, 'CLAUDE.md'), claudeMd.split(LF).join(readmeEol));
  if (inventory !== undefined) {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'tools-inventory.md'), inventory.split(LF).join(LF));
  }
}

const allBuckets = (report) => [
  ...report.updated, ...report.unchanged, ...report.missingMarker, ...report.missingFile, ...report.manual,
];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'syncdocs-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('syncAllDocs —— 行尾与报表', () => {
  it('CRLF 文件里的 AUTO-SYNC 标记不会被误报成缺失', () => {
    buildProject({ readmeEol: CRLF });

    // 自证非空跑：夹具确实用的是 CRLF，否则这条测试什么也没验证
    expect(readFileSync(join(root, '.claude', 'scenes', 'README.md'), 'utf8')).toContain(CRLF);

    const report = syncAllDocs(root);

    expect(report.missingMarker).not.toContain(README_TARGET);
    expect(report.updated).toContain(README_TARGET);
  });

  it('写回保持原文件行尾，不把 CRLF 文件改成混合行尾', () => {
    buildProject({ readmeEol: CRLF });
    syncAllDocs(root);

    const content = readFileSync(join(root, '.claude', 'scenes', 'README.md'), 'utf8');
    expect(content.split(CRLF).join('')).not.toContain(LF); // 不许出现裸 LF
    expect(content).toContain('a-scene'); // 表格真的刷进去了，不是原样跳过
  });

  it('真缺标记仍然报 missingMarker（不因修了 CRLF 就一律放行）', () => {
    buildProject({ withReadmeMarkers: false });
    const report = syncAllDocs(root);
    expect(report.missingMarker).toContain(README_TARGET);
    expect(report.updated).not.toContain(README_TARGET);
  });

  it('LF 文件同样能同步（不是把 CRLF 特例写法顶替掉通用路径）', () => {
    buildProject({ readmeEol: LF });
    const report = syncAllDocs(root);
    expect(report.updated).toContain(README_TARGET);
  });
});

describe('syncAllDocs —— 人工托管桶', () => {
  it('CLAUDE.md 没有标记时归 manual，不算缺失', () => {
    buildProject({ claudeMd: `# 项目${LF}${LF}| /review | 审查 |${LF}` });
    const report = syncAllDocs(root);

    expect(report.manual).toContain('/CLAUDE.md#WORKFLOW-TABLE');
    expect(report.manual).toContain('/CLAUDE.md#SKIP-ENHANCEMENT-LIST');
    expect(report.missingMarker).not.toContain('/CLAUDE.md#WORKFLOW-TABLE');
  });

  it('CLAUDE.md 一旦加了标记就自动接管，不再留在 manual', () => {
    const claudeMd = [
      '# 项目',
      '',
      tableSection('WORKFLOW-TABLE', '| 旧 |'),
      '',
      tableSection('SKIP-ENHANCEMENT-LIST', '旧清单'),
      '',
    ].join(LF);
    buildProject({ claudeMd });
    const report = syncAllDocs(root);

    expect(report.manual).toEqual([]);
    expect(report.updated).toContain('/CLAUDE.md#WORKFLOW-TABLE');
    expect(report.updated).toContain('/CLAUDE.md#SKIP-ENHANCEMENT-LIST');
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toContain('/a-scene');
  });
});

describe('syncAllDocs —— 不留僵尸目标', () => {
  it('不会再报 .claude/rules/workflows.md 缺失（那个文件早就不存在）', () => {
    buildProject({ claudeMd: `# 项目${LF}`, inventory: `# 清单${LF}${LF}共 25 个场景${LF}` });
    const report = syncAllDocs(root);

    const targets = allBuckets(report);
    expect(targets.length).toBeGreaterThan(0); // 自证非空跑
    expect(targets.some((t) => t.includes('workflows.md'))).toBe(false);
    expect(report.missingFile).toEqual([]);
  });

  it('场景计数按实际数量刷新', () => {
    buildProject({ inventory: `# 清单${LF}${LF}共 25 个场景${LF}` });
    const report = syncAllDocs(root);

    expect(report.updated).toContain('tools-inventory.md#场景计数');
    expect(readFileSync(join(root, 'docs', 'tools-inventory.md'), 'utf8')).toContain('2 个场景');
  });

  it('目录锚点里的场景数也会跟着改（#25-个场景 这种写法以前漏掉，链接静默失效）', () => {
    // 正文数字已经是对的，错的只有目录锚点 —— 旧实现看到正文数字相等就早退，
    // 这种「半对」的文件永远修不了。
    const inventory = [
      '# 清单',
      '',
      '5. [2 个场景工作流](#25-个场景工作流scene-json--command-markdown)',
      '',
    ].join(LF);
    buildProject({ inventory });
    syncAllDocs(root);

    const content = readFileSync(join(root, 'docs', 'tools-inventory.md'), 'utf8');
    expect(content).toContain('[2 个场景工作流](#2-个场景工作流');
    expect(content).not.toContain('#25-个场景');
  });

  it('没有 .claude/scenes 时如实报 missingFile，而不是装作同步成功', () => {
    writeFileSync(join(root, 'CLAUDE.md'), `# 项目${LF}`);
    const report = syncAllDocs(root);

    expect(report.missingFile).toContain('.claude/scenes');
    expect(existsSync(join(root, '.claude', 'scenes'))).toBe(false);
  });
});
