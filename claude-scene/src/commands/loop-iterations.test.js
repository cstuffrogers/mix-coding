import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { resolveIterations, requestedIterations, shouldStopLooping, countFindings, describeNotPassSteps, deriveStepStatus, spinnerMethodFor, paintByStatus, normalizeStepStatus } from './start.js';
import { recordFindingCount } from '../lib/finding-count.js';

// 回归：`claude-scene start loop --auto "循环10次"` 之前只是把「循环10次」当纯文本塞进
// prompt —— 引擎根本没有迭代概念，一次就结束。现在 --iterations 才是真驱动。
describe('resolveIterations', () => {
  it('默认 1 轮，保持旧行为', () => {
    expect(resolveIterations({}, {})).toBe(1);
    expect(resolveIterations()).toBe(1);
  });

  it('读 --iterations，字符串数字也认', () => {
    expect(resolveIterations({ iterations: '10' }, {})).toBe(10);
    expect(resolveIterations({ iterations: 7 }, {})).toBe(7);
  });

  it('场景可声明默认轮数，CLI 优先', () => {
    expect(resolveIterations({}, { iterations: 5 })).toBe(5);
    expect(resolveIterations({ iterations: 2 }, { iterations: 5 })).toBe(2);
  });

  it('非法值回落 1，超大值封顶 20', () => {
    expect(resolveIterations({ iterations: 'abc' }, {})).toBe(1);
    expect(resolveIterations({ iterations: 0 }, {})).toBe(1);
    expect(resolveIterations({ iterations: 999 }, {})).toBe(20);
  });

  // 截断本身没毛病（防跑飞），但默默截断让人以为真跑了 999 轮。
  it('封顶时能看到用户原本要了多少轮（用于出声，而不是暗暗截断）', () => {
    expect(requestedIterations({ iterations: 999 }, {})).toBe(999);
    expect(resolveIterations({ iterations: 999 }, {})).toBe(20);
    expect(requestedIterations({ iterations: 'abc' }, {})).toBe(1);
  });
});

describe('shouldStopLooping', () => {
  it('跑满轮数即停', () => {
    const d = shouldStopLooping({ iteration: 10, max: 10, prevFindings: 100, findings: 50 });
    expect(d.stop).toBe(true);
    expect(d.reason).toBe('max');
  });

  it('本轮干净提前结束', () => {
    const d = shouldStopLooping({ iteration: 1, max: 10, prevFindings: null, findings: 0 });
    expect(d).toMatchObject({ stop: true, reason: 'clean' });
  });

  it('发现数下降时继续下一轮', () => {
    const d = shouldStopLooping({ iteration: 1, max: 10, prevFindings: null, findings: 900 });
    expect(d.stop).toBe(false);
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 900, findings: 400 }).stop).toBe(false);
  });

  it('发现数没下降就停止空转（避免 N 轮同一批问题）', () => {
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 940 }))
      .toMatchObject({ stop: true, reason: 'no-progress' });
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 950 }).stop).toBe(true);
  });

  it('--force-iterations 显式要求跑满时不因 no-progress 停，但仍停在 max/clean', () => {
    const forced = shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 940, force: true });
    expect(forced.stop).toBe(false);
    expect(forced.reason).toBe('no-progress-forced');
    expect(forced.message).toContain('继续');
    expect(shouldStopLooping({ iteration: 10, max: 10, prevFindings: 940, findings: 940, force: true }).reason).toBe('max');
    expect(shouldStopLooping({ iteration: 2, max: 10, prevFindings: 940, findings: 0, force: true }).reason).toBe('clean');
  });
});

