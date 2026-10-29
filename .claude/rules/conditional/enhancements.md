# 可选增强规则

执行工作流之前，**自动检测项目特征**，对适用的场景弹出可选增强菜单。不适用则不显示。

> **探测器依赖外部工具，装不上就不出现。** 当前机器上 `mythos-agent`（2026-10-27 工具清理时移除，
> `npm i -g mythos-agent` 可装回）与 `gepa`（python 模块）均未安装，因此下文 mythos / GEPA
> 相关的增强项不会出现在菜单里 —— 不是配置漏了，是工具不在。其余增强不受影响。

> **清单的真值来源是 `claude-scene/src/lib/enhancements.js` 的 `REGISTRY`**：菜单就是从那里生成的，
> `REGISTRY[场景]` 查不到就一项都不会出现。2026-07-01 清理时删掉了 8 个「场景已经不存在」的分组
> （`audit` `analyze` `hunt` `monitor` `e2e` `design` `prototype` `changelog`）——它们永远不会被触发。
> 本文件里对应的节（`/cicd`、`/setup --kind monitor`、`/review 安全深度`、`/setup --kind e2e`、`/design`）
> 也一并删除，不再宣称这些菜单项存在。

## 检测规则

只有下面 4 个探测器被 `REGISTRY` 用到（其余探测器函数还在，但没有任何增强项引用它们）：

| 检测项 | 检测方式 | 出现在哪些场景 |
|--------|---------|---------------|
| 有 UI 文件 | 扫描 `*.css`/`*.tsx`/`*.jsx`/`*.vue`/`*.svelte`/`*.html` | ui-polish、review |
| Stagehand | `@browserbasehq/stagehand` 依赖 | ui-polish、review、release、bugfix、feature、new-project、refactor |
| mythos-agent | `mythos-agent --version` 成功 | review、release、bugfix、feature、deps、refactor |
| Critiq | `@critiq/cli` 依赖 | review |

## 菜单规则

检测到适用特征时弹菜单，3 秒无操作默认勾选，未检测到不展示。

## 各场景可选增强清单

> 顺序即菜单顺序；「默认」列就是 `default: true`（`--auto` / 非 TTY 时只勾默认项）。

### `/feature`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `stagehand_acceptance` — Stagehand 功能验收 — 新功能完整用户流程浏览器自动化验证 | ✓ |
| 2 | `mythos_agent_feature` — mythos-agent 新功能安全审计 — API 端点/文件上传/数据流安全推理 | ✓ |

### `/new-project`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `stagehand_scaffold` — Stagehand E2E 脚手架 — 自动生成 Stagehand 测试模板 + CI 配置 | — |

### `/review`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `huashu_expert_review` — Huashu 5 维度专家评审 (Layer 6) — UI 设计质量评分 | ✓ |
| 2 | `stagehand_behavior` — Stagehand 行为验证 — git diff → 受影响页面自动操作验证（自愈选择器） | — |
| 3 | `mythos_agent_review` — mythos-agent 安全深度推理 — 基于 diff 推理新攻击面 | — |
| 4 | `critiq_security_scan` — Critiq 确定性安全扫描 — 1,243 条规则 (SQLi/SSRF/路径遍历/反序列化)，零成本秒级 | ✓ |

### `/release`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `huashu_release_deck` — Huashu Release Deck — HTML deck → 可编辑 PPTX | — |
| 2 | `huashu_release_animation` — Huashu Release Animation — MP4/GIF 发布动画 (需 sharp+playwright) | — |
| 3 | `stagehand_smoke` — Stagehand 发布前冒烟 — 关键路径浏览器验证，任一失败阻断发布 | — |
| 4 | `mythos_agent_release` — mythos-agent 发布安全门禁 — 假设驱动全量扫描，不通过则阻断 | — |

### `/bugfix`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `stagehand_reproduce` — Stagehand 浏览器复现闭环 — 自然语言 → 复现 → 修复 → 验证 | ✓ |
| 2 | `mythos_agent_variants` — mythos-agent 同根因排查 — 修一个漏洞，全库扫描同类模式 | ✓ |

### `/deps`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `mythos_agent_cve` — mythos-agent CVE 可利用性分析 — 判断 CVE 是否真正到达受影响代码路径 | — |

### `/ui-polish`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `huashu_expert_review` — Huashu 5 维度专家评审 — philosophy/hierarchy/craft/functionality/originality | ✓ |
| 2 | `impeccable_audit` — Impeccable 设计打磨 — 27 条反模式规则 + 12 条 LLM 批判规则，去 AI 塑料感 | ✓ |
| 3 | `stagehand_interaction` — Stagehand 交互完整性校验 — 美化后确认 hover/click/focus/modal 未损坏 | ✓ |

### `/optimize`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `gepa_evolve` — GEPA prompt 进化 — LLM 反思执行轨迹 → Pareto 进化搜索 → 自动优化场景 prompt | ✓ |

### `/loop`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `gepa_self_evolve` — GEPA 自进化模式 — 每轮自动评估 → GEPA 优化 prompt → 循环至收敛 | ✓ |

### `/refactor`

| # | 选项（code 里的 key 和 label 原文） | 默认 |
|---|------|------|
| 1 | `stagehand_regression` — Stagehand 行为回归 — 重构前后浏览器功能一致性验证 | ✓ |
| 2 | `mythos_agent_refactor` — mythos-agent 安全审计 — 假设驱动全库扫描 + 数据流变化推理 | ✓ |

## 无增强场景

以下场景无可选增强，直接执行核心工作流：
`check`、`cicd`、`mobile-audit`、`mobile-e2e`、`mobile-onboard`、`mobile-optimize`、`mobile-release`、
`mobile-review`、`onboard`、`plan`、`plan-ceo-review`、`qa`、`rollback`、`setup`、`spec`、`update`
