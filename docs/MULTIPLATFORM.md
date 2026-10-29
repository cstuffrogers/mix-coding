# Multi-Platform Support

本项目适配 Claude Code、Codex、ZCode、pi（含 percho 桌面端）四个 AI 编码平台。

> **opencode 已退役（2026-07-01）**：`opencode` 不再作为使用目标，`~/.config/opencode/opencode.json`
> 的生成器 / 部署脚本 / 校验器（`scripts/generate-opencode-config.cjs`、`scripts/setup-opencode-global.sh`、
> `scripts/check-opencode-config.cjs`）与 `.opencode/` 目录已删除。引擎仍认得 `OPENCODE=1` 这个宿主标记
> （`platform.js` 里的一行映射，删掉反而会让在 opencode 里跑引擎的行为不可预期），但**不再维护任何 opencode 专属配置**——
> 表里留着这一行是为了说清楚「为什么不提供」，而不是承诺支持。

## 平台识别

每个平台通过环境变量标记来标识自身：

| 平台 | 环境变量 | 配置目录 | 命令源 |
|------|---------|---------|--------|
| Claude Code | `CLAUDECODE=1` | `.claude/` | `.claude/commands/*.md`（33 个） |
| Codex | `CODEX=1` | `.codex/` | prompt 文件 |
| ZCode | `ZCODE=1` | `.zcode/` | AGENTS.md + 引擎 CLI |
| pi *(含 percho 桌面端)* | `AI_AGENT=pi` | `.pi/` | AGENTS.md + 引擎 CLI |
| CLI (无宿主) | 无 | `.claude/` (回退) | — |
| ~~opencode~~ *(已退役)* | `OPENCODE=1`（仅识别） | 无（不再提供） | 无（不再生成全局配置） |

> **percho 不是独立平台**：它是 Pi 的桌面端 GUI（Electron 内嵌 `@earendil-works/pi-coding-agent` SDK），
> 与 Pi CLI 共用 `~/.pi/agent/` 配置与项目级 `.pi/`，会话引擎一致，无独立识别标记，因此并入 pi 平台。
> 识别标记 `AI_AGENT=pi` 来自 Pi 源码 `cli/setup.ts`（每次启动设置，另设 `PI_CODING_AGENT=true`），已实测验证。

引擎通过 `claude-scene/src/lib/platform.js` 中的 `getHostPlatform()` / `isConversationMode()` 动态识别当前平台。

## 目录结构

```
auto-coding/
├── .claude/              ← 共享资源宿主 (各平台共用)
│   ├── scenes/           ★ 引擎场景 (26 个)
│   ├── skills/           ★ 引擎技能 (29 个)
│   ├── rules/            ★ 引擎规则
│   ├── memory/           ★ 引擎记忆
│   ├── plugins/          ★ 引擎插件
│   ├── commands/         ★ 工作流源文件 (33 个 .md, 所有平台共用)
│   ├── agents/           Claude Code 专属子代理
│   ├── mcp.json          MCP 配置定义
│   ├── mcp-enable.json   工作流-MCP 动态启用映射
│   ├── settings.json     Claude Code 专属设置
│   └── (运行产物: logs/ reviews/ designs/ 等)
│
├── .codex/               ← Codex 专属
│   ├── AGENTS.md         项目指令
│   ├── mcp/              MCP 配置
│   └── prompts/          自定义提示
│
├── .zcode/               ← ZCode 专属
│   └── AGENTS.md         项目指令
│
├── .pi/                  ← pi 专属（percho 桌面端共享此目录）
│   └── AGENTS.md         项目指令
│
├── CLAUDE.md             ← Claude Code 入口 (所有平台源文档)
├── AGENTS.md             ← Codex / ZCode / pi 入口 (指向 CLAUDE.md)
└── docs/MULTIPLATFORM.md ← 本文档
```

## 引擎行为

所有平台的引擎共享同一份 `claude-scene/` 代码。差异仅在于：

- **对话模式** vs **CLI 模式**: 对话模式（任意平台宿主）启用 MCP 工具调用、Skill() 调用、代码推理等高级功能；CLI 模式（无宿主）执行轻量替代。
- **配置目录**: 各平台的专属命令格式、MCP 配置、入口指令存储在自己的 .xxx/ 目录下。
- **共享数据**: scenes/skills/rules/memory/plugins 统一存放在 `.claude/`，各平台通过 `SHARED_RESOURCE_DIR` 常量访问。

## 为 Claude Code 添加新命令

1. 在 `.claude/commands/` 创建 `.md` 文件（YAML frontmatter + 工作流说明）
2. Claude Code 自动发现并注册为 `/command`

## 为 Codex 添加新命令

Codex 无 `/command` 机制。请在 `.codex/prompts/` 创建 prompt 文件，或在 `.codex/AGENTS.md` 中追加指令块。

## 为 ZCode 添加新命令

ZCode 无 `/command` 机制。请在 `.zcode/AGENTS.md` 中追加指令块，或直接使用引擎 CLI：
`node claude-scene/src/index.js start <scene> --auto`

## 为 pi 添加新命令

pi 无 Claude Code 式 `/command` 文件机制（slash 命令来自 extension / prompt template / skill），
percho 桌面端同样如此。采用与 ZCode 相同的路径：

1. 在 `.pi/AGENTS.md` 中追加指令块，指向引擎场景
2. 或直接使用引擎 CLI：`node claude-scene/src/index.js start <scene> --auto`
3. 或将工作流包装为 pi prompt template / skill 挂到 `.pi/` 下（需按 pi 的扩展约定编写）

## opencode（已退役）

不再维护 opencode 专属配置。历史实现（全局 `opencode.json` 生成器 + 项目级 `opencode.jsonc`）已于
2026-07-01 删除：那份生成器里的「N 步」「读取 X.md」条目多次与仓库真值漂移（指向已删除的命令文件、
步骤数写错），而校验它需要一整套 checker —— 对一个不再使用的平台，正确的做法是删掉，不是继续维护。
