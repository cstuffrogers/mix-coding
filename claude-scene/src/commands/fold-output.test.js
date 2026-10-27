import { describe, it, expect } from 'vitest';
import { foldOutput } from './start.js';

// 折叠逻辑必须自证非空跑：短输出不许动，长输出必须真的少行、并且把省下的行数说准。
const NL = String.fromCodePoint(10);
const LOG_HINT = '.claude/logs/steps-demo.log';
const lines = (n) => Array.from({ length: n }, (_, i) => `第 ${i + 1} 行`).join(NL);

describe('foldOutput：屏幕只留摘要，完整输出落盘', () => {
  it('短输出原样返回，不折叠', () => {
    const result = foldOutput(lines(3), { stepStatus: 'pass', fullLogPath: LOG_HINT });
    expect(result.folded).toBe(false);
    expect(result.hidden).toBe(0);
    expect(result.text).toBe(lines(3));
  });

  it('长输出折叠到 6 行 + 一行提示，省下的行数说准', () => {
    const result = foldOutput(lines(20), { stepStatus: 'pass', fullLogPath: LOG_HINT });
    const shown = result.text.split(NL);
    expect(result.folded).toBe(true);
    expect(result.hidden).toBe(14);
    expect(shown).toHaveLength(7);
    expect(shown[0]).toBe('第 1 行');
    expect(shown[5]).toBe('第 6 行');
    expect(shown[6]).toContain('省略 14 行');
    expect(shown[6]).toContain(LOG_HINT);
  });

  it('失败一律不折叠（藏起失败细节才是刷屏问题的根源）', () => {
    const result = foldOutput(lines(30), { stepStatus: 'fail', fullLogPath: LOG_HINT });
    expect(result.folded).toBe(false);
    expect(result.text).toBe(lines(30));
  });

  it('--no-fold（fold:false）时完整展开', () => {
    const result = foldOutput(lines(30), { fold: false, stepStatus: 'pass' });
    expect(result.folded).toBe(false);
    expect(result.text.split(NL)).toHaveLength(30);
  });

  it('没有落盘路径时提示改用 --no-fold，而不是指向一个不存在的文件', () => {
    const result = foldOutput(lines(10), { stepStatus: 'warn' });
    expect(result.text).toContain('--no-fold');
    expect(result.text).not.toContain('完整输出：');
  });

  it('空结果不炸（undefined 以前会打出一个字面量 undefined）', () => {
    expect(foldOutput().text).toBe('');
  });
});
