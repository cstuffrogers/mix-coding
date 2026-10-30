# Changelog

## 2026-10-30（第三十一轮：增强项「根本没出现」也要说为什么）

### Fixed

- **条件不满足的增强项被静默过滤，一个字都不说**：`applyEnhancements` 第一行就是 `(REGISTRY[sceneId] || []).filter(e => e.when(context))` —— `when` 返回 false 的项直接从菜单消失，CLI 从头到尾没有一句解释。用户看到的只是「文档里写的菜单少了几个」，只能猜是不是配置漏了。`review` 场景 4 项里的 `mythos_agent_review` 就是这样消失的（本机没有 mythos-agent CLI）。现改为**先探测再分流**：可用项进菜单，不可用项打印 `⚙ 未提供的增强项（本机不满足条件，既不进菜单也不会执行）: N 项` + 逐项一行原因，交互与非交互两条路径都打。
- **「依赖哪个探测器」以前只活在函数体里**：21 项每项手写 `when: (ctx) => DETECTORS.xxx(ctx.targetPath)`，于是缺席时既说不出原因、也没法静态对账。现改为声明式 `needs: '<探测器名>'`，由 `withWhen()` 派生 `when`（路径型探测器收 `ctx.targetPath`，工具型无参）；`needs` 写了不存在的探测器名 → **加载期**抛 `TypeError`，不让错别字退化成运行期静默 `false`。
- **`--enh` 点名了不可用项也没人管**：`--enh mythos_agent_review` 在没装 mythos-agent 的机器上什么都不会发生，日志也看不出来（用户只会觉得「我加了 flag，跑完一个字没变」）。现打印 `⚠ --enh 里这些增强项本机不满足条件，没有启用: …`。
- **整个场景一项都不可用时静默返回**：`if (enhancements.length === 0) return;` 连「本场景没有增强项」都不打。现在只要 `REGISTRY[sceneId]` 非空就一定会说话（`没有启用任何增强项` + 缺席清单）。
- **两份增强文档写死了会过期的机器状态**：`enhancements.md` 与 `enhancements-summary.md` 都断言「本机 `mythos-agent` 与 `gepa` 均未安装 → 相关项不会出现在菜单里」。实测 `python -c "import gepa"` **成功**（Python 3.14 用户 site-packages 里就有），这句话已是假话，而它正是 agent 每次会话都要读的两份文件。现改为指向运行期披露，并加守卫：文档里不许再出现「工具名 + 未安装 / 没装」的断言。

### Added

- **`DETECTOR_HINTS`：每个探测器一句人话**（「没装 mythos-agent CLI（PATH 里找不到）」「项目依赖里没有 @browserbasehq/stagehand」…）。缺席披露的原因只从这张表读，不现场编；守卫强制 `DETECTORS` 每个键都有解释，**新加探测器不许只带回一个 `false`**。
- `lib/enhancements.js` 导出 `DETECTOR_HINTS`；`usedDetectors()` 改读 `needs` 字段（旧写法用正则去 `String(e.when)` 里找 `DETECTORS.xxx`，派生之后源码里已无此字样，会判出「被用到 0 个」）。
- `enhancements.test.js` 15 → **23 例**：解释表全覆盖 + 反空跑下限；21 项 `needs` 全部指向真探测器、无 `needs` 的必须无条件可用；空项目下 `ui-polish` 缺席披露逐项点名且在场项照旧设 flag；`--enh` 点名不可用项的警告；整场景不可用仍要说话；条件满足时不冒充「未提供」；两份文档不许记录机器状态 + 必须指向运行期披露。

## 2026-10-30（第三十轮：skip/noop 的「原因」分类曾经在说谎）

### Fixed

- **「处理器没声明原因」这个标签在 129 处是假的**：`step-reasons.js` 第二十轮的注释写的是「处理器返回 `{ status:'skip' }` 的那一百多处连一个字的原因都没有」，第三十轮逐站点点过 196 处 `status:'skip'|'noop'` 才发现：**62 处布了结构化 `reason`、129 处把原因写在了 `message` 里**（“未安装 semgrep，跳过”“无 OpenAPI 规范，未测量”这种），真正一字未说的只有 2 处 —— 而它们把原因塞进了显示字段 `base:`。于是汇总行会一边数着「没声明原因 19」、一边在同一屏里打印着原因。
  现分三档，只按「它到底说了什么」分，不按文案猜：① 布了词表内 `reason` → 照用；② 只布了 `message` → **`message-only`**（原因在文案里，只是没结构化）；③ 都没有 → `handler-skip` / `undeclared`（标签改成「连 message 都没给」）。`base` / `tail` 这类显示字段**不算声明**。
