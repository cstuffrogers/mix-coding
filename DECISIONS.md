# Mix-Coding System — Architectural Decisions

> 记录所有架构决策，便于后续 Agent 会话理解设计意图。
> 基于 ADR (Architecture Decision Records) 实践。

---

## ADR-001: 三层架构 + Scene 引擎

**Status**: ACCEPTED
**Date**: 2026-06-01
**Decided By**: System Architect

### Context

需要一种可扩展的架构来支持多种 AI 编码场景（新项目、功能开发、bug 修复、代码审查、重构、设计等），
同时保持代码库的可维护性和工具间的零冲突。

### Decision

采用三层架构：
- **交互层**: Scene 引擎 + CLI 命令路由
- **能力层**: 独立 Service (MemoryService, ReviewEngine, TestEngine, DesignService, OpenDiggerService)
- **运行时层**: AI 模型 + MCP 服务器 + 工具链

每个场景由独立的 JSON 文件定义，通过 `node src/index.js start <scene>` 触发。

### Consequences

- 正向: 场景之间完全隔离，添加新场景不修改现有代码
- 正向: 工具命名前缀机制 (memory-*, review-*) 防止命名冲突
- 负向: 场景 JSON 可能膨胀 (audit.json 达 620 行)

---

## ADR-002: 多平台支持 (Claude Code + opencode + Codex + ZCode + pi)

**Status**: ACCEPTED
**Date**: 2026-06-15 (2026-10-24 更新: 新增 pi)
**Decided By**: System Architect

### Context

项目需要在多个 AI 编码平台上运行，每个平台有不同的配置格式和命令机制。

### Decision

- `.claude/` 作为共享资源宿主（scenes/skills/rules/memory/plugins）
- 各平台通过环境变量 (CLAUDECODE/OPENCODE/CODEX/ZCODE/AI_AGENT) 自识别
- opencode 采用全局配置 (`~/.config/opencode/opencode.json`) + 项目配置的 双层架构
- 共享配置通过 `CLAUDE.md` → `AGENTS.md` 链引用
- pi 使用专属 `.pi/` 目录（官方 CONFIG_DIR_NAME） + 引擎 CLI；percho 是 pi 的桌面端 GUI，共用 `.pi/` 与引擎，不单独识别

### Consequences

- 正向: 一次配置，五个平台可用
- 正向: `.claude/commands/*.md` 38 个工作流在 opencode 中 100% 对齐
- 负向: ZCode / pi 尚未实测（AI_AGENT=pi 标记已从 pi 源码核验）

---

## ADR-003: Harness Engineering 实践

**Status**: ACCEPTED
**Date**: 2026-06-30
**Decided By**: System Audit

### Context

Harness Engineering Audit 发现 3 个关键状态文件缺失 (feature_list.json, progress.md, DECISIONS.md)，评分 64% (Tier C)。

### Decision

