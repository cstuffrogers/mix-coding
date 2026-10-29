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

**Status**: ACCEPTED（2026-07-01 修订：opencode 退役）
**Date**: 2026-06-15 (2026-10-24 更新: 新增 pi；2026-07-01 更新: 移除 opencode 全局配置)
**Decided By**: System Architect

### Context

项目需要在多个 AI 编码平台上运行，每个平台有不同的配置格式和命令机制。

### Decision

- `.claude/` 作为共享资源宿主（scenes/skills/rules/memory/plugins）
- 各平台通过环境变量 (CLAUDECODE/OPENCODE/CODEX/ZCODE/AI_AGENT) 自识别
- ~~opencode 采用全局配置 (`~/.config/opencode/opencode.json`) + 项目配置的 双层架构~~
  → **已撤销（2026-07-01）**：opencode 不再使用，生成器/部署脚本/校验器与 `.opencode/` 一并删除；`platform.js` 保留 `OPENCODE=1` 识别仅为了不在 opencode 里跑出不可预期行为
- 共享配置通过 `CLAUDE.md` → `AGENTS.md` 链引用
- pi 使用专属 `.pi/` 目录（官方 CONFIG_DIR_NAME） + 引擎 CLI；percho 是 pi 的桌面端 GUI，共用 `.pi/` 与引擎，不单独识别

### Consequences

- 正向: 一次配置，多平台可用（现为四个平台）
- ~~正向: `.claude/commands/*.md` 38 个工作流在 opencode 中 100% 对齐~~
  → 该对齐靠手写模板维持，多次漂移（指向已删命令、步骤数写错）；平台退役后随之删除
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

## ADR-017: 越界处置分两档（默认记账 / strict 中止），指标缺失不报零

### Context

±50 行 / 0 新依赖原本只有一种结局：该步骤判失败。但「判失败」之后工作流照样往下走，
等于在破了的地界上继续施工；而如果直接把默认改成整体中止，又会在正常的多文件重构里
频繁打断人（越界不等于错，可能只是改动大）。

### Decision

1. 两档，默认更松：
   - 默认「记账模式」：该步骤 `fail`，工作流继续，文案明确写出「加 --strict-enclosure 可整体中止」
   - `--strict-enclosure`：判 `shouldAbortOnEnclosure` 为真就整体中止（退出码 1），
     并提示 `git status` / `fenceRestore`
2. 判定抽成**纯函数** `shouldAbortOnEnclosure(context)`：这种「要不要当场停手」的判断
   不能藏在 `process.exit` 里，否则只能靠人肉跑一遍才知道对不对。
3. 指标汇总三态：没有台账 → `skip`（没数据不等于零越界）；越界率或影响域缺失率
   >50% → `warn`；否则 `pass`。比率的分母不存在时给 `null`，不给 0。
4. 台账用 append-only JSONL（`.claude/reports/enclosure-events.jsonl`）：追加不重写历史，
   一次读完就能统计；坏行跳过，记账失败不影响主流程。

### Consequences

- 正向：默认不打断人，想收紧时一条开关；越界与缺失率都进得了报表（P2 的 `enclosureMetrics`）
- 正向：strict 的实跑是可验证的（临时项目 fixture：44 行 > 阈值 20 → 中止、退出码 1、report 未执行）
- 负向：strict 模式下围栏回滚步骤也不会跑（中止发生在 verify 之前），需要人手工
  `fenceRestore`；这是刻意的——中止后应由人确认方向，而不是自动回滚掩盖问题
- 已知限制：引擎自产、落在仓库根的产物（如 `api-consistency-report.md`）会被算进边界，
  因为它不在 `.claude/` 下；后续需要一份「产物白名单」，本轮不动

## ADR-018: 「没跑成」必须由处理器自报状态；长输出折叠但失败不折

### Context

前 8 种假绿都在改「状态是怎么算出来的」，第 9 种出在**状态源头**：一批动作在 CLI 下
根本没执行（子代理、MCP 上传/扫描、UI 测试、安装/构建），处理器却 `return` 一段说明
文字。引擎只能按措辞猜（`不可用/未安装/跳过` 才判 noop），猜不到就记 `pass` —— 于是
「绿色 ✔ 已分析」背后一行分析都没有。同时，`pass` 步骤的长输出（自检报告、扫描明细）
会整段刷屏，人反而更看不见真正的失败。

