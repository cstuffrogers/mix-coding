import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 第五轮审计的常驻守卫：场景里写的 params 必须真的被读。
// 「写了没人读」= 用户以为勾了开关，实际什么都没发生（静默失效）——
// 这种坑不会报错，只能在 CI 里静态拦。
const HERE = dirname(fileURLToPath(import.meta.url)); // claude-scene/src/commands
const SRC = join(HERE, '..'); // claude-scene/src
const SCENES = join(HERE, '..', '..', 'scenes');

function walkJs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkJs(full, out);
    else if (name.endsWith('.js') && !name.includes('.test.')) out.push(full);
  }
  return out;
}

function engineSource() {
  return walkJs(SRC).map((file) => readFileSync(file, 'utf-8')).join('\n');
}

function sceneParams() {
  const rows = [];
  for (const file of readdirSync(SCENES).filter((n) => n.endsWith('.json'))) {
    const scene = JSON.parse(readFileSync(join(SCENES, file), 'utf-8'));
    for (const step of scene.flow || []) {
      for (const key of Object.keys(step.params || {})) {
        rows.push({ scene: file.replace('.json', ''), step: step.step, action: step.action, key });
      }
    }
  }
  return rows;
}

describe('场景参数契约：写进场景的每个键都要有人读', () => {
  it('没有「写了没人读」的参数', () => {
    const source = engineSource();
    // 零容忍：白名单不存在（真需要例外时请在此处显式列名 + 写明理由，
    // 而不是把断言改成「至少通过 N 个」）。
    const dead = sceneParams().filter(({ key }) => !source.includes(key));

    const detail = dead.map((d) => `  ${d.scene}#${d.step} ${d.action}: ${d.key}`).join('\n');
    expect(detail).toBe('');
  });
});
