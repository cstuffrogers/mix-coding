# Changelog

## 2026-10-30（第四十三轮：`/docs api` 也是同一个病）

### Fixed

- **`handleApiDocs` 无条件覆盖 `docs/api/<mod>.md`**：手写一份同名文档，跑一次 `/docs api`
  就销毁一次人工工作 —— 与 `architecture.md` / `CHANGELOG.md` 同一个病，只是这个 handler
  此前只有一条测试（「没有 src 目录 → skip」），缺陷全在那条测试的盲区外。现在首屏带
  `<!-- generated-by: mix-coding /docs api -->`；**同名的没有标记 → 跳过并点名**，一个字节不动；
  一份都没能写出来时 `skip`(`input-invalid`)，而不是记 pass。
- **过期产物永不回收**：模块删了/改名了，`docs/api/` 里那份描述已不存在模块的文档会一直躺着
  （没人会手动删生成物，它只会慢慢变假，且没有任何测试会因为它变假而红）。现在写完按
  「带标记 + 本次没产出」回收，并在返回值里报「清理 N 份过期产物」——**包括本次是 skip 的时候**。
  手写文件不在回收面内。
- **不认识的导出写法被当成「没有导出」**：只匹配 `export function|class|const|interface|type NAME`，
  于是 `export default` / `export { … }` / `export * from` 一律静默丢弃，文档照样标 `## 导出`
  并记 pass。现在它们被计数，写进该模块文档的 `## 未收录`（「不是它们不存在，是这个正则认不出来」）；
  一条声明都提取不到时 `skip` 消息里也说清有几处。
- **出错报成 skip，成功分支返回裸字符串**：`catch` 里只 `console.log` 一句然后落到 `skip`
  （「读写炸了」与「没输入」混成一件事）；成功分支返回的是字符串，不带 `{status}`。
  现在读写失败 → `fail`，四个分支统一返回显式 `{status, reason?, message}`。

### Added

- 新增 `claude-scene/src/handlers/docs-api.test.js` 11 例（`handleApiDocs` 此前只有
  `false-green.test.js` 里一条「没有 src 目录 → skip」）。

### Self-audit

6 条探针逐条把旧 bug 放回去（无条件覆盖 / 不回收 / 不披露 / 出错报 skip / 零导出照走 /
零产出报 pass）：全红 + 按字节复原。现场四场景（真实临时项目、无 mock）：手写文件未动、
生成物带标记、两次跑字节相等、删模块后过期产物被删而手写还在。

### 验收

`npx vitest run` → **123 files / 1560 tests 全绿**（含并发会话本轮新增的 sync-prompts 测试）；
`claude-scene` eslint（`--max-warnings 0`）`EXIT=0`。

### 遗留

- `.claude/reviews/` 里 4 份入库残留仍未处理（别人的评审产物，删不删由人定）。

## 2026-10-30（第四十二轮：门禁判的是本次提交，不是工作区）

### Fixed

- **`handleChangelog` 会把别人的 CHANGELOG 一次跑报废**（此前**零测试覆盖**，比
  `handleDevDocs` 更危险 —— 后者至少有覆盖保护）：`readFileSync(...).split('\n').slice(1)`
  只丢掉标题行，旧内容整段拼在新内容后面，每跑一次顶部多一段 `## Unreleased (日期)`
  + 一组 `## Fixed`；而且它用的 `##` 层级与本仓库手写 CHANGELOG 的 `###` 冲突，
  跑一次就把 436 行手写记录压成一排平级章节。
  现在：首屏带 `<!-- generated-by: mix-coding /docs changelog -->`，
  **没有标记的文件一律 `skip` + `reason:'input-invalid'`，一字节不动**；
  重写只动标记之间那一段（标记之外的人写内容原样保留），分组改用 `###`。
- **生成一次与生成十次必须字节相等**：标记后面的空行被 `replace(/^\n+/u,'\n\n')` 归一，
  每跑一次文件末尾就多一个换行 —— 内容一样、字节不同，提交里永远挂着一个「无变化」的
  diff。现场跑出来的（run2 幂等 `false`），改成只在有内容时插一个分隔。
- **空仓库被报成 `warn`**：还没有任何提交时 `git log` 是 **throw**，不是返回空串。
  「没东西可写」和「写失败了」被当成同一件事。现在按 git 的原话识别
  （`does not have any commits`）→ `skip` + `reason:'input-missing'`。
- **`pre-commit` 第四道把「工作区有别人的改动」判成「你的提交不合格」**：它无条件重跑
  `scan-scenes` 再比 `git diff`，于是同一个工作区里另一个会话改了场景文件还没提交时，
  **任何人**提交都会被判「scenes-stats.json 陈旧」（本轮实际被卡住一次）。
  现在只看**本次提交**：`git diff --cached --name-only` 里没有场景文件也没有 stats → 明说
  「跳过这一道」；改了场景却没带 stats → 直接拦住并点名是哪个文件。
- **活文档的页头不许留会过期的核查日期**：`docs/tool-versions.md` 的
  「生成日期: 2026-07-24 / 最后核查: 2026-07-25」删掉，改成「拿下表里的上游链接自己比，
  真更新过的日期记在文末更新日志里」—— 那种日期一写就过期，而没人会回来改它。

### Added

- `claude-scene/src/handlers/docs-changelog.test.js`（8 例）：重复跑不叠、标记外内容保留、
  手写文件字节相等、`###` 层级、`--since` 真进了 `git log` 区间、零提交不落地、
  空仓库 `skip`、真错误 `warn`。
- `gate-honesty.test.js` +2：第四道「没碰场景文件 → 明说跳过」与「改了场景没提 stats → 拦住」。
  两条都跑在**替身暂存区**（`GIT_INDEX_FILE`）上 —— 门禁判据换成 `--cached` 之后，
  测试若读宿主真实暂存区，就会变成「谁刚好 staged 了场景文件」决定测试红绿。
