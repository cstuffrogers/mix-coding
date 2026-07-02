# Multi-Platform Support

本项目同时适配 Claude Code、opencode、Codex、ZCode 四个 AI 编码平台。

## 平台识别

每个平台通过环境变量标记来标识自身：

| 平台 | 环境变量 | 配置目录 | 命令源 |
|------|---------|---------|--------|
| Claude Code | `CLAUDECODE=1` | `.claude/` | `.claude/commands/*.md` (35 工作流) |
| opencode | `OPENCODE=1` | `.opencode/` + 全局 `~/.config/opencode/opencode.json` | 全局面板 (命令对齐 35 工作流) |
| Codex | `CODEX=1` | `.codex/` | prompt 文件 |
| ZCode | `ZCODE=1` | `.zcode/` | (待填充) |
| CLI (无宿主) | 无 | `.claude/` (回退) | — |

引擎通过 `claude-scene/src/lib/platform.js` 中的 `getHostPlatform()` / `isConversationMode()` 动态识别当前平台。

## 目录结构

```
~/.config/opencode/opencode.json  ← opencode 全局配置 (命令对齐 35 工作流 · 17 MCP · 4 Provider)

auto-coding/
├── .claude/              ← 共享资源宿主 (各平台共用)
│   ├── scenes/           ★ 引擎场景 (26 个)
│   ├── skills/           ★ 引擎技能 (21 个)
│   ├── rules/            ★ 引擎规则
│   ├── memory/           ★ 引擎记忆
│   ├── plugins/          ★ 引擎插件
│   ├── commands/         ★ 工作流源文件 (35 个 .md, 所有平台共用)
│   ├── agents/           Claude Code 专属子代理
│   ├── mcp.json          MCP 配置定义
│   ├── mcp-enable.json   工作流-MCP 动态启用映射
│   ├── settings.json     Claude Code 专属设置
│   └── (运行产物: logs/ reviews/ designs/ 等)
│
├── .opencode/            ← opencode 项目专属
│   ├── AGENTS.md         项目指令 (指向 CLAUDE.md)
│   └── commands/         opencode 命令文件 (当前为空, 统一使用全局)
│
├── .codex/               ← Codex 专属
│   ├── AGENTS.md         项目指令
│   ├── mcp/              MCP 配置
│   └── prompts/          自定义提示
│
├── .zcode/               ← ZCode 专属 (待填充)
│
├── opencode.jsonc        ← opencode 项目配置 (仅 instructions + skills)
├── CLAUDE.md             ← Claude Code 入口 (所有平台源文档)
├── AGENTS.md             ← opencode/Codex 入口 (指向 CLAUDE.md)
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

## 为 opencode 添加新命令

opencode 采用 **全局配置 + 项目配置** 双层架构：

- **全局配置** (`~/.config/opencode/opencode.json`): 命令对齐 35 工作流 + 17 MCP + 4 Provider，所有项目共享
- **项目配置** (`opencode.jsonc`): 仅 `instructions` 和 `skills.paths`，保持最小

添加新命令的步骤：

1. 编辑 `scripts/generate-opencode-config.cjs` 中的 `commands` 对象
2. 部署：
   - `node .opencode/deploy-global.cjs` （推荐，自动检测 Pencil + 注入环境变量）
   - 或 `./scripts/setup-opencode-global.sh` （shell 版本，支持更多 API Key 传递方式）
3. 重启 opencode 桌面版

> 全局配置将 35 个 `.claude/commands/*.md` 工作流全部引用到模板中，行为与 Claude Code 一致。

## 为 Codex 添加新命令

Codex 无 `/command` 机制。请在 `.codex/prompts/` 创建 prompt 文件，或在 `.codex/AGENTS.md` 中追加指令块。

## 为 ZCode 添加新命令

待实测 ZCode 的扩展点后补充。
