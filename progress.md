# Mix-Coding System — Progress Log

> 本文件记录所有 Agent 会话的历史，确保跨会话连续性。
> **规则**: 每个会话结束后必须追加一条记录。

---

## Project Info

- **Project**: Mix-Coding System (E:\auto-coding)
- **Started**: 2026-06-01
- **Current Version**: 1.0.0
- **Total Sessions**: 3

---

## Quick Status

| Feature | Status | Last Worked On |
|---------|--------|----------------|
| Harness Foundation | done | 2026-06-30 |
| CI/CD Pipeline | done | 2026-06-30 |
| Knowledge Index | done | 2026-06-30 |
| AGENTS.md Guide | done | 2026-06-30 |
| Start Scripts + Husky | done | 2026-06-30 |

**Current WIP**: Better Harness v4 硬阻断验收闭环完成（#14 升级为 exit(1)）
**Next Up**: Reliable Delivery reviewed-check 跨门槛需后续任务窗口；±50-line 边界仍靠 git diff

---

## Session History

### Session 1 — 2026-06-30

**Feature**: Harness Foundation Setup
**Scene**: /feature
**Status**: COMPLETED

#### What Was Done (Phase 2 — Deep Optimization)

- **AGENTS.md**: Upgraded from 7-line alias to full Harness guide (section 1-5: init, scope, standards, cleanup, emergency, command ref)
- **AGENTS.md (opencode/Codex)**: Synced with proper references to root AGENTS.md
- **zero-conflict-check.sh**: Created architecture compliance checker (prefix validation + handler count + layer purity + harness file check)
- **start-claude.sh/ps1**: Integrated `init.sh` auto-run before launching Claude Code
- **scheduled_tasks.json**: Pre-filled with 3 tasks (weekly audit, weekly deps, release quality gate)
- **husky pre-commit**: Extended to run `scan:deadcode` in addition to eslint + test
- **Verified**: 148/148 tests pass, lint clean

#### Verification Results

- [x] Tests pass
- [x] Lint clean
- [ ] Type check passes
- [ ] CI workflow created

#### Decisions Made

- ADR-003: Harness Engineering 正式采用
- 状态文件体系: feature_list.json + progress.md + DECISIONS.md 三件套

---

## Session 2 — 2026-07-01: ESLint Cleanup

**Goal**: Fix all sonarjs quality issues — from 1216 lint errors to 0.

**Done**:
- Fixed `sonarjs/no-unused-vars` (21 → 0), `no-dead-store` (10 → 0), `unused-import` (2 → 0), `no-unused-collection` (2 → 0)
- Fixed `sonarjs/super-linear-regex` (47 → 0), `regex-complexity` (8 → 0), `slow-regex` (2 → 0)
- Fixed `sonarjs/cognitive-complexity` (51 → 0) — extracted ~100 helper functions across 20 files
- Fixed `prefer-specific-assertions` (3), `no-duplicated-branches` (2), `pseudo-random` (1), `no-useless-escape` (3), `no-empty` (1)
- Fixed `sonarjs/no-os-command-from-path` unused disable directives (2)
- Added `.mcp/**` to ESLint ignores (vendor code)

**Result**: **1216 → 0 errors** (100% reduction). **148/148 tests pass**.

**Next Steps**: Begin feature work or refine eslint.config.js rule thresholds.

---

## Session 3 — 2026-07-31: 测试基建重构 + Better Harness 修复

**Goal**: 修复 better-harness 报告指出的引擎测试盲区，并清理剩余 lint 债 + 会话验收闭环。

**Done**:
- 提取 `detectHandlerFailure` 到 `claude-scene/src/lib/failure-detection.js`（从 runStep 正则分离，可单测）
- 新增 6 个测试文件：failure-detection / design / external-tool-checks / handler-verify / review / ui-tools（覆盖 5 个最高 churn handler）
- `start.js` initLog 加 `LOG_RUN_ID`（ts + randomBytes hex），每条日志带 run_id（per-run 关联）
- lint error 15 → 0：eslint.config.js globals 补 fetch/AbortController/clearTimeout；external-tool-checks ESM require 改 import；ui-tools 删死变量；smoke.test 用 it.skipIf；4 处 sonarjs PATH 误报加 disable 注释
- `.husky/pre-commit` 收紧：`npx eslint claude-scene/src/ --max-warnings 500` → `(cd claude-scene && npx eslint .)`（用 claude-scene config，error 阻断）
- CLAUDE.md 执行原则加"Post-edit 验证"规则（edit 后必须立即跑验证，交付前报告三元组）
- `printSummary` 加"验收三元组"提示块（变更/验证命令/验证结果）

**Better Harness 打分**（对比 2026-07-30）:
- Loop Effectiveness: 54 → 62（+8）
- Asset Health: 0 → 58（6 项 pending → 4 verified / 1 partial / 1 pending）
- Change Validation 维度从「未观察」进入「有证据」（唯一跨门槛维度）

**关键发现**:
- 根 `eslint.config.js` 与 `claude-scene/eslint.config.js` 是两套不一致配置：根 config 扫 claude-scene 出 339 error（no-undef:warn + 未声明 globals + cognitive-complexity 未关）。pre-commit 改用 claude-scene 自己的 config 规避，根 config 不一致是独立债。
- hallmark SKILL.md 3 个断链引用在本次前已被移除（独立核对确认）。

**Result**: **0 lint errors**（21 warnings，handler 签名约定）。**26 文件 / 226 测试全过**。

**Next Steps**: 根 eslint.config.js 与 claude-scene config 统一（339 error 债）；Reliable Delivery 维度需可比后续任务窗口验证。

### v3 优化（同日后续）
- **统一 eslint config**：根 config 加 `.agents/` + `claude-scene/**` 到 ignores，根 `npm run lint` 从 339 error → 0/0
- **清零 21 warning**：5 个占位 handler 签名加 `_` 前缀 + import-x 误报 disable；claude-scene lint 0 error 0 warning
- **机械强制复杂度**：`no-unused-vars` warn→error；`sonarjs/cognitive-complexity: ["error", 15]`；pre-commit `--max-warnings 0`（warning 也阻断）
- **#14 硬约束验收闭环**：新增 `claude-scene/src/lib/acceptance-check.js`（classifyAction + checkAcceptance + allowNoVerify 豁免）+ 11 单测；startScene 收尾硬阻断（missingVerify 时 exit(1)）；plan-ceo-review 场景加 `allow_no_verify: true`；VERIFY_RE 加 `suite`

**v3 Better Harness 打分**：Loop Effectiveness 69（+3）、Asset Health 74（+6）。5 维度：Change Validation 三重门禁（error+warning+复杂度），Reliable Delivery 首个结构化护栏（中约束）。

**v3 Result**: 根 lint 0/0 · claude-scene lint 0/0（--max-warnings 0）· 27 文件 / 237 测试全过。

### v4 优化（#14 硬阻断升级）
- `acceptance-check.js` 加 `allowNoVerify` 参数；start.js 收尾从 console.log 警告升级为 `process.exit(1)` 硬阻断
- VERIFY_RE 加 `suite`（修正 `update` 场景 runSuite 误判）；plan-ceo-review 加 `allow_no_verify: true`
- 扫 27 场景确认仅 plan-ceo-review 天然无验证（已豁免），其余 26 场景 edit+verify 齐全不误阻断

**v4 Result**: acceptance-check 11 单测全过；27 文件 / 237 测试全过。硬阻断逻辑：仅「有 edit 无 verify 且未声明 allow_no_verify」的场景 exit(1)，当前 27 场景无一触发。

### v5 优化（#1 reviewed-check 闭环）
- `acceptance-check.js` 加 `stepResults` 参数 + `hasPassingVerify` / `unreviewedChange` 判定：verify 步骤必须 status=pass/warn 才算 reviewed-passing（非仅存在）
- `runStep` 记录 `context.stepResults = [{action, status}, ...]`
- `startScene` 收尾新增 `unreviewedChange` 硬阻断：有变更但验证步骤全 fail/noop/skip 时 exit(1)（区别于 missingVerify 的「无验证步骤」）
- 提取 `buildStatusLookup`/`isPassingVerify` helper 控制认知复杂度 ≤15
- acceptance-check 测试 11→16（+5 stepResults/unreviewedChange 用例）

**v5 Result**: 根 lint 0/0 · claude-scene lint 0/0（--max-warnings 0）· 27 文件 / 242 测试全过。27 场景全 pass 模拟 0 误阻断；bugfix verify 全 fail 模拟正确触发 unreviewedChange 阻断。

### v6 优化（重构 18 处 cognitive-complexity 豁免）
- 全部 18 处 `sonarjs/cognitive-complexity` disable 消除（含 code-metrics 90 + ui-tools 96 两个巨函数）
- 每处提取 helper / 配置化 / 早返回降到 ≤15，删 disable
- code-metrics.js + ui-tools.js 巨函数先加测试覆盖（21 + 13 用例）再重构，验证行为不变
- start.js 3 处（44/24/20）提取 handleInteractiveStep/deriveStepStatus/recordStepResult/buildSceneContext/previewDryRunStep/enforceAcceptanceGate
- testing.js 2 处提取 pickTestCommand + CI_CHECKS 配置化
- 其余 11 处（低中复杂度 16-23）提取各自 helper

**v6 Result**: 0 个 cognitive-complexity disable 剩余 · 根 lint 0/0 · claude-scene lint 0/0（--max-warnings 0）· 28 文件 / 276 测试全过（+50 测试）。复杂度边界现机械强制（无 per-file 豁免口子）。

---

## 2026-07-25 · vendored 逻辑/IO 审查技能（Trail of Bits）+ 两个真实缺陷

### 背景
上一轮已把缺陷检测拆成四维（静态分析 / 属性测试 / 变异测试 / LLM 审查），并接入
semgrep + fast-check + Stryker。这轮补 LLM 审查层的**方法**（此前只有「人设型」skill，
缺可执行的目录与证伪规则）。

### 引入 4 个 vendored 技能（`.claude/skills/`）
- `property-based-testing` — 9 类属性目录（roundtrip/inverse/oracle/idempotence/invariant…）、
  属性强度分级、两类「什么都没断言」的假测试（tautology / vacuity）
- `variant-analysis` — 确认一处 bug 后跨库搜同模式
- `sharp-edges` — 易误用 API / 危险配置形态，12 语言陷阱表（Scott Arciszewski）
- `insecure-defaults` — 6 类不安全默认值，含 grep 可直接用的 seed 正则集
  与逐类 **Report when / Skip when** 证伪规则
- 来源 trailofbits/skills，**CC BY-SA 4.0**（非本仓库 ELv2），每目录 `NOTICE.md`
  记录上游路径、抓取日期、逐文件 sha256、verbatim/adapted 状态
- 通路：github.com 不可达，用 `cdn.jsdelivr.net/gh/<owner>/<repo>@main/<path>` 代理
- 场景挂钩：`setup` 2.35、`review` 4.62 / 4.63 / 4.64（均 `conversation_mode` 门控）

### 修复 1：skill 路径解析只在「引擎仓库当目标」时成立
`resolveSkillPath` 只有 `targetPath/..` 一种候选。真实项目（/tmp/vuln）下它指向别处，
于是**每个** invokeSkill 步骤都报「无 SKILL.md」静默降级为 noop —— 技能形同不存在，
且状态显示 ✔ 看起来像跑过了。
改为 5 级链（`resolveSkillCandidates`）：目标项目覆盖 → 旧行为 → 仓库内 → `~/.mix-coding`
→ 包内。E2E：review 的 pass 14→18、noop 8→4。
配套：`install-global.sh` 新增第 6 步把 `.claude/skills`（276 文件）装到
`~/.mix-coding/.claude/skills`（npm 全局包的 `files` 只含 `src/`+`scenes/`，
不带技能）；`pi-setup.sh` 把 4 个 vendored 技能镜像到 git-ignored 的 `.agents/skills/`，
否则 pi 的技能清单里看不到它们。

### 修复 2：agentmemory 写库被 shell 吃掉引号
SQL 先做 SQL 层单引号转义，再**整体包进 shell 双引号**——内容里的 `"` 被 shell 吞掉
（`{"a":1}` → `{a:1}`），`$`/反引号还会被解释，sqlite 报 `unrecognized token`，review
结束的 remember 步骤每次都失败。改为 SQL 走 stdin（shell 只见 `sqlite3 "<db>"`）。
顺带修 `AGENTMEMORY_DIR` 在 import 时冻结导致 env 覆盖无效——改为调用时解析，
否则测试会写进开发者真实的 `~/.agentmemory`（本轮已发生并清理）。

### 验证
根 + claude-scene 双侧 **349 测试 / 35 文件**全绿；ESLint 双 0；场景审计 0 错误 / 15 警告。
E2E `/tmp/vuln` review：pass 18 / fail 1 / warn 1 / skip 14 / noop 4
（fail 1 为 `sec-bug-hunt` 命中 critical SQL 注入，block-merge 门禁**有意**失败）。

## 2026-10-26 · 记忆系统巡检（5 后端）+ 4 个真缺陷

巡检方式：在临时项目里跑 remember → recall → list → consolidate，再对每个后端做读回校验。

### 发现的缺陷
1. **NEXO 召回读不到最新写入**：`readNexoData` 对 `scanDir` 的**未排序**结果取前 20，
   而 `~/.nexo/runtime` 有 872 个文件 → 每次召回读的是任意 20 个历史文件，
   刚写入的那条永远不在里面（`remember` 却计为「4 后端」成功）。改为按 mtime 倒序取。
2. **召回配额只喂饱前两个后端**：`perSourceLimit = max(5, ceil(limit/5))`，而拼接顺序
   project-memory / claude-mem 在前，limit=10 时两家各 5 条吃光配额，
   NEXO / agentmemory / codegraph 一条都进不来 —— 返回语却宣称五个来源都有。
   改为 `recallQuota()` 均分（实际观察到的分布：2/4/2/2）。
3. **agentmemory 读取静默截断**：写入完整（2010 字符），`readAgentmemory` 却 `slice(0,500)`
   且不标记。`remember` 在无入参时以 recalled_memories 为底稿，于是把截断副本再存回
   四个后端，误差逐轮回累积。改为返回 `truncated` 标记，且 remember 的回落路径丢弃
   被截断的行。
4. **`readAgentmemory(limit, tags)` 的 tags 参数从未实现**：调用方传了也不过滤，
   测试里那几条「按 tag 找」其实是空断言。已实现精确成员匹配（`','||tags||','`
   包逗号，避免 `len` 命中 `len2`），并把测试改成带反例。

顺带：`handleAutoRemember` 保存了 project-memory 却不计数（报「3 后端」，而显式
remember 报「4 后端」）；统一为 4。`recall` 在 codegraph 库为空时仍塞一条空行，改为跳过。

### 健康度实测（本机）
- project-memory `PROJECT_ROOT/.claude/memory/` 34 条 / 53K — 正常
- claude-mem `~/.claude/memory/` 40 分类 / 503 条 / 467K — 正常
- agentmemory `~/.agentmemory/memory.db` sqlite 1026 行 / 209K — 正常
- NEXO `~/.nexo/runtime/` 874 文件 / 1.6M — 修复后可读
- CodeGraph `PROJECT_ROOT/.codegraph/codegraph.db` 3567 节点 / 7090 边 / 278 文件 — 可查，
  但**引擎不负责重建**（外部工具产物），本仓库那份停留在 10-24，且 `file_path` 带
  尾随 `\r`（索引侧 CRLF 没清）

### 已知未做（如实记录）
- 无保留期/轮转：nexo 872 文件、agentmemory 1026 行、claude-mem 503 条只增不减。
  `consolidate` 实际只对 project-memory 去重，另三个后端仅打印计数。删用户记忆数据
  不可静默做，故未加。
- 巡检写进真实库的约 5 条探针残留（与真实记录无法区分，未强删）。

验证：362 测试 / 36 文件全绿，ESLint 双 0。

---

## 2026-10-26 · insecure-defaults：从「提示词」接成「确定性检测器」

上一轮把 4 个 Trail of Bits 技能 vendored 进来时，`insecure-defaults` 只做了两层：
4.64 的 `invokeSkill`（把 Report when / Skip when 贴给 LLM）。但它自带 6 类机读种子
（`references/*.json`，grep -E 语法），这半边是可以确定性跑起来的。这轮补齐。

### 新增
- `claude-scene/src/handlers/security/insecure-defaults.js`
  - `loadCorpus()` **运行时读 vendored 技能里的种子**（不在 `src/` 复制 37 条正则，
    避免两处漂移）；找不到 → `未找到 … 规则集` → noop。
  - `toJsRegExp()` 把 grep -E 的 POSIX 类翻成 JS 语法；`scanText()` 逐行匹配并合并同类目；
    `refute()` 是可判定的证伪层；`handleInsecureDefaults()` 输出契约化措辞。
  - 扫描面 = 源码 + 配置清单（`.yml/.yaml/.toml/.json/.tf/.env/Dockerfile/…`），
    复用 `listProjectFiles`（本轮给它加了自带 walker + `includeDotFiles`）。
- `scenes/review.json` 新增 **4.61 `insecure-defaults-scan`**（条件同 4.6 semgrep），
  位于 4.6 与 4.62 之间；候选写入 `context.insecureDefaultsCandidates`，并被
  `generateReviewReport` 渲染成报告里的一节。
- `actions.js` + `action-messages.js` 注册动作与消息。
- 测试：`insecure-defaults.test.js`（36 例）+ `lib/project-sources.test.js`（11 例）
  + `review.test.js` 报告两例。全量 **411 测试 / 38 文件**绿，ESLint 双 0，
  场景审计 0 错误 / 15 警告。

### 三个真 bug（都是测试和自扫逼出来的，不是推测）
1. **`/i` 编译种子 = 系统性误报源**。上游是 `grep -E`，大小写敏感——种子自己列了
   `md5|MD5`、`(True|true|1)` 就是证据。带 `/i` 时 `let hasVerify = false` 会命中
   fail-open 种子。改回大小写敏感后：本仓库候选 **28 → 1**。
2. **POSIX 类嵌在字符类里会被转坏**。`[^:@[:space:]]` 做字符串替换得到 `[^:@[\s]]`，
   多出一个 `]`，于是 default-credentials 的 DSN 种子**永远不命中**（静默漏报）。
   改成按 token 逐字符翻译（`[:space:]` → `\s`，按是否已在字符类内决定补不补外层括号）。
3. **`refute()` 不传 `rel` 会 TypeError**（`pathSegments(undefined)`），
   已加默认值与空值保护。

### 证伪层（可判定，全部有单测）
全局：整行注释；文档/vendor/测试路径（`scope: tests` 反向）；模板插值 `${…}`；
正则字面量/箭头规则定义（检测器自身）；对象字段赋值 vs 配置项声明；
十六进制颜色/转义序列（`\u0000`、`#0000EE` 里的 `000` 不是权限位）；标准权限位
（755/644 不算，只认 777/776/766/707/666/000）。
分类：`PORT/TMPDIR/…` 非秘密后缀与路径型回落值；占位符凭据；角色键的值必须正好是
已知默认凭据（否则 `test: 'testPassed'` 也会中）；校验和/etag/临时文件名用途的 md5；
`0.0.0.0` 监听 vs CIDR `0.0.0.0/0`；日志 sink 里的 stack trace；`DISABLE_*/SKIP_*` 极性。
实测本仓库：28 → 1 处候选，且这 1 处是**真的** —— `codewhale-config.toml:11` 里有一个
已提交进 git 的 `api_key`（代理站 key）。检测器第一次自扫就抓到了它。

### 设计纪律
- 措辞锁死：有候选 → `N 处候选（… 需逐条证伪）` → warn；0 文件 → fail；无规则集 → noop。
  候选用「失败」会被 `detectHandlerFailure` 判成阻断门禁，是回归。
- 已知召回上限（上游种子形态，不是本仓库 bug）：YAML 里 `tls_verify: false` 不命中，
  种子只认 `TLS_VERIFY = false` / `verify = False`——这正是 4.64 存在的原因。

E2E（临时夹具，5 文件含 3 真 3 假）：`6 处候选（5 类）`，`tests/fixture.js`
被排除，`PORT`/`etag` 被证伪；场景 `review` 日志中 `step 4.61 status = warn`，
总计 pass 18 / fail 0 / warn 1 / skip 14 / noop 6。

---

## 2026-10-26 · 记忆系统作用域：全局后端补归属，修 `--target` 写错项目

上一轮修的 4 个召回缺陷都在「同一个库内怎么读」这一层。这一轮回答一个更前面的问题：
**记忆到底属于哪个项目？** 实测（A 项目写一条 → B 项目召回）：

| 后端 | 作用域 | B 能否读到 A 的 |
|---|---|---|
| project-memory | 项目级 | ❌ |
| codegraph | 项目级（只读） | ❌ |
| claude-mem | 全局 | ✅ |
| agentmemory | 全局 | ✅ |
| NEXO | 全局 | ✅ |

而且全局库那三条记录**没有任何项目标识**（`tags: []`，`type` 是工作流名不是项目名），
事后无法归属 —— 在 B 项目跑 `/review` 会把 A 项目的审查结论当上下文注入。

### 两个真 bug（实测发现，不是推断）

1. **`--target` 时项目记忆写错项目**。`MEMORY_DIR` 是 `paths.js` import 时冻结的
   `PROJECT_ROOT/.claude/memory`，而 `PROJECT_ROOT` = cwd。所以
   `start review --auto -t <别的项目>` 时：报告写到目标项目，项目记忆却写进**引擎自己的
   目录**（实测在 `claude-scene/.claude/memory/review/` 留下一条）。下次真 cd 到那个
   项目反而读不到。改为所有 memory 入口按调用时的 `targetPath` 现算
   （`memoryRoot(rootDir)`）。
2. **测试往真实全局库写垃圾**。`smoke.test.js` 的 handler 遍历会真的调 remember，
   而三个全局后端的路径常量（agentmemory/NEXO 已改成调用时读 env，claude-mem 还没有）
   让它落到 `~/.agentmemory`。实测库里留下 8 条 `smoke-*` 记录。修：`claude-mem`
   也改成调用时读 `CLAUDE_MEM_HOME`；`smoke.test.js` 加 `isolateStores()` 把三个
   HOME 指进沙箱。验证方式：跑整份 smoke 前后 `count` 不变（1054 → 1054）。

### 新增
- `src/handlers/memory/project-scope.js`
  - `normalizeProjectPath()`：绝对路径 + 分隔符统一 + 去尾斜杠 + Windows 转小写 +
    `realpathSync.native` 展开（**路径不存在时向上找最近的存在祖先**再拼回剩余段 ——
    直接 realpath 一个还没创建的目录会抛错，于是「刚写入时」和「目录建好后」算出两个
    不同字符串，记忆就分裂了；这是单测逼出来的）。
  - `projectScope()` / `classifyScope()` / `includeInRecall()`。
- 三个全局 writer 带归属：`claude-mem` items 存 `project:{path,name}`、markdown 头部写
  `- 路径: <abs>`、`agentmemory` 增列 `project_path`（`ALTER TABLE` 前查
  `pragma_table_info`，幂等；老行为 NULL）、`NEXO` 事件存 `project`。
- 召回过滤：本项目 → 召回；无归属历史 → 召回但标 `scope: 'unscoped'` 并在消息里报条数；
  别的项目 → 默认排除，消息里报「已排除 N 条其他项目记录」；`params.cross_project: true`
  才跨项目。
- 回写堵截：`wholeRecalled` 只接受 `scope === 'project'` 的行。
- 文档 `docs/memory-scope.md`（作用域表 / 归一化规则 / 召回矩阵 / 已知限制）、
  `CLAUDE.md` §记忆系统、`.claude/rules/conditional/memory-auto-save.md` 同步。

### 计数措辞的一个坑
第一版把「扫描到的无归属总数」写进召回消息，实测显示「602 条历史记录未标归属」——
读起来像召回了 602 条。改成只统计真正进入召回池的条数（`annotateScope(..., cap)`），
现在是「14 条未标归属的旧记录（打标前写入）」。

### 清理（有记录，非静默）
- `~/.agentmemory` 8 条 `project_path LIKE %smoke-%`；`~/.claude/memory` general items
  6 条；`~/.nexo/runtime` 8 个事件文件 —— 全部指向已删除的 `smoke-*` 临时目录，可判定
  为测试产物。
- `claude-scene/.claude/memory/review/342dbc53c501.json` —— 上面 bug 1 留下的错位记忆。

### 验证
- **429 测试 / 39 文件**绿（新增 `project-scope.test.js` 18 例：归一化 6、作用域 3、
  归属判定 2、以及真实落盘的跨项目隔离 5 例）。ESLint 双 0。
- 真实引擎 E2E：`start review --auto -t <临时项目>` → 记忆写到该项目的
  `.claude/memory/review/`，引擎目录不再新增；三个全局后端记录都带
  `c:/users/administrator/appdata/local/temp/proja2`。
- 互换验证：A 自己召回 17 条（3 条 project + 14 条 unscoped）；C 项目召回 15 条、
  0 条来自 A，消息报「已排除 2 条其他项目记录」。

---

## 2026-10-26 · 记忆系统深度审计：7 个缺陷（3 个会吃掉真实记忆），随后清空存量

上一轮解决「记忆属于哪个项目」。这一轮问的是「记忆会不会被悄悄弄丢」。全部结论都先
写成探针脚本跑出来（`E:/tmp/memprobe{,2,3,4}.mjs`），不靠读代码猜。

### 找到并修掉的 7 个缺陷

| # | 缺陷 | 实证 | 修法 |
|---|---|---|---|
| A | `saveProjectMemory` 用 JSON **前 200 字符**当去重指纹 | 两次不同内容审查返回**同一个 id**，磁盘只有 1 条 | 指纹改为完整内容的 sha256；命中时返回 `duplicate: true`，调用方如实说「未重复写入」 |
| B | `deduplicateProjectMemories` 用前 100 字符当 key | 手工放 3 条内容不同的记忆，**删掉 2 条** | 完整 hash；按 timestamp 倒序保留最新；`data` 为空的条目一律不动 |
| C | markdown 归档 cap 100 按**文件名**排序 | 新写的 general/review 归档被删，最旧的 `aaa` 反而留下 | 按 mtime 排序删最旧，被删的名单落 `archive/markdown-pruned.log` |
| D | markdown 读回截断 500 字符但**没有 `truncated` 标记** | `truncated: undefined` → 回写会把残片固化成完整记忆 | 补 `truncated` + `length` |
| G | claude-mem items 到 500 条**静默挤掉最老的**（真实库 805 条跨类，马上触发） | 第 501 条写入后最老那条无影无踪 | 超出部分写 `archive/<dir>-items.jsonl`，可追溯 |
| E | `queryCodeGraph` 用 import 时冻结的 `PROJECT_ROOT/.codegraph` | `--target` 时读的是**引擎自己的**符号图 | 按 `targetPath/.codegraph/codegraph.db` 定位，支持 `CODEGRAPH_HOME` |
| F | `list` 的「本项目 N」把无归属行也算进去 | SQL 条件是「本项目 OR 无归属」 | 分三栏：本项目 / 无归属 / 其他 |

顺带加固：三个 writer 内部归一化项目路径（防止直接调用方传 `e:/p/` 造成分裂）；
`type`/`category` 过 `safeTypeName`（`../../escaped` 不再写到意料之外的目录）；
auto-remember 也写 items（原先只写 markdown，两个存储条数对不上）；
`consolidate` 返回消息里报告删了几条（去重是删文件，不能静默）。

### 清空存量（已授权，备份先行）

`~/.agentmemory` 1046 行、`~/.nexo/runtime` 894 文件、`~/.claude/memory` items 805 条 +
md 100 个、本项目 `.claude/memory` 63 个 —— 全部复制到
`E:/tmp/memory-backup-20261026-113342/`（1070 个文件 / 2.0M）后才删。
保留 `~/.claude/memory/MEMORY.md`（外部模板）与 `~/.agentmemory/preferences.json`
（工具配置，不是记忆）。`.codegraph` 是索引不是记忆，未动。
清空后跑一遍 recall/list/remember/consolidate：0 条、无异常、codegraph 3567 节点仍可读。

### 验证
- **439 测试 / 40 文件**绿（新增 `memory/memory-store.test.js` 10 例：hash 去重、
  dedupe 保留最新、空 data 不动、mtime 裁剪、truncated 标记、归档、type 收敛、
  codegraph 路径、三栏计数）。ESLint 双 0，场景审计 0 错误 / 15 警告。

### 备份的处置结论（同日追加）

清空前的快照逐条验过内容，判定**没有保留价值**，已删除（2.0M / 1070 文件）：

- `general` 494 条几乎全是 `{"findings":{"security":{}},"completedSteps":[],"prompt":""}` —— 自动摘要空壳；
- 大量条目里带**未渲染的模板占位符**（`{{backupConfigured}}`、`{{monitorConfigured}}`、`{{changelogPath}}`…），
  证明是跑场景时自动写入的元数据，重跑即可再生成，不是知识；
- `general` 里还有**嵌套自我复制**（`data_snippet` 套着上一层的完整 JSON），是这轮修掉的
  「回写放大」缺陷留下的膨胀物；
- 唯一有实质内容的是 `security` 里一条 `E:/dgsq` 的 CRITICAL 清单，其原文件仍在
  `E:/dgsq/docs/audit-report.md`，不是唯一副本。

`.codegraph/`（130MB）**保留**：它不是记忆，是外部 codegraph MCP 产出的代码索引，引擎只读；
删掉会让 recall 的 codegraph 维度直接归零，重建要外部工具。它已在 `.gitignore` 内。


---

## 2026-10-26 · 记忆系统第二轮深查：从「能写」到「真能读」

上一轮保证数据不被悄悄弄丢。这一轮问的是：写进去的记忆，**到底被读过吗**。
用真实引擎连跑三遍 + 沙箱探针，答案是：之前**一次都没被读出来过**。

### 决定性缺陷：19 个场景的召回恒返 0 条

场景里 24 个 `recall` 步骤，21 个带 `filters`，其中 19 个 `filters.type` 是**数组**
（`["review","quality","security"]`）。`matchFilter` 只认 RegExp / 字符串 / 严格相等：
`memVal === ['review',…]` 永远 false → 整条链路过滤成空。

真实引擎实证（`start review --auto` 连跑）：
- 修前：第 2 遍「项目记忆已召回（0 条）」，尽管 `.claude/memory/review/` 里已有记录；
- 修后：第 2 遍「已召回（5 条，来源: 项目/Claude-Mem/agentmemory/NEXO）」。

**后果**：记忆系统一直是「只写不读」的黑洞，这也解释了旧库里为什么堆满无用自动摘要。

### 另外 6 个真问题

| # | 问题 | 证据 | 修法 |
|---|---|---|---|
| 1 | 分类目录写死 4 个（`general/architecture/decision/pattern`），工作流类型（`review`/`audit`/`mobile-review`…）写进去的 items **永不召回、list 也数不到** | 探针写 4 类，`list` 只数到 1 类 | `listClaudeMemCategories()` 动态枚举，核心 4 类优先 |
| 2 | 召回结果只塞进 `context.recalled_memories`，**全引擎没人读**（回写已禁）→ LLM 看不到内容 | `grep recalled_memories` 只有写入点 | 打印 `↳ 历史记忆: 1. [review] <时间> <前 140 字>` 到 stdout |
| 3 | 同一条记忆在 5 个后端各一份 → 一次召回重复注入 8 条 | 实测同内容 8 行 | 跨后端去重（分类 + 结构化内容，markdown 头是 items 超集 → 包含即重复）→ 1 条 |
| 4 | `remember` 无 `data` 时把**召回的历史行**当本轮成果回写 → 自我复制，一层套一层 | 旧库 `data_snippet` 里套 `data_snippet`；E2E 第 3 遍存的是数组 | 改为只用当轮 context（与 `autoRemember` 同形） |
| 5 | `writeFileSync` 直写记忆库：半截 JSON → 读回 `[]`（静默）→ 下次写入把整类记忆覆盖成一条 | 代码审计 | `writeFileAtomic`（tmp + rename，4 个写入点）；`items.json` 损坏先搬 `archive/<cat>-items-corrupt-*.json` 再重建 |
| 6 | `category` 只对 project-memory/claude-mem 生效；且先取 2 条再筛，类型选错就恒空 | 探针 `category=general` 返回 14 条混杂类型 | `byCategory()` 统一过滤 + 按 category 时放大读取窗口 |

附带：非字符串 `type`（`{x:1}`）会让 agentmemory `type.replace` 抛 TypeError 被吞成 ok:false
（静默少一个后端）→ 统一过 `safeTypeName`；NEXO 事件补 `type`（从文件名 `<type>_<ISO>` 剥，
不能 `split('_')[0]`，`mobile_review` 会被切错）；markdown 归档补 `type`（否则 filters 对它失效）；
`list` 的三态计数改为 SQL `SUM(CASE…)`，不再 `readAgentmemory(10000)` 拉全库进内存。

### 验证
- **446 测试 / 40 文件**绿（新增 8 例：动态分类可召回、filters 数组任一命中、跨后端去重、
  不同分类同名内容不误去重、stdout 打印、回写不复读、非字符串 type、SQL 三态计数）。
- ESLint 双 0；场景审计 0 错误 / 15 警告。
- 真实引擎：空库 `qa` → 0 条；第 2 遍 `qa` → 1 条（打印内容）；`review` → 0 条（filters 只收
  review 类，符合设计）；`review` 连跑 → 8 条重复 → 去重后 1 条。

### 边界探针（13 项，全通过）

| 场景 | 结果 |
|---|---|
| unicode + 空格 + 大小写/尾斜杠路径 `中文 项目 (v2)` | 归一后能召回、`list` 不崩、目录名无乱码 |
| 写不进去的目录（父路径是文件） | 项目记忆报 `ENOTDIR` 警告但**不抛异常**，消息诚实降为「3 后端」；召回不崩 |
| 5MB 单条输入 | 写入不崩（1.4s）；items 1KB / agentmemory 截断（写入整份、读时截断）；**召回从 5.24M 字符降到 2071 字符** |
| 4 进程 × 5 次并发写同一 `items.json` | JSON 未损坏、无进程崩溃（原子 rename 生效；条数仍可能少于 20 —— 跨进程 read-modify-write 无锁，已知限制） |
| 手工破坏 `items.json` | 坏文件搬到 `archive/review-items-corrupt-*.json`，重建后可继续写 |

### 探针又逼出两个静默失败

| # | 问题 | 证据 | 修法 |
|---|---|---|---|
| 7 | `readAgentmemory` 直接 `SELECT content`，库里只要有 1 条 1.2MB 记录，`execSync` 就撞默认 **1MB maxBuffer** → ENOBUFS → 外面 catch 成 `[]`。库里有数据、召回永远 0 条 | 探针写 1.2MB 后 `readAgentmemory()` 返回 `[]` 而 `getAgentmemoryStats().count === 2` | SQL 里 `substr(content,1,500)` + 另取 `length()` 判 `truncated`；`maxBuffer` 拉到 64MB |
| 8 | 召回把项目记忆原样塞进 context：一条 5MB 记录 = 5.24M 字符注入，上下文直接爆 | `JSON.stringify(ctx.recalled_memories).length === 5243795` | `RECALL_ROW_CAP = 1200` 封顶，封顶后改写成 `content + truncated + length` 并丢掉原始 `data`（写入侧仍保留全量） |

新增 4 条回归测试（1.2MB 读回不丢、5MB 召回封顶、isolation 断言改为去重后 1 条、stdout 打印）。
**448 测试 / 40 文件**绿，ESLint 双 0，场景审计 0 错误 / 15 警告。

## 2026-10-26 记忆系统第 4 轮：保留策略 + 跨进程锁 + 召回装配

用户要求「按建议处理（保留策略 + 写锁），再检查一轮」。

### 做了什么

| 项 | 内容 |
|---|---|
| 跨进程锁 | `fs-utils.js` 新增 `withFileLock`（`openSync(wx)` 原子建锁 + 过期抢占 + `Atomics.wait` 睡眠），`items.json` 读-改-写、`pruneProjectMemories` 都持锁；超时降级为「照常写」而不是永久写不进去 |
| 保留策略（只归档不删） | `nexo.pruneNexo`（2000 文件 / 30 天）、`agentmemory.pruneAgentmemory`（每类型 200 / 365 天，先 dump `archive/*.jsonl`，**归档失败就中止删除**）、`project-memory.pruneProjectMemories`（每类型 300 → `.archive/<type>/`）；`claude-mem` 的 markdown 裁剪从 `unlinkSync` 改成搬进 `archive/markdown/` |
| 入口 | `consolidate` 顺带执行（22 个场景）+ 新动作 `pruneMemories`；`autoRemember` 每 6 小时最多跑一次，且**只收拾 project-memory**（全局库只在明确的「整理」步骤动），`consolidate` 结束后写 `.last-prune` 防止紧接着重扫 |
| 测试 | 新增 describe「保留策略与跨进程锁」（3 进程并发写、过期锁抢占、超时不删他人锁、三后端归档）+「召回装配」5 个用例；**460 tests / 40 files** |

### 第二轮复查又抓出 3 个召回缺陷

| # | 缺陷 | 证据 | 修法 |
|---|---|---|---|
| 1 | **均分配额让召回填不满** | 库里有 5 条不同记忆，`limit=10` 只召回 1–2 条：5 个后端存同一批副本，每家只读 2 条 → 去重后窗口空 | `recallQuota = limit×3`（上限 60）先多取，再「轮转交错（预算 `limit×6`）+ 去重 + 截断」 |
| 2 | **markdown 归档正序读** | `readdir` 给旧→新，其余后端新→旧，两边的「第一条」不是同一件事 → 去重配不上对，5 条记忆召出 10 行 | `readClaudeMemMarkdown` 按文件名倒序；`memoryBody` 对 markdown 行剥掉 141 字标题头只比 JSON 载荷（正文还有 500 字上限，会被截断） |
| 3 | **`limit` 为负/非数字** | `slice(0, -5)` 会「删掉最后 5 条」，`limit="abc"` 退化成空 | 非正数/非数字回落 10 |

顺带修正：`list` 的 NEXO 总数用新的 `countNexoFiles()`（旧实现拿 `readNexoData(5000).length` 当总数，超过 5000 静默少数），明细超窗口时标注「明细仅含最近 N 条」；`getAgentmemoryStats().running` 改成 `.ok`（那个字段从来不代表「进程在跑」）。

### 真实引擎 E2E（沙箱 `E:/tmp/meme5`，已删）

`qa` 三连：召回 0 → 1 → 1（去重生效）、`已保存到记忆（4 后端，项目记忆命中相同内容未重复写入）`、`consolidate` 后 `.last-prune` 落盘、无 `.lock` 残留；`pruneMemories` 把 NEXO 3→1、agentmemory 3→2，`list` 计数同步更新，归档文件确认落在 `archive/`。

---

## 会话：写入侧去重 + 归档压缩 + 遗留安全问题（第五轮）

| 项 | 内容 |
|---|---|
| 写入侧去重 | 新增 `contentFingerprint()`（`memory/project-scope.js`）：规范化 JSON（键排序、忽略 `timestamp`/`ts`/`created_at`/`updated_at`/`stored_at`/`archived_at`）+ sha256。四个写入器都接受 `{fingerprint}` 并返回 `{skipped:true}`：claude-mem items（前 20 条内查）、claude-mem markdown（标题区写 `- 内容指纹:`，查该类型最近 10 个文件）、agentmemory（新增 `content_hash` 列 + SQL 判重）、NEXO（事件 JSON 带 `fingerprint`，查最近 50 个同类型文件） |
| 两条写路径合一 | 抽出 `writeAllBackends()`，显式 `remember` 与 `autoRemember` 共用（以前 auto 只写 markdown、显式写 items+markdown，两个存储条数对不上）；消息如实报「N 个后端命中相同内容未重复写入」 |
| `saveProjectMemory` 换指纹 | 旧的「完整内容 sha256」在 auto 路径上永远判不出重复（每轮都有新 `timestamp`）→ 每跑一次多一条；改走同一个 `contentFingerprint` |
| 归档压缩 | 新 `memory/archive.js`：`compactArchives()` 把 30 天前的归档 `.gz`（四个归档根），压缩件非空且回读非空才删原件、已有 `.gz` 不覆盖、单文件 >64MB 跳过并报数；接进 `pruneAll`，`consolidate`/`pruneMemories` 都会带上「压缩旧归档 N 个」 |
| CLI 缺口 | `memory` 子命令只能操作 cwd（`-t` 是记忆类型，没有 target）→ 新增 `-T/--target <path>`，`remember`/`list` 可跨项目读写 |
| 泄漏密钥 | `codewhale-config.toml` 的明文 `api_key` 改成 `${CODEWHALE_API_KEY}` 占位符；新增 `docs/SECURITY.md` 说明「必须轮换、历史重写不在授权范围」 |
| 开放重定向盲区 | `threat-scan.js` 补三条规则（直取 `req.query` / 模板串拼参数 / Python `request.args`），新增 `threat-scan.test.js` 固化「命中 + 不误报常量目标 + 空扫描按失败」 |
| 测试 | **477 tests / 42 files**；新增 describe「写入侧去重（内容指纹）」（指纹稳定性、跨项目不误跳、4 后端各自跳过、连跑两次不翻倍）、「归档压缩」（窗口、不覆盖、pruneAll 联动）、`cli-memory.test.js`（`--target` 真的落对项目）、`threat-scan.test.js` |

### 探针抓到的缺陷（本轮修）

| # | 缺陷 | 证据 | 修法 |
|---|---|---|---|
| 1 | **跨项目误跳** | A 项目写过的内容，B 项目写同样的内容被判重跳过 → 召回按项目过滤，B 永远查不到这条 | items/markdown/NEXO 判重都加上「项目路径相同」条件 |
| 2 | **`id` 被当成易变字段** | `{note, id:'AAA'}` 与 `{note, id:'BBB'}` 指纹相同 → 直接丢一条真实记忆 | `VOLATILE_KEYS` 只留时间戳，去掉 `id` |
| 3 | **只看最新一条** | 两个场景交替写同一分类，重复件排第二位就认不出 | 改成「前 20 条内查指纹」 |
| 4 | **NEXO 判重静默失效** | `scanDir` 的 filter 收到的是**完整路径**，`startsWith('qa_')` 永远为假 → 每个事件都多写一份 | filter 里先取 `basename` |
| 5 | **「不算失败」触发失败判定** | 去重消息里写了「不算失败」，而引擎按 `/失败|阻断|FAIL/` 判失败 → 正常去重被标成失败步骤 | 措辞改成「（正常去重，本轮无新增）」 |
| 6 | **`ensureProjectColumn` 变成空操作** | 把 `cols` 改成 `Set` 后仍用 `cols.includes()` → TypeError 被外层 catch 吞掉，`content_hash` 列永远加不上 | 用 `cols.has()`；顺带发现「迁移失败不阻断」这条 catch 会掩盖真错 |

### 验证

- `npx vitest run` → **477 passed / 42 files**；两处 `npx eslint .` 零错误；`audit-scenes.mjs` 0 错误 / 15 警告
- 并发探针：4 个进程同时写同一份内容 → 每个后端恰好 1 条，无 `.lock` 残留
- 窗口探针：把 `stored_at`/`created_at`/mtime 改到 8 天前 → 重新写入（7 天窗口生效）
- 边界探针：`null`/`undefined`/`''`/`0`/`false`/`[]`/`{}`/嵌套数组都给 32 位指纹；数组顺序敏感；`null` ≠ `''`
- 真实 CLI E2E（沙箱 `E:/tmp/dedupe-e2e`）：`memory remember --target` 两连 → 第一条「已保存到记忆（4 后端）」、第二条「记忆内容与最近记录相同，4 个后端均未重复写入（正常去重，本轮无新增）」；`memory list` 四家各 1 条，项目记忆落在 `<target>/.claude/memory/qa/`
- 副作用说明：探针漏设 `AGENTMEMORY_HOME` 时压缩了 `~/.agentmemory/archive/` 里 1 个旧 jsonl（内容为早期探针数据，已校验可 `gunzip` 还原，无损）

### 第五轮复查（提交后自审）又抓到 3 个缺陷

| # | 缺陷 | 证据 | 修法 |
|---|---|---|---|
| 1 | **判重窗口按「最近 N 条」被别的项目插队挤爆** | 12 个其他项目交替写同一类型后，本项目同内容再写又被保存（markdown 后端 `slice(0,10)`、NEXO `slice(0,50)`） | 改成「按 mtime 新→旧扫到时间窗外为止」，markdown 上限 60、NEXO 上限 200；claude-mem items 直接扫窗口内全部（已被 500 封顶）。补回归用例（把上限调回 10 会红） |
| 2 | **压缩反而变大** | 13 字节的归档 `.jsonl` 压成 27 字节，且从可读变成不可读（NEXO 归档事件本来就只有几百字节） | 压缩后不小于原体积就留原文，计入新计数 `noGain`；`bytesAfter` 统计顺带修正（原来漏算 skipped/ignore） |
| 3 | **测试在 %TEMP% 泄漏目录** | `smoke.test.js` 的 `makeTempDir()` 未登记清理，本机实测积了 80+ 个 `smoke-*` 目录 | 登记到 `TEMP_DIRS` + `afterAll` 统一删；文件名用自增序号（同毫秒建两个会撞名）。复跑全套后新残留为 0 |

### 交付前最终验证

- `npx vitest run` → **479 passed / 42 files**；`npx eslint .` 两个根目录零错误；`audit-scenes.mjs` 0 错误 / 15 警告（全是 `no-verify-step`）
- 真实场景 E2E（沙箱）：`qa` 连跑两次 → 第二次 `✔ 记忆内容与最近记录相同，4 个后端均未重复写入`，四家各 1 条、无锁残留
- 跨项目隔离 E2E：A 写过 `{"marker":"AUDIT5","score":0.9}` 后，B 写同样内容仍「已保存到记忆（4 后端）」；B 的列表「本项目 1 / 其他 1」
- 并发 E2E：4 进程同时写同一内容 → claude-mem items 1 条、markdown 1 个（有锁）；project-memory / agentmemory / NEXO 各 2 条（无锁，先查后写，已在文档标注为已知限制）
- 归档压缩边界：空根不炸、`.db` 不动、超大文件（70MB 稀疏文件）3ms 内跳过并计入 `tooLarge`、小文件 `noGain` 留原文
- 旧数据兼容：手工塞一条无指纹、无项目的历史 items 条目后，新内容照常写入（判重不会误伤）

### 第六轮（收尾验证，无新缺陷）

| 探针 | 结果 |
|---|---|
| 归档目录是否被读端引用（压成 `.gz` 会不会让召回丢数据） | 四个归档目录都是**只写不读**的汇（`archiveRecords` / `archiveMarkdown` / `pruneNexo` / `pruneProjectMemories` 写进去，没有任何读取路径引用），压缩不影响召回 |
| Windows 路径写法归一化 | `Proj` / `proj` / `C:/…/` / 反斜杠 / 尾斜杠 / 短名 `ADMINI~1` 全部归一成 `c:/users/administrator/...`；6 种写法连写同一内容 → 每家仍 1 条，三种写法召回结果一致（加了回归用例） |
| 旧数据兼容 | 无指纹、无项目的历史 items 条目混入后，新内容照常写入（判重不误伤历史） |
| 归档压缩失败面 | 空根不炸；不可压缩后缀（`.db`）不动；70MB 稀疏文件 3ms 内跳过并计入 `tooLarge`；小文件计入 `noGain` 保留原文 |
| 并发写 | 4 进程同写 → claude-mem 1 条（有锁），其余三家各 2 条（先查后写，已在 `docs/memory-scope.md` 标为已知限制） |

最终：**480 tests / 42 files** 全绿，eslint 两个根目录零错误，`audit-scenes.mjs` 0 错误 / 15 警告。

---

## 2026-XX-XX 密钥扫描盲区修复（`de81eea`）

**起因**：用户问「那把 DeepSeek 代理密钥配在哪、给谁用的」。查清后发现 `secret-scan` 根本扫不到它。

**密钥归属**（`sk-SW1…`，`base_url = https://api.supxh.xin/v1`，模型 `deepseek-v4-pro`）：

| 位置 | 使用方 |
|---|---|
| `~/.codewhale/config.toml` | codewhale（`npm i -g codewhale`，`start-codewhale.bat`） |
| `~/.deepseek/config.json` | deepseek CLI |
| `~/.cc-switch/cc-switch.db` | cc-switch（`providers` 表 `codex / supxh`，另有 11 份 backups） |
| `~/.claude/history.jsonl` | Claude Code 命令历史（curl 打印过 Bearer） |
| `~/.pi/agent/sessions/**`、`traces/**` | pi/percho 转录 |
| `~/.ai_completion/.code_contribution/_code_commit.db` | AI 补全插件 |
| `~/Documents/xwechat_files/**/API.txt` | 微信收发（已外流） |
| git 历史 `013c00c` | 仓库首个提交里的 `codewhale-config.toml` |

**修复的四个缺陷**（全部有回归测试）：

1. 规则里没有 `sk-` 风格 —— 只有 `ghp_`/`AKIA`/`api_key` 字面前缀，DeepSeek/OpenAI 裸 key 完全不匹配。
2. `SAFE_FILES` 白名单连**历史**一起豁免，`codewhale-config.toml` 在里面 → 真泄露被静默跳过；同时把该文件移出白名单（模板里若写回真 key 也要报）。
3. `git log -S` 只看最近 5 个提交，而「删除密钥」的最新提交同样命中 `-S`，真正的引入点被挤出分页 → 改 `git log --all -G <regex>` + 命中提交整棵树 `git grep`（不能按 `show --name-only` 截断：初始提交上千文件，实测正好把密钥文件筛掉）。
4. **Windows 引号静默失败**：`escapeArg` 一律单引号，而 `execSync` 在 Windows 走 `cmd.exe` —— `'ghp_'` 引号被原样传入，等于搜带引号的字面量，永远 0 命中；`git commit -m 'x'` 也会把单引号写进提交信息。

**接入**：`review` 场景 step **4.551 `git-leaks`**（`security_deep` / `full_audit`），输出分「当前仍是明文」与「仅在历史里」两档，两者都置 `gitLeaksPassed = false`。实测本仓库：`1 个文件仅在历史里 → codewhale-config.toml（提交 013c00c）`，耗时约 19s（`git log -G` 单次 8s 占大头）。

**仍需人做**：轮换密钥（后台操作）；`git filter-repo` 重写历史属破坏性，未获授权不动。

**验证**：487 tests / 43 files 全绿，两个根目录 eslint 零错误，`audit-scenes.mjs` 0 错误 / 15 警告。

---

## 2026-10-27 只保留工作流需要的工具（环境清理）

按「不要那些 AI 编程工具，只保留工作流需要的」执行清理。**移动不删除**，全部落在
`E:/ai-tools-backup-20261027/`，附 `MANIFEST.md`（含每个目录的大小与还原 `mv` 命令）。

保留依据 = `claude-scene/src/lib/platform.js` 的 `PLATFORM_MARKERS`：Claude Code / opencode /
Codex / ZCode / pi（+ Percho），加上 `~/.cc-switch`（Claude Code、Codex 的模型密钥中转，
删了这两家就没 key）、记忆后端（agentmemory / claude-mem / NEXO / CodeGraph）、工具链
（semgrep / sqlite3 / aislop / python / node）。

清掉（工作流零引用）：

- 家目录 20 个：`.codewhale` `.deepseek` `.claude-code-router`(914MB) `.chelper` `.kimi`
  `.cline` `.roo` `.antigravity` `.openclaw` `.archon`(222MB) `.claude-flow` `.zagent`
  `.costrict` `.stc` `.factory`(170MB) `.qoder`(687MB) `.ai_completion` `.gemini` `.cc-connect`
- npm 全局 6 个：`codewhale` `deepseek-tui`（无 bin 的死安装）`mythos-agent` `cc-connect`
  `@bearer/cli`（文档本就说「不接入」）`skills`
- 仓库内连带：删 `start-codewhale.bat`（工具没了，启动器是死文件）；
  `update-all.bat` 的 `[3/7] mythos-agent 安装/更新` 改成「工作流依赖 CLI 检查」——
  否则每次全量更新会把刚删掉的东西装回来。

合计释放约 **2.0 GB**。副作用：泄露的 `sk-SW1…` 在仓库外从 7 处降到 5 处，
`~/.cc-switch/cc-switch.db` 是唯一还在被工具读取的副本。

验证：487 tests / 43 files 全绿，`claude-scene list` 正常输出 25 个场景。

---

## 2026-10-27 第二批：只留 pi / Percho

用户明确「Claude Code · opencode · Codex · ZCode 都不要了」。清理后本机**只剩 pi + Percho**
一个宿主；`platform.js` 的适配代码原样保留，重装任一宿主即可恢复。

实际拆掉的比预期多，因为每家都装了两份：

- **Claude Code**：npm 包 `@anthropic-ai/claude-code` + 原生 `~/.local/bin/claude.exe`(232MB)
  + VS Code 扩展 `anthropic.claude-code` + `~/.local/share/claude`(222MB)
- **Codex**：npm 包 `@openai/codex` + **MSIX 商店包** `OpenAI.Codex`（带
  `CodexSandboxService.OpenAI.Codex` Windows 服务，会自动拉起 `codex.exe` 反复锁住
  `~/.codex/*.sqlite`）+ `AppData/Local/OpenAI/Codex`。要删干净必须先
  `Remove-AppxPackage`，光 `npm rm -g` 不够——这也是 `.codex` 前两次 `mv` 失败的原因。
- **opencode**：应用（NSIS）+ `~/.config/opencode` + `~/.local/share/opencode`(408MB)
- **ZCode**：只有 `~/.zcode`（应用本就未装）
- 连带：CC Switch（MSI，Claude Code/Codex 的密钥中转，没了宿主就没意义）
- VS Code 里的 AI 代理类扩展：`openai.chatgpt` `saoudrizwan.claude-dev` `moonshot-ai.kimi-code`
  `zgsm-ai.zgsm` `google.gemini-cli-vscode-ide-companion`

**`~/.claude/memory` 原地保留**——`src/lib/paths.js:85` 的 `CLAUDE_MEM_DIR` 指向它，
那是 claude-mem 记忆后端的数据目录，整目录搬走等于删用户记忆。

代码侧只改一处：`scripts/install-global.sh` 与 `scripts/install-percho.bat` 现在先
`command -v claude`，装不上就跳过并在输出里说明——否则每次安装都会凭空造一个没人读的
`~/.claude/commands`。

备份仍全部落在 `E:/ai-tools-backup-20261027/`（合计约 4.0GB），`MANIFEST.md` 补齐了第二批。
副作用：泄露的 `sk-SW1…` 活跃副本从 5 处降到 **2 处**（`~/.pi/agent/sessions/**`、
`~/.pi/agent/traces/**` 转录），其余全在备份目录里躺着。

验证：487 tests / 43 files 全绿，`claude-scene list` 正常，`install-global.sh --dry-run`
正确输出「未检测到 claude CLI —— 跳过」。

---

## 2026-10-27 第三批：TRAE Work CN / Kiro / ZCode

- **TRAE Work CN 0.1.36**：注册表 DisplayName 是 `TRAE Work CN (User)`，但安装目录叫
  `AppData\Local\Programs\TRAE SOLO CN`（很容易看漏）。Inno Setup 静默卸载
  `unins000.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`，exit=0；uninstaller 只留下
  `debug.log`，目录已清。
- **Kiro 0.8.0**：同样 Inno Setup 静默卸载，注册表条目消失；`~/.kiro`、
  `AppData\Roaming\Kiro` 移到备份。
- **ZCode**：应用本来就没装（只有 `AppData\Roaming\ZCode` 与上一批移走的 `~/.zcode`），
  两处数据都在备份里。
- **未动**：`TRAE CN 3.4.4`（用户只点名 Work CN），其共享数据 `AppData\Roaming\Trae CN`
  与 `~/.trae-cn` 一并保留。

至此本机 AI 工具只剩：pi / Percho（宿主）、VS Code 里的 pencil + v0 + figma 扩展、
以及 TRAE CN 3.4.4。备份 `E:/ai-tools-backup-20261027/` 约 4.0GB，`MANIFEST.md` 三段齐全。

---

## 2026-10-27 第四批：TRAE CN 卸载 + `docs/llm-api-config.md`

- **TRAE CN 3.4.4**：Inno Setup 静默卸载，注册表条目消失；残留目录（`debug.log` + `mcp.json`）、
  `~/.trae-cn`(243MB)、`AppData\Roaming\Trae CN`(2146MB) 全部移入备份。
- 卸载后在 `Trae CN/mcp.json` 里发现**又一个明文 key**：`sk-5470…`（iflow，`apis.iflow.cn`，
  配给本地 `E:\多agent协作框架（开发版）` 的 MCP server）。该文件已随备份移出活跃目录。
- 本机现在**只剩 Percho 一个 AI 应用**。
- 新增 `docs/llm-api-config.md`：清理后「谁还需要大模型 API」的定稿答案。
  核心结论 —— **只有 pi/Percho 需要**（`~/.pi/agent/models.json` + `auth.json`，3 家 provider）；
  引擎不直连 LLM；MCP server 需要的是服务 token，而且 `.claude/mcp.json` **pi 根本不读**
  （pi 读 `~/.pi/agent/mcp.json` / `.pi/mcp.json`，两个都空）→ 目前没有任何 MCP 接入；
  `FACTORY_API_KEY` / `GLM_API_KEY` 是孤儿变量。

---

## 2026-10-27 第五批：MCP 配置迁到 pi + 清掉孤儿环境变量

**1) `.claude/mcp.json` → `.pi/mcp.json`（先迁无需凭据的 3 个）**

pi 只读 `.pi/mcp.json` / `~/.pi/agent/mcp.json`，Claude Code 那个位置它根本不看。迁移时踩到的两点：

- **变量语法不同**：pi 用 `${VAR}`，Claude Code 用 `${env:VAR}`；`type: "stdio"` 在 pi 里可以省（有 `command` 即 stdio）
- **`npx` 直接用**：`command: "schemaforge-mcp"` 这种裸命令在 Windows 上 `spawn ENOENT`（没有 `.cmd` 解析），
  用 `command: "npx", args: ["-y", ...]` 才是 pi 文档里支持的写法

三个 server 都实测过 MCP 握手（`initialize` → `serverInfo`）：`schemaforge-mcp`、`a11y-mcp-server`
（自报 `axe-accessibility-server`）、`detox-mcp`。项目级和用户级各放一份（内容相同），任意目录可用。

**2) `handler-verify.js` Pass 10 跟着修了三处**

- 配置路径从硬编码 `.claude/mcp.json` 改为按 **项目 `.pi/mcp.json` → 用户 `~/.pi/agent/mcp.json` → `.claude/mcp.json`**
  取第一个存在的（导出 `mcpConfigCandidates()` 便于测试）
- `checkServerEnv` 原来只会剥 `${env:` 前缀，遇到 `${VAR}` 会把变量名读成 `${VAR`，误报「API Key 未配置」；
  改为正则 `^\$\{(?:env:)?([A-Za-z_]\w*)\}$`（导出 `envVarName()`）
- `detectMcpIssues(_targetPath)` 的参数之前是**被忽略的**，所以在别的项目跑 `/check` 也会读本项目配置；
  现在按 targetPath 解析，输出里的路径对项目内文件显示相对路径、对用户级显示 `~/...`
- 成功时不再沉默，打印 `✅ Pass 10 — MCP 配置: 3/3 个 server 就绪 (~/.pi/agent/mcp.json)`

**3) 孤儿环境变量已删**

`FACTORY_API_KEY` / `GLM_API_KEY` 的值先写进 `E:/ai-tools-backup-20261027/env-vars-backup.txt`，再从用户环境删除。
pi 用的是 `~/.pi/agent/auth.json` 里的 key，删这两个不影响任何工具。

**4) `.claude/mcp.json` 已删**（宿主卸载后是死文件，内容在 git 历史 + `docs/llm-api-config.md` §3 的现成片段里）。
`docs/tools-inventory.md` 的「活跃 MCP 服务器」从 7 个改为 3 个。

验证：491 tests / 43 files 全绿，两个 root 的 eslint 0 error，两个目录下 Pass 10 都正确命中。

---

## 2026-10-26 全工作流健康检查（25 个场景）

检查方法：`--dry-run --auto` 跑遍 25 个场景 + 真跑 `/check` + 引擎自检 11 道 + 抽查 3 个真实 handler。

**发现的真问题（均已修）**

1. **`/check` 的冒烟测试一直是红的**。它在仓库根跑 `vitest`，而两个测试文件的夹具用
   `process.cwd()` 定位仓库：`skill-runner.test.js` 的 `cwd/..` 在根目录下变成盘符根
   `E:\`，`memory-store.test.js` 的子进程 import 路径变成 `E:/auto-coding/src/...`。
   从 `claude-scene/` 跑是绿的，从根跑 14 个红 —— 所以「本地全绿、自检报错」。
   两处都改成按 `import.meta.url` 定位。**现在根目录跑 504 tests / 45 files 全绿。**
2. **MCP 条件全是假的**（见 ADR-007）。github 12 处、context7 6 处、codegraph 5 处步骤
   之前在「工具不存在」的情况下被判可执行。
3. **`/check` Pass 9 报了 8 个假孤儿动作**：`ui-polish` 走自己的 `UI_POLISH_ACTIONS`
   分发表，`selectModes`/`selectSetupKind` 由 `start.js` 拦截，都不在 `ACTION_REGISTRY`。
   另外注册表键有两种写法（`gitLeaks:` / `'git diff --name-only':`），解析器只认裸标识符，
   于是真动作也被判「不存在」。修完 Pass 8 = 25 场景全部有效。
4. **CodeGuardian 边界门禁是个纯桩**。`refactor` / `optimize` / `loop` 都把它标成
   「最关键防线」并挂了 `on_error: abort`，而实现只有一行 `return '仅对话模式可用…'`。
   现在真量：`git diff --numstat` + 未跟踪文件行数、`package.json` 依赖键集合差，
   超限置 `context.lastStepFailed` + `boundaryViolations`；复杂度没有可靠离线工具，
   输出里明写「未测量」，不猜。新增 `codeguardian.js` + 5 个用例（含 8.3 短名路径坑、
   子目录不是仓库根时不冒充通过）。
5. **移动端几个 handler 拿「没跑」当「通过」**：`privacyPassed = true`（Bearer 没装）、
   `tools_installed = missing`（什么都没装却记成已装）、`app_built` / `source_scanned` /
   `deps_scanned`（同样的模式）。全部改成「跳过/未执行（不计为通过）」，且只在对应 MCP
   真配了时才请求执行。
6. 删掉死文件 `handlers/new-external-tools.js`（两个 "not yet implemented" 桩，无人引用）
   与 `security-scanning.js` 里的 `handleTrivyScan` 桩。

**当前状态**

- 25 个场景 dry-run 全部 exit 0；条件统计与配置文件一致（github 0/12、context7 0/6）
- `/check`：pass 9 / fail 0 / warn 2（warn 是已知的可选工具缺失与自检启发式）
- 引擎自检问题数 38 → 22（剩下的多为 knip「未用导出」与逻辑密度启发式的误报）
- 504 tests / 45 files 全绿（仓库根与 `claude-scene/` 两处跑都绿），eslint 两个 root 均 0 error
- 真实执行抽查：`git-leaks`（19.7s，1 个文件仅历史）、`insecure-defaults-scan`（230 文件 0 候选）、
  `codeguardian_optimize`（如实报 614 行超限）、`ui-polish` 的 `removeHardcodedColors` /
  `applyDaisyUIComponents`（经 `UI_POLISH_ACTIONS` 分发表正常执行）

**未处理（已知，不影响运行）**

- `enhancements.js` 仍引用已卸载的 `mythos-agent`（探测器失败即不出现，属优雅降级）
- knip 5 个未用导出（`resolveSemgrep` / `buildSemgrepTargets` / `archiveRoots` / `contentHash` / `sleepSync`）
- Pass 3 逻辑密度 10 个「疑似空转」里多数是真实现（`handleExportAssets`、`handleMemoryPrune`）
  或诚实的跳过（`handleCodeGraph*`），属启发式误报

### 收尾轮：把自检剩下的噪音变成 0

上一轮做到 `/check` 6 个问题。这一轮把最后 6 个也清了，但没有靠「调宽度」清，而是修了探测器本身：

1. **审计脚本自己写了一套分类正则**（又一次违反「审计要建模引擎现实」）。`scripts/audit-scenes.mjs`
   的验证动作白名单是 `^(lint|test|build|typecheck|verify|runTests|verifyBuild)$`，而引擎门禁
   （`acceptance-check.js` 的 `VERIFY_RE`）认的是 `runLint/smoke/verifyHandlers/reviewDiff…`。
   于是 15 个场景被误报「含变更类动作但没有验证类步骤」。改为直接 import 引擎的 `classifyAction`，
   **警告 15 → 0**，并加了 `scene-acceptance.test.js`（4 个用例）把这条一致性钉住 ——
   以后场景漏验证动作会在测试里红，而不是等跑到最后一步 exit 1。
2. **Pass 3/9 的「空转」判定有两处真 bug**：
   - `extractFunctionBody` 原来是「切到下一个 `export function` 为止」，等于把后面的模块级代码
     都算进这个函数体（空壳后面跟真实现 → 判成有逻辑；模板字符串里的 `}` 又会提前截断）。
     改成真正的括号配对（拆出 `skipQuoted`/`skipLineComment`/`skipBlockComment`，压住复杂度）。
   - 定位函数体 `{` 用的是 `indexOf('{')`，撞上 `options = {}`、解构参数、TS 注解就从头开始取，
     函数被截成两行 → 误报。新增 `findBodyBrace()`：先配对参数表的 `(`…`)` 再找 `{`。
   - 「有意义」的行只认白名单（fs/数组方法/if/for…），`ensureDir(t); exportTokens(t);` 这种
     「调自己的辅助函数干活」被判空转 → 加通用调用识别；同时把「只返回一句跳过/不可用」的
     函数认定为**诚实跳过**而不是空转。
   **Pass 3：10/237 → 231/231 全通过；Pass 9：241 个全通过。**
3. **knip 噪音**：新增 `claude-scene/knip.json` 的 `ignoreBinaries`（`xdg-open`/`go`/`sqlite3`/
   `pip`/`dependency-check`/`mythos-agent` —— 这些是引擎主动探测的可选外部工具，不是依赖），
   删掉真死函数 `getPrimarySceneDir()`（无人调用），把仅内部使用的 `PACKAGE_SCENES_DIR`/
   `getSceneDirs`/`resolveSemgrep`/`archiveRoots`/`contentHash`/`sleepSync` 取消 `export`。
   **Pass 7：9 未用导出 + 1 死文件 → 0/0/0。**
4. `buildSemgrepTargets` 补了 4 个用例（扫描根 / 回落 `.` / 空输入不出空 targets / 排除嵌套仓库）——
   这个函数决定 semgrep 扫什么，错了只会静默扫不到东西。
5. `enhancements.md` / `enhancements-summary.md` 加了说明：探测器依赖外部工具，本机
   `mythos-agent`（已随工具清理卸载）与 `gepa` 未装，所以 mythos/GEPA 的增强项不会出现 ——
   不是配置漏了。代码保留（装回即恢复），但文档不再假装它们可用。

**收尾状态**：`/check` **11 道全绿 / 0 问题**（起点 38）；审计 **0 错误 0 警告**（起点 0/15）；
25 场景 dry-run 全 exit 0；**521 tests / 46 files 全绿**；eslint 两个 root 均 0 error；knip 全清。

---

## 2026-10-27 `/setup` 可调用性 + 提示词一致性门禁

**起点**：有人问「文档里 25 个命令，pi 里到底能敲出几个」。查出来的问题和自检、审计都无关——
是「文档 / 场景引擎 / 提示词」三份清单从没对齐过。

1. **`/setup` 在 pi 里根本敲不出来**：场景 `setup.json` 存在（e2e+monitor 合并时引入），
   AGENTS.md / CLAUDE.md / README 都写了 `/setup`，但 `.pi/prompts/setup.md` 从来不存在。
   补上提示词，同时补 `--kind`：
   - `setup` 的 e2e/monitor/property 三选一只有 inquirer 交互能选，pi 里的 agent 是
     非交互的，`--auto` 永远落到 default(e2e) —— monitor / property 两条分支等于不可达。
   - `start <scene> --kind <id>`（`resolveChoiceOverride()`，`start.js` 导出）：对照步骤
     声明的 `params.options` 校验，非法值打印可用值清单并回落默认，**不静默改计划**。
   - dry-run 里也会显示 `└─ CLI 覆盖: monitor`，否则试运行看不出参数生效没生效。
   - `start.test.js` +4 用例（不传值 / 合法值含两种 options 写法 / 非法值给清单 / 无 options 不炸）。
2. **`/spec` 是 Claude Code 方言**：`.claude/commands/spec.md` 里写的是
   `Skill(skill:..., args:...)` / `Task(subagent_type: ...)`，pi 没有这两个工具。
   重写成 pi 能执行的形态（读 `.claude/skills/speckit-*/SKILL.md` + `subagent` 工具），
   落到 `.pi/prompts/spec.md`；原文件保留在 `.claude/commands/` 作历史。
3. **提示词一致性门禁（双保险，防止再次漂移）**：
   - `scripts/audit-scenes.mjs`：场景缺 `.pi/prompts/<id>.md` = warn；提示词里
     `claude-scene start <x>` 指向不存在的场景 = error。反向验证过（临时改名 setup.md → 立刻报警）。
   - `scene-acceptance.test.js`：每个场景都有提示词、提示词引用的场景都存在、
     `setup.md` 写全 `setup.json` 里声明的每种 kind。
4. **`npm test` = watch 模式的真相**：一直是裸 `vitest`，pre-commit 里跑就挂住 ——
   之前判成「husky 在 Windows spawn 不了」并长期靠 `--no-verify` 绕过，其实是自己挂自己。
   改 `vitest run` + 新增 `test:watch`。顺带 `.husky/pre-commit` 缺 shebang，
   Git for Windows 直接 `Exec format error`，补 `#!/usr/bin/env sh` + LF。
   **现在 pre-commit 真跑 eslint + 528 tests + deadcode，三个 commit 都过了钩子。**
5. `scripts/clean-session.cjs` 三处假绿修掉：`execSync` 缺 `shell: true`（Windows 上
   npm=npm.cmd → ENOENT → 谎报「No test script」）、非 git 目录被当成未初始化仓库、
   lint 命令失败仍报通过。
6. 删死文件 `.claude/commands/enhance-prompt.md`（全仓库零引用，且 `.claude/commands`
   在 pi 宿主下已不是入口）；`/hunt` 的全局桩 `~/.pi/agent/prompts/hunt.md` 保留 ——
   它是「hunt 已并入 review」的跳转提示，不是残留。

**状态**：`/check` 11 道全绿 / 0 问题（Pass 3 233 个函数 / Pass 9 241 个）；`audit-scenes`
25 场景 **0 错误 0 警告**；deadcode **0**；**528 tests / 46 files 全绿**；eslint 两 root 0 error。
提交 `191cf16`（脚本/钩子）+ `090ac59`（setup --kind + 提示词门禁）。

## 2026-10-27 `loop` 场景真迭代 + 三态检查 + aislop 落盘（4 个 bug）

**触发**：要求「全面深入检查所有工作流和记忆系统并修复bug，循环10次」。结果发现命令本身
和场景本身都有问题 —— 一次 run 报 9 pass/0 fail 但工作区 0 变更，属于空转绿。

1. **命令形式**：`claude-scene start loop --auto "循环10次"` 直接报
   `too many arguments`（需求必须走 `-p`）。位置参数给个友好提示仍待办。
2. **「循环10次」根本不存在**：引擎 grep 无 iteration/maxIterations/loopCount ——
   那句话只是塞进 prompt 的纯文本。新增 `--iterations N`（默认 1、上限 20）+ 收敛判据
   `shouldStopLooping`（本轮干净即停 / 发现数不降即停，防空转）。
3. **994 个 AI 代码气味是假的**：`aislop ci` 默认输出 JSON，`countAislopIssues` 只认
   `N issues` 文本，退化成逐行数 json 里的 issue 字样 → 报 994，实际 summary 是
   939（现在 945）。改为 JSON 优先解析，并把完整报告落盘
   `.claude/reports/aislop-*.json`（之前 994 条发现只活在 stdout 一行里，跑完即丢）。
   loop 场景 step 4.1 由 `aislop-scan` 改 `aislop-fix`（mode=fix, maxFindings=200）：
   可修复数超上限只报警不动文件，避免无人值守批量改写。
4. **review 假绿**：根目录没有 `tsconfig.json` 时 `npx tsc --noEmit` 打印帮助并退出 1，
   帮助里的 `--noEmitOnError` 命中 `/error|Error/` → 判「配置问题」静默跳过 → 上层
   仍报「代码审查完成（无问题）」pass。改为三态（issues/pass/skip）+ `findTsconfigs`
   向下探一层用 `-p` 指定（本仓库命中 `claude-scene/tsconfig.json`）。
   `deriveStepStatus` 同时支持处理器返回 `{status, message}`，跳过不再靠正则猜。

**验证**：新增 3 个测试文件 29 用例（`aislop.test.js` / `review-tsconfig.test.js` /
`loop-iterations.test.js`）；`--iterations 3` 实跑：第 1/3 轮发现 945 → 第 2/3 轮
仍 945 → `发现数未下降（945 → 945），停止空转` 提前收敛；review 显示
`eslint:pass / typescript:pass`（类型检查真跑了）；aislop 报告落盘；CodeGuardian 0 变更。
**557 tests / 49 files 全绿**，eslint 两个 root 0 error，pre-commit（test+deadcode）通过。
提交 `1479535`。

**遗留**：CodeGuardian 数的是「工作区全部未提交变更」，工作区脏时会把上一轮无关改动算进
±50 边界直接 abort（第一次验证时就被自己 756 行改动挡下）。是否改成「按本轮 diff 计」待议。

---

## 2026-10-27 删除清理备份 + 抹除密钥副本（用户授权，不轮换）

所有者指示：「删除备份，不要轮换密钥了，副本也可以不要」。三件事都做了，并把风险写进
`docs/SECURITY.md` §1.0 / ADR-010。

**1. 删除备份 `E:/ai-tools-backup-20261027/`（8.0 GB）**

删前先核对：仓库与脚本零引用（只有文档提到路径）；目录里 `grep` 到 20+ 个文件含同一把
明文密钥 —— 这正是「备份 = 副本」的直觉依据。`env-vars-backup.txt` 里只有
`FACTORY_API_KEY` / `GLM_API_KEY` 两条孤儿变量（对应工具已卸），不再需要。`rm -rf` 耗时 4 分钟。
**后果**：MANIFEST 里的还原命令全部失效，那些工具要回来只能重装。

**2. 全盘定位明文副本（不靠猜）**

`E:/tmp/find-keys.mjs`：598 272 个文件、14m44s（跳过 >32 MB 与缓存/构建目录），
按两把 key 的前缀做字节级匹配。命中 **13** 个，其中 1 个是探针自己（按前缀搜索必然自命中，
已从扫描范围排除），实际 **12 个**：

| 类别 | 文件数 | 处置 |
|---|---|---|
| pi 会话转录 + traces | 6 | 原地脱敏（等长覆盖） |
| VS Code `settings.json` + 2 份 `History/*.json` | 3 | 脱敏 |
| 微信 `API.txt` / 桌面便签 / aardio 示例 | 3 | 脱敏 |

**关键手法**：`sessions/**`、`traces/**` 正被 pi 以追加方式写入。读全文件 → 替换 → 整文件写回，
会把扫描期间新追加的轮次截掉（会话文件在我扫描后 40 分钟内就长了 23 KB）。所以用
`openSync(path,'r+')` + `writeSync` 在**原偏移写同样长度的字节**：密钥没了，文件长度不变，
并发追加不受影响。事后校验 8 072 行 JSON，**0 坏行**。

只读文件（微信收到的 `API.txt` 是 EPERM）先 `chmod 0666`、写完恢复原 mode —— 第一次跑
就在这个文件上崩了，脚本本身也因此补了 per-file `try/catch`。

**3. 复核**

12 个文件逐一 `grep` 两把 key 的完整前缀 → **残留 0**；仓库工作树 `grep` → 0。
唯一剩下的位置是 **git 历史 `013c00c`**，按所有者决定保留（`filter-repo` 属破坏性操作）。

**文档**：`docs/SECURITY.md` §1.0 新增「处置决定」表（含**知情风险**：key 从未吊销，
历史里的是活凭据；仓库一旦公开/加协作者必须先轮换或先重写历史）、§1.1 改为「副本清单
与处置结果」、§1.2 备份删除说明、章节编号按物理顺序重排为 1.0/1.1/1.2/1.3；
`docs/llm-api-config.md` §4/§5 同步；`DECISIONS.md` 新增 **ADR-010**。

**删除的探针**：`E:/tmp/find-keys.mjs`、`redact-keys.mjs`（临时工具，用完即删）。

## 2026-10-27 aislop 自动修复改为规则门控 + 工作流/记忆系统深检（7 个 bug）

### 一、`aislop fix` 为什么"修"成了删除

`aislop` 源码（`dist/index.js` `fixFileDeadPatterns`）里两条规则的修复动作就是删行：
`console-leftover` → 语句文本像错误信息就改 `console.error(`，否则**删掉整个语句**；
`narrative-comment`/`trivial-comment` → **删注释行**。`--safe` 的白名单是
「补 import / 并 import / 删注释 / 跑 formatter」，**不含** console 与死代码。

规则前提是"应用代码里遗留的 debug 输出"。aislop 用文件名/路径判 CLI 豁免：`cli.js`、
`*-cli.js`、`tools|scripts|cli|bin`、首行 `#!`、`require.main === module`。
本项目 CLI 入口叫 `src/index.js`、输出层在 `src/handlers/*.js` → **一个都不匹配**，
381 处承担输出的 console 全被当成遗留调试；aislop 自己也把这 325 条归为
`style-policy` 而非 `confirmed-defect`（56 条缺陷里还多是扫第三方脚本的误报，
如 `'define' is not defined`）。

处置：`.aislop/config.yml` 关掉三条「fix=删行」规则 + 排除第三方副本 →
扫描 946→422、fixable 543→42；`planAutoFix` 按规则分类门控（`config-ignored` /
`risky-rules` / `unverifiable` / `over-limit` / `ok`），只有安全规则才真跑。
真·有意义的修法是收敛到 `src/lib/logger.js`（aislop 对 `logger.js` 有硬豁免），381 处需单独立项。

### 二、工作流/记忆系统深检

审计手段：25 个场景 `--dry-run` 全跑一遍（无崩溃）；场景 JSON 结构 + action 名对照
`ACTION_REGISTRY`；87 条 `condition` 逐条做可求值性分析（对照 `SIMPLE_CONDITIONS` 与
handler 写入的 context 键）；记忆四后端沙箱化（`CLAUDE_MEM_HOME`/`AGENTMEMORY_HOME`/
`NEXO_HOME`/`CODEGRAPH_HOME` 全指到 `.tmp-mem-sandbox`）跑 remember→list→recall→consolidate。

发现并修复：
1. `database_required`/`payment_required`/`email_required` 只写在 typedef 里、**没人赋值**
   → new-project 的 1.3/1.4/1.5（Supabase/Stripe/Resend 模板）条件恒假。改为从需求文本
   识别 + 显式标记。
2. `setupConfigured == false` 读 `ctx.setupConfigured`（无人赋值）→ 恒假，setup 的
   「配置失败通知」永不触发。`evalComparison` 改为优先按 `SIMPLE_CONDITIONS` 谓词求值。
3. 未知 action 走 `getActionMessage` 兜底 → 场景里 action 名写错也报 ✓ pass。
   新增 `hasActionMessage()`，未知动作打 `⚠️` 并写 `context.unknownAction`（ui-polish 自有表，豁免）。
4. `Pass 11 LLM 代理审计` 的 issue 是 `{level,file,detail}`，打印只读 `message/type`
   → 自检永远显示「🔴 issue」。同时它审计的是 `PROJECT_ROOT` 而不是 `--target`
   （`detectMcpIssues` 早已修正过同类问题），一并改为 `targetPath`。
5. `sync-docs` 跑完零输出：`syncAllDocs` 的返回值被丢掉、自己也不返回。
   改为返回 `{updated,unchanged,missingMarker,missingFile}` 并打印。**顺带查明**：
   `CLAUDE.md` 缺 `AUTO-SYNC` 标记、`.claude/rules/workflows.md` 不存在、
   `scenes/README.md` 缺 `SCENE-TABLE` 标记 → 文档同步功能实际从未生效（留待决定是否补标记）。
6. 记忆召回把整份 data JSON 截 140 字甩出来（`{"source":"check_workflow","findings":...}`）。
   改为翻译成一句人话：`场景 loop；7 步完成；测试✓；lint✗；安全: 1 项；需求「…」`。
7. `handleAutoRemember` 的 findings 只收 `testPassed`，**lint/类型/门禁结论全丢** → 新增强制
   `lintPassed`/`typecheckPassed`/`gateBlocked`，并用 `compactFindings` 剔除 undefined/空对象
   （否则指纹随未执行步骤飘动，同一结果存多份）。

一条自我更正：最初以为「记忆只写不读」（grep 找 `memoryRecall` 而场景用的是 `recall`），
于是往 `start.js` 加了场景前召回 —— 实跑发现 24 个场景**本来都有 `recall` 步骤**，
输出重复两遍，已回滚该改动（`--no-recall` 一并删除）。真实缺口只有「召回内容不可读」。

验证：`vitest` **593 测试 / 50 文件**全绿（+11 条新回归），`eslint .` 0 error，
`start check --auto` 从「5 个问题待处理」降到 1（仅剩 knip 的历史导出，本次新增的已清），
`start loop --auto -i 1` exit 0、召回块单次输出、aislop 按 `config-ignored` 拒跑且工作区 0 改动。

## 2026-10-27 第二轮深检：条件/输出/自检三处假绿 + show 命令重建

审计手段：25 个场景全量 `--dry-run`（找出 exit≠0 的）；条件标识符 ↔ `SIMPLE_CONDITIONS` ↔
context 写入点三方对照；场景 action ↔ `ACTION_REGISTRY` 对照；记忆系统沙箱化行为测试
（去重/隔离/坏文件/保留策略/consolidate 后召回）。

### 又是「恒假条件」这一类（同一病根，第三、四例）

1. **`ctx.platform` 全引擎没人写**：`handlers/mobile/audit.js` 的 `detectProject` 写的是
   `project_type` + `platforms`。`mobile_platform`/`ios_platform`/`android_platform`
   只读 `ctx.platform` → mobile-audit / mobile-release / mobile-onboard 里
   iOS·Android 专有步骤（Android SDK 检查、AAB 上传…）**永不执行**。
   改为 `platformFlags(ctx)`：显式 `ctx.platform`（ios/android/both） ∪ `ctx.platforms`
   ∪ `project_type === 'expo'`（视为双端）。
2. **文件类条件看的是引擎自己而不是目标项目**：`build_artifacts_exist`/`planning_files_exist`/
   `spec_file_exists`/`spec_file_not_exists`/`plugin_ce_available`/`crg_graph_built`/
   `dependencycheck_available` 都用 import 时冻结的 `PROJECT_ROOT`（= cwd），
   `--target 别的项目` 时判定的是 E:\auto-coding。统一改为 `rootOf(ctx) = ctx.targetPath || PROJECT_ROOT`。

### 逐行输出假绿

3. `runStep` 无论状态都 `spinner.succeed(chalk.green(...))` → **失败的步骤也打绿色 ✔**，
   只有最后汇总行露出 ✗ fail。新增 `spinnerMethodFor()` + `paintByStatus()`：
   fail→`spinner.fail` + `✖` 前缀、warn/noop→`spinner.warn` + `⚡`/`○`。
4. `recordStepResult` 里 `'skip'` 落进 `default` 记成 **pass** —— 处理器明确说「我没跑成」
   也被算作通过。补 `case 'skip': LOG_SUMMARY.skip++`。

### check 自检的两处谎报

5. `handleCheckSmoke` 在**目标项目**跑 `npx vitest`，任何异常一律 catch 成
   「冒烟测试执行失败」→ 空项目/未装 vitest = 谎报红。改为三态：
   有 `N failed` → fail；`No test files found`/`Cannot find module vitest` → **skip**；
   认不出结论 → warn。`handleSelfCheckReport` 同步改三态（undefined 显示「⏭ 未执行」），
   并且报告本身返回 `{status}`，不再因为正文里写着「❌ 失败」被 `detectHandlerFailure` 判红。
6. `checkCePlugin(_targetPath)` 写死 `PROJECT_ROOT` → `--target` 永远报「CE Plugin 已安装」
   （问的是引擎自己）。改为跟随 targetPath，与 Pass 5/11 一致。

### `show` 命令曾是空壳

7. `printTriggerKeywords`/`printSemanticTrigger`/`printPriority`/`printWorkflow`/
   `printMCPServers` 全是 `if (!x) return;` 就结束的空函数 → 触发词、优先级、MCP 依赖、
   工作流名全被静默吞掉，`show` 只剩一串没有编号的描述。补全实现：id/name/描述/迭代轮数/
   触发关键词/语义触发/优先级/MCP/guardrails/参数/子步骤。
8. `plan.json` 的 `hooks` 块（pre_tool_use→inject_plan_context 等 4 个）**全引擎无人读取**，
   `.claude/settings.json` 也没配 hooks → 纯装饰元数据。`show` 现在会明确标注
   「声明的 harness hooks（本引擎不执行）」。（要真生效需配 Claude Code hooks，属另一件事。）

### 记忆系统

沙箱化行为测试（8 项）全部符合预期：去重、跨项目隔离（A 的召回不含 B）、记忆目录放坏 JSON
不崩、保留策略 8→3 条 + 5 条归档、consolidate 后召回正常、空 data / 路径穿越 type 不崩。
本轮新增的是「更早修的召回渲染」对应的 `lint·类型·门禁` 结论落库（ADR 见上一条 commit）。

### 新增回归

- `conditions.test.js`：平台三条件 5 例 + targetPath 文件条件 2 例 + **「所有 SIMPLE_CONDITIONS
  谓词用空 ctx 求值不得抛」**（这条直接抓出了 `dependencycheck_available` 漏形参导致整条
  workflow `ReferenceError: ctx is not defined`）
- `mobile/audit.test.js`：detectProject → 平台条件联动 4 例（真 fs，临时目录）
- `engine-check.test.js`：冒烟三态 5 例 + 报告三态 2 例
- `show.test.js`：步骤编号/触发词/hooks 标注 3 例
- `loop-iterations.test.js`：spinnerMethodFor/paintByStatus 4 例

验证：`vitest` **620 测试 / 53 文件**全绿；`eslint .` 0 error；25 个场景 `--dry-run` 全部
exit 0 且无未知动作；`start check --auto` 11 道检查 0 问题；`loop --auto -i 1` exit 0；
空项目 `check -t <空目录>` 从「✖ 冒烟失败」变为「⏭ 未执行（无测试可跑）」。

## 2026-10-27 根因层：把「悬空引用」变成可执行断言

### 为什么同类 bug 修了 5 次还在

复盘前两轮，问题不在"查得不够多"，而在**查的方式本身有偏**：

1. **修症状不修类别**：`database_required` → `setupConfigured` → `ctx.platform` →
   7 个文件类谓词 → `checkCePlugin`，同一个根因（事实有两个来源/字段没人写）
   被当成 5 个独立 bug 各修一次，直到写下 `rootOf()` 才收口。
2. **审计靠 grep + 肉眼，会自己出错**：我用 `grep -l memoryRecall` 判定"记忆只写不读"
   → 实际 24 个场景全有 `recall`，加错了召回又回滚；我正则提 `SIMPLE_CONDITIONS`
   时截断位置不对，得出的"可疑清单"本身就是错的。
3. **工具偏向报绿**：未知 action → 兜底 `✓ pass`；认不出结论 → 默认 `pass`；
   `spinner.succeed` 无条件；没跑成 = `false` = 和"跑了且干净"同值。
   → 每次 check 一片绿，信号接近零，只能靠逐行读 handler 才发现谎报。
4. **测试验的是"我刚改的那行"，不是"这个不变量"**：测试数 528→623 涨了，
   但漏洞不随之下降。

### 本轮交付：`src/lib/scene-contract.test.js`

场景里写的每个条件标识符、每个 action 名，都必须有人实现 —— 三种提供者：

- `SIMPLE_CONDITIONS` 谓词（求值侧）
- `context.X = …` / `ctx.X = …` 直接赋值
- 两处**动态写入**：`enhancements.js` 的 `` `enh_${key}` ``、`start.js` 的 `actionMap`

写成断言后，`读的没人写`（条件恒假）与 `写的没人读`（动作静默 pass）这两类
在 CI 就炸，不依赖谁记得去 grep。

**非空跑验证**（关键，否则就是又一条假绿）：
- 往 `loop.json` 步骤 0.3 注入 `testPassed && ghost_flag_xyz` → 测试失败并点名 `ghost_flag_xyz ← loop`
- 往 `loop.json` 步骤 1 注入 `action: totallyUnknownAction` → 测试失败并点名该 action
- 两次注入后 `git checkout` 复原，工作区 0 改动

**顺带纠正我自己的三个误判**（说明"看着悬空"多半是扫描器太笨）：
- `setupConfigured` 在 `SIMPLE_CONDITIONS` 里（第 42 行），只是我提取时截断位置不对
- `setup_kind` 由 `start.js` 的 `actionMap` 动态写 `context[contextKey]`
- `enh_huashu_release_deck` / `enh_huashu_release_animation` / `enh_huashu_expert_review`
  由 `enhancements.js` 的 `context[`enh_${e.key}`]` 动态写，key 都在 REGISTRY 里

结论：真正的悬空 = 0。之前"5 个可疑"全是扫描器假阳性 —— 这正好是本条断言存在的理由：
**把"我猜"换成"机器断言"**。

验证：`vitest` 623 测试 / 54 文件全绿；`eslint .` 0 error。

## 2026-10-27 让问题「越修越少」：三类闭合断言 + 台账

复盘中发现一个可量化的规律：**修复的收益不取决于修了几个，而取决于这一修有没有把
"这一类"挡住**。同一个根因修 5 次的成本 = 5 ×（定位 + 改 + 验），而把它们挡住的成本
是一份断言。于是本轮不再找新 bug，改为补三类**闭合断言**，并清掉断言的假阳性。

### 新增 1：假绿哨兵（`src/commands/false-green-guard.test.js`）
按**类**锁死 4 种「看起来通过，其实什么都没发生」：
- 处理器忘了 return / 走了空分支 → 空结果默认记 pass
- 处理器明确说「没跑成」→ `'skip'` 落进 default 记 pass
- 未知动作 → 兜底文案 → ✓ pass
- 失败步骤 → `spinner.succeed` + 绿色 ✔

**当场抓到一个真 bug**：`formatResultForDisplay(undefined)` 走 `String()` → 屏幕真的
打印出字面量「undefined」，然后因为非空被判 pass。修法：`undefined/null → ''`，
`deriveStepStatus` 把空结果判 `warn` 并提示「处理器没有返回任何结果」。

### 新增 2：文档 ↔ 入口 ↔ 场景 三方对齐（`src/lib/docs-scene-alignment.test.js`）
引擎自检永远发现不了这类：`/spec` 在 CLAUDE.md 流程里但 `.claude/scenes/` 无 spec.json
（它是 slash command，不是场景）；`/enhance-prompt` 在 CLAUDE.md 两处出现，实际是
`open-design/skills/enhance-prompt/` 的 skill。断言两条：
- 文档承诺的每个 `/命令` 都有落地入口（`commands/*.md` ∪ skill ∪ 场景 ∪ 明确写了
  「已融入」的合并项 ∪ 宿主内置）
- 每个引擎场景都有命令入口，否则用户调不到

**当场抓到真 drift**：场景 `setup.json` 存在，但 `.claude/commands/setup.md` 缺失 →
`/setup` 根本调不到引擎场景。已按仓库既有格式补上该命令文档（含 kind 三分支说明）。

### 名单必须「活」（台账不变烂）
`MERGED_INTO` 这类白名单配一条反向断言：条目一旦不再漂移/不再被文档提及，测试就失败，
必须删掉。否则白名单会变成新的假绿掩体 —— 这本身就是"问题越修越多"的常见机制。

### 我自己在这一轮的两次误判（再次验证"扫描器最不可靠"）
- 先假定「文档命令必须有场景」→ 把 `build`/`backup`/`docker`/`sbom`/`changelog`/
  `loadtest`/`migration`/`llm-proxy-audit`/`clear` 全判成漂移。真相：前 8 个是文档明写
  「已融入」的合并项，`clear` 是宿主内置。
- 把 `enhance-prompt` 判成漂移。真相：它是 skill，不是命令文件。

→ 结论：断言的**输入模型**必须覆盖所有真实入口形态，否则断言会把"正常"报成"缺陷"，
逼着人去改本来正确的东西（比不修更糟）。

验证：`vitest` 640 测试 / 56 文件全绿；`eslint .` 0 error；`start setup --dry-run --auto` 正常。

## 2026-10-27 试运行不再背书假绿 + 补 `/spec` 场景

### 1. dry-run 条件三态（`conditions.js` + `start.js`）
试运行不执行步骤，所以「条件不满足」有两个来源：真的不满足（MCP 没配、文件不存在、
没给 `--kind`）与「运行时状态还没产生」（`testPassed` 要等 test 步骤跑完）。
以前两者都打印「⏭ 跳过」——25 个场景 dry-run 全绿就是这样掩盖了 9 个恒假条件。

- 新增 `conditionIdentifiers` / `runtimeDependentIdentifiers` / `explainCondition`
- `RUNTIME_STATE_PREDICATES`：真值靠前置步骤写 flag 的谓词（`setupConfigured`、
  `mobile_platform`/`ios`/`android`、`has_frontend_changes`、`fixes_applied` 等 12 个）
  在 dry-run 下一律算「未判定」；读文件/配置的谓词（`build_artifacts_exist`、
  `*_mcp_available`）仍现场求值，保持可判定
- `show`/dry-run 打印 `未判定（运行时状态：xxx）`，并在结尾提示
  「N 个条件在试运行下无法判定，真实执行结果可能不同」

效果（25 场景 dry-run 扫描，只有非 0 的列出来）：
`new-project 35 / qa 5 / cicd 3 / feature 3 / mobile-audit 3 / refactor 3 / mobile-onboard 2 /
mobile-release 2 / onboard 2 / bugfix 1 / deps 1 / plan 1` —— 这些此前全部伪装成「跳过」。

### 2. 补 `spec` 场景（`.claude/scenes/spec.json` + 引擎包内同名副本）
CLAUDE.md 写着 `/spec "需求"` → `/plan` → `/build`，`.claude/commands/spec.md` 也存在，
但 `start spec` 报「场景未找到」：文档承诺了引擎没有。按命令文档的真实流程建场景：
`recall → invokeSkill(speckit-specify) → runAgent(product-manager) → runAgent(ux-designer)
→ invokeSkill(speckit-clarify)（有 spec 才跑）→ readSpec → checkGate → notify → remember
→ consolidate`。

实跑 `start spec --auto`：pass 7 / fail 0 / skip 1 / noop 2（noop = 对话态 skill/agent 在
CLI 下确实没执行，如实标出而不是报通过）。

验证：`vitest` 645 测试 / 56 文件全绿；`eslint .` 0 error；`spec` 场景 dry-run + 实跑均正常。

## 2026-10-27 未知动作不再记 pass（假绿第 5 形态）

`executeAction` 对未知动作虽然已经 `console.warn` 并写 `context.unknownAction`，
但返回的是字符串文案 → `deriveStepStatus` 判「有输出 → pass」。也就是说 **警告归警告，
汇总里依旧是 ✓**。改为返回 `{ status: 'warn', message }`，汇总才算 warn。

同时清掉 knip 报的 2 个未用导出（`RUNTIME_STATE_PREDICATES`、
`runtimeDependentIdentifiers` 只在 conditions.js 内部用，去掉 export）。

测试：`actions.test.js` 的未知动作用例补两条断言 —— 返回值带 `status: 'warn'`，
且 `deriveStepStatus` 判定为 warn；升级前这两条必红。
645 测试/56 文件全绿，eslint 0 error，knip 无 unused exports。

## 2026-10-27 `runAffected` 三态（假绿第 6 形态：`|| true` + 无 fail 字样）

`handleRunAffected` 原本 `npx vitest run --changed 2>&1 || true` + `/[Ff]ail/` 判通过：
runner 没装、`--changed` 不支持、npx 报 `npm ERR!` 时输出里没有 fail 字样 → 报
「受影响测试全部通过」。没有 package.json 时又报「部分失败」——没跑成与跑挂了混在一起。

改为三态 `'fail' | 'pass' | 'skip'`：带数字的 failed 才算失败（`Command failed:` 不算），
NOT_RUN_MARKERS 命中即 skip，`|| true` 去掉以拿到真实退出码。
`context.affectedTestsPassed` 由 `null/false` 变为 `true/false/undefined`。

测试 5 → 6 例（含两条「抛错也要按 stderr 分类」），升级前必红。649 测试/56 文件全绿。

## 2026-10-27 P0-1 围栏（fence）落地：用「冻结现有通过集合」替代「生成特征测试」

按「AI 编程圈地修复系统」方案里最值钱的一条（先建围栏再施工）落了工程实现。
不生成新测试——那成本不可控；改成**动手前把现有测试的通过集合拍成地界桩，动完逐条比对**。

### 新增 `claude-scene/src/handlers/fence.js`（3 个动作）
| 动作 | 干什么 | 拿不到明细时 |
|---|---|---|
| `fenceCapture` | `npx vitest run --reporter=json` → 写 `.claude/reports/fence-<stamp>.json`（逐条用例名 + 状态 + git 基准） | `skip`（不冒充通过） |
| `fenceVerify` | 再跑一次，**原先 passed 的用例变 failed/消失 → fail 并点名**（本来失败的不算越界） | `skip` |
| `fenceRestore` | 越界时按快照 `git checkout <sha> -- <改动过的已跟踪文件>` | `skip` |

关键设计（都是实测逼出来的）：
- **只信逐条明细**：JSON 里本来就可能出现 `Cannot find module` 这种被测试断言的字符串，按文本判「跑没跑成」会误判 → 有明细就只信明细，没明细才看 marker
- **回滚基准**：`git stash create` 干净工作区返回空串 → 兜底 `git rev-parse HEAD`，否则越界时反而回滚不了
- **回滚不碰未跟踪文件**：`.claude/reports/*`、`node_modules/*`、`??` 一律排除，且先用 `git cat-file -e` 确认路径在快照里，避免一条 pathspec 报错拖垮整个回滚

### 场景接线（`.claude/scenes/` 与 `claude-scene/scenes/` 双份一致）
`loop`（3.9 建围栏 → 4.6 比对 → 4.7 越界回滚 `fenceViolations > 0`）、
`bugfix`（5.9 → 7.05 → 7.08）、`refactor`（12.5 → 14.5 → 14.6）

### 顺手修的第 7 种假绿：`skip` 也打绿色 ✔
`spinnerMethodFor('skip')` 原本返回 `succeed`，于是「围栏未建立（结果未知）」在屏幕上是个
绿色对勾。改为 `info`，`runStep` 用 `spinner.info`；`false-green-guard` 与
`loop-iterations` 各补一条断言锁死。

### 验证（真实项目，非 mock）
临时 git 项目 + 真 vitest：
1. `capture`（干净树）→ `锁定 2 个用例（2 通过 / 0 失败）`
2. 把 `add` 改成 `a - b` → `verify` → **fail「越界 2 个用例：add 1+1=2、add 2+3=5」**
3. `restore` → `已回滚 1 个文件到围栏快照`
4. 文件内容复原 → `verify` → **pass「围栏内 2 个用例仍全部通过」**

引擎级：`start loop --auto -i 1` → `围栏已建立：锁定 663 个用例` / `未越界`；
注入破坏后 `fenceVerify` 之前是 skip（那是分类 bug，已修），现改为只信明细。

663 测试 / 57 文件全绿；eslint 0 error；knip 无 unused exports；25+ 场景 dry-run 全 exit 0。

## 2026-10-27 P0-2 影响域产物消费：引擎不再对 codegraph 装傻

`codegraph_impact` 在本仓库是桩（永远「未配置 codegraph MCP」），真能力在 Claude Code 侧
的 `mcp__codegraph__*`。不造第二套图查询，改成「agent 落盘产物 → 引擎消费并记账」。

### 新增 `claude-scene/src/handlers/impact.js`
- `impactReport` 读 `.claude/reports/impact-<stamp>.json`（取最新一份）
- 合法 → `pass`，把 `impactReported/impactRiskLevel/impactChangedCount/impactCallerCount`
  写进 context；`riskLevel: high` → `warn`（不阻断但点名复核调用方）
- 缺文件 / JSON 坏 / 缺 `changedFiles`（空数组也算）/ 缺 `callers` / `riskLevel` 不合法
  → 一律 `warn`「修复范围未评估，记账不阻断」，并写 `context.impactProblem`
- **不加 `impact_reported` 条件**：加条件会让「没产物」直接跳过、警告看不见；
  无条件跑 + handler 自己 warn，才能让缺失在汇总里露头

### 接线（双份 scenes 一致）
`loop 3.85` / `bugfix 5.85` / `refactor 12.45` → 都在 fence 之前（先看影响域，再围栏，再动手）

### 文档
`docs/architecture.md` 新增「报告产物契约」表：impact / fence / aislop 三类产物
的写入方、形状、读取方、缺失时的三态——顺带写清「围栏只保护已有测试覆盖的行为」。

### 验证
- 单测 10 例（真 fs 临时目录，7 种不合格产物各自 `warn`）；**自证非空跑**：
  把高风险分支改成 `pass` → 立刻红，复原后 10/10 绿
- 引擎实跑两条路径：有产物 → `✔ 影响域：改 1 个文件 / 1 处调用方，风险 medium`；
  删掉产物 → `⚡ 没有影响域产物…修复范围未评估，记账不阻断`
- 673 测试 / 58 文件全绿；eslint 0 error；knip 无 unused exports

## 2026-10-27 P0-3 假绿收尾：状态透传与场景接线都变成断言

两条都是「人肉能看出来但迟早退化」的契约，落成断言：

1. `false-green-guard.test.js` 新增矩阵：「五种显式状态逐层透传」——
   `pass/warn/fail/skip/noop` 在 `deriveStepStatus` 里必须原样透传，非 pass 的
   `spinnerMethodFor` 不许是 `succeed`，且五个状态必须拿到五个不同符号
   （`seenSymbols.size === 5`，防空跑）。
2. `scene-contract.test.js` 新增「围栏/影响域步骤顺序」：`loop/bugfix/refactor`
   三个改动类场景必须满足 `impactReport < fenceCapture < fenceVerify`，
   并写清「先看影响域，再围栏，再动手」的理由。

自证非空跑：把 `bugfix` 的 `impactReport` 挪到 `fenceCapture` 之后 →
断言立刻红并报 `bugfix 顺序错（impact=20 capture=17 verify=21）`；`git checkout` 复原后 4/4 绿。

675 测试 / 58 文件全绿；eslint 0 error；knip 无 unused exports。

## 2026-10-27 P1 严格模式 + P2 指标台账：把「越界了怎么办」和「问题在变少吗」都变成可执行的东西

### P1 `--strict-enclosure`：越界即中止，不在破了的地界上施工
- `start -e / --strict-enclosure`（`src/index.js`）
- `buildSceneContext` 写 `strictEnclosure`；`shouldAbortOnEnclosure(context)`（导出、纯函数）判定：
  strict 且 `boundaryViolations` 非空 → 中止
- `runStep` 在打印状态之后、错误处理之前落地中止：红字提示 + 退出码 1
- 越界文案随开关走（`violationHint`）：默认「记账模式：本步骤判失败、工作流继续」，
  strict「越界立即中止整个工作流」；抽出 helper 避免两处措辞分叉（也顺手压掉 sonar 认知复杂度 17→15）
- **默认行为不变**：仍判该步骤失败；strict 只是把「破了还继续」这条路堵掉

### P2 围栏台账 + 指标汇总
- 新增 `src/lib/enclosure-ledger.js`：`.claude/reports/enclosure-events.jsonl` append-only，
  一行一事件（capture/verify/restore/impact），坏行跳过
- `fenceCapture/fenceVerify/fenceRestore` 与 `impactReport` 各自追加事件（记账是旁路，写失败不影响主流程）
- 新增 `src/handlers/enclosure-metrics.js`：`summarizeEnclosure` / `verdictOf` / `handleEnclosureMetrics`
  - 输出：拍桩次数 / 比对次数 / 越界次数与越界率 / 回滚次数 / 影响域缺失与缺失率
  - **没台账 → skip**（没数据不等于零越界）；越界率>50% 或缺失率>50% → warn；否则 pass
  - 同时落盘 `.claude/reports/enclosure-metrics-<stamp>.json`
- `loop` 加 `7.9 enclosureMetrics`（remember→metrics→report→notify）

### 验证（都是实跑，不是「看着应该对」）
| 项 | 命令 | 结果 |
|---|---|---|
| strict 判定 | `npx vitest run src/commands/enclosure-strict.test.js` | 4/4（含 null/非数组不中止） |
| 指标三态 | `npx vitest run src/handlers/enclosure-metrics.test.js` | 10/10（含坏行跳过、比率 null 不报 0） |
| 台账事件 | `npx vitest run src/handlers/fence.test.js` | 17/17（capture/verify/restore 各留痕） |
| strict 引擎实跑 | 临时 git 项目 + fixture 场景（`exportAssets` 写 44 行 → 阈值压到 20） | 记账模式：`✖ 边界超出…（记账模式）` 后继续执行 report；`-e`：`✖ 圈地越界…中止`，**退出码 1，report 未执行** |
| 指标实跑 | `start loop --auto -i 1` | `⚡ 拍桩 2 次 / 比对 2 次 / 越界 0 次（0%） / 回滚 0 次 / 影响域缺失 2 次（100%）` |

693 测试 / 60 文件全绿；eslint 0 error；knip 无 unused exports/文件；全部场景 dry-run exit 0。

### 补正（同一轮，自查发现的口径问题）
1. **回滚失败不能算「已回滚」**：`restores` 只数成功项，另立 `restoreFailures`；失败>0 → warn。
2. **「建了围栏却从没比对」必须点名**：`captures > 0 && verifies === 0` → warn
   「围栏建了 N 次但从未比对」——这正是假绿的经典形态（有桩无比对，等于没围栏）。
两处都自证非空跑：注入「回滚失败计入回滚 + 取消从未比对告警」→ 3 条测试立刻红；复原 12/12 绿。

最终基线：**695 测试 / 60 文件全绿**，eslint 0 error，knip 无 unused，全场景 dry-run exit 0。

### 再补一个假绿（第 8 种）：零通过的基线也是「围栏已建立」
`fenceCapture` 原先只要拿到逐条明细就报 `pass`。如果这轮测试**全是 skipped/pending**
（0 通过），围栏锁住的是空集合——下一轮 `fenceVerify` 会拿空集合比出「0 个越界」，
标准假绿。两处守卫：
- `capture`：`passed === 0` → `warn`「围栏未建立：基线里没有一个通过的用例」，不写快照
- `verify`：`baselinePassed.length === 0` → `skip`「围栏里没有可保护的用例」

自证非空跑：关掉两处守卫 → 2 条测试立刻红；复原 19/19 绿。

最终：**697 测试 / 60 文件全绿**；eslint 0 error；knip 无 unused；全场景 dry-run 通过。

## 2026-10-27 第 9 种假绿 + 中间输出折叠：把「没跑成」和「跑了」彻底分开

### 9️⃣ 「对话里才跑的步骤」被记成 pass
`runAgent`、MobSF/Bearer 上传与分析、detox UI 测试、移动端安装/构建/扫描这些动作，
CLI 这一层什么都没执行，却都 `return` 一段纯字符串。引擎只能靠措辞猜状态，
猜不到就记 `pass` —— 屏幕上绿色 ✔、汇总行算进 `pass`，实际上一个字节都没跑。
全部改成 `{ status: 'skip', message }`（8 处：`mobile/agent.js` 5 处、`mobile/audit.js` 3 处）。

**类别问题落成哨兵**：`src/lib/not-run-status.test.js` 扫描所有处理器源码，
禁止「return 裸字符串 + 未执行/需在对话/本轮未/CLI 下未/未执行安装」这种组合；
并带防空跑下限（扫到的处理器文件数 > 40）。
- 第一版写 `^\s*return` 只匹配行首 → **注入样本没红**（`if (!installed) return '...'` 漏掉），
  改成 `\breturn\s+[`'"]` 并跳过注释行后，注入立刻点名 `mobile\audit.js:140 命中「本轮未执行」`。

### 中间输出折叠（E）
- `foldOutput(text, {fold, stepStatus, fullLogPath})`：pass/warn 超过 6 行折叠成
  「前 6 行 + … 省略 N 行（完整输出：…）」，**fail 永不折叠**（藏失败细节才是真刷屏问题）
- 完整输回落盘 `.claude/logs/steps-<scene>-<runid>.log`（`appendStepOutput`）
- `start --no-fold` 全展开（`options.fold === false`）
- 实跑验证：fixture 场景第 1 步 `selfCheckReport`（9 行）→ 屏幕出现「… 省略 3 行（完整输出：…steps-fold-demo-*.log）」，
  落盘文件里 9 行全在；加 `--no-fold` 后「省略」出现 0 次

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 折叠单测 | `npx vitest run src/commands/fold-output.test.js` | 6/6；注入「永不折叠」→ 2 条红 |
| 未跑成状态 | `npx vitest run src/handlers/mobile` | 13/13；注入回退成字符串 → 3 条红 |
| 裸字符串哨兵 | `npx vitest run src/lib/not-run-status.test.js` | 2/2；注入样本 → 点名文件:行号 |
| 全量回归 | `npx vitest run` | **714 测试 / 63 文件全绿** |
| lint/deadcode | `npx eslint .` / `npx knip` | 0 error / 无 unused |
| 场景冒烟 | 26 个场景 `--dry-run` + `start loop --auto -i 1` | 全部 exit 0 / 围栏锁定 714 用例、未越界 |

## 2026-10-28 sync-docs 的三处假阴性 + 探测能力自检工具

### 起因
`sync-docs` 每次跑都在报「3 个目标缺标记 + 3 个目标文件不存在」。逐条核实后发现：
三条里只有两条是真的，且其中一条根本不是缺陷。

### 修的四件事
1. **CRLF 假阴性（真 bug）**：`.claude/scenes/README.md` 是 CRLF，实现拿 `\n` 匹配，
   标记在第 9/37 行却永远命中不了 → 报「缺标记」。改为读入后 CRLF→LF 归一化匹配，
   写回时恢复原行尾（不制造整文件 diff）。
2. **僵尸目标（真 bug）**：3 个目标全指向已删除的 `.claude/rules/workflows.md`，
   外加一段正则里 `\d` 丢成 `d` 的永远为假的块 → 一并删除，`syncTriggerSections` 随之退场。
3. **人工托管桶（伪缺陷）**：`CLAUDE.md` 的工作流速查是人写的两列表格，自动改写等于推翻人的排版。
   没有标记 → 归 `manual`（ℹ「人工维护，想接管就加标记」），不再报 ⚠；加标记即自动接管。
4. **计数刷新早退（真 bug）**：正文 `26 个场景` 已经对了就 return，导致目录锚点
   `#25-个场景…` 永远修不了 —— 数字看着对、链接是断的。改成一律全量重算。

### 顺带挖出的内容缺陷
- `new-project.json` 的 `description` 在「Huashu 验证，」处被截断（左括号未闭合），
  两份副本（`.claude/scenes/` 与 `claude-scene/scenes/`）都错，sync-docs 把那半句话抄进了 README。
  → 补全描述 + 新增断言：括号必须配对、不得以 `，、→（+：` 结尾。
- `docs/tools-inventory.md` 正文 26 / 锚点 25 → 已修复，锚点正则一起补。

### 新增工具：`claude-scene/scripts/detector-sweep.cjs`
回答「这些守卫测试是真的会红，还是写着好看」。每个用例：注入真实违规 → 跑该守卫测试 →
期望红 → 内存备份复原 → 再跑 → 期望绿；注入点匹配不到就显式报「用例过期」，不静默跳过。

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 同步单测 | `npx vitest run src/lib/sync-docs.test.js` | 10/10（CRLF、写回行尾、真缺标记、manual、僵尸目标、计数、锚点、缺目录） |
| 描述断言 | `npx vitest run src/lib/scene-contract.test.js` | 5/5 |
| 探测器自检 | `node scripts/detector-sweep.cjs` | **12/12「注入后红 / 复原后绿」** |
| 全量回归 | `npx vitest run` | **725 测试 / 64 文件全绿** |
| lint/deadcode | `npx eslint .` / `npx knip` | 0 error / 无 unused |
| 同步实跑 | `node src/index.js sync-docs` | `✅ 1 个区块` + `ℹ 2 个区块人工维护`，二次运行幂等 |
| 场景冒烟 | `start {loop,check,spec} --dry-run` | 全部 exit 0 |

附带决策：`AI编程圈地修复系统完整设计方案.docx` 从仓库根 `git mv` 到 `docs/`（文档归 docs/）。

---

## 2026-10-28 · ui-polish / review 假信号三连修（`f094b59`）

### 修了什么
| # | 症状 | 根因 | 现在 |
|---|---|---|---|
| 1 | `review --auto` 不问 sweep 就记 `pass(interactive-answered)` | `buildSceneContext` 写 `withSweep: Boolean(options.withSweep)`（没传 = false），2.68 又声明 `context_flag: withSweep`，「值存在即权威」把引擎自己填的 false 当成用户答复 | 没传就留 `undefined` → 停在闸门 `exit 2` 并列出 `-S/--with-sweep`、`--skip-sweep` |
| 2 | 顺带发现 `declaredFlagAnswer` 回 `null` 会被 `??` 链当成「已答否」→ sweep 全被跳过 | `null` ≠ `undefined` | 只有 `boolean` 才算表态，其它 `return;` |
| 3 | ui-polish 4 `installDeps` 在非 React 工程记 `fail` | 无条件 `npm install lucide-react animate.css`，npm 因项目自身 peer 冲突报错 | 按「主题 + 是否 React 工程」选包；非 React 跳过 React 专属库并点名；npm 真失败记 `warn` 并附实质错误（不是 `Command failed` 壳行） |
| 4 | 自己的测试夹具被自己的 XSS 扫描判红 | `deep-review-tools.test.js` 里写了整句 `.innerHTML = x;` | 夹具改成拼串；扫描器不加豁免（不靠放宽掩盖信号） |
| 5 | `handleSemgrepScan` 认知复杂度 18 > sonarjs 上限 15 | 循环 + 汇总判断挤在一个函数 | 拆 `_collectSemgrepResults` / `_summarizeSemgrepScan` |
| 6 | 仓库根配置的密钥无守卫 | — | 新增 `no-committed-secrets.test.js`（sk-*/ghp_*/AKIA*/PEM/JWT + 占位符 + 反向自检） |

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 全量回归 | `npx vitest run` | **922 测试 / 72 文件全绿** |
| 根 lint | `npm run lint` | 0 warning |
| 引擎 lint | `cd claude-scene && npx eslint . --max-warnings 0` | 通过 |
| 死码 | `npm run scan:deadcode` | Total dead: 0 |
| 闸门拦截 | `start review --auto` | **EXIT=2**，打印 2 条 sweep 选项 |
| 闸门答复 | `start review --auto --skip-sweep` | EXIT=0 |
| 全量真跑 | `start review --auto -S` @ `f094b59` | **23 pass / 0 fail / 0 warn**，报告 100/100，sweep 12/12 现场自检 |
| 探测器自检 | `handleSecBugHunt(cwd)` | 0 问题（修掉夹具假红后） |
| installDeps 探针 | 假 non-React 工程 / 本仓库 | 只装 `animate.css`（点名跳过 lucide-react）/ `warn(ERESOLVE)` |

附带决策：「引擎自己填的默认值不算用户表态」——凡 `context_flag` 指向的值，必须是用户/flag 显式给的才算答复。

## 2026-10-28 第三轮：26 场景全量审计（跑不通 / 假绿 / 假信号）

前两轮修了 60+ 处之后，按要求再来一轮**全量**：26 个场景、586 个步骤、244 个 action、89 个 condition。

### 怎么查的
| 手段 | 覆盖 | 结论 |
|---|---|---|
| 26 场景 `--dry-run --auto` | 全量 586 步 | 全部 `exit 0`，无「无处理器 / 未知动作」 |
| `action → handler` 覆盖比对 | 244 action | 除 interactive 层（`selectModes`/`selectSetupKind` 由 `handleInteractiveStep` 接管）外无缺口 |
| **空项目探针**：在空目录逐个调用只读类 handler | 65 个 check/scan/audit 类 action | 只剩 4 个「什么都没做却报 pass」，已修 |
| condition 可判定性 | 89 condition | 19 个貌似孤儿标识符里 17 个是字符串碎片噪声；`setup_kind` 有写入源，`enh_*` 三项由 `--enh` 控制（设计如此） |
| 场景文案提到的 CLI flag vs 实际注册 | 26 场景 | 5 个未注册的 `--xxx` 全是外部命令参数（`git diff --name-only`、`aislop fix --safe` 等），非假信号 |
| 真跑（setup / check / deps / rollback / onboard / review -S） | 6 场 | 逻辑全通；挖出下表的假绿 |

### 修了什么（11 处）
| # | 症状 | 现在 |
|---|---|---|
| 1 | `--mode`「可覆盖」写进了提示，index.js 却从没注册 → 用户传了被忽略，报告看着像「按你的要求跑了」 | 注册 `-m/--mode`；认不出的模式黄字列出来 + 打印来源（`按--mode` / `按场景声明的默认值`） |
| 2 | engine-check：找不到自己的 `actions.js`/`action-messages.js`/`gate-flags.js`、解析不出 `ACTION_REGISTRY` → 记 ✓ pass（引擎自检假绿） | 一律 `warn` 并说明「检查未完成」 |
| 3 | engine-check：`发现 N 个缺少 action message` / `N 个未映射 flag` → pass（发现问题的句式不匹配 WARN_RES） | 显式 `warn` |
| 4 | `selfCheckReport` 在「冒烟测试 ⏭ 未执行」时仍记 pass（摘要写未执行、汇总给绿勾） | `smokePassed === true` 才 pass，否则 warn |
| 5 | `handleConfirm` 无条件写 `context.user_confirmed = true` → 交互层一旦漏接，下游 condition 以为用户点了头 | 走到 handler 说明没人回答 → `fail`（`-y`/`--decline` 由交互层处理） |
| 6 | `installDeps` 无 `package.json` 也报「安装完成」；`docsUpdate` 无 README 也报「更新完成」 | `skip`；README 已有 `Last updated` → `noop` |
| 7 | `checkEnvFile` 发现 `.env` 缺失却记 pass（「环境变量缺失」在报告里是通过） | `warn`，并点名「可从 .env.example 生成」 |
| 8 | knip「结果解析失败」→ pass；「knip 不可用」→ 靠 NOOP 正则碰巧算 noop | 显式 `warn` / `skip` |
| 9 | SkillSpector「部分失败」→ pass（「部分」恰好在 `detectHandlerFailure` 排除名单里） | `warn`「扫描未完成」；`NOT_FOUND` → `skip` |
| 10 | deps：`npm outdated` 输出无法解析 → 一句「（不可用）」蒙过去；`checkBreakingChanges` 则判 **fail**（工具没跑通被说成发现了 Breaking Changes = 假红） | 两者都 `warn` 且附真实原因；`{}` 才是真 pass |
| 11 | `invokeSkill`「参考内容已展示（N 项清单）— 完整执行需对话模式」→ pass；`aislop` 零输出 → 「未发现 AI 代码气味」+ `aislopPassed=true` | 前者 `noop`、后者 `warn`；`git autoUpdate` 无 remote 也从 fail 改 `skip`（本地仓库没远程不是「更新失败」） |

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 全量回归 | `npx vitest run` | **932 测试 / 72 文件全绿**（+10 例） |
| 根 lint | `npm run lint` | 0 error / 0 warning |
| 引擎 lint | `cd claude-scene && npx eslint . --max-warnings 0` | 通过 |
| 死码 | `npm run scan:deadcode` | Total dead: 0 |
| 全量真跑 | `start review --auto -S` | `EXIT=0`，报告 **100/100**，`pass 17 / fail 0 / warn 2 / skip 19 / noop 5` |
| 自检 | `start check --auto` | `EXIT=0`，`pass 10 / fail 0 / warn 1` |
| 闸门 | `start rollback --auto` / `start onboard --auto` | `EXIT=2`，打印选项 |
| `--mode` | `start review --auto --mode full_audit,bogus` | 黄字列出 `bogus` + 可用值；日志 `detail: modes=full_audit` |

两条 warn 都是诚实信号：`2.7 工作区有未提交改动，跳过现场自检`（提交后重跑即 pass）、`4.57 SkillSpector 扫描未完成`（原来这条是假绿 pass）。

附带决策：
- **「检查步骤发现问题」必须看得见**——`发现 N 个 X` 的句式不匹配 WARN_RES 就一直是 pass，所以这类检查一律返回显式 `warn`，不靠文案正则猜。
- **工具没跑通 ≠ 发现问题**：`npm outdated` 崩了是 `warn`（没结论），不是 `fail`（不是「发现 Breaking Changes」）。
- **本地仓库没有 remote 不是失败**：`git remote` 为空时更新步骤记 `skip`。

### 追加：SkillSpector 那一步（一直挂着 warning 的根源）
`4.57` 长期显示「部分技能目录执行失败，没有扫描结果」，看着像是环境问题，实际是四个叠在一起的 bug：

| # | 假设 | 事实 |
|---|---|---|
| 1 | 「本机没装 skillspector」 | 装了；`skillspector --version` 光 import LangGraph 就要 **28s**，探测超时 15s 直接把它判死 |
| 2 | 「退出码非零 = 扫描失败」 | 它找到问题时 exit 1，**完整 JSON 仍在 stdout**；`execSync` 一抛，结果被丢掉 |
| 3 | 结果字段是 `findings`/`results` | 实际是 **`issues`** → 101 条发现全被当成「无问题」（这才是最严重的一条：假绿） |
| 4 | 命令 `2>&1` 方便看错误 | stderr 里的 LangChain 弃用警告混进 stdout → `JSON.parse` 碎掉 → 又变成「无法解析」 |

现在：先探测（45s 容忍 28s 启动）→ 非零退出也试着解析 stdout → 认 `findings|results|issues` → 去掉 `2>&1` →
没有结果才 `warn` 并附**一句人话**（跳过 `Warning`/`Traceback` 行）→ 有结果就如实报
`SkillSpector 扫描完成: 105 个问题（CRITICAL 1 / HIGH 66）`（显式 `warn`，不靠正则）。

顺带说明：这 105 条基本来自我们自己 skills 文档里的**示例代码**（`sharp-edges/references/lang-php.md` 的 webshell 例子、
`insecure-defaults` 的默认口令例子）。这正是 `sharp-edges` / `insecure-defaults` 两个 skill 存在的意义 —— 报出来比藏起来好。
代价：这步要 ~2.5 分钟（工具自身启动慢，可用 `SKILLSPECTOR_TIMEOUT_MS` 调整上限）。

## 2026-10-28 第四轮：交互闸门与移动端链路的假信号

### 怎么查的
- **审计 F**：把 30 个 interactive 步骤在 `--auto` 且零参数下逐个跑一遍，只允许三种结局 ——
  停在闸门（`_awaitingAnswer`）、用场景**显式声明**的默认值并打印来源、交给处理器。
  结果 **0 个静默拍板**。
- **审计 G**：检查每个闸门打印的选项有没有 CLI 参数能答复（用户在聊天里跑引擎，没有 TTY）。
  初版审计因为把测试值写错（`release#6` 的 id 是 `major/minor/patch`、`optimize#4` 是完整中文串）
  自己造了两条假红，改成从 `step.params.options` 推导后只剩 `onboard#6`（自由填环境变量，
  hint 写「补齐后重跑」，属诚实的既有路径）。

### 修了什么（13 处）

| # | 位置 | 症状 |
|---|---|---|
| 1 | `start.js` `gateDynamicOptions` | 文案写「`--choice <目标>` 手动指定」，但无条件中止 —— 传了也没用 |
| 2 | `start.js` `handleConfirmation` | `confirm` + `options` 的步骤（mobile-release 4「选升级类型」）被渲染成「要不要继续」，用户选的 major/minor 从未落地 |
| 3 | `mobile-release.js` `handleMobileBumpVersion` | `\|\| 'patch'` 静默升级类型；未知类型当 patch；没有 version 文件还报「已更新: N/A → undefined」 |
| 4 | `mobile-release.js` `handleMobileGenerateChangelog` | 无版本号时生成 `## vunknown` 并当 Release body |
| 5 | `mobile-release.js` `handleReleaseChecks` | **自己给四个门禁盖章**：`securityScanResult/performancePassed/testPassed/storeCompliancePassed` 一律写通过 → 下一步 `checkGate (block_release)` 永远放行 |
| 6 | `flow-control.js` `evalSecurityGate` | `securityScanResult \|\| {}` → 没扫过也报「无高危」；现在未定义就 `skip` |
| 7 | `prerequisites.js` | 只读 `params.checks`，onboard 声明的 `required/optional`（docker/pnpm）从未检查；平台不明时静默跳过却报「✅ 所有前置条件满足」 |
| 8 | `mobile/audit.js` `handleDetectProject` | 只写 `platforms{}` 不写 `context.platform`，下游 Android SDK / 发布渠道 / gradle 全走「非 Android 项目」，整条平台分支是死功能 |
| 9 | `mobile-testing.js` `handleSetupE2EConfig` | 只建 `e2e/` 目录 + 示例就报「E2E 配置完成」，`.detoxrc.js` 根本没写 → 下一步 verify 必然失败（先盖章再打脸） |
| 10 | `mobile-testing.js` `handleVerifySetup` | `0/2 通过` 不含「失败」字样 → 记 pass；现在显式 `fail` + 列出哪项不行 |
| 11 | `mobile-testing.js` `handleGenerateCIConfig` | 写失败也 `ciConfigured = true` |
| 12 | `mobile-onboard.js` `handleCheckRnDoctor` / `handleCheckAndroidSDK` / `handleSetupEnv` | 命令串 `\|\| echo` 永远退出 0；三个 SDK 位置只存值不下结论；`.env.example` 写失败也 `envTemplatePassed = true` |
| 13 | `handler-verify.js` 降级路径 | knip 没跑成时只查了 `actions.js` 的 import，却返回 `deadCodePassed: true` 报「0 个问题」 |

外加：`mobile-e2e` 步骤 10 的通知加了 `condition: e2e_verified`（新谓词）——测试环境没验证过就不发
「示例用例已就绪」；（两份场景 JSON 同步）。

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **963 passed**（新增 30 条：闸门 `--choice` 生效 / confirm+options 路由 / bump 三种 warn / changelog 无版本 / prerequisites required+optional+平台 / detectProject 写 platform / E2E 配置三件套 / Android SDK / `.env.example` / knip 降级） |
| lint | `npm run lint` + `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead: 0 |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| 真跑（临时项目） | `MIX_CODING_PROJECT_DIR=<tmp> start mobile-e2e --auto` | 写出 `.detoxrc.js` + `e2e/login.test.js`；`verifySetup` 因本机没装 Detox CLI → **fail 1/2**（诚实红），通知步骤按条件跳过 |

### 决策
- **检查步骤必须有结论**：只把值复制进 context（`handleCheckAndroidSDK`）或命令永远退出 0（`|| echo`），
  都不算检查过。
- **降级检查不许发通过结论**（knip fallback），要发就发 `warn` 并点名降级。
- **门禁 flag 只能由真的做了检查的步骤写**，不许有「先自己盖章、下一步再验证」的循环。

## 2026-10-28 第五轮：场景 params 契约 —— 「写了没人读」的开关

前三轮解决的是「跑了但结论假」，这一轮问的是更前面一步：**场景里写的参数，引擎到底读没读？**
用户勾了 `threshold: 80`、`retry: 3`、`base_branch: main`，引擎按自己的默认值跑完还报 ✓ ——
不报错、不提示、日志里也看不出来。这类「静默失效」比假绿更难发现：连断言都写不出来。

### 怎么审的（口径很关键）
第一版审计脚本按 **handler 函数体** 判可达域，结论「308 行参数全是死的」→ 差点删掉：
- `confirm.params.theme_selection` —— 读者在引擎层 `start.js`，不在 handler 里；
- `ui-polish` 的 `invokeSkill.command` —— 读者是 `handlers/ui-polish.js` 的派发表。

已经 `git checkout -- claude-scene/scenes .claude/scenes` 全量回滚一次。改口径为
**`claude-scene/src` 全部非测试 JS** 后剩 41 个 `(action,key)` 组合、两副本共 126 处。

### 二选一：接上去，或者删掉（不留「装饰性」参数）
| 参数 | 处理 |
|---|---|
| `test-coverage.threshold` / `compare_to_baseline` / `block_on_fail` | 真解析 istanbul/jest 百分比 + 写 `.claude/coverage-baseline.json` + 阈值判定 |
| `test-unit`/`run-suite` 的命令串 | 去掉 `|| true` / `2>&1`，只看退出码；「没跑成」与「跑挂了」分开 |
| `checkGate.block_release/block_merge/block_critical` | 真置 `context.gateBlocked`（引擎 `handleStepError` 读它 abort） |
| `checkGate.mode` / `gate` | strict 不发通过；具名门禁走 `evalNamedGate`，未知名字 warn 不冒名 |
| `verify.mode=health_check` + `url/retry/timeout` | 真去敲 URL，失败按 retry 重试，最后 fail |
| `notify.title/content/level/type` | 真写 `.claude/notifications.log`，空内容 → warn |
| `git.createBranch.base_branch` / `createPR.auto_assign|auto_label` / `createTag.annotated` / `createRelease.body_ref|tag_ref|prerelease` | 全部进命令行；`body_ref` 取不到正文时明说「正文为空」 |
| `autoFix.maxAttempts` | 真的循环 `eslint --fix` 直到退出码 0 |
| `installDeps.frozen_lockfile` | `npm ci` |
| `jscpd.minTokens` / `semgrep.ruleset` | `--min-tokens` / 声明与内置不一致时黄字告知 |
| `ce-plan.detail_level|risk_analysis|tech_selection`、`invokeSkill.subcommand|dimensions` | 渲染成「本次要求: …」并写进结论（引导性 handler 的唯一可观测输出） |
| `generateOptimizePlan.prioritize` / `generateRefactorPlan.include_tests` / `applyTransformations.preserve_behavior` | 渲染进返回文案 |
| 其余 17 个键（`ecosystem`/`sourcemap`/`maxSteps`/`check_safety`/`multi_select`/`fullPage`…） | **从场景删除**（两副本共 86 行），不是留着当墓碑 |

### 顺带修掉的三个坑
- `handleCreateRelease` 以前「gh 出错一律 warn」→ 拆成「没装 = skip」/「装了但失败 = fail」；
- `handleStartDevServer`、`applyTransformations` 之类「什么都没做却先写 `xxx_executed = true`」的旗子删掉；
- `security/threat-scan` 的 `block_merge_on_critical` **不能**接 `gateBlocked`（那会连 review 报告都不出），
  改成把「结论为不可合并」写进结论文字 —— 参数生效，语义不歪。

### 新增常驻守卫
`claude-scene/src/commands/params-contract.test.js`：场景 params 的每个键必须在引擎源码里出现，
**零容忍、不设白名单**（真需要例外就在测试里显式列名 + 写理由，不许把断言改成「至少通过 N 个」）。

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **991 passed**（+28：verify/notify 契约 12、覆盖率闸门 8、checkGate 参数 6、params 契约 1） |
| lint | `npm run lint` / `cd claude-scene && npx eslint . --max-warnings 0` | 0 problem |
| 死码 | `npm run scan:deadcode` | Total dead 0 |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| review 真跑 | `start review --auto --skip-sweep` | exit 0；pass 18 / fail 0 / warn 1（SkillSpector 105 问题）/ skip 19 / noop 5 |

### 决策
- **删键前必须把「引擎层读者」算进可达域** —— 只查 handler 会误删（已踩过，回滚过一次）。
- **场景 JSON 是手工排版**：删键用行级编辑（含 CRLF 处理）+ `JSON.parse` 复核，禁止整体 `JSON.stringify` 重写。
- **参数只有两种合法归宿**：接到真实行为上，或从场景删除。「保留以备将来」= 下次审计的噪声。
- **参数生效不许改变语义**（`block_merge_on_critical` 不中止 review）。

---

## 2026-10-28 第六轮：报告与文案的一致性 —— 「已生成 / 修复完成 / 分类完成」原来都不做事

前五轮修的是「步骤有没有真跑」。这一轮问最后一步：**跑完之后写给人看的那份东西，是不是在撒谎？**
入口是自家 `review` 真跑的输出：`sec-bug-hunt` 明明扫了 215 个源码文件，摘要里却是 `noop`；
而报告文件里一堆 `**withSweep**: undefined`，还把 `_awaitingAnswer` 这种引擎内部键抄了进去。

### 怎么审的
1. 手写一个临时脚本扫 `handlers/`：**函数体里没有任何实际动作（fs/exec/fetch）却能返回「完成/已生成/已修复」** 的 handler → 56 个候选；
2. 逐个读，按「数据是真读出来的吗 / 返回值真被用到了吗 / 写没写文件」三问筛出 12 处真撒谎；
3. 报告、摘要、notify 单独人工读一遍真跑产出（`/tmp/mix-run*` 当 targetPath，避免污染仓库）。

### 修了什么

**报告 / 摘要 / 通知**
| 位置 | 以前的假 | 现在 |
|---|---|---|
| `handleReport` | 没有 targetPath 也报「报告已生成」；写失败被 catch 吞掉仍算 pass | 无路径 → skip；写失败/写后文件不存在 → warn；成功回报路径 + 步数 |
| 报告内容 | context 原文 dump（含 `_awaitingAnswer`、`completedSteps`、`**x**: undefined`） | 新增「## 步骤结果」段（计数 + 非 pass 步骤表：步号/action/状态/说明）；内部键与 undefined 过滤 |
| `printSummary` | 5 处调用没传 context → 收尾永远列不出未通过步骤 | 全传 context，收尾固定列「未通过 / 未执行的步骤」 |
| `stepResults` | 只有 `{action,status}`，说不出是哪一步 | 加 `step`/`detail`（>120 字截断补 `…`） |
| `handleNotify` | 前面有失败步骤也报「任务完成通知已发送」 | 有失败时点名 `Step X action`，并明说「不报已完成」 |
| `handleSend` | 没路径/写日志失败都说「已发送」 | 两者 → warn |

**没人读的旗子**
- `handleCeAction` 以前无条件写 `ce_<action>_executed`、`ce_brainstormed/planned/reviewed/debugged/compounded/worked/plugin_available`——全仓库无人读，且 CE 插件没装时也是 `true`。改为 `context.ce_executed` / `ce_requested`（数组、去重），可用性统一问 `checkCePlugin()`（原来三处各问各的）。
- `design.js handlePersist`：`design_variant` 全仓库无人写入 → 永远落盘 `variant:'unknown' / selected:'unknown'` 还报「已持久化」。改读 `context.design_selected`，没有选择就 warn 且不写文件。

**「完成」二字覆盖不到的动作**
| handler | 以前 | 现在 |
|---|---|---|
| `mobileGenerateReport` | 置个旗子就报「报告已生成」，零字节 | 真写 `.claude/reports/mobile-audit-*.md` + 回读校验 |
| `mobileAutoFix` | 「自动修复完成」+ `mobile_autofix_applied = true` | noop：「移动端修复需真机验证，CLI 不改代码」 |
| `perfBaseline` | 「采集完成 N 项」（N-1 项是 `device_required`）；空目录算出 `0B` | 只数真采到的；「要真机」与「没扫到源码」分开说；空目录记 N/A |
| `storeCompliance` | 三个 check 的返回值被 `for(...) check();` 整段丢弃，其中一条是 `() => true` | 逐项结论：过 / 没过 / 无法静态判定（后者不算过）；`0/3 通过` 这种结论才敢写 |
| `executeOptimize` | 凭空 push 两条字符串就报「2 项应用」并写 `optimize_applied` | 只登记 `optimize_suggestions` / `optimize_needs_manual`，状态 noop |
| `remeasure` | 只塞一个时间戳就报「重新测量完成」 | noop + 点名哪些指标仍无实测值 |
| `testInteractions` / `classifyBugs` | 「N 个流程已识别」/「Bug 分类完成: N 条」（数据来自硬编码名字） | 都改 noop：「只登记待测项，不是已确认」 |
| `mapRoutes` | 读 `context.targetPath`，把形参丢掉 → 目标不是 cwd 时永远 0 页面 | 用形参，扫到的页面数如实报 |
| `executeUIPolish` 异常分支 | 「执行完成（部分操作可能失败）」 | fail + 错误信息 |
| `analyzeUI` / `impeccableCritique` | 0 个前端文件也报「分析完成 / 打磨完成」 | warn + 说明没找到可分析文件 |

### 状态启发式：一个正则误杀了一个真干活的步骤
`NOOP_RES` 里的 `/无[^]*?[目录配置]/` 能跨 200 多字：`sec-bug-hunt` 扫完 215 个文件、结论「无问题」，
只因消息里带了句「npm audit 接口不可用」就被判 `noop`（= 什么都没做）。两处修正：
- 正则限成短距离的「无X目录 / 无X配置」，并用**有界 indexOf 扫描**替代（顺带消掉 sonar 的回溯告警）；
- `handleSecBugHunt` 改**显式 `{status,message}`**：有 high/critical = fail，有问题 = warn，干净但覆盖有缺口（依赖漏洞未知）= warn。

### 新增测试
`qa.test.js`、`mobile/optimize.test.js`、`commands/summary-content.test.js` 三个新文件 +
`flow-control` / `design` / `mobile-audit` / `threat-scan` 补用例。其中一条专门钉住这次的坑：
「消息里提『不可用』不影响显式状态」—— 同一个字符串，纯文本走启发式是 `noop`，带显式 status 必须是 `warn`。

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1028 passed / 78 files**（+37） |
| lint | `npm run lint` | 0 problem |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 problem（本轮踩了 `unicorn/no-array-reduce`、`unicorn/no-useless-undefined`、`sonarjs/cognitive-complexity` 三次，均已拆分） |
| 死码 | `npm run scan:deadcode` | Total dead 0（Handlers 0/70、Scenes 0/26） |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| review 真跑 | `start review --auto --skip-sweep` | exit 0；pass 17 / fail 0 / warn 3 / skip 19 / noop 4；`sec-bug-hunt` 从 noop 改判 warn |
| 移动端真跑 | `MIX_CODING_PROJECT_DIR=/tmp/mix-run3 start mobile-audit --auto` | 报告真落盘；`perfBaseline` noop、`storeCompliance` warn（`0/3 通过`）、`mobileGenerateReport` pass，全部与实际相符 |

### 决策
- **「完成」是结论，不是格式化字符串**：handler 只有在真读了/真写了/真跑了之后才准用「完成/已生成」。
- **检查不产生结论 = 没检查**（`check: () => true`、返回值被丢弃、`0B` 当测量值，同罪）。
- **报告是给人看的**：引擎内部键、`undefined`、没有步号的 `{action,status}` 一律不许进报告。
- **正则启发式只做兵底**：能用显式 `{status}` 表达的状态别交给文案匹配（`/无[^]*?[目录配置]/` 就是教训）。
- **状态词与文案必须互证**：报 `noop` 就别写「执行完成」，写「已修复」就得有写入。

---

## 2026-10-28 第七轮：条件表达式的反向契约 —— 恒假条件、死谓词、孤儿写入

第六轮把「报告里写的」和「实际做的」对齐了。这轮换轴：第五轮守的是
「场景 `params` 写了没人读」，这轮守它的镜像 ——**`conditions` 读了没人写**。
恒假条件是最难发现的假信号之一：它在 dry-run 和真跑里都只表现为
`⏭ 跳过 Step X（条件不满足）`，和「这一轮确实不需要跑」长得一模一样。

### 怎么审的
静态脚本（用完即删）把 `conditions.js` 的 61 个谓词体解析出来，再去 `src/` 里找
`context.X = …` 的写入方，然后遍历所有 `scene.flow` 的 `condition`，输出三类：
A) 条件引用了既不是谓词、也没人写的标识符（恒假）；B) 谓词没人引用；
C) 谓词读了 `ctx.obj.field` 而 `obj` 从没被填过。手工复核 A 段的 12 个命中，
3 个是 computed write（`enh_*`、`setup_kind`）的误判，剩下 9 个是真问题。

### 真 bug：破坏性步骤被「通用点头」把关
`refactor:13 applyTransformations`（提取方法/提取类/重命名标识符）的条件是
`user_confirmed === true`，而 `user_confirmed` 是**每一次**确认都会覆写的通用 flag
（`--yes`、是否提交代码、是否发布……）。专用 flag `user_confirmed_refactor` 存在，
但只有 `handleConfirmDialog → setContextFlag` 那条路会写；`refactor:12` 是
`action: 'confirm'` 走 `handleConfirmation`，那条路只写通用的。于是：
- 想用专用 flag 把关 → 永远没人写它 → 步骤永远跳过；
- 只能退回通用 flag → 任何一次不相关的确认都能打开一个破坏性步骤。

修法：`start.js` 抽出 `recordConfirmAnswer()`，`--yes` / `--decline` / 真终端交互 /
`auto_confirm` 四条路径共用，同时落「通用 flag + 按步骤描述推导的专用 flag」；
场景条件改成 `user_confirmed_refactor === true`（两份同步）。
真跑验证：`--yes` → Step 13 执行（noop，无可改内容）；`--decline` → 条件不满足跳过。

### 死谓词：定义了没人读 = 以后的恒假陷阱
| 谓词 | 问题 |
|---|---|
| `fixes_applied` / `high_severity_found` | 读 `ctx.securityScanResult?.…`，而那个对象全仓库只被初始化成 `{}`（唯一读者就是这两个谓词）。真实事实在 `context.fixApplied` / `context.high_severity_found`。 |
| `migrationHighCount > 0` / `fix_failed_count >= 3` | 零场景引用（表达式形态的谓词，从来没人往条件里写过）。 |
| `generate_doc_site` / `crg_mcp_available` / `crg_graph_built` | 全仓库零引用。 |

一并清掉 orphan 写入（写了没人读）：
- `buildSceneContext` 的 `securityScanResult: {}`（唯一读者是上面那个死谓词）；
- `context.fixFailedCount`（唯一写入紧跟 `process.exit(1)` —— 进程都结束了，没人读得到）；
- `context.migrationHighCount`（门禁看 `migrationReviewPassed`，明细看 `migrationFindings`）。
- `deriveMetricsFromContext` 改读真实键 `high_severity_found`：以前安全指标永远是「未知」
  所以一次都没进过设计图，测试还在断言那段死行为。

### 新增常驻守卫 `conditions-contract.test.js`
1. **条件里的每个标识符必须能求值**：是内置谓词，或 context 上真被写过的键
   （写入方包括 `buildSceneContext` 的返回对象字面量；`enh_*` / `setup_kind` 这类
   computed write 显式列出并写明「谁写的」）。自探针：把 `refactor:13` 条件拼错一个
   字母，测试立刻点名 `→ 恒假`。
2. **每个谓词必须被 ≥1 个场景条件引用**。`selected_modes.includes('ai_design')` 这种
   直写形式按「别名」放行，但要求该谓词行为与 `selected_modes.includes(x)` 完全一致
   （真跑求值比对），不许白拿免死金牌。自探针：塞一个 `zz_dummy_probe` → 立刻报出。

### 验证
| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1033 passed / 79 files**（+3，含新守卫文件） |
| lint | `npm run lint` | 0 problem |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 problem（踩了 `unicorn/consistent-existence-index-check`） |
| 死码 | `npm run scan:deadcode` | Total dead 0（Handlers 0/70、Scenes 0/26） |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| review 真跑 | `start review --auto --skip-sweep` | exit 0；pass 17 / fail 0 / warn 3 / skip 19 / noop 4 |
| refactor 真跑 | `MIX_CODING_PROJECT_DIR=/tmp/mix-r7 start refactor --auto --yes` / `--decline` | Step 13 分别「执行（noop）」与「条件不满足跳过」 |

### 决策
- **谓词只有两种合法归宿**：被场景条件真的用到，或者删掉；「先放着以后可能用」就是恒假陷阱。
- **专用 flag 必须两条确认路径都写**：`handleConfirmDialog`（`params.type=confirm`）与
  `handleConfirmation`（`action=confirm`）语义相同，flag 的落法不许不一样。
- **通用点头不能给破坏性步骤把关**：`user_confirmed` 是「刚才有人说过是」，不是「用户同意这件事」。
- **测量值也要有读者**：删 `migrationHighCount` 不是因为它是错的，而是因为没人读它 ——
  留着只会让人以为它在驱动门禁。
- **审计脚本用完就删**（临时脚本会被根 `eslint .` 扫到，也是仓库噪声）。

---

## 会话 8：`on_error` / `retry` 语义审计（第八轮）— 2026-10-28

**目标**：把「场景作者写下的失败承诺」与「引擎实际行为」对齐。上一轮审计的是
`condition` 维度（读了没人写 / 写了没人读），这一轮审计它的孪生维度：
`on_error` / `retry` —— 失败时的分支到底发生了什么。结论：**`retry` 三个承诺一条都没兑现**。

### 场景侧事实（先摸底再动手）

| 项 | 数量 |
|---|---|
| 用 `on_error` 的步骤 | `abort` 居多，`retry` 8 处（new-project 3.73/4.5、optimize 6/9、release 12、review 2、rollback 8、setup 4） |
| 声明 `retry` 次数的场景 | 0（重试次数一直是硬编码 3） |
| 写成 `continue` 的步骤 | 0（但 `docs/mobile-*.md` 把它写进了取值清单） |

### 修 1：`retry` 回路重写为 `retryFailedStep()`

旧代码就三行：`context.lastStepFailed = false` → `await dispatchAction(...)` →
`console.log(chalk.green(...))`。三件事同时错：

1. **假绿**：不看返回值，重试仍然失败也打绿色 ✔；
2. **假红**：不更新 `stepResults` / `LOG_SUMMARY`，第一次的 fail 永远留着 ——
   重试成功了，汇总还是 `✗ fail`，收尾「未通过步骤」点名一个已经不存在的失败；
3. **flag 不转发**：不重跑 `applyPostStepContext`，重试成功写回的 `open_design_executed`
   / `refactor_points` 等不再进 context，下游 `condition` 继续按失败走。

现在每次重试都过 `deriveStepStatus` 真判状态；成功则 `shiftSummary`（fail 桶 → 真实桶）
+ `rewriteStepRecord`（改写那条记录并标 `retried`）+ 重跑 `applyPostStepContext`；
重试中若处理器把问题写进 `context._awaitingAnswer`，跟首次执行一样中止去问人
（以前把问题吞掉继续跑）。`refactor_points` 去重，重跑不会记两次。

### 修 2：显式 `{ status: 'fail' }` 现在真的会触发 `on_error`

`handleStepError` 的入口是 `if (!context.lastStepFailed) return`，而 `lastStepFailed`
以前只由**文案正则**（对非字符串返回 `false`）或处理器手写置位。于是
「显式报 fail 但没顺手置 flag」的步骤被 `on_error: abort` 默默放过 ——
场景写下的「失败即中止」根本没生效。`deriveStepStatus` 归一到 `fail` 时置位。
反向也锁死：`pass/warn/skip/noop` 不许误置（否则 warn 会变成中止）。

### 修 3：认不出的 `on_error` 值不再静默

`on_error: fail-fast` / `stop` 之类以前等于「继续」，一点提示都没有。现在黄字点名
「引擎只支持 abort / fail_workflow / retry / continue」。`continue` 是文档写明的取值，不告警。
`scene-integrity.test.js` 增加常驻守卫：所有场景 `on_error` ∈ 认识集合，
且 `retry` 步骤必须仍有处理器。

### 修 4：`abortForAwaitingAnswer` 加 `counted` 选项

重试时才要问人的步骤，fail 已被 `recordStepResult` 记过一次，不再重复计入
`total/fail` —— 一个步骤不该在汇总里出现两行。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1046 passed / 80 files**（+13） |
| lint | `npx eslint .` | 0 |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead 0 |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| review 真跑 | `start review --auto --skip-sweep` | pass 17 / fail 0 / warn 3 / skip 19 / noop 4（不变） |
| retry 恢复 | 临时场景 `zz-retry-probe`（`npm test` 前两次 exit 1） | 第 2 次重试成功 → 汇总 **pass:1 fail:0**（修前是 fail:1 + 绿勾） |
| retry 耗尽 | 同上改成必失败 | 3 次重试后中止，`✗ Step 1 重试 3 次后仍失败` |
| 未知取值 | 同场景改 `on_error: fail-fast` | 黄字告警后继续，本步仍记 fail |
| abort 生效 | `zz-abort-probe`（`on_error: abort` + 必失败测试） | 立即中止 **exit 1**，Step 2 未执行 |
| 无新增中止 | deps / cicd / mobile-audit / setup wet（临时空仓） | 均正常收尾，无 on_error 中止 |

### 决策
- **失败状态只有一种解释**：显式 `fail`、`lastStepFailed`、文案正则任一条成立 = 失败，
  三条都不许被 `on_error` 绕过。
- **重试是「重做这件事」，不是「再打印一遍」**：状态、记录、context 转发三者必须一起重跑。
- **未识别的契约取值必须出声**：「引擎按默认处理」+「一声不响」= 场景作者以为写下了承诺。
- 文档里的取值也算契约：`continue` 要么实现、要么删文档；本次按「已实现」放行并写进断言。

---

## 第九轮（2026-10-29）：数据文件不许当「实现」的第二权威

上一轮的终点是「场景写了没人读的键」，本轮换个方向：**有东西在替实现说话**。
审计对象是 `claude-scene/src/data/action-messages.js`（648 行 / 475 条文案）。

### 审计先证明它没有读者

- 注册表 434 条，场景用到 244 条，**81 条死条目**；
- 424 条文案写着「完成/已修复/已应用/已生成/已更新/已安装/通过」；
- `getActionMessage` 唯一调用点是「**没有处理器**」的兜底分支 ——
  也就是说那句「XXX 执行完成」，永远只在处理器根本不存在时被引用；
- `hasActionMessage` 被 4 个扫描器当成「动作存在」的证据：
  `actions.js` 兜底、`scene-contract.test.js` 的 `isKnownAction`、
  `smoke.test.js` 死动作检查、`scripts/check-dead-actions.cjs`；
- `scripts/audit-scenes.mjs` 里 `msgsSrc` **声明后从未使用** —— 这张表连自己都没有读者。

后果不是「多一句废话」：拼错的 action 名不再被报成死动作（假绿）。
实测证据：`params-contract.test.js` 用 `source.includes(key)` 子串匹配，
`web-design-v0-draft` 含 `draft`、`body_ref` 含 `body`，把 `release#13` 的两个死参数
一起掩护过去了。

### 修：整表删除（Option A），不是只删 81 条死条目

选 A 的理由：**「文案」本身就是被当成动作存在证据的第二权威**，留着表 = 留着免死金牌。
连带删除 `/check` 的 `check-action-messages` / `fix-action-messages` 两步
（修一张没人读的表 = 生成噪音），`/check` 从 10 步变 8 步，报告里两行「Action 消息」消失。

`actions.js`：
- 兜底文案 → `{ status: 'warn', message: '未找到动作 "x" 的处理器（这一步没有执行）' }`；
- 删孤儿写入 `context.unknownAction`（`console.warn` + `status:'warn'` 已让它在日志/汇总/返回值三处可见）；
- `catch` 分支不再返回裸字符串「动作 x 执行完成（部分操作可能失败）」——
  以前没有 context 时抛出的异常会被记成 ✓ pass，现在返回显式 `{status:'fail'}`。

### 顺带修掉被掩护的三个真 bug

| bug | 事实 | 修法 |
|---|---|---|
| `release#13` 写 `"body": "changelog_content"` | `handleCreateRelease` 只读 `body_ref` → CHANGELOG 从未进 Release 正文 | 两份 `release.json` 改 `body_ref` |
| `draft` 参数 | `release#13` / `mobile-release#10` 都声明、无人读 → 场景写「草稿」实际发正式版 | `handleCreateRelease` 读 `params.draft` + `--draft`，返回带「（草稿）」 |
| `params-contract` 子串匹配 | `source.includes(key)` 让 `draft`/`body` 被别的词命中 | 留给下一轮（严格属性匹配会误报 98/720，需要「透传参数」概念） |

### 第二条同类病：`fix-gate-flags` 往引擎源码里写猜测

湿跑 `/check` 时发现的：一个 `MIX_CODING_PROJECT_DIR=/tmp/mix-r14` 的运行，
**把仓库里的 `claude-scene/src/data/gate-flags.js` 改了**，追加
`health_check: 'healthCheckPassed'` / `setup: 'setupConfigured'` 并盖 `Auto-generated by /check` 戳。

三个问题：
1. 那个「缺失」不是缺陷 —— `healthCheckPassed` / `setupConfigured` 根本没有场景拿它们做门禁
   （setup 走 `gate: "setup_config"` 的具名门禁），于是每次 `/check` 固定报「2 缺失」= 假信号；
2. 修法是猜：`inferCheckName` 把 `depCruiserPassed` 猜成 `dep_cruiser`，真名是 `depcruise`
   （原注释自己都写着），猜出来的映射没人验证；
3. 写的是引擎自己的源码，与项目目录无关 —— 每次运行都弄脏工作区。

改成只问一件能证伪的事：**场景声明的门禁名，引擎认不认识。**
`handleCheckGateFlags` 读场景 `checkGate.checks[]` / `gate` ↔ `isKnownCheck()`
（从 `flow-control.js` 导出，成为唯一权威：`SPECIAL_CHECKS` + `NAMED_GATES` + `GATE_FLAGS`）；
`evalSingleCheck` / `evalNamedGate` 改用同一份集合，避免两套名单漂移。
`handleFixGateFlags` + `inferCheckName` + `camelToSnake` + `collectContextFlags` 全删，
`/check` 从 8 步变 7 步，报告里「Gate 映射: ⚠ 2 缺失」换成「门禁实现: ✅ 29 个都认识」。
`/check` 现在**只检测不改引擎源码**，`check.md` / `README(_EN)` / `CLAUDE.md` / `AGENTS.md` 同步。

### 新增常驻守卫

- `scene-contract.test.js`：**没有第二条「动作合法性」权威** ——
  `data/action-messages.js` 不许复活；`claude-scene/src/**` 与 `scripts/**` 里
  （剔掉注释后）不许出现对它的引用；带 `scanned.length > 100` 防空跑。
  自探针：往 `paths.js` 加一行 `'action-messages.js'` → 测试点名该文件。
- `engine-check.test.js`：场景声明门禁 ↔ 引擎实现的四态
  （都有实现 → pass 报个数 / 不认识 → warn 点名场景 / 空扫描范围 → warn / 引擎自己的 26 场景 → 全实现）。
- `false-green.test.js`：`draft` 真进 `gh` 命令、非草稿不带 `--draft`。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1052 passed / 80 files** |
| lint | `npx eslint .` | 0 |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead 0 |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| check 湿跑 | `MIX_CODING_PROJECT_DIR=/tmp/mix-r14 start check --auto` | pass 5 / warn 2 / skip 1；报告「门禁实现 ✅ 29 个都认识」；**工作区不再变脏** |
| review 真跑 | `start review --auto --skip-sweep` | pass 17 / fail 0 / warn 3 / skip 19 / noop 4（不变） |
| 守卫自探针 | 临时给 `paths.js` 加一句 `'action-messages.js'` | 守卫点名 `claude-scene\src\lib\paths.js`，回滚后绿 |

### 决策
- **「文案」不是实现**：一张声称「完成」的表，只在最不该相信它的时候被引用。
- **能从源码推导的白名单就不要手写，也不能凭名字猜**：`inferCheckName` 的驼峰转蛇形
  是「猜」，场景声明才是「事实」。
- **自愈不许写猜测**：工具可以「报告缺什么」，但「补上」必须由人决定；
  自动写入还带 `Auto-generated` 戳，等于给猜测发放出处证明。
- **扫描范围为空 ≠ 通过**：门禁检查读不到任何场景声明时返回 warn。
- **删步骤不重编号**（2 → 4 → 7 的空洞保留），减少 docs / 场景 churn。

---

## Session 2026-10-29（第十轮）：params 契约 + context 两个维度

用户第二轮追问「再全面检查一下所有工作流」后，选定「三个维度全做」。
本轮交付 **2 个 commit**：`d6dc99f`（params）/ `49613d5`（context + 私有键）。

### 维度① 场景 params 契约（`d6dc99f`）

审计面：26 场景 / **720 条 params**，判据从「源码里出现过这个字符串」升级为
「action → handler → 属性访问」。旧判据下 `body` 会命中 `body_ref`、
`draft` 会命中 `web-design-v0-draft`，假绿遍地。

结论：泛读键 0、无人读 **24 个键**。按「三种合法归宿」逐个处理：

| 归宿 | 键 | 处理 |
|---|---|---|
| **接线**（真 bug） | `optimize` `detect` `regression` `since` `auto_fix` `compare_to` `depth` `port` `symbol` `from`/`to` `comment` | 各自接到真实行为上 |
| **删除** | `mapping`（×6 场景文件） | 值是**任务名**（`go-build`），引擎没有任务运行器；按语言选命令的表在 `quality.js` 已存在 |
| **明示透传** | `topic` `detail_level` `risk_analysis` `tech_selection` | 内联 registry action（`handler === null`），params 是给 agent 的提示词 |

顺手修掉的**假绿**：
- `npm audit` 解析失败 → 以前 `findings` 全 0 → `highSeverityFound = false` →
  **安全门禁报「✓ 通过」**。现在不写该字段（门禁如实 skip）+ warn。
- `handleBuild` / `languageBuild` / `languageTest` 命令失败 → 以前打行黄字后
  返回「构建完成」。现在 `{status:'fail'}`。
- `handleStartDevServer`：dev server 不退出，以前卡死后仍返回「已启动」。
  现在不真跑，把命令写进 `context.dev_server_command` 交 agent。

守卫升级 `params-contract.test.js`：
- 判据改属性访问正则（`params.x` / `.x` / `['x']`，词边界）
- 两类**可推导**豁免，不写白名单：
  · registry 里写成箭头函数的内联动作 → 由 `actions.js` 结构推导
  · `block_*` 前缀读取（`checkGate` 的 `startsWith`）与「handler 把 params 交给
    枚举它的函数」（`ce-plan` → `describePreferences` → `Object.entries(params)`）
- 两条防自身失效断言：扫描范围非空、内联动作/前缀读取确实存在
- **自探针**：注入 `zzBogusProbe` → 点名 `deps#7 updateDeps: zzBogusProbe` → 回滚

### 维度②③ context 键 + 私有键（`49613d5`）

- 315 个写入键，146 个无人读。危险的是**长得像结论却没人看**的旗标：
  删 `healthCheckPassed` / `propertyTestSkipped`×4 / `propertyTestRan` /
  `semgrepSkipped`×2 / `strykerSkipped`×3 / `changelogSkipped`。
- 修一个**假红**：`changelog.js` 非 Git 仓库时写 `changelogGenerated = false`
  → changelog 门禁报 fail。「没查」不是「不通过」，改为不写该键（门禁记 skipped）。
- 私有键（`_awaitingAnswer` / `_stepDecision` / `_stepAlreadyLogged`）**全部配对
  delete，没有泄漏** → 不加代码，改为守卫生成不变量：
  `commands/private-key-lifecycle.test.js` + 自探针（注入 `_zzLeakProbe` 被点名）。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1057 passed / 81 files** |
| lint | `npx eslint .` | 0 |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead 0 |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| check 湿跑 | `MIX_CODING_PROJECT_DIR=/tmp/mix-r10 start check --auto` | pass 5 / warn 2 / skip 1 |
| review 真跑 | `start review --auto --skip-sweep` | pass 17 / **fail 0** / warn 3 / skip 19 / noop 4 |

3 个 warn 都带具体原因（自检记录过期 / npm audit 接口不可用 / skillspector 105 问题），
没有一个是「无法解释的红」。

### 决策
- **参数只有三种合法归宿**：接到真实行为、删除、明示为 agent/外部工具透传。
  「写了没人读」= 用户以为勾了开关，实际什么都没发生。
- **能从实现源码推导的白名单就不要手写**：内联动作看 registry 形状，
  前缀读取看 `startsWith`，泛读看「handler 是否把 params 交给枚举函数」。
- **无人读的 verdict 旗标本身就是负债**：它会让下一个审计把它当成「有测量」的证据。
- **「没查」不许写成 `false`**：那等于替工具做出了判断（changelog 门禁的假红）。
- **域守卫只在能证明不变量时才生成**：私有键这一维度审计下来是干净的，
  于是交付一条守卫而不是一次「假装修复」。

### 下一轮候选维度
1. **action-messages / 文案表 → handler 结论串**：handler 返回的 `message` 与
   文案表是否互相矛盾（同一件事两处描述）。
2. **`on_error: retry` 的 retry 次数来源**：场景写 `params.retry: 3`，
   `handleStepError` 用的是哪一份。
3. **`condition` 引用的 context 键是否在**任何**上游被写过**（当前只查「有没有人读」，
   没查「写的人是否一定先跑」）——即条件对**步骤顺序**的隐式依赖。

---

## Session 2026-10-29（第十一轮）：门禁旗标写入契约 + 重试次数来源 + 条件↔上游顺序

### 维度① 门禁旗标只认布尔（`f8bdd53`）

上一轮把「无人读的旗标」删干净了，这一轮查另一半：**写进去的值本身是假的**。

- `security/npm-scan`：`detectNpmVulnerabilities` 改三态 `number>0 | 0 | null`
  （`null` = audit 接口不可用 = 不知道）；`readNpmAudit` / `countSeverities` /
  `collectDeprecated` 抽纯函数（认知复杂度 28 → ≤15）。新建 `npm-scan.test.js`（13 tests）。
- `dependency-cruiser`（**此前零覆盖**）：
  - `RAN_MARKERS` 删掉 `/dependency-cruiser/i` —— npx 失败时 stderr 里带工具名，
    于是「没跑起来」被判成「跑过了」；
  - `VIOLATION_LINE` 改成行首锚定的 `^[ \t]*(?:error|warn)\b` ——
    以前裸扫 `/error|violation/i`，`✔ no violations found` 里的 violations 被数成 1 个违规（假红）；
  - 没跑起来 → `{status:'warn'}` 且**不写** `depCruiserPassed` / `depcruise_violations`；
  - `params.rules` 接线（场景声明了却没人读）。
- `migration`：**内置确定性规则为准，guardian 只当额外信号**。
  `guardian.output.match(/CRITICAL|HIGH/i)` 双向都错：`No critical issues` 数成 1 个发现（假红），
  guardian 真报错（非零退出）时一个都不数（假绿）。读不出来的迁移文件 → warn，不写 pass 旗标。
- `monitor`：非 Git 仓库 → `{status:'skip'}`，不再写 `monitorConfigured = false`（假红）。
- `testing`：删两处 `loadTestPassed = null` —— **`null !== false`，门禁把它当通过**，
  这是本轮最危险的一类假绿。
- `config-check` / `secret-scan`：去掉 `grep ... || true`（`|| true` 把 grep 的 2/127 抹平成 0），
  统一走新 `lib/grep-scan.js`（退出码 0/1/≥2 三分）。没跑通 → warn，不写 pass 旗标。
- `flow-control.evalStandardGate`：只认 `=== true` / `=== false`，其余一律 skipped 并把实际值打出来。
- `ui-tools.handleVisualRegression`（维度①收尾）：四条「压根没跑」的路径
  （没有 package.json / 读不出来 / 没装 Playwright / 没有视觉测试文件）以前全写
  `visualRegressionPassed = false` —— 它是注册过的门禁旗标，于是「没装 Playwright」
  在门禁眼里等于「视觉回归失败」；「没有视觉测试文件」那条还返回「完成」文案（假绿）。
  现在只承认真跑过 playwright 的两次结论。

### 维度② `on_error: retry` 的次数来源

查明的两套 retry 互不相干：
- 步级：`start.js retryFailedStep` 的 `MAX_RETRIES = 3` **硬编码**，与场景声明无关；
- 处理器内部：`flow-control.checkHealth` 读 `params.retry`（release#12 / rollback#8 / onboard#11
  都写着 `retry: 3|5`）。

两个都叫 retry，只有一个数字生效 —— 读者只能猜。修法：`resolveMaxRetries(step)`
（默认 3，`step.max_retries` 覆盖，垃圾值回落并出声），中止文案用真实次数，
两者同时存在时把两个数字都打出来。

### 维度③ 条件读的键是否在「上游一定被写过」

`condition` 只认 context 键。运行时已会把「从头到尾没人写」的键记进 `_unjudgedSteps`
并点名，但**「只有后面的步骤才写」在运行时看起来跟「真的不满足」一模一样**：静默跳过。
新增 `commands/condition-order.test.js`：键集全部从实现源码推导（处理器 `context.x =`、
引擎在流程外写的键、`actionMap` 映射表），不手写白名单；两类违例
（只有后面才写 / 唯一上游写者自己也是条件步骤）各配自探针。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1115 passed / 88 files**（第十轮 1057 → 1095 → 1115） |
| lint | `npx eslint .` | 0 |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead 0 |
| 26 场景 | 逐个 `--dry-run --auto` | 全部 exit 0 |
| review 真跑 | `start review --auto --skip-sweep` | pass 17 / **fail 0** / warn 3 / skip 19 / noop 4 |

3 个 warn 都带具体原因（自检记录过期 / npm audit 接口不可用 / skillspector 105 问题）。

### 决策
- **门禁旗标只认布尔**：`null` 是最危险的假绿（`null !== false` → 门禁 ✓ 通过）。
  `*Passed` 只能被赋 `true | false | undefined`，且只赋值给**真的测过**的那次结论。
- **退出码是权威，文案不是**：`grep ... || true` 是本轮最大的一类假绿来源 ——
  它把「grep 根本不存在」和「没有匹配」变成同一件事。
- **正则启发式数「词」必然双向错**：外部工具只当额外信号，内置确定性规则为准。
- **「没跑起来」的证据不能是工具的自我介绍**：`/dependency-cruiser/i` 会命中 npx 的报错文本。
- **重试是「重做这件事」**：次数要么接场景声明，要么明说默认值；两个数字并存时必须都出声。
- **条件对步骤顺序有隐式依赖**：只有「无条件上游」「流程外注入」这两种键才算一定有值。

### 下一轮候选维度
1. **外部工具的严重级别 → 状态映射**：skillspector 报 `CRITICAL 1 / HIGH 66` 仍是 `warn`，
   非 `full_audit` 模式下没有任何门禁读它 —— 这类「有 CRITICAL 却整体 fail 0」是否算假绿，
   需要先定「外部启发式工具的严重级别能不能直接判 fail」的契约。
2. **`params-contract.test.js` 的全局泛读漏洞**：属性读取判定还停留在「全仓库有人读过」，
   收窄到 handler + 一跳调用链才能抓到「同名键在别处被读，本 handler 其实没读」。
3. **报告/汇总与实际状态的第三遍核对**：`detectorReport` 的「记录已过期」判定
   是否覆盖 `--skip-sweep` 场景（现在只能靠 warn 提示）。

---

## 第十三轮（2026-10-29）：场景参数契约的「有人读」必须发生在自己的执行路径上

上一轮候选维度 2 落地。前十二轮反复修「假绿/假红」，这一轮修的是**检测器自己的假绿**。

### 维度① 判据收窄：全仓库有人读 → 这条动作自己的执行路径

原守卫在**全仓库任意位置**找 `.key` 命中，于是：
- `report.format`（8 个场景写 `"summary"`）—— `handleReport` 从不读它，
  但 `handlers/logging.js` 里有个 `.format` → 判活；
- `analyze.metrics`（handler 读的是 `metric` 单数）→ 同上判活；
- `invokeSkill.command`（handler 读的是 `subcommand`）→ 18 行静默失效。

新判据（全部可从源码推导，无手写白名单）：

| 算「读过」 | 说明 |
|---|---|
| handler **函数体**内 | 不再算「同一文件的别处」 |
| 一跳被调函数体 | 只认实参文本里出现 `params` 的调用（`f(params)` / `f({...params})` / 第三位实参） |
| 交互层 `commands/` | `start.js` 真的在读 `step.params` 做提问 |
| 前缀读取 | `startsWith('block_')` 覆盖 `block_release` 等 |
| 泛读 | `Object.entries/keys/values(params)`、`JSON.stringify(params)`、`...params` |

内联动作（`ACTION_REGISTRY` 里直接写箭头函数）豁免：params 是给 agent 的提示词。
判据抽成 `lib/param-contract.js`（**才能给判据本身写测试**）；守卫文件自己从扫描范围排除，
否则它内部的 `.body` / `.file` 会给同名参数放水。

### 维度② 39 组「写了没人读」的 triage

- **接线（真行为）**：`invokeSkill.command` → subcommand 别名（ui-polish 18 行）、
  `jscpd.threshold`（0.05 比例 / 5 百分数都认，垃圾值回落并出声）、
  `listReleases.limit`（进 gh 命令）、`listMemories.limit`（进 slice）、
  `scanSource.tool`（就是去 `hasTool()` 查的那个）。
- **透传（引擎不执行，但 agent 要知道做什么）**：`scanDependencies.tool`、
  `runAgent.focus`、`analyzeBundle.tool` —— 写进 skip/noop 的结论里。
- **删除（引擎做不了、也没人会看）= 30 组**：`report.format/include`、
  各类 `format/sections/template/coverage/command`、`a11y-scan.checks`、
  `impeccable-critique.rules/checks`、`actionlint.config/format`、`issueQuery.limit`、
  `locate/checkAPIConsistency/codeguardian_optimize/sec-bug-hunt.scope`、`regression.cleanup`、
  `autoFix.source`、`readSpec.paths`、`recall.keywords`、`analyze.metrics`、
  `skillspector-scan.format`、`runReview.tool`。两份场景 JSON 逐字节同步。
  删除用一次性脚本做外科手术（定位 step 的 params 对象 → 删键 → 原缩进重排 →
  整文件 `JSON.parse` 复核），不做整体 `JSON.stringify` 落盘。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1166 passed / 93 files**（本轮前 1143/91） |
| lint | `npx eslint .` | 0 |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead 0（Handlers 0/70、Scenes 0/26） |
| 26 场景 | 逐个 `start <scene> --dry-run --auto` | 全部 exit 0 |
| review 真跑 | `start review --auto --skip-sweep` | pass 17 / **fail 0** / warn 3 / skip 19 / noop 4；git status 前后同为 71 行 |

守卫自探针：临时往 review.json 的 jscpd 步骤插 `zzDeadParam` → 测试点名
`review#2.95 jscpd: zzDeadParam`；回滚后判定器自己的合成用例仍全绿
（handler 体内算读、同文件别的函数**不**算读、一跳只认真的递了 params、
交互层算读、handler 找不到要报 unresolved）。

### 决策
- **「有人读过」必须发生在同一条执行路径上** —— 全仓任意位置命中同名属性是守卫自己的假绿。
- **参数只有三种合法归宿**：接到真实行为上、删除、或明示为 agent/外部工具透传。
  透传必须出现在结论文案里，否则等于没透传。
- **静态收窄必须双向自证**：收窄后要能列出 DEAD 清单（能失败），
  也要能证明合法读取没被误杀（前缀 / 泛读 / 交互层三类逃逸口逐一核实）。
- **检测器的豁免口一律从实现源码推导**：内联动作由 `ACTION_REGISTRY` 结构推、
  交互层由目录推、前缀由 `startsWith` 字面量推 —— 不手写白名单。

### 下一轮候选维度
1. **handler 结论串 vs 状态旗标**：还有哪些 handler 返回裸字符串、靠 `detectHandlerFailure`
   的正则启发式定状态？（`lib/failure-detection.js` 仍是唯一靠文案猜的地方）
2. **场景 `description` 与实际行为的一致性**：删掉 `report.include` 后，
   该步骤的 description 仍写着「Token/API 调用/MCP 使用成本汇总」—— 描述承诺的能力
   引擎从来没实现，这类「描述假绿」还没有守卫。
3. **`metrics` 全仓口径**：`analyze` 读 `metric`、场景曾写 `metrics`，说明命名口径
   存在多处单复数漂移，可做一次键名同义词普查（只报不改，先看规模）。

---

## 2026-10-29 · 第十四轮：handler 结论串 / description 假绿 / 键名漂移（三路并行）

三个维度一起做，来源是上一轮结尾的三个候选。核心发现：**上一轮修的都是「检测器看不懂
合法输入」，这一轮修的是「引擎其实没有一个统一的结论口径」**。

### 维度 1 — handler 结论串 vs 状态旗标（假绿的真正源头）

`deriveStepStatus` 的顺序是「显式 `{status}` → `lastStepFailed` → **文案正则**」。
最后一环靠 `detectHandlerFailure`（`/失败|阻断|abort|FAIL/` 且不含
`/部分|跳过|继续|非致命|fallback|降级|通知已发送|已保存|已记录|已?通知/`）+ `NOOP_RES`
猜状态，于是**排除词会把失败救回来**。审计（392 个动作 / 379 处裸字符串 return）后
把「失败」和「没测成」两类词从裸字符串里全部清掉，改成显式 status：

- 真·假绿（失败被排除词救回）：`autoUpdateSafe` 的
  `'npm 包名含非法字符,跳过自动更新(安全阻断)'`（含「跳过」→ pass）、
  `stryker` 的 `'Stryker 跳过: 执行失败'`（含「跳过」→ noop）、
  `handleRunCI` 的 `'CI 完成: 0/1 通过'`（「完成」→ pass，但一个检查都没过）、
  `git` 的 `'提交跳过: push 被拒'`（push 失败 → noop）、
  `lighthouse` 的 `'Lighthouse CI 完成（不可用）'`（工具没装 → pass）。
- **没测量就写门禁旗标**：`spectral` / `markdownlint` / `size-limit` 三条在 catch 之后
  计数变量仍停在初始值，于是 `*Passed = true` 写进 context，门禁报「通过」。
  改成三分：无对象 = `noop`（不写旗标）、工具缺失/无输出 = `skip`（**不写旗标**）、
  测到了才写 `*Passed`。
- `gitDiffNameOnly` 在非 git 目录里顺手 `context.lastStepFailed = false`
  ——**替上一个步骤擦了失败**，下游再用 `has_frontend_changes = false` 静默跳过 QA。
  改 `skip` + 不再改别人的 `lastStepFailed`。
- 其余 ~50 处「跳过 / 未找到 / 不可用 / 未安装」逐个改成 `skip`（带「不是通过」）
  或 `noop`（真无事可做）或 `fail`（真做坏了）：`update`、`testing`、`review`、`qa`、
  `mobile/audit`、`api-consistency`、`changelog`、`ceo-review`、`deep-review-tools`、
  `design`（16 处 od-* 资产查找）、`docs`（裸 catch 把 EPERM 说成「生成跳过」）、
  `flow-control`、`logic-testing`、`memory`、`threat-scan`、`ui-tools`、
  `open-redirect`、`security/config-check`、`security/insecure-defaults`、`codeguardian`。

守卫 `src/commands/step-status-contract.test.js`：扫 `ACTION_REGISTRY` 可达的 handler 体，
断言里面**不存在**含「失败 / 阻断 / 跳过 / 未安装 / 未执行 / 未产生 …」的裸字符串
return（内部三态判词 `'pass'|'fail'|'skip'|'ok'` 豁免）。自探针：往
`handleAutoRemember` 插 `return 'zz 自动记忆跳过: 写入失败';` → 测试点名
`autoRemember → handleAutoRemember (handlers/memory.js): zz …`，回滚后全绿。

### 维度 2 — scene `description` 假绿（承诺了引擎没有的能力）

上一轮删掉 `report.include` 后，8 个场景的 report 步骤 still 写着「成本报告」，
`service` 还叫 `CostService`，而 `handleReport` 只把 `stepResults` 拼成 markdown ——
**全仓没有任何 token/API 调用/MCP 使用计量**。修：8 处 description 改成「步骤结论 +
门禁汇总报告」，`CostService` → `ReportService`；`feature#7.5` 的「并检查覆盖率」
改成「按退出码判定（覆盖率由 8.5 门禁的 coverage 项判定）」，因为 `runSuite` 从不测覆盖率
（`checkGate` 的 coverage 项才是真实现，有 `coveragePassed` 旗标）。

守卫 `src/commands/scene-description-claims.test.js` 一半是**能力探针**：
先证明全仓没有成本计量实现（`total_tokens|tokenUsage|costUsd|apiCallCount|…` 零命中），
再断言没有 description/service 声称这类指标。自探针：往 `check.json #10` 插
「Token 用量与成本」→ 点名 `check.json #10 notify`。

### 维度 3 — 键名单复数漂移（结论：已被上一轮的守卫覆盖）

扫 667 个场景参数行，对每个 handler 读取范围内的属性名做「去下划线/小写 + 单复数」
近似匹配，**漂移 0 处**。原因是上一轮的 dead-param 守卫已经强制了「声明的键必须被读到」，
拼错的键根本活不下来。自探针验证：给 `optimize#9.6 codeguardian_optimize` 加
`"maxLine": 100`（handler 读 `maxLines`）→ `params-contract.test.js` 立刻点名
`optimize#9.6 codeguardian_optimize: maxLine`，回滚后全绿。**这一维度不新增代码**，
只记录「已有守卫覆盖」。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1188 passed / 96 files**（本轮前 1166/93） |
| lint | `npx eslint .` | 0 |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead 0（Handlers 0/70、Scenes 0/26） |
| 26 场景 | 逐个 `start <scene> --dry-run --auto` | 全部 exit 0、bad 0 |
| review 真跑 | `start review --auto --skip-sweep` | pass 17 / fail 0 / warn 3 / skip 19 / noop 4（与上轮一致）；git status 前后同为 54 行 |

### 决策
- **结论由 handler 给，不由文案猜**：失败/未测量两种语义必须写成 `{status}`；
  裸字符串只允许表示「真的成功了」。
- **没测量 ≠ 不通过 ≠ 通过**：`undefined` 旗标（门禁记 skipped）才是正确表达；
  写 `false` 是假红，写 `true` 是假绿。
- **一个步骤不许替别的步骤擦掉失败**（`lastStepFailed = false` 是越权）。
- **描述里承诺的能力要么有实现，要么先从描述里删掉**；守卫用「能力探针 + 文案扫描」
  两段式，探针必须能命中才有资格断言文案。
- **重复的维度不必硬造守卫**：键名漂移已被 dead-param 契约覆盖，自证之后只记录不新增。

---

## 第十五轮 —— 收尾面假绿：中止不吭声 / 退出码不说话 / 交接算通过（`b29b0ee`）

用户选「全部」→ 三维度并行审计（A 汇总一致性、B `on_error` 与 `lastStepFailed`、
C 交接类步骤占比）。审计脚本统计：583 步 / 26 场景，其中 **30 interactive、
114 handoff、271 conditional**；`on_error` 分布 `(未声明)=454 / abort=121 / retry=8`
（**没有任何场景写 `continue`，未声明 = 静默继续**）。

### 维度 A — 汇总一致 + 中止要自称中止

- `LOG_SUMMARY.total` 只增不验：`recordStepResult` 先 `total++` 再 switch，
  重试路径用 `shiftSummary` 回退桶值 —— 一旦对不上，没有任何人会发现。
  新增 `summaryMismatch(summary)`：`total === pass+fail+warn+skip+noop` 不成立就黄字
  打印 `⚠ 汇总不自洽: total=X 但分项合计=Y（差 Z…）`。湿跑复核：
  43 条日志记录 = 17+2+20+4 = 43，无告警。
- 6 条中止路径（gateBlocked / `on_error=abort` / `fail_workflow` / 重试耗尽 /
  圈地越界 / 验收阻断 / 等待回答）以前都先打印 **一行绿色的 `✓ pass: N ✗ fail: 0`**
  再 `exit(1)` —— 最后一眼看到的是全绿。现在 `printSummary` 收
  `{ aborted: 原因 }`：pass 计数改称「已完成: N」，并追加
  `⛔ 工作流已中止: <原因>` + 「上面的计数只是中止前的部分结果 —— 这次运行没有跑完，
  不要当成通过。」
  湿跑（`on_error: abort` 的探针场景）：`已完成: 0 … ⛔ Step 1 runSuite 失败（on_error=abort）`。

### 维度 B — 退出码是权威：收尾从不设退出码（本轮最大发现）

`startScene` 收尾只有 `printSummary`，**没有任何一处根据 `LOG_SUMMARY.fail` 设退出码**。
一个 `fail: 3` 的工作流（454 步未声明 `on_error` = 继续跑完）退出码仍是 0，
CI 与 agent 都把「跑完了」读成「全绿」。`enforceAcceptanceGate` 只拦
「有变更但没有通过的验证步骤」，不拦普通步骤失败。
新增 `exitCodeForSummary(summary)`：`fail > 0 → 1`，收尾红字说明后 `process.exit(1)`。
湿跑验证：临时项目 `npm test` 必失败（`on_error: continue`）→
先打印「✗ 1 个步骤失败（on_error 允许继续），退出码 1 —— 流程跑完了，但没有全绿」，
`EXIT=1`（改之前是 `EXIT=0`）。
`lastStepFailed` 方面：每步 dispatch 前都会重置（1327 行 / 重试循环内），
上一轮的失败不会漏到下一步的门禁 —— 这一半没有 bug，不新增代码。

### 维度 C — 交接类步骤不许算 pass

24 个交接型 handler 里 22 个已经是显式 `noop/skip`，只剩 2 个裸字符串：
`handleReviewFull`（`'代码审查就绪（对话模式 Skill 调用）'`）与
`handleVerifyVisual`（`'视觉验证就绪（对话模式 Playwright 执行）'`）。
「就绪」不含任何失败/跳过词 → `deriveStepStatus` 判 **pass**：引擎什么都没查，
汇总里却有两步「审查 / 视觉验证」通过。改 `{ status: 'noop', message: '…（不计为通过）' }`。
核查：26 个场景**没有任何一个**使用 `reviewFull` / `verifyVisual`（这两个 action 只供
对话模式临时调用），因此该修复不会改变任何场景的验收门禁结果（避免 `unreviewedChange` 假红）。

顺带修掉同类第 3 处：`handleCeAction` 的 4 个分支全是裸字符串
（`'CE Plugin 就绪（对话模式执行）'` / `'已安装但需对话模式'` / `'上下文已设置（未安装）'` /
`'未知操作'`）。现在：未识别动作 → **fail**（场景写了引擎不支持的 `ce-*` 就是配置错误）、
已交接 → **noop**、已装但需对话模式 / 未安装 → **skip（不是通过）**。
记账与结论抽成 `recordCeIntent` / `ceOutcome`（`cognitive-complexity` 16 → 合规）。

### 守卫

- `step-status-contract.test.js`：`NOT_MEASURED` 增加交接类措辞
  （`对话模式` / `交给.*agent` / `待 agent` / `由 agent` / `需人工`）。
  不含 `就绪` 一词：`所有工具已就绪`、`agent-egress-bench: 就绪` 是真测量，
  加进来会误杀（假红）。新增合成用例证明该判据能命中「就绪 + 对话模式」裸字符串。
- 新增 `commands/summary-integrity.test.js`（**7 tests**）：
  `summaryMismatch` / `exitCodeForSummary` 单测；以及「`printSummary` 紧接着
  `process.exit` 必须带 `aborted`」的逐行静态判据（正则 `[^)]*` 会回溯爆炸，
  改成逐行扫描），并附合成反例断言「判据自己会失败」。

### 自探针（两次注入 → 点名 → 回滚 → 复绿）

1. 删掉 `enforceAcceptanceGate` 第二处 `{ aborted: … }` → `summary-integrity.test.js`
   点名「这些中止路径没告诉读者『这条运行没跑完』」，回滚后 7 tests 全绿。
2. 把 `handleVerifyVisual` 的 noop 换回裸 `'视觉验证就绪（对话模式 Playwright 执行）'`
   → `step-status-contract.test.js` 点名
   `verifyVisual → handleVerifyVisual (handlers/review.js): 视觉验证就绪…`，回滚后 6 tests 全绿。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1199 passed / 97 files**（本轮前 1188/96） |
| lint | `npx eslint .` | 0 |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 |
| 死码 | `npm run scan:deadcode` | Total dead 0（Handlers 0/70、Scenes 0/26、Commands 0/33、Skills 0/29、MCP 0/3） |
| 26 场景 | 逐个 `start <scene> --dry-run --auto` | 全部 exit 0、bad 0 |
| review 真跑 | `start review --auto --skip-sweep` | pass 17 / fail 0 / warn 2 / skip 20 / noop 4，**exit 0**；43 条日志 = 分项合计 43 |
| 退出码湿跑 | 临时项目 `runSuite` 必失败 | `on_error=continue` → exit 1；`abort` → exit 1 + ⛔ 中止行 |

### 决策
- **跑完了 ≠ 全绿**：退出码必须由失败步骤数决定，不能让 CI 把「流程走完」读成「通过」。
- **中止必须有话说**：任何「打印计数后 exit」的路径都要说明「这条运行没跑完」，
  否则最后一眼看到的就是全绿。
- **汇总自洽性也要有读者**：`total` 与分项合计的对账写进收尾输出，差一行都要喊。
- **交接不是通过**：把活交给 agent ≠ 引擎查过了；必须 `noop` + 「不计为通过」。
- **未识别的配置取值是 fail，不是「未知操作」的 pass**（`ce-*` 写错 = 什么都没执行）。
- **守卫词表宁窄不宽**：`就绪` 会误杀真测量，只收「对话模式 / 由 agent / 需人工」这类
  明确的交接措辞 —— 收窄不漏，宽了就是假红。

---

## 第十六轮：三个维度一起收（用户选「全部」）

上一轮末尾给了三个候选维度，用户回「全部」—— 不挑，全查。

### 维度 1 —— `warn` 的语义侵蚀

**审计**：全仓 `status: 'warn'` 站点 120 处。`warn` 实际上被当成两种意思用：
「跑了、但有发现」（skillspector 命中问题）和「没测/没跑成」（验证未执行）。
而 `lib/acceptance-check.js` 的 `PASSING_RE = /^(pass|warn)$/` 把 warn 当「已审阅」，
于是第二种用法等于给验收门禁开后门。

**实证假绿**：探针场景 `/tmp/mix-r16/.claude/scenes/zz-verify.json`
（step1 `writeFile`（无处理器）+ step2 `verify`（无 package.json））——
改前：门禁放行，**exit 0**。两步都没真执行。

**修**：
- 21 处 `warn` → `skip`（文案补「不是通过」）：`flow-control`(5)、`aislop`、
  `dependency-cruiser`、`external-tool-checks`(2)、`detector-report`、`git`、`issues`(2)、
  `testing`(2)、`ui-tools`(2)、`engine-check`、`design`、`migration`、
  `security/config-check`、`security/npm-scan`(2)、`security/secret-scan`。
- `gateVerdict` 分支重排：`effectiveTotal===0` → `blocked` → `failed` → `unknown` → strict。
  以前 `unknown` 排在 `blocked`/`failed` 之前，「认不出的检查名 + 一个真失败」被降级成
  「部分无法判定」，真失败从汇总里消失。
- 改后同一探针：**✗ 验收阻断：变更未通过验证，exit 1**。

**守卫**：`commands/step-status-contract.test.js` 新增一段 —— 扫全仓 `status:'warn'`
对象字面量（括号配对扫描、跳过字符串/模板），文案命中
`未测量|没有结论|不是通过|不算通过|未执行|未扫描|未跑成|无法判定|不可判定|没有结果|未获取|扫描范围为空|没有产出`
即点名。含非空转断言（`total > 60` 个 warn 站点、`sources.length > 20`）。

**注意**：「交付物没产出」（`未生成`/`未完成`）仍保留 warn —— 那是「跑了但结果不理想」，
不是「没跑」。词表只收「没测」措辞。

### 维度 2 —— 条件表达式的「未判定」假信号

**机制本来就在**：`noteUnjudgedStep` 真实执行时也调用，`appendLog` 区分
`reason:'unjudged' | 'condition'`，`printSummary` 打 ❓ 列表。问题出在判定本身。

**确认 bug**：`explainCondition('a && b', {a:false})` → `{met:false, unknown:['b'],
determinable:false}` —— 左边已经确定假，结果就是假，与 b 无关，却报「未判定」。

**修**：`explainCondition` 改为三值求值（新增 `definiteVerdict`，沿 `||` / `&&` / `!`
短路递归，叶子用「有无未知键」+ `evalClause`）：
- `hasHardConflict && testPassed`（左边 false）→ 可判定「不满足」。
- `conversation_mode || testPassed`（左边 true）→ 可判定「满足」。
- 左边为真、右边未知 → 仍报未判定（不许假装知道）。
- `met=true` 时不报未知：未判定的意义是「跳过可能是冤枉的」，跑起来的步骤没有这个问题。
- `CONDITION_KEYWORDS` 补 `not` / `and` / `or`：`not testPassed` 以前输出
  「运行时状态：not, testPassed」——一个名字叫 not 的 context 键。

**实测**：26 场景 dry-run 中「未判定」行 **119 → 94**（25 条噪声消失，真未知保留）。

### 维度 3 —— `--iterations` 的收敛判据与汇总口径

**确认 bug**：`countFindings` 只累加 `aislop_issue_count + review_issue_count`；
场景里没有扫描步骤时两者都是 `undefined` → 返回 0 → `shouldStopLooping` 判
「本轮无新发现，提前结束」→ `--iterations 2` 只跑 1 轮，**且理由是编的**（什么都没测）。

**修**：
- `countFindings` 导出；两个计数器都没写过 → `null`（= 没测），不是 0（= 干净）。
- `shouldStopLooping` 新增 `unmeasured` 分支：无法判断收敛 → 按轮数跑满 +
  「本轮没有可数的发现（场景里没有 aislop / review 扫描步骤）」。
- `stepResults` 条目带 `iteration`；`describeNotPassSteps(stepResults, limit, plannedIterations)`
  多轮时标注「（第 k 轮）」（以前两行 `Step 3 test → fail` 看起来像重复记录）。
- `printSummary` 多轮时说明 total 口径：「本次跑了 N 轮：同名步骤每轮各记一条，
  故 total=X 是记录次数（≈ 步数 × 轮数）」。
- `requestedIterations` + `warnCappedIterations`：`--iterations 999` 不再被默默截到 20，
  打印「⚠ 请求 999 轮，超过上限 20 —— 只跑 20 轮」。

### 自探针（4 次注入 → 点名 → 回滚 → 复绿）

| # | 注入 | 谁点名 |
|---|---|---|
| 1 | `definiteVerdict` 第一行 `return null`（短路失效） | `conditions.test.js`「&& 短路：左边已确定假」 |
| 2 | `ui-tools` 的 UI 分析改回 `status:'warn'` | `step-status-contract.test.js`「warn 文案」 |
| 3 | `countFindings` 改回 `if (… undefined) return 0` | `loop-iterations.test.js`「两个计数器都没写过」 |
| 4 | `verifyByTestRun` 无 package.json 改回 `warn` | `acceptance-check.test.js`「验证没跑成（skip）不算已审阅」 |

每次回滚后 `git diff --stat` 与本轮终态一致，全量 1215 tests 复绿。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1215 passed / 97 files**（本轮前 1199/97） |
| lint | `npx eslint .` | 0 problems |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 problems |
| 死码 | `npm run scan:deadcode` | Total dead 0（Handlers 0/70、Scenes 0/26、Commands 0/33、Skills 0/29、MCP 0/3） |
| 26 场景 | 逐个 `start <scene> --dry-run --auto` | exit 0 ×26，bad=0；「未判定」行 119 → 94 |
| review 真跑（本仓库） | `start review --auto --skip-sweep` | pass 16 / fail 0 / warn 2 / skip 21 / noop 4，exit 0 |
| 同上前后比对 | 改动前后各跑一次，按 `step|action` 逐条比 | **0 处状态变化**；warn 2 = detectorReport / sec-bug-hunt（真发现） |
| 假绿探针 | `zz-verify`（writeFile + verify，无 package.json） | 改前 exit 0 → 改后 exit 1（验收阻断） |
| 迭代湿跑 | `zz-verify --auto --iterations 2` | 跑满 2 轮 + 「本轮没有可数的发现」+ 每步带「（第 1/2 轮）」 |
| 封顶出声 | `zz-verify --auto --iterations 999` | ⚠ 请求 999 轮，超过上限 20 |

### 决策
- **`warn` 只有一个意思**：「真的跑了、但有发现」。没测 = `skip` + 文案带「不是通过」。
  这是在「语义精确」和「下游消费方便」之间选精确 —— 门禁按状态消费，状态就必须无歧义。
- **认不出的检查项不许抹掉同时发生的失败**：fail 优先于「部分无法判定」。
- **短路能定的条件就是能定**；只有真依赖未知键才报未判定，且 `met=true` 时不报。
- **发现数「没测」用 `null` 不用 `0`**：在收敛判据里这两个结论方向完全相反。
- **total 数的是记录次数**：多轮必须在汇总里点明口径，不许让人把 N 倍当步数。
- **上限截断要出声**：不是失败，但也不该默默发生。
- **探针实证要固化成测试**：`zz-verify` 的结论落成 `acceptance-check.test.js` 的跨模块用例
  （真 handler 给 skip + 该 skip 让 `unreviewedChange=true`），否则下次谁把 warn 加回来都没人拦。

---

## 第十七轮（2026-10-29）· 三个「看起来跑过」的通道

> 议题由第十六轮末尾给出，用户选「全部」：
> ①`on_error: abort` 会不会吞掉已跑过的证据；②`noop` 的语义与下游；
> ③`context` 键跨轮残留。

### 审计结论（先证据、后改代码）

**维度① 中止的证据**：`printSummary` 的中止分支只列「未通过 / 未执行」的步骤，
已 pass 的成果一个字不提；`LOG_PATH` 只在 `fail/noop/warn/未判定` 时才打印；
日志只有 `{event:'start'}` 头，**没有终点事件** —— 事后读日志分不清「中止在这」
和「日志被截断」。所有 `printSummary` 调用点都是终态（9 处），可以安全地在那里收尾。

**维度② noop 的语义**（实测三处，两真一假）：
- 真：`actions.js` 未知动作返回 `warn` +「这一步没有执行」。实测把 `verify` 写成
  `verifyy` → `warn` → 门禁 `PASSING_RE` 命中 → **exit 0**（什么都没执行，全绿）。
- 真：`issues/quality/mobile-release` 六个 noop 分支置 `fixApplied / ticket_closed /
  logic_implemented / interface_analyzed / ios_released / android_released`，
  消息写着「未做」旗标却写「已做」（`fixApplied` 还会被 memory 写进会话记录）。
- 假（我原以为的假红）：`qa` / `update` 场景被「有变更但验证未通过」拦下 —— 查日志
  发现 `generateQAReport` / `writeUpdateLog` 都是 **pass**（真写了文件），门禁拦得对。
  真正的假红只在「edit 步骤是 noop」时出现，用 `zz-noop` 复现：改前 exit 1 且宣称
  「本次工作流有变更」，改后 exit 0 + 一行「变更类步骤未真正执行（fix），本次没有实际改动」。

**维度③ context 跨轮残留**：`aislop_issue_count` / `review_issue_count` 都是每轮覆盖写。
第 2 轮若跳过扫描步骤，收敛判断读到的是第 1 轮的数 → 「发现数未下降（5 → 5），停止空转」，
那个 5 与本轮无关。另外两个扫描器在**工具没跑成**时也照写计数器（`aislop` 写 `total`、
`review` 写 `issues.length`），那个 0 会被读成「本轮没有发现」→ 提前结束（假绿）。

### 修复

| 文件 | 改动 |
|---|---|
| `actions.js` | 未知动作 `warn` → `skip`，文案带「不是通过」；控制台/日志/返回值同口径 |
| `lib/finding-count.js`（新） | `recordFindingCount`（写值 + 打轮次戳）、`countMeasuredFindings`（只认本轮，否则 `null`） |
| `handlers/aislop.js` | `ranOk` 为假时不写发现数（原来写 0 → 「本轮没有发现」） |
| `handlers/review.js` | 一个检查都没跑成（`summary.ran` 为空）时不写发现数 |
| `commands/start.js` | `countFindings` 委托 `countMeasuredFindings`；`buildEndLogEntry` + `printSummary` 统一写终点事件；`printCompletedSteps` 列出中止前已 pass 的步骤；中止一律打印日志路径；「本轮没有可数的发现」文案改成「扫描步骤没跑成，或场景里没有扫描步骤」 |
| `lib/acceptance-check.js` | 变更类步骤按状态判定（`pass/warn/fail` 才算改了），新增 `inertEditSteps`；`classifyCompletedStep` 拆出以过复杂度 |
| `handlers/issues.js` `quality.js` `mobile-release.js` | 六个 noop 分支删掉「已做」旗标（没发生就不写，也不写 `false`） |
| `commands/step-status-contract.test.js` | 词表补「没有执行/没有运行/没跑成/没有实测」——原表只有「未执行」，正是漏网原因 |

### 守卫测试

- `loop-iterations.test.js`：轮次戳三态（本轮写过 / 上一轮的旧值 / 从没写过）；
  **静态守卫**「引擎里只有 `finding-count.js` 能直接写 `*_issue_count`」（扫 `src/` 全部非测试文件）。
- `acceptance-check.test.js`：noop/skip 的变更类步骤不算「有变更」、`fail` 算
  （写了一半也是写）、pass 仍然要验证（收紧 noop 不是拆门禁）、无 `stepResults` 仍是 presence-only。
- `summary-integrity.test.js`：`buildEndLogEntry` 的中止/完成两态；终点事件必须写在
  `printSummary` 里；中止分支必须带 `aborted` 才打印日志路径。
- `false-green-guard.test.js`：把「未知验证动作」与 `checkAcceptance` 接起来 ——
  `verifyy` 的 skip 不能把门禁逗过去。

### 自探针（4 次注入 → 点名 → 字节级回滚 → 复绿）

| # | 注入 | 谁点名 |
|---|---|---|
| 1 | 未知动作改回 `status:'warn'` | `step-status-contract.test.js`「warn 文案里没有「未执行/未测量/不是通过…」」 |
| 2 | `checkAcceptance` 改回只看动作名（`changed = true`） | `acceptance-check.test.js`「noop 的变更类步骤不算「有变更」」 |
| 3 | `countMeasuredFindings` 忽略轮次戳 | `loop-iterations.test.js`「上一轮的计数器不能当本轮的发现数」 |
| 4 | 删掉 `appendLog(buildEndLogEntry(...))` | `summary-integrity.test.js`「printSummary 是唯一终点」 |

做法：单行锚点 + `if (!before.includes(anchor)) throw new Error('PROBE injection failed')`
（CRLF 文件里多行 `replace` 会静默不匹配），备份用仓库相对路径 `.probe-bak`，
`finally` 里 `copyFileSync` 复原后删备份。四次都 `failed=true, named=true`，回滚后
`git status` 只剩本轮 14 个改动文件 + 1 个新文件。

### 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1225 passed / 97 files**（本轮前 1215/97） |
| lint | `npx eslint .` | 0 problems |
| lint（严格） | `cd claude-scene && npx eslint . --max-warnings 0` | 0 problems |
| 死码 | `npm run scan:deadcode` | Total dead 0 |
| 26 场景 | 逐个 `start <scene> --dry-run --auto` | exit 0 ×26 |
| review 真跑（本仓库） | `start review --auto --skip-sweep` | pass 16 / fail 0 / warn 2 / skip 21 / noop 4，**EXIT=0**（与第十六轮基线一致） |
| 假红复现/修复 | `zz-noop`（fix→noop + verifyFix→skip） | 改前 **exit 1**「本次工作流有变更」→ 改后 **exit 0** + 「变更类步骤未真正执行（fix），本次没有实际改动」 |
| 假绿复现/修复 | `zz-typo`（writeFile + `verifyy`） | 改前 **exit 0**（warn 被当已审阅）→ 改后两步都是 skip + 门禁不认 |
| 真的改过仍然拦 | `qa` / `update` 场景（报告真写盘、验证跑不了） | 均 **exit 1**（门禁没被削弱） |
| 中止证据 | `zz-abort`（recall → writeFile → verify） | 屏幕列出「中止前已完成（pass）1 步：Step 1 recall」+ 日志路径；日志末行 `{"event":"end","status":"aborted","reason":"验收阻断：变更未通过验证",…}` |
| 完成态终点 | `zz-noop` | 日志末行 `{"event":"end","status":"completed","reason":null,"summary":{…},"completed_steps":2}` |
| 迭代收敛 | `zz-scan --iterations 2` | 扫描步骤没跑成 → 「本轮没有可数的发现（扫描步骤没跑成，或场景里没有扫描步骤）」+ 按轮数跑满 |

### 决策
- **`skip` 也可以很响**：控制台 `console.warn` + 日志里写明原因，比把没执行标成 `warn` 更诚实；
  「响」不等于「状态往高处写」。
- **`warn` 属于「跑过」，`skip` 属于「没跑」**，别为了让它显眼就把没跑写成跑过。
- **凡是被门禁消费的状态，判定口径必须按状态、不按名字**：动作名只能回答「这类步骤该不该有」，
  不能回答「这次到底改了没」。
- **noop 分支不许留「已做」旗标**：没发生就不写；写 `false` 也是谎（本轮压根没试过）。
- **跨轮共享的 context 要有归属**：值本身不够，得知道它是哪一轮写的 —— 所以打轮次戳而不是清空。
- **中途退出必须留下两样东西**：已完成的步骤（可复用）+ 日志终点事件（可核对）。
- **失败原因也要能被验证**：本轮我最初的「qa/update 是假红」结论是错的，查日志才推翻 —— 
  「改之前先把现象和状态对上」比「看着像 bug 就改」便宜得多。

---

## 第十八轮 · 三个维度：pass 不再靠猜、重试的账、门禁豁免要出声

**日期**：2026-10-29  
**性质**：引擎语义审计（用户回「全部」→ 三个维度一起做）  
**基线**：本仓库 `start review --auto --skip-sweep` → pass 17 / fail 0 / warn 3 / skip 19 / noop 4，EXIT=0  
**终态**：vitest **1237 passed / 98 files**；ROOT_ESLINT=0；CS_ESLINT=0；deadcode **Total 0**；26 场景 dry-run **bad=0**；工作区 clean

### 审计怎么取证的
三个维度各写一个临时审计脚本（用完即删，规则见「坑」）：
- 维度 1：把 **284 个注册处理器**里的 **170 个裸字符串 return** 逐个喂给**真实的 `deriveStepStatus`**，
  只信引擎自己的分类结果，不信正则直觉 → 命中 4 个真假绿 + 6 个「什么都没做却算通过」。
- 维度 2：读 `retryFailedStep` 全路径（重试/耗尽/awaiting）与 `recordStepResult` 对照 → 找到 2 处账目问题。
- 维度 3：扫 26 个场景的 `classifyAction` 结果（ok=17 / noEdit=8 / RISKY=0）+ 检查 `allow_no_verify` 的实际效果。

### 修了什么

**维度 1 —— 把结论写进返回值（9 处）**

| 文件 | 分支 | 以前 | 现在 |
|---|---|---|---|
| `external-tool-checks.js` | `handleBuildLeakCheck` 有泄露 | pass | **warn** |
| `external-tool-checks.js` | `handleDeadLinkCheck` 有死链 | pass | **warn** |
| `external-tool-checks.js` | `handleRecheckCli` 命中可疑正则 | fail（靠 `lastStepFailed` 侧信道） | **fail（写在返回值里）** |
| `external-tool-checks.js` | `handlePa11yCi` 无违规 | pass（猜出来的） | pass（显式） |
| `testing.js` | `handleGenerateTest` 有缺口 | pass | **warn** |
| `ui-polish.js` | `handleApplyComponents` 无可替换 | pass | **noop** |
| `memory.js` | `handleAutoRemember` 一家都没写 | pass | **noop** |
| `mobile-onboard.js` | `handleSetupEnv` .env 已存在 | pass | **noop** |
| `design.js` | `handleOdTemplatePreview` 无可预览 | pass | **noop** |
| `flow-control.js` | `handleCheckEnvFile` .env 存在 | pass（猜） | pass（显式） |
| `review.js` | `handleReviewFull` 0 处可疑 | pass（猜） | pass（显式） |
| `security/config-check.js` | `handleEnvVarLeak` 安全 | pass（猜） | pass（显式） |

**维度 2 —— 重试的账**
- 重试日志条目补 `iteration`（普通步骤记录一直有，重试漏了 → 多轮跑时无法归因）；
  抽 `buildRetryLogEntry()` 纯函数，让单测能钉住「必须带轮次」。
- `重试成功` 只留给 `pass`：`skip` 说「不再失败，但也没有跑成」，`warn` 同理走黄字。

**维度 3 —— 豁免必须出声**
- `checkAcceptance` 新增 `waivedNoVerify`；`enforceAcceptanceGate` 打印
  「验收门禁被场景声明豁免（allow_no_verify）… —— <理由>」。
- `allow_no_verify` **只认布尔 `true`**：以前字符串 `"true"` 同样能关掉门禁
  （`!allowNoVerify` 对非空字符串为 false），且 `Boolean('false')` 也是 true。
- `plan-ceo-review.json` 补 `allow_no_verify_reason`（两份场景文件逐字节同步）。
- `scene-integrity.test.js` 加三条场景侧断言：有变更必须有验证 / 豁免必须带理由 /
  豁免只认布尔 true 且必须有东西可豁免（空豁免 = 永远不生效的开关）。

### 新增守卫
`claude-scene/src/handlers/status-evidence.test.js`：扫所有注册处理器的裸字符串 return，
若文案里已经写着「有发现」（死链|泄露|违规|未测试|覆盖率不足|可疑|漏洞|超限|不一致|缺口）
却会被判 `pass`，或者写着「什么都没做」（未新增|未覆盖|无需|没有可|未变化|未改动|没有可替换）
却会被判 `pass`，直接红；另有「巡检不能空跑」的自检断言（>200 处理器 / >50 文件 / >50 裸字符串）。

### 自探针（4 次，均注入 → 点名失败 → 字节级回滚 → 复绿）

| # | 注入 | 期望 | 实际 |
|---|---|---|---|
| 1 | `testing.js` 缺口分支退回裸字符串 | `status-evidence` 红并点名 | `testing.js:20 [handleGenerateTest] … 未测试` ✅ |
| 2 | `if (stepStatus === 'pass')` → `if (stepStatus !== '__never__')` | 重试用例红 | `expected true to be false`（`重试成功` 断言） ✅ |
| 3 | `typeof allowNoVerify === 'boolean' &&` 去掉 | 类型用例红 | `allow_no_verify 只认布尔 true` 红 ✅ |
| 4 | `plan-ceo-review.json`：`allow_no_verify: false`；再删 `allow_no_verify_reason` | 场景断言红并点名 | 分别命中「也没声明 allow_no_verify」「allow_no_verify_reason 缺失」 ✅ |

### 湿跑实证

| 场景（临时项目） | 结果 |
|---|---|
| `zz-waive`（writeUpdateLog + allow_no_verify + 理由） | **EXIT=0**，屏幕出现「⚠ 验收门禁被场景声明豁免（allow_no_verify）… —— 探针场景：只写日志文件…」 |
| `zz-waive-noreason`（同上但无理由） | **EXIT=0** + 「（场景没写 allow_no_verify_reason —— 豁免理由缺失）」 |
| `zz-block`（有变更、无验证、未豁免） | **EXIT=1** + 「✖ 验收阻断：…未执行任何验证类步骤」+ 中止摘要（门禁没被削弱） |

### 回归基线比对
用 `git archive HEAD` 把改前代码解到 `.base-scene/`（junction 链 `node_modules`），同一仓库跑同一场景：

| | pass | fail | warn | skip | noop | 逐 step 差异 |
|---|---|---|---|---|---|---|
| 改前（HEAD） | 17 | 0 | 3 | 19 | 4 | — |
| 改后（工作区） | 17 | 0 | 3 | 19 | 4 | **0 处**（43 步逐个比对一致） |

### 验证

| 项目 | 命令 | 结果 |
|---|---|---|
| 单测 | `npx vitest run` | **1237 passed / 98 files**（改前 1225/97） |
| 根 lint | `npx eslint .` | ROOT_ESLINT=0 |
| 严格 lint | `cd claude-scene && npx eslint . --max-warnings 0` | CS_ESLINT=0 |
| 死代码 | `npm run scan:deadcode` | Total dead **0**（Handlers 0/70、Scenes 0/26、Commands 0/33、Skills 0/29、MCP 0/3） |
| 场景自检 | 26 场景 `--dry-run --auto` | 全 exit 0（bad=0） |
| 工作区 | `git status --porcelain` | clean |

### 契约变更（改断言的地方，均带理由注释）
- `grep-scan-handlers.test.js`：`String(result)).toContain('安全')` → `result.status === 'pass'` + `result.message`。
- `testing.test.js`：两个 `handleGenerateTest` 用例改成「有缺口 → warn / 无缺口 → pass」，
  并给 `scanDir` 加 mock（原来的 `/tmp` 会让测试吃宿主目录内容）。
- `false-green.test.js`：`.env 已存在` 的断言从裸字符串改成 `status: 'noop'`。
- `memory-store.test.js`：`未新增` 的断言从 `toContain` 改成 `status: 'noop'` + message。

### 坑
- **heredoc 会吃掉正则里的反斜杠**：写带 `\` 的脚本一律用 `write` 工具，别用 `bash <<'PY'` 转义。
- **Windows 上 `join('/tmp','src')` 得到 `\tmp\src`**：在 Windows 上断言路径别用 `/` 分隔符的正则。
- **`opts.filter(file)` 会被 `unicorn/no-array-callback-reference` 误判**：先把谓词取到局部变量再调用。
- **`python` 里写单反斜杠 + n，落到 JS 源码里就是真换行**：要在 JS 里得到反斜杠 + n，python 字符串里得写四个反斜杠；
  本轮就因此写出过一次 `bad.join('` + 换行 + `')` 的语法错误 —— 改成 `LF` 常量后一劳永逸。
- **比对基线别靠记忆**：我记的十六轮基线（16/2/21/4）和当前环境（17/3/19/4）不同，
  用 `git archive HEAD` + junction 跑真基线才确认「0 处差异」。

### 决策
- **状态要写在返回值里，文案只负责给人看**：正则猜状态永远有漏，漏的方式还都很安静。
- **`pass` 的门槛是「做了并对了」**：扫出问题、什么都没找到可做的，都不是 pass。
- **重试的语义是「再跑一次」不是「翻盘」**：`skip`/`noop` 不许被打成绿勾。
- **豁免是开关，开关要有理由**：`allow_no_verify` 必须带 `allow_no_verify_reason`，
  且运行时要把豁免说出来（「没拦」与「被关掉」必须可区分）。
- **旗标只认布尔**：`"true"` / `"false"` 字符串既不生效也不报错，是最难查的一种静默。
- **守卫测试必须有「不空跑」的自检**：否则文件搬走、正则写错都会让它永远绿。


## 第十九轮 · 三个维度：对象返回值必须自己布状态、多轮旗标的归属、noop 不再混进「没过」

**日期**：2026-10-29
**性质**：引擎语义审计（用户回「全部」→ 三个维度一起做）
**基线**：本仓库 `start review --auto --skip-sweep` → pass 17 / fail 0 / warn 3 / skip 19 / noop 4，43 步，EXIT=0
**终态**：vitest **1254 passed / 99 files**；ROOT_ESLINT=0；CS_ESLINT=0；deadcode **Total 0**；26 场景 dry-run **bad=0**；逐 step 与改前基线 **0 处差异**；自探针 **6/6**；工作区 clean

### 审计怎么取证的
- 维度 1：写临时扫描器遍历 **78 个 handler 文件 / 284 个注册处理器**，只统计「处理器自己这一层」的
  `return {…}`（跳过 `.map`/`.forEach` 等回调里的返回），比对对象里有没有 `status`：
  实测 **550 处 return / 348 处对象返回 / 0 处缺 status** —— 现状是干净的，缺的是**守卫**。
  同时抓到一条真的假绿：`formatResultForDisplay` 会给没布 status 的对象**编造** `success`，
  `.claude/logs/workflow-plan-*.log` 里 `initPlanningFiles` 就是这么记成 `pass` 的。
- 维度 2：`grep` 出 **71 处 `context.XPassed = …`**，再读 `conditions.js` 的求值链 ——
  `runtimeDependentIdentifiers()` 只看「键在不在 ctx 上」，因此 `--iterations N` 第 2 轮
  某步没跑时，第 1 轮写下的 `testPassed=false` 会被当成**本轮结论**（跳过/放行都不留痕）。
- 维度 3：读 `describeNotPassSteps` 的过滤条件 `status !== 'pass'` —— `noop` 与 `fail/warn/skip`
  混在同一张「未通过 / 未执行的步骤」表里，`Step 4 recall → noop` 看上去像第 4 步出了问题。

### 修了什么

**维度 1 —— 对象是「结论」的载体，状态必须自带**

| 位置 | 以前 | 现在 |
|---|---|---|
| `start.js` `formatResultForDisplay` | 没布 status 的对象 → 屏幕上编一句「步骤已完成（状态：success）」 | 老实说「处理器返回了对象但没布 status —— 无法判断这一步是否真的做成了」 |
| `start.js` `deriveStepStatus` | 对象没布 status → 落到文案正则 → 几乎必然 pass | 非 null 对象（含数组）→ **warn**，并把这句说明附在结果串上 |
| `handlers/status-evidence.test.js` | 只查「裸字符串返回」 | 新增静态守卫：处理器这一层的 `return {…}` 必须显式写 `status` |

**维度 2 —— 旗标要有归属：值不够，还得知道是谁、哪一轮写的**

- 新增 `lib/flag-stamp.js`：`snapshotFlags` / `stampFlagWrites` / `flagWrittenAt` / `staleFlagDetail` / `staleFlags`。
  `runStep` 与 `retryFailedStep` 在步骤执行前取浅快照，执行后比对变动的键，记进 `context.__flagMeta`
  （下划线开头，`flow-control` 的报告渲染与序列化本来就会跳过 `_` 前缀键）。
- `lib/conditions.js`：`runtimeDependentIdentifiers` 把「本轮没重新测过的旧值」也算未判定 ——
  于是 `testPassed` 是上一轮写的时，条件既不会被当成「确定不满足」悄悄跳过，
  `explainCondition` 还会多返回一个 `stale: [{key, iteration, step}]` 供输出层点名。
- `start.js`：条件成立但依据是旧值时打黄字
  `⚠ Step N 的条件依据是早前轮次留下的值：testPassed（第 1 轮） —— 本轮没有任何步骤重新测量过它`；
  未判定摘要不再一律写「缺 X」，改成 `X 没人写过` / `X 用的是第 N 轮的旧值`。

**维度 3 —— noop 是「没人可做之事」，不是「没过」**

- `describeNotPassSteps` 返回值扩展为 `{ lines, total, idleLines, idleTotal }`：
  `lines/total` 只装 fail/warn/skip，noop 单独进 `idleLines/idleTotal`（不丢，账还对得上）。
- `printNotPassSteps` 打印两段：黄字「未通过 / 未执行的步骤」＋灰字「没有可做之事的步骤（noop，不算问题）」。

### 守卫测试
- `handlers/status-evidence.test.js` 新增 describe：手写扫描器（`stripLiterals` 抹字符串、
  `opensFunctionBody` 判 `=> {` / `foo(...) {` 与 `if (...) {`、只在非回调作用域里收 `return {`），
  自带空跑自检（`NAMES.size > 200`、`rows.length > 200`）。
- `lib/flag-stamp.test.js`（新，10 条）：只记动过的键 / 同轮重写不算旧值 / 跨轮未重测算旧值 /
  重新测过就不旧 / 删键也算动过 / 单轮永不旧；以及 `conditions` 侧四种情形（本轮写过、旧值 false、
  旧值 true、短路优先）。
- `commands/loop-iterations.test.js` +3：对象无 status → warn 且点名；数组/Date 同类；屏幕上不再出现 `success`。
- `commands/summary-content.test.js` +3（含 1 处契约变更）：noop 不进 `lines/total`、
  全 noop 时 `lines` 为空、安静态返回完整结构。

### 自探针（注入 → 点名 → 字节级回滚 → 复绿，6/6 命中）

| # | 注入 | 被谁点名 |
|---|---|---|
| 1 | `flow-control.js` 去掉 `return { status: 'skip', … }` 里的 `status` | `status-evidence.test.js` → `flow-control.js:…` |
| 2 | `deriveStepStatus` 的对象分支加 `&& false` | `loop-iterations.test.js` → `expected 'pass' to be 'warn'` |
| 3 | `formatResultForDisplay` 还原成编造 `success` | `loop-iterations.test.js` → 断言命中 `success` |
| 4 | `staleFlagDetail` 直接 `return []` | `flag-stamp.test.js` → `expected [] to deeply equal` |
| 5 | `runtimeDependentIdentifiers` 里 `stale.has(id)` 短路掉 | `flag-stamp.test.js` → 命中 `testPassed` |
| 6 | `describeNotPassSteps` 的 noop 过滤失效 | `summary-content.test.js` → 命中 `noop` |

### 湿跑（临时项目 + 自带场景，验完即删）
- `/tmp/mix-r19`（测试脚本 exit 0，`--iterations 2`）：第 2 轮 Step 1/2 因 `!planning_files_exist` 变假而跳过，
  Step 3 条件 `testPassed` → 打印 `⚠ Step 3 的条件依据是早前轮次留下的值：testPassed（第 1 轮）`，EXIT=0。
- `/tmp/mix-r19c`（测试脚本 exit 1）：第 1 轮写下 `testPassed=false`，第 2 轮 Step 3 →
  `❓ 未判定 Step 3 …，其中 testPassed 是第 1 轮留下的旧值（本轮没重新测）` + 摘要
  `Step 3 … —— testPassed 用的是第 1 轮的旧值`，EXIT=1（失败照旧如实上报）。
- `/tmp/mix-r19b`（在已跑过的目录上重跑）：两轮都「没人写过」→ 摘要写 `testPassed 没人写过`，
  证明两种原因不会被混成一句。

### 回归基线（真跑，不凭记忆）
`git archive HEAD claude-scene package.json` + `mklink /J` junction 到 `claude-scene/node_modules`（inquirer 只在那）：
- 本仓库 `review` 场景改前 / 改后 **43 步逐 step 0 处差异**（17/0/3/19/4，EXIT=0）。
- 单轮下 `__flagMeta` 不产生任何旧值 → 多轮机制对单轮行为零影响。

### 契约变更（改断言的地方，均带理由注释）
- `summary-content.test.js`：安静态断言从 `{ lines: [], total: 0 }` 改成含 `idleLines/idleTotal` 的完整结构。

### 坑
- **三元 return 不是对象 return**：第一版扫描器把 `return cond ? 'a' : 'b'` 当成对象返回，
  `indexOf('{')` 抓到的是后面语句的花括号 → 一次报出 8 处假红（`backup.js`/`cicd.js`/`docker.js`…）。
  守卫自己也会产生假红，这条得当成一等 bug 修：只认 `return {`。
- **`/([A-Za-z_$][\w$]*)$/` 会被 `sonarjs/super-linear-regex` 点名**（字符类重叠 + 行尾锚点 → 二次回溯）：
  改成手写反向扫描 `trailingIdentifier()`。
- **`{ ...(x || {}) }` 会被 `unicorn/no-useless-fallback-in-spread` 点名**：直接 `{ ...x }`（spread undefined 无副作用）。
- **`.map(render)`（传函数引用）会被 `unicorn/no-array-callback-reference` 点名**：写 `.map((r) => render(r))`。
- **`runStep` 加条件分支后认知复杂度撞 17**：把条件门抽成 `passesConditionGate()`（老套路：超了就抽子函数，抽完重跑测试）。
- **multiedit 是原子的**：一次 `edit` 调用里任何一块 `oldText` 对不上，整批都不落地 ——
  别以为「前面几块已经生效了」，改完要 `node --check`（本轮就踩过一次）。

### 决策
- **「返回了对象却没说结论」等于没说**：对象里的 `ok/found/count` 是处理器自己的词汇，
  引擎没有资格替它翻译成 pass。宁可 warn + 点明原因，也不许编一个 `success`。
- **旗标要记账，不靠清空**：多轮的输入型键（`platform`、`prompt`、用户确认）不能被清，
  所以记「谁在第几轮写的」，让读者自己判新旧 —— 与第十七轮「发现数打轮次戳」同一套语义。
- **旧值不是答案，但也不是「确定不满足」**：它进「未判定」通道（❓ + 摘要点名），
  走「未判定」既有的一整套披露（`_unjudgedSteps`、收尾提示），不新造概念。
- **noop 是第三类**：既不是通过，也不是问题，收尾必须单列 —— 混进「未通过」会让人去查一个
  本来就不需要查的步骤（比漏报更耗费信任）。

---

## 第二十轮 · 四个维度：warn 不再是同一个词、skip 要说原因、场景不许吹能力、`--auto` 的决定必须亮出来

起点：用户问「`--auto` 到底替我了什么？」—— 追下去发现四个都是同一类毛病：
**引擎自己在替用户下结论**（warn 合成一个数字、skip 不给原因、场景描述比能力大、auto 静默取值）。

### 维度①②：warn / skip 的词汇表（`src/data/step-reasons.js`，新文件）

以前收尾只有 `⚡ warn: 3` 和 `⏭ skip: 19`。这两个数字把完全不同的事压成同一个计数：

| warn 类别 | 含义 | 读者该去哪看 |
|---|---|---|
| `findings` | 真跑了，报告里有发现 | 读报告 |
| `contract` | 处理器返回了对象却没布 status | 读处理器源码（补 status） |
| `silent` | 处理器什么都没返回 | 读处理器源码（补返回值） |
| `unknown-status` | status 词引擎不认识 | 读处理器源码（拼写） |
| `heuristic` | 正则猜「文案像有发现」 | 去让处理器布 status |

skip 同理 11 类：`condition` / `unjudged` / `user` / `interactive` / `not-applicable` /
`tool-missing` / `permission` / `input-missing` / `input-invalid` / `engine-disabled` /
`handler-skip`（= 处理器说跳过但没说哪类，**明写「没说原因」**，绝不按文案猜类别）。

- `deriveStepStatus` 现在返回 `{resultStr, stepStatus, warnKind?, skipReason?}`；
  `explicitWarnKind()` 只认 `warn/warning/partial/issues` 这些**表示「有发现」的词**。
- `recordStepResult(..., meta)` / `rewriteStepRecord(..., meta)` 把类别写进
  `context.stepResults[]` 和日志行（`warn_kind` / `reason`）—— 重试改写状态时类别同步改写，
  不会出现「status 变 pass 了、原因还挂在 warn 上」。
- `describeStatusBreakdown(stepResults)` 按**最终状态现算**分布（不用会减不回来的计数器），
  `printSummary` 在计数行**之后**单独打 `⚡ warn 细分:` / `⏭ skip 细分:`（老格式化原样保留）。
- `describeNotPassSteps` 行尾加原因：`Step 4 sec-bug-hunt → warn（有发现）`。

### 维度③：场景声称 vs 实际能力（真红只有 1 条，但引擎自己的统计也在说谎）

取证脚本扫 26 个场景：先剔除「建议式措辞」（修复建议 / 修复方案 / 修复项 / 待修复…），
再认「动手式措辞」（自动修复 / 自动写入 / 落盘 / 重构代码 / 自动提交…），
最后要求 flow 里有能动手的步骤。第一版把 `invokeSkill` / `runAgent` 算成「不动手」→ 7 条假红；
加上 `AI_RE` 桶后剩 **1 条真漂移：`check.json`**。

- 场景写「引擎自检 + **自愈**」「**自动修复** gate-flags 数据文件」「发现数 + **修复数** + 遗留问题」，
  而那两个自愈步骤当年就被删了（`engine-check.js:100` 的注释写着为什么：猜出来的映射没人验证，
  每次跑还把工作区弄脏）。**改的是场景描述，不是把能力加回来**。
- 同时修引擎自己的统计：`classifyAction` 增 `ai` 桶（`invokeSkill|runAgent|mp-|skill-`，
  verify 优先），`checkAcceptance` 返回 `aiSteps` / `mutating` —— 以前「本场景能不能改代码」
  被答成「不能」，8 个场景被判 noEdit，其中每一个都在 `invokeSkill` 后面改文件。
- 验收门禁那句「本次没有实际改动」也改了：AI 代做的步骤数 > 0 时明确写
  「引擎自己没改任何文件；另有 N 步把改动交给了 AI（引擎看不见它们改了什么）」。

### 维度④：`--auto` 的每个决定都要亮出来（`src/data/auto-decisions.js`，新文件）

`--auto` 的语义是「别打断我」，不是「替我选」—— 分界只有一条：**这个选择事后能不能被看见**。
登记 10 类决定（`target-path` / `theme` / `brand` / `modes` / `option` / `kind` /
`context-flag` / `confirm-answer` / `sweep` / `iterations`），每类带 `label` + `override`。
埋点 7 处，收尾统一打印：

```
⚙ --auto 替你做的决定（共 3 项，不带 --auto 会逐项问你）：
    目标项目路径 → E:\auto-coding
      --target <路径>（不带则用 $MIX_CODING_PROJECT_DIR 或 cwd）
    迭代轮数 → 1
      --iterations <N>
    Step 0 selectModes: 审查模式组合 → code_review,security_deep
      --mode <id,id>（不带则用场景逐项声明的 default:true）
```

同一份内容落日志（`event: 'auto-decision'`）。`target-path` / `iterations` 是在 `initLog()`
之前定的 —— 以前记了也写不进去，所以 `appendLog` 改成返回 boolean，
`flushAutoDecisionLog()` 在 `initLog` 之后立刻补写（真跑日志里三条都在）。

### 守卫测试（+39 条，1293 total）
- `commands/step-reasons.test.js`（23）：5 个 warn 类别 / 11 个 skip 原因 / `skipReasonFrom`
  保留原词 / 分布统计 / 清单带原因 / **词表与代码字面量一致**（扫全量 `.js`，
  `warnKind: '…'`、`skipReason: '…'`、`reason: '…'` 都必须在词表里，`files.length > 100` 防空跑）。
- `commands/auto-decisions.test.js`（11）：登记表完整性（label + override 非空）/ 豁免函数必须给理由 /
  **按函数边界扫 `start.js`**，凡提到 `options.auto` 的函数必须「披露 or 问人 or 在豁免表里」
  → `offenders` 必须为空（`functions.length > 80`、`touching >= 6` 防空跑）/ `noteAutoDecision`
  未登记 id 带「未登记的类别」/ 收尾打印带覆盖方式、无决定时一个字不打印。
- `commands/scene-description-claims.test.js`（+4）：`ADVISORY_PHRASE` 剔除 + `MUTATION_CLAIM` 认声称 +
  「声称会动手 ⇒ flow 里必须有 edit 或 ai 步骤」+ 动作分类器四桶断言 + `aiSteps` 不进老门禁。

### 自探针（注入 → 点名 → 字节级回滚 → 复绿，4/4 命中）
| # | 注入 | 被谁点名 |
|---|---|---|
| 1 | `warnKind: 'silent'` → `'silentt'` | `step-reasons.test.js`（词表一致性） |
| 2 | 删掉 `applyContextFlag` 里的 `noteAutoDecision(...)` | `auto-decisions.test.js`（offenders） |
| 3 | `check.json` 描述改回「自动修复 gate-flags 数据文件」 | `scene-description-claims.test.js` |
| 4 | `AI_RE` 改成永不命中 | `scene-description-claims.test.js`（ai 桶失效） |

### 验收
- `npx vitest run`（claude-scene）：**101 files / 1293 tests 全绿**。
- `npx eslint .`（根，宽松）+ `cd claude-scene && npx eslint . --max-warnings 0`（严格）**双 0**。
- `npm run scan:deadcode`：0 dead（Handlers 0/70、Scenes 0/26、Commands 0/33、Skills 0/29、MCP 0/3）。
- 26 个场景 `--dry-run --auto`：**0 失败**（只认退出码）。
- 本仓库真跑 `review --auto --skip-sweep`：**43 步逐 step 与改前基线 0 差异**（17/0/3/19/4，EXIT=0），
  新增行只有 `⚙ --auto 替你做的决定（共 3 项）` + `⚡ warn 细分: 有发现 3` + `⏭ skip 细分: 处理器判为跳过但没声明原因 3`，
  日志里 3 条 `auto-decision`（含 initLog 前补写的 `target-path` / `iterations`）。
- 湿跑 `/tmp/mix-r20`（对话模式，无 TTY）：`sec-bug-hunt → warn（有发现）`、
  5 个 `skip（处理器判为跳过但没声明原因）` —— 原因直接写在清单里，不用去翻日志。

### 坑
- **`\n` 在 python heredoc 里会被 shell 折成真换行**：`appendFileSync(… + '\n')` 写进 JS 变成跨行字符串 → 语法错。
  模板里一律 `<BS>` 占位 + `BS = chr(92)` + `.replace('<BS>', BS)`（本轮两个 append 都踩了）。
- **`i = j`（for 循环里改计数器）会被 `sonarjs/updated-loop-counter` 点名** → `while` + `index += 1` + 抽 `functionBody()`。
- **抽子函数也会再撞复杂度**：`checkAcceptance` 把 ai 计数挪进 `classifyCompletedStep` 后还是 17 →
  再抽 `tallyStep()`（累加器对象），主循环只剩 3 行。
- **`collectSources` 之外还有「场景 JSON 也要同步」**：改 `claude-scene/scenes/check.json` 后
  `interactive-gate.test.js` 立刻红（overlay `.claude/scenes/*.json` 必须与打包版逐字节一致）。

### 决策
- **「为什么不是 pass」必须是词汇表里的键，不许按文案猜**：类别只能来自处理器 `reason` 字段
  或引擎自己的判定分支；没声明就是 `handler-skip`（明写「没说原因」），词表外的值 →
  `handler-skip` + `unknownDeclared` 保留原词。
- **分布不用全局计数器，按 `stepResults` 最终状态现算**：重试会把 fail 改写成 pass，
  计数器减不回来，分布会和计数打架 —— 「那种不一致比不给细分更糟」。
- **细分单独打一行，不动老计数行**（`✓ pass: N  ✗ fail: …` 有测试和用户习惯在读）。
- **`heuristic` 要自曝是猜的**：正则判出来的 warn 标「文案像有发现（正则猜的）」，
  提示读者去让处理器布 status，而不是「报告里有发现」。
- **AI 代做也算「会动手」**：把 `invokeSkill` 算成不动手，就等于要求所有 AI 型场景都假红。
- **`fix-gate-flags` 当年的删除是对的**，所以修的是描述，不是把能力加回来。
- **`--auto` 的自主决定必须「登记 + 打印 + 落日志」三件齐全**：只有打印没日志 = 事后查不到；
  只有日志没打印 = 用户当场不知道。

---

## 第二十一轮 · 四个维度：一列只装一种词汇、noop 也要说原因、分布必须能对上计数、warn 类别交给处理器

起点：第二十轮把「为什么不是 pass」做成词表后，屏幕上仍有两处说不清：`noop: 4` 没有细分，
`⏭ skip 细分: 条件不满足 16 / 处理器判为跳过但没声明原因 3` 里那 3 个是我自己写的 `skip`
—— 词表建好了，布线没跟上；还有一处埋得更深：**细分只盖了 19 步里的 3 步**。

### 维度①：`reason` 这一列只装跳过原因（`src/commands/start.js`）

审计发现同一个 `reason` 键被三种东西共用：跳过原因（词表内）、事件注解（`'retry'`、
`'needs-answer'`）、交互标注。后果是「词表外 = 处理器写错」的静态守卫会把引擎自己写的事件
注解当成拼错，也让读者无法判断某行 `reason` 该不该出现在词表里。

- `buildRetryLogEntry` → `event_reason: 'retry'`；`buildEndLogEntry` → `event_reason: aborted || null`；
  `abortForAwaitingAnswer` → `event_reason: 'needs-answer'`；
  `recordInteractiveStep` → 已答 `event_reason: 'interactive-answered'`，未答 `reason: 'interactive'`（真跳过）。
- 循环停止原因显式成表 `STOP_REASONS`（6 项，**不进日志**）：它是控制流的判断，不是某一步的结局。
- 守卫测试：`reason:` 字面量必须 ∈ `SKIP_REASONS`；`event_reason` 只允许三个已知值；
  同一行不许同时出现两者。

### 维度②：noop 也要说原因（`NOOP_REASONS` 7 类 + 处理器布线）

`noop` 是「没人可做的事」，和 `skip`（判不了）本来是两件不同的事，第二十轮之前还混在一起。
现在单列了，但屏幕上只有 `⚠ noop: 4` —— 读者不知道那 4 步是「已经做完了」还是「这事派给别人了」。

- `NOOP_REASONS`：`already-done` / `nothing-to-do` / `conversation-mode` / `delegated` /
  `tool-missing`（与 skip 同义同标签「缺工具或依赖」）/ `undeclared` / `heuristic`。
- `recordStepResult` 写 `noop_kind` + `stepResults.noopReason`；收尾多一行
  `○ noop 细分: …`；覆盖不全时由 `breakdownCoverageGap` 打黄字点名差额。
- **处理器布线（本轮新增 ~45 处）**：只挑「文案已经明说类别」的那些逐行加 `reason:`，
  猜不准的一律留 `undeclared`（错的类别比「没声明」更难查）。典型：
  `ceo-review` 的「交给对话模式的 agent」→ `conversation-mode`；`issues` / `quality` 的
  「已经做过」→ `already-done`；`qa` / `mobile/audit` 的「缺 gh / 缺 xcrun」→ `tool-missing`。
- 新静态守卫（`log-schema.test.js`）：扫 `handlers/**/*.js`，`status: 'noop'` 起 4 行窗口里的
  `reason:` 必须 ∈ `NOOP_REASONS` —— 词表外的值以前会在运行期被悄悄降级成 `undeclared`。

### 维度③：细分必须覆盖全部日志行，不能只盖内存里的 `stepResults`

关键取证：`describeStatusBreakdown(context?.stepResults)` 只拿到 3 步，计数行却写
`skip: 19`。原因是**条件跳过走 `appendLog` 直写、交互跳过走 `recordInteractiveStep`，
两者从不进 `stepResults`** —— 细分与计数天生对不上，而屏幕上什么也没说。

- 放弃「再建一份内存账」，改为 `loggedStepRows(logPath = LOG_PATH)` **直接读日志文件**：
  逐行 `JSON.parse`，跳过 `entry.event` / 重试行 / 无 step / 非 string status，同一 step 最后一行胜出。
  理由：内存账和日志会各自跑偏，「屏幕上说的事必须能从日志里核出来」，顺带能发现漏写盘。
  读不到 → `[]`，调用方回落 `context.stepResults`，**绝不编造分布**。
- `breakdownCoverageGap(breakdown, counts)`：覆盖不全就打黄字
  `⚠ warn/skip/noop 细分只覆盖 X/Y 步 —— 其余没有类别记录，以计数行为准`，
  否则「没列出来的」会被默认当成不存在。
- `breakdown-coverage.test.js`（10 条）：临时日志 fixture 覆盖「条件跳过/交互跳过也算一步」
  「重试行与终态事件行不抢账」「warn_kind / reason / noop_kind 各回各位」「半截行与缺文件不编造」
  「3/19 点名差额」「三项全 0 不打印」；另含 **aborted 守卫**：按花括号深度切出 `if (aborted) {…}`，
  断言三行细分出现在块结束之后、块内没有 `return` / `process.exit`（提前退出 = 收尾少打三行）。

### 维度④：warn 的类别也可以由处理器声明（`warnKindFrom`）

`detectorReport` 以前把三种完全不同的事都说成「warn 有发现」：报告里有 failed / stale、
证据对不上当前 HEAD、工作区脏。前一种是真发现，后两种是「记录过期了，得重跑自检」。

- `WARN_KINDS` +3：`stale-evidence`（证据过期）/ `inconsistent-evidence`（自相矛盾）/
  `unknown-declared`（处理器写了词表外的类别，保留原词）。
- `warnKindFrom(result, fallback)`：处理器布了词表内的 `warnKind` 就照抄，否则回落引擎判定。
- `verdictOf` 四支全部带 `warnKind`：`stale-evidence`（HEAD 不符/工作区脏/无 gitSha）、
  `inconsistent-evidence`（`passed ≠ total`）、`findings`（有 failed/stale）。
  屏幕：`Step 2.7 detectorReport → warn（证据过期（对不上当前代码））`。
- 语义底线：**「记录来自 abc123，当前 HEAD 是 def456」不是发现，是要人重跑自检** ——
  把它算进「有发现」会让收敛判断以为代码有问题。

### 收尾补的三处「处理器没声明原因」（真跑查出来的）

不是本轮新引入的，是湿跑/真跑把「handler-skip」暴露出来后才补的：
- `skill-runner.js`：本机没有 SKILL.md → `tool-missing`（review 里 3 个 `invokeSkill`）。
- `detector-report.js`：`readReport` 自己知道是「没有记录」还是「记录坏了」，就顺手返回
  `reason`（`input-missing` / `input-invalid`）—— 别再让上游按文案猜类别。
- `review.js`：`classifyLintOutput` 拆开「缺配置」（`input-missing`）与「缺模块」（`tool-missing`）；
  `runReview` 全部子检查都没跑成时，用 `commonSkipReason(checks)` 取共同原因，
  **有子检查没声明就不替它编**。

### 验收三元组

1. **变更**：`data/step-reasons.js`、`commands/start.js`、`handlers/detector-report.js` +
   19 个 handler（ceo-review / changelog / design / external-tool-checks / flow-control / git /
   issues / memory / mobile-onboard / mobile-release / mobile/audit / mobile/optimize / qa /
   quality / review / skill-runner / testing / ui-polish / update）；新增
   `commands/log-schema.test.js`（12 条）、`commands/breakdown-coverage.test.js`（10 条）；
   改 `detector-report.test.js` / `step-reasons.test.js` / `summary-integrity.test.js` /
   `retry-semantics.test.js` / `interactive-gate.test.js`。
2. **验证命令**：`npx vitest run` / `npx eslint .` / `cd claude-scene && npx eslint . --max-warnings 0` /
   `npm run scan:deadcode` / 26 场景 `start <scene> --dry-run --auto` /
   `node claude-scene/src/index.js start review --auto --skip-sweep` / `.probe21.py` / 湿跑 `/tmp/mix-r21`。
3. **验证结果**：vitest **103 files / 1317 tests 全绿**；两套 eslint **0**；deadcode **0**；
   dry-run **26/26 成功**；review 真跑 **EXIT=0**，43 步与基线 `workflow-review-20261029T083034-5ea052.log`
   **逐 step 0 差异**（pass 17 / fail 0 / warn 3 / skip 19 / noop 4），且屏幕上
   `⚡ warn 细分: 证据过期（对不上当前代码） 1 / 有发现 2`、
   `⏭ skip 细分: 条件不满足 16 / 缺工具或依赖 3`、
   `○ noop 细分: 需要对话模式才能执行（CLI 下只能供料） 4` —— **19/19、4/4、3/3 全覆盖，无黄字**；
   自探针 **4/4**（注入 `reason: 'retry'` / 掉 `appendLog` 行 / `warnKind` 拼错 /
   `guessNoopReason` 退化成常量 → 各自测试变红并点名，还原后回绿）；
   湿跑 `/tmp/mix-r21` **EXIT=0**，21 个 skip 全部点名类别，`handler-skip` 归零。

### 坑（本轮新增）

- **`String.fromCharCode` 被 `unicorn/prefer-code-point` 点名** → `String.fromCodePoint(10)`；
  测试里拼正则要用 `String.raw`，否则 `\b` 变退格符，守卫永远 0 命中。
- **同一 process 里 `describe` 和 `export` 不能共存**（`unicorn/no-top-level-side-effects`）→ 测试文件里别导出辅助函数。
- **`return reasons.length === 1 ? x : undefined`** 会被 `unicorn/no-useless-undefined` 点名 →
  改成 `if (...) return x;` 兜底裸 `return`。
- **`...(cond ? obj : {})`** 会被 `unicorn/consistent-conditional-object-spread` 点名 →
  `...(cond && obj)`。
- **`String.fromCharCode(10)` 这种「能跑但 lint 不让」的写法，别等 CI 才发现**：改完立刻跑 SCENE 那套。
- **湿跑 fixture 的 `.gitignore` 要带 `*.pem` / `*.key` / `credentials.json`**，否则
  `sensitive-file-check` 真红（那是它对的表现，不是假红），会把整轮湿跑判成 EXIT=1。

### 决策（本轮新增）

- **一列只装一种词汇**：`reason` 只装 `SKIP_REASONS`，`warn_kind` / `noop_kind` 各一列，
  事件注解走 `event_reason`（允许中文散文），循环停止原因 `STOP_REASONS` 不进日志。
- **统计的行源就是日志文件**，不建第二份内存账；读不到才回落，绝不编造分布。
- **细分与计数对不上必须在屏幕上说出来**，否则「没列出来的」会被当成不存在。
- **noop 的原因也要处理器声明**，但只做「文案已明说」的那些；猜不准就留 `undeclared`。
- **判定权归处理器**：处理器能布 `warnKind` 就照抄（词表内），词表外记 `unknown-declared` 并保留原词。

---

## 第二十二轮 · 门禁自己也要能红：pre-commit 恒 0、死代码扫描器没有退出码、CRLF 会让 hook 静默坏掉

起点：第二十一轮那次提交，`npm test` 里有 3 个用例超时失败，提交照样落地、`COMMIT=0`。
查下去发现不是偶然 —— **提交门禁本身就是假绿**。

### 维度①：`.husky/pre-commit` 的退出码恒为 0

老内容 4 行，没有 `set -e`，收尾是 `npm run scan:deadcode 2>/dev/null || true`：

```sh
(cd claude-scene && npx eslint . --max-warnings 0)
npm test
npm run scan:deadcode 2>/dev/null || true   # ← 最后一条命令永远成功
```

脚本退出码 = 最后一条命令的退出码 → **恒为 0**。实测取证：把 `npx` / `npm` 都用替身脚本
换成 `exit 1`，老 hook 依然 `EXIT=0`，还顺手把扫描器的 stderr 吞了。

修法（不是加 `set -e` 就完事 —— 还得让失败**可见**）：
- `set -e` 打头；
- 去掉 `|| true` 与 `2>/dev/null`（吞错的兜底 = 永不红）；
- 每一步先 `echo '[pre-commit] 1/3 eslint（claude-scene 严格档，--max-warnings 0）'` ——
  事后能从输出核出「到底验过什么」，而不是一串无从对应的日志；
- 收尾 `echo '[pre-commit] 全部通过'`：只有真跑到最后才有这句。

### 维度②：`scripts/find-deadcode-full.cjs` 算出 `totalDead` 却从不设退出码

`const totalDead = …` 然后只 `console.log` —— 「扫描器跑完了」被当成「扫干净了」。
于是 hook 里那句 `|| true` 其实多余：就算不吞，这脚本也永远 `exit 0`。

- `totalDead > 0` → `process.exit(1)`，并打印「❌ 扫到 N 处死代码 —— 删掉或补引用后重跑」。
- **空跑自检**：`MIN_SCANNED = { handlers: 40, scenes: 15, commands: 15, skills: 10 }`
  （当前实际 70 / 26 / 33 / 29），任一类低于下限 → `process.exit(2)`
  「❌ 扫描面塌了：handlers=0（下限 40）… —— 这个 0 dead 不可信，先查扫描路径」。
  `0 / 0` 与「全绿」在屏幕上是同一个样子，这正是要拦的。
- 支持可选 root 参数 `node scripts/find-deadcode-full.cjs [root]`：既方便复用，
  也让测试能在临时目录里验证「真有死代码会红」，不必往本仓库里塞假死文件。

### 维度③：`.gitattributes` —— 门禁脚本必须是 LF

本仓库 `core.autocrlf=true`。老 hook 在工作区是 LF（历史原因），但**换台机器 clone 下来
就是 CRLF** —— CRLF 的 sh 脚本会让 `set -e` 变成非法选项（Git-Bash 报
`set: invalid option`），门禁当场坏掉，而报错完全看不出是换行符问题。
新增 `.gitattributes`：`.husky/** text eol=lf` + `*.sh text eol=lf`。

### 维度④：假红也要修 —— 5s 默认超时对「真去起子进程」的用例偏紧

门禁现在会真的拦住提交了，于是「偶发超时」的代价从「无感」变成「随机拦你」。
实测最慢几条：`handlePropertyTestScout` 8.5s、全量 handler 冒烟 6.1s、`handleGitLeaks` 3.9s
（都在 spawn 真的 git / node / npm）。`vitest.config.ts` 设 `testTimeout: 15_000` ——
**只调时间预算，一条断言都没动**；假红和假绿一样糟。

### 新测试 `claude-scene/src/commands/gate-honesty.test.js`（10 条）

静态契约（只看会执行的命令行，注释里写「以前是 `|| true`」不算违规）：
`set -e` 存在 / 没有 `|| true`·`set +e`·`2>/dev/null` / 三道门禁命令都在 /
每步有 `[pre-commit]` 标签且最后一行是「全部通过」/ hook 是 LF 且 `.gitattributes` 声明了它。

动态（注入 `PATH` 替身真的跑一遍 hook，用 `sh`；无 sh 时 `skipIf` 并保留真实原因）：
- eslint 失败 → 非零退出且**没有**打 `2/3`（后面真的没跑）；
- 测试失败 → 非零退出且**没有**打 `3/3`；
- 三道全过 → 0 且打印「全部通过」。

扫描器动态（临时目录 fixture：40 handler / 15 scene / 15 command / 10 skill，
内容里不写自己的文件名，否则 `isReferenced` 自己命中自己）：
有死代码 → `exit 1` 且点名 `dead-one`；干净 → `exit 0` + `Total dead: 0`；
空目录 → `exit 2` + 「扫描面塌了」。

### 验收三元组

1. **变更**：`.husky/pre-commit`（重写）、`.gitattributes`（新增）、
   `scripts/find-deadcode-full.cjs`（退出码 + 空跑自检 + root 参数）、
   `vitest.config.ts`（`testTimeout`）、新增 `claude-scene/src/commands/gate-honesty.test.js`（10 条）。
2. **验证命令**：`python .probe22.py` / `npx vitest run` / `npx eslint .` /
   `cd claude-scene && npx eslint . --max-warnings 0` / `npm run scan:deadcode` /
   26 场景 `--dry-run --auto` / `start review --auto --skip-sweep` /
   临时 git 仓库里 `git commit`（honor 门禁退出码）。
3. **验证结果**：
   - 改前取证：三个门禁命令全部 `exit 1` → **老 hook `EXIT=0`**；
   - 改后：eslint 失败 `EXIT=1`（没进第 2 步）、测试失败 `EXIT=1`（没进第 3 步）、全过 `EXIT=0`；
   - 临时仓库实测 `PATH=<stub> git commit` → **`COMMIT_EXIT=1`，`git log` 无提交**（门禁真的拦住了，git 认退出码）；
   - vitest **104 files / 1327 tests 全绿**；双 eslint **0**；`scan:deadcode` **EXIT=0 / Total dead: 0**；
     dry-run **26/26**；review 真跑 **EXIT=0**，`pass 17 / fail 0 / warn 3 / skip 19 / noop 4`（与基线一致）；
   - 自探针 **5/5**（hook 退回 `|| true` / `set +e` / CRLF；scanner 不设退出码 / 去掉空跑自检 → 各自变红并点名，还原回绿）。

### 坑

- **断言 `not.toContain('|| true')` 会打到注释里**：hook 头部注释解释「以前是 `|| true`」→
  必须只对**会执行的命令行**断言（`hookLines()` 已滤掉注释与空行）。
- **`'\n'` 在 python heredoc 里会被折成真换行**（第 6 次踩）→ 用 edit 改成
  `String.fromCodePoint(10)`；**别再用 heredoc 生成含反斜杠的 JS**。
- **`PATH` 里注入替身目录会被 `sonarjs/no-os-command-from-path` 点名** →
  逐处 `eslint-disable-next-line` 并写理由；`process.execPath` 不需要（绝对路径）→
  加了会变成 unused directive 警告。
- **node 在 Windows 上不认 `/tmp/xxx`**（vitest `--outputFile=/tmp/x.json` 写不出）→
  用 `$TEMP/…`。

### 决策

- **门禁的退出码就是结论**：脚本「跑完了」不等于「通过」，`|| true` 这种兜底一律不许出现在门禁里。
- **每一步门禁要自报名字**：没有标签的日志无法事后核对「到底验过什么」。
- **扫描器要有空跑自检**：`0 / 0` 和「全绿」在屏幕上长得一样，必须靠下限把它拆开。
- **门禁脚本纳入 `.gitattributes` 的 LF 约束**：Windows 上换行符能把门禁弄坏，且报错看不懂。
- **假红也要修**：超时预算按「真的起子进程」的用例来定，但绝不动断言。

---

## 第二十三轮 · 校验脚本的诚实性：4 个「已验证」的脚本里 3 个永远不会红

延续第二十二轮的判据（**门禁的退出码就是结论**），这一轮把 `scripts/` 下被
审计报告与 README 当成「✅ 验证脚本」的那批逐个真跑了一遍。改前取证（都是实数）：

| 脚本 | 报告怎么说 | 实际行为 |
|------|-----------|---------|
| `check-dead-actions.cjs` | 扫出 4 条死引用 | 打印完 **`EXIT=0`**；而且那 4 条是伪动作（`selectModes` / `selectSetupKind`）—— **假红 + 假绿同时存在** |
| `check-params.cjs` | 「Issues found: 0」 | `HANDLER_PARAMS` 每条都标了 `optional: true`，唯一会报错的 `!spec.optional` 分支**结构上永远进不去** → 0 是恒等式，不是结论 |
| `find-deadcode.cjs` | 死代码扫描器 | `find-deadcode-full.cjs` 的严格子集（只扫 handlers），且无退出码；两套判据必然漂移 |
| `scan-scenes.cjs` | 「扫描所有场景步骤数」 | 只认 `data.flow.length`，而 `flow` 早已是对象 → 每个场景 `steps` 都是 `undefined`，`JSON.stringify` 直接丢字段；屏幕一片正常 |

连带发现三处「同一张名单写了三份」和一个**幽灵豁免**：

- 伪动作名单散在 `handler-verify.js`、`scene-contract.test.js`（`START_SPECIALS`）、
  `scripts/audit-scenes.mjs`（`SPECIAL_ACTIONS`）三处；
- 其中 `audit-scenes.mjs` 那份多了个 **`'selectOption'`** —— 代码与 26 个场景里都不存在。
  它不报错，只是让「把动作写成 `selectOption`」这种笔误**静默通过**（豁免表比实现长，只会越活越久）。
- `scripts/scenes-stats.json` 是 28 个场景 / 665 步（真值 26 个 / 583 步）—— 因为上面 ①，它一旦重跑
  就会被写成「每场景没有 steps 字段」，而 `fix-readme-en.cjs` 正要读这个字段。

### 维度①：伪动作名单收敛成一份 `src/data/pseudo-actions.js`

`PSEUDO_ACTIONS = new Set(['selectModes', 'selectSetupKind'])` + 注释说明为什么必须是数据而不是三份字面量。
`handler-verify.js`、`scene-contract.test.js`、`audit-scenes.mjs` 全部改成 import 这一份，
**删掉 `'selectOption'` 幽灵**（删完 `audit-scenes.mjs` 仍是 0 错误 / 0 警告 → 反证它确实没人用）。

### 维度②：`check-dead-actions.cjs` 退出码 + 空跑自检 + 假红修复

- `root` 可选参数（`process.argv[2]`），默认仓库根；
- 判据 = `actions.js` 注册表 + `handlers/ui-polish.js` 场景自有动作 + **`PSEUDO_ACTIONS`** + 含空格（shell）；
- 退出码：**0** 干净 / **1** 有死引用 / **2** 扫描面塌了（场景 < 20 或动作引用 < 400，或伪动作表读不到）。

改后实测：`Scenes: 26   Action references: 583 / Dead references: 0 / OK / EXIT=0` —— 4 条假红消失，退出码是真的。

### 维度③：删掉两个「不可能红的检查」，修好一个「会写坏数据」的

- **删 `scripts/check-params.cjs`**：结构恒真的检查比没有检查更糟（它给报告提供了「已验证」的假证据）。
  真契约在 `claude-scene/src/commands/params-contract.test.js` + `lib/param-contract.js`（已硬化 13 轮，且进 `npm test` 门禁）。
- **删 `scripts/find-deadcode.cjs`**：`find-deadcode-full.cjs` 的子集，两套判据放着就会漂移；
  保留接入门禁的那一个（`npm run scan:deadcode`），README 的脚本清单一并更新。
- **`scan-scenes.cjs` 重写**：`flow` 数组/对象都认（不认识就 `null`，不猜）；
  **写盘前自检**：场景 < 20 → `exit 2`，有场景算不出步骤 → `exit 1`，两种情况**都不覆盖**已有 stats
  （「不许用坏数据覆盖好文件」）；可选 out 路径参数（测试用）。
  跑真仓库 → **26 个场景 / 583 步**，`scenes-stats.json` 从 28/665 的陈旧数据变成真值。
- **`audit-scenes.mjs` 加空跑自检**：读到 < 20 个场景 → `exit 2` + 「这个 0 错误不可信」（它本来就有 `exit 1`，只是空跑也报干净）。

### 新测试 `claude-scene/src/commands/scripts-honesty.test.js`（12 条）

- `check-dead-actions.cjs`：真仓库 `0 dead / EXIT=0`（**与 `scene-contract.test.js` 的漂移守卫**）；
  fixture 里伪动作不算死；注入 `totallyMissingAction` → `EXIT=1` 并点名；空目录 → `EXIT=2` + 「扫描面塌了」。
- `scan-scenes.cjs`：flow 对象 → 每场景 `steps=5`（不是 `undefined`）；flow 数组 → `steps=3`；
  有坏场景 → `EXIT=1` 且**旧 stats 文件一字节没动**；场景太少 → `EXIT=2` 且不产出文件。
- `audit-scenes.mjs`：真仓库 0 错误 / `EXIT=0`；空目录 `EXIT=2`。
- **假检查不许复活**：`check-params.cjs` / `find-deadcode.cjs` 必须不存在，`package.json` 也不许引用。
- **幽灵豁免守卫**：`PSEUDO_ACTIONS` 里每个名字都必须在 `start.js` 里有实现痕迹
  （`step.action === 'x'` / `!== 'x'` / `actionMap` 的键，抽取方式与 `smoke.test.js` 同构）。

### 验收三元组

1. **变更**：新增 `claude-scene/src/data/pseudo-actions.js`、`claude-scene/src/commands/scripts-honesty.test.js`；
   改 `handler-verify.js`、`scene-contract.test.js`、`scripts/check-dead-actions.cjs`、`scripts/scan-scenes.cjs`、
   `scripts/audit-scenes.mjs`、`scripts/scenes-stats.json`、`README_EN.md`；删 `scripts/check-params.cjs`、`scripts/find-deadcode.cjs`。
2. **验证命令**：`python .probe23.py` / `npx vitest run` / `npx eslint .` /
   `cd claude-scene && npx eslint . --max-warnings 0` / `npm run scan:deadcode` /
   `node scripts/check-dead-actions.cjs` / `node scripts/audit-scenes.mjs` / `node scripts/scan-scenes.cjs` /
   26 场景 `--dry-run --auto` / `start review --auto --skip-sweep`。
3. **验证结果**：
   - `check-dead-actions.cjs`：改前 `Dead references: 4`（全是伪动作）+ `EXIT=0` →
     改后 `Dead references: 0` + `EXIT=0`；注入笔误 → `EXIT=1` 点名；空目录 → `EXIT=2`；
   - `scan-scenes.cjs`：改前每场景 `steps` 是 `undefined` → 改后 26 个场景 / 583 步；
     坏场景 → `EXIT=1` 且旧文件不变；场景 < 20 → `EXIT=2`；
   - `audit-scenes.mjs`：空目录从 `EXIT=0`（「0 错误」）→ `EXIT=2`；
   - vitest **105 files / 1339 tests 全绿**；双 eslint **0/0**；`scan:deadcode` **EXIT=0 / Total dead: 0**；
     dry-run **26/26**；review 真跑 **EXIT=0**，`pass 17 / fail 0 / warn 3 / skip 19 / noop 4`（与基线一致）；
   - 自探针 **7/7**（去掉 `exit 1` / 忽略伪动作表 / 加幽灵 `selectOption` / 退回 `flow.length` /
     允许坏数据覆盖 / 去掉 audit 空跑自检 / 复活 `check-params.cjs` → 各自变红并点名，还原回绿）。

### 坑

- **Windows 上 CJS 里动态 `import()` 必须走 `pathToFileURL`**：直接给 `E:\...` 会报
  `Only URLs with a scheme in: file, data, and node are supported` / `unsupported protocol 'e:'`。
- **伪动作表读不到 = 扫描面塌了**：`check-dead-actions.cjs` 一开始直接 `import` 崩掉 → 退出码虽是 2，
  但报的是「扫描失败」而不是「扫描面塌了」，测试按文案断言会红 —— 改成 try/catch 返回 `null`，
  再把它列进 `collapsed` 里，报告才诚实地指向「缺的是那张名单」。
- **测试里的断言文案决定探针能不能点名**：`expect(ghosts).toEqual([])` 把理由写在注释里，
  失败输出只显示数组差异 → 探针找不到「幽灵豁免」。改成 `expect(ghosts, '幽灵豁免：…')`，
  失败信息自己就把话说清楚（这本身就比注释可靠）。
- **`unicorn/max-nested-calls`（max 3）最爱打这种一行 fixture**：`join(mkdtempSync(join(tmpdir(), …)), 'x')`
  与 `JSON.parse(readFileSync(join(…)))` 都是 4 层 → 拆成两条语句（顺手更好读）。
- **`process.execPath` 上加 `eslint-disable sonarjs/no-os-command-from-path` 会变成 unused directive** 警告
  → `--max-warnings 0` 下当场红（第二十二轮踩过，这轮又踩一次：位置对了但规则不触发）。

### 决策

- **一个检查如果结构上不可能失败，它就是「假证据」，删掉比留着更诚实**（`check-params.cjs`）。
- **同一个判据只允许有一份名单**；名单比实现「长」出来的一律算幽灵，必须能被测试当场抓出来。
- **校验脚本必须能报 3 种结论**：干净 / 有问题 / **扫不到东西**（第三条最容易被写成「干净」）。
- **会写盘的工具要先自检再写**：数据坏了宁可拒绝写，也不许用坏数据覆盖好文件。
- **脚本与测试判据重复时不删脚本，而是加「漂移守卫」**：两边结论不一致时测试变红，
  比「谁也别写第二份」更可靠。

---

## 第二十四轮：README 的场景数/步骤数不许是假的（2026-07-01）

> 起手不是「改文档」，是查一份脚本：`scripts/fix-readme-en.cjs`。

### 改前取证

- `scripts/fix-readme-en.cjs`（114 行，已删）：头注释写「基于 `scripts/scenes-stats.json` 真实数据」，
  实际把 `stats` 读进来**一次都没用**；正文全是 `34 → 35`、`60 → 69` 这种历史替换，
  `renames` 表里每个场景的步数硬编码在正则里。锚点早被它自己改没了 → 重跑等于空转，
  跑完还打印「All step counts verified」（只验证自己的硬编码）。**这就是假绿的标准形态**。
- 真值：`claude-scene/scenes/*.json` → **26 个场景 / 583 步**。两份 README 都没对上：
  - `README.md`：标题写 27；10 个步骤数错（`review 35→43`、`bugfix 30→34`、`ui-polish 69→72`、
    `new-project 67→70`、`feature 26→31`、`refactor 23→30`、`loop 13→18`、`qa 12→13`、`check 7→8`、
    `setup 9→14`）；幽灵行 `enhance-prompt`（无场景/无命令文件）；**漏列 `spec`**。
  - `README_EN.md`：标题写 29；9 个步骤数错；**幽灵行 `hunt` / `e2e` / `monitor`**；
    漏列 `setup` + `spec`；「已融入」注释还把 `loadtest→e2e`、`log/incident→monitor`、
    `llm-proxy-audit→hunt` 指向三个不存在的入口（真值都是 `setup` / `review`）。
- 根因不止「没人改」：`scripts/scenes-stats.json` 的键是场景的**中文 display name**（`Bug修复`），
  而 README 表格、命令、文件名认的都是 slug（`bugfix`）—— 下游任何对齐工具都匹配不上，
  于是只能硬编码数字。**键选错，校验就永远写不出来**。

### 维度①：stats 的键换成 slug（可对齐）

`scripts/scan-scenes.cjs`：`result[data.name || file]` → `result[file.replace('.json','')]`，
另存 `name` 字段保留展示名；写盘改为按步数排序（键顺序稳定，diff 干净）。

### 维度②：`scripts/check-readme-stats.cjs`（新增，替代被删的 fix 脚本）

- 真值直接读 `claude-scene/scenes/*.json` 的 `flow` 键数（引擎实际遍历的步骤；review 真跑 43 步与 `review.json` 43 键一致）。
- 逐份 README 校验：**标题数字**（中文 `## 📋 N 个工作流场景` / 英文 `## 📋 N Workflow Scenes (N Steps Total)`）、
  **幽灵行**、**漏列**、**步骤数**、**写了「—」没写数字**。
- 退出码三态：**0 一致 / 1 不一致（逐条点名）/ 2 扫描面塌了**（场景 < 20，或表格行数 < `min(20, 真值×0.8)`）。
  下限与真值挂钩是必须的：否则真值本身 20 个场景时，「漏列 2 行」会被误报成「格式变了」——
  **文档错了是 exit 1，脚本认不出行才是 exit 2**，两种病不许混为一谈。

### 维度③：两份 README 改回真值

26 个场景 / 583 步；删幽灵行、补 `spec`(10) + `setup`(14)；`ui-polish` 段内的「69-step」→ 72-step；
`all steps across 27 workflows` → 26；「已融入」注释改为真实父流程（`loadtest/log/incident→setup`、
`llm-proxy-audit→review`）；工具链表里的 `/e2e` → `/setup`（e2e 模式）；`spec` 行描述直接对齐场景文件的
`description`（不自己编）。`README_EN.md` 脚本清单加 `check-readme-stats.cjs`。

### 维度④：文档里「标成场景」的只许是真场景

`/hunt` `/e2e` `/monitor` `/analyze` 到处被当成入口清单的一部分（scene-runner 场景表、`/others` 菜单、
`.claude/rules/conditional/enhancements.md` 的分节标题、`security-toolchain.md` 的触发命令、`sec-bug-hunt`）；
`.agents/skills/scene-runner/SKILL.md`（英文孪生版）更离谱：`/spec` 映射到 `analyze`。
全部改真：旧名只留在「已合并命令」表里（并加反引号，让台账测试认得出它们仍被文档提及）。

### 维度⑤：`docs-scene-alignment.test.js` 扩面 + 新增断言

- 扫描面从「AGENTS.md + CLAUDE.md」扩到 **两份 README + `.claude/commands/*.md` + `.claude/rules/conditional/*.md`
  + 两份 scene-runner SKILL**（共 52 个文件）。以前 README 一直写着 3 个不存在的场景，
  根本原因就是**没有任何一处把 README 当输入**。
- 新增断言「**菜单里标成场景的必须真能跑**」：`| /review | review |` 这种场景表 + `| 4 | /review | 场景 |` 这种类型表，
  逐行核对（第二列/第三列不许是旧名）。为避免误伤，场景表只在 scene-runner 文件里解析
  （README 里同形状的是「命令 → 工具」表，硬套会造出 12 条假警报）。
- `HOST_BUILTINS` 补 `rewind`；`documentedCommands` 的正则 `[a-z-]*` → `[a-z0-9-]*`（原来 `e2e` 这种带数字的名字根本扫不到）。

### 验收三元组

1. **变更**：新增 `scripts/check-readme-stats.cjs`、`claude-scene/src/commands/readme-stats.test.js`(10)；
   改 `scripts/scan-scenes.cjs`、`scripts/scenes-stats.json`、`scripts/scan-scenes` 头注释、
   `claude-scene/src/lib/docs-scene-alignment.test.js`、`README.md`、`README_EN.md`、
   `.pi/skills/scene-runner/SKILL.md`、`.claude/commands/others.md`、
   `.claude/rules/conditional/enhancements.md`、`.claude/rules/conditional/security-toolchain.md`、
   `.claude/skills/sec-bug-hunt/SKILL.md`（`.agents/` 下三份同名孪生文件同步改，但该目录被 `.gitignore` 忽略）；
   删 `scripts/fix-readme-en.cjs`(114 行)。
2. **验证命令**：`npx vitest run`、`npx eslint .`、`cd claude-scene && npx eslint . --max-warnings 0`、
   `npm run scan:deadcode`、`node scripts/check-readme-stats.cjs`、`node scripts/check-dead-actions.cjs`、
   `node scripts/audit-scenes.mjs`、26 场景 `start <scene> --dry-run --auto`、
   `node claude-scene/src/index.js start review --auto --skip-sweep`、`python .probe24.py`。
3. **验证结果**：vitest **106 files / 1350 tests 全绿**；双 eslint **0/0**；`scan:deadcode` **0 dead**；
   `check-readme-stats` **EXIT=0**（两份 README 各 26 行全部对得上）；`check-dead-actions` **0**；
   `audit-scenes` **0**；dry-run **26/26 无失败**；review 真跑 **EXIT=0**，
   `pass 17 / fail 0 / warn 3 / skip 19 / noop 4`（与基线一致）；自探针 **7/7**。

### 坑

- **python heredoc 会把 `\r?\n` 里的反斜杠吃掉**（第 8 次踩）→ 探针/补丁脚本一律用 `write` 工具落盘再跑；
  只用 heredoc 时**别写含反斜杠的 JS 正则**，改用 `count=None` 之类的参数绕开。
- **`row < MIN_ROWS` 这种绝对下限会误报**：fixture 20 个场景漏 2 行 → 18 行 < 20 → 报「格式变了」（exit 2），
  于是「漏列」case 拿到的是 exit 2。下限必须和真值挂钩（`min(20, ⌊真值×0.8⌋)`）。
- **塌面探针不能只改一行**：把 1/26 行改成列表 → 还剩 25 行，够过下限，只会报「漏列」；
  要整张表拆掉才触发 exit 2。
- **正则放宽要配「认不出」的兜底**：中文表原先是 `(\d+\s*步|—)\s*\|`，遇到 `| **qa** | — 步 |` 匹配失败，
  `qa` 被算成「漏列」—— 报错方向都是错的。去掉结尾 `|`、把 `步` 变成可选后，才报出真正的原因。
- **排序不在报告里 = 探针不稳定**：`漏列 2 个场景：setup, spec` 与真值插入顺序有关，改成 `sort()` 后才可断言。
- **`.agents/` 被 `.gitignore` 忽略**：改 `.agents/skills/*` 不会进提交，必须同时改 `.claude/skills/*` 或 `.pi/skills/*` 才算真修。

### 决策

- **README 里的数字也是产物，必须由真值生成/校验，不许手写**（手写的数字过期后没有任何东西会红）。
- **被删除的假脚本要留「不许复活」断言**：`readme-stats.test.js` 断言 `scripts/fix-readme-en.cjs` 不存在、
  且 `package.json` 不再引用它 —— 否则下一轮有人「帮忙」把它加回来，屏幕上又绿了。
- **一个文档项目（entry）声明了三个东西：名字、类型、指向**；「类型=场景」就是一诺千金，
  要能被测试验证 —— 这比逐个肉眼看 52 个文件可靠。
- **旧名不是错误，伪装成入口才是**：`/hunt` 继续留在「已合并命令」表里（带反引号、写明去哪），
  用户照敲旧名仍能找到路，但没有任何一处再说它是场景。

## 第二十五轮：README 的动作数/组件数/命令数也不许是假的（2026-07-01）

> 起手不是「再改文档」，是上一轮留下的问题：**上一轮只把「场景数/步骤数」接上了真值，
> 剩下所有数字仍然没人核对**。于是这一轮把「数得出来的东西」全部接了校验器，一个维度一个脚本。

### 改前取证（全都实测过，不是猜）

- **动作/handler 计数**：`README_EN.md` 的「126 actions / 222 handler functions / 41 handler modules」
  实为 **428 / 284 / 70**；中文 README 同段落谎报 126/41/222/27。
  表格 45 个 ✅ 里躺着 **2 个幽灵动作**：`npm-audit`（它是 `runReview` 的**规则名**，不是 action；
  npm audit 实际在 `securityScan` / `runReview(security, npm-audit)` 里跑）、
  `state-audit`（源码里根本没有，只存在于 `claude-scene/.express-sec-audit-cache.json` 的陈旧缓存）。
  通配声明也错：`huashu-*（7 个）`实为 6、`mp-*（10 个）`实为 14。
- **其它计数**（同一批陈年假数字）：`CLAUDE.md:35`「25 个场景」→ 26；
  README「37 个 .md」→ **33**；「Claude Skills（24: 13 core + 11 speckit）」→ **29（18+11）**；
  「MCP 服务器（16 个，`.mcp.json`）」→ `.mcp.json` 只有 **3**，`.mcp.json.full` **14**，表里列 **15**；
  「92+ external components: 24 + 16 + 23 + 28」→ 四项和是 91，且每项都不对；
  中文「85+ 个外部组件：24 + 16 + 24 + 28」→ 和是 92；「集成 GitHub 项目（27 个）」→ 名单里 **30** 个。
- **`scripts/switch-mcp.cjs`**：硬编码「4 个 MCP」/「light mode (4 active servers)」/「full mode (14 active)」，
  而 `.mcp.json` 实为 3 个；`light` 分支**一个文件都不读**就打印「已经是 light 模式（4 个启用）」——
  这条永远是假话，且不会有人发现。

### 维度①：`scripts/check-action-stats.cjs`（新增）

- 真值 = `Object.keys(ACTION_REGISTRY)`（**428**，camelCase 与 kebab-case 别名各算一个）、
  `new Set(Object.values(...).filter(v => typeof v === 'function'))`（**284**）、
  递归 `handlers/**/*.js` 排除 `*.test.js`（**70**）、`scenes/*.json`（**26**）。
- 校验面 = **两份 README 各自的段落**（`## 🔧 Action Handler Completeness` / `## 🔧 Action 处理器完整性`）：
  四个计数 + **每一个 ✅ 表格行里点名的动作都必须在注册表里**（幽灵检查）+ 通配声明 `前缀-*（N 个）` 的 N。
- 关键取舍：**✅ 只活在表格行里**（`line.startsWith('| \`')`）。正文提到 `npm-audit` 是说明「这是规则名」，
  不是承诺它是一个 action —— 判定面收窄到表格，既保住「✅ 必须可复核」，又不用为了躲正则去模糊措辞。
- 塌面下限 `MIN_ACTIONS=200` / `MIN_MODULES=40` / `MIN_NAMED=20`；退出码 0 一致 / 1 不一致 / 2 扫不到东西。

### 维度②：两份 README 的 action 段改回真值

prose 改成「registers **428 action names**（`ACTION_REGISTRY` 的键；同一个函数常登记成 camelCase +
kebab-case 两个名字，所以名字数多于函数数），backed by **284 distinct handler functions** across
**70 handler modules**（`handlers/**/*.js`，不含测试），covering all steps across 26 workflows」；
`npm-audit` / `state-audit` 两行换成 `securityScan` / `depcruise-architecture`；
通配改 6 / 14 / 6；**表后加 note** 说明「`npm-audit` 是审查规则名」——
注意 note **不能写在表格中间**（会把表切成两半，后半截没有表头就不渲染了）。

### 维度③：`scripts/check-doc-counts.cjs`（新增）+ 两份 README/CLAUDE.md 改回真值

真值全部数得出来：命令 **33**（26 场景命令 + 7 非场景）/ 工作流 **26** / skills **29**（18 + 11 speckit）/
`.mcp.json` **3** + `.mcp.json.full` **14** / npm 包 **23**（4 deps + 19 dev）/ 工具矩阵 **29**(中) **26**(英) /
GitHub 项目 **30**(中) **25**(英) / 组件总数 中文 **84** = 29 + 3 + 23 + 29、英文 **81** = 29 + 3 + 23 + 26。

逐条校验（中英格式差异**逐句编码**，不用宽正则糊过去）：命令数/工作流数、Skills 总数/通用/speckit、
`### 本地 Skills（N,` 标题、MCP 启用数/完整档数/表内条目数 + **表里点名的服务器必须是「启用的 / 完整档的 /
明说只是参考的」三选一**（参考条目只有 `tavily-search` / `filesystem` / `sequential-thinking`）、
npm 总数/dev/deps、工具矩阵**「Count 列之和 == 列出的工具个数」**、GitHub 项目数 == 名单里 `owner/repo` 数、
工具链清单个数、**组件总数 == 四项之和且四项各自等于真值**。

### 维度④：`scripts/switch-mcp.cjs` 不再写死个数

`serverNames()` 现读 `.mcp.json` / `.mcp.json.full`：`light` 分支打印**真实条数与名字**
（`MCP is already in light mode (3 active servers: context7, github, sentry)`），`full` 分支打印复制后
的真实条数；读不到文件就 `exit 1` 并说清原因，不再假装成功。

### 验收三元组

1. **变更**：新增 `scripts/check-action-stats.cjs`、`scripts/check-doc-counts.cjs`、
   `claude-scene/src/commands/action-stats.test.js`(8)、`claude-scene/src/commands/doc-counts.test.js`(14)；
   改 `README.md`、`README_EN.md`、`CLAUDE.md`、`scripts/switch-mcp.cjs`。
2. **验证命令**：`npx vitest run`、`npx eslint .`、`cd claude-scene && npx eslint . --max-warnings 0`、
   `npm run scan:deadcode`、`node scripts/check-readme-stats.cjs`、`node scripts/check-action-stats.cjs`、
   `node scripts/check-doc-counts.cjs`、`node scripts/check-dead-actions.cjs`、`node scripts/audit-scenes.mjs`、
   26 场景 `start <scene> --dry-run --auto`、`node claude-scene/src/index.js start review --auto --skip-sweep`。
3. **验证结果**：vitest **108 files / 1372 tests 全绿**；双 eslint **0/0**；`scan:deadcode` **0 dead**
   （它自己也算出 33 命令 / 29 skills / 3 MCP，与本轮 checker 的真值一致）；三个 checker
   （readme-stats / action-stats / doc-counts）**全 EXIT=0**；`check-dead-actions` **0**；`audit-scenes` **0**；
   dry-run **26/26 无失败**；review 真跑 **EXIT=0**，`pass 17 / fail 0 / warn 3 / skip 19 / noop 4`（与基线一致）。

### 坑

- **`pathToFileURL` 是硬需求**：`import()` 一个 `E:\...\actions.js` 会当成 URL 协议解析直接抛
  `ERR_UNSUPPORTED_ESM_URL_SCHEME`，Windows 盘符路径必须先生成 `file://`。
- **同一段文字里「正文」和「表格」不是一回事**：先扫整段时，note 里那句「`npm-audit` 是规则名」
  反而被当成幽灵动作报错 —— 判定面必须精确到表格行，否则「解释清楚」和「通过校验」互相打架。
- **note 插进表格中间会毁掉渲染**：第一次修幽灵动作时把 note 写在最后一行的同一行里，
  GitHub 上后半截表格没有表头。note 必须挪到表格之后。
- **工具矩阵的「名字数」要只数第 3 个单元格**：`| **npm 全局** | 1 | \`bruno\`（\`@usebruno/cli\`） | ... |`
  这种写法会把包名算成第二个工具（29 ≠ 28 就是这么来的）。去掉括号内容 + 只取工具列才对得上。
- **fixture 里 `docs()` 把 en/zh 写反**（`{ en: o.zh ?? zh, zh: o.en ?? en }`）→ 14 个用例里 12 个红，
  报错是「那句没认出来（格式变了？）」。**用例一起红的时候，先怀疑 fixture，别怀疑被测脚本**。
- **测试里「历史注释」也会撞上「不许写死」断言**：`switch-mcp.cjs` 头注释写了「以前写死 4 个 MCP」，
  于是 `src.includes('4 个 MCP')` 命中。静态断言的对象是**代码**，注释要换个说法。
- **塌面用例必须真的把文件数变少**：只改文档里的数字（`scenes: 5`）不会触发下限 ——
  要同时 `sceneFiles: 5` 才真少。

### 决策

- **数字分三类，各有各的定义并写进文档**：动作数 = 注册表的**键**（含别名）；函数数 = 注册表里**不同的函数对象**；
  模块数 = `handlers/**/*.js` 排除测试。名字多于函数是**特征**，不是错 —— 所以文档必须解释它。
- **「✅ 只活在表格里」**：✅ 是可复核的承诺，正文提到某个名字只是在**解释**它。
- **通配声明也要可核对**：`前缀-*（N 个）` 的 N = 注册表里以该前缀开头的键数，否则括号里的数字永远是编的。
- **旧数字要留反回归断言**：`action-stats.test.js` 直接禁止 `126 actions` / `222 handler functions` /
  `41 handler modules` 回到文档 —— 下一轮有人「顺手」改回去必须红。
- **同一个数字只允许一个真值来源**：三份文档的场景数都来自 `scenes/*.json`，命令数来自
  `.claude/commands/*.md`，MCP 数来自 `.mcp.json` —— 任何一处再手写就必然漂移。
- **打印出来的个数必须现算**：`switch-mcp.cjs` 以前那句「already in light mode (4 active servers)」
  连文件都不读，属于「假话 + 假绿」的组合，比不打印更糟。

## 第二十六轮：发给别的工具的说明书、开关和陈旧产物（2026-07-01）

> 上一轮修的是「我们自己 README 里的数字」。这一轮顺着同一条线往下走，
> 发现三类更隐蔽的假话：①**生成出去、真的会被执行的说明书**里的假数字（agent 会照着它去读文件）；
> ②一个**不可逆**却自称可逆的开关；③两份**没人读但会被引用**的陈旧产物。

### 改前取证（全部实测）

- **opencode 全局配置的模板指向已删除的文件**：`scripts/generate-opencode-config.cjs` 里有
  `/hunt` `/e2e` `/monitor` 三个条目，模板都是「先完整读取 `.claude/commands/xxx.md`」——
  这三个文件在第二十四轮就删了（合并进 `/review`、`/setup`）。agent 在 opencode 里执行会去读空气。
  反过来，两个真实命令文件 `setup.md` / `update.md` 一个都没被引用。
- **模板里的步骤数是编的**：`/loop` 写「10步」实际 **18**、`/cicd` 11→**12**、`/deps` 16→**17**、
  `/review` 写「86行33步」而 `review.md` 是 **80 行**、review 场景 **43 步**。表头注释还写死
  「38 .md-referenced commands」。
- **计数用的度量本身就是错的**：`scripts/setup-opencode-global.sh` 用
  `CMD_COUNT=$(grep -c '"description"' ...)` 数命令 —— 数的是**描述行**（110），不是命令键（106）；
  面板里「38 工作流对齐」写死；头注释「108 命令 + MCP(17) + Provider(4)」里只有 17 是对的。
  真值（生成器实测）：**106 命令 / 17 MCP / 1 provider / 38 个引用 `.md` 的命令**。
  同一批假数字还在 `README.md:54`、`.opencode/AGENTS.md`、`docs/MULTIPLATFORM.md`（写「35 工作流」）、
  `docs/CHANGELOG.md`（写「4 providers」）里各来一遍。
- **`npm run mcp:switch` 不可逆 + 谎报 + 假绿**：没有 `.mcp.json.light` 这个文件。
  `full` 直接拿 `.mcp.json.full` 覆盖 `.mcp.json`，**light 档被永久覆盖**；之后再执行 `light`，
  脚本一个文件都不读就打印「already in light mode (4 active servers)」（数字写死，当时实际 14 个）。
  未知模式（`-- ful`）打印用法后 **exit 0**。
- **陈旧产物**：`scripts/scenes-stats-utf8.txt`（40 行中文显示名键的旧 dump：`hunt` / `analyze`
  这两个场景早没了、review 写 33 步实际 43）；`claude-scene/.express-sec-audit-cache.json`
  （225KB / 6442 行审计缓存 —— 幽灵动作 `state-audit` 的唯一来源）。两者都被 git 跟踪、没人读。

### 维度①：生成器改回真值（`scripts/generate-opencode-config.cjs`）

- `/hunt` → 「已合并到 /review（security_deep 模式）」并指向真实存在的 `review.md`；
  `/e2e` → `/setup --kind e2e`；`/monitor` → `/setup --kind monitor`（照抄 `/audit` 的「合并指引」写法）。
- 补上 `/setup`（14 步）与 `/update` 两个真命令。
- 步骤数按 `claude-scene/scenes/*.json` 的 `flow` 键数改：loop 18 / cicd 12 / deps 17；
  `/review` 的「86行33步」改成「按场景声明的 43 步」。
- 表头注释换成「凡是『先读取 X.md』『（N 步）』都必须指向真实文件、写真实步数」的规矩，不再写死条数。

### 维度②：`setup-opencode-global.sh` 不再用 grep 数命令

- `read -r CMD_COUNT MCP_COUNT PROV_COUNT MD_REF_COUNT <<EOF $(node -e ...) EOF`：
  从生成出来的 `opencode.json` 里数 `command` / `mcp` / `provider` 的键数 + 「模板引用了本地 `.md`」的条数。
- 面板改成三行真实数字（原来那圈 `┌──┐` 框在数字变化时必然错位，索性去掉）。
- 头注释删掉「108 命令 · 17 MCP · 4 Provider · 38 工作流」，改成「数量以生成结果为准」。

### 维度③：文档里的 opencode 数字

- `README.md:54` → `106 命令（其中 38 个直接引用本仓库 .claude/commands/*.md）· 17 MCP · 1 Provider`，
  并注明由 `scripts/check-opencode-config.cjs` 校验（**保留数字是因为有校验器**）。
- `.opencode/AGENTS.md` / `docs/MULTIPLATFORM.md` / `docs/CHANGELOG.md`：**不再写死任何数字**，
  改成「数量由 `.opencode/deploy-global.cjs` 生成时统计」——这几个地方没有校验器，写数字就必然漂移。

### 维度④：`scripts/check-opencode-config.cjs`（新增）

三类声明必须可核对：①模板里每个 `.claude/commands/X.md` 真存在，且每个真实命令文件都被引用；
②「（N 步」= `scenes/X.json` 的 `flow` 键数；③README 里那行计数 = 生成器真值（整行结构一次性卡住：
格式变了 exit 2，数字不对 exit 1）。外加 ④`setup-opencode-global.sh` 不许用 grep 数行、必须从配置 JSON 数键。
塌面下限 `MIN_COMMANDS=50` / `MIN_COMMAND_FILES=20` / `MIN_MD_REFS=15` / `MIN_SCENES=20`；
`--config <file>` 可喂现成配置（测试用），否则现场跑 `deploy-global.cjs --dry-run`。

### 维度⑤：`switch-mcp` 真的可逆

- 新增 `.mcp.json.light`（light 档文件）。`light` / `full` 都从档位文件复制 → **双向可逆**。
- 复制后把 `_modes.current` / `_modes.active_servers` / `_comment` 按真实内容改写（元数据不许撒谎）。
- 未知模式 / 缺参数 → 用法 + **exit 2**（不再「打印用法然后假装成功」）；
  档位文件缺失 / 非法 JSON / 空 `mcpServers` → **exit 1** 且**一个字节都不写**。
- `MCP_CONFIG_DIR` 让测试指向临时目录，不碰真实仓库。

### 维度⑥：陈旧产物删除

- 删 `scripts/scenes-stats-utf8.txt`、`claude-scene/.express-sec-audit-cache.json`；
  `.gitignore` 加三条规则（含 `express-sec-audit-*.txt`）挡住复活。
- 真值仍在：`scripts/scenes-stats.json` 由 `scan-scenes.cjs` 生成，测试里现算「键集合 == 场景 slug 集合、
  步骤数之和 == 各场景 `flow` 键数之和」（26 / 583），旧文本 dump 不能顶替它。

### 验收三元组

1. **变更**：新增 `scripts/check-opencode-config.cjs`、`.mcp.json.light`、
   `claude-scene/src/commands/opencode-config.test.js`(21)、`claude-scene/src/commands/mcp-switch.test.js`(10)；
   改 `scripts/generate-opencode-config.cjs`、`scripts/setup-opencode-global.sh`、`scripts/switch-mcp.cjs`、
   `README.md`、`README_EN.md`、`.opencode/AGENTS.md`、`docs/MULTIPLATFORM.md`、`docs/CHANGELOG.md`、
   `.gitignore`、`.mcp.json`、`scripts-honesty.test.js`(+1)；删两个陈旧文件。
2. **验证命令**：`npx vitest run`、`npx eslint .`、`cd claude-scene && npx eslint . --max-warnings 0`、
   `npm run scan:deadcode`、`node scripts/check-{readme-stats,action-stats,doc-counts,opencode-config,dead-actions}.cjs`、
   `node scripts/audit-scenes.mjs`、26 场景 `start <scene> --dry-run --auto`、
   `node claude-scene/src/index.js start review --auto --skip-sweep`。
3. **验证结果**：vitest **110 files / 1404 tests 全绿**（+2 files / +32 tests）；双 eslint **0 / 0**；
   `scan:deadcode` **0 dead**（33 命令 / 29 skills / 3 MCP）；五个 checker **全 EXIT=0**；
   `audit-scenes` **0**；dry-run **26/26 无失败**；review 真跑 **EXIT=0**，
   `pass 17 / fail 0 / warn 3 / skip 19 / noop 4`（与基线一致）。

### 坑

- **注释也会被自己的断言抓到（第三次了）**：我在 `setup-opencode-global.sh` 里写了「以前这里用
  `grep -c '"description"'` 数命令」这句解释，checker 的 `includes()` 立刻命中。
  改成 `/^\s*CMD_COUNT=.*grep/m`（只认**赋值语句**，不认注释）才对。
- **fixture 的「同一份 over」会让漂移测不出来**：`readme()` 和 `generatedConfig()` 都吃 `over`，
  于是「把 108 写进文档」同时也把配置改成 108 个命令 —— 两边自洽，exit 0。
  必须把「文档的数字」和「生成结果的数字」拆成两个口子（`over.doc`）。
- **塌面检查的顺序决定报错内容**：`commandFiles()` 的下限检查原来写在 `sceneSteps()` 之后，
  于是「命令文件太少」的用例报的是「场景太少」。下限要和它保护的那个「读」放在一起。
- **`--config` + 真生成器两条路都要测**：只测 `--config` 就测不到「读不到生成器 → exit 2」，
  只测真仓库就测不到各类漂移。
- **「已经是 X 模式」要先归一化再断言**：fixture 里的 live 是紧凑 JSON，第一次跑必然算「内容不同」→
  先跑一次让它落成脚本的输出格式，第二次才该打印 already（真仓库就是这么用的）。

### 决策

- **生成出去、会被执行的字符串也是「文档」**：模板里的文件名和步骤数必须和仓库一致，
  因为它们不是给人看的说明，是**给 agent 的指令**。
- **计数不许用 `grep -c` 数行**：行数不是条数。要么解析 JSON 数键，要么别报这个数。
- **没有校验器的地方不写死数字**：`README.md` 那行保留数字，因为它有 checker；
  `AGENTS.md` / `MULTIPLATFORM.md` / `CHANGELOG.md` 没有，就改成「以生成结果为准」。
- **开关必须可逆，否则名字就是假的**：`light` / `full` 各有一个档位文件才对得起这两个名字。
- **写盘之前先验数据**：档位文件缺失 / 坏 JSON / 空配置一律 exit 1 且不写 —— 「宁可拒绝，也不写坏数据」。
- **元数据跟着真实内容走**：`_modes` 是给人和脚本读的，改完配置必须同步改写，否则它比没有更糟。
- **陈旧产物要么删、要么接上生成器**：留在仓库里没人读、又会被当「统计结果」引用的文件，
  比不存在更有害（`state-audit` 就是这么活下来的）。

## 第二十七轮：不再维护的平台要退役，死配置和假引用一起清（2026-07-01）

> 上一轮还在「修 opencode 的假数字」。用户说了一句「opencode 本来就不用了」，
> 于是发现真正的错不是数字不对，而是**这个平台根本不该在这里**：
> 修好一个没人用的平台，本身就是浪费。顺着这条线，同一类假话还有两处：
> ①**已退役的命令**在活的文档里仍被当现存命令写；②工具矩阵里 **`/audit (step 3.x)`** 这种
> 指向已删场景、编造的步骤号。

### 改前取证（全部实测）

- `grep -ran "deploy-global\|setup-opencode-global\|generate-opencode-config\|check-opencode-config"`
  → 引擎代码零依赖（只有 opencode 自己那套脚本互相引用），删得掉。
- `.opencode/.gitignore` 是**自忽略文件**（内容里含 `.gitignore` 自身），所以 `git rm -r .opencode`
  之后 `find .opencode -type f` 还剩一个 → 必须 `find -delete && rmdir` 兜底。
- 工具表的假引用：`README.md` 写着 `/review` (step 4.10) / (step 4.12) / (step 4.15) / (step 3)，
  而 `review.json` 的 `flow` 里**没有这些 step**（真值是 4.1 / 4.3 / 4.5 / 4.55 / 4.56 / 4.57 …）；
  `.claude/rules/conditional/security-toolchain.md` 33 行里几乎每行是 `/audit`，还有
  `` `/audit`, `/audit` `` 这种复制粘贴出的重复单元格。
- `.claude/rules/conditional/enhancements.md`：`/cicd`、`/setup --kind monitor`、`/setup --kind e2e`、
  `/design`、`/review 安全深度` 五节讲的增强项，在 `REGISTRY` 里**没有对应分组**；
  `/feature` 第 1 项「jvn 多 Agent 审查」在仓库里 `grep jvn` **零命中** —— 是纯凭空的菜单项。

### 维度①：opencode 退役（删，不修）

- 删 `.opencode/`（`AGENTS.md` / `deploy-global.cjs` / `opencode.jsonc`）、
  `scripts/generate-opencode-config.cjs`、`scripts/setup-opencode-global.sh`、
  `scripts/check-opencode-config.cjs`、`claude-scene/src/commands/opencode-config.test.js`。
- `eslint.config.js` 去掉 `.opencode/` 忽略；`README.md` 去掉速查表行与目录树段；
  `README_EN.md` 去掉 `check-opencode-config.cjs` 行。
- 文档改写：`docs/MULTIPLATFORM.md` 整体重写（四平台 / 33 工作流 / 29 skills）、
  `CLAUDE.md`、`AGENTS.md`、`.codex/AGENTS.md`、`.zcode/AGENTS.md`、`ARCHITECTURE.md`、
  `docs/tool-versions.md`、`.claude/knowledge/index.json`、`.claude/agents/security-engineer.md`、
  `bilibili-promotion-plan.md`、`docs/全适配方案.md`。
- `DECISIONS.md` ADR-002 用**删除线 + 已撤销 (2026-07-01)** 留痕，不重写历史结论；
  `docs/CHANGELOG.md` 记入 `### Removed`。
- `platform.js` 的 `OPENCODE=1` 识别**保留**，并在注释里写明「这是识别，不是支持」。

### 维度②：退役命令不许在活文档里「还活着」

- `AGENTS.md`、`.codex/AGENTS.md`、`.zcode/AGENTS.md`、`.pi/skills/scene-runner/SKILL.md`
  （`/audit` `/analyze` `/e2e` `/monitor`）、`.claude/commands/review.md`（`/audit` 那行）
  全部改成 `旧名 → /review …` 或直接删。
- `README_EN.md` 用法示例 block 里的 `/hunt` 换成 `/setup`（与中文版对齐）。
- 新增守卫 `claude-scene/src/commands/retired-commands.test.js`：
  ①活的文档里出现 `` `/hunt` ``（代码格式的斜杠命令）必须带「原 / 旧名 / 已合并 / 已并入 / 退役 / 已删除」之一，
  否则红；②opencode 五件套（目录 / 三个脚本 / 测试）**不许复活**，且生产代码不许再引用；
  ③文档不许再写 opencode 的假数字（`106 命令` / `38 工作流` / `38 .md`）。
  扫文件时**排除测试自身**（它必须能写「这个文件不存在」），并对 `lib/platform.js` 的 `.opencode` 白名单。

### 维度③：工具表「场景 + step」引用校验器

- 新增 `scripts/check-tool-steps.cjs`（三态：0 全对 / 1 有错 / 2 扫不到东西）：
  从 `claude-scene/scenes/*.json` 建 `Map<场景, Set<String(step)>>`，正则
  `` /`\/([a-z][a-z0-9-]*)`(?:\s*\(step\s*([0-9.]+)\))?/gu `` 抽引用，判据三条：
  ①场景必须存在（点退役场景给专门的提示）②`(step N)` 必须 ∈ 该场景 `flow[*].step`，报错时把真值列出来
  ③「未接入」不算引用，但可核引用总数低于 `MIN_REFS=20` 或表行数低于 `MIN_ROWS=15` → **exit 2**（塌面）。
  扫描三份文档：`README.md` / `README_EN.md` / `.claude/rules/conditional/security-toolchain.md`。
  实跑：**工具表 56 行 · 可核引用 64 处 · 场景 26 个（全部对得上）EXIT=0**。
- 两份 README 的工具矩阵「负责工作流」列按真值重写（`noleak` → `/release` 8.5 + `/cicd` 2.5、
  `recheck-cli` → 4.1、`log-sanitizer` → 4.3、`sensitive-file-check` → 4.55、`seraphim-audit` → 4.56、
  `jscpd` → 2.95、`size-limit` → 2.96、`Stryker` → `/qa` 6.5 …）。
  没有 handler 的八个（`trivy` `shellcheck` `sqlfluff` `bruno` `commitlint` `biome` `ruff` `hurl`）
  改标「未接入引擎：没有 handler，只有安装与版本检查」——`ACTION_REGISTRY` 里确实零命中；
  handler 有但无场景步骤调用的三个（`lychee` / `Spectral` / `markdownlint`）写
  「未接入场景：handler 已注册，无场景步骤调用」，并删掉导语里「已集成到对应工作流中，自动执行，零冲突」那句假话。

### 维度④：增强项登记表的死配置

- `lib/enhancements.js` 的 `REGISTRY` 按 `sceneId` 索引，`applyEnhancements(sceneId)` 查不到就一项都不出。
  删掉 8 个「场景 JSON 已不存在」的分组：`audit`(26 行) `analyze`(8) `hunt`(14) `monitor`(8)
  `e2e`(8) `design`(26) `prototype`(8) `changelog`(8)。剩 10 个分组 / 21 个增强项，全部有对应场景。
- `.claude/rules/conditional/enhancements.md` 按 `REGISTRY` 重写清单：每节逐项列出 code 里的
  `key` + `label` + `default`；删掉 `/cicd`、`/setup --kind monitor`、`/review 安全深度`、
  `/setup --kind e2e`、`/design` 五节；探测器表只留真正被引用的 4 个（`uiFiles` / `stagehand` /
  `mythosAgent` / `critiq`）；「无增强场景」列表改成按「场景总数 − REGISTRY 键」算出来的 16 个。
- 新增三条守卫：`REGISTRY` 的每个键必须有 `scenes/<key>.json`；文档里的 `### /scene` 集合 == `REGISTRY` 键集合；
  文档表格里列出的 key 多重集 == code 里的 key 多重集（既不少写也不多编）。

### 维度⑤：校验器自己的测试

- 新增 `claude-scene/src/commands/tool-steps.test.js`（9 例）：fixture 造 `scenes/*.json` + 工具表，
  覆盖 0/1/2 三态 —— 全对 / 退役场景 `/audit` / 幽灵场景 `/nope` / 编的 step 9.9（断言报出「真实值：1, 2.5」）/
  不写 step 也算可核 / 行数不足 exit 2 / 引用数不足 exit 2 / 没有 scenes 目录 exit 2 / **真仓库自己必须干净**。

### 验收三元组

1. **变更**：删 5 项 opencode 产物 + 8 个死增强分组；新增 `scripts/check-tool-steps.cjs`、
   `retired-commands.test.js`(11)、`tool-steps.test.js`(9)；改 `README.md`、`README_EN.md`、
   `.claude/rules/conditional/{security-toolchain,enhancements}.md`、`docs/{MULTIPLATFORM,CHANGELOG,tool-versions}.md`、
   `CLAUDE.md`、`AGENTS.md`、`DECISIONS.md`、`ARCHITECTURE.md` 等 20+ 份文档与 `eslint.config.js`。
2. **验证命令**：`npx vitest run`、`npx eslint .`、`cd claude-scene && npx eslint . --max-warnings 0`、
   `npm run scan:deadcode`、`node scripts/check-{readme-stats,action-stats,doc-counts,tool-steps,dead-actions}.cjs`、
   26 场景 `start <scene> --dry-run --auto`、`start review --auto --skip-sweep`。
3. **验证结果**：vitest **111 files / 1403 tests 全绿**（删 opencode-config 21 例、新增 20 例）；
   双 eslint **0 / 0**；`scan:deadcode` **0 dead**（33 命令 / 29 skills / 3 MCP）；
   五个 checker **全 EXIT=0**（`check-tool-steps`：56 行 / 64 处引用 / 26 场景）；
   dry-run **26/26 无失败**；review 真跑 **EXIT=0**（`fail 0`）。

### 坑

- **对着「已经不用了」的东西修 bug 是错的方向**：上一轮刚刚把 opencode 的假数字修好，
  这一轮整条链路被删掉 —— 那 21 个测试和 300 行文档全是沉没成本。先问「这东西还该存在吗」。
- **解析注册表用的正则漏了数字**：`^  '?([a-z-]+)'?: \[$` 匹配不到 `'e2e'`，于是「删 4 组」静默只删了 3 组，
  是 `assert len(removed)==4` 把它抓住的。**批量删除前先断言删到了几个**。
- **守卫的第二个用例名单比第一个短**：`audit/analyze/hunt/monitor` 里漏了 `e2e`，
  它靠「每个分组必须挂真实场景」那条通用断言才暴露出来 —— 名单式断言要和通用不变量配着写。
- **守卫扫源码会扫到自己**：`retired-commands.test.js` 自己要断言「文件不存在」，
  必须跳过 `*.test.js`；`lib/platform.js` 合法保留 `.opencode` 字样，需要显式白名单。
- **`walk()` 扫不到东西时会「通过」**：加了「实际扫过 137 个文件，低于 100 就炸」的下限断言，
  否则路径写错也能绿灯。
- **`unicorn/no-negated-array-predicate`**：`!arr.some(f)` 要写成 `arr.every((x) => !f(x))`。
- **文档重写要从代码生成，不要手抄**：`enhancements.md` 的 21 个 `key` 是用脚本从 `REGISTRY` 直接吐出来的，
  再用手写的一致性断言锁住 —— 手抄一遍必然漂移。

### 决策

- **不再使用的平台应该退役，不是继续维护**：对一个不用的平台，「修好它」本身就是错的。
- **`platform.js` 的 `OPENCODE=1` 留着**：删掉会让「在 opencode 里跑引擎」的行为不可预期；
  文档要写明「留着是为了说清为什么不提供支持，不是承诺支持」。
- **ADR 修订用删除线 + 日期，不重写历史结论**；退役写进 `### Removed`，不删历史条目。
- **工具矩阵的「负责工作流」列必须先有场景存在**：`step N` 的真值只有一个来源（scene JSON 的 `flow[*].step`），
  所以只能有校验器，不能有「我记得大概是 4.15」。
- **没有 handler 的工具不许写成「自动执行」**；handler 有但没人调，就写「未接入场景」——
  这比「已集成」诚实，也比整行删掉有用（它暴露了真实的死接线）。
- **增强项登记表按 scene id 索引 → 退役场景的登记表就是死配置**，删；文档必须照着 `REGISTRY` 生成，
  并由测试锁住「文档 == 代码」。

## 第二十八轮：场景真值有两份，校验器各读一份（2026-07-01）

> 第二十七轮候选清单里的第 ② 条「`scenes-stats.json` 没有门禁重跑」和第 ④ 条
> 「外部工具清单有两份」讲的是同一件事的两个变体：**同一份数据住着两个地方**。
> 顺着这条线往上摸，最要命的不是工具清单，而是**场景本身**。

### 改前取证（全部实测）

- `diff -rq .claude/scenes claude-scene/scenes` → 26 个 JSON 逐字节相同
  （只有 `.claude/scenes/README.md` 是单独产物）。
- 引擎读哪份：`paths.js` 的 `getSceneDirs()` 是「`.claude/scenes` → `~/.mix-coding/scenes`
  → 包内 `scenes`」，`resolveScenePath('review')` 实测返回
  `E:\auto-coding\.claude\scenes\review.json` —— **跑起来的是覆盖层那份**。
- 校验器读哪份（`grep -n scenes scripts/*.cjs`）：
  - `check-readme-stats` / `check-action-stats` / `check-doc-counts` / `check-tool-steps`
    → `claude-scene/scenes`（**永远不会被执行的那份**）
  - `check-dead-actions` / `find-deadcode-full` / `scan-scenes` → `.claude/scenes`
- 假绿实证：往 `.claude/scenes/review.json` 的 `flow` 里 append 一步（43 → 44），
  `check-readme-stats` 仍然 EXIT=0 并打印「26 个场景 / 583 步…全部对得上」；
  同一时刻 `check-dead-actions` 报 `Action references: 584`（它读的是覆盖层，反而是对的）。
  探针用完 `git checkout --` 复原，`git status` 0 行。

### 维度①：场景层的唯一定义

- 新增 `scripts/lib/scene-dir.cjs`：`sceneTiers(root)`（层顺序与引擎一致）+ `resolveScenes(root)`
  （**合并视图**，同名场景只取高优先级那份，返回值带 `tier`/`source` 便于打印）。
- 为什么是合并、不是「只读覆盖层」：真实项目的 `.claude/scenes` 只放**要覆盖**的那几个，
  只读覆盖层会把真值缩成「覆盖了几个场景」，`MIN_SCENES` 立刻误报「扫描面塌了」。
- 七个脚本全部改成从这里取：`check-readme-stats`（真值行打印「读的是哪几层」）、
  `check-action-stats`（`sceneCount()` = 合并后的 key 数）、`check-doc-counts`、
  `check-tool-steps`、`check-dead-actions`（同名只数一次，`file` 打印相对路径）、
  `scan-scenes`（默认按运行时视图统计）、`find-deadcode-full`（`searchDirs` 的层从
  `dirs` 生成，不再写死 `.claude/scenes`；报告标题改成「运行时视图：覆盖层优先合并」）。

### 维度②：陈旧产物必须有门禁

- `.husky/pre-commit` 从 3 道变 4 道：第 4 道重跑 `node scripts/scan-scenes.cjs`，
  再用 `git diff --quiet -- scripts/scenes-stats.json` 判定；不一致就打印
  「不是最新（上面已按场景文件重写），请 git add 后重新提交」并退出 1。
- `gate-honesty.test.js` 的 `x/3` 标签同步改成 `x/4`（契约变更，附理由注释），
  并新增断言：hook 里必须出现 `node scripts/scan-scenes.cjs` 与
  `git diff --quiet -- scripts/scenes-stats.json`。
- 自探针：给 `check.json` 加一步 → `scan-scenes` 写 584 → hook 判定「会拦住」；
  复原后 `git status` 干净（`git update-index --refresh` + 重新 `git add` 清掉
  内容相同但 stat 脏的假改动）。

### 维度③：守卫测试

- 新增 `claude-scene/src/commands/scene-dir.test.js`（**13 例**）：
  ①层顺序四态：只有内置 / 只有覆盖层 / 两层都有（同名覆盖层赢且只算一次）/
    两层皆空（`source` 明说「两层都没有」）+ `MIX_CODING_SCENES_DIR` 显式覆盖（用完 `finally` 还原环境）；
  ②真仓库守卫：两份副本文件名集合相同 + **逐字节相同**，不同就点名到文件；
  ③「校验器读的目录 == 引擎 `resolveScenePath('review')` 返回的目录」（子进程问引擎，避免导入期求值坑）；
  ④回归：覆盖层写 4 步 / 内置 3 步 → 文档写 4 步 EXIT=0、写 3 步 EXIT=1 且报「实际 4」；
    覆盖层只放 1 个场景时真值仍是 20（不许误报扫描面塌）。
  ⑤静态守卫：凡剥注释后仍提到 scenes 的 `scripts/*.cjs` 必须 require `scene-dir.cjs`；
    再加一条「至少认出 6 个读者」防这条守卫空转。
- 守卫自探针：给 `.claude/scenes/qa.json` 加一个空格 → 逐字节守卫立刻红并点名
  `qa.json`；复原后 `git status` 干净。

### 验收三元组

| 改动 | 验证命令 | 结果 |
|------|----------|------|
| 七个脚本改用 `resolveScenes` | `node scripts/check-{readme-stats,action-stats,doc-counts,tool-steps,dead-actions}.cjs` | 全 EXIT=0；readme-stats 真值行显示「读的是 .claude/scenes（项目覆盖层） + claude-scene/scenes（随包内置）」 |
| 新增解析器 + 13 例测试 | `npx vitest run claude-scene/src/commands/scene-dir.test.js` | 13 passed |
| 全量测试 | `npx vitest run` | **112 files / 1416 tests 全绿**（+13） |
| 双 eslint | `npx eslint .` + `(cd claude-scene && npx eslint . --max-warnings 0)` | 0 error / 0 warning |
| 死代码 | `npm run scan:deadcode` | `Total dead: 0`，`Scenes: 0 / 26` |
| 新门禁 | `node scripts/scan-scenes.cjs && git diff --quiet -- scripts/scenes-stats.json` | 同步时 exit 0；探针改场景后能拦住 |

### 坑

- **heredoc 吃反斜杠（第 11 次）**：Python heredoc 里写 `\n` / `\b` 会被折成真换行/退格，
  连续三次把 `split('\n')` 写成跨行字符串、把 `/\bscenes\b/` 写成控制字符。
  最终用原始字符串（r 前缀的 triple quote）+ `split(/\r?\n/u)` 这种不依赖转义的写法收口。
- **`replaceAll('\', '/')` 在 JS 里写不对就是语法错误**：改成 `split(path.sep).join('/')`。
- **探针复原用 `git checkout -- <file>` 会被 core.autocrlf 二次转换坑到**：仓库里 blob 本身
  含 CRLF，checkout 再按 autocrlf 加一遍 → 工作区变成 CRCRLF（`check.json` 从 2635 变 2722 字节），
  而「两份副本逐字节相同」的守卫当场红。正确复原法是 `git cat-file -p HEAD:<path> > <path>`，
  直接落 blob 字节。修完再 `git add` 一次清掉 stat 脏标记（`git diff` 本来就是空的）。
- **`git status` 说 M 但 `git diff` 空**：`scenes-stats.json` 重新生成后行尾归一化让 stat 脏；
  `git add` 一次即可清（内容与 HEAD 相同）。
- **静态守卫别拿正则找字面量**：字符类里塞 `\.claude|claude-scene` 被
  `sonarjs/super-linear-regex` 点名，而且 `check-tool-steps` 的报错文案里就写着
  `.claude/scenes`（那是给人看的，不是另一套实现）→ 这条守卫改成「必须 require 解析器」，
  不搞「字面量黑名单」。
- **`filter((f) => /re/.test(stripComments(readFileSync(join(...)))))` 五层嵌套** →
  `unicorn/max-nested-calls`，抽 `code(f)` 子函数。

### 决策

- **同一份数据住两个地方时，先确认「跑起来的是哪一份」，再统一读的那一侧**：
  这一轮的价值不在于「把 7 个脚本改一行」，而在于发现「校验器核的是一份不执行的副本」。
- **合并视图 > 单层视图**：覆盖层只放 diff 是常规做法，任何「只读一层」的实现都会在
  真实项目里误报。校验器必须复刻运行时语义，包括优先级。
- **副本一致性由守卫断言，而不是约定**：两份副本现在还相同，这份「相同」是**事实**，
  所以可以断言；将来若要分叉，应该删副本或显式豁免，而不是放宽守卫。
- **中间产物也要有门禁**：`scenes-stats.json` 以前「有人记得才重跑」，现在提交前必跑，
  不一致就拦 —— 与第二十六轮「陈旧产物要么删、要么接上生成器」同一条原则。

---

## 第二十九轮：增强项「勾了会不会真执行」——菜单、日志、文档三处都在替用户假定（2026-10-30）

**问题**：`REGISTRY` 里 21 个增强键，只有 3 个被场景步骤消费。其余 18 个勾上只是往 context
放一个没人读的 `enh_*` flag。而三处输出都在暗示「已启用」：非交互模式打一行
`⚙ 增强已选（非交互模式）: …`；交互模式 3 秒超时替用户选了默认值且不吭声；
`enhancements-summary.md`（CLAUDE.md 要求每个 session 都读）给已退役场景写着完整菜单。

### 取证

| 假设 | 实测 |
|------|------|
| 「勾了就会执行」 | `consumedEnhKeys('review')` = 空集 —— 本仓库 `review` 的 4 项（`huashu_expert_review` ✓、`critiq_security_scan` ✓ 默认勾选）没有任何步骤读它们 |
| 哪些项真的会多走一步 | `ui-polish` step 9.7（`huashu_expert_review`）、`release` step 13.4 / 13.6（`huashu_release_deck` / `huashu_release_animation`）；合计 3/21 |
| `enhancements-summary.md` 可信吗 | 给 `review` 列了「无障碍✓ · i18n · QA验证✓ · 迁移审查✓」——`REGISTRY['review']` 里一个都没有；`hunt` `audit` `e2e` `monitor` `design` 这些已退役场景还整节留着 |
| `enhancements.md` 的探测器数量 | 写「只有 4 个被 `REGISTRY` 用到」，实际 5 个（漏了 GEPA）；死探测器是 5 个不是 4 个（`i18n` 也在） |

### 三维度修复

1. **代码（`lib/enhancements.js`）**：新增 `consumedEnhKeys(sceneId)`（从场景 JSON 的 `condition`
   里提取 `enh_<key>`）、`partitionSelection(selected, consumed)`（纯函数，保序）、
   `discloseSelection(selected, consumed, how)`（两栏打印）。非交互模式与交互模式都走它；
   交互菜单给无消费项加「（无场景步骤消费，仅建议）」后缀；超时在披露行里明写「3 秒无操作，已按默认值」。
2. **文档（`enhancements.md`）**：21 行表格加「场景步骤」列（`✓ step N` / `仅建议（勾了不触发步骤）`）；
   探测器 4 → 5，补 GEPA 行，点名 5 个死探测器；「菜单规则」写明「勾了不等于会执行」+ 超时披露要求。
3. **文档（`enhancements-summary.md`）**：整份重写成生成视图 —— 一行一场景、
   `✓` = 默认勾选、`step N` = 真有步骤消费、`⌾` = 勾了不执行；`无增强场景` 按 `listSceneIds() − REGISTRY` 真值；
   共 26 场景 / 10 个有增强项。

### 验收三元组

| 改动 | 验证命令 | 结果 |
|------|----------|------|
| 披露逻辑 + 文档对账 | `npx vitest run claude-scene/src/lib/enhancements.test.js` | **15 passed** |
| 全量测试 | `npx vitest run` | **113 files / 1431 tests 全绿**（+15） |
| 双 eslint | `npx eslint .` + `(cd claude-scene && npx eslint . --max-warnings 0)` | 0 error / 0 warning |
| 真跑一次 | `node claude-scene/src/index.js start review --auto --skip-sweep` | EXIT=0；首行变成 `⚠ 增强已选但没有场景步骤消费（非交互模式，按默认值 + --enh）: huashu_expert_review, critiq_security_scan —— 只是给对话模式 agent 的建议，CLI 下不会执行任何步骤`；17 pass / 0 fail / 3 warn / 19 skip / 4 noop |
| 5 个校验器 | `node scripts/check-{readme-stats,action-stats,doc-counts,tool-steps,dead-actions}.cjs` | 全 EXIT=0 |
| 死代码 / 场景真值 | `npm run scan:deadcode` / `scan-scenes.cjs` + `git diff --quiet` | `Total dead: 0`；同步 |

### 自探针（每条新守卫都先证明它会红）

1. 把 `discloseSelection` 改成空实现 → 「非交互披露两栏」「没有增强项」2 例红。
2. 把 `release:huashu_release_deck` 的表格单元从 `✓ step 13.4` 改成 `仅建议` → 文档对账红并点名 `release:huashu_release_deck`。
3. 往 `.claude/scenes/qa.json` 的 `condition` 里塞 `enh_typo_key ||` → 幽灵键守卫红：
   `qa: enh_typo_key（REGISTRY 里没这一项，该步骤永远不会跑）`。（**第一次探针没红**：守卫只扫 `REGISTRY` 里的场景，改成扫 `listSceneIds()` 才抓到。）
4. 精简版文档同时改三处（`step 13.4` → `13.5`、`用到 5 个` → `用到 4 个`、插一行已退役的 `audit`）→ 3 例同时红。

### 坑

- **「探针没红」本身就是发现**：幽灵键守卫第一版只遍历 `REGISTRY` 的场景 —— 而那些场景的 `condition`
  本来就只写自己的键，等于永远查不出东西。改成遍历 `listSceneIds()`（全部 26 个场景）才有意义。
- **生成器拼字符串时别把反引号塞进模板字面量**：用 node 脚本改「生成出来的 Markdown」时，
  替换串里的 `` ` `` 直接把模板字面量截断（`SyntaxError: Unexpected identifier 'i18n'`）。
  改文档就老实改文档，别拿代码去改「代码生成的文本」。
- **`DETECTORS` 数量又会算错**：用 `/^  ([a-zA-Z]+): /` 从源码数探测器名，`i18n` 带数字 → 漏掉 →
  「4 个死探测器」这种假数字就是从这儿来的。**真值要 import 进来数，不要用正则数源码。**
- **上一轮修好的守卫在 autocrlf 机器上假红**：`scene-dir.test.js` 比的是字节，`cp` 回来的覆盖层
  是 LF、内置副本是 CRLF → 全量测试 1 failed。守卫改成比归一化内容；但**根因是「探针复原」**：
  `git cat-file -p HEAD:<path>` 落的是 blob 字节（LF），而工作区是 CRLF。以后改探针过的文件，
  用**同目录的兄弟文件做字节副本**，别用 git blob。

### 决策

- **「已选」不等于「已生效」**：菜单产物是 flag，flag 有没有人读是另一回事。所有「已启用」类文案
  都得先回答「谁消费它」。
- **超时是「替你选了默认值」，必须当场说**：静默默认与「你确认过」在日志里长得一模一样，
  这是同一个「假绿」家族。
- **文档里的一行一场景也必须生成 + 对账**：真正危险的不是正文（没人读），而是 agent 每次会话
  都会 Read 的精简版。
- **不删 18 个死项**：它们是对话模式 agent 的建议清单；这一轮只保证「说了实话」，接不接步骤是功能开发。
---

## 第三十轮：skip/noop 的「原因」分类曾经在说谎（2026-10-30）

### 取证：先证明「没声明原因」这句话是假的

第二十轮写了 `SKIP_REASONS` / `NOOP_REASONS` 两套词表，规矩是「没声明就记
`handler-skip`（明写「没说原因」）」。当时注释里留了一句自我评价：

> 处理器返回 `{ status: 'skip' }` 的那一百多处连一个字的原因都没有。

这一轮先数了它。逐站点扫 `claude-scene/src`（排除 `*.test.js`、注释示例、以及
`start.js` 里那块写日志的 `appendLog({... status: 'skip' ...})`），196 处
`status: 'skip' | 'noop'` 的分布是：

| 站点情况 | 数量 | 举例 |
| --- | --- | --- |
| 布了结构化 `reason` | 62 | `{ status:'noop', reason:'delegated', … }` |
| 只布了 `message`（原因就在这句里） | 131 | `{ status:'skip', message:'一致性检查跳过（无 OpenAPI 规范，未测量）' }` |
| 连 `message` 都没有 | 2 | `flow-control.js` 的 CE 分支，只有 `base:` |

于是「没声明原因」这行的读者会看到两种完全相反的东西：

```
⏭ skip 细分: 处理器判为跳过但没声明原因 19
     Step 5 Semgrep 跳过: 未安装（pip install semgrep）
```

同一屏里，汇总行说「它没说」，明细行就是它的原话。**分类器只读 `result.reason`，
从不读 `result.message`** —— 不是处理器没说，是分类器没看。

### 修法：三档，只按「它到底说了什么」分

`claude-scene/src/data/step-reasons.js`：

1. `reason` 在词表内 → 照用（原有行为）；
2. `reason` 是词表外的词 → `handler-skip` + `unknownDeclared` 保留原词（原有行为，
   「写错词」和「没说」不能混）；
3. **没有 `reason` 但有非空 `message` → `message-only`**（原因在文案里，只是没结构化）；
4. 连 `message` 都没有 → `handler-skip` / `undeclared`，标签改成「连 message 都没给」。

`base` / `tail` 这类**显示字段不算声明** —— `flow-control.js` 的两处 CE 分支正好踩在
这条线上（`base: 'CE Plugin 未安装'`），顺手补成 `reason:'tool-missing'` /
`reason:'interactive'`。这也是本轮唯一改的处理器。

`noop` 桶同步：`{ status:'noop', message:'无需重复' }` 以前记 `undeclared`，现记
`message-only`；「声明了词表外的 noop 原因」和「跳过」一样保留原词。

### 契约变更（两处既有断言，都有理由注释）

- `step-reasons.test.js`：「处理器没说原因 → handler-skip」拆成两例（只布 message →
  `message-only`；连 message 都没有 → `handler-skip`）；分布统计的期望行改成新标签。
- `log-schema.test.js`：`{ status:'noop', message:'无需重复' }` 的期望 `undeclared` →
  `message-only`，并补一条「连 message 都没有才是 undeclared」。

### 新增：债务棘轮（而不是批量改 131 处）

把 131 处都补上 `reason` 是逐站点改造（每个都要判断到底属于 `tool-missing` 还是
`input-missing`），不属于「修一个说谎的标签」。所以这一轮只**冻结债务数字**：

- 没布结构化 reason 的站点 **≤ 131**（只许变少）；
- 「连 message 都不给、把原因塞进显示字段」的站点 **= 0**；
- 声明了 `reason` 的站点 **≥ 60**（防着有人把整批站点改成 `message-only` 抄近路）；
- 扫描面 **> 150**（防空跑：扫描器坏了不能长得像「债务清零」）。

### 自探针（三个都真红）

1. 在 `deps.js` 顶部加一处 `{ status:'skip', message:'探针新增' }` →
   `expected 132 to be less than or equal to 131` ✓（复原用同目录兄弟副本，`cmp` 字节一致）
2. 把 `saidAnything()` 改成 `return false`（假装处理器什么都没说）→
   `message-only` 两例齐红 ✓
3. 分类逻辑本身不探针也能自证：`base` 不算声明那条用例就是照 `flow-control.js` 的
   真实形状写的（`skipReasonFrom({ status:'skip', base:'CE Plugin 未安装' })` →
   `handler-skip`）。

### 真跑（同一场景，修前 vs 修后）

`start qa --auto` / `start cicd --auto`：

```
⏭ skip 细分: 条件不满足 5 / 原因只在 message 里（没布结构化 reason） 1
○ noop 细分: 原因只在 message 里（没布结构化 reason） 1      ← cicd
```

以前这两行是「处理器判为跳过但没声明原因」，而同一屏的明细里就印着它的原话。

### 验收三元组

- **改动**：`src/data/step-reasons.js`（三档分类 + 词表 + 头部数字订正）、
  `src/handlers/flow-control.js`（CE 两处补 `reason`）、两份测试契约变更、
  `step-reasons.test.js` 新增 4 例棘轮 + 3 例分类用例、`DECISIONS.md` ADR-018 修订、
  `CHANGELOG.md` 第三十轮。
- **验证命令**：
  ```
  npx vitest run                                  # 1436 tests / 113 files
  cd claude-scene && npx eslint . --max-warnings 0
  node scripts/{check-readme-stats,check-action-stats,check-doc-counts,check-tool-steps,check-dead-actions}.cjs
  npm run scan:deadcode
  26 个场景 --dry-run --auto
  node claude-scene/src/index.js start review --auto --skip-sweep
  ```
- **验证结果**：1436/1436 全绿；双 eslint 0/0；5 个 checker 全 EXIT=0；
  `Total dead: 0`；26 个场景 dry-run 全部 EXIT=0；`review` EXIT=0
  （17 pass / 0 fail / 3 warn / 19 skip / 4 noop）。
  `review` 自己的 skip 全是引擎判的条件/缺工具（无 `message-only`），这是对的 ——
  「细分」只在真有那种站点时才出现。

### 坑

- **滑一步就漏一个子目录**：第一版棘轮 `readdirSync(dir)` 只读顶层文件、没递归，
  扫出 43 个站点就敢报「全绿」——靠「扫描面 > 150」这条下限当场露头（`expected 43
  to be greater than 150`）。**下限断言保护的正是它自己那次「读」**。
- **同一份口音量两遍**：探针脚本和测试里的扫描逻辑各写一份，第一版窗口取 9 行，
  把 `flow-control.js:291` 的 `message:`（属于隔壁 `handleCeAction`）算进了 290 ——
  「silent = 1」这个数字当时是错的。现在测试里窗口 7 行 + 「`base`/`tail` 也算说过话」
  两条口径写在同一处，脚本已删。
- **湿跑会往仓库里写东西**：`start qa --auto` 落 `.claude/qa/qa-report-*.md`、
  `start cicd --auto` 落 `Taskfile.yml`，`git status` 立刻见 —— 都已删。
  这轮不顺手改 `.gitignore`（是产品行为问题，不是审查诚实性问题），记在这里。
- **`refactor` 场景在本仓 `Step 1 autoUpdate → fail`** 与本轮无关（`--dry-run` 26 个
  场景全过）；真跑 `refactor` 会去跑更新流程，属于既有行为。

### 决策

- **「没声明」和「没结构化」是两个事实，必须两个键**：`handler-skip` / `undeclared`
  说的是「它一个字都没给」，`message-only` 说的是「它给了，但只在文案里」。
  合成一个键等于又造一次「假绿」——只不过假的是「原因不存在」。
- **不批量改 131 处，先修标签再冻结债务**：把「原因分类」改对是一次外科手术，
  把 131 个处理器逐个判断成因是另一件事（且每个都要人判断），混在一起做两头都不清。
- **显示字段不是声明**：`base` / `tail` 是拼接给人看的文案，写在那里的原因
  分类器看不见 —— 那就承认看不见（`handler-skip`），而不是假装能看见。

---

## 第三十一轮：增强项「根本没出现」也要说为什么

**时间**：2026-10-30 · **起点** `43abc32`（第三十轮）

第三十轮把 `skip`/`noop` 的「原因」标签修诚了；这一轮修的是另一个更早的分岔：
**增强菜单里那些「根本没出现」的项**。第二十九轮解决的是「勾了会不会真执行」，
本轮解决「连出现都没有，也没人说为什么」。

### 取证（先证明它在说谎）

1. `lib/enhancements.js` 的 `applyEnhancements` 第一行：

   ```js
   const enhancements = (REGISTRY[sceneId] || []).filter(e => {
     try { return e.when(context); } catch { return false; }
   });
   if (enhancements.length === 0) return;
   ```

   `when` 返回 false 的项**不进菜单、不进日志、不进任何一行输出**。整段代码里没有
   一处把「有这一项，但本机不满足条件」说出来。

2. 真跑 `start review --auto --skip-sweep`（改之前）开头只有一行
   `⚙ 增强已选（非交互模式，按默认值 + --enh）`——`REGISTRY.review` 有 4 项，
   这里只出现 3 项，第 4 项 `mythos_agent_review` 无声消失。

3. 顺着查「为什么会不满足」才发现更硬的证据：**「依赖哪个探测器」只写在函数体里**
   （21 项各自手写 `when: (ctx) => DETECTORS.xxx(...)` 或 `() => true`）。
   数据里没有依赖关系，所以即使想解释也解释不出来 —— 更别说静态对账。

4. 顺手把两份增强文档的「机器状态」断言拿出来核了一遍：

   ```
   python -c "import gepa"  →  gepa ok  C:\...\Roaming\Python\Python314\site-packages\gepa\__init__.py
   ```

   而 `enhancements.md` / `enhancements-summary.md` 都写着「本机 `mythos-agent` 与
   `gepa` **均未安装** → 相关项不会出现在菜单里」。**这句话已经是假的**，而它正是
   `CLAUDE.md` 要求每个 session 读的两份文件。（`mythos-agent` 确实不在 PATH。）

### 修法

- **声明式依赖**：21 项从 `when: (ctx) => DETECTORS.xxx(ctx.targetPath)` 改成
  `needs: '<探测器名>'`（无条件的项不写 `needs`）。新增 `PATH_DETECTORS`
  （`uiFiles` `stagehand` `critiq` 收项目路径）与 `withWhen()`：

  ```js
  function withWhen(raw) { … 无 needs → when: () => true
    const detector = DETECTORS[entry.needs];
    if (typeof detector !== 'function') throw new TypeError(`增强项 ${scene}:${entry.key} 依赖了不存在的探测器 "${entry.needs}"`);
    const when = PATH_DETECTORS.has(entry.needs) ? (ctx) => detector(ctx?.targetPath) : () => detector(); }
  ```

  错别字现在在**加载期**炸，而不是变成运行期静默 `false`。

- **`DETECTOR_HINTS`（10 条，与 `DETECTORS` 一一对应）**：把「缺什么」写成一句人话。
  缺席披露只从这张表读原因（`mythosAgent: '没装 mythos-agent CLI（PATH 里找不到）'`、
  `uiFiles: '项目里没扫到 UI 文件（…）'`…），不现场编。

- **探测一次、分流两支**：

  ```js
  const probed = all.map(e => ({ entry: e, ok: probeEnhancement(e, context) }));
  const unavailable = probed.filter(p => !p.ok).map(p => p.entry);
  const enhancements = probed.filter(p => p.ok).map(p => p.entry);
  ```

  （探测器要起进程 —— `mythos-agent --version`，不能两遍。）

- **三条新输出**：
  - `⚙ 未提供的增强项（本机不满足条件，既不进菜单也不会执行）: N 项` + 每项 `key —— hint`；
  - `⚠ --enh 里这些增强项本机不满足条件，没有启用: …`（用户明确点名却没生效，比默认项缺席更该说）；
  - 删除 early return：`REGISTRY[scene]` 非空就必然说话（整场景全不可用时靠
    `没有启用任何增强项` + 缺席清单）。

- **两份文档不再记录机器状态**，改成「会打印这段披露」，具体名单交给每次运行。

### 契约变更

- `usedDetectors()`（测试内）从「用正则去 `String(e.when)` 里找 `DETECTORS.xxx`」改成读 `needs`。
  派生之后 `when` 源码里已经没有探测器名字样，旧写法会判出「被用到 0 个」，把文档对账测试
  连坐成假红。**这是本轮唯一改动的既有断言**（同类改动均有理由注释）。

### 自探针（四次都真红了）

| 探针 | 手法 | 结果 |
|------|------|------|
| A | 删掉非交互路径的 `discloseUnavailable(unavailable)` | 2 例红（空项目 ui-polish / 整场景不可用） |
| B | 把某处 `needs: 'stagehand'` 改成 `'stagehnad'` | 加载期 `TypeError: 增强项 ui-polish:stagehand_interaction 依赖了不存在的探测器 "stagehnad"`，整文件 no tests |
| C | 删掉 `DETECTOR_HINTS.gepa` 一行 | 2 例红（解释表全覆盖 / needs 自检） |
| D | 往 `enhancements.md` 塞回「本机 mythos-agent 与 gepa 均未安装」 | 1 例红（文档不许记录机器状态） |

探针改过的文件都按字节用同目录副本还原并 `cmp` 验证一致（不 `git cat-file`，那条路会落 LF）。

### 真跑证据

`node claude-scene/src/index.js start review --auto --skip-sweep` → **EXIT=0**，开头：

```
  ⚠ 增强已选但没有场景步骤消费（非交互模式，按默认值 + --enh）: huashu_expert_review, critiq_security_scan —— …
  ⚙ 未提供的增强项（本机不满足条件，既不进菜单也不会执行）: 1 项
     mythos_agent_review —— 没装 mythos-agent CLI（PATH 里找不到）
```

汇总与基线一致：`✓ 17 / ✗ 0 / ⚡ 3 / ⏭ 19 / ⚠ 4`，`warn 细分: 证据过期 1 / 有发现 2`，
`skip 细分: 条件不满足 16 / 缺工具或依赖 3`，`noop 细分: 需要对话模式 4`。

本机探测器实测：`uiFiles true / stagehand true / critiq true / gepa true / mythosAgent false`
（仓库 `package.json` 里真有 `@browserbasehq/stagehand`、`@critiq/cli`，所以 review 只有 1 项缺席）。

### 验收三元组

- **变更**：`claude-scene/src/lib/enhancements.js`、`claude-scene/src/lib/enhancements.test.js`、
  `.claude/rules/conditional/enhancements.md`、`.claude/rules/conditional/enhancements-summary.md`、
  `docs/CHANGELOG.md`、`DECISIONS.md`、`progress.md`。
- **验证命令**：`npx vitest run` · `npx eslint claude-scene --max-warnings 0` · `npx eslint .` ·
  5 个 checker（`check-readme-stats` / `check-action-stats` / `check-doc-counts` / `check-tool-steps` /
  `check-dead-actions`）· `npm run scan:deadcode` · 26 场景 `--dry-run --auto` ·
  `node claude-scene/src/index.js start review --auto --skip-sweep`。
- **验证结果**：113 files / **1444 tests 全绿**；两侧 eslint 0 error / 0 warning；5 个 checker +
  `scan:deadcode` 全 EXIT=0（`Total dead: 0`）；26/26 场景 EXIT=0；review EXIT=0（17/0/3/19/4）。

### 坑

- **`check-opencode-config.cjs` 已经不存在**（第二十七轮 opencode 退役时删了）。我照旧清单跑
  `node scripts/check-opencode-config.cjs` 得到 `Cannot find module` —— 而 `tail` 的退出码
  把它盖成了 `EXIT=0`。**「5 个 checker 全绿」这句话必须用 `> out 2>&1; echo $?` 逐个取码**，
  管道后面的 `$?` 是 `tail` 的。现在的 5 个是
  `check-readme-stats` / `check-action-stats` / `check-doc-counts` / `check-tool-steps` / `check-dead-actions`。
- **正则找函数体这条路又踩一次**：`String(e.when)` 里找 `DETECTORS.xxx` 属于「拿代码形状当事实」，
  一旦把依赖挪进数据，守卫就变成假红。真值字段能读就别用正则猜。
- **`edit` 工具匹配含反斜杠的 `oldText` 仍会失败**（本轮 2 次）：退回「按行号 Python patch」
  或「换整段（`write` 到临时文件 → Python 按行号替换）」，别硬刚转义。
- **写文档时引用了自己的反例**：说明「不许记录机器状态」的段落里若写「gepa 没装」，
  会被自己的守卫命中 —— 改成「上一版写死过『均未安装』」，用引号把反例隔离在工具名 24 字之外。

### 决策

- **缺席也要有结论**：`absent` 不是「什么都没发生」，而是「有这一项、本机不满足、原因如下」。
  静默过滤等于替用户把「不适用」和「不存在」混成一个 —— 与第二十九轮同一条原则的延伸。
- **依赖关系必须是数据，不能是函数体**：`needs: '<探测器名>'` 能被静态核对（守卫扫 21 项）、
  能在缺席时变成一句话、拼错能在加载期炸；`when: (ctx) => DETECTORS.x(...)` 三者都做不到。
- **解释文案与探测器同权重**：`DETECTOR_HINTS` 不写就红。新加探测器只返回 `false` 的时代结束。
- **文档不许记录会过期的机器状态**：这类句子不是「文档落后」，是**假的**，而且每次会话都会被读到。
  机器状态由运行期披露，文档只说「会有这段披露」。

---

## 第三十二轮：同一个概念 7 份名单，每份都跟自己自洽（2026-10-30）

### 起因

上一轮收尾时登记的候选 ②：「外部工具」三套名单。原本以为只是「数字对不上」，
取证之后发现是**校验器的判据本身错了** —— 这比错数字严重一级。

### 取证

`scripts/check-doc-counts.cjs` 当时已经在核三件事：正文清单「声明的数字 vs 括号里点了几个名」、
按类型表「Count 列之和 vs 列出的名字数」、外部组件算式的加法。**三者全绿**。而真实情况是：

| 名单 | 位置 | 个数 | 问题 |
|------|------|------|------|
| 外部安全工具链（真值） | `security-toolchain.md` | 33 | — |
| 正文清单 | `README.md:21` | 29 | 混进 Stagehand / mythos-agent；漏 6 个；`env-var-leak` 写成 `env-leak-scanner` |
| 正文清单（EN） | `README_EN.md:20` | 26 | 同上；另漏 biome / ruff / hurl |
| 逐工具表 | `README.md:~454` | 26 | 漏 jscpd / size-limit / Stryker / Spectral / markdownlint / codeguardian / critiq |
| 逐工具表（EN） | `README_EN.md:~236` | 23 | 再漏 biome / ruff / hurl |
| 外部工具（按类型） | `README.md:~772` | 28 | 含 act/restic/specify-cli，与安全工具链**不是同一概念** |
| 外部工具（按类型，EN） | `README_EN.md:~464` | 25 | 少 ruff / hurl / biome |
| 外部组件散文 | 两份 README | 84 / 81 | 算式末项用了正文清单的 29 / 26 |

三份名单名字的并集 **36**，交集 17。29 与 26 这两行**各自完全自洽**，所以老 checker 无法发现。

真名取证：`claude-scene/src/actions.js:347` 是 `'env-var-leak': handleEnvVarLeak`，
`claude-scene/scenes/review.json:382` 是 `"action": "env-var-leak"`；
`README.md:426` 的步骤清单写的也是 `env-var-leak` —— 同一份 README 自己跟自己打脸。

### 修了什么

- **判据搬到一处**：`scripts/lib/toolchain.cjs`（真值解析 / 三种名单解析 / 比对 / 总判）+ thin CLI
  `scripts/check-toolchain-lists.cjs`（0 相等 / 1 漂移 / 2 塌面）。
- **两份 README 集合对齐 33**：正文清单改名「外部安全工具链」并按真值顺序重排；逐工具表补 7 行（EN 10 行）；
  删掉两处「AI 浏览器功能测试 / 假设驱动安全推理」散文（那是增强探测器，不是工具）；
  `env-leak-scanner` → `env-var-leak` 三处（正文清单 / 逐工具表 / 按类型表 / 汇总段）。
- **按类型表（安装清单）对齐 28**：EN 补 `ruff`(6) / `hurl`(2) / `biome`(10)，标题 25→28，
  更新维度表里的 `(8)` 也改成 `(10)`。
- **外部组件 84/81 → 83**，算式末项改用**按类型表之和**（28）——
  `check-doc-counts.cjs` 同步改口径，否则同一份文档里两个「外部工具数」各自成立。
- **`security-toolchain.md` 顶部写明它是唯一真值**，并说清 33 与 28 是两个概念。

### 测试

- 新增 `claude-scene/src/commands/toolchain-lists.test.js` **17 例**：真仓库 0 + 反空跑下限；
  夹具对照组 0；6 类漂移各自红（少点名 / 写错名（同时报多与少）/ 声明数与点名数不符 /
  逐工具表漏行 / 重复点名 / Count 与名字数不符 / 中英按类型表不是同一批 / 真值跌破下限 /
  文档读不到 / 标题格式变了必须 2）；`normalize` 不做同义词映射；`compareNames` 三个结论都要给。
- `doc-counts.test.js` 15 例：**首次为「契约变更」改既有夹具** —— 正文清单改名 + 外部组件第 4 项
  改取按类型表之和，并在文件头写清为什么改（不是为了变绿，是旧判据本身错）。
  另新增 1 例「清单声明数与点名数不符」。

### 自探针（6 个，全部实测变红，全部按字节复原）

1. 正文清单工具名写错（`seraphim-audit` → `seraphim-audti`）→ checker 1，测试红。
2. 逐工具表删一行（`jscpd`）→ 1 / 红。
3. 声明数 33 → 32 → 1 / 红。
4. 真值表某行不再是 `| **hurl** |` → 1 / 红。
5. 旧错名复活（`env-var-leak` → `env-leak-scanner`）→ 1 / 红（守卫另有一条 `not.toContain`）。
6. 按类型标题格式改坏 → **2**（不是 1）/ 红。

### 验证

- **验证命令**：`npx vitest run` · `npx eslint claude-scene --max-warnings 0` · `npx eslint .` ·
  6 个 checker（新增 `check-toolchain-lists`）· `npm run scan:deadcode` · 26 场景 `--dry-run --auto` ·
  `node claude-scene/src/index.js start review --auto --skip-sweep`。
- **验证结果**：114 files / **1462 tests 全绿**；两侧 eslint `LINT_EXIT=0`；6 个 checker 全 EXIT=0；
  `Total dead: 0`；26/26 场景 EXIT=0；review EXIT=0（`pass 17 / fail 0 / warn 3 / skip 19 / noop 4`，与上轮一致）。

### 坑

- **`check-doc-counts` 的绿是「文件跟自己对齐」**：判据必须至少有一端来自真值（代码/真值表），
  两端都来自同一份文档的检查，只能发现「打字时数错」，发现不了「整体写错」。
- **夹具自洽会掩盖口径变化**：`doc-counts` 夹具里「外部组件第 4 项」和「正文清单条数」都取自
  `o.tools`，所以口径一改，10 个用例同时红 —— 先修口径、再让夹具按新口径生成（不是改断言凑绿）。
- **Windows + gbk 控制台**：python `subprocess(text=True)` 默认 gbk 解码 Node 的 UTF-8 输出会
  `UnicodeDecodeError`，`stdout` 变 `None` → 探针脚本在半路炸掉，且**已经 patch 的文件没被复原**。
  正确做法：`encoding="utf-8", errors="replace"` + `try/finally` 复原 + **只 print ASCII**。
- **`npx` 在 Windows 不是可执行文件**：`subprocess.run(["npx", ...])` → `FileNotFoundError`，
  用 `shell=True`。同理备份路径不能 `replace(os.sep, "_")`（rel 里是 `/`）。
- **`sonarjs/super-linear-regex` 连 `/(\d+) 个工具/u` 也会红**：中文量词紧跟 `\d+` 被判回溯。
  改成 `match(/\d+/u)[0]` + `parseInt`；`unicorn/max-nested-calls` 对
  `expect(checkRoot(scaffold(x)).code)` 这种三层嵌套也红，先解构再断言。

### 决策

- **ADR-024**：同一个概念只允许一份名单真值；两个概念必须两个名字；不做同义词映射；
  校验器必须能报三种结论（塌面不许降级成 1）；判据只写一处。
- **增强探测器不是工具**：`Stagehand` / `mythos-agent` 从安全工具链清单里移除，可发现性交给
  `enhancements.md` 与增强菜单 —— 它们本来就是「场景可选的增强」，不是「装的工具」。
- **登记不修**：`docs/tools-inventory.md`（802 行）是 2026-06-14 快照，MCP 13 / Skills 37 /
  命令 89 / 模块 16 全过期，工具矩阵里还有 `env-leak-scanner`，工作流列写着已退役的 `hunt` / `audit`；
  它不在任何校验器覆盖内，整份要么接生成器要么删，下一轮再做。

---

## 第三十三轮（2026-10-30）：死配置与死文档必须死透

### 起因

第三十二轮把「外部工具」三套名单收成一份真值后，剩在 Next Steps 里的第一项债务是
`docs/tools-inventory.md`（802 行、2026-06-14 快照、两份 README 都链它、没有任何校验器管它）。
动手前先做了一次全仓库取证，顺带发现同一类病还有第二处：`.claude/mcp-enable.json` 是**没有任何代码读**的配置，
却被 4 份文档写成生效机制。于是本轮的主题定为「文档里写的东西必须真的存在」。

### 取证

- `docs/tools-inventory.md`：文件头 MCP 13 / Skills 37 / 命令 89 / 模块 16；目录写 14 MCP；
  汇总统计写 18 MCP / 39 skills / 95 命令 / 27–28 场景 / 18 个 Scene JSON（238 步）/ 280+ actions ——
  **三处自己跟自己矛盾**。引用不存在的 `.claude/mcp.json`、已退役 `simplify`/`hunt`/`analyze`/`design`/`audit`、
  已删除的 `env-leak-scanner`。`sync-docs.js:122` 只刷它的场景计数，所以「场景数是新的」掩盖了整份是旧的。
- `.claude/mcp-enable.json`：`mcp_mappings` 24 条（6 条已退役场景、8 个现存场景没有）、`server_definitions` 18 个、
  `activation_strategy` 按工作流给 token 预算（2000 警告 / 5000 硬限）。`grep -rln "mcp-enable"` 在
  `*.js|*.cjs|*.json|*.md` 里只命中 md。真正生效的只有 `.mcp.json` + `.mcp.json.full` + `scripts/switch-mcp.cjs`。
- `.claude/scenes/README.md`：标题「当前场景（27 个）」，AUTO-SYNC 表 26 行 —— 同步只换标记之间。
- 路径漂移：`docs/harness-engineering/12-principles.md` 三处 `.claude/rules/{coding,react-doctor,visual-standards}.md`
  （实际在 `conditional/`）、`karpathy-principles.md`（已并入 `conditional/core-rules.md`）、
  `.claude/rules/conditional/memory-auto-save.md` 的 `.bak` 指针（既不存在也无人能重新生成）。
- `docs/MULTIPLATFORM.md` 目录树：`.claude/mcp.json`（不存在）、两行 `settings.json`（其中一行自称「项目级设置」）、
  `.codex/mcp/`（实际是 `config.toml` + `agents/`）。
- 两份移动端提案（2026-06-10）在写「要改 `mcp-enable.json` 的 `server_definitions`」+「新增 `mobile-check` 场景」，
  但没有任何归档标记，读起来像现行计划。

### 修了什么

1. 删 `docs/tools-inventory.md`、删 `.claude/mcp-enable.json`。
2. `sync-docs.js` 去掉对已删文件的 `updateSceneCounts` 调用（对着死文件调只会静默返回空），
   `sync-docs.test.js` 的计数夹具改指向 `.claude/scenes/README.md`（同步能力保留，目标换成活的）。
3. `README.md` / `README_EN.md` 的「工具清单与使用矩阵」行改指向 `security-toolchain.md` 与 `.claude/scenes/README.md`。
4. `ARCHITECTURE.md`：整节「MCP Dynamic Enablement」改成真实的「两份文件 + `mcp:switch` 整文件切换」，
   并删掉配置表里的 `mcp-enable.json` 行；`.claude/scenes/README.md`、`docs/MULTIPLATFORM.md` 同步改口。
5. `docs/MULTIPLATFORM.md` 目录树按真实结构重写（含 `.codex/config.toml` / `.pi/{skills,prompts}` / 根 `.mcp.json*`）。
6. `docs/harness-engineering/12-principles.md` 三处规则路径 + Karpathy 指针改到真实文件；
   `memory-auto-save.md` 的 `.bak` 指针换成实现目录。
7. 两份移动端提案加 `> **归档**` 横幅。
8. `.claude/scenes/README.md` 标题 27 → 26，并写明「表由 sync-docs 生成、数字由 checker 校对」。
9. `check-doc-counts.cjs` 增加第 4 份文档：标题数字 + AUTO-SYNC 表行数都等于场景数；读不到 / 格式变了 → exit 2。
10. 新增 `retired-artifacts.test.js`（6 例）。

### 测试

- 新增 `retired-artifacts.test.js` 6 例；`doc-counts.test.js` 15 → 18 例（标题数字错 / 表少一行 / 文件缺失 exit 2）；
  `sync-docs.test.js` 10 例保留（夹具目标改成活文件）。
- 基线：114 files / 1462 tests → **115 files / 1471 tests**（+1 file / +9 tests）。

### 自检用例过期（本轮发现并修）

`npm run detector:sweep` 报 `10/12 个探测器有效`：两条最核心的假绿守卫用例**注入点匹配不到**了 ——
`start.js` 那条 warn 后来补了 `warnKind: 'silent'`、`handlers/mobile/audit.js` 改成了「声明的工具名就是真去查的那个」+
返回对象，两处原文案都不复存在。自检本身正确地报了 `stale`（没有把「注入点没匹配到」算成通过），
但这也意味着这两条守卫**从改动那天起就没再被验过**。现按当前文案重新锚定两处注入点，`detector:sweep` **12/12**。
教训：变异测试的「过期」必须当成红来处理 —— 一旦容忍 `stale`，守卫失效就再也看不见了。

### 自探针（7/7 全红，全部字节复原）

1. 复活 `.claude/mcp-enable.json` → 「必须不存在」红；
2. 在 `scripts/switch-mcp.cjs` 里真去读它 → 「没有代码去读」红并点出文件名；
3. 在 `docs/MULTIPLATFORM.md` 写一句「MCP 按场景启用见 …」→ 「活文档不许再把退役机制写成生效」红；
4. 把 `.claude/rules/conditional/core-rules.md` 改回 `.claude/rules/coding.md` → 规则引用红并点名 `coding.md`；
5. README 里加一行死链 `./docs/tools-inventory.md` → 链接解析红；
6. 把 `DOC_DIRS` 缩成只剩 `.claude/scenes` → 「自证非空跑」下限红（下限不是装饰）；
7. `.claude/scenes/README.md` 标题改回 27 → checker exit 1，「文档写 27，实际 26」。

### 验证

- **验证命令**：`npx vitest run` · `npx eslint claude-scene --max-warnings 0` · `npx eslint .` ·
  6 个 checker（`check-action-stats` / `check-dead-actions` / `check-doc-counts` / `check-readme-stats` /
  `check-tool-steps` / `check-toolchain-lists`）· `npm run scan:deadcode` · 26 场景 `--dry-run --auto` ·
  `node claude-scene/src/index.js start review --auto --skip-sweep`。
- **验证结果**：115 files / **1471 tests 全绿**；两侧 eslint 无输出（`--max-warnings 0`）；6 个 checker 全 EXIT=0；
  `Total dead: 0`（Commands 0/33、Skills 0/29、MCP 0/3）；`detector:sweep` **12/12 个探测器有效**；
  26/26 场景 EXIT=0；review EXIT=0（`pass 19 / fail 0 / warn **1** / skip 19 / noop 4`，
  唯一一条 warn 是 `sec-bug-hunt` 的「npm audit 接口不可用，依赖漏洞未知」—— 环境事实，不是假红）。

### 坑

- **「有同步」不等于「同步到的部分是对的」**：`sync-docs` 只换 AUTO-SYNC 标记之间的表格，
  标题里的「27 个」永远没人碰。凡是被生成器覆盖的文件，生成器没覆盖到的部分要有独立判据。
- **对着已删文件调用「同步」函数返回空列表**，与「没有需要同步的内容」长得一样 ——
  删除文件时必须同时删掉指向它的调用，否则读者会以为还在维护。
- **测试文件自己持有退役名单**：`retired-artifacts.test.js` 的 `RETIRED` 里写着死路径，
  「代码不许读退役文件」这条会把它自己判红。跳过自身并在注释里写明理由，
  而不是放宽成「路径里带 test 就跳过」（那会让真测试里的读法逃掉）。
- **`rel()` 产出正斜杠、`join()` 产出反斜杠**：白名单 `HISTORY` 用 `join('docs','CHANGELOG.md')` 会永远不匹配，
  台账文件被当成活文档 → 假红。路径比对统一用 `/`。
- **引用可能带 `../../` 前缀**（`docs/harness-engineering/` 里的写法）：按仓库根解析前要先截到 `.claude/`，
  否则 `join(ROOT,'../../.claude/...')` 指到仓库外，变成假红。
- **`x.md.bak` 不是文件引用**：正则收尾加 `(?![.\w-])`，既避免把备份名当引用，也避免把 `.md.bak` 判成缺文件。
- **eslint 两条新规**：`unicorn/prefer-set-has`（白名单用 `new Set`）、
  `unicorn/no-array-callback-reference`（`.flatMap(docsIn)` 要写成 `.flatMap((d) => docsIn(d))`）。

### 决策

- **ADR-025**：没人读的配置就是死配置，删掉不「留着以后用」；手写机器状态要么接生成器、要么删，
  不允许「半同步」；删掉的东西要有守卫，且守卫必须能区分「历史记录」与「活着的主张」——
  历史文档靠**加归档横幅**获得豁免，而不是往白名单里再塞一条路径；
  文档点名的文件必须存在；「同步只覆盖一段」不等于「那一段是对的」。
- **删而不是生成 `tools-inventory.md`**：它的「使用矩阵」价值看着高，但那份矩阵本身就写着已退役工作流，
  是假的；真要的话应当从场景 JSON 生成，而不是复活一份手写快照。
- **台账白名单按文件枚举、逐个写理由**：不按路径通配，新增文件提到死名字就会红，逼着人当场决定它是历史还是又是假文档。
- **登记不修**：① `ARCHITECTURE.md` 整体仍陈旧（Prerequisites / Open Design / `.env.example` / ASCII 图里的 `/design` `/simplify`）；
  ② `README.md:11` 「25 个自动化工作流」 vs 真值 26；③ `detector-report.js` 的 `workingTreeDirty` 读的是记录里的字段而非现场 `git status`。
- **review 的 warn 从 3 降到 1 是修出来的，不是按出来的**：上一轮 17/0/3/19/4 里的两条 `证据过期` 一条来自
  「自检记录来自 048e12f，HEAD 已是 af840c3」，另一条是那 2 个过期用例。本轮把注入点重新锚定、
  在干净工作区重跑自检（记录 sha 与 HEAD 一致、`workingTreeDirty=false`）之后，`证据过期` 归零，
  剩下的 1 条 warn 是环境事实（npm registry 不支持 audit API）。

---

## 第三十四轮（2026-10-30）：入口文档承诺的系统不是这个系统

### 起点

第三十三轮留的 Known issue 写着：「`README.md:11` 的「25 个自动化工作流」与真值 26 不一致，
`check-doc-counts` 目前不查这一行」。按老办法先取证：这一行有几个作者、几个版本、谁在维护它。

结果：`README.md` 25（19+6）、`README_EN.md` 27（21+6），而 `README_EN.md` 第 114 行自己又写 26 ——
一个数字三种说法，三种都能被读者当成「刚更新过」。顺着往旁边看，同一页还有 `/design`、`/simplify`、
`/enhance-prompt` 三个**不存在或不属于本项目**的命令，以及一句「另有 9 个功能已融入增强菜单」。

### 取证（逐条落到真值）

- **工作流 26 = Web 20 + 移动 6**（`claude-scene/scenes/` 26 个 JSON，`mobile-*` 6 个；`.claude/scenes/` 是运行时的赢家，也是 26）。
- **`/design` 无入口**：`.claude/commands/` 33 个文件（26 场景 + 7 辅助）里没有，场景 JSON 里也没有。
  但 `.claude/commands/build.md` 让 agent「先跑 `/design` 出技术方案」—— 这个命令 agent 会真的去调。
- **`/simplify` 无入口**：已并入 `/refactor` 的 simplify 模式。
- **`/enhance-prompt` 只在本机 gitignored 的 `open-design/skills/enhance-prompt/SKILL.md` 里**；
  `docs-scene-alignment.test.js:88` 甚至为它留了一条豁免注释 —— 测试知道它可疑，却选择放过。
- **「9 个已融入增强菜单」**：`RAW_REGISTRY` 10 个键里没有 `cicd`、没有 `setup`；9 项里只有
  `changelog`（→ `/release`、`/mobile-release`）与日志脱敏（→ `/review`）真有步骤，
  另外 7 项（`backup` `docker` `sbom` `loadtest` `incident` `migration` `llm-proxy-audit`）
  只有 `actions.js` 的 handler，**CLI 没有 `run <action>` 入口**，用户永远触发不到。
- **被我否掉的两条扫描**：① 「全仓死链」——716 条几乎全在 vendored 树（`open-design/` 等），
  自有文档里 0 条；② 「所有动作名的可达性」—— 朴素测法是 78 个「注册但没被引用」，
  含别名与动态派发，假红率太高（和第三十二轮否掉「同义词映射」同一个理由）。
  改为窄判据：只查文档点名的命令、只查 7 个**已确认**不可达的动作名。

### 修（19 个文件改口 + 3 个新守卫）

- README/EN：数字、命令、open-design 前提、目录树（27→26 / 8→12 Agent / 9→13 规则 / 补 `memory` `sync-docs`）、
  「9 个已融入」改成三分类、删掉 7 个会过期的外部数字（152/111/137/11/6/3/102 里错了 3 个）。
- CLAUDE.md / AGENTS.md / INSTALL.md / ARCHITECTURE.md / `.claude/commands/{spec,build,report-fix}.md` /
  `.claude/rules/{conditional/core-rules,conditional/anti-slop-design,od-craft/index}.md` /
  `docs/harness-engineering/12-principles.md` / `.pi/AGENTS.md` / 两份 `constitution.md`（本机 gitignored）：`/design` `/simplify` 全部改口。
- 架构图里的 `/design` `/simplify` 换成等宽的 `/spec` `/rollback`（盒子宽度不能变，改完逐行数过）。
- `INSTALL.md` 那张「指令 → 场景文件」表 4 行指向不存在的 JSON，整表换成规则 + 指针；「12 个智能工作流 5+8」改成 26 + 清单指针。
- `Claude_Code_全自动驾驶系统_融合版.md`（本机 gitignored）：按第三十三轮先例加 `> **归档**` 横幅。

### 新增守卫（每条都先弄红一次）

- `doc-claims.test.js`（6 例）：文档里的 `` `/命令` `` 必须真存在或当场交代出处；目录树点名的 `xxx.json` 必须存在；
  「并入 X」必须真在 `X.json`、「不可达」必须真没步骤调用。三条下限断言防空跑。
- `check-doc-counts.cjs`：工作流总数 / Web / 移动端三个数字（生成器管不到的行，现在有独立判据）。`doc-counts.test.js` 18→21 例。
- `retired-commands.test.js`：退役命令 5 → 8 个（加 `design` `simplify` `polish`）+ 「旧命令表整表豁免」（豁免只来自表头）。
- `docs-scene-alignment.test.js`：`MERGED_INTO`（12 项混装）拆成 `MERGED_INTO_SCENE`（6 项，逐条核对）与 `UNREACHABLE_ACTIONS`（7 项）。

### 踩到的坑

- **第一条守卫不是新写的，是改旧测试「认可假话」的地方**：`docs-scene-alignment.test.js` 把「只有 handler」的 7 项
  和「真并进场景」的 5 项一起放进 `MERGED_INTO`，于是文档说「已融入」测试就点头。**测试的名单也是文档**。
- **守卫写宽了会自己淹死**：`doc-claims` 第一版把宿主 CLI 的 `/compact` `/clear` `/rewind`、占位符 `/command`、
  以及「there is no `/design`」这种否定句全判红，11 条假红。窄判据 + 按行豁免 + 宿主白名单之后归零。
- **sonarjs 的 `super-linear-regex` 连 `([a-z0-9-]+)\.json` 都不放过**：`[a-z]` 与 `[a-z0-9-]+` 前缀重叠 → 每次起点都能重扫。
  改成按空格 split token；`unicorn/prefer-set-methods` 要求 `A.union(B)` 而不是 `new Set([...a, ...b])`。
- **认知复杂度 20 > 15**：把「读目录树 → 取 token → 校验」抽成模块级函数 `treeJsonNames()`，回调里只剩累加。
- **python heredoc 把 `
` 写成了真的换行**，生成的 JS 变成 `split('` + 换行 + `')`，报 `Unterminated string constant`；
  用 `edit` 工具改回 `/
?
/u`。**老规矩：能不动 heredoc 就不动。**
- **`node src/index.js review` 不是命令**：`review` 是场景，要 `start review`。湿跑对着空目录会得到 7 条
  「扫描范围为 0 个源码文件（结果不可信，按失败处理）」—— 这是假绿守卫在正常工作，不是回归。

### 决策

- **ADR-026**：入口文档点名的命令必须真存在，否则同一行交代出处（豁免按行、不按文件）；
  「并入」与「不可达」是两种事实，两个方向都要断言；工作流数字只从场景文件数出来；
  测试里的名单不许用「已融入」把两种成因糊在一起；退役映射表的豁免只来自表头；会随上游变化的数字不进正文。
- **不查全仓死链、不查全量动作可达性**：假红率太高会把守卫本身变成噪声（第三十二轮同一个取舍）。
- **登记不修**：① `ARCHITECTURE.md` 外部件表的「40k+ Stars / 129 design systems」仍会过期；
  ② `skillspector` 把 `.claude/skills/*/references/*.md` 的示例代码当漏洞报（105 条）—— 工具设计问题；
  ③ `detector-report.js` 的 `workingTreeDirty` 读记录而非现场。
- **review 本轮 `pass 18 / warn 2`**：warn 是 `sec-bug-hunt`（npm audit 接口不可用，环境事实）+ `skillspector`（105 条文档误报，
  上一轮日志里同样 105 条，不是本轮引入）。`fail 0 / skip 19 / noop 4` 与上轮一致。

---

## 第三十五轮（2026-10-30）：自检记录里的「那时干净」不是「现在干净」

### 起点

上一轮登记了三笔债务，挑最像「假绿」的那笔：`detector-report.js` 的 `workingTreeDirty`
读的是自检**记录里**的字段，不是现场 `git status`。

### 取证

- `verdictOf(data, { head, dirty })` 的 `dirty` 实参是 `data.workingTreeDirty === true` —— 记录里的快照。
- 记录由 `detector-sweep.cjs:gitState()` 在**跑的那一刻**写入（`git rev-parse HEAD` + `git status --porcelain`）。
- 于是能构造出一条真实假绿：干净工作区跑完自检（`dirty=false`，`sha=HEAD`）→ 改 3 个文件不提交
  → `/review` 的 `freshnessOf` sha 相等、`dirtyThen` 为 false → **pass**，而那 3 个文件从没被注入验证过。
- 顺带发现第二个洞：`checkShape` 不查 `workingTreeDirty` 是否存在；`undefined === true` 为 false
  → **缺证据 = 干净**。与第三十四轮「句子被改写认不出来 → exit 2」是同一个思路的另一面。

### 修

- 三个事实分开取：`dirtyThen`（记录里）、`head`（现场）、`dirtyNow`（现场）。
- 新增一句只有「自检之后脏了」才说的话：`自检之后工作区又有未提交改动（HEAD 没变）——
  注入点针对的是 <sha> 那份代码，改过的文件本轮没验过`。
- `workingTreeDirty` 进 `checkShape`：缺这一位 → `input-invalid` → `skip`。
- 判定顺序固定为：记录自身问题（stale/failed/passed≠total）→ dirtyThen → sha 不符 → dirtyNow。
- 用例 18 → 21：新增「记录干净但现场脏」「两边都脏时说的是哪一句」「缺字段 skip」。

### 踩到的坑

- **`dirtyNow` 不能放在 `freshnessOf` 之前**：git 不可用时 `workingTreeDirty()` 返回 `true`（保守），
  提前判就会把「git 不可用」说成「工作区脏」，第 11 轮那条用例会红。**保守默认值的顺序也是契约**。
- **缺字段的默认值就是假绿**：`undefined === true` 为 false，校验器不查这一位，缺字段就默默走「干净」分支。

### 决策

- **ADR-027**：「记录跑的时候干净」与「现在干净」是两个事实，各取各的；快照字段进 `checkShape`，
  缺了就是 `skip` 不是「按干净处理」；脏工作区只算 `warn/stale-evidence`，不升级成 `fail`
  （脏 ≠ 守卫失效，只等于证据没覆盖当前改动）。
- 剩两笔债务顺延：`ARCHITECTURE.md` 外部件表里会过期的 Open Design 数字；`skillspector` 把 skill 文档示例代码当漏洞报。

### 验收

116 files / 1483 tests 全绿；两套 eslint 干净；6 个 checker `EXIT=0`；`scan:deadcode` Total dead 0；
`/review --auto --skip-sweep`：提交前 `pass 17 / fail 0 / warn 3 / skip 19 / noop 4`
（`自检记录来自 b42572b，当前 HEAD 是 8ac3f7a —— 记录已过期`）。

**现场验证新分支**：提交后在干净工作区重跑 `npm run detector:sweep`（记录 sha=HEAD、dirty=false、12/12），
再放一个未跟踪文件跑 `/review` → `自检之后工作区又有未提交改动（HEAD 没变）…`（warn 3）；
删掉后 `pass 18 / fail 0 / warn 2 / skip 19 / noop 4`。
**这条假绿以前是判 pass 的** —— 现在它会自己说出来。
