# 自动记忆规则

## 核心原则

记忆工具必须在**不需要用户手动调用**的情况下自动工作。关键区别：

- **MemPalace**（v3.3.5，本地优先逐字记忆，2026-06-06 接入）：通过 Claude Code hooks 自动归档对话原文 + UserPromptSubmit hook 条件触发智能注入。**完全自动**，详见本文最下方"MemPalace 触发条件"章节
- **Claude Code 原生 auto-memory**（`C:\Users\Administrator\.claude\projects\E--auto-coding\memory\`）：保存用户画像、偏好、反馈、项目事实 —— 这是 Claude Code 内置机制，自动触发
- **项目 CLI 记忆**（`node src/index.js memory remember`）：保存技术发现、代码模式、安全漏洞、架构决策 —— 这是项目自定义的 7 后端系统，需要显式调用

本规则定义：**什么情况、调用哪个工具、保存什么数据、如何避免重复**。

---

## 一、触发条件与数据模板

### P0 — 必须保存（安全/关键Bug）

#### 安全漏洞发现
**条件**：发现 XSS、SQL注入、CSRF、命令注入、硬编码密钥、不安全的依赖版本
**调用**：
```bash
cd e:/auto-coding/claude-scene && node src/index.js memory remember --type security --data '{"vulnerability":"<类型>","file":"<文件:行号>","severity":"<CRITICAL|HIGH|MEDIUM>","description":"<一句话>","fix":"<修复方式>","found_at":"<ISO时间>"}'
```
**同时写 Claude Code 原生 memory**：`project` 类型，记录漏洞事实

#### 关键Bug根因定位
**条件**：定位到 bug 根因且修复非琐碎（>5行改动）
**调用**：
```bash
cd e:/auto-coding/claude-scene && node src/index.js memory remember --type bugfix --data '{"root_cause":"<根因>","file":"<文件>","symptom":"<表现>","fix_approach":"<修复思路>","resolved_at":"<ISO时间>"}'
```

### P1 — 建议保存（架构/设计/重要发现）

#### 架构决策
**条件**：做出影响多个模块的技术选型或架构决定
**调用**：
```bash
cd e:/auto-coding/claude-scene && node src/index.js memory remember --type architecture --data '{"decision":"<决策>","alternatives":["<备选1>","<备选2>"],"rationale":"<理由>","scope":["<影响模块>"],"decided_at":"<ISO时间>"}'
```
**同时写 Claude Code 原生 memory**：`project` 类型

#### 用户反馈/偏好
**条件**：用户纠正行为、表达偏好、或给出非显而易见的约束
**调用**：**仅写 Claude Code 原生 memory**（`feedback` 或 `user` 类型），不调 CLI
- 反馈示例：用户说"不要用这种模式"、"以后这样做"
- 偏好示例：用户说"我喜欢简洁风格"、"默认用 X"

#### 代码质量重要发现
**条件**：审查发现反模式（God Object、>300行文件、>10方法类、重复代码 >3处）
**调用**：
```bash
cd e:/auto-coding/claude-scene && node src/index.js memory remember --type review --data '{"pattern":"<反模式>","file":"<文件>","metric":"<具体数值>","suggestion":"<建议>"}'
```

### P2 — 可选保存（规模/上下文变化）

#### 配置/环境变更
**条件**：修改 ESLint 规则、MCP 配置、环境变量、工作流场景文件
**调用**：
```bash
cd e:/auto-coding/claude-scene && node src/index.js memory remember --type general --data '{"change":"<变更描述>","file":"<文件>","reason":"<原因>"}'
```

#### 性能热点确认
**条件**：确认实际性能瓶颈（非静态分析假阳性）
**调用**：
```bash
cd e:/auto-coding/claude-scene && node src/index.js memory remember --type optimize --data '{"bottleneck":"<瓶颈>","file":"<文件>","measurement":"<测量数据>","baseline":"<基线>"}'
```

---

## 二、不保存的情况

以下情况**不调用 CLI**，避免噪音：

1. **琐碎修正**：拼写错误、单行格式调整、注释修改
2. **静态分析假阳性**：性能热点扫描的假阳性结果
3. **工作流执行中**：如果 `context._sceneId` 存在（正在运行工作流），不要单独调用 CLI 记忆保存。工作流自己的 `remember` 步骤会处理。唯一例外：P0 安全漏洞即使在工作流中也应保存
4. **1小时内重复**：`saveProjectMemory` 已内置内容去重——相同类型+相同内容在1小时内不重复写入
5. **纯查询操作**：仅读取文件、搜索代码、回答问题等无修改操作不触发
6. **失败的操作**：操作未成功完成的不保存

---

## 三、后端选择指南

| 数据类型 | Claude Code 原生 | 项目 CLI | 原因 |
|---------|-----------------|---------|------|
| 用户偏好/反馈 | ✅ 必须 | ❌ 不调 | native 系统专为此设计 |
| 项目事实/上下文 | ✅ 必须 | ❌ 不调 | native `project` 类型 |
| 安全漏洞 | ✅ 写 project | ✅ 必须调 | 双写确保持久 |
| Bug根因/修复 | ✅ 写 project | ✅ 必须调 | 结构化数据需要 CLI |
| 架构决策 | ✅ 写 project | ✅ 必须调 | 双写 |
| 代码反模式 | ❌ | ✅ 必须调 | 纯技术数据 |
| 性能基线 | ❌ | ✅ 必须调 | 结构化指标 |
| 配置变更 | ❌ | ✅ 建议调 | 技术元数据 |
| CodeGraph索引 | ❌ | 🚫 禁止 | 自动索引，手动调用无意义 |
| NEXO数据 | ❌ | 🚫 禁止 | 运行时自动采集 |

---

## 四、与工作流记忆的关系

### 分工
- **工作流 `recall` 步骤**：加载历史记忆，为当前任务提供上下文
- **工作流 `remember` 步骤**：保存工作流完整结果（所有步骤的输出汇总）
- **工作流 `consolidate` 步骤**：去重、清理过期条目
- **工作流 `autoRemember` 钩子**：兜底——无显式 remember 步骤时自动保存上下文
- **本规则触发**：在**非工作流**的普通对话中，发现重要信息时自动保存

### 防重复机制
1. `saveProjectMemory` 内置 1小时内容去重
2. `consolidate` 步骤（工作流末尾）跨类型去重
3. 工作流执行中（`context._sceneId` 存在），本规则 P1/P2 不触发
4. `autoRemember` 检查 `_memorySaved` 标志，已显式保存则跳过

### 典型场景
```
用户聊天中提到一个bug → Claude定位到根因（非工作流）
  → 本规则触发：调 CLI 保存 bugfix 类型 (P0)
  → Claude Code 原生 memory：写 project 类型

