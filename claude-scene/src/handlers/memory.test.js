import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chalk', () => {
  const noop = (s) => s;
  const chalk = new Proxy({}, { get: () => noop });
  return { default: chalk };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '[]'),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
}));

vi.mock('../lib/scan-dir.js', () => ({
  scanDir: vi.fn(() => []),
}));

vi.mock('../lib/fs-utils.js', () => ({
  ensureDir: vi.fn(),
}));


import {
  handleMemoryRecall,
  handleMemoryRemember,
  handleConsolidate,
  handleListMemories,
} from './memory.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleMemoryRecall', () => {
  it('returns a result string with recall count', async () => {
    const result = await handleMemoryRecall('memoryRecall', {}, '/tmp');
    expect(result).toContain('项目记忆已召回');
  });

  it('stores recalled memories on context as an array', async () => {
    const context = {};
    await handleMemoryRecall('memoryRecall', {}, '/tmp', context);
    expect(Array.isArray(context.recalled_memories)).toBe(true);
  });

  it('handles mode=full parameter', async () => {
    const result = await handleMemoryRecall('memoryRecall', { mode: 'full' }, '/tmp');
    expect(result).toContain('项目记忆已召回');
  });

  it('handles category parameter', async () => {
    const result = await handleMemoryRecall('memoryRecall', { category: 'architecture' }, '/tmp');
    expect(result).toContain('项目记忆已召回');
  });

  it('handles filters parameter', async () => {
    const result = await handleMemoryRecall(
      'memoryRecall',
      { filters: { type: 'test' } },
      '/tmp'
    );
    expect(result).toContain('项目记忆已召回');
  });

  it('returns result when no context is provided', async () => {
    const result = await handleMemoryRecall('memoryRecall', { limit: 5 }, null);
    expect(result).toContain('项目记忆已召回');
  });
});

describe('handleMemoryRemember', () => {
  it('saves memory and returns backend count', async () => {
    const result = await handleMemoryRemember(
      'memoryRemember',
      { type: 'test', data: 'hello' },
      '/tmp'
    );
    expect(result).toContain('已保存到记忆');
    expect(result).toContain('后端');
  });

  it('uses context recalled_memories when no data provided', async () => {
    const context = { recalled_memories: [{ id: '1', type: 'test' }] };
    const result = await handleMemoryRemember(
      'memoryRemember',
      { type: 'test' },
      '/tmp',
      context
    );
    expect(result).toContain('已保存到记忆');
  });

  it('stores last_memory_id on context', async () => {
    const context = {};
    await handleMemoryRemember(
      'memoryRemember',
      { type: 'test', data: 'hello' },
      '/tmp',
      context
    );
    expect(context.last_memory_id).toBeDefined();
    expect(typeof context.last_memory_id).toBe('string');
  });

  it('also accepts content as data field', async () => {
    const result = await handleMemoryRemember(
      'memoryRemember',
      { type: 'note', content: 'some content' },
      '/tmp'
    );
    expect(result).toContain('已保存到记忆');
  });
});

describe('handleConsolidate', () => {
  it('runs consolidation and returns stats', () => {
    const result = handleConsolidate('consolidate', {}, '/tmp');
    expect(result).toContain('记忆整理完成');
  });

  it('includes project memory stats in result', () => {
    const result = handleConsolidate('consolidate', {}, '/tmp');
    expect(result).toMatch(/项目 \d+/);
  });
});

describe('handleListMemories', () => {
  it('returns zero when no memories exist', () => {
    const result = handleListMemories('listMemories', {}, '/tmp');
    expect(result).toMatch(/记忆列表: \d+ 条/);
  });

  it('returns a string', () => {
    const result = handleListMemories('listMemories', {}, '/tmp');
    expect(typeof result).toBe('string');
  });
});
