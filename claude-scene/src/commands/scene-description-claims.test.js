import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSources } from '../lib/param-contract.js';

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