// 维度：多轮迭代的「本轮发现」不能是猜的。
// 实测 --iterations 2 一个没有扫描步骤的场景：countFindings 把「两个计数器都没写过」
// 算成 0，于是第一轮就报「本轮无新发现，提前结束」—— 什么都没测，却很自信。
describe('迭代收敛的发现数必须真的测过', () => {
  it('两个计数器都没写过 → null（没测），不是 0（干净）', () => {
    expect(countFindings({})).toBeNull();
    expect(countFindings({ targetPath: '/p' })).toBeNull();
    expect(countFindings(null)).toBeNull();
  });

  // 契约变了：发现数必须带「哪一轮写的」（recordFindingCount 打的标）。
  // 以前只看「计数器存不存在」→ 上一轮的值会被当成本轮结论。现在裸写计数器
  // 也不算数（下面最后一条守卫会把「绕过 helper 直接赋值」抓出来）。
  it('写过的 0 才叫「没有发现」', () => {
    const mk = (key, value) => {
      const ctx = { iteration: 1 };
      recordFindingCount(ctx, key, value);
      return ctx;
    };
    expect(countFindings(mk('aislop_issue_count', 0))).toBe(0);
    expect(countFindings(mk('review_issue_count', 0))).toBe(0);
    const both = mk('aislop_issue_count', 3);
    recordFindingCount(both, 'review_issue_count', 2);
    expect(countFindings(both)).toBe(5);
    // 没有轮次标记 = 不知道这份数字属不属于本轮 → 没测。
    expect(countFindings({ aislop_issue_count: 3 })).toBeNull();
  });

  it('上一轮的计数器不能当本轮的发现数', () => {
    const ctx = { iteration: 1 };
    recordFindingCount(ctx, 'aislop_issue_count', 5);
    expect(countFindings(ctx)).toBe(5);
    ctx.iteration = 2; // 第二轮没跑扫描步骤（条件跳过 / 场景里没有）
    expect(countFindings(ctx)).toBeNull();
    const d = shouldStopLooping({ iteration: 2, max: 5, prevFindings: 5, findings: countFindings(ctx) });
    expect(d.reason).toBe('unmeasured');
    expect(d.message).not.toContain('未下降');
  });

  // 守卫：绕过 helper 直接写计数器 = 下一个人会踩回同一个坑（静默变成「没测」或读到旧值）。
  it('引擎里只有 finding-count.js 能直接写发现计数器', () => {
    const src = readdirSync(join(import.meta.dirname, '..'), { recursive: true })
      .filter((f) => typeof f === 'string' && f.endsWith('.js') && !f.endsWith('.test.js'))
      .map((f) => join(import.meta.dirname, '..', f))
      .filter((f) => !f.endsWith(join('lib', 'finding-count.js')));
    const offenders = [];
    for (const file of src) {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        if (/context\.\w*_issue_count\s*=[^=]/.test(line) && !line.trimStart().startsWith('//')) {
          offenders.push(`${basename(file)}: ${line.trim()}`);
        }
      }
    }
    expect(offenders, '发现计数器被直接赋值 —— 改用 recordFindingCount，否则多轮里会读到上一轮的值').toEqual([]);
  });

  it('没测时不许宣布「本轮无新发现」，而是按轮数跑满', () => {
    const d = shouldStopLooping({ iteration: 1, max: 5, prevFindings: null, findings: null });
    expect(d.stop).toBe(false);
    expect(d.reason).toBe('unmeasured');
    expect(d.message).toContain('无法判断收敛');
    expect(d.message).not.toContain('无新发现');
  });
});

describe('多轮汇总：同名步骤要带轮次', () => {
  it('单轮不带轮次噪声', () => {
    const { lines } = describeNotPassSteps([
      { step: 3, action: 'test', status: 'fail', iteration: 1 },
    ], 12, 1);
    expect(lines).toEqual(['Step 3 test → fail']);
  });

  it('两轮里同一 action 各失败一次 → 两行且各自标明轮次', () => {
    const { lines } = describeNotPassSteps([
      { step: 3, action: 'test', status: 'fail', iteration: 1 },
      { step: 3, action: 'test', status: 'fail', iteration: 2 },
    ], 12, 2);
    expect(lines).toEqual(['Step 3 test → fail（第 1 轮）', 'Step 3 test → fail（第 2 轮）']);
  });
});

