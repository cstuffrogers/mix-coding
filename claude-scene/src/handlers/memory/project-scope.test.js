import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  normalizeProjectPath,
  projectScope,
  classifyScope,
  includeInRecall,
} from './project-scope.js';

describe('normalizeProjectPath', () => {
  it('统一分隔符，Windows 反斜杠与正斜杠视为同一路径', () => {
    const a = normalizeProjectPath('E:\\work\\app');
    const b = normalizeProjectPath('E:/work/app');
    expect(a).toBe(b);
    expect(a).not.toContain('\\');
  });

  it('去掉尾随分隔符', () => {
    expect(normalizeProjectPath('E:/work/app/')).toBe(normalizeProjectPath('E:/work/app'));
  });

  it('解析成绝对路径：相对路径不能原样存库', () => {
    const relative = normalizeProjectPath('.');
    expect(relative.length).toBeGreaterThan(1);
    expect(relative).not.toBe('.');
  });

  it('Windows 上大小写不敏感，同一项目不会分裂成两份记忆', () => {
    const lower = normalizeProjectPath('E:/Work/App');
    const upper = normalizeProjectPath('E:/work/app');
    if (process.platform === 'win32') {
      expect(lower).toBe(upper);
    } else {
      expect(lower).not.toBe(upper);
    }
  });

  it('空值/非字符串返回空串，不会炸', () => {
    expect(normalizeProjectPath('')).toBe('');
    expect(normalizeProjectPath(null)).toBe('');
    expect(normalizeProjectPath()).toBe('');
    expect(normalizeProjectPath(42)).toBe('');
  });
});

describe('projectScope', () => {
  it('给出 path / name / slug', () => {
    const scope = projectScope('E:/work/my-app');
    expect(scope.path).toBe(normalizeProjectPath('E:/work/my-app'));
    expect(scope.name).toBe('my-app');
    expect(scope.slug).toBe('my-app');
  });

  it('目录名的特殊字符被收敛成 slug', () => {
    expect(projectScope('E:/work/my app (v2)').slug).toBe('my-app-v2');
  });

  it('缺省回落到 PROJECT_ROOT，不会返回空作用域', () => {
    expect(projectScope().path.length).toBeGreaterThan(1);
  });
});

describe('classifyScope', () => {
  const current = projectScope('E:/work/app');

  it('同一项目 → project', () => {
    expect(classifyScope('E:\\work\\app', current)).toBe('project');
  });

  it('别的项目 → cross-project', () => {
    expect(classifyScope('E:/work/other', current)).toBe('cross-project');
  });

  it('没有归属信息 → unscoped（打标前的历史数据）', () => {
    expect(classifyScope('', current)).toBe('unscoped');
    expect(classifyScope(undefined, current)).toBe('unscoped');
  });
});

describe('includeInRecall', () => {
  it('本项目与无归属默认召回，其他项目默认排除', () => {
    expect(includeInRecall('project')).toBe(true);
    expect(includeInRecall('unscoped')).toBe(true);
    expect(includeInRecall('cross-project')).toBe(false);
  });

  it('cross_project 显式开启才纳入其他项目', () => {
    expect(includeInRecall('cross-project', { crossProject: true })).toBe(true);
  });
});