### Decision

1. **没跑成的动作一律 `return { status: 'skip', message }`**，不用裸字符串，也不指望
   措辞匹配。涉及 `runAgent`、MobSF 上传/静态分析、Bearer 扫描、detox UI 测试、
   移动端安装/构建/源码扫描/依赖扫描。
2. **落成哨兵而不是靠人肉 review**：`src/lib/not-run-status.test.js` 扫所有处理器源码，
   禁止「裸字符串 return + 未执行/需在对话/本轮未/CLI 下未」组合，并要求扫描到
   >40 个处理器文件（防空跑）。正则必须用 `\breturn`（行首锚点会漏掉
   `if (!installed) return '...'`，这个假阴性是实测出来的）。
3. **中间输出折叠**：pass/warn 超过 6 行折叠成「前 6 行 + … 省略 N 行（完整输出：路径）」，
   完整内容落 `.claude/logs/steps-<scene>-<runid>.log`；`--no-fold` 全展开；
   **fail 永不折叠**。

### Consequences

- 正向：绿色 ✔ 重新等于「真的跑过且没发现问题」；折叠后屏幕能一屏看清哪步失败
- 正向：哨兵随代码演进自动生效，新增处理器写裸字符串会被 CI 拦住
- 负向：移动端/子代理场景在 CLI 下的 skip 数会变多（以前是 pass）——这是如实反映
- 负向：折叠会在 pass 步骤里隐藏细节，需要人知道去 `.claude/logs/` 翻；提示行已给出路径

---

## ADR-019: 文档自动同步的三条不变量 + 探测能力本身要能被探测

**Status**: ACCEPTED
**Date**: 2026-06-02
**Decided By**: System Architect

### Context

`sync-docs` 每次跑都报「3 个目标缺 AUTO-SYNC 标记、3 个目标文件不存在」。实际核查：

1. `.claude/scenes/README.md` 里标记**明明在**（第 9/37 行）—— 那文件是 CRLF，而实现拿
   `\n` 去匹配 `\r\n` 的内容，正则永远不命中。「同步不了」被报成「没标记」。
2. 三个「文件不存在」的目标全指向 `.claude/rules/workflows.md`，该文件早已删除，
   属于僵尸目标，每次同步都在报假警。
3. `CLAUDE.md` 的两个区块确实没有标记，但那两个区块是**人写的两列表格**（工作流速查），
   生成的表格格式不同，自动改写等于把人排的版推翻 —— 这不是缺陷，是**故意的**。
4. 更根本的问题：`sync-docs` 一行测试都没有。上面的假阴性存在了多久没人知道。
5. 顺着查还发现两个数据/文案缺陷：`new-project.json` 的 `description` 在「Huashu 验证，」
   处被截断（左括号未闭合），sync-docs 把那半句话抄进了 README 表格；
   `docs/tools-inventory.md` 正文改成 26 个场景，目录锚点仍是 `#25-个场景…`（链接静默失效）
   —— 因为计数刷新有「第一个数字已经对了就早退」的优化。

### Decision

1. **行尾归一化**：读入后 CRLF→LF 再匹配，写回时恢复原文件行尾。同步结果只反映内容差异，
   不因行尾风格不同而误判；也不把 CRLF 文件改写成混合行尾（避免整文件 diff）。
2. **人工托管桶（manual）**：区块没有 AUTO-SYNC 标记且属人工维护时归 `manual`（ℹ 提示），
   不再算 `missingMarker`（⚠）。一旦有人加上标记，自动接管。两类信息不许混成一个警告。
3. **计数刷新一律全量重算**：不再因「第一个 `N 个场景` 已经等于目标值」早退，
   否则同一文件里其它位置（目录锚点 `#N-个场景`）的旧数字永远修不了。
4. **场景 `description` 完整性断言**：括号必须配对、不得以 `，、→（+：` 结尾。
   半截话不会让任何测试变红，却会被同步进文档表格 —— 只能靠断言点名。
