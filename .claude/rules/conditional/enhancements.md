# 可选增强规则

执行工作流之前，**自动检测项目特征**，对适用的场景弹出可选增强菜单。不适用则不显示。

> **探测器依赖外部工具/项目特征，不满足就不出现 —— 但每次运行都会说清是哪些、为什么。**
> 从第三十一轮起，不满足条件的增强项不再被静默过滤：`applyEnhancements` 会打印
> `⚙ 未提供的增强项（本机不满足条件，既不进菜单也不会执行）: N 项` + 每项一行原因
> （原因取自 `DETECTOR_HINTS`，依赖谁 → 缺什么）；`--enh` 里点名了不可用的项会另打
> `⚠ --enh … 没有启用`。
>
> 因此**本文件不记录机器状态**（「本机装了 mythos-agent 没有 / 装了 gepa 没有」这类句子
> 会过期 —— 上一版写死过「均未安装」，后来其中一个其实已经装上了）。想知道本机情况，跑一次
> 任意场景看开头那段披露即可。

> **清单的真值来源是 `claude-scene/src/lib/enhancements.js` 的 `REGISTRY`**：菜单就是从那里生成的，
> `REGISTRY[场景]` 查不到就一项都不会出现。2026-07-01 清理时删掉了 8 个「场景已经不存在」的分组
> （`audit` `analyze` `hunt` `monitor` `e2e` `design` `prototype` `changelog`）——它们永远不会被触发。
> 本文件里对应的节均**已删除**，不再宣称这些菜单项存在：`/cicd`、`/setup --kind monitor`、
> `/review 安全深度`、`/setup --kind e2e`（`/design` 本身也已退役，现为 `/ui-polish`）。

## 检测规则

`REGISTRY` 只用到下面 5 个探测器；`DETECTORS` 里另外 5 个（`webFrontend` `database` `i18n`
`brandLikelyMentioned` `complexRequirement`）已经没有任何增强项引用 —— 是死代码，
不是「隐性生效」。两个数字都由 `enhancements.test.js` 与代码对账。

| 检测项 | 检测方式 | 出现在哪些场景 |
|--------|---------|---------------|
| 有 UI 文件 | 扫描 `*.css`/`*.tsx`/`*.jsx`/`*.vue`/`*.svelte`/`*.html` | ui-polish、review |
| Stagehand | `@browserbasehq/stagehand` 依赖 | ui-polish、review、release、bugfix、feature、new-project、refactor |
| mythos-agent | `mythos-agent --version` 成功 | review、release、bugfix、feature、deps、refactor |
| Critiq | `@critiq/cli` 依赖 | review |
| GEPA | `python -c "import gepa"` 成功 | optimize、loop |

## 菜单规则

检测到适用特征时弹菜单，3 秒无操作默认勾选（并在选定后打印「3 秒无操作，已按默认值」——
超时是替你选了默认值，不许当成你确认过），未检测到不展示。

**勾了不等于会执行。** 增强项只是往 context 里放 `enh_<key>` flag，只有场景里存在
`condition: "enh_<key>"` 的步骤时才会真的变成一个步骤。因此：

- 菜单里没有步骤消费的项会带后缀「（无场景步骤消费，仅建议）」；
- 选定之后分两栏打印：`⚙ 增强已选（…，场景里有步骤消费）` 与
  `⚠ 增强已选但没有场景步骤消费（…）—— 只是给对话模式 agent 的建议，CLI 下不会执行任何步骤`；
- **没进菜单的项也要说**：条件不满足（缺工具 / 项目没这个特征）的项打印
  `⚙ 未提供的增强项（本机不满足条件，既不进菜单也不会执行）: N 项` + 每项一行原因。
  「没出现」和「出现了但没执行」是两件事，前者以前完全没有说法。

> 真值来源是 `lib/enhancements.js` 的 `consumedEnhKeys()`（扫场景 JSON 的 `condition`）。
> 当前 21 项里只有 3 项被步骤消费（`release` 的 step 13.4 / 13.6、`ui-polish` 的 step 9.7），
> 其余 18 项是给对话模式 agent 的建议项；本文件下表第 4 列即该项的真值，
> 由 `enhancements.test.js` 与代码逐行对账 —— 改了场景或 `REGISTRY` 而不改这里会红。

## 各场景可选增强清单

> 顺序即菜单顺序；「默认」列就是 `default: true`（`--auto` / 非 TTY 时只勾默认项）。
> 「场景步骤」列：`✓ step N` = 场景里真有一个 gated 步骤会执行；
> `仅建议` = 勾了也不会执行任何步骤（只留给对话模式 agent）。

