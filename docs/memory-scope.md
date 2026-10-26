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

## 存储卫生（写入侧的四条硬约束）

| 约束 | 为什么 |
|---|---|
| 去重指纹 = **完整内容** 的 sha256 | 旧实现拿 JSON 前 200 字符当指纹，两次审查前缀一样，第二次被静默丢弃、`last_memory_id` 还指回上一条 —— 报告说「已保存」，实际没写 |
| `deduplicate` 也按完整 hash，且**保留最新** | 旧实现用前 100 字符，实测把 3 条内容不同的记忆删成 1 条。`data` 为空的老条目一律不动 |
| 超容量**归档**，不删除 | claude-mem items 上限 500、markdown 上限 100；超出的条目写进 `~/.claude/memory/archive/*.jsonl` 或 `markdown-pruned.log`，可追溯 |
| 容量裁剪按 **mtime** | 旧实现按文件名排序（`<type>-<ts>.md`），等价于先按类型字母序分组 —— 实测把最新的 general/review 归档全删了，却留下最旧的 aaa |

读回时 `content` 被截断（claude-mem markdown 500 / NEXO 300 / agentmemory 500）必须带
`truncated: true`，回写时过滤掉 —— 否则残片会被固化成「完整记忆」。

写入一律走 `writeFileAtomic`（`src/lib/fs-utils.js`）：先写同目录 tmp 再 rename。
直接写目标文件时进程被杀会留下半截 JSON，读方 `JSON.parse` 失败后静默返回 `[]`，
下一次写入就把整类记忆覆盖成一条。`items.json` 解析失败时还会把坏文件搬到
`archive/<category>-items-corrupt-<ts>.json` 再重建，而不是当空数组盖掉。

## 计数要说实话

`list` 的计数分三栏：**本项目 / 无归属 / 其他**。旧实现把
`readAgentmemory(..., scope.path)` 的长度当「本项目 N 条」，而这个 SQL 条件是
「本项目 OR 无归属」，等于把历史垃圾算进了本项目。

## 已知限制

- **CodeGraph 是外部工具产物**，引擎只读不重建；按 `targetPath/.codegraph/codegraph.db`
  定位（可用 `CODEGRAPH_HOME` 覆盖），目标项目没有库时返回 0 —— 不能回退去读引擎自己的图。
- **`consolidate` 只对 project-memory 去重**，三个全局后端仅打印计数（跨项目的
  「近似重复」无法安全自动合并）。删了几条会在返回消息里说出来。
- **没有保留期/轮转**：agentmemory 与 NEXO 只增不减（NEXO 每次召回还要全目录
  `statSync`）。需要显式的用户策略再动。