5. **僵尸目标直接删**：不存在的目标文件、永远为假的正则块一律移除，不留「下次也许会用到」。

### Consequences

- 正向：`sync-docs` 现在真的会同步 CRLF 文件；报表能区分「已同步 / 已最新 / 缺标记 / 缺文件 / 人工维护」
- 正向：`src/lib/sync-docs.test.js` 10 例覆盖行尾、写回、真缺标记、manual 桶、僵尸目标、计数与锚点
- 正向：`claude-scene/scripts/detector-sweep.cjs` 成为常规工具（12 个注入用例），
  「守卫测试是不是空跑」从此可以一条命令回答，而不是靠人肉推断
- 负向：`manual` 桶意味着 `CLAUDE.md` 的表格不再自动跟随场景变化，需人工维护（已明示）
- 负向：探测脚本会临时改写工作区文件（跑完必复原，失败也在 finally 里复原），
  不适合与其它会话并发执行

### 附：探测能力的自检（detector sweep）

`node scripts/detector-sweep.cjs` → 每个用例：注入真实违规 → 跑该守卫测试 → 期望红 →
内存备份复原 → 再跑 → 期望绿。注入点匹配不到会显式报「用例过期」而不是静默跳过。
当前 12/12 有效（含场景契约、假绿哨兵、文档三方对齐、未跑成哨兵、围栏零基线、
指标口径、strict 中止、描述截断、锚点漏改、CRLF 误报）。

---

## ADR-020: 暂不做 logger 全量迁移（393 处 / 54 文件留在 console）

**Status**: ACCEPTED
**Date**: 2026-06-02
**Decided By**: System Architect

### Context

审计时列出过三个候选收口方案：A 维持现状 / B 放开删 / C 新建 `src/lib/logger.js` 后分批替换。
实测规模：`src` 下 54 个非测试文件里有 **393 处** `console.log|warn|error`，
而 `src/lib/logger.js` **根本还不存在**（DECISIONS 旧条目只是把它列为待立项）。

### Decision

选 **A（维持现状）**，并写下触发条件：

1. 393 处远超「±50 行 / 0 新依赖」的改动边界，一次性替换风险与收益不成比例。
2. 这些输出**本身就是 CLI 契约**：`✔ ⚠ ⏭ ℹ`、折叠行、红字中止都由具体行决定。
   套一层 logger 等于把「哪行算 pass、哪行算 warn」的判据挪进间接层，回归风险高。
3. 现有测试靠 spy 捕获 `console.*` 断言输出（如 `fold-output.test.js`），
   引入中间层反而要多写一层转发测试。
4. 真要分级（`--quiet` / `--json`）时再立项：先建 logger + 一条「输出级别可断言」的测试，
   再按文件分批迁移，每批仍需满足 ±50 行边界。

### Consequences

- 正向：不动 393 处输出，零回归风险；本轮修的问题（假绿、围栏、同步）不被无关重构冲淡
- 负向：想加 `--quiet` 之类开关时仍需一次迁移债（已在触发条件里写明入口）
- 负向：`console` 直接调用让「静音测试」只能靠 spy（现状可接受）

---

## ADR-021: 探测器自检接进 /review 走「产物契约」，不在审查里跑变异测试

**Status**: ACCEPTED
**Date**: 2026-06-02
**Decided By**: System Architect

### Context

守卫测试（35 例）和探测器自检（12 例变异扫描）都建好了，但只在人记得跑的时候才跑。
「/review 能不能顺手验一下绿色可不可信」是自然需求。难点：探测器自检**必须临时改写
工作区文件**（注入违规 → 跑测试 → 复原），而 review 过程必须只读 —— 一边审查一边改文件，
等于审查对象在审查中变形，任何结论都不可信。

### Decision

沿用 ADR-016 的产物契约模式，两段式：

1. `scripts/detector-sweep.cjs` 跑完落盘 `.claude/reports/detector-sweep-<stamp>.json`，
   内容含 `gitSha / workingTreeDirty / total / passed / stale[] / failed[]`。
