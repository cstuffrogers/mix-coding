import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// 这些用例固化的是「不能悄悄吃掉用户记忆」的几条底线：
// 去重指纹必须看完整内容、超容量要归档而不是删除、截断要显式标记、
// 计数不能把历史垃圾算成本项目。
describe('记忆存储卫生', () => {
  let root;
  const ENV = ['CLAUDE_MEM_HOME', 'AGENTMEMORY_HOME', 'NEXO_HOME', 'CODEGRAPH_HOME'];
  const saved = {};

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'memstore-'));
    for (const key of ENV) {
      saved[key] = process.env[key];
      process.env[key] = join(root, key.toLowerCase());
    }
  });

  afterEach(() => {
    for (const key of ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(root, { recursive: true, force: true });
  });

  const pad = 'w'.repeat(300);

  it('去重看完整内容：前 200 字符相同但内容不同，两条都要落盘', async () => {
    const { saveProjectMemory, loadProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'proj');
    const a = saveProjectMemory('review', { note: pad, id: 'AAA' }, {}, proj);
    const b = saveProjectMemory('review', { note: pad, id: 'BBB' }, {}, proj);
    expect(a.id).not.toBe(b.id);
    expect(loadProjectMemories('review', proj)).toHaveLength(2);
  });

  it('内容完全相同才判重复，并标 duplicate 让调用方如实说明', async () => {
    const { saveProjectMemory, loadProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'proj');
    const data = { note: pad, id: 'SAME' };
    const first = saveProjectMemory('review', data, {}, proj);
    const second = saveProjectMemory('review', data, {}, proj);
    expect(first.duplicate).not.toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
    expect(loadProjectMemories('review', proj)).toHaveLength(1);
  });

  it('deduplicate 只删真正重复的，且保留最新的那条', async () => {
    const { deduplicateProjectMemories, loadProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'proj');
    const dir = join(proj, '.claude', 'memory', 'review');
    mkdirSync(dir, { recursive: true });
    const write = (id, data, ts) => writeFileSync(
      join(dir, `${id}.json`),
      JSON.stringify({ id, type: 'review', data, timestamp: ts }),
    );
    // 前 100 字符相同、内容不同 → 不能删
    write('a1', { note: pad, id: 'AAA' }, '2026-01-01T00:00:00.000Z');
    write('b1', { note: pad, id: 'BBB' }, '2026-01-02T00:00:00.000Z');
    // 与 a1 完全相同、但时间更早 → 删旧的，留新的
    write('a0', { note: pad, id: 'AAA' }, '2025-12-01T00:00:00.000Z');

    const result = deduplicateProjectMemories(proj);
    expect(result.removed).toBe(1);
    expect(result.kept).toBe(2);
    const left = loadProjectMemories('review', proj).map(m => m.id);
    expect(left).toContain('a1');
    expect(left).toContain('b1');
    expect(left).not.toContain('a0');
  });

  it('data 为空的历史条目在整理时一律不动', async () => {
    const { deduplicateProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'proj');
    const dir = join(proj, '.claude', 'memory', 'review');
    mkdirSync(dir, { recursive: true });
    for (const id of ['n1', 'n2']) {
      writeFileSync(join(dir, `${id}.json`), JSON.stringify({ id, type: 'review', timestamp: '2026-01-01T00:00:00.000Z' }));
    }
    const result = deduplicateProjectMemories(proj);
    expect(result.removed).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it('markdown 归档超容量时按 mtime 删最旧，而不是按文件名', async () => {
    const { writeClaudeMemMarkdown } = await import('./claude-mem.js');
    const mdDir = join(process.env.CLAUDE_MEM_HOME, 'memory');
    mkdirSync(mdDir, { recursive: true });
    // aaa-* 更旧、zzz-* 更新：按文件名排会先砍 zzz（错的），按 mtime 才会砍 aaa
    for (let i = 0; i < 120; i++) {
      const name = `aaa-2026-01-01T00-00-00-${String(i).padStart(3, '0')}Z.md`;
      writeFileSync(join(mdDir, name), `# aaa\n\n- 路径: 未标注\n\nold-${i}\n`);
      const t = new Date(Date.now() - 86400000 - i * 1000);
      utimesSync(join(mdDir, name), t, t);
    }
    for (let i = 0; i < 5; i++) {
      const name = `zzz-2026-02-01T00-00-00-${String(i).padStart(3, '0')}Z.md`;
      writeFileSync(join(mdDir, name), `# zzz\n\n- 路径: 未标注\n\nnew-${i}\n`);
      const t = new Date(Date.now() - i * 1000);
      utimesSync(join(mdDir, name), t, t);
    }
    writeClaudeMemMarkdown('general', { tag: 'trigger' });

    const left = readdirSync(mdDir).filter(f => f.endsWith('.md'));
    expect(left).toHaveLength(100);
    expect(left.filter(f => f.startsWith('zzz-'))).toHaveLength(5);
    expect(left.filter(f => f.startsWith('general-'))).toHaveLength(1);
    // 被删的要留痕，不能无声无息
    const log = join(process.env.CLAUDE_MEM_HOME, 'archive', 'markdown-pruned.log');
    expect(existsSync(log)).toBe(true);
    expect(readFileSync(log, 'utf-8')).toContain('aaa-');
  });

  it('markdown 读回截断时显式标 truncated，避免被回写成完整记忆', async () => {
    const { writeClaudeMemMarkdown, readClaudeMemMarkdown } = await import('./claude-mem.js');
    writeClaudeMemMarkdown('decision', { body: 'Q'.repeat(800) });
    const record = readClaudeMemMarkdown().find(m => m.file.startsWith('decision-'));
    expect(record.content).toHaveLength(500);
    expect(record.truncated).toBe(true);
    expect(record.length).toBeGreaterThan(500);
  });

  it('claude-mem items 超上限时把被移出的条目归档，不是静默删除', async () => {
    const { writeClaudeMemItem, readClaudeMemItems } = await import('./claude-mem.js');
    const scope = { path: join(root, 'p'), name: 'p' };
    writeClaudeMemItem('general', { id: 'OLDEST', data_snippet: 'first' }, scope);
    for (let i = 0; i < 505; i++) writeClaudeMemItem('general', { id: `n${i}`, data_snippet: `s${i}` }, scope);

    expect(readClaudeMemItems('general')).toHaveLength(500);
    const archive = join(process.env.CLAUDE_MEM_HOME, 'archive', 'general-items.jsonl');
    expect(existsSync(archive)).toBe(true);
    const archived = readFileSync(archive, 'utf-8');
    expect(archived).toContain('OLDEST');
    expect(archived).toContain('archived_at');
  });

  it('危险 type 被收敛成安全目录名，不会写到别的目录', async () => {
    const { saveProjectMemory, loadProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'proj');
    const entry = saveProjectMemory('../../escaped', { x: 1 }, {}, proj);
    expect(entry.type).toBe('escaped');
    expect(existsSync(join(root, 'escaped'))).toBe(false);
    expect(loadProjectMemories('../../escaped', proj)).toHaveLength(1);
    expect(loadProjectMemories('escaped', proj)).toHaveLength(1);
  });

  it('codegraph 按 targetPath 定位，目标项目没有库时返回空而不读引擎自己的', async () => {
    const { codegraphDbPath, queryCodeGraph } = await import('./codegraph.js');
    delete process.env.CODEGRAPH_HOME;
    const target = join(root, 'target');
    mkdirSync(target, { recursive: true });
    expect(codegraphDbPath(target).replaceAll('\\', '/')).toContain('/target/.codegraph/codegraph.db');
    expect(queryCodeGraph(5, target).nodes).toBe(0);
  });

  it('列表计数区分本项目 / 无归属 / 其他项目', async () => {
    const { writeAgentmemory } = await import('./agentmemory.js');
    const { handleListMemories } = await import('../memory.js');
    const proj = join(root, 'proj');
    writeAgentmemory('general', { tag: 'mine' }, [], proj);
    writeAgentmemory('general', { tag: 'other' }, [], join(root, 'other'));
    writeAgentmemory('general', { tag: 'legacy' }, [], '');

    const msg = await handleListMemories('listMemories', {}, proj);
    expect(msg).toContain('本项目 1');
    expect(msg).toContain('无归属 1');
    expect(msg).toContain('其他 1');
  });
});
