import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 第十轮维度③的常驻守卫：下划线私有键（context._x）是「步骤之间的临时通道」。
// 它们的生命周期必须闭合 —— 写下就要有人删/有人读，否则会漏到下一个步骤，
// 变成「上一个问题还没答完，下一个已经在读它」这种最难查的暗坑。
//
// 这条守卫生成于一次审计结论：现有的 _awaitingAnswer / _stepDecision /
// _stepAlreadyLogged 都配对 delete 了（不是运气，是 design），所以这里不加代码，
// 只把不变量固定下来，免得以后有人新加一个 _x 忘了清。
const HERE = dirname(fileURLToPath(import.meta.url)); // claude-scene/src/commands
const SRC = join(HERE, '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js') && !name.includes('.test.')) out.push(full);
  }
  return out;
}

function engineSources() {
  return walk(SRC).map((file) => ({ file, src: readFileSync(file, 'utf-8') }));
}

/** 所有被写过的私有键（`context._x =` / `context._x ||= ...` 都算） */
function writtenPrivateKeys(sources) {
  const keys = new Set();
  for (const { src } of sources) {
    for (const m of src.matchAll(/context\.(_[A-Za-z]\w*)\s*(?:\|\|=|=(?!=))/g)) keys.add(m[1]);
  }
  return keys;
}

describe('context 私有键（下划线）生命周期必须闭合', () => {
  it('扫描范围不能是空的', () => {
    expect(engineSources().length).toBeGreaterThan(100);
  });

  it('每个写下的私有键都有人读或有人删', () => {
    const sources = engineSources();
    const keys = writtenPrivateKeys(sources);
    // 至少要有 _awaitingAnswer（否则说明扫描写坏了，下面的断言变成空转）
    expect(keys.has('_awaitingAnswer')).toBe(true);

    const leaks = [];
    for (const key of keys) {
      const esc = key;
      const readRe = new RegExp(`context\\??\\.${esc}(?!\\s*(?:\\|\\|=|=(?!=)))`);
      const deleteRe = new RegExp(`delete\\s+context\\.${esc}\\b`);
      const hasConsumer = sources.some(({ src }) => readRe.test(src) || deleteRe.test(src));
      if (!hasConsumer) leaks.push(key);
    }
    const detail = leaks.map((k) => `  ${k}: 只写不读不删，会漏到下一个步骤`).join('\n');
    expect(detail).toBe('');
  });

  it('跨步骤传递的键必须显式清理（自探针：注入一个没人清的键要能被抓到）', () => {
    // 这里不注入真实文件（会脏工作区），而是验证判定函数本身的逻辑：
    // 一个只写不读不删的键，必须被上面那条规则判成泄漏。
    const fake = [{ file: 'fake.js', src: 'context._zzLeakProbe = 1;' }];
    const keys = writtenPrivateKeys(fake);
    expect([...keys]).toEqual(['_zzLeakProbe']);
    const readRe = /context\??\._zzLeakProbe(?!\s*(?:\|\|=|=(?!=)))/;
    expect(readRe.test('context._zzLeakProbe = 1;')).toBe(false); // 赋值不算读
    expect(readRe.test('if (context._zzLeakProbe) {}')).toBe(true); // 真读算读
    expect(readRe.test('delete context._zzLeakProbe;')).toBe(true); // delete 也算消费
  });
});