- 守卫自检：`AUTO_CLAIMS` 拆成数组（单条正则复杂度会顶到 sonarjs 上限），并直接喂
  5 种真实写法断言都能命中 —— 守卫窄成特例时，仓库当时恰好没有那种写法，
  扫描就会全绿，于是「检查跑过了」又被当成「检查有效」。

### Removed

- `docs/audit-report.md` 退役：一次 `/audit` 的运行产物（2026-06-24）入库，91 行里
  10 个 ✅ / 5 个 ⚠ / 5 个 🔴 都是那天的结论，没有任何代码会重写它。
  `docs/audit-phases.md` 里那句引用改成「报告写在 `.claude/reports/`（已 gitignore），不入库」。
- `docs/requirements.md` 退役：零代码引用的外部工具清单，跟 `docs/tool-versions.md` 抢同一个
  概念（ADR-024）；还跟 `INSTALL.md` 互相矛盾（这里写 Node >= 18 LTS，INSTALL 写 v20.x LTS），
  并把「负责工作流」写成已退役的 audit / analyze。

### Self-audit

- 7 条自探针（加回手写覆盖 / 分组退回 `##` / 整块丢人写内容 / 零提交照写 /
  守卫少拦一种写法 / 第四道退回无条件 / 删掉「没提 stats」拦截）**全红**，
  逐条按字节复原并 `equals` 核对。
- 现场五场景（真实 git 仓库，非 mock）：`run1 pass(标记 1)` / `run2 幂等 true` /
  `run3 手写还在 + 旧版本没了` / `run4 skip(input-invalid, 一字节没动)` /
  `run5 skip(input-missing, 没写文件)`。**其中 run2 与 run5 是现场才暴露的两个 bug**，
  单测里当时都是绿的。

### 验收

- `npx vitest run` → **120 files / 1533 tests 全绿**
- 两套 eslint（根目录 + `claude-scene` `--max-warnings 0`）→ `EXIT=0`
- 6 个 checker（action-stats / dead-actions / doc-counts / readme-stats / tool-steps /
  toolchain-lists）→ 全 `EXIT=0`
- `npm run scan:deadcode` → `Total dead: 0`（Handlers 0/70、Scenes 0/26）
- `node scripts/scan-scenes.cjs` → 26 个场景 / 585 步，`scenes-stats.json` 无 diff

### 遗留

- `.claude/reviews/` 里 4 份被跟踪的残留（3 份 `huashu-expert-review-*.md` +
  `review-report-20260629.md`）本轮没动 —— 它们跟上面退役的两份同一个病，
  但要不要留历史由人定，不替我决定。

## 2026-10-30（第三十八轮：生成器在别人的项目里写我们的自传）

### Fixed

- **`/docs arch` 的模板里硬编码了本仓库的自传，而且是错的条数**：生成的
  `docs/architecture.md` 里固定写着「| `src/commands/` | CLI 命令入口 |」「## 数据流」
  「本项目使用 mix-coding 系统，支持 **28** 个自动化工作流」（真值 26）。
  那三段是模板字符串，所以在**任何**目标项目跑 `/docs arch` 都会被写进去 ——
  给一个 React 项目写「本项目支持 28 个自动化工作流」。模板里只允许出现
  「读者在那个目录里能自己核」的东西（技术栈探测结果 / 目录树 / 依赖表 / 指向 CLAUDE.md）。
- **目录树静默 `slice(0, 80)`**：生成的文档看起来完整，其实只有第一段 ——
  仓库里那份退役产物就只写出了 `Archon-dev/` 一棵子树，正文却像模像样地标着「目录结构」。
  现在截断必须自己说出来：`…（已省略 23 项：本表最多 80 行 / 3 层，完整列表请用 ls 或 tree）`。
- **依赖表静默 `slice(0, 30)`**：40 个依赖只列 30 个却说「核心依赖」→ 现在标「前 30 个，共 40 个」。
- **技术栈探测不到就写「待补充」**：那是含糊，不是结论（读者以为再跑一次就有了）。
  现在写「未识别：没有 next.config / src/App.tsx / vite.config / express 依赖，技术栈请手写补充」。
- **无条件覆盖已有的 `docs/architecture.md`**：手写一次、跑一次 `/docs arch` 就被销毁。
  现在生成物首屏带 `<!-- generated-by: mix-coding /docs arch -->`，**没有这个标记的文件一律拒绝覆盖**
  （`skip` + `reason: 'input-invalid'`，一个字节都不动）。
- **空目录也产出「架构文档」并记 pass**：改成 `skip` + `reason: 'input-missing'`。
  `handleDevDocs` 现在四个分支都返回显式 `{status}`（pass / skip / skip / warn）。

### Added

- `claude-scene/src/handlers/docs.test.js`（8 例，新建）：自传三节清零、生成标记、
  树截断交代省略数、依赖截断交代总数、技术栈未识别、手写文件不覆盖（字节比对）、
  自己的产物可覆盖且标记不重复、空目录 skip 且不写文件。**修前 8 例全红**。
- `retired-artifacts.test.js` 新增一例：**活的文档不许自称「自动生成」**。
  仓库里没有任何东西会自动重生这些文档，自报「自动生成于 X」同时给读者两个错误暗示：
  内容是最新的（实际是那天快照）、下次会自己更新（实际要人手跑一遍再手提交）。

### Removed

- **`docs/architecture.md` 退役**：页头自报生成日期、正文被手改一半、目录树只有一棵子树、
  条数写成 28、两个 TODO 从没填。里面唯一有活的读者的「报告产物契约」一节
  （`impact-*` / `fence-*` / `aislop-*` 三类产物的形状与缺失时行为）已迁进
  `ARCHITECTURE.md`（新增第 10 节，含 ToC 条目），`DECISIONS.md` 里指向旧文件的
  那句话改成指向新位置。
- 注意：`docs/architecture.md` **不进**退役名单 —— 它是 `/docs arch` 在目标项目里的
  正当输出路径，代码里出现这个名字是对的；错的是「仓库里自己存一份」。

### Self-audit

