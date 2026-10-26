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
