# 记忆系统作用域（谁在存、存在哪、谁能读到）

5 个后端，**作用域不一样**。这是设计限制还是缺陷，取决于有没有归属信息 ——
本文记录现状与规则。

## 作用域表

| 后端 | 落盘位置 | 作用域 | 归属字段 |
|---|---|---|---|
| `project-memory` | `<项目>/.claude/memory/<type>/*.json` | **项目级**（天然隔离） | 不需要（目录即归属） |
| `codegraph` | `<项目>/.codegraph/codegraph.db` | **项目级**，只读 | 不需要 |
| `claude-mem` (items) | `~/.claude/memory/areas/topics/<cat>/items.json` | 全局 | `project: { path, name }` |
| `claude-mem` (markdown) | `~/.claude/memory/memory/<type>-<ts>.md` | 全局 | 头部 `- 路径: <abs>` |
| `agentmemory` | `~/.agentmemory/memory.db`（表 `memories`） | 全局 | 列 `project_path` |
| `NEXO` | `~/.nexo/runtime/<type>_<ts>.json` | 全局 | `project: { path, name }` |

「全局」是指 5 个后端共用一个库文件，不是指数据混在一起 —— 有了归属字段之后，
召回会按项目过滤。

## 归一化规则（`src/handlers/memory/project-scope.js`）

存的是**绝对路径**，且必须归一化，否则同一个项目会分裂成多个身份：

| 规则 | 原因 |
|---|---|
| `resolve()` 成绝对路径 | 相对路径存进库后，换个 cwd 就再也认不回来 |
| 分隔符统一 `/` | `E:\a\b` 与 `E:/a/b` 是同一目录 |
| 去掉尾随 `/` | `E:/a/` 与 `E:/a` 是同一目录 |
| Windows 转小写 | NTFS 大小写不敏感 |
| `realpathSync.native` 逐段展开 | Windows 8.3 短名（`ADMINI~1`）与长名是同一目录；还顺带解掉符号链接。路径**不存在**时向上找最近的存在祖先再拼回剩余段 —— 否则「刚写入时」和「目录建好后」会算出两个不同字符串 |

## 召回规则

| 归属 | 默认 | `cross_project: true` |
|---|---|---|
| `project` — 本项目 | ✅ 召回 | ✅ 召回 |
| `unscoped` — 打标之前的历史 | ✅ 召回，但标记 `scope: 'unscoped'` 并在消息里报条数 | ✅ 召回 |
| `cross-project` — 别的项目 | ❌ 排除，消息里报「已排除 N 条其他项目记录」 | ✅ 召回，标 `scope: 'cross-project'` |

无归属的历史记录**不静默丢弃**（等于删用户数据），但必须标出来 —— 它不一定属于当前项目。

召回管道还有四道关卡，每一道都对应过一个真缺陷：

1. **分类目录动态枚举**：`items.json` 的分类名 = 工作流类型（`review` / `audit` /
   `mobile-review` …几十种）。旧实现写死 `general/architecture/decision/pattern`，
   其余类型的 items **写进去永远召不回来**、`list` 也数不到（实测写了 4 类只数到 1）。
2. **`filters.type` 是数组**：场景里 21 个 recall 步骤传 `filters`，其中 19 个 `type`
   是数组。`matchFilter` 原先只认 RegExp / 字符串 / 严格相等，数组永远不匹配
   —— 那 19 个场景的召回**恒返 0 条**：记忆一直在写，从来没被读过。数组按
   「任一命中」处理，记录缺少该字段时不判否。
3. **跨后端去重**：同一条记忆同时落在 5 个后端，不去重就重复注入 8 次。
   去重键 = 分类 + 结构化内容（markdown 标题头是 items 的超集，用「包含即重复」）。
4. **必须打到 stdout**：召回结果原先只存进 `context.recalled_memories`，全引擎没人读
   —— LLM 从来看不到内容。CLI 工作流里 stdout 是唯一注入通道，现在打印
   `↳ 历史记忆: 1. [review] <时间> <内容前 140 字>`。

