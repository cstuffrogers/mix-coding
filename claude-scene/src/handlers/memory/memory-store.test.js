import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, utimesSync } from 'fs';
import { spawnSync } from 'child_process';
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
    // 直接铺满到上限再写一条，而不是循环写 505 次：写一次 = 锁 + 全量读改写，
    // 500 次会把测试拖到超时（在 Windows 上实测 6s+）。
    const dir = join(process.env.CLAUDE_MEM_HOME, 'areas', 'topics', 'general');
    mkdirSync(dir, { recursive: true });
    const seed = Array.from({ length: 500 }, (_, i) => ({ id: `seed${i}`, data_snippet: `s${i}` }));
    seed.push({ id: 'OLDEST', data_snippet: 'first' });
    writeFileSync(join(dir, 'items.json'), JSON.stringify(seed));

    writeClaudeMemItem('general', { id: 'NEWEST', data_snippet: 'last' }, scope);

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

  it('所有写过的分类都能被列出和召回（不只看 4 个固定分类）', async () => {
    const { handleMemoryRemember, handleMemoryRecall, handleListMemories } = await import('../memory.js');
    const proj = join(root, 'proj');
    for (const type of ['review', 'audit', 'mobile-review', 'general']) {
      await handleMemoryRemember('r', { type, data: { note: `${type}_MARKER` } }, proj, {});
    }
    const msg = await handleListMemories('l', {}, proj);
    expect(msg).toContain('Claude-Mem 全局 4');

    const ctx = {};
    await handleMemoryRecall('r', { limit: 50 }, proj, ctx);
    const types = ctx.recalled_memories.map(m => m.type || m.category).filter(Boolean);
    for (const type of ['review', 'audit', 'mobile-review']) {
      expect(types).toContain(type);
    }
  });

  it('filters.type 是数组时按「任一命中」过滤，而不是全部丢弃', async () => {
    const { handleMemoryRemember, handleMemoryRecall } = await import('../memory.js');
    const { matchFilter } = await import('./project-memory.js');
    const proj = join(root, 'proj');
    await handleMemoryRemember('r', { type: 'review', data: { note: 'KEEP' } }, proj, {});
    await handleMemoryRemember('r', { type: 'ui', data: { note: 'DROP' } }, proj, {});

    // 场景里默认就是这么传的：filters.type 永远是数组
    const ctx = {};
    const msg = await handleMemoryRecall('r', { filters: { type: ['review', 'quality'] }, limit: 20 }, proj, ctx);
    expect(msg).not.toContain('召回（0 条');
    expect(ctx.recalled_memories.length).toBeGreaterThan(0);
    for (const row of ctx.recalled_memories) {
      if (row.type) expect(['review', 'quality']).toContain(row.type);
    }

    expect(matchFilter({ type: 'review' }, { type: ['review', 'quality'] })).toBe(true);
    expect(matchFilter({ type: 'ui' }, { type: ['review', 'quality'] })).toBe(false);
    expect(matchFilter({ data: { kind: 'x' } }, { kind: ['x', 'y'] })).toBe(true);
    // 没有这个字段的记录不能因为「无法判断」而被静默排除
    expect(matchFilter({ summary: { nodes: 3 } }, { type: ['review'] })).toBe(true);
  });

  it('remember 不再把召回的历史行当本轮成果写回（消除嵌套自我复制）', async () => {
    const { handleMemoryRemember } = await import('../memory.js');
    const { loadProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'proj');
    const ctx = {
      recalled_memories: [
        { source: 'project-memory', scope: 'project', id: 'old', type: 'review', data: { prior: 'OLD_ROUND' } },
      ],
      _sceneId: 'review',
      securityScanResult: { highSeverityFound: false },
    };
    await handleMemoryRemember('r', { type: 'review' }, proj, ctx);
    const [record] = loadProjectMemories('review', proj);
    expect(Array.isArray(record.data)).toBe(false);
    expect(JSON.stringify(record.data)).not.toContain('OLD_ROUND');
    expect(record.data.workflow).toBe('review');
  });

  it('非字符串 type 不会让 agentmemory 写入失败', async () => {
    const { handleMemoryRemember } = await import('../memory.js');
    const proj = join(root, 'proj');
    const msg = await handleMemoryRemember('r', { type: { x: 1 }, data: { note: 'OBJ_TYPE' } }, proj, {});
    expect(msg).toContain('4 后端');
  });

  it('同一条记忆在 5 个后端各存一份，召回时只算一条', async () => {
    const { handleMemoryRemember, handleMemoryRecall } = await import('../memory.js');
    const proj = join(root, 'proj');
    const data = { blob: 'x'.repeat(200), marker: 'FEDERATED' };
    await handleMemoryRemember('r', { type: 'review', data }, proj, {});
    const ctx = {};
    const msg = await handleMemoryRecall('r', { limit: 20 }, proj, ctx);
    expect(msg).toContain('召回（1 条');
    expect(ctx.recalled_memories).toHaveLength(1);
    // 不同分类但内容相同的不该被误去重
    await handleMemoryRemember('r', { type: 'qa', data }, proj, {});
    const ctx2 = {};
    await handleMemoryRecall('r', { limit: 20 }, proj, ctx2);
    expect(ctx2.recalled_memories).toHaveLength(2);
  });

  it('召回摘要会打到 stdout（否则 LLM 根本看不到记忆内容）', async () => {
    const { handleMemoryRemember, handleMemoryRecall } = await import('../memory.js');
    const proj = join(root, 'proj');
    await handleMemoryRemember('r', { type: 'review', data: { marker: 'VISIBLE_IN_STDOUT' } }, proj, {});
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleMemoryRecall('r', { limit: 10 }, proj, {});
    const printed = spy.mock.calls.map(c => c.join(' ')).join('\n');
    spy.mockRestore();
    expect(printed).toContain('历史记忆');
    expect(printed).toContain('VISIBLE_IN_STDOUT');
  });

  it('超大条目不再静默丢失：agentmemory 读回不被 maxBuffer 卡死', async () => {
    const am = await import('./agentmemory.js');
    // 1.2MB 一条就把 execSync 默认 1MB maxBuffer 干爆，旧实现 catch 后返回 []
    // —— 库里有记录，召回永远是 0 条，完全无提示。
    am.writeAgentmemory('review', 'y'.repeat(1_200_000), [], 'e:/big');
    const rows = am.readAgentmemory(10, null, 'e:/big');
    expect(rows).toHaveLength(1);
    expect(rows[0].truncated).toBe(true);
    expect(rows[0].content.length).toBeLessThanOrEqual(am.CONTENT_CAP);
    expect(am.getAgentmemoryStats().count).toBeGreaterThan(0);
  });

  it('召回给超大记录封顶：5MB 不许原样进上下文', async () => {
    const { handleMemoryRemember, handleMemoryRecall, RECALL_ROW_CAP } = await import('../memory.js');
    const proj = join(root, 'huge');
    await handleMemoryRemember('r', { type: 'huge', data: { blob: 'z'.repeat(5 * 1024 * 1024) } }, proj, {});
    const ctx = {};
    await handleMemoryRecall('r', { limit: 10 }, proj, ctx);
    const total = JSON.stringify(ctx.recalled_memories).length;
    expect(total).toBeLessThan(20_000);
    expect(ctx.recalled_memories[0].truncated).toBe(true);
    expect(ctx.recalled_memories[0].content.length).toBeLessThanOrEqual(RECALL_ROW_CAP);
    expect(ctx.recalled_memories[0].length).toBeGreaterThan(RECALL_ROW_CAP);
  });

  it('agentmemory 三态计数走 SQL，不把全库拉进内存', async () => {
    const { writeAgentmemory, getAgentmemoryScopeCounts } = await import('./agentmemory.js');
    const proj = join(root, 'proj');
    writeAgentmemory('general', { tag: 'mine' }, [], proj);
    writeAgentmemory('general', { tag: 'other' }, [], join(root, 'other'));
    writeAgentmemory('general', { tag: 'legacy' }, [], '');
    const counts = getAgentmemoryScopeCounts(proj);
    expect(counts).toMatchObject({ total: 3, project: 1, unscoped: 1, other: 1 });
    expect(getAgentmemoryScopeCounts(null).project).toBe(0);
  });