- **`flow-control.js` 的两处 CE 分支只有 `base:`**：一个「CE Plugin 未安装」（`tool-missing`）、一个「已安装但需对话模式」（`interactive`），以前都被归入「一个字原因都没有」。现补上结构化 `reason`。
- `noop` 桶同步修：`{ status:'noop', message:'无需重复' }` 以前记 `undeclared`（字面意思是没说原因），现记 `message-only`。

### Added

- **债务棘轮（`step-reasons.test.js` 4 例）**：扫全仓 `{ status:'skip'|'noop' }` 返回站点，冻结第三十轮实测的 131 处「没布结构化 reason」作为**上限（只许变少）**；「连 `message` 都不给、把原因塞进显示字段」的站点必须为 0；声明了 `reason` 的站点不得少于 60（防着有人把整批站点改成 `message-only` 抄近路）；扫描面 > 150 防空跑。
- 分类层新增用例：只布 `message` → `message-only`；连 `message` 都没有（含纯空白）→ `handler-skip`；`base` 不算声明。

## 2026-10-30（第二十九轮：增强项的「勾了会不会真执行」）

### Fixed

- **增强菜单在承诺一件不会发生的事**：`REGISTRY` 里 21 个增强键只有 3 个被场景的 `condition: "enh_<key>"` 消费（`release` 的 step 13.4 / 13.6、`ui-polish` 的 step 9.7），其余 18 个勾上只是往 context 放一个没人读的 `enh_*` flag。此前非交互模式只打印一行 `⚙ 增强已选（非交互模式）: …`，等于告诉用户「已启用」——跑完却一个字都不变（`review` 场景的 4 项全是这种：`huashu_expert_review` / `critiq_security_scan` 默认勾选，却没有任何步骤消费）。现在选定后按「场景里有步骤消费」/「没有场景步骤消费（仅给对话模式 agent 的建议，CLI 下不会执行任何步骤）」分两栏打印，交互菜单里也直接给无消费项加后缀；`--auto` 不再被当作「你确认过了」。
- **3 秒超时静默替用户选了默认值**：`Promise.race` 超时分支只回一个 `_timeout` 标记，选定结果不打任何字。现在超时会出现在同一行披露里（`交互选择：3 秒无操作，已按默认值`）。
- **`.claude/rules/conditional/enhancements-summary.md` 整份是假的**（CLAUDE.md 让每个 session 都读它）：它给 `review` 列了「无障碍✓ · i18n · QA验证✓ · 迁移审查✓」四项——`REGISTRY['review']` 里一个都没有；给 `audit` `hunt` `e2e` `monitor` `design` 这些已退役场景列了完整菜单；`无增强场景` 里又列着已删的 `analyze` `simplify`。现按 `REGISTRY` + `consumedEnhKeys()` 重写成「一行一场景」的生成视图（`✓` = 默认勾选、`step N` = 真有步骤消费、`⌾` = 勾了不执行），并由测试逐字对账。
- **`enhancements.md` 的探测器数量也是假的**：写着「只有 4 个探测器被 `REGISTRY` 用到」，实际是 5 个（漏了 GEPA，`optimize`/`loop` 在用），而「没有任何增强项引用」的死探测器是 5 个不是 4 个（`i18n` 连场景都没引用过）。表格补齐 GEPA 行，死探测器点名 5 个。CHANGELOG 里「探测器表只留真正被引用的 4 个」这句同错，一并订正。
- **场景副本守卫在 autocrlf 机器上会假红**：第二十八轮那条守卫比的是工作区字节，而 `.gitattributes` 没锁场景 JSON —— `core.autocrlf=true` 下同一份内容会被检出成不同字节（blob 里已带 CR 的还会变成 CRCRLF，`check.json` 实测 2635 → 2722）。现改为比较归一化行尾后的内容：真分叉（改了一边没改另一边）依然会红。

### Added

- **`claude-scene/src/lib/enhancements.test.js`（15 例）**：`consumedEnhKeys()` 三态（ui-polish 一项 / review 零项 / release 两项 / 场景不存在返回空集）、`partitionSelection()` 纯函数边界、幽灵增强键守卫（场景里写的 `enh_xxx` 必须在 `REGISTRY` 名单里，扫全部 26 个场景）、非交互披露两栏文本 + flag 仍要设上、`enhancements.md` 21 行 「场景步骤」列对账、`enhancements-summary.md` 逐行对账 + 无人场景清单 + 退役场景名 + 探测器数量与名单。
- `lib/enhancements.js` 导出 `ENHANCEMENT_REGISTRY` 与 `DETECTORS`（文档对账需要真值，不能靠手抄）。
- `DECISIONS.md` 新增 ADR-023（菜单里承诺的能力必须有步骤消费，否则当场披露；文档中的「一行一场景」视图必须与代码对账）。

## 2026-07-01

### Fixed