采用基于 [Learn Harness Engineering](https://github.com/walkinglabs/learn-harness-engineering) 的实践：
- `feature_list.json`: 机器可读的功能边界，强制 WIP=1
- `progress.md`: 人类可读的会话历史，跨 Session 恢复上下文
- `DECISIONS.md`: 架构决策记录，让新 Agent 理解设计意图
- `init.sh`: 会话初始化脚本，验证环境健康
- 5 个子系统: Instructions + State + Verification + Scope + Session Lifecycle

### Consequences

- 正向: 严格 WIP=1 控制 Agent 不越界
- 正向: 跨会话上下文不再丢失
- 负向: 需要维护额外文件

---

## ADR-004: 记忆写入侧去重（内容指纹）

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: Memory audit round 5

### Context

一次结果写 4 个后端（project-memory / claude-mem / agentmemory / NEXO）。
`autoRemember` 的 data 里带 `timestamp: new Date().toISOString()`，而 project-memory
的旧去重是「完整内容 sha256」—— 于是每跑一次场景，4 个后端各多一份完全相同的内容。
清单计数一路涨，召回侧又去重成一条，用户看到的「记忆在变多」是假的。

### Decision

- 统一指纹 `contentFingerprint(value)`：规范化 JSON（键排序 + 忽略
  `timestamp` / `ts` / `created_at` / `updated_at` / `stored_at` / `archived_at`）后 sha256。
- **不忽略 `id`**：它常是 data 里区分两条记录的字段，忽略会导致真实记忆被判重丢失。
- 判重必须带项目路径：否则 B 项目的同名内容被 A 项目的记录「挡住」，B 永远查不到。
- 窗口 7 天（`DEDUPE_WINDOW_MS`）：无限长会让周期性检查永远只留第一天那条。
- 判重失败一律照写；`{skipped:true}` 的消息措辞不得含「失败」（引擎按
  `/失败|阻断|FAIL/` 判步骤失败）。
- 四个后端各自实现：claude-mem items（前 20 条）/ markdown（标题区写指纹，查最近 10 个文件）/
  agentmemory（新增 `content_hash` 列，判定下推 SQL）/ NEXO（事件 JSON 带 `fingerprint`，查 50 个）。

### Consequences

- 正向: 重复跑不再堆副本；消息如实说明「N 个后端命中相同内容未重复写入」
- 负向: 指纹是启发式而非数据库约束，极端并发仍可能各写一份（锁只保证文件不截断）
- 负向: agentmemory 多一次 `SELECT COUNT(*)`（有 `type` 索引，代价可接受）

---

## ADR-005: `.archive` 用压缩收敛，不删

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: Memory audit round 5

### Context

保留策略一律「归档不删除」，代价是 `.archive` 无限增长。删除用户记忆是不可逆的
（历史审计中已两次因此拒绝删除方案）。

### Decision

`pruneAll` 末尾调用 `compactArchives()`：把 30 天（`archiveOlderThanDays` 可调）以前的
归档文件 gzip 成 `.gz`，覆盖四个归档根。压缩件非空且回读非空才删原文件；已有 `.gz`
不覆盖；单文件 > 64MB 跳过（`gzipSync` 一次性读内存）；失败数 / 超大数必须打印。

### Consequences

- 正向: 空间增长被压住，且数据一条不丢（`gunzip` 即可还原）
- 负向: 归档件的格式从 `.jsonl` 变成 `.jsonl.gz`，外部工具若直接读归档目录需自行解压
- 负向: `.gz` 永不删除，体积增长变慢但不归零

---

## ADR-006: `.codegraph/`（130MB）保留，不重建

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: Memory audit round 5

### Context

`E:/auto-coding/.codegraph/codegraph.db` 约 130MB（3567 节点），已被 `.gitignore` 忽略，
不随仓库分发。重建需要外部 codegraph MCP 服务，当前环境网络受限（github/Docker Hub 不可达）。

### Decision

保留现状，不做删除/重建。理由：它不是仓库内容，不影响测试与安装；删掉只是把
「下一次查询变慢」提前，且重建能力依赖一个当前不可用的外部工具。

### Consequences

- 正向: 不引入无法验证的破坏性操作
- 负向: 本地磁盘占用 130MB；数据库内容随代码演进会过时（`codegraph` 查询结果可能滞后）

---

## ADR-007: MCP 可用性以配置文件为准，不以「是不是在对话里」为准

**Status**: ACCEPTED
**Date**: 2026-10-26
**Decided By**: 全工作流健康检查

### Context

`conditions.js` 里所有 `*_mcp_available` 都是 `isConversationMode()`。这在 Claude Code 时代
勉强成立（那个宿主会自动加载 `.claude/mcp.json`），但它表达的是「我在对话里，所以什么
MCP 都有」——和真实配置无关。宿主收敛到 pi 之后，配置里只剩 schemaforge / a11y / detox
三个 server，而 github / sentry / tavily / context7 / codegraph / supabase / stripe / resend
的条件依然全部判「满足」，场景于是排了一串「调用不存在的工具」的步骤，跑起来才发现
工具不在，而且步骤状态是 pass。

### Decision

新增 `src/lib/mcp-config.js`，按 `项目 .pi/mcp.json → 用户 ~/.pi/agent/mcp.json →
.claude/mcp.json` 的顺序读配置，`hasMcpServer(kind)` 只认配置里真实存在且未
`enabled: false` 的条目；`conditions.js` 的 MCP 条件改为走它。`memory` / `codeguardian`
是引擎自带 handler，恒为真；`crg_skill_available` 是技能不是 MCP，仍按对话模式判断。

### Consequences

- 正向: 缺工具时步骤显示「跳过」而不是假装可用；`/check` Pass 10 与条件判定使用同一份配置
- 正向: 加装 MCP 后条件自动变真，不需要改代码
- 负向: 同一份配置在两处（项目级 / 用户级）需要同步维护
- 负向: 配置文件写错（JSON 语法错）会被判成「没有 server」，需靠 Pass 10 报错提示

## ADR-008: 检查步骤一律三态（issues/pass/skip），跳过不许报 pass

### Context

`loop` 场景一次 run 报 9 pass / 0 fail，工作区却 0 变更。根因不止一处，但共性是同一个：
**「没跑成」和「跑过且干净」在代码里都是 `false`**。

- `runTypeCheck` 返回 boolean：根目录没有 `tsconfig.json` 时 `npx tsc --noEmit` 打印帮助并
  exit 1，帮助文本里的 `--noEmitOnError` 命中 `/error|Error/` → 判「配置问题，跳过」→
  `return false` → 上层 `deriveStepStatus` 只能从自由文本猜状态，猜成 pass。
- `handleRunReview` 返回纯字符串，状态由 `NOOP_RES` / `WARN_RES` 正则反推，处理器
  无法表达「这步跳过了」。
- `runAislopFixMode` 连 catch 都写 `aislop_fixed = true`，失败也报「修复完成」。

### Decision

1. 检查类 handler 返回 `{ status: 'issues'|'pass'|'skip', detail }`，由 `runQualityGates`
   汇总：有 issues → warn；全部 skip → skip；部分 skip → warn（通过但结论不完整）。
2. `deriveStepStatus` 优先认 `result.status`（白名单 pass/fail/skip/noop/warn），
   正则启发式只作为纯字符串返回值的兜底。
3. 允许多个 tsconfig：根 → 一层子目录探测（跳过 node_modules/dist/coverage 等），
   逐个 `tsc --noEmit -p`，不再假设「根必须有 tsconfig.json」。

### Consequences

- 正向：跳过会显示成 skip/warn 并写明「部分检查未执行」，不再产出假绿
- 正向：本仓库根无 tsconfig.json 的现状被如实覆盖（探到 `claude-scene/tsconfig.json`）
- 负向：返回类型从 string 变成 string|object，所有读 `result` 的调用点需经
  `formatResultForDisplay` / `deriveStepStatus`（已改 `runStep` 的 deploy 分支）

## ADR-009: 自动修复要有上限，超限只报警

### Context

`loop` 场景定位是无人值守自动迭代修复，但 `aislop fix` 没有 `--include`/`--changes`
之类收窄参数。本仓库当前 945 处发现、543 处可自动修复 —— 放它跑就是一次动几百个文件，
而 loop 的每一步都在无人复核的情况下执行。

### Decision

`aislop-fix` handler 分两段：先扫（JSON 解析 + 落盘），可修复数 ≤ `maxFindings`
（循环场景设 200）才执行 `aislop fix --safe` 并复扫对比；超限只返回 warn + 报告路径，
把「要不要批量改」留给人工。

### Consequences

- 正向：无人值守场景不会因为一个工具的默认行为把仓库改乱
- 正向：每次扫描都有 `.claude/reports/aislop-*.json` 存档，超限情况可人工按报告处理
- 负向：945/543 的仓库实际上永远走「只报警」分支，自动修复只在干净项目里生效

## ADR-010: 泄露密钥不轮换、不重写历史，改为抹除全部本机副本

**Status**: ACCEPTED
**Date**: 2026-10-27
**Decided By**: 仓库所有者明确指示（「删除备份，不要轮换密钥了，副本也可以不要」）

### Context

`codewhale-config.toml` 里的明文 key（`sk-SW1…`）自初始提交 `013c00c` 起就在 git 历史里，
且在本机散落多处（pi 会话转录、VS Code 配置与本地历史、一块桌面便签、微信收到的
`API.txt`、aardio 示例、cc-switch 数据库、以及整个 8.0 GB 清理备份目录）。此前文档的
处置建议是「只有轮换有效，其余都是止损」。

所有者决定不轮换。原因：使用这把 key 的工具（codewhale / deepseek / cc-switch /
Claude Code）已全部卸载，已无调用方；轮换需要登录服务商后台人工操作；而重写历史会
打断所有克隆与提交 ID。

### Decision

1. **不轮换密钥**，**不** 执行 `git filter-repo`。风险在 `docs/SECURITY.md` §1.0 书面记录：
   历史里的字符串仍是活凭据，接受它成立的前提是「仓库不公开、无协作者」。
2. **抹除全部本机副本**：12 个文件逐一处理，`grep` 复核残留 = 0。
3. **删除清理备份目录** `E:/ai-tools-backup-20261027/`（8.0 GB，含 20+ 个相同明文）。
   承诺过的「移动不删除 + MANIFEST 还原」到此终止，还原能力随之消失 —— 这是所有者
   明确要求的，但必须在文档里写清楚。

### Consequences

- 正向：本机明文副本 **0**；仓库里只剩占位符 `${CODEWHALE_API_KEY}`
- 正向：抹除手段是**等长字节覆盖**，不改文件长度 —— 会话/trace 正被 pi 追加写，
  整文件重写会截断并发内容。事后校验 8 072 行 JSON **0 坏行**
- 负向：**历史 `013c00c` 仍是活凭据**。仓库一旦公开或加协作者，必须先轮换或先重写历史
- 负向：**备份删除不可逆**。那些已卸载的工具要恢复只能重装，`MANIFEST.md` 的还原命令失去作用
- 负向：`~/Documents/xwechat_files/**/API.txt` 早已外流，抹本机副本不影响对方手里的那份

## ADR-011: aislop 自动修复按「规则会不会删行」门控，而不是按条数

### Context

ADR-009 的判据是「可修复数 ≤ 200 就跑 `aislop fix --safe`」。实测三条事实推翻了它：

1. 543 处可修复里 481 处属 `console-leftover`(325) 与 `narrative/trivial-comment`(156)，
   这两类规则的 fix 动作是**删行**（源码 `fixFileDeadPatterns`）
2. `--safe` 不删 console，但**删注释**——本仓库一次全仓 `--safe` 删掉 494 行
3. `aislop fix` **不读** `.aislop/config.yml`（scan/ci 认），所以「配置里关掉」不等于「fix 不会做」

同时规则前提在本仓库不成立：它判 CLI 靠文件名（`cli.js`/`*-cli.js`）或目录
（`tools|scripts|cli|bin`）或 `#!`/`require.main`，而本引擎的 CLI 是 `src/index.js` +
`src/handlers/*.js`，381 处承担输出的 console 被判成「遗留调试」（aislop 自己归为
`style-policy`，不是 defect）。

### Decision

- `.aislop/config.yml` 关掉三条「fix=删行」规则、排除第三方副本 → 946→422 / fixable 543→42
- `aislop-fix` 先算 `planAutoFix`，只有 `reason === 'ok'`（全部命中安全规则清单、在条数上限内）
  才执行；四种拒跑原因各自说明：`config-ignored`（配置关过规则而 fix 不认配置）、
  `risky-rules`（含删代码规则的明细）、`unverifiable`（拿不到逐条明细，fail-closed）、
  `over-limit`
- 拒绝时不改任何文件，只写报告 + 一句话原因

### Consequences

- 正向：无人值守场景再也不会因为「工具默认修复=删代码」把业务输出/注释删掉
- 正向：报告不再报「543 可修复」这种诱导性数字，而是「422 处问题，42 处安全可修」
- 负向：本仓库的 console/注释类问题永远不会自动修 —— 这是**刻意**的，真解法是收敛到
  `src/lib/logger.js`（aislop 对 `logger.js` 有硬豁免），需单独立项

## ADR-012: 条件求值一律以「目标项目 + 探测结果」为准，禁止读冻结的 PROJECT_ROOT

### Context

同一类 bug 在本仓库出现了四次，每次表现都是「条件恒假 / 检查对象错」：

1. `detectLlmProxyAuditHealth()` 读 `PROJECT_ROOT` → `--target` 别项目时审计引擎自己
2. `checkCePlugin()` 读 `PROJECT_ROOT` → 永远报「CE 插件已安装」
3. `build_artifacts_exist`/`spec_file_exists` 等 6 个文件类谓词读 `PROJECT_ROOT`
4. `mobile_platform`/`ios_platform`/`android_platform` 只读 `ctx.platform`，而
   `detectProject` 写的是 `project_type` + `platforms` → 移动端平台条件永远为假

根因不是疏忽，而是**事实有两个来源**：import 时冻结的 `PROJECT_ROOT`（= cwd 或
`$MIX_CODING_PROJECT_DIR`）和运行时的 `context.targetPath`；外加「用户显式输入」与
「工具探测结果」两套字段名。

### Decision

- 条件谓词里凡是要碰文件系统的，一律 `rootOf(ctx) = ctx.targetPath || PROJECT_ROOT`
- 平台类事实统一走一个 `platformFlags(ctx)`：显式 `ctx.platform`（ios/android/both）
  ∪ 探测结果 `ctx.platforms` ∪ `project_type === 'expo'`（双端）
- 检查类 handler（check 的 Pass）同样跟随 `targetPath`，不再各自读 PROJECT_ROOT
- 新增一条常驻回归：**遍历 `SIMPLE_CONDITIONS` 全部谓词，用空 ctx 逐个求值不得抛**
  （这条直接抓出了 `dependencycheck_available` 漏形参 → 整条 workflow 崩）

### Consequences

- 正向：`--target 别的项目` 时所有条件与检查都指向目标项目，行为可预测
- 正向：谓词漏形参/未定义变量这类错误在 CI 就炸，不再等到某天某条件被求值才炸
- 负向：谓词现在会读 `ctx`，纯函数性下降一格（仍无副作用，只读文件存在性）

## ADR-013: 场景引用的条件/动作必须有静态闭包断言，禁止靠人工 grep 审计

### Context

同一类「悬空引用」缺陷在本仓库出现 5 次，每次形态不同但根因相同：**场景（数据）与
引擎（实现）之间只有约定、没有断言**。

    database_required   → 条件没人写 → 步骤永不执行
    setupConfigured     → 条件读错来源（ctx vs 探测结果）
    ctx.platform        → 字段名没人写（写的是 platforms/project_type）
    7 个文件类谓词       → 读的是 import 时冻结的 PROJECT_ROOT
    plan.json hooks     → 声明了 4 个动作，全引擎无人读（反向悬空）

人工审计抓不住这一类，因为它要求「把 25 个场景 × 60 个条件标识符 × 242 个动作
逐一对上 306 个 context 写入点」——而且我自己的 grep 就误判过两次
（`memoryRecall` 假阳性、`enh_*` 动态写入当悬空）。

### Decision

`src/lib/scene-contract.test.js` 常驻断言（CI 必过）：

1. 扫 `scenes/*.json` + `.claude/scenes/*.json`，收集 `condition`/`skip_if` 里的标识符、
   所有 `action` 值（跳过 `hooks` 子树 —— 引擎不执行它）
2. 收集提供者：`SIMPLE_CONDITIONS` 谓词 ∪ `context.X =` 赋值 ∪ 两处动态写入
   （`enhancements.js` 的 `enh_${key}`、`start.js` 的 `actionMap`）
3. 断言无悬空；并断言扫描规模（场景≥20、谓词≥50、条件≥20、动作≥100），
   防止测试自己空跑变成新一层假绿

### Consequences

- 正向：条件恒假/动作静默 pass 这两类在写场景时就失败，不依赖"谁记得去查"
- 正向：扫描规模下限断言让"规则被清空但仍绿"无法发生
- 负向：新增动态写入机制（如另一种 computed key 铺 flag）必须同步更新提供者集合，
  否则误报 —— 这是刻意代价：新增机制必须显式登记
- 教训（写进流程）：修一次 bug 后必须问「这是个体还是类别」，类别问题当轮就要
  落成断言，否则下一轮会在别处以另一个科目复现

## ADR-014: 每类缺陷配一份「闭合断言 + 活台账」，而不是逐个实例修

### Context

前三轮的缺陷分布呈现同一结构：**少数根因 × 大量实例**。

    「事实有两个来源」       →  恒假条件 × 9（含文件类谓词 7 个）
    「读的没人写 / 写的没人读」→  悬空条件/动作、plan.json hooks
    「默认通过」             →  空结果 pass、skip 记 pass、未知动作 pass、失败仍打绿 ✔
    「文档即承诺」           →  /spec、/setup 无入口，同步功能从未生效

逐实例修的边际收益低：每次修复只减少 1，且下一个实例在别处、以另一副面孔出现。
更糟的是"查"本身不可靠 —— 三轮里我的 grep/正则判断错了 5 次（memoryRecall、
SIMPLE_CONDITIONS 截断、5 个"悬空"全是动态写入、9 个"漂移"是已融入项、enhance-prompt 是 skill）。

### Decision

1. **类别优先**：修完一个 bug 先问「这是个体还是类别」；类别问题当轮必须落一份断言，
   断言文件就是该类缺陷的墓碑（`scene-contract` / `false-green-guard` / `docs-scene-alignment`）。
2. **断言必须能红**：新增断言要跑一次反向验证（注入一个违规 → 必须失败并点名），
   否则就是又一层假绿。已对 `scene-contract` 做过两次注入验证。
3. **默认值原则**：无法判断 → `warn`/`skip`，绝不 `pass`；处理器空返回 → `warn`。
4. **白名单必须活**：任何 allowlist/known-drift 都要配反向断言（条目失效即测试失败），
   否则白名单会成为新掩体。
5. **断言输入要覆盖全部真实形态**：本轮 9 个"漂移"误报，全部因为入口模型只认
   `.claude/commands/*.md`，漏了 skill、合并项、宿主内置。宁可不加断言，也不加会
   把正常报成缺陷的断言（会诱导人去改本来正确的东西）。

### Consequences

- 正向：同类问题复现率→0（新实例直接红在 CI，不依赖谁记得去查）
- 正向：审计从"grep + 人眼"变成"跑测试"，审计成本随断言数下降
- 负向：断言与实现耦合（新增动态写入机制/新入口形态需同步更新提供者集合），
  这被接受为刻意成本：新机制必须显式登记
- 观察指标（而非"bug 归零"这种做不到的目标）：同类复现次数、每类断言数、
  `check` 的 open problems、`KNOWN_DRIFT` 条目数（应单调下降到 0）

## ADR-015: 围栏（fence）= 冻结「现有通过集合」，不生成特征测试

### Context

「圈地修复」方案的核心主张是「先建围栏再施工」，文档给的实现是：每个要改的函数先写
characterization test 锁定现状。这在本仓库不成立：

- 663 个用例已存在，覆盖率不是问题；问题是**改完不知道有没有把原来通过的东西弄坏**
- 对无测试的遗留函数生成特征测试，成本可能高于修复本身，且生成物自身无人审
- 本项目已有一堆「假绿」教训，多一层自动生成物只是多一处可能说谎的地方

### Decision

1. 围栏 = `fenceCapture` 把**现有测试的逐条用例状态**拍成快照（`.claude/reports/fence-*.json`），
   `fenceVerify` 只做一件事：原先 `passed` 的用例不许变 `failed`、不许消失。
2. **只信逐条明细**。跑不起来 → `skip`，绝不 `pass`。JSON 解析成功就以计数为准，
   不再用文本 marker 猜（实测 `Cannot find module` 会出现在被测试断言的字符串里）。
3. 回滚基准优先 `git stash create`，空串则退到 `HEAD`；回滚只碰**已跟踪的改动文件**，
   先 `git cat-file -e` 验证存在，未跟踪文件不删。
4. 越界时的处置是「报红 + 可回滚」，不是自动继续修：无人值守循环里，越界意味着
   这一轮的修改方向错了，继续修只会放大。

### Consequences

- 正向：建围栏无额外测试成本（直接复用现有套件），任何「修 A 坏 B」都会当场点名
- 正向：围栏快照落到 `.claude/reports/`，可复查、可做指标（越界次数/回滚次数）
- 负向：每轮多跑一次全量测试（loop 场景从 1 次变 2 次）；大仓库需按 `--changed` 优化，
  但那会重新引入「跑没跑成」的判定问题，暂不做
- 边界：围栏只保护「已有测试覆盖到的行为」，未覆盖区域仍旧裸奔——这点必须写在文档里，
  不许让围栏给人一种全覆盖的安全感

## ADR-016: 图能力走「产物契约」，不造第二个图查询；缺失不阻断但必须露头

### Context

`codegraph_impact` / `codegraph_trace` 在引擎里是桩（`.claude/settings.json` 允许了
`mcp__codegraph__*`，但 `.mcp.json` 没有 codegraph，也没有 `codegraph` CLI）。
「修复前先看影响域」是真需求，但引擎自己查不了图。

### Decision

1. 引擎侧只做两件事：**消费产物**（`.claude/reports/impact-<stamp>.json`）+ **记账**。
   图查询由 agent 用 MCP 做完落盘，契约写在 `docs/architecture.md`。
2. 产物不合格（缺文件 / 坏 JSON / `changedFiles` 空 / 缺 `callers` / `riskLevel` 非法）
   一律 `warn`，**不加 `impact_reported` 条件**：加条件 = 没产物就静默跳过，
   警告看不见，等于把「未评估」洗成「无需评估」。
3. `riskLevel: high` 不阻断收 `warn`：阻断会让人绕过它，露头更有效。

### Consequences

- 正向：引擎不需要图数据库也能有「影响域」这一层，且缺失是可见的
- 正向：产物是磁盘文件，可复查、可做指标（缺产物率、高风险占比）
- 负向：产物质量取决于 agent；本 ADR 只保证「缺失/不合格不会伪装成通过」
- 边界：产物不新鲜（旧 stamp）时引擎无法判断是否对应当前改动——目前取最新一份，
  后续可加「mtime 晚于最近一次改动」校验