## 回写纪律

`handleMemoryRemember` **不再**把 `context.recalled_memories` 当内容回写。
旧逻辑「记住刚才召回的内容」在场景里是灾难：`remember` 步骤只传 `{type}`，
于是每轮都把上一轮的记忆存成本轮成果，一层套一层 —— 旧库里 `data_snippet`
里套 `data_snippet` 的膨胀就是这么来的。现在没有显式 `data` 时只用当轮
context 的结果拼（与 `autoRemember` 同一形状）。

## `--target` 与 `PROJECT_ROOT`

`PROJECT_ROOT` 是 `paths.js` **import 时**求值的常量（`$MIX_CODING_PROJECT_DIR || cwd`）。
用 `--target X` 跑别的项目时它仍是 cwd，所以 memory handler 一律用**调用时**传进来的
`targetPath` 定位 `project-memory`（`memoryRoot(rootDir)`），不能读 `MEMORY_DIR`。
脚本化调用若要换项目，必须在进程启动前设 `MIX_CODING_PROJECT_DIR`，进进程再改无效。

## 测试隔离

三个全局后端都支持 env 覆盖，且**在调用时**读取（不是 import 时）：

```
CLAUDE_MEM_HOME / AGENTMEMORY_HOME / NEXO_HOME
```

测试必须设它们，否则每跑一次就往开发者真实库里塞记录。`smoke.test.js` 通过
`isolateStores()` 统一隔离；`project-scope.test.js` 自带沙箱。

## 存储卫生（写入侧）

| 约束 | 为什么 |
|---|---|
| 去重指纹 = **完整内容** 的 sha256 | 旧实现拿 JSON 前 200 字符当指纹，两次审查前缀一样，第二次被静默丢弃、`last_memory_id` 还指回上一条 —— 报告说「已保存」，实际没写 |
| `deduplicate` 也按完整 hash，且**保留最新** | 旧实现用前 100 字符，实测把 3 条内容不同的记忆删成 1 条。`data` 为空的老条目一律不动 |
| 超容量**归档**，不删除 | claude-mem items 上限 500、markdown 上限 100；超出的条目写进 `~/.claude/memory/archive/*.jsonl` 或 `markdown-pruned.log`，可追溯 |
| 容量裁剪按 **mtime** | 旧实现按文件名排序（`<type>-<ts>.md`），等价于先按类型字母序分组 —— 实测把最新的 general/review 归档全删了，却留下最旧的 aaa |
| 读-改-写要拿跨进程锁 `withFileLock` | `items.json` 是整文件重写：原子 rename 只防「读到半截」，防不住「两个进程同时读到同一份、各自加一条、后写的覆盖先写的」丢更新。锁超时按降级处理（照常写，宁可丢更新也不能永久写不进去），且只在「自己拿到锁」时才删除锁文件 |
| 写入一律 `writeFileAtomic`（tmp + rename） | 进程被杀留下半截 JSON → 读方 `JSON.parse` 失败后静默返回 `[]` → 下一次写入把整类记忆覆盖成一条。`items.json` 解析失败时还会把坏文件搬到 `archive/<category>-items-corrupt-<ts>.json` 再重建 |

## 存储卫生（读侧）

读侧一律「要么完整，要么带 `truncated: true`」，绝不允许静默变短：

| 约束 | 为什么 |
|---|---|
| SQL 里就 `substr(content, 1, 500)`，取值另带 `length()` | 直接 `SELECT content` 时，库里存了一条 1.2MB 的记录就足以让 `execSync` 撞上默认 **1MB maxBuffer** → 报 ENOBUFS → 外面 catch 成 `[]`。库里有数据、召回永远是 0 条，无任何提示 |
| `sqlite3` 调用的 `maxBuffer` 拉到 64MB | 同上，双保险（计数类查询输出很小，但写/读都可能超） |
| 召回单条封顶 `RECALL_ROW_CAP = 1200`，封顶后改写成 `content + truncated + length` 并丢掉原始 `data` | 项目记忆写入时**不截断**（用户数据要完整落盘），但一条 5MB 的输入被原样塞进 context 会让上下文直接爆掉（实测召回 5.2M 字符）。封顶必须有迹可循 |
| 读回 `content` 被截断（claude-mem markdown 500 / NEXO 300 / agentmemory 500）必须带 `truncated: true` | 没标记的残片被回写就会固化成「完整记忆」 |