8 条自探针逐条弄红后按字节复原（`$TEMP/r38-probes.py`，`ALL_RED_AS_EXPECTED=True`，
`cmp` 校验与探针前字节一致）：自传加回模板 / 省略数写 0 / 依赖截断不交代总数 /
技术栈写回「待补充」/ 去掉手写保护 / 空目录照样写 / 活文档加一行自动生成声明 /
新守卫自己少扫（`const docs = []`）。

现场非 mock 跑（`$TEMP/r38-insitu.mjs`，真实 fs + 真实 tmpdir）：四个场景
`pass(marker=true, 已省略 23 项, 共 40 个, React)` / `pass(markerCount=1)` /
`skip(input-invalid, untouched=true)` / `skip(input-missing, wrote=false)`；
另一份现场检查确认生成物里 `28` / `模块说明` / `数据流` / `src/commands/` 全部不出现。

### 验收

`npx vitest run` 118 files / 1519 tests 全绿；两套 eslint 干净；6 个 checker 全 `EXIT=0`；
`scan:deadcode` Total dead 0。

### 遗留债务

- `.claude/reviews/` 是**运行产物冒充活文档**的同一个病，但入库的没几份：
  该目录已 gitignore（`.gitignore:130`），本地 94 份；**被跟踪的只有 4 份残留**
  （3 份 `huashu-expert-review-*.md` + 1 份 `review-report-20260629.md`，后者 95 行，
  表里还挂着 2026-06-29 那天的「✅ 通过」结论）。
  *（本节初稿写的是「有 20+ 份提交进仓库」，那是把本地 gitignored 文件也算成了入库文件 ——
  数字核不了就不许写，本轮自己的规矩，自己先撞了一次。）*

## 2026-10-30（第三十七轮：会过期又核不了的数字不是事实）

### Fixed

- **活的文档里躺着 45 处 GitHub star 数**：`README.md` 17 处、`README_EN.md` 14 处、
  `.claude/rules/conditional/security-toolchain.md` 9 处、`ARCHITECTURE.md` 2 处、
  `docs/补充.md` 1 处。star 数每次上游涨粉就过期，本机也核不了 ——
  写进文档不是信息，是把「我记得当时是这样」冒充成事实（同第三十四轮 ADR-026）。
  整段删掉热度指标，只留功能与许可：`（8k+ stars, MIT）` → `（MIT）`、
  `（NVIDIA, 2.5k+ stars）` → `（NVIDIA）`、`(Rust, 50k+ stars)` → `(Rust)`。
  `ARCHITECTURE.md` 两张表的 `GitHub Stars` 列整列删除（表里其它列不动）。
- **同一个上游、两个互相矛盾的条数**：`ARCHITECTURE.md` 写「129 brand-level design systems」，
  `.claude/commands/ui-polish.md` 的选项里写「152 品牌设计系统」；同一份 `ui-polish.md` 还写着
  「111 模板 / 138 AI 技能 / 103 提示词模板（46+57）/ 3 演示框架」。
  这些目录还躺在被 `.gitignore` 忽略的 `open-design/` 里，谁也没数过。
  改成「有多少用多少，不写死条数」，并给出可自查的 `ls` 命令。
- **删掉 `docs/补充.md`**：它不是文档，是把一段 AI 回答粘进仓库 —— 全文靠
  「⭐ 25k+ Stars（2026 年 7 月开源后迅速爆发）」「内置了数百万级真实缺陷样本训练」这类
  本机核不了、而且一开口就过期的说法撑起。它被两份代码注释当作事实来源引用
  （`actions.js`、`deep-review-tools.js`），那两句已改成直接述事。

### Added

- **守卫 `doc-claims.test.js` 新增一例**：「易变的外部热度数字不进活的文档」。
  扫描面 = 入口文档 + `docs/*.md`（去掉台账与带「归档」横幅的历史提案）+
  `.claude/{commands,rules}/**.md`，非空跑下限 40 个文件；
  拦 `Nk+ stars` / `N Stars` 与 `N brand-level design systems` / `N 品牌设计系统`。
  **刻意不拦**「35 presets / 2000+ icons」这类功能规模数字：那是能力描述，
  一条正则分不清它和本仓库自己的真值（26 个场景 / 585 步），拦了只会制造假红。
- **`retired-artifacts.test.js` 的退役名单加入 `docs/补充.md`**：
  文件必须不存在、没有代码读它、活文档不许再点名它。

### Self-audit

8 条自探针逐条弄红后按字节复原（`$TEMP/r37-probes.py`，`ALL_RED_AS_EXPECTED=True`，
每条 `cmp` 校验与探针前字节一致）：README 加回 star 数 → 红；README_EN 加回 → 红；
`security-toolchain.md` 加回 → 红；`ARCHITECTURE.md` 加回「129 brand-level」→ 红；
`docs/architecture.md` 加「152 品牌设计系统」→ 红；`docs/补充.md` 复活 → 红；
活文档点名 `docs/补充.md` → 红；守卫自己少扫（`const out = []`）→ 红。

### 验收

`npx vitest run` 117 files / 1506 tests 全绿；`npx eslint claude-scene --max-warnings 0` 与
`npx eslint .` 均干净；6 个 checker 全 `EXIT=0`；`scan:deadcode` Total dead 0。

### 遗留债务

- 「35 presets / 2000+ icons / 80+ presets」这类上游功能规模数字仍在表里 —— 见上面「刻意不拦」。
- `docs/architecture.md` 由 `/docs arch` 生成、手提交，页头「自动生成于 2026-06-05」会一直躺在仓库里；
  生成物该不该入库、入库要不要带「sha + 生成命令」，留待下一轮。

## 2026-10-30（第三十六轮：永远为真的 warn 不是信息）

### Fixed

