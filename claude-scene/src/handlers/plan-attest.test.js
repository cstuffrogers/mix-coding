import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { handleConfirmAttestation, handleAttestPlan } from './plan-service.js';
import { parseAttestFlag } from '../commands/start.js';
import * as conditionsModule from '../lib/conditions.js';

/**
 * plan 7「是否启用 SHA256 认证」以前是个黑洞：
 * 永远返回 { status: 'interactive' } —— 不进 context、不设条件，于是 plan 8
 * （attestPlan，condition: attestation_enabled）永远不跑，答案在代码库里零消费点。
 * 现在 --attest true|false 落到 context.attestation_enabled，并真的驱动 plan 8。
 */

describe('parseAttestFlag：只认明确表态，其余一律「没表态」', () => {
  it('--attest true|1|yes|是 都算启用', () => {
    for (const raw of ['true', 'TRUE', '1', 'yes', 'y', '是', '开', true]) {
      expect(parseAttestFlag(raw)).toBe(true);
    }
  });

  it('--attest false|0|no|否 都算不启用', () => {
    for (const raw of ['false', '0', 'no', 'n', '否', '关']) {
      expect(parseAttestFlag(raw)).toBe(false);
    }
  });

  it('没给 / 给了看不懂的值 → undefined（不许猜成 false 蒙过去）', () => {
    expect(parseAttestFlag()).toBeUndefined();
    expect(parseAttestFlag(null)).toBeUndefined();
    expect(parseAttestFlag('maybe')).toBeUndefined();
    expect(parseAttestFlag('')).toBeUndefined();
  });
});

describe('handleConfirmAttestation：答案必须真的落地', () => {
  const params = { prompt: '是否启用 SHA256 认证？', default: false };

  it('--attest true → context.attestation_enabled = true，输出说清是命令行表态', () => {
    const context = { attestation_enabled: true };
    const out = handleConfirmAttestation('confirmAttestation', params, '/tmp', context);
    expect(context.attestation_enabled).toBe(true);
    expect(out.message).toContain('已启用');
    expect(out.message).toContain('--attest');
    expect(out.message).toContain('将执行');
  });

  it('--attest false → 明确不启用，plan 8 会跳过', () => {
    const context = { attestation_enabled: false };
    const out = handleConfirmAttestation('confirmAttestation', params, '/tmp', context);
    expect(context.attestation_enabled).toBe(false);
    expect(out.message).toContain('不启用');
    expect(out.message).toContain('将跳过');
  });

  it('没表态但有场景声明的 default → 用默认值，并在输出里标明是默认值（不假装是用户选的）', () => {
    const context = {};
    const out = handleConfirmAttestation('confirmAttestation', params, '/tmp', context);
    expect(context.attestation_enabled).toBe(false);
    expect(out.message).toContain('场景声明的默认值');
    expect(out.message).toContain('--attest true');
  });

  it('没表态、场景也没声明默认 → 不写 context，返回 interactive（交给人回答）', () => {
    const context = {};
    const out = handleConfirmAttestation('confirmAttestation', { prompt: '?' }, '/tmp', context);
    expect('attestation_enabled' in context).toBe(false);
    expect(out.status).toBe("interactive");
  });
});

describe('handleAttestPlan：没认证成不许记成通过', () => {
  const makeTarget = () => mkdtempSync(join(tmpdir(), 'attest-'));

  it('脚本不存在 → skip（以前写的是 "skipped"，不在白名单里，落成 ✓ pass）', () => {
    const target = makeTarget();
    const out = handleAttestPlan('attestPlan', { script: '.claude/scripts/attest-plan.sh' }, target, {});
    expect(out.status).toBe('skip');
    expect(out.message).toContain('不存在');
  });

  it('脚本执行成功 → pass，哈希进 context.plan_attestation', () => {
    const target = makeTarget();
    mkdirSync(join(target, '.claude', 'scripts'), { recursive: true });
    const script = join(target, '.claude', 'scripts', 'attest-plan.sh');
    writeFileSync(script, '#!/bin/sh\necho "deadbeef  task_plan.md"\n');

    const context = {};
    const out = handleAttestPlan('attestPlan', { script: '.claude/scripts/attest-plan.sh' }, target, context);
    expect(out.status).toBe('pass');
    expect(out.message).toContain('deadbeef');
    expect(context.plan_attestation).toContain('deadbeef');
  });

  it('脚本非零退出（没有 task_plan.md）→ warn，不冒充成功', () => {
    const target = makeTarget();
    mkdirSync(join(target, '.claude', 'scripts'), { recursive: true });
    const script = join(target, '.claude', 'scripts', 'attest-plan.sh');
    writeFileSync(script, '#!/bin/sh\necho "No task_plan.md found" >&2\nexit 1\n');

    const out = handleAttestPlan('attestPlan', { script: '.claude/scripts/attest-plan.sh' }, target, {});
    expect(out.status).toBe('warn');
    expect(out.message).toContain('No task_plan.md found');
  });
});

/**
 * 条件求值那一层的两个坑（都在 plan 7/8 上现形）：
 *   1) attestation_enabled 在 RUNTIME_STATE_PREDICATES 里，plan 7 明明写了 false，
 *      仍被报成「未判定」（假黄：跳过是对的，却没人知道为什么）。
 *   2) 条件里还挂着 `|| user_confirmed === true` —— 任何其它确认都能替用户打开认证。
 */
describe('attestation_enabled 条件：只看自己的开关，且写了值就必须能判定', () => {
  it('context 已有 false → 可判定为「条件不满足」，不是「未判定」', () => {
    const { explainCondition } = conditionsModule;
    const r = explainCondition('attestation_enabled', { attestation_enabled: false });
    expect(r.met).toBe(false);
    expect(r.determinable).toBe(true);
    expect(r.unknown).toEqual([]);
  });

  it('别的步骤说 user_confirmed 也不算启用认证', () => {
    const { evaluateCondition } = conditionsModule;
    expect(evaluateCondition('attestation_enabled', { user_confirmed: true })).toBe(false);
    expect(evaluateCondition('attestation_enabled', { attestation_enabled: true })).toBe(true);
  });
});