## 召回装配（读取顺序）

同一条记忆在 5 个后端各有一份副本，召回必须先把它们合成一条，再把预算填满：

| 约束 | 为什么 |
|---|---|
| 每家先多取（`recallQuota = limit × 3`，上限 60 条），再靠去重收敛 | 旧实现是「均分配额」：`limit=10` 时每家只读 2 条。5 个后端存的是同一批记忆的副本，去重后窗口直接空掉 —— 实测库里有 5 条不同记忆，`limit=10` 只召回 1–2 条 |
| 各后端**轮转交错**，不是简单拼接 | project-memory 排在最前面时一家就能吃光 `limit`，其余后端的独有内容（例如只有 NEXO 记的跨场景事件）永远进不来，而返回语仍宣称「来源: 项目/Claude-Mem/agentmemory/NEXO」 |
| 交错预算 = `limit × 6`（上限 240） | 平均每 5–6 行才去重出 1 行；用 `limit` 当预算时 `limit=3` 只召回 2 条（9 行交错 → 去重剩 2） |
| markdown 归档按文件名**倒序**读 | `readdir` 给的是正序（旧→新），其余后端是新→旧，两边的「第一条」不是同一件事，去重配不上对，旧副本会被当成新记录留下 |
| 去重时 markdown 行只比 JSON 载荷（剥标题头） | 归档正文有 500 字上限、还带 141 字的标题头；整段比对会因为「多了标题头 / 被截断」认不出同一条，实测 5 条记忆召出 10 行 |
| `limit` 非正数或非数字回落到 10 | 旧实现 `slice(0, -5)` 会「删掉最后 5 条」，`limit="abc"` 会退化成空 |

## 保留策略（归档，不删除）

`consolidate`（22 个场景的「记忆整理」步骤）与 `pruneMemories` 动作会执行保留策略：

| 后端 | 阈值 | 超出后 |
|---|---|---|
| project-memory | 每类型 300 条 | 移进 `<项目>/.claude/memory/.archive/<type>/`（点目录不参与加载） |
| agentmemory | 每类型 200 条 / 365 天 | 先整行 dump 到 `archive/agentmemory-<ts>.jsonl`（含 `archived_at`），**归档失败就中止删除** |
| NEXO | 2000 文件 / 30 天 | 移进 `~/.nexo/archive/`（重名加 pid 前缀，避免 Windows rename 覆盖） |
| claude-mem | items 500 / markdown 100 | 写入时自带上限，超出的同样归档 |

自动节流：`autoRemember` 结束时最多每 6 小时执行一次，且**只收拾 project-memory**
（NEXO / agentmemory 是全局落地目录，外部工具也可能在读，只在场景里明确的
「整理」步骤才动）。`consolidate` 执行后会写 `.last-prune` 时间戳，避免紧接着的
`autoRemember` 立刻重扫一遍。

## 计数要说实话

`list` 的计数分三栏：**本项目 / 无归属 / 其他**。旧实现把
`readAgentmemory(..., scope.path)` 的长度当「本项目 N 条」，而这个 SQL 条件是
「本项目 OR 无归属」，等于把历史垃圾算进了本项目。

## 写入侧去重（内容指纹）

一次结果会写 4 个后端。重复跑同一场景时，旧实现每家都多一份完全相同的副本：
清单计数一路涨，召回又去重成一条 —— 用户看到的「记忆在变多」是假的。