### `/feature`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `stagehand_acceptance` — Stagehand 功能验收 — 新功能完整用户流程浏览器自动化验证 | ✓ | 仅建议（勾了不触发步骤） |
| 2 | `mythos_agent_feature` — mythos-agent 新功能安全审计 — API 端点/文件上传/数据流安全推理 | ✓ | 仅建议（勾了不触发步骤） |

### `/new-project`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `stagehand_scaffold` — Stagehand E2E 脚手架 — 自动生成 Stagehand 测试模板 + CI 配置 | — | 仅建议（勾了不触发步骤） |

### `/review`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `huashu_expert_review` — Huashu 5 维度专家评审 (Layer 6) — UI 设计质量评分 | ✓ | 仅建议（勾了不触发步骤） |
| 2 | `stagehand_behavior` — Stagehand 行为验证 — git diff → 受影响页面自动操作验证（自愈选择器） | — | 仅建议（勾了不触发步骤） |
| 3 | `mythos_agent_review` — mythos-agent 安全深度推理 — 基于 diff 推理新攻击面 | — | 仅建议（勾了不触发步骤） |
| 4 | `critiq_security_scan` — Critiq 确定性安全扫描 — 1,243 条规则 (SQLi/SSRF/路径遍历/反序列化)，零成本秒级 | ✓ | 仅建议（勾了不触发步骤） |

### `/release`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `huashu_release_deck` — Huashu Release Deck — HTML deck → 可编辑 PPTX | — | ✓ step 13.4 |
| 2 | `huashu_release_animation` — Huashu Release Animation — MP4/GIF 发布动画 (需 sharp+playwright) | — | ✓ step 13.6 |
| 3 | `stagehand_smoke` — Stagehand 发布前冒烟 — 关键路径浏览器验证，任一失败阻断发布 | — | 仅建议（勾了不触发步骤） |
| 4 | `mythos_agent_release` — mythos-agent 发布安全门禁 — 假设驱动全量扫描，不通过则阻断 | — | 仅建议（勾了不触发步骤） |

### `/bugfix`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `stagehand_reproduce` — Stagehand 浏览器复现闭环 — 自然语言 → 复现 → 修复 → 验证 | ✓ | 仅建议（勾了不触发步骤） |
| 2 | `mythos_agent_variants` — mythos-agent 同根因排查 — 修一个漏洞，全库扫描同类模式 | ✓ | 仅建议（勾了不触发步骤） |

### `/deps`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `mythos_agent_cve` — mythos-agent CVE 可利用性分析 — 判断 CVE 是否真正到达受影响代码路径 | — | 仅建议（勾了不触发步骤） |

### `/ui-polish`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `huashu_expert_review` — Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality | ✓ | ✓ step 9.7 |
| 2 | `impeccable_audit` — Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感 | ✓ | 仅建议（勾了不触发步骤） |
| 3 | `stagehand_interaction` — Stagehand 交互完整性校验 — 美化后确认 hover/click/focus/modal 未损坏 | ✓ | 仅建议（勾了不触发步骤） |

### `/optimize`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `gepa_evolve` — GEPA prompt 进化 — LLM 反思执行轨迹 → Pareto 进化搜索 → 自动优化场景 prompt | ✓ | 仅建议（勾了不触发步骤） |

### `/loop`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `gepa_self_evolve` — GEPA 自进化模式 — 每轮自动评估 → GEPA 优化 prompt → 循环至收敛 | ✓ | 仅建议（勾了不触发步骤） |

### `/refactor`

| # | 选项（code 里的 key 和 label 原文） | 默认 | 场景步骤 |
|---|---|---|------|
| 1 | `stagehand_regression` — Stagehand 行为回归 — 重构前后浏览器功能一致性验证 | ✓ | 仅建议（勾了不触发步骤） |
| 2 | `mythos_agent_refactor` — mythos-agent 安全审计 — 假设驱动全库扫描 + 数据流变化推理 | ✓ | 仅建议（勾了不触发步骤） |

## 无增强场景

以下场景无可选增强，直接执行核心工作流：
`check`、`cicd`、`mobile-audit`、`mobile-e2e`、`mobile-onboard`、`mobile-optimize`、`mobile-release`、
`mobile-review`、`onboard`、`plan`、`plan-ceo-review`、`qa`、`rollback`、`setup`、`spec`、`update`