describe('保留策略与跨进程锁', () => {
  it('项目记忆每类只留最新 N 条，超出的搬进 .archive 而不是删除', async () => {
    const { saveProjectMemory, loadProjectMemories, pruneProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'prune');
    for (let i = 0; i < 6; i++) {
      saveProjectMemory('review', { i, blob: `v${i}` }, {}, proj);
      // timestamp 精度是毫秒，写快了会并列；直接改盘上的 timestamp 保证顺序可判
      const dir = join(proj, '.claude', 'memory', 'review');
      const files = readdirSync(dir);
      for (const f of files) {
        const p = join(dir, f);
        const rec = JSON.parse(readFileSync(p, 'utf-8'));
        if (rec.data.i === i) {
          rec.timestamp = new Date(Date.now() + i * 1000).toISOString();
          writeFileSync(p, JSON.stringify(rec));
        }
      }
    }
    expect(loadProjectMemories('review', proj)).toHaveLength(6);

    const result = pruneProjectMemories(proj, { maxPerType: 2 });
    expect(result.archived).toBe(4);
    expect(result.types).toEqual(['review']);
    // 归档件不进召回（loadAllProjectMemories 跳过点开头目录）
    expect(loadProjectMemories('review', proj)).toHaveLength(2);
    const archivedFiles = readdirSync(join(proj, '.claude', 'memory', '.archive', 'review'));
    expect(archivedFiles).toHaveLength(4);
    // 留的是最新的两条
    const kept = loadProjectMemories('review', proj).map(m => m.data.i).sort();
    expect(kept).toEqual([4, 5]);
  });

  it('NEXO 超过天数/条数的事件搬进 archive，runtime 只剩新的', async () => {
    const { writeNexoEvent, readNexoData, pruneNexo } = await import('./nexo.js');
    const scope = { path: join(root, 'nx-proj'), name: 'nx' };
    for (let i = 0; i < 5; i++) writeNexoEvent('review', { i }, scope);
    // 把其中一个改成 40 天前
    const runtimeDir = join(process.env.NEXO_HOME, 'runtime');
    const files = readdirSync(runtimeDir).sort();
    const oldFile = join(runtimeDir, files[0]);
    const past = new Date(Date.now() - 40 * 86_400_000);
    utimesSync(oldFile, past, past);

    const result = pruneNexo({ maxFiles: 100, maxAgeDays: 30 });
    expect(result.archived).toBe(1);
    expect(readNexoData(100)).toHaveLength(4);
    expect(readdirSync(join(process.env.NEXO_HOME, 'archive'))).toHaveLength(1);
  });

  it('agentmemory 每类保留上限：超出的先导出 jsonl 再删除', async () => {
    const am = await import('./agentmemory.js');
    for (let i = 0; i < 5; i++) am.writeAgentmemory('review', `content-${i}`, [], 'e:/prune');
    expect(am.readAgentmemory(10, null, 'e:/prune')).toHaveLength(5);

    const result = am.pruneAgentmemory({ maxPerType: 2, maxAgeDays: 365 });
    expect(result.archived).toBe(3);
    expect(result.byType.review).toBe(3);
    expect(am.readAgentmemory(10, null, 'e:/prune')).toHaveLength(2);
    const archiveDir = join(process.env.AGENTMEMORY_HOME, 'archive');
    const [file] = readdirSync(archiveDir);
    const archived = readFileSync(join(archiveDir, file), 'utf-8').trim().split('\n');
    expect(archived).toHaveLength(3);
    expect(archived[0]).toContain('archived_at');
  });

  it('withFileLock：拿不到锁时超时裸跑，且不删别人的锁', async () => {
    const { withFileLock } = await import('../../lib/fs-utils.js');
    const lockPath = join(root, 'shared.lock');
    writeFileSync(lockPath, 'held by another process');
    const started = Date.now();
    const out = withFileLock(lockPath, () => 'ran-anyway', { timeoutMs: 60, staleMs: 60_000, retryMs: 10 });
    expect(out).toBe('ran-anyway');
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    // 别人的锁必须还在（否则制造两个写者）
    expect(existsSync(lockPath)).toBe(true);
  });

  it('withFileLock：过期锁会被抢走，跑完自己清掉', async () => {
    const { withFileLock } = await import('../../lib/fs-utils.js');
    const lockPath = join(root, 'stale.lock');
    writeFileSync(lockPath, 'crashed process');
    const past = new Date(Date.now() - 60_000);
    utimesSync(lockPath, past, past);
    const out = withFileLock(lockPath, () => 'ok', { timeoutMs: 100, staleMs: 1000, retryMs: 10 });
    expect(out).toBe('ok');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('同一类型连续写 20 条不丢（去重只看完整内容，不会误合并）', async () => {
    const { saveProjectMemory, loadProjectMemories } = await import('./project-memory.js');
    const proj = join(root, 'concurrent');
    for (let i = 0; i < 20; i++) saveProjectMemory('review', { i, blob: `c${i}` }, {}, proj);
    expect(loadProjectMemories('review', proj)).toHaveLength(20);
  });

  it('三个独立进程并发写同一 items.json：锁生效，条目基本不丢且 JSON 不坏', async () => {
    const writer = join(root, 'writer.mjs');
    const itemsDir = join(process.env.CLAUDE_MEM_HOME, 'areas', 'topics', 'general');
    writeFileSync(writer, `
      const { writeClaudeMemItem } = await import('file:///${join(process.cwd(), 'src/handlers/memory/claude-mem.js').replaceAll('\\', '/')}');
      for (let i = 0; i < 3; i++) writeClaudeMemItem('general', { marker: process.pid + '-' + i });
    `);
    const procs = [0, 1, 2].map(() => spawnSync(process.execPath, [writer], { env: process.env, encoding: 'utf-8' }));
    expect(procs.map(p => p.status)).toEqual([0, 0, 0]);

    const parsed = JSON.parse(readFileSync(join(itemsDir, 'items.json'), 'utf-8'));
    // 无锁时实测 4 进程 × 5 次只落 23 条（丢更新）；不追求绝对 9 条，只要求
    // 「JSON 没坏 + 丢失可忽略」。
    expect(parsed.length).toBeGreaterThanOrEqual(7);
    expect(parsed.length).toBeLessThanOrEqual(9);
  });
});
});