| 约定 | 为什么 |
|---|---|
| 指纹 = 规范化 JSON 的 sha256（键排序 + 忽略 `timestamp` / `ts` / `created_at` / `updated_at` / `stored_at` / `archived_at`） | `autoRemember` 的 data 每轮都带新 `timestamp`，逐字节比对永远判不出重复 |
| **不忽略 `id`** | `id` 常常是 data 里用来区分两条记录的字段；当成易变字段会把两条真实不同的记忆判成重复，直接丢一条（实测踩到过） |
| 判重窗口按「时间窗」而非「最近 N 条」 | 只看最近 N 条时，别的项目交替写同一类型就会把本项目那条挤出窗口，同内容又落一份（实测 12 个其他项目即复现） |
| 判重必须带**项目** | A 项目写过的内容，B 项目写同样的内容不能被跳过 —— 召回按项目过滤，跳过就等于 B 永远看不到这条 |
| 窗口 7 天 | 窗口无限长会让「每周跑一次的检查」永远只有第一天那条；太短（1 小时）则一天连跑几次照样堆副本 |
| 判重失败一律「照写」 | 宁可多存一份，也不能把不同内容当重复丢掉 |
| `{skipped:true}` 不等于失败 | 消息是「N 个后端命中相同内容未重复写入」，**不能出现「失败」二字**（引擎按 `/失败|阻断|FAIL/` 判步骤失败） |

覆盖范围：project-memory（完整内容 hash）、claude-mem items（窗口内全部条目，已被 500 封顶）、
claude-mem markdown（标题区写 `- 内容指纹:` + 项目路径，新→旧扫到窗口外为止，最多 60 个文件）、
agentmemory（新增 `content_hash` 列，判定下推到 SQL）、NEXO（事件 JSON 带 `fingerprint`，
新→旧扫到窗口外为止，最多 200 个文件）。

## 归档压缩（只压不删）

保留策略一律「归档不删除」，代价是 `.archive` 无限长大。所以 `pruneAll` 末尾会把
**30 天以前**的归档文件压成 `.gz`（`archiveOlderThanDays` 可调）：压缩是无损的，删除不是。

| 约束 | 为什么 |
|---|---|
| 压缩件非空才删原文件 | 压缩失败还删原件就是不可逆的数据丢失 |
| 已有 `.gz` 就跳过，不覆盖 | 覆盖等于用新内容顶掉旧归档 |
| 单文件上限 64MB | `gzipSync` 是一次性读进内存，误归档的大日志会把内存打爆 |
| 压缩后不变小就留原文 | 小文件 gzip 反而变大（头就 18 字节）：压缩是为了省空间，不是把可读文件换成更大且不可读的；这类计入 `noGain` |
| 失败数、超大文件数必须打印 | 静默失败的压缩等于「以为省了空间其实没省」 |
| 覆盖四个归档根 | claude-mem `archive/`、NEXO `archive/`、agentmemory `archive/`、项目 `.claude/memory/.archive/` |

## 已知限制

- **CodeGraph 是外部工具产物**，引擎只读不重建；按 `targetPath/.codegraph/codegraph.db`
  定位（可用 `CODEGRAPH_HOME` 覆盖），目标项目没有库时返回 0 —— 不能回退去读引擎自己的图。
- **`consolidate` 只对 project-memory 去重**，三个全局后端仅打印计数（跨项目的
  「近似重复」无法安全自动合并）。删了几条会在返回消息里说出来。
- **写入侧去重靠内容指纹**（见上）：判重只看内容，所以内容相同但想留时间戳的
  重复记录不会新增；超过 7 天窗口才会重新落一条。指纹是启发式、不是数据库约束，
  极端同时写仍可能各写一份（锁只保证文件不被截断）。
- **`.archive` 只压缩不清理**：`.gz` 件永不删除，体积增长变慢但不会归零
  （引擎不删用户数据的底线优先）。
- **`consolidate` 里的 prune 是写操作**：`review` 类只读场景不含 `consolidate`，
  但 `mobile-review` 等场景历史上就有这一步骤。
