import { describe, it, expect, vi } from 'vitest';
import { evaluateCondition } from './conditions.js';

// Mock fs for file-existence-based conditions
vi.mock('fs', () => {
  const actual = vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
  };
});

describe('evaluateCondition', () => {
  describe('empty/truthy conditions', () => {
    it('returns true for null/undefined/empty (no condition)', () => {
      expect(evaluateCondition(null, {})).toBe(true);
      expect(evaluateCondition(undefined, {})).toBe(true);
      expect(evaluateCondition('', {})).toBe(true); // empty string is falsy → treated as no condition
    });

    it('returns true when context key is truthy', () => {
      expect(evaluateCondition('debug', { debug: true })).toBe(true);
      expect(evaluateCondition('ready', { ready: 1 })).toBe(true);
    });

    it('returns false when context key is falsy', () => {
      expect(evaluateCondition('debug', { debug: false })).toBe(false);
      expect(evaluateCondition('ready', {})).toBe(false);
    });
  });

  describe('named conditions (SIMPLE_CONDITIONS)', () => {
    it('evaluates frontend_involved from prompt text', () => {
      expect(evaluateCondition('frontend_involved', { prompt: '美化前端页面' })).toBe(true);
      expect(evaluateCondition('frontend_involved', { prompt: '修复后端bug' })).toBe(false);
      expect(evaluateCondition('frontend_involved', { selectedTheme: 'animal-island' })).toBe(true);
    });

    it('evaluates user_confirmed flags', () => {
      expect(evaluateCondition('user_confirmed_open_design', { user_confirmed_open_design: true })).toBe(true);
      expect(evaluateCondition('user_confirmed_open_design', {})).toBe(false);
      expect(evaluateCondition('user_confirmed_refactor', { user_confirmed_refactor: true })).toBe(true);
    });

    it('evaluates fix_failed_count >= 3', () => {
      const key = 'fix_failed_count >= 3';
      expect(evaluateCondition(key, { fixFailedCount: 5 })).toBe(true);
      expect(evaluateCondition(key, { fixFailedCount: 2 })).toBe(false);
      expect(evaluateCondition(key, {})).toBe(false);
    });

    it('evaluates user_mentioned_competitor_or_domain', () => {
      const key = 'user_mentioned_competitor_or_domain';
      expect(evaluateCondition(key, { prompt: '帮我做竞品分析' })).toBe(true);
      expect(evaluateCondition(key, { prompt: '修复一个小bug' })).toBe(false);
    });

    it('manual_intervention_required is always false', () => {
      expect(evaluateCondition('manual_intervention_required', {})).toBe(false);
    });
  });

  describe('compound conditions', () => {
    it('evaluates A || B', () => {
      expect(evaluateCondition('a || b', { a: true, b: false })).toBe(true);
      expect(evaluateCondition('a || b', { a: false, b: true })).toBe(true);
      expect(evaluateCondition('a || b', { a: false, b: false })).toBe(false);
    });

    it('evaluates A && B', () => {
      expect(evaluateCondition('a && b', { a: true, b: true })).toBe(true);
      expect(evaluateCondition('a && b', { a: true, b: false })).toBe(false);
      expect(evaluateCondition('a && b', { a: false, b: true })).toBe(false);
    });

    it('handles compound with named conditions', () => {
      const cond = 'open_design_executed || user_confirmed_open_design';
      expect(evaluateCondition(cond, { open_design_executed: true })).toBe(true);
      expect(evaluateCondition(cond, { user_confirmed_open_design: true })).toBe(true);
      expect(evaluateCondition(cond, {})).toBe(false);
    });
  });

  describe('comparison operators', () => {
    it('evaluates key === value', () => {
      expect(evaluateCondition('mode === test', { mode: 'test' })).toBe(true);
      expect(evaluateCondition('mode === test', { mode: 'prod' })).toBe(false);
    });

    it('evaluates key !== value', () => {
      expect(evaluateCondition('mode !== test', { mode: 'prod' })).toBe(true);
      expect(evaluateCondition('mode !== test', { mode: 'test' })).toBe(false);
    });

    it('evaluates == and !=', () => {
      expect(evaluateCondition('count == 5', { count: '5' })).toBe(true);
      expect(evaluateCondition('count != 5', { count: '3' })).toBe(true);
    });

    it('strips quotes from values', () => {
      expect(evaluateCondition('name === "hello"', { name: 'hello' })).toBe(true);
      expect(evaluateCondition("name === 'hello'", { name: 'hello' })).toBe(true);
    });
  });

  describe('length comparisons', () => {
    it('evaluates key.length > N for arrays', () => {
      expect(evaluateCondition('items.length > 2', { items: [1, 2, 3] })).toBe(true);
      expect(evaluateCondition('items.length > 2', { items: [1] })).toBe(false);
    });

    it('evaluates key.length for strings', () => {
      expect(evaluateCondition('name.length >= 5', { name: 'hello world' })).toBe(true);
      expect(evaluateCondition('name.length < 3', { name: 'hi' })).toBe(true);
    });

    it('handles missing key as length 0', () => {
      expect(evaluateCondition('items.length > 0', {})).toBe(false);
      expect(evaluateCondition('items.length <= 0', {})).toBe(true);
    });
  });

  describe('skill/MCP availability (mocked)', () => {
    it('github_mcp_available returns boolean', () => {
      const result = evaluateCondition('github_mcp_available', {});
      expect(typeof result).toBe('boolean');
    });

    it('plugin_ce_available returns boolean', () => {
      const result = evaluateCondition('plugin_ce_available', {});
      expect(typeof result).toBe('boolean');
    });
  });

  describe('unknown conditions', () => {
    it('falls back to truthy context lookup', () => {
      expect(evaluateCondition('some_random_key', { some_random_key: 1 })).toBe(true);
      expect(evaluateCondition('some_random_key', {})).toBe(false);
    });
  });
});
