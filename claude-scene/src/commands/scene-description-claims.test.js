import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSources } from '../lib/param-contract.js';
import { classifyAction, checkAcceptance } from '../lib/acceptance-check.js';

// 维度：**description 假绿** —— 场景写着「这一步会产出 X」，引擎从没实现过 X。
//
// 真实案例：8 个场景的 report 步骤都写着「成本报告」，`service` 还叫 `CostService`，
// 而 `handleReport` 只把 stepResults 拼成 markdown —— 没有 token 计量、没有 API 调用
// 计数、没有 MCP 使用统计，全仓也没有任何一处采集这些数据。步骤照样 pass，
// 报告里于是有一行「成本汇总」由读者的想象补全。
//
// 守卫分两半，都必须能失败：
//   ① 能力探针：源码里到底有没有成本计量实现（没有 → 这类措辞永远假）
//   ② 文案扫描：场景 description / service 不许出现这类措辞
// 能力一旦被实现（探针命中），第②条就该改写 —— 届时删掉这条守卫而不是放水。

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCENES_DIR = join(SRC_DIR, '..', 'scenes');

// 成本计量的实现痕迹：读 token 用量、统计 API 调用次数、记账费用
const METERING_IMPL = /\b(?:total_tokens|prompt_tokens|completion_tokens|tokenUsage|tokenCount|costUsd|usdCost|apiCallCount|toolCallCount)\b/;

// description 里出现 = 声称本步骤产出成本指标
const COST_CLAIM = [/成本/, /费用/, /计费/, /Token\s*[/、]\s*API/, /API\s*调用成本/, /MCP\s*使用/, /Token 使用/];
// service 名自称成本服务 = 同一个谎话的另一种写法
const COST_SERVICE = /^Cost(?:Service|Tracker|Meter)$/;

function loadScenes() {
  return readdirSync(SCENES_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, scene: JSON.parse(readFileSync(join(SCENES_DIR, name), 'utf-8')) }));
}

/** 命中成本计量的实现文件（按注释外的代码文本判断：注释里提一嘴不算实现） */
function meteringSites() {
  const strip = (text) => text.replace(/\/\/[^\n]*/g, '');
  return collectSources(SRC_DIR)
    .filter((source) => METERING_IMPL.test(strip(source.src)))
    .map((source) => source.file);
}

function costClaims(text) {
  return COST_CLAIM.filter((re) => re.test(text)).map((re) => re.source);
}

describe('场景 description / service 不许声称引擎没实现的成本计量', () => {
  const scenes = loadScenes();
  const sites = meteringSites();

  it('能力探针真的扫了源码（不是空转）', () => {
    expect(collectSources(SRC_DIR).length).toBeGreaterThan(100);
    // 引擎当前确实没有任何成本/token 计量实现 —— 这是下面那条断言的前提
    expect(sites).toEqual([]);
  });

  it('description 扫描覆盖了全部场景步骤（不是空转）', () => {
    const steps = scenes.flatMap(({ scene }) => scene.flow || []);
    expect(steps.length).toBeGreaterThan(300);
    expect(steps.filter((step) => step.description).length).toBeGreaterThan(250);
  });

  it('没有步骤用 description 承诺成本 / token 用量 / API 调用 / MCP 使用统计', () => {
    const offenders = [];
    for (const { name, scene } of scenes) {
      for (const step of scene.flow || []) {
        const hits = costClaims(step.description || '');
        if (hits.length > 0) offenders.push(`${name} #${step.step} ${step.action}: ${step.description}`);
      }
    }
    expect(offenders, `这些 description 承诺了引擎不产出的成本指标：\n${offenders.join('\n')}`).toEqual([]);
  });

  it('没有场景声明成本类 service', () => {
    const offenders = [];
    for (const { name, scene } of scenes) {
      for (const step of scene.flow || []) {
        if (step.service && COST_SERVICE.test(step.service)) {
          offenders.push(`${name} #${step.step} ${step.action}: ${step.service}`);
        }
      }
    }
    expect(offenders, `引擎没有这些服务，场景只是在给读者演戏：\n${offenders.join('\n')}`).toEqual([]);
  });
});

// ── 第二半：能力漂移（第二次踩同一个坑） ──
//
// 之前这里只查「成本计量」一类措辞。真实案例又出现一次：`check` 的场景名写着
// 「引擎自检 + **自愈**」，description 写着「**自动修复** gate-flags 数据文件」，
// 而那两个自愈步骤早在「猜出来的映射没人验证、还每次把工作区弄脏」时就被删了。
// 用户跑 /check 会以为源码被修好了 —— 实际上什么也没改，报告里还留着「修复数」。
//
// 所以判据不是「文案好听不好听」，而是**能不能兑现**：
// 场景声称会动手（自动修复/写入/重构/提交/推送…），flow 里就必须有能动手的步骤 ——
// 引擎直改（edit）或者交给 AI 代做（invokeSkill / runAgent）。
// 顾问式措辞（修复建议 / 修复方案 / 待修复）不算声称，否则满屏假红。
const ADVISORY_PHRASE = /(修复建议|建议修复|修复方案|修复清单|一键修复清单|修复项|修复数|待修复|修复上下文|可修复|需要修改|需修改|修改建议|建议修改)/g;
const MUTATION_CLAIM = /(自动修复|一键修复|自动改|自动写入|自动落盘|写入文件|落盘|修改代码|重构代码|自动提交|自动推送|自动修改)/;

