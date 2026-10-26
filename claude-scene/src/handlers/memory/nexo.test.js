import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readNexoData, writeNexoEvent } from './nexo.js';

// NEXO_HOME redirects the store so the real ~/.nexo is never touched.
let home;
const prevHome = process.env.NEXO_HOME;

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'nexo-'));
  process.env.NEXO_HOME = home;
});

afterAll(() => {
  if (prevHome === undefined) delete process.env.NEXO_HOME;
  else process.env.NEXO_HOME = prevHome;
  rmSync(home, { recursive: true, force: true });
});

describe('readNexoData', () => {
  it('returns the most recently written event first', () => {
    mkdirSync(join(home, 'runtime'), { recursive: true });
    // scanDir yields readdir order, which is arbitrary. The regression: the
    // slice(0, 20) ran BEFORE any sorting, so with more than `limit` files the
    // event that had just been written was usually invisible to recall.
    for (let i = 0; i < 30; i++) {
      const f = join(home, 'runtime', `old_${String(i).padStart(2, '0')}.json`);
      writeFileSync(f, JSON.stringify({ i }));
      // Force distinct, strictly increasing mtimes far in the past.
      const t = new Date(Date.now() - (30 - i) * 60_000);
      utimesSync(f, t, t);
    }
    writeNexoEvent('general', { tag: 'NEWEST' });

    const entries = readNexoData(20);
    expect(entries).toHaveLength(20);
    expect(entries[0].content).toContain('NEWEST');
  });

  it('honours the limit and never returns more entries than asked', () => {
    expect(readNexoData(3)).toHaveLength(3);
    expect(readNexoData(1)).toHaveLength(1);
  });

  it('clamps an invalid limit to the default instead of slicing to nothing', () => {
    expect(readNexoData(0).length).toBeGreaterThan(0);
    expect(readNexoData(NaN).length).toBeGreaterThan(0);
    expect(readNexoData(-5).length).toBeGreaterThan(0);
  });

  it('returns an empty list when the store does not exist', () => {
    process.env.NEXO_HOME = join(home, 'does-not-exist');
    expect(readNexoData()).toEqual([]);
    process.env.NEXO_HOME = home;
  });

  it('writes into the redirected store, never the real one', () => {
    const { file, skipped } = writeNexoEvent('probe', { ok: true });
    expect(skipped).toBe(false);
    expect(file.startsWith(home)).toBe(true);
  });
});