- **`skillspector` 那条检查结构上永远 warn**：`reportSkillspectorFindings` 用的是
  `statusForFindings(total)`，>0 就 `warn` —— 本仓库实测 105 条（CRITICAL 1 是
  `sharp-edges/references/lang-php.md` 里那句 `eval(base64_decode())` 反例），
  **每一次 review 都挂同一条、数字从不变化**，没人会去看。一条永远给同一个答案的检查
  不是「有发现」，是噪声地板 —— 和第二十二轮那个「永远为真的门禁」是同一类东西，只是反过来。
- **改判增量**：新增冻结基线 `claude-scene/src/data/skillspector-baseline.json`
  （107 条 / 16 条规则，`note` 里写了重生成命令），`compareSkillspectorFindings()` 按
  `pattern` 计数比基线：
  - 某条规则涨了（基线里没有的规则 base 记 0，也算涨）→ `warn` + `warnKind: 'findings'`，
    消息点名 `规则 基线→现在`，让人知道涨的是哪一类，而不是一个总数；
  - 与基线一致 → `pass`，但**数字照样写进消息**（「共 105 个（CRITICAL 1 / HIGH 66）与冻结基线一致」）——
    pass 不等于「无问题」，这句必须说清；
  - 比基线少 → `pass` + 「比基线少 N 条，可下调基线」，不许静默；
  - 基线读不到 / 形状坏（缺 `total`/`byRule`）→ `skip` + `skipReason: 'input-missing'`：
    没有基线时既不能说通过（那是把 105 条当 0 条），也不能替人下结论。
- **仍然不写 `skillspectorPassed`**：发现项是第三方 skill 的指令模式与文档反例，判 fail 是假红，
  拿它当门禁只会恒报 failed（`gate-flags.js` 里那条注释保留）。
- **顺带被同一轮的门禁抓出来的真 bug**：skip 分支原本写的是 `skipReason: 'input-missing'`，
  而引擎只读 `result.reason`（`skipReasonFrom`）—— **声明了但没人听见**，日志里仍然记成
  「原因只在 message 里」。第三十轮的债务棘轮先报红（132 > 131）才暴露出来。
  改回 `reason:`，并把断言从「读我自己写的那个键」改成「走引擎的分类函数」
  （`skipReasonFrom(result).reason` / `warnKindFrom(result).kind`）——
  用自己写的键做断言，等于让单测给假声明背书。

### Added

- `external-tool-verdicts.test.js` 21 → 32 例：基线自身完整性（`total === ΣbyRule`）、
  一致 → pass（且不含「无问题」）、涨 1 条 → warn 点名、新规则 → warn 且 base 记 0、
  下降 → pass + 可下调、空结果 → pass、基线不存在 → skip(`input-missing`)、
  基线缺 `byRule` → skip、`compareSkillspectorFindings` 纯函数两条。
  其中「基线自身完整性」用例顺带钉死一条隐性依赖：老的「有 CRITICAL 也只 warn」用例
  靠 **`PHPshell` 不在基线里** 成立，基线一重生成就可能变成「与基线一致 → pass」，
  所以显式断言基线里没有这个规则名，改基线时先红。

### Self-audit

7 条自探针逐条弄红后按字节复原（`$TEMP/r36-probes.py`，`ALL_RED_AS_EXPECTED=True`）：
丢掉基线比对（`if (true)`）→ 红；`dropped` 恒 0 → 红；不声明 `warnKind` → 红；
基线读不到时假装基线为空 → 红；比对时忽略 `byRule` → 红；
把 `reason:` 写回引擎不读的 `skipReason:` → 红；把基线 `total` 改 106 → 红。

### 验收

- `npx vitest run claude-scene/src/handlers/external-tool-verdicts.test.js`：**32 例全绿**；
  两套 eslint 干净；6 个 checker 全 `EXIT=0`。
- **现场跑出来的第一条真实增量**：取证时基线是全仓 105 条；跑 review 的中途另一个会话提交了
  `landing-page-design` skill（自带 `NOTICE.md`，已在 `e44e44a` 落地），于是库里 29 个 skill
  实测 107 条，这条检查第一次真的说话：
  `SkillSpector 有超出冻结基线的新发现：Scope Creep 2→4，共 107 个（CRITICAL 1 / HIGH 66）`。
  **这正是冻结基线该有的行为**：新增技能 = 新的第三方内容 = 要有人看一眼再接受。
  本轮接受它（2 条都是 LOW、都是文档示例命中），基线 105 → 107 并注明捕获于 `e44e44a`。
- 同步更新 `scripts/scenes-stats.json`（583 → 585 步）：它是 `scan-scenes` 的产物，
  那份技能接入提交里没带上，pre-commit 第 4 步会红 —— 派生文件跟着场景走，不是「顺手带的」。

---

## 2026-10-30（第三十五轮：自检记录里的「那时干净」不是「现在干净」）

### Fixed

- **`detector-report.js` 用记录里的字段判定现在的工作区**：`verdictOf` 收到的 `dirty` 是
  `data.workingTreeDirty === true` —— 那是 detector-sweep **跑的那一刻**写进记录的事实。
  于是「自检时工作区干净、之后又改了 3 个文件」被判成 pass，而注入点针对的是跑那一刻的代码，
  改过的文件它根本没验过。现在两个事实分开取：`dirtyThen`（记录里）+ `dirtyNow`（现场 `git status --porcelain`），
  两种成因说两句不同的话 —— 「自检是在有未提交改动的工作区跑的」vs「自检之后工作区又有未提交改动（HEAD 没变）」。
- **产物缺 `workingTreeDirty` 时以前等于「干净」**：`checkShape` 不查这一位，`undefined === true` 为 false，
  缺字段就默默走了「干净」分支。现在缺这一位 → `skip`（形状不对等于没有产物），与 `total/passed/failed/stale` 同一契约。

### Added

- `detector-report.test.js` 18 → 21 例：记录写干净但现场脏 → warn `stale-evidence` 且文案是「自检之后」；
  记录写脏 + 现场也脏 → 报「自检时脏」（两件事不许混成一句）；产物缺 `workingTreeDirty` → skip。

### Self-audit