// 处理器可以直接布状态（三态检查），不该再靠正则猜 pass
describe('deriveStepStatus 显式状态', () => {
  it('处理器返回 {status} 时以它为准', () => {
    expect(deriveStepStatus({ status: 'skip', message: '没跑成' }, { lastStepFailed: false }).stepStatus).toBe('skip');
    expect(deriveStepStatus({ status: 'warn', message: '部分检查未执行' }, { lastStepFailed: false }).stepStatus).toBe('warn');
    expect(deriveStepStatus({ status: 'pass', message: '代码审查完成（无问题）' }, { lastStepFailed: false }).stepStatus).toBe('pass');
  });

  it('显式状态的 message 仍用于展示', () => {
    const { resultStr } = deriveStepStatus({ status: 'skip', message: '类型检查跳过' }, { lastStepFailed: false });
    expect(resultStr).toBe('类型检查跳过');
  });

  // 以前认不出的 status 会掉回文本启发式：`{status:'error', message:'EACCES'}` 里没有
  // 「失败」二字，就被记成 ✓ pass。现在认不出 = 状态不明 = warn（可见），绝不猜成 pass。
  it('未知 status 记 warn，不回落文本启发式', () => {
    expect(deriveStepStatus({ status: 'weird', message: '已跳过该步骤' }, { lastStepFailed: false }).stepStatus).toBe('warn');
    expect(deriveStepStatus({ status: 'error', message: 'EACCES: permission denied' }, { lastStepFailed: false }).stepStatus).toBe('fail');
  });

  it('处理器的同义 status 归一成五态', () => {
    expect(normalizeStepStatus('success')).toBe('pass');
    expect(normalizeStepStatus('created')).toBe('pass');
    expect(normalizeStepStatus('EXISTS')).toBe('noop');
    expect(normalizeStepStatus('skipped')).toBe('skip');
    expect(normalizeStepStatus('not_found')).toBe('skip');
    expect(normalizeStepStatus('issues')).toBe('warn');
    expect(normalizeStepStatus('failed')).toBe('fail');
    expect(normalizeStepStatus()).toBeNull();
    expect(normalizeStepStatus('')).toBeNull();
  });

  it('纯文本结果行为不变', () => {
    expect(deriveStepStatus('代码审查完成（无问题）', { lastStepFailed: false }).stepStatus).toBe('pass');
    expect(deriveStepStatus('任务失败', { lastStepFailed: false }).stepStatus).toBe('fail');
  });

  // 第十九轮：返回对象却没布 status 的路径以前会直接落到正则启发式，
  // 只要文案里没有「失败/问题」这些词就记 ✓ pass（典型的「看着绿了」）。
  // 对象里的字段是处理器自己的词汇，引擎没资格替它下结论。
  it('返回对象但没布 status → warn，并点名原因', () => {
    const ctx = { lastStepFailed: false };
    const { stepStatus, resultStr } = deriveStepStatus({ ok: true, files: 3, summary: '已生成 3 个文件' }, ctx);
    expect(stepStatus).toBe('warn');
    expect(resultStr).toContain('没布 status');
  });

  it('数组等非字符串对象同样不会白得一个 pass', () => {
    expect(deriveStepStatus([{ a: 1 }], { lastStepFailed: false }).stepStatus).toBe('warn');
    expect(deriveStepStatus(new Date(0), { lastStepFailed: false }).stepStatus).toBe('warn');
  });

  // 以前 `formatResultForDisplay` 会给没布 status 的对象编一个 `success`：
  // 屏幕上出现「步骤已完成（状态：success）」，处理器一个字都没说过这句。
  it('没布 status 的对象不会在屏幕上被编一句「success」', () => {
    const { resultStr } = deriveStepStatus({ count: 2 }, { lastStepFailed: false });
    expect(resultStr).not.toContain('success');
    expect(deriveStepStatus({ status: 'pass', message: '完成' }, { lastStepFailed: false }).resultStr).toBe('完成');
  });
});

