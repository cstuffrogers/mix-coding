# 可选增强规则（精简版）

执行工作流前自动检测项目特征，弹可选增强菜单；3 秒无操作按**默认值**（并把「超时」这件事打印出来），
未检测到不展示。完整版见 `enhancements.md`。

> **探测器依赖外部工具 / 项目特征，不满足就不出现 —— 但每次运行都会说清是哪些、为什么。**
> 不满足条件的项打印 `⚙ 未提供的增强项（本机不满足条件，既不进菜单也不会执行）: N 项` + 每项原因；
> `--enh` 点名了不可用项另打 `⚠ --enh … 没有启用`。**本文件（和完整版）都不记录机器状态** ——
> 那种句子会过期（上一版写死过「均未安装」，后来其中一个其实已经装上了）。

> **勾了不等于会执行。** 增强项只往 context 放一个 `enh_<key>` flag，**只有场景里存在
> `condition: "enh_<key>"` 的步骤时才真的多走一步**。没步骤消费的项在菜单里带「（无场景步骤消费，仅建议）」，
> 选定后还会打印一行 `⚠ 增强已选但没有场景步骤消费` —— 这是给对话模式 agent 的建议，CLI 下什么都不发生。

> **本文件是「生成视图」，真值来源是 `lib/enhancements.js` 的 `REGISTRY` + `consumedEnhKeys()`。**
> `enhancements.test.js` 会把下面每一行与代码逐项对账（场景集合、勾选默认值、`step N`、`⌾` 标记、无人场景清单），
> 改了代码不改这里会红。

## 图例

- `✓` = `default: true`，非交互模式（`--auto` / 聊天界面）会替你勾上
- `step N` = 场景里真有这个步骤读 `enh_<key>`，勾上就多执行一步
- `⌾` = 没有任何步骤消费它：勾了只有 flag，CLI 下什么都不发生

## 各场景增强菜单

- **ui-polish**: `huashu_expert_review` ✓ step 9.7 · `impeccable_audit` ✓ ⌾ · `stagehand_interaction` ✓ ⌾
- **review**: `huashu_expert_review` ✓ ⌾ · `stagehand_behavior` ⌾ · `mythos_agent_review` ⌾ · `critiq_security_scan` ✓ ⌾
- **release**: `huashu_release_deck` step 13.4 · `huashu_release_animation` step 13.6 · `stagehand_smoke` ⌾ · `mythos_agent_release` ⌾
- **bugfix**: `stagehand_reproduce` ✓ ⌾ · `mythos_agent_variants` ✓ ⌾
- **deps**: `mythos_agent_cve` ⌾
- **feature**: `stagehand_acceptance` ✓ ⌾ · `mythos_agent_feature` ✓ ⌾
- **new-project**: `stagehand_scaffold` ⌾
- **optimize**: `gepa_evolve` ✓ ⌾
- **loop**: `gepa_self_evolve` ✓ ⌾
- **refactor**: `stagehand_regression` ✓ ⌾ · `mythos_agent_refactor` ✓ ⌾

## 探测器

`REGISTRY` 用到 5 个：UI 文件（`uiFiles`）、Stagehand 依赖、`mythos-agent --version`、`@critiq/cli` 依赖、
`import gepa`。`DETECTORS` 里另外 5 个（`webFrontend` `database` `i18n` `brandLikelyMentioned`
`complexRequirement`）已无人引用，属于死代码。

## 没有增强项的场景

check cicd mobile-audit mobile-e2e mobile-onboard mobile-optimize mobile-release mobile-review onboard plan plan-ceo-review qa rollback setup spec update

（共 26 个场景，其中 10 个有增强项。）