4 条自探针全部把守卫弄红再按字节复原（`$TEMP/r35-probe.py`，`ALL_RED_AS_EXPECTED=True`）：
`dirtyNow` 恒为 false → 红；`checkShape` 去掉这一位 → 红；`if (dirtyNow)` 改成 `if (false)` → 红；
`if (dirtyThen)` 改成 `if (false)` → 红。

**现场验证（不是 mock）**：干净工作区重跑 `npm run detector:sweep`（记录 sha = 当前 HEAD、`workingTreeDirty: false`、12/12），
然后往仓库放一个未跟踪文件再跑 `/review` —— 新分支真的说话：
`自检之后工作区又有未提交改动（HEAD 没变）—— 注入点针对的是 59c4546 那份代码…`（`warn 3`）；
删掉该文件再跑，回到 `pass 18 / warn 2`（只有 `sec-bug-hunt` + `skillspector` 两条环境/工具事实）。

### 验收

- `npx vitest run`：**116 files / 1483 tests 全绿**。
- `npx eslint claude-scene --max-warnings 0`、`npx eslint .`：干净；6 个 checker 全 `EXIT=0`。
- `/review --auto --skip-sweep`：`EXIT=0`，`pass 17 / fail 0 / warn 3 / skip 19 / noop 4` ——
  多出来的那条正是本轮要的效果：`自检记录来自 b42572b，当前 HEAD 是 8ac3f7a —— 记录已过期`（`stale-evidence`）。

---

## 2026-10-30（第三十四轮：入口文档承诺的系统不是这个系统）

第三十三轮把「死配置 / 死文档」清完了，但留了一条 Known issue：「README 的工作流数字不对，没有检查器查这一行」。
顺着这条线取证，发现问题不是一行数字，而是**入口文档整页**在描述一个不存在的系统 —— 读者照做会走进死路，
而 agent 照着做会去调用不存在的命令。

### Fixed

- **工作流数字三种说法、全都不对**：`README.md` 写「25 个自动化工作流（Web 19 + 移动 6）」，
  `README_EN.md` 写「27 automated workflows (21 Web + 6 Mobile)」，而同一个文件第 114 行又写 26 —— 真值是 **26（Web 20 + 移动 6）**
  （`claude-scene/scenes/` 26 个 JSON，其中 `mobile-*` 6 个）。两份都改对，并把这**三个**数字纳入 `check-doc-counts`。
- **`/design` 被写成「照抄就能跑」，但它两年前就并进了 `/ui-polish`**：没有 `design.json`、没有 `.claude/commands/design.md`。
  最要命的是 `.claude/commands/build.md` 让 agent「先跑 `/design` 出技术方案」，`report-fix.md` 的流程里也有它 ——
  agent 会拿着不存在的命令开工。现全部改口为真实链路：`/spec` → `speckit-plan` / `speckit-tasks` 两个 skill → `/build`。
  同一批修掉的还有 `README.md`、`README_EN.md`、`CLAUDE.md`、`AGENTS.md`、`ARCHITECTURE.md`、`INSTALL.md`、
  `.claude/rules/conditional/{core-rules,anti-slop-design}.md`、`.claude/rules/od-craft/index.md`、
  `docs/harness-engineering/12-principles.md`、`.claude/commands/spec.md`、两份 `constitution.md`（后者是本机 gitignored 副本）。
- **`/simplify` 同样已退役**（→ `/refactor` 的 simplify 模式），却还写在 README、`12-principles.md`、`core-rules.md`、`INSTALL.md` 里。
- **`/enhance-prompt` 是幽灵命令**：`.claude/commands/` 33 个文件里没有它，29 个 skill 里也没有它 ——
  它只存在于本机 gitignored 的 `open-design/skills/enhance-prompt/SKILL.md`。README 的表格里写得像自带命令。
  现三行都标注出处（Open Design Skill 提供，需本地 clone `open-design/`），并在表头之上写明前提。
- **「另有 9 个功能已融入增强菜单（cicd/deps/setup/review/feature 内按需弹出）」基本是假的**：
  增强分组 `RAW_REGISTRY` 里根本没有 `cicd`、`setup` 这两个键，增强项全是探测器驱动的（stagehand/mythos/gepa/critiq/huashu/impeccable）。
  9 项里只有 **`changelog` → `/release`（+ `/mobile-release`）** 与 **日志脱敏 → `/review`** 真有场景步骤；
  其余 7 项（`backup` `docker` `sbom` `loadtest` `incident` `migration` `llm-proxy-audit`）
  只在 `actions.js` 里注册了 handler，**任何场景步骤都不会调用**，CLI 也没有 `run <action>` 这种入口 —— 用户永远触发不到。
  两份 README 与 `CLAUDE.md` 都改成这个三分类（已独立成场景 / 已并入 / 不可达）。
- **`INSTALL.md` 的「指令 → 场景文件」表有 4 行指向不存在的文件**（`/simplify`→`simplify.json`、`/hunt`→`hunt.json`、
  `/design`→`design.json`、`/analyze`→`analyze.json`），表后还写「12 个智能工作流」并列 5 个 + 「还有 8 个」= 13。
  现改为「命令名 = 场景名」的规则 + 指向 `.claude/scenes/README.md`，不再手抄一份会过期的清单。
- **`ARCHITECTURE.md` 的架构图与 Quick Start 也在描述不存在的系统**：图里有 `/design` `/simplify`（换成 `/spec` `/rollback`，宽度保持）；
  Prerequisites 要求 `Claude Code CLI`（引擎是仓库内 Node 脚本，不需要）；`cp .env.example .env`（根目录没有，真文件是 `claude-scene/.env.example`）；
  Open Design 段说「129 design systems」（本地 clone 是 152，且该目录 gitignored、随上游变化）—— 改成不写会过期的数字。
- **两份 README 的目录树数字**：场景定义 27 → **26**、Agent 8 → **12**、conditional 规则 9 → **13**；
  `README_EN.md` 的树里点名的 `hunt.json` / `e2e.json` / `monitor.json` / `enhance-prompt.json` 四个文件都不存在，缺 `spec.json` / `setup.json`；
  CLI 命令清单漏 `memory` / `sync-docs`。现在树里点名的每个 `.json` 都是真实文件。