- **场景真值曾经有两份，校验器各读一份**：`.claude/scenes/*.json`（项目覆盖层）与 `claude-scene/scenes/*.json`（随包内置）26 个文件相同，引擎跑的是覆盖层，而 `check-readme-stats` / `check-action-stats` / `check-doc-counts` / `check-tool-steps` 读的却是内置那份。实测往覆盖层加一步（运行时 43→44 步），`check-readme-stats` 仍报「583 步…全部对得上」。现新增 `scripts/lib/scene-dir.cjs`（`sceneTiers()` / `resolveScenes()`，层顺序与引擎 `getSceneDirs()` 一致、同名覆盖层优先），七个脚本全部改用它；README 校验器的「真值」行会打印这次读的是哪几层。
- **`scan-scenes.cjs` 的输入也换成同一视图**：默认从运行时视图统计（覆盖层优先），两份副本分叉时不会再数错「哪一份才是真在跑的」。
- **pre-commit 新增第四道门禁**：提交前重跑 `scan-scenes.cjs`，若 `scripts/scenes-stats.json` 与场景文件不同步则拦截（陈旧产物不许落地）。此前没有任何环节重跑它。

### Added

- **`claude-scene/src/commands/scene-dir.test.js`（13 例）**：层顺序四态（只有内置 / 只有覆盖层 / 两层 / 两层皆空 + `MIX_CODING_SCENES_DIR` 显式覆盖）、真仓库两份副本逐字节相同守卫（自探针：改一个字节即红）、「校验器读的目录 == 引擎 `resolveScenePath()` 返回的目录」、「覆盖层写 4 步 / 内置 3 步时文档必须按 4 步校验」的回归用例、以及「凡读场景的脚本必须 require `scene-dir.cjs`」的静态守卫。
- `DECISIONS.md` 新增 ADR-022（场景真值的唯一定义 + 为什么是合并而不是只读覆盖层）。

### Removed

- **opencode 支持退役**：删除 `.opencode/`（`deploy-global.cjs` / `opencode.jsonc` / `AGENTS.md`）、`scripts/generate-opencode-config.cjs`、`scripts/setup-opencode-global.sh`、`scripts/check-opencode-config.cjs` 及其测试。此前这套「全局配置生成器 + 部署脚本 + 校验器」是纯维护负担：模板里的文件名与步骤数反复与仓库真值漂移，而该平台已不再使用。`platform.js` 保留 `OPENCODE=1` 识别（仅为行为可预期），不再提供任何 opencode 专属配置。
- 同步删除 `scripts/scenes-stats-utf8.txt`、`claude-scene/.express-sec-audit-cache.json` 两个陈旧产物，并在 `.gitignore` 拦住复活。
- **退役命令的残留引用清理**：`.pi/skills/scene-runner/SKILL.md`、`.claude/commands/review.md`、`AGENTS.md`、`.codex/AGENTS.md`、`.zcode/AGENTS.md`、README 使用示例里把 `/hunt` `/e2e` `/monitor` `/analyze` `/audit` 当现存命令的写法全部改掉（改成 `/review` / `/setup` 或明确标「旧名」）。
- **`lib/enhancements.js` 删掉 8 个死增强分组**：`audit` `analyze` `hunt` `monitor` `e2e` `design` `prototype` `changelog`。`applyEnhancements` 按 `REGISTRY[sceneId]` 查表，这些场景 JSON 都不存在 → 对应增强项永远不会出现在菜单里，是纯死配置（`ENHANCEMENT_KEYS` 也跟着少 8 个键）。
- **`.claude/rules/conditional/enhancements.md` 按 `REGISTRY` 重写**：删掉 `/cicd`、`/setup --kind monitor`、`/review 安全深度`、`/setup --kind e2e`、`/design` 五节（都是死分组），清单改为逐项列出 code 里的 `key` + `label` + 默认值，探测器表只留真正被引用的 4 个。

### Fixed

- **README 外部工具表「负责工作流」列长期在编数字**：写着 `/review` (step 4.10) / (step 4.12) / (step 4.15) / (step 3) 等，`review.json` 里根本没有这些 `step`；整列还指向 `/audit` `/hunt` `/e2e` 这些已删场景。现按 scene JSON 真值重写（如 recheck-cli 4.1、log-sanitizer 4.3、sensitive-file-check 4.55、seraphim-audit 4.56、jscpd 2.95、size-limit 2.96、Stryker qa@6.5），没有 handler 或没有场景步骤调用的工具（trivy / shellcheck / sqlfluff / bruno / commitlint / biome / ruff / hurl / lychee / Spectral / markdownlint）改标「未接入」，不再宣称自动执行。
- **新增 `scripts/check-tool-steps.cjs`**：校验三份文档（README.md / README_EN.md / `.claude/rules/conditional/security-toolchain.md`）工具表里每个 `` `/scene` (step N) `` 的场景存在且 `N ∈ flow[*].step`；退役场景、幽灵场景、编的步骤号一律 exit 1，表结构/引用格式变了 exit 2。
- **新增 `retired-commands.test.js` 守卫**：活的文档里退役命令必须以「旧名/已合并/已并入/退役/已删除/原」标注；增强项文档与 `REGISTRY` 一一对应；`REGISTRY` 的每个分组必须挂在真实场景上。

