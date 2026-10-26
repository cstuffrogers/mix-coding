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

## 回写堵截

`handleMemoryRemember` 会把 `context.recalled_memories` 当内容回写。只回写
`scope === 'project'` 的行：把 `cross-project` / `unscoped` 写回去等于给它们盖上
本项目的章，下一轮就再也分不清来源 —— 这是污染放大器。

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

## 已知限制

- **CodeGraph 是外部工具产物**，引擎只读不重建；`--target` 只影响读哪个库。
- **`consolidate` 只对 project-memory 去重**，三个全局后端仅打印计数（跨项目的
  「近似重复」无法安全自动合并）。
- 没有保留期/轮转：全局库只增不减，需要显式策略。
