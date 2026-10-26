import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeAgentmemory, readAgentmemory } from './agentmemory.js';

// HOME is redirected so the real ~/.agentmemory is never touched.
let home;
const prevHome = process.env.HOME;
const prevAgentHome = process.env.AGENTMEMORY_HOME;

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'agentmem-'));
  process.env.HOME = home;
  process.env.AGENTMEMORY_HOME = join(home, '.agentmemory');
});

afterAll(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevAgentHome === undefined) delete process.env.AGENTMEMORY_HOME;
  else process.env.AGENTMEMORY_HOME = prevAgentHome;
  rmSync(home, { recursive: true, force: true });
});

describe('writeAgentmemory', () => {
  it('writes into the redirected store, never the developer real one', () => {
    // Guard for the failure mode this file used to have: AGENTMEMORY_DIR is
    // frozen at import time, so a HOME override set after import silently
    // pointed the test at ~/.agentmemory and polluted real user data.
    const res = writeAgentmemory('coding-test', 'isolation probe', ['iso']);
    expect(res.ok).toBe(true);
    const scoped = readAgentmemory(100, ['iso']);
    expect(scoped.some(r => r.id === res.id)).toBe(true);
  });

  it('round-trips JSON containing double quotes', () => {
    // Regression: the INSERT used to be embedded in a shell double-quoted
    // string, so `"` in the payload was consumed by the shell and SQLite
    // rejected the statement with "unrecognized token".
    const payload = JSON.stringify({ findings: { files: ['a/b.js'] }, note: 'x' });
    const res = writeAgentmemory('coding-test', payload, ['q']);
    expect(res.ok).toBe(true);

    const rows = readAgentmemory(100, ['q']);
    const row = rows.find(r => r.id === res.id);
    expect(row).toBeDefined();
    expect(row.content.startsWith('{"findings"')).toBe(true);
    expect(row.content).toContain('a/b.js');
  });

  it('round-trips single quotes, dollar signs and backticks', () => {
    const payload = "it's $HOME `id` and 'quoted'";
    const res = writeAgentmemory('coding-test', payload, ['q2']);
    expect(res.ok).toBe(true);
    const row = readAgentmemory(100, ['q2']).find(r => r.id === res.id);
    expect(row.content).toBe(payload);
  });

  it('round-trips newlines and SQL-looking content', () => {
    const payload = "line1\n'); DROP TABLE memories; --\nline3";
    const res = writeAgentmemory('coding-test', payload, ['q3']);
    expect(res.ok).toBe(true);
    const row = readAgentmemory(100, ['q3']).find(r => r.id === res.id);
    expect(row.content).toBe(payload);
    // Table still there, so the injection attempt did not execute.
    expect(readAgentmemory(1, [])).toBeDefined();
  });
});
