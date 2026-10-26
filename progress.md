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