function mutationClaims(scene) {
  const claims = [];
  const scan = (text, where) => {
    const cleaned = String(text || '').replace(ADVISORY_PHRASE, ' ');
    if (MUTATION_CLAIM.test(cleaned)) claims.push(`${where}: ${text}`);
  };
  scan(scene.description, 'scene');
  for (const step of scene.flow || []) scan(step.description, `#${step.step}.${step.action}`);
  return claims;
}

/** 能动手的步骤数：引擎直改 + AI 代做 */
function mutatingSteps(scene) {
  const kinds = (scene.flow || []).map((step) => classifyAction(step.action));
  return { edit: kinds.filter((k) => k === 'edit').length, ai: kinds.filter((k) => k === 'ai').length };
}

describe('声称会动手的场景必须有能动手的步骤', () => {
  const scenes = loadScenes();

  it('扫描真的读了全部场景（不是空跑）', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(20);
    // 至少有一批场景确实声称会动手 —— 否则这条守卫永远绿，等于没写
    expect(scenes.filter(({ scene }) => mutationClaims(scene).length > 0).length).toBeGreaterThanOrEqual(5);
  });

  it('没有「只说不做」的场景', () => {
    const offenders = [];
    for (const { name, scene } of scenes) {
      const claims = mutationClaims(scene);
      if (claims.length === 0) continue;
      const { edit, ai } = mutatingSteps(scene);
      if (edit + ai === 0) offenders.push(`${name}（edit=${edit} ai=${ai}）：${claims.join(' / ')}`);
    }
    const message = `这些场景声称会改代码，但 flow 里没有任何能动手的步骤：${JSON.stringify(offenders)}`;
    expect(offenders, message).toEqual([]);
  });

  it('AI 代做也算动手（否则 invokeSkill 型场景全是假红）', () => {
    const invokeSkillScenes = scenes.filter(({ scene }) => mutatingSteps(scene).ai > 0);
    expect(invokeSkillScenes.length).toBeGreaterThan(0);
    for (const { scene } of invokeSkillScenes) {
      expect(classifyAction(scene.flow.find((s) => mutatingSteps(scene).ai > 0 && /^(invokeSkill|runAgent)/i.test(s.action)).action)).toBe('ai');
    }
  });
});

describe('动作分类器：edit / verify / ai / other', () => {
  it('AI 代做与引擎直改分开，verify 优先', () => {
    expect(classifyAction('invokeSkill')).toBe('ai');
    expect(classifyAction('runAgent')).toBe('ai');
    expect(classifyAction('mp-review')).toBe('verify');
    expect(classifyAction('applyDaisyUI')).toBe('other');
    expect(classifyAction('autoUpdate')).toBe('other');
    expect(classifyAction('writeFile')).toBe('edit');
    expect(classifyAction('')).toBe('other');
    expect(classifyAction(null)).toBe('other');
  });

  it('验收判定里 aiSteps 只是陈述，不参与门禁', () => {
    const flow = [{ step: 1, action: 'invokeSkill' }];
    const r = checkAcceptance(flow, [1]);
    expect(r.aiSteps).toBe(1);
    expect(r.mutating).toBe(true);
    // 交给 AI ≠ 验过：门禁该拦还是拦（这里没有变更类动作，所以本来就不拦）
    expect(r.hasEdit).toBe(false);
    expect(r.unreviewedChange).toBe(false);
  });
});

describe('判定器本身能失败（不是空转）', () => {
  it('「成本报告 / Token/API 调用汇总」→ 点名', () => {
    expect(costClaims('输出本轮迭代的Token/API调用/MCP使用成本汇总')).toHaveLength(3);
    expect(costClaims('审计流程成本报告')).toHaveLength(1);
    expect(costClaims('记录 API 调用成本')).toContain('成本');
  });

  it('设计 token / 正常措辞 → 不算（不误杀）', () => {
    expect(costClaims('导入选中品牌 tokens.css → context.od_brand_css')).toEqual([]);
    expect(costClaims('设计 Token 调和：DESIGN.md / CSS 变量 / tailwind 品牌色')).toEqual([]);
    expect(costClaims('质量门禁：Lint + 类型 + 测试 + 覆盖率 + 安全')).toEqual([]);
  });

  it('service 判据只认成本服务名', () => {
    expect(COST_SERVICE.test('CostService')).toBe(true);
    expect(COST_SERVICE.test('ReportService')).toBe(false);
    expect(COST_SERVICE.test('CostTracker')).toBe(true);
    expect(COST_SERVICE.test('DesignService')).toBe(false);
  });
});