2. `/review` 新增步骤 **2.7 `detectorReport`**（`code_review` / `full_audit` 模式），
   只读产物并核对新鲜度，三态输出：
   - 缺产物 / 坏 JSON / 形状不对 → `skip`（「本轮未验」，绝不记 pass）
   - `failed` / `stale` 非空 → `warn` 并点名到具体用例
   - HEAD 不一致、或产物来自脏工作区 → `warn`（记录过期）
   - 其余 → `pass`（`12/12 有效（<sha>）`）

**不新增** `detector_verified` 条件去门控后续步骤 —— 那会把「未验」洗成「无需验」
（与 ADR-016 同一理由）。

### Consequences

- 正向：review 报告里能看出「这轮绿色是不是可信的」，且审查过程保持只读
- 正向：产物带 HEAD 与脏标记，过期记录会被点名，而不是被当作最新结论
- 负向：想拿 `pass` 必须在干净工作区跑一次 sweep（多一步人工/CI 动作）
- 负向：`skip` 在 review 里会长期存在（CI 目前不跑 sweep）——这是如实反映，不是噪音

### ADR-021 补记：为什么是「交互询问」而不是「默认就跑」

`review` 是只读审查，跑 sweep 要临时改工作区（几秒到一分钟）。把它做成默认动作会让
每次审查都多 1~2 分钟、且和中途失败的复原逻辑耦合。所以：

- 交互模式：step **2.68** 问一句，用户当场决定（默认「否」）
- `--auto`：问不了，默认**不跑**（`auto_default: false`）；要跑就显式 `-S`
- `-S / --with-sweep`：强制跑，不看交互结果

`setContextFlag` 为此新增 `params.auto_default`（默认 `true`，其它场景语义不变），
所以「auto 下默认不跑」必须显式写在场景 JSON 里，不能靠猜。

## ADR-022: 场景真值只有一个来源（层合并 + 覆盖层优先），校验器必须复用同一解析器

**Status**: ACCEPTED
**Date**: 2026-07-01
**Decided By**: System Architect

### Context

仓库里有两份同名场景 JSON：`.claude/scenes/*.json`（项目覆盖层）与
`claude-scene/scenes/*.json`（随包内置），26 个文件逐字节相同。引擎按
`claude-scene/src/lib/paths.js` 的 `getSceneDirs()` / `listSceneIds()` 取「两层合并、
覆盖层优先」，所以真正会跑的是覆盖层那份。但校验脚本分成两派：

- `check-readme-stats` / `check-action-stats` / `check-doc-counts` / `check-tool-steps` → 读内置
- `check-dead-actions` / `find-deadcode-full` / `scan-scenes` → 读覆盖层

实测：往 `.claude/scenes/review.json` 里加一步（运行时立刻变成 44 步），
`check-readme-stats` 仍打印「583 步…全部对得上」——它核的是永远不会被执行的副本。
数字对得上，但它对的不是跑起来的东西。

### Decision

1. 新增 `scripts/lib/scene-dir.cjs`：`sceneTiers()`（层顺序与引擎一致）+ `resolveScenes()`
   （合并视图，同名只取高优先级那份）。所有读场景的脚本必须用它，不许自己拼目录名。
2. **合并**而不是「只读覆盖层」：真实项目的 `.claude/scenes` 只放要覆盖的那几个场景，
   只读覆盖层会把真值缩成「覆盖了几个场景」，校验器会误报「扫描面塌了」。
3. `scripts/scenes-stats.json` 由 `scan-scenes.cjs` 按同一视图生成，并接进 pre-commit
   第四道门禁：重跑后与工作区不一致就拦住提交（陈旧产物不许落地）。
4. 本仓库两份副本必须逐字节相同（`scene-dir.test.js` 守卫）——这是「覆盖层是完整副本」
   这一现状的断言；将来若真要分叉，应当删掉副本或显式豁免，而不是把测试放宽。

### Consequences

- 正向：文档数字与运行时行为锁在一起，覆盖层被改而文档没改会立刻红
- 正向：`scene-dir.test.js` 13 例覆盖「只有一层 / 两层 / 显式覆盖 / 两层都空」四态
- 负向：`MIX_CODING_SCENES_DIR` 成了脚本也认的开关（测试要用），多一个环境变量入口
- 负向：两份副本的同步仍需手工（守卫只负责发现不同步，不负责合并）
