import { describe, it, expect } from 'vitest';
import { _parseNoleakOutput } from './external-tool-checks.js';

describe('_parseNoleakOutput', () => {
  it('parses structured JSON and groups block-severity findings by rule, excluding node_modules', () => {
    const raw = JSON.stringify({
      findings: [
        { ruleId: 'no-env', severity: 'block', filePath: 'src/a.js' },
        { ruleId: 'no-env', severity: 'block', filePath: 'src/b.js' },
        { ruleId: 'no-env', severity: 'warn', filePath: 'src/c.js' }, // wrong severity
        { ruleId: 'secret', severity: 'block', filePath: 'node_modules/x.js' }, // excluded
        { ruleId: 'secret', severity: 'block', filePath: 'src/d.js' },
      ],
    });
    expect(_parseNoleakOutput(raw).sort()).toEqual(['no-env (2 处)', 'secret (1 处)']);
  });

  it('falls back to substring heuristics when JSON parse fails', () => {
    const out = _parseNoleakOutput('something broke\n .env file found\n credential leak\n .git/config\n foo.map');
    expect(out).toContain('.env 文件可能泄露');
    expect(out).toContain('高熵密钥检测');
    expect(out).toContain('.git 目录暴露');
    expect(out).toContain('Source Map 文件泄露');
  });

  it('detects .git on both unix and windows path separators', () => {
    expect(_parseNoleakOutput('leak in .git/refs')).toContain('.git 目录暴露');
    expect(_parseNoleakOutput('leak in .git\\refs')).toContain('.git 目录暴露');
  });

  it('returns empty array when nothing matches', () => {
    expect(_parseNoleakOutput(JSON.stringify({ findings: [] }))).toEqual([]);
    expect(_parseNoleakOutput('all clean, nothing here')).toEqual([]);
  });
});