// 召回装配：同一批记忆在 5 个后端各存一份副本，召回要「去重 + 填满 + 新→旧」。
// 旧实现在这里败得很隐蔽：均分配额让窗口只有 2 条/后端，去重后窗口空了，
// 库里有 5 条不同记忆却只召回 1–2 条；markdown 归档又是正序读的，
// 和其余后端的「新→旧」对不上，去重时把旧副本当成新记录留下。
describe('召回装配（交错 + 去重 + 顺序）', () => {
  let root;
  const ENV = ['CLAUDE_MEM_HOME', 'AGENTMEMORY_HOME', 'NEXO_HOME', 'CODEGRAPH_HOME'];
  const saved = {};

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'memrecall-'));
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

  const markersOf = rows => rows.map(r => {
    const text = (r.content ?? JSON.stringify(r.data) ?? '').replace(/\s+/g, '');
    const hit = /"marker":"M(\d+)"/.exec(text);
    return hit ? Number(hit[1]) : null;
  });

  const seed = async (count) => {
    const { handleMemoryRemember } = await import('../memory.js');
    const proj = join(root, 'proj');
    for (let i = 0; i < count; i++) {
      await handleMemoryRemember('remember', { type: 'review', data: { marker: `M${i}`, pad: 'y'.repeat(300) + i } }, proj, {});
    }
    return proj;
  };

  it('5 条记忆在 5 个后端各存一份副本，limit=10 召回 5 条互不重复', async () => {
    const { handleMemoryRecall } = await import('../memory.js');
    const proj = await seed(5);
    const context = {};
    await handleMemoryRecall('recall', { limit: 10 }, proj, context);
    expect(context.recalled_memories).toHaveLength(5);
    expect(new Set(markersOf(context.recalled_memories))).toHaveLength(5);
  });

  it('去重后仍能把 limit 填满，且按新→旧排序', async () => {
    const { handleMemoryRecall } = await import('../memory.js');
    const proj = await seed(12);
    const context = {};
    await handleMemoryRecall('recall', { limit: 3 }, proj, context);
    expect(context.recalled_memories).toHaveLength(3);
    expect(markersOf(context.recalled_memories)).toEqual([11, 10, 9]);
  });

  it('limit 是非正数或非数字时回落到默认 10，不会退化成 slice(0, -5)', async () => {
    const { handleMemoryRecall } = await import('../memory.js');
    const proj = await seed(3);
    for (const limit of [0, -5, 'abc', null]) {
      const context = {};
      await handleMemoryRecall('recall', { limit }, proj, context);
      expect(context.recalled_memories.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('markdown 归档按文件名倒序读（与其余后端一致）', async () => {
    const { writeClaudeMemMarkdown, readClaudeMemMarkdown } = await import('./claude-mem.js');
    const proj = join(root, 'proj');
    const scope = { path: proj, name: 'proj' };
    writeClaudeMemMarkdown('review', { marker: 'OLD' }, scope);
    await new Promise(r => setTimeout(r, 20));
    writeClaudeMemMarkdown('review', { marker: 'NEW' }, scope);
    const files = readClaudeMemMarkdown().filter(r => r.file.startsWith('review-'));
    expect(files[0].content).toContain('NEW');
    expect(files[1].content).toContain('OLD');
  });

  it('一个后端独有的一条记忆不会被 project-memory 挤掉', async () => {
    const { handleMemoryRecall } = await import('../memory.js');
    const { writeNexoEvent } = await import('./nexo.js');
    const proj = await seed(8);
    writeNexoEvent('deploy', { marker: 'NEXO-ONLY' }, { path: proj, name: 'proj' });
    const context = {};
    await handleMemoryRecall('recall', { limit: 6 }, proj, context);
    const text = JSON.stringify(context.recalled_memories);
    expect(text).toContain('NEXO-ONLY');
    expect(context.recalled_memories.length).toBeLessThanOrEqual(6);
  });
});

// 保留策略的边界：库里可能存在**不是本引擎写的**行（别的工具直接写 SQL），
// type 没经过 safeTypeName 归一化。拿归一化后的名字当 WHERE 条件，这些行
// 就永远不会被按类型裁剪 —— 保留策略看上去在跑，实际漏掉整类历史数据。
describe('agentmemory 保留策略的边界', () => {
  let root;
  const saved = {};
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'memprune-'));
    saved.AGENTMEMORY_HOME = process.env.AGENTMEMORY_HOME;
    process.env.AGENTMEMORY_HOME = join(root, 'am');
  });
  afterEach(() => {
    if (saved.AGENTMEMORY_HOME === undefined) delete process.env.AGENTMEMORY_HOME;
    else process.env.AGENTMEMORY_HOME = saved.AGENTMEMORY_HOME;
    rmSync(root, { recursive: true, force: true });
  });

  it('未归一化的历史 type（含空格大写）也能按类型裁剪', async () => {
    const { writeAgentmemory, pruneAgentmemory } = await import('./agentmemory.js');
    const { execSync } = await import('child_process');
    for (const c of ['a', 'b', 'c']) writeAgentmemory('review', `legacy-${c}`, [], 'p');
    const db = join(root, 'am', 'memory.db');
    execSync(`sqlite3 "${db}" "UPDATE memories SET type='Security Audit' WHERE content IN ('legacy-a','legacy-b');"`);
    const result = pruneAgentmemory({ maxPerType: 1, maxAgeDays: 3650 });
    expect(result.byType['Security Audit']).toBe(1);
    const left = execSync(`sqlite3 "${db}" "SELECT content FROM memories ORDER BY content;"`)
      .toString().split('\n').map(line => line.trim()).filter(Boolean);
    expect(left).toEqual(['legacy-b', 'legacy-c']);
  });

  it('tags 传 null 不会让整条写入静默失败', async () => {
    const { writeAgentmemory, readAgentmemory } = await import('./agentmemory.js');
    const written = writeAgentmemory('review', 'null-tags', null, 'p');
    expect(written.ok).toBe(true);
    expect(readAgentmemory(5).some(r => String(r.content).includes('null-tags'))).toBe(true);
  });
});