### Quality

- **ESLint 错误归零 (1216→0, -100%)**：93 个 sonarjs 规则违规全部修复（47 super-linear-regex、51 cognitive-complexity、21 no-unused-vars、10 no-dead-store 等）
- **56 个文件手术式修改**：跨 20 个 handler 文件提取约 100 个帮助函数以降低认知复杂度
- **正则全面提升**：57 处超线性/复杂/慢正则全部修复（bounded quantifier + 分割数组 + 重构）
- **死代码清理**：44 处未使用变量/导入/集合 + 10 处无用赋值 + 2 处重复分支全部移除
- **测试改进**：3 处 `expect` 断言改用精确匹配（toHaveLength/toBeNull）

### Changes

- 新增 `.mcp/**` 至 ESLint 忽略列表（vendor 代码不扫描）
- 移除 68 个已失效的 `eslint-disable` 注释
- `REFACTOR.md` 新增：README 文档质量提升

## 2026-06-30

### Features

- **opencode 全平台适配**：命令 + MCP + Provider 全局配置（数量由 `.opencode/deploy-global.cjs` 生成时统计，不在文档里写死），与 Claude Code 工作流对齐
- **38/38 .md 工作流引用**：所有 `.claude/commands/*.md` 在 opencode 模板中均有对应引用
- **Harness Engineering 合规**：完成 12 维度审计，评分从 64% 提升至 ~96%（Tier A）
- **Harness 状态文件**：新增 `feature_list.json`、`progress.md`、`DECISIONS.md`
- **会话生命周期**：新增 `init.sh`（环境检查）、`scripts/clean-session.cjs`（结束清理）、`zero-conflict-check.sh`（架构合规）
- **CI 流水线**：`.github/workflows/ci.yml` — lint → test 全自动
- **代码质量钩子**：`.husky/pre-commit` 扩展为 eslint + test + 死代码扫描
- **定时任务**：`.claude/scheduled_tasks.json` — 3 项维护任务
- **AGENTS.md**：升级为完整 Harness 操作手册（5 节），同步至 `.opencode/`、`.codex/`、`.zcode/`
- **配置生成器**：`scripts/generate-opencode-config.cjs` + `.opencode/deploy-global.cjs`（Node.js 方案替代脆弱的 shell heredoc）

### Changes

- `scripts/setup-opencode-global.sh` 重构：495 行 heredoc → 调用 deploy-global.cjs
- `ARCHITECTURE.md`、`docs/MULTIPLATFORM.md`、`README.md` 同步更新
- `.mcp.json` 新增 9 个 MCP 服务器（sentry/supabase/stripe/resend/schemaforge/a11y/mobsf/detox/bearer）

## 2026-06-05

### Features

- 新增 `/migration` 工作流：数据库迁移审查，内置 8 种危险 SQL 模式检测（DROP TABLE / NOT NULL 无默认值 / 类型变更等）
- 新增 `/loadtest` 工作流：Artillery 负载测试集成，支持 smoke/load/stress 三级
- 新增 `migration.js` handler：双模式分析（db-scalability-guardian + 内置规则）
- 新增 `handleLoadTest` handler：Artillery 配置发现与执行

### Bug Fixes

- 修复 `migrationHighCount > 0` 条件永远返回 false 的 CRITICAL bug（`evalClause` 不支持纯数字 `>` 比较）
- 修复 `runArtillery` catch 块标记 `ran: true` 导致"未安装"分支不可达
- 修复 `handleCheckGate` 缺少 `migration` 和 `loadtest` 门禁类型
- 修复 `migration.json` step 8 通知消息措辞不准确
- 修复 `flow-control.js` 认知复杂度超标（18→below 15）
- 修复 `review.js` 认知复杂度超标（22→below 15）
- 修复 `testing.test.js` Buffer 未定义问题（8 处）

### Dead Code Cleanup

- 移除 `handleGenerateChangelog`（ACTION_REGISTRY 使用 `handleChangelog`，此函数无引用）
- 移除 `ARCHON_DIR`（全项目零引用）
- 移除 3 个 UI handler 重导出（ui-polish.js 使用本地版本）

## 历史

- 添加 anthropic-cybersecurity-skills 安全测试用例 - SQLi/XSS/命令注入测试文件
- 修复工作流安全审计配置