// 端到端：两个沙箱项目 + 沙箱全局库，验证「A 写的记忆不会出现在 B 的召回里」
describe('跨项目记忆隔离（真实落盘）', () => {
  let root;
  let env;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mems-cope-'));
    env = {
      CLAUDE_MEM_HOME: join(root, 'claude-mem'),
      AGENTMEMORY_HOME: join(root, 'agentmemory'),
      NEXO_HOME: join(root, 'nexo'),
    };
    process.env.CLAUDE_MEM_HOME = env.CLAUDE_MEM_HOME;
    process.env.AGENTMEMORY_HOME = env.AGENTMEMORY_HOME;
    process.env.NEXO_HOME = env.NEXO_HOME;
  });

  afterEach(() => {
    delete process.env.CLAUDE_MEM_HOME;
    delete process.env.AGENTMEMORY_HOME;
    delete process.env.NEXO_HOME;
    rmSync(root, { recursive: true, force: true });
  });

  it('全局后端写入带项目绝对路径，project-memory 落在项目自己的目录', async () => {
    const { handleMemoryRemember } = await import('../memory.js');
    const projA = join(root, 'projA');
    const marker = 'ZZSCOPE-A';
    await handleMemoryRemember('remember', { type: 'general', data: { tag: marker } }, projA, {});

    // project-memory 是项目级
    expect(existsSync(join(projA, '.claude', 'memory', 'general'))).toBe(true);

    // claude-mem items 带 project.path
    const itemsFile = join(env.CLAUDE_MEM_HOME, 'areas', 'topics', 'general', 'items.json');
    const items = JSON.parse(readFileSync(itemsFile, 'utf-8'));
    const hit = items.find(i => JSON.stringify(i).includes(marker));
    expect(hit.project.path).toBe(normalizeProjectPath(projA));

    // claude-mem markdown 头部写路径
    const mdDir = join(env.CLAUDE_MEM_HOME, 'memory');
    const mdFile = readdirSync(mdDir).find(f => f.endsWith('.md'));
    expect(readFileSync(join(mdDir, mdFile), 'utf-8')).toContain(normalizeProjectPath(projA));

    // NEXO 事件带 project
    const nexoFiles = readdirSync(join(env.NEXO_HOME, 'runtime'));
    const events = nexoFiles.map(f => JSON.parse(readFileSync(join(env.NEXO_HOME, 'runtime', f), 'utf-8')));
    expect(events.some(e => e.project?.path === normalizeProjectPath(projA))).toBe(true);
  });

  it('B 项目召回不到 A 项目的记录，A 自己能召回', async () => {
    const { handleMemoryRemember, handleMemoryRecall } = await import('../memory.js');
    const projA = join(root, 'projA');
    const projB = join(root, 'projB');
    const marker = 'ZZSCOPE-ONLY-A';
    await handleMemoryRemember('remember', { type: 'general', data: { tag: marker } }, projA, {});

    const ctxA = {};
    await handleMemoryRecall('recall', { mode: 'full', limit: 40 }, projA, ctxA);
    const hitsA = (ctxA.recalled_memories || []).filter(r => JSON.stringify(r).includes(marker));
    expect(hitsA.length).toBeGreaterThan(0);
    // 四个写入后端都能召回（project-memory + 3 个全局）
    const sourcesA = new Set(hitsA.map(r => r.source));
    expect(sourcesA.has('project-memory')).toBe(true);
    expect(sourcesA.has('agentmemory')).toBe(true);

    const ctxB = {};
    await handleMemoryRecall('recall', { mode: 'full', limit: 40 }, projB, ctxB);
    const hitsB = (ctxB.recalled_memories || []).filter(r => JSON.stringify(r).includes(marker));
    expect(hitsB).toHaveLength(0);
  });

  it('cross_project 显式开启才跨项目召回', async () => {
    const { handleMemoryRemember, handleMemoryRecall } = await import('../memory.js');
    const projA = join(root, 'projA');
    const projB = join(root, 'projB');
    const marker = 'ZZSCOPE-CROSS';
    await handleMemoryRemember('remember', { type: 'general', data: { tag: marker } }, projA, {});

    const ctx = {};
    await handleMemoryRecall('recall', { mode: 'full', limit: 40, cross_project: true }, projB, ctx);
    const hits = (ctx.recalled_memories || []).filter(r => JSON.stringify(r).includes(marker));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(r => r.scope === 'cross-project')).toBe(true);
  });

  it('回写堵截：别的项目的召回行不会被 remember 认领成本项目的记忆', async () => {
    const { handleMemoryRemember } = await import('../memory.js');
    const projB = join(root, 'projB');
    const ctx = {
      recalled_memories: [
        { source: 'agentmemory', scope: 'cross-project', content: 'ZZSCOPE-FOREIGN', timestamp: 'x' },
        { source: 'agentmemory', scope: 'unscoped', content: 'ZZSCOPE-LEGACY', timestamp: 'x' },
        { source: 'project-memory', scope: 'project', content: 'ZZSCOPE-MINE', timestamp: 'x' },
      ],
    };
    await handleMemoryRemember('remember', { type: 'general' }, projB, ctx);
    const itemsFile = join(env.CLAUDE_MEM_HOME, 'areas', 'topics', 'general', 'items.json');
    const stored = readFileSync(itemsFile, 'utf-8');
    expect(stored).toContain('ZZSCOPE-MINE');
    expect(stored).not.toContain('ZZSCOPE-FOREIGN');
    expect(stored).not.toContain('ZZSCOPE-LEGACY');
  });

  it('无归属的历史记录仍会召回，但被标记为 unscoped 并在消息里说明', async () => {
    const { writeClaudeMemItem } = await import('./claude-mem.js');
    const { handleMemoryRecall } = await import('../memory.js');
    // 老数据：没有 project 字段
    writeClaudeMemItem('general', { id: 'legacy1', type: 'general', data_snippet: 'ZZSCOPE-LEGACY-ROW' });
    const ctx = {};
    const msg = await handleMemoryRecall('recall', { mode: 'full', limit: 40 }, join(root, 'projC'), ctx);
    const hits = (ctx.recalled_memories || []).filter(r => JSON.stringify(r).includes('ZZSCOPE-LEGACY-ROW'));
    expect(hits).toHaveLength(1);
    expect(hits[0].scope).toBe('unscoped');
    expect(msg).toContain('未标归属');
  });
});
