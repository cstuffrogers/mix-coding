import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '');
const mockReaddirSync = vi.fn(() => []);
const mockStatSync = vi.fn(() => ({ isDirectory: () => false }));
vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
  statSync: (...args) => mockStatSync(...args),
}));

import { scanSkillConflicts, scanMcpConflicts, scanCommandSkillNameClash, scanAllConflicts } from '../lib/conflict-scanner.js';

function makeSkill(name, fm) {
  const fmStr = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${fmStr}\n---\nbody`;
}

describe('conflict-scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatSync.mockImplementation(() => ({ isDirectory: () => true }));
  });

  describe('scanSkillConflicts', () => {
    it('reports hard conflict when SKILL.md missing and no subdirs', () => {
      mockReaddirSync.mockReturnValue(['foo']);
      mockExistsSync.mockImplementation((p) => !p.endsWith('SKILL.md'));
      mockStatSync.mockImplementation((p) => ({ isDirectory: () => !String(p).endsWith('foo\\foo') && !String(p).endsWith('foo/foo') }));
      const result = scanSkillConflicts('/skills');
      expect(result.hard.some((h) => h.type === 'skill-missing-skillmd')).toBe(true);
    });

    it('skips nested skill collection dir without SKILL.md', () => {
      mockReaddirSync.mockImplementation((p) => {
        if (p === '/skills') return ['collection'];
        return ['child'];
      });
      mockExistsSync.mockImplementation((p) => !p.endsWith('SKILL.md'));
      mockStatSync.mockImplementation(() => ({ isDirectory: () => true }));
      const result = scanSkillConflicts('/skills');
      expect(result.hard.some((h) => h.type === 'skill-missing-skillmd')).toBe(false);
    });

    it('reports hard conflict for forbidden frontmatter field', () => {
      mockReaddirSync.mockReturnValue(['bar']);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeSkill('bar', { name: 'bar', paths: './x' }));
      const result = scanSkillConflicts('/skills');
      expect(result.hard.some((h) => h.type === 'skill-forbidden-field')).toBe(true);
    });

    it('reports hard conflict for duplicate skill names', () => {
      mockReaddirSync.mockReturnValue(['a', 'b']);
      mockExistsSync.mockReturnValue(true);
      const content = makeSkill('x', { name: 'dup' });
      mockReadFileSync.mockReturnValue(content);
      const result = scanSkillConflicts('/skills');
      expect(result.hard.some((h) => h.type === 'skill-duplicate-name')).toBe(true);
    });

    it('returns no hard conflicts for valid skills', () => {
      mockReaddirSync.mockReturnValue(['good']);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeSkill('good', { name: 'good', description: 'unique words here' }));
      const result = scanSkillConflicts('/skills');
      expect(result.hard).toHaveLength(0);
    });

    it('reports soft conflict for high trigger overlap', () => {
      mockReaddirSync.mockReturnValue(['s1', 's2']);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((p) => {
        return p.includes('s1')
          ? makeSkill('s1', { name: 's1', description: 'design redesign audit polish shape critique' })
          : makeSkill('s2', { name: 's2', description: 'design redesign audit polish shape critique' });
      });
      const result = scanSkillConflicts('/skills');
      expect(result.soft.some((s) => s.type === 'skill-trigger-overlap')).toBe(true);
    });
  });

  describe('scanMcpConflicts', () => {
    it('returns empty when file missing', () => {
      mockExistsSync.mockReturnValue(false);
      const result = scanMcpConflicts('/.mcp.json');
      expect(result.hard).toHaveLength(0);
    });

    it('reports hard conflict for missing command path', () => {
      mockExistsSync.mockImplementation((p) => p.endsWith('.mcp.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: { x: { command: '/nonexistent/bin', args: [] } },
      }));
      const result = scanMcpConflicts('/.mcp.json');
      expect(result.hard.some((h) => h.type === 'mcp-command-missing')).toBe(true);
    });

    it('passes for npx command', () => {
      mockExistsSync.mockImplementation((p) => p.endsWith('.mcp.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: { x: { command: 'npx', args: ['-y', 'foo'] } },
      }));
      const result = scanMcpConflicts('/.mcp.json');
      expect(result.hard).toHaveLength(0);
    });
  });

  describe('scanCommandSkillNameClash', () => {
    it('reports clash when command and skill share a name', () => {
      mockReaddirSync.mockImplementation((p) => {
        if (p.includes('commands')) return ['update.md'];
        if (p.includes('skills')) return ['update'];
        return [];
      });
      mockStatSync.mockImplementation(() => ({ isDirectory: () => true }));
      mockExistsSync.mockReturnValue(true);
      const result = scanCommandSkillNameClash('/commands', '/skills');
      expect(result.hard.some((h) => h.type === 'command-skill-clash')).toBe(true);
    });
  });

  describe('scanAllConflicts', () => {
    it('aggregates from all scanners', () => {
      mockExistsSync.mockReturnValue(false);
      const result = scanAllConflicts('/project');
      expect(result).toHaveProperty('hard');
      expect(result).toHaveProperty('soft');
    });
  });
});