- **`README.md` 概览里的 Open Design 数字（152 / 111 / 137 / 11 / 6 / 3 / 102）有 3 个是错的**
  （skills 实为 138、craft 实为 12、设备框实为 5），而且这个目录 gitignored、随上游每次 pull 都变。
  现改为不写会过期的精确数字，只写有什么。
- **`Claude_Code_全自动驾驶系统_融合版.md`（本机 gitignored）** 的触发词表里全是 `/design` `/analyze` `/hotfix` `/deploy`
  这类从未落地过的命令 —— 按第三十三轮的先例加 `> **归档**` 横幅，保留原文。

### Added

- **`claude-scene/src/commands/doc-claims.test.js`（6 例）** —— 入口文档的三类「点名」开始有机器复核：
  ① 反引号里的 `` `/命令` `` 必须是真命令（`.claude/commands/*.md` ∪ `.claude/skills/*/SKILL.md`，`speckit.clarify` 这类点号写法归一成横线）、
  宿主内置（`/compact` `/clear` `/rewind`）或占位符（`/command`），否则同一行必须写明出处（旧名 / 已退役 / 不存在 / Skill 提供 / Open Design）；
  ② README 目录树 `scenes/` 那一段点名的每个 `xxx.json` 都必须真实存在，注释里的场景数必须等于真值；
  ③ 「并入某场景」必须真在那份 JSON 里、「不可达」必须真没有场景步骤调用（双向：谁改了场景都得回来改文档）。
  下限断言：命令 ≥ 25 个、树里文件名 ≥ 20 个、场景 JSON ≥ 20 份 —— 正则失效或结构变了要报「扫不到」，不能静静通过。
- **`check-doc-counts.cjs` 新增「工作流总数 / Web / 移动端」三个数字**：中文 `**N 个自动化工作流**：覆盖 Web 前端（N 个）+ 移动端（N 个）`、
  英文 `**N automated workflows** (N Web + N Mobile)`，总数为场景数、移动端为 `mobile-*` 前缀数、Web 为两者之差；
  句子被改写认不出来 → exit 2（塌面），数字不符 → exit 1 并点名。
- **`doc-counts.test.js` 18 → 21 例**：夹具改成「最后 6 个场景是 `mobile-*`」，让 Web/移动端拆分是**数文件数出来的**而不是常量；
  新增三个漂移用例（工作流总数写老 / Web 端对不上 / 移动端对不上）。
- **`retired-commands.test.js` 扩容**：`RETIRED_COMMANDS` 增加 `design` `simplify` `polish`（11 例仍全绿，含「八个退役场景 JSON 不许回来」）；
  新增「旧命令表整表豁免」——表头自己写了 `旧命令` / `旧名` 的表格，表里每行都算已交代清楚
  （逐行再写「旧名：」是噪声），豁免只来自表头，散句和普通表格不豁免。
- **`docs-scene-alignment.test.js` 的名单从 1 个集合拆成 2 个**：`MERGED_INTO_SCENE`（真并进场景：changelog / hunt / analyze / e2e / monitor / property，
  已逐个核对确实写在那份 JSON 里）与 `UNREACHABLE_ACTIONS`（只有 handler：backup / docker / sbom / loadtest / migration / llm-proxy-audit / incident）。
  原来把 12 项混成一个 `MERGED_INTO`「已融入」集合，等于用测试**认可**了文档里那句假话。

### Self-audit

12 条自探针，逐条把守卫弄坏确认变红，再按字节复原（`$TEMP/r34-probes.py`，全部 PASS）：
中文工作流数字写回 25 → `check-doc-counts` exit 1；英文 Web 写 21 → exit 1；那句话被改写 → exit 2；
入口文档塞一个 `/hotfix` → `doc-claims` 红；同一行加「（已退役）」→ 放行（说明豁免是按行生效而不是整站放过）；
目录树点名 `hunt.json` → 红；注释写 27 个 JSON → 红；把 `sbom` 接进 `deps` 场景 → 「不可达」红；
从 `release.json` 删掉 `changelog` → 「并入」红；复活 `design.json` → 红；规则文档裸写 `/design` → 红；
把「旧命令」表头改成「命令」→ 表行立刻变红（证明豁免来源是表头，不是文件路径白名单）。

### Known issues（本轮不修，登记在此免得下次又从零发现）

- `ARCHITECTURE.md` 的外部件表仍写「Open Design 40k+ Stars / 129 design systems」这类**会随上游变化**的数字；
  本轮只去掉了 Quick Start 与流程图里指向不存在事物的部分。
- `claude-scene/src/handlers/detector-report.js` 的 `workingTreeDirty` 读的是自检记录里的字段，不是现场 `git status`。
- `skillspector-scan` 在 `/review` 里稳定报 105 个问题（CRITICAL 1 / HIGH 66），全部来自 `.claude/skills/*/references/*.md` 的**示例代码**；
  这是探测器把文档当源码扫的老问题（结果里已写明「需人工复核」），不是本轮引入。
- 根 `constitution.md`、`.specify/`、`Claude_Code_全自动驾驶系统_融合版.md` 都是本机 gitignored 的副本，本轮一并改了口径，但**不入库**。

### 验收

- `npx vitest run`：**116 files / 1480 tests 全绿**（上一轮 115 / 1471）。
- `npx eslint claude-scene --max-warnings 0` 与 `npx eslint .`：干净。
- 6 个 checker 全部 `EXIT=0`（`check-action-stats` / `check-dead-actions` / `check-doc-counts` / `check-readme-stats` / `check-tool-steps` / `check-toolchain-lists`）。
- `npm run scan:deadcode`：`Total dead: 0`（Handlers 0/70、Scenes 0/26、Commands 0/33、Skills 0/29、MCP 0/3）；`node scripts/scan-scenes.cjs`：26 场景 / 583 步。
- `/review --auto --skip-sweep`：`EXIT=0`，`pass 18 / fail 0 / warn 2 / skip 19 / noop 4`（warn = `sec-bug-hunt` 的 npm audit 不可用 + `skillspector` 的 105 条文档误报）。