用户运行 /bugfix 工作流
  → recall 步骤加载上面保存的 bugfix 记忆
  → 修复完成，remember 步骤保存完整结果
  → consolidate 步骤检测到相似内容（1小时内），保留详细版本
```

---

## 五、MemPalace 触发条件（2026-06-06 接入）

MemPalace 作为**第 6 个记忆后端**，专责对话原文的逐字归档与召回。它是**完全自动的**，通过 4 个 Claude Code hook 实现条件触发，不需要工作流改造，也不需要用户手动调用。

### 自动归档（写入端）

通过 `~/.claude/settings.json` 配置的 hooks，自动喂数据进 palace：

| Hook 事件 | 触发条件 | 命令 | 作用 |
|----------|---------|------|------|
| `SessionStart` | 每次启动 Claude Code 会话 | `mempalace hook run --hook session-start --harness claude-code` | 召回当前项目 wing 的最近上下文，启动注入 |
| `Stop` | 每 15 条人类消息后 | `mempalace hook run --hook stop --harness claude-code` | 归档本轮对话原文到 drawer |
| `PreCompact` | Claude Code 准备压缩上下文前 | `mempalace hook run --hook precompact --harness claude-code` | 紧急完整归档，防压缩丢失 |

### 智能召回（读取端）

通过自定义 `UserPromptSubmit` hook (`~/.claude/hooks/mempalace_userprompt_hook.py`) 实现条件触发，**不是所有消息都触发**：

| 触发类别 | 命中条件 | 示例 | 召回查询词 |
|---------|---------|------|----------|
| 工作流指令 | 消息以 `/bugfix` / `/feature` / `/refactor` / `/optimize` / `/review` / `/audit` / `/migration` / `/release` / `/rollback` 开头 | `/bugfix 登录页面验证错误` | 工作流参数文本 |
| 错误关键词 | 包含 "报错"/"bug"/"出错"/"不工作"/"异常"/"失败"/"error"/"fail"/"crash" | "刚才那个测试报错了" | 完整消息 |
| 追忆引用 | 包含 "上次"/"之前"/"那个"/"我们怎么"/"以前"/"还记得"/"previously"/"last time" | "上次我们怎么改的 detectNestedLoops" | 完整消息 |
| 长复杂请求 | 消息长度 > 80 字 | "我需要重构这个模块……" | 完整消息 |

### 不触发的情况（避免噪音）

- 用户已用 `/recall` 显式召回
- 单字符/纯数字回复（"是"/"否"/"1"/"继续"/"y"/"n"）
- 消息长度 < 8 字符
- mempalace CLI 不可用（fail-safe，静默跳过）

### 性能预算

- UserPromptSubmit hook timeout: 15s
- Stop hook timeout: 30s
- 单次 search 默认 `--results 3`
- 命中后注入 markdown 包裹在 `<mempalace-context>` 标签内，便于 Claude 识别

### 与现有 5 个记忆后端的分工

| 后端 | 数据类型 | 触发 | 写入接口 |
|------|---------|-----|---------|
| **MemPalace** | 对话**原文**（逐字、verbatim） | 4 个 hook 自动 | `mempalace mine --mode convos` |
| **project-memory** | 工作流**结构化结果** | 工作流 remember 步骤 | `node src/index.js memory remember` |
| **Claude-Mem** | 会话**摘要** | Claude Code 内置 | 自动 |
| **agentmemory** | Agent 协作上下文 | Agent 运行时 | 自动 |
| **NEXO** | 运行时事件 | 自动采集 | 自动 |
| **CodeGraph** | 代码符号索引 | 文件监听 | 自动 |

**MemPalace 的独特价值**：其他 5 个后端都不存原话。当你说"上次你说要怎么改的"，只有 MemPalace 能精准还原对话原文。

### 手动召回

如果想主动召回：使用 `/recall <query>` 斜杠指令（详见 `.claude/commands/recall.md`），或在对话中调 `mcp__mempalace__search`。

### 注意事项

- **Windows 必须设 UTF-8 环境变量**：`PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1`（已在 settings.json env 配置）。否则 mempalace 在含中文路径/git 作者时崩溃
- **首次接入需要 mine 历史**：`mempalace mine ~/.claude/projects/E--auto-coding --mode convos`，一次性导入历史会话
- **hook 修改后需重启 Claude Code**：Claude Code 仅在会话启动时加载 hook 配置

---

## 六、Supermemory 云端记忆（2026-06-09 接入）

Supermemory（`supermemoryai/supermemory`，26K+ stars）作为**第 7 个可选后端**，提供语义搜索和自动事实提取能力。通过 `SUPERMEMORY_API_KEY` 环境变量控制开关。

### 核心能力（与现有后端的区别）

| 能力 | 现有后端 | Supermemory |
|------|---------|-------------|
| 召回方式 | 类型 + 关键字匹配 | 语义搜索（向量） |
| 存储内容 | JSON 数据块 / 原文 | 自动提取结构化事实 |
| 用户画像 | ❌ 无 | ✅ 静态特征 + 动态上下文 |
| 过期/矛盾 | 手动 consolidate | 引擎自动处理 |
| 外部连接器 | ❌ 无 | Gmail/Drive/Notion/GitHub |
| 部署位置 | 本地 | 云端 SaaS |

### 开启方式

```bash
# .env 文件
SUPERMEMORY_API_KEY=sm_your_key_here
```

不设置则完全不影响现有功能（6 后端正常运作）。

### 触发时机

在以下场景会调用 Supermemory：

| 操作 | 触发时机 | 调用方法 |
|------|---------|---------|
| `recall` | 所有记忆召回步骤 | `recallFromSupermemory()` — 取 profile + semantic search |
| `remember` | 所有记忆保存步骤 | `saveToSupermemory()` — `client.add()` |
| `consolidate` | 记忆整理时 | `supermemoryStatus()` — 仅显示连接状态 |

### 注意事项

- **不启用 Supermemory MCP**：通过 SDK 直调 API，避免与现有 MCP 工具名冲突
- **不安装 Supermemory Claude Code Plugin**：避免与 auto-memory hooks 双写
- **API Key 管控**：数据存储在 Supermemory 云端，敏感项目慎用
- **npm 依赖**：首次使用需 `npm install supermemory`（在 claude-scene 目录）

### 与现有 7 个记忆后端的分工

| 后端 | 数据类型 | 触发 | 写入接口 |
|------|---------|-----|---------|
| **project-memory** | 工作流**结构化结果** | 工作流 remember 步骤 | `node src/index.js memory remember` |
| **Claude-Mem** | 会话**摘要** | Claude Code 内置 | 自动 |
| **agentmemory** | Agent 协作上下文 | Agent 运行时 | 自动 |
| **NEXO** | 运行时事件 | 自动采集 | 自动 |
| **CodeGraph** | 代码符号索引 | 文件监听 | 自动 |
| **MemPalace** | 对话**原文**（逐字、verbatim） | 4 个 hook 自动 | `mempalace mine --mode convos` |
| **Supermemory** | **语义记忆** + 用户画像 | API Key 配置后自动 | `supermemory` npm SDK |
