---
description: 从 MemPalace 召回历史对话原文（逐字、无摘要）
argument-hint: "<查询关键词> [--wing <项目>] [--last <时间>] [--limit N]"
---

# /recall — 调取历史对话原文

通过 MemPalace MCP 工具检索过往对话的**逐字原文**（不摘要、不改写）。

## 用法

```
/recall "上次怎么改的 detectNestedLoops"
/recall "audit 报错" --last 7d
/recall "用户偏好" --wing auto-coding --limit 5
```

## 执行步骤

1. 解析参数：query / wing / last / limit
2. 调用 `mcp__mempalace__search`：
   ```
   query: <查询关键词>
   wing: <项目名，默认当前 cwd 对应的 wing>
   limit: <默认 10>
   ```
3. 展示返回的 drawer 原文：
   - 每条带 timestamp + 来源（user / claude / tool）
   - 高亮命中关键词
4. 如果命中 > 5 条：询问是否需要 `mcp__mempalace__open_drawer <id>` 拉完整上下文

## 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `<query>` | 检索关键词（必填） | — |
| `--wing <name>` | 限定项目 wing | 当前项目名 |
| `--last <duration>` | 时间窗（7d/30d/3m） | 不限 |
| `--limit <N>` | 返回条数 | 10 |
| `--all-wings` | 跨所有项目检索 | 否 |

## 何时使用

- 你说 "上次我们怎么处理的"
- Claude 回答 "我不记得"
- 跨会话延续之前的工作（30 天后回到项目）
- `/bugfix` 之前查找相似 bug
- `/refactor` 之前查找用户偏好原话

## 与现有 5 个记忆后端的关系

- **MemPalace** → 对话原文（逐字、verbatim）
- **project-memory** → 工作流结构化结果
- **Claude-Mem** → 会话摘要
- **agentmemory** → Agent 协作
- **NEXO** → 运行时事件
- **CodeGraph** → 代码符号

`/recall` 只查 MemPalace 一层。需要结构化结果用 `node src/index.js memory list`。