---

## 2026-10-30（第三十三轮：死配置与死文档必须死透）

### Fixed

- **`docs/tools-inventory.md`（802 行）自己跟自己都对不上，而且没有任何校验器管它**：文件头写 MCP 13 / Skills 37 / 命令 89 / 模块 16，目录写 14 MCP，汇总统计写 18 MCP / 39 skills / 95 命令 / 27–28 场景 / 18 个 Scene JSON（238 步）/ 280+ actions；还引用不存在的 `.claude/mcp.json`、已退役的 `simplify`/`hunt`/`analyze`/`design`/`audit`、已删除的 `env-leak-scanner`。两份 README 都链它。**整份删除**；`README.md` / `README_EN.md` 两处链接改指向真值（`security-toolchain.md` 与 `.claude/scenes/README.md`）。
- **手写快照「看起来还在维护」是因为同步只覆盖了一段**：`sync-docs.js` 每次只刷新 `tools-inventory.md` 的场景计数，那 802 行里的其余数字永远更新不了 —— 读者看到「场景数是新的」，就以为整份是新的。现同步目标只剩活着的 `.claude/scenes/README.md`，对着已删文件调 `updateSceneCounts` 只会静默返回空列表（「同步了」和「没同步」又长得一样）。
- **`.claude/mcp-enable.json` 是死配置，却有 4 份文档把它写成生效机制**：`ARCHITECTURE.md` 有整节「MCP Dynamic Enablement」+ 配置表行、`.claude/scenes/README.md`、`docs/MULTIPLATFORM.md`、两份移动端提案。实际上 `grep` 在 `*.js|*.cjs|*.json` 里**一个命中都没有**，没有任何代码读它；24 条 `mcp_mappings` 里 6 条指向已退役场景（`design`/`simplify`/`hunt`/`analyze`/`audit`/`prototype`），8 个现存场景（`check`/`cicd`/`plan`/`plan-ceo-review`/`qa`/`setup`/`spec`/`update`）没有映射。现整份删除，文档改口为真实情况：只有 `.mcp.json`（light，3 个）/ `.mcp.json.full`（full，14 个）+ `npm run mcp:switch` 整文件切换，**没有**「按场景自动启用」。
- **`.claude/scenes/README.md` 标题写「27 个」，表里 26 行**：AUTO-SYNC 只替换标记之间的表格，标题里的数字靠手改。现改为 26，并把「标题数字 + 表行数」纳入 `check-doc-counts`（第 4 份文档）。
- **`docs/MULTIPLATFORM.md` 的目录树在描述不存在的结构**：`.claude/mcp.json`（早已删除）、重复两行 `settings.json`（其中一行写「项目级设置」）、`.codex/mcp/`（实际是 `.codex/config.toml` + `agents/`）。现按真实结构重写，并把 `.mcp.json` / `.mcp.json.full` 放到仓库根的位置。
- **活文档点名了不存在的规则文件**：`docs/harness-engineering/12-principles.md` 三处 `.claude/rules/{coding,react-doctor,visual-standards}.md`（早已搬进 `conditional/`）、`karpathy-principles.md`（已并入 `conditional/core-rules.md`）；`.claude/rules/conditional/memory-auto-save.md` 的「详细规则见原文件 `.bak`」指向一份既不存在、也无法重新生成的备份。现全部指向真实文件（`core-rules.md` 写明含 Karpathy 三诫），`.bak` 指针换成实现目录 `claude-scene/src/handlers/memory/`。
- **两份移动端提案在写「要改 `mcp-enable.json`」**：它们是 2026-06-10 的方案，但没有任何归档标记，读起来像现行计划。现各加一条 `> **归档**` 横幅，说清「未按本文落地 × 该映射表与 `mobile-check` 场景今天都不存在」。

### Added

- **`retired-artifacts.test.js`（6 例）**：退役文件不存在；没有代码去读退役文件（注释里交代历史不算「读」，本测试自己持有名单因此跳过自身并写明理由）；活文档零提及（白名单只放台账 `progress.md` / `DECISIONS.md` / `docs/CHANGELOG.md`，以及带 `> **归档**` 横幅的历史提案）；活文档点名的 `.claude/rules/*.md` 必须存在（`x.md.bak` 这类备份名用负向先行断言排除）；入口文档相对链接必须可解析。每条都有「自证非空跑」下限（源码 ≥ 80 个文件、活文档 ≥ 40 份、规则引用 ≥ 3 处、链接 ≥ 20 个）。
- **`check-doc-counts.cjs` 第 4 份文档 `.claude/scenes/README.md`**：`## 当前场景（N 个）` 的 N 与 AUTO-SYNC 表行数**都**必须等于场景数；文件读不到、标题格式变了、表一行都认不出 → exit 2（塌面不许降级成漂移）。
- **`doc-counts.test.js` +3 例**（15 → 18）：标题数字写老 → exit 1；表少一行 → exit 1；整个 README 不见了 → exit 2。

### Self-audit 顺带修掉的两个「探测器自检用例过期」

跑 `npm run detector:sweep` 时发现 12 个用例里有 **2 个注入点已经匹配不到**（`注入点没匹配到（用例过期）`）——
它们校验的是引擎最核心的两条假绿守卫，却因为后来的重构改了源码文案而**静默失效**：自检记录照样写着「10/12 有效」，
`/review` 只能说「记录过期」，没人知道那 2 条验的是「空结果记 pass」和「裸字符串 + 本轮未执行」。

- **空结果记 pass**：`start.js` 的那条 warn 后来补了 `warnKind: 'silent'`，注入点跟丢。现按当前文案重新锚定。
- **裸字符串 + 本轮未执行**：`handlers/mobile/audit.js` 已改成「场景声明的工具名就是真去查的那个」+ 返回对象，
  原文案不复存在。现按当前写法注入（仍是「裸字符串 + 本轮未执行」的违规形态）。