// 这两个文案曾经都被判成 warn，于是 /check 明明 0 问题却显示「⚡ warn: 2」。
// 状态启发式看的是文字，文字里带数字和「重复」就必须分清「0 个」和「未重复」。
describe('deriveStepStatus 文本启发式', () => {
  const ctx = () => ({ lastStepFailed: false });

  it('0 个问题不是告警', () => {
    expect(deriveStepStatus('11 道检查完成: 0 个问题', ctx()).stepStatus).toBe('pass');
    expect(deriveStepStatus('扫描 0 处发现', ctx()).stepStatus).toBe('pass');
  });

  it('真有问题才算告警', () => {
    expect(deriveStepStatus('发现 3 个问题', ctx()).stepStatus).toBe('warn');
    expect(deriveStepStatus('3 处警告', ctx()).stepStatus).toBe('warn');
  });

  it('"failed" 被 detectHandlerFailure 先一步判成 fail（不走 warn）', () => {
    expect(deriveStepStatus('3 failed', ctx()).stepStatus).toBe('fail');
  });

  // 真跑出来的坑：sec-bug-hunt 扫了 215 个文件、结论「无问题」，只因消息里带了
  // 一句「npm audit 接口不可用」就被 NOOP_RES 判成 noop —— 干了一天活记成「什么都没做」。
  // 现在 handler 返回显式 status，启发式不再有机会误判；这条用例钉住「显式优先」。
  // 旧的 `/无[^]*?[目录配置]/` 能跨整句匹配：明明扫了文件，只要有「无」+「目/录/配/置」
  // 就被当成「没事可做」→ noop。现在限成短距离的「无X目录/配置」。
  it('「无问题（扫描 N 个文件）」不能被判成 noop', () => {
    expect(deriveStepStatus('无问题（扫描 215 个源码文件）', ctx()).stepStatus).toBe('pass');
    expect(deriveStepStatus('无 node_modules 目录，跳过依赖检查', ctx()).stepStatus).toBe('noop');
    expect(deriveStepStatus('无配置文件', ctx()).stepStatus).toBe('noop');
  });

  it('消息里提到「不可用」不影响显式状态', () => {
    const message = ['安全漏洞深度扫描: 无问题', '（扫描 215 个源码文件；2/2 个 package-lock 的 npm audit 接口不可用）'].join('');
    expect(deriveStepStatus(message, ctx()).stepStatus).toBe('noop'); // 纯文本仍会被误判
    expect(deriveStepStatus({ status: 'warn', message }, ctx()).stepStatus).toBe('warn'); // 显式状态优先
  });

  it('「未重复写入」是去重的正常路径', () => {
    expect(deriveStepStatus('记忆内容与最近记录相同，4 个后端均未重复写入（正常去重，本轮无新增）', ctx()).stepStatus).toBe('pass');
    expect(deriveStepStatus('检测到 2 处重复记录', ctx()).stepStatus).toBe('warn');
  });
});

describe('逐行输出不再假绿（失败步骤不能打绿色 ✔）', () => {
  it('fail 状态走 spinner.fail', () => {
    expect(spinnerMethodFor('fail')).toBe('fail');
  });

  it('warn / noop 走 spinner.warn', () => {
    expect(spinnerMethodFor('warn')).toBe('warn');
    expect(spinnerMethodFor('noop')).toBe('warn');
  });

  it('pass / skip / 未知状态不会假装失败', () => {
    expect(spinnerMethodFor('pass')).toBe('succeed');
    // 跳过不打 ✔：没跑与跑干净必须能分辨
    expect(spinnerMethodFor('skip')).toBe('info');
  });

  it('paintByStatus 给失败打 ✖ 前缀', () => {
    expect(paintByStatus('fail', '出错')).toContain('✖');
    expect(paintByStatus('warn', '告警')).toContain('⚡');
    expect(paintByStatus('noop', '无事')).toContain('○');
    expect(paintByStatus('pass', '正常')).toContain('正常');
  });
});