修完 `detector:sweep` 为 **12/12 个探测器有效**。

### Known issues（本轮不修，登记在此免得下次又从零发现）

- `ARCHITECTURE.md` 的整体正文仍陈旧：Prerequisites 写 `Claude Code CLI`、Open Design 克隆、`.env.example`，ASCII 架构图里还有 `/design` `/simplify`。本轮只改了与死机制相关的那一段。
- `README.md:11` 的「25 个自动化工作流」与真值 26 场景不一致，`check-doc-counts` 目前不查这一行。
- `detector-report.js` 的 `workingTreeDirty` 读的是自检**记录里**的字段，不是现场 `git status` —— 「记录跑的时候工作区干净」被当成了「现在干净」。
- 本轮复跑 `detector:sweep` 后 `/review` 稳定在 `pass 19 / fail 0 / warn 1 / skip 19 / noop 4`（上一轮 17/0/3/19/4）：
  `证据过期` 那条 warn 消失，是因为过期注入点修好了、自检记录也在干净工作区按当前 HEAD 重跑过；
  剩下的 1 条是 `sec-bug-hunt` 的「npm audit 接口不可用，依赖漏洞未知」—— 环境事实。


## 2026-10-30（第三十二轮：「外部工具」三套名单，每份都跟自己自洽）

### Fixed

- **同一个概念 7 份名单 / 5 个数字，而且每份都能通过当时的校验**：真值 `security-toolchain.md` 是 33 个工具，两份 README 的正文清单写 29 和 26，逐工具表列 26 行和 23 行，按类型表（安装清单）列 28 和 25，外部组件散文写「84 = 29+3+23+29」和「81 = 29+3+23+26」。`check-doc-counts` 一路绿灯，因为它只比「声明的数字 vs 括号里点了几个名」—— **文件跟自己对齐**被当成了「跟真值对齐」。现两份 README 的正文清单与逐工具表**集合等于**真值表（33），中英按类型表对齐为 28，外部组件 84/81 → **83 = 29+3+23+28**。
- **真工具名被写成不存在的名字**：引擎里的动作名是 `env-var-leak`（`actions.js:347`、`review.json:382`、`flow` 的 `step 4.5`），README 的正文清单 / 逐工具表 / 按类型表 / 汇总段却写 `env-leak-scanner`——同一份 README 的另一段（步骤清单）写的又是 `env-var-leak`，自己跟自己都对不上。现统一为 `env-var-leak`。
- **两个「不是安全工具」的东西混进了安全工具链清单**：`Stagehand`（增强探测器）与 `mythos-agent`（增强探测器）出现在正文清单里，各自的说明在 `enhancements.md`。现从安全工具链清单移除，散文里对应的「AI 浏览器功能测试、假设驱动安全推理」两处能力描述同步删掉。
- **逐工具表漏了 7 个真在跑的步骤**：`jscpd`（step 2.95）、`size-limit`（2.96）、`Stryker`（`/qa` step 6.5）、`codeguardian`（`/loop` 4.2 / `/optimize` 9.6 / `/refactor` 13.5）、`critiq`（`/review` 增强项）在真值表里都有、README 表里没有；`Spectral` / `markdownlint`（handler 已注册但无场景步骤）漏得更彻底。现补齐 7 行，英文表另补 `biome` / `ruff` / `hurl` 共 10 行。

### Added

- **`scripts/lib/toolchain.cjs`：名单判据只此一份**。真值解析（`parseCanonical`）、正文清单解析（`parseToolchainBullet`）、逐工具表解析（`parseSecurityTable`）、按类型表解析（`parseByTypeTable`）、比对（`compareNames` → 缺 / 多 / 重复）、总判（`checkRoot` → 0 / 1 / 2）。比名一律走 `normalize()`（大小写、空格、连字符、下划线不算差异），**不做同义词映射**——名字写错就该红，映射表只会把错写合法化。
- **`scripts/check-toolchain-lists.cjs`：三种结论**。0 = 全部相等；1 = 有名单跟真值对不上（逐条打印「真值里有、这里没有 —— xxx」/「真值里没有，这里写了 —— xxx」/「写 32 个，实际点名 33 个」）；2 = 扫描面塌了（真值少于 30 个、文档读不到、标题格式变了）—— 塌面不许降级成 1，否则「格式变了」会被当成「名单错了」。
- **`toolchain-lists.test.js` 17 例**：真仓库 0 + 反空跑下限；夹具对照组 0；6 种漂移各自红（少点名 / 写错名（同时报多与少）/ 声明数与点名数不符 / 逐工具表漏行 / 重复点名 / Count 与名字数不符 / 中英按类型表不是同一批 / 真值跌破下限 / 文档读不到 / 标题格式变了必须 2）；`normalize` 不做同义词映射；`compareNames` 三个结论都要给。
- **`check-doc-counts.cjs` 口径收紧**：「外部组件」算式的第 4 项改取**按类型表的 Count 列之和**，不再是正文清单的条数——否则同一份文档里两个「外部工具数」各自成立。正文清单正则改名 `外部安全工具链` / `External security toolchain`。
- **`security-toolchain.md` 顶部写明它是唯一真值**，并说清「外部安全工具链 33」与「外部工具（按类型）28」是两个概念（安装清单含 act/restic/specify-cli，不含 codeguardian/critiq）。

### Known issues（本轮不修，登记在此免得下次又从零发现）

- `docs/tools-inventory.md`（802 行，README 两份都有链接）仍是 2026-06-14 的快照：MCP 13 / Skills 37 / 命令 89 / 模块 16 全部过期，工具矩阵里还是 `env-leak-scanner`，工作流列还写着已退役的 `hunt` / `audit`。`sync-docs.js` 只更新它的场景计数。它现在不在任何校验器的覆盖范围内。

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
