# 本机 LLM API 配置清单（2026-10-27 清理后）

清理完成后，本机**只剩 Percho（pi 内核）一个 AI 宿主**。下面是「谁还需要大模型 API」的完整答案。

## 1. 需要 LLM API 的：只有一个

| 位置 | 内容 | 状态 |
|---|---|---|
| `~/.pi/agent/models.json` | 3 家 provider，全部 `openai-completions` 协议 | ✅ 已配 |
| `~/.pi/agent/auth.json` | 每家一把 key（`api_key` 类型） | ✅ 已配 |

```
99     https://apiop.cn/v1              deepseek-v4.1-flash
niu    https://token.zlshag.xyz/v1      glm-5.3
myapi  https://ccapi.cgdoem.cn/v1       cn:deepseek-v4.1-flash
```

Percho 的界面设置直接读写这两个文件；在 Percho 里换模型/加 provider 就等于改它们。
`~/.percho/` 只存 `daily/`（日志）与 `ui-plugins/`，不含任何密钥。

## 2. 不需要 LLM API 的

| 组件 | 为什么不需要 |
|---|---|
| 引擎 `claude-scene` | 全仓库无 LLM 调用。`llm-proxy-detector.js` 的 `fetch` 只做「探测某个 URL 是否可达」，不发 prompt、不需要 key |
| `semgrep` / `aislop` / `sqlite3` / `git` / `node` | 本地静态分析、Lint、数据库、工具链 |
| 记忆后端（project-memory / claude-mem / agentmemory / NEXO / CodeGraph） | 全是本地文件或 SQLite（`~/.claude/memory`、`~/.agentmemory`、`~/.nexo`、`<project>/.codegraph`） |
| VS Code 扩展 pencil / v0 / figma / locofy | 各自 OAuth 登录，不读本机 LLM key |

## 3. 需要「服务 token」但**不是** LLM key 的：MCP servers

`.claude/mcp.json` 里声明了 7 类 server，其中只有 3 个无需凭据：

| server | 需要的凭据 | 当前 |
|---|---|---|
| `schemaforge` / `a11y` / `detox` | 无需 | 可直接用 |
| `github` | `GITHUB_PERSONAL_ACCESS_TOKEN` | 未设 |
| `context7` | `CONTEXT7_API_KEY` | 未设 |
| `sentry` | OAuth 登录（远程 server） | 未登录 |
| `tavily-search` / `supabase` / `stripe` / `resend` | 各自 API key | 未设 |

> **⚠ 这段配置目前是死的**：`mcp.json` 是 Claude Code 的格式与位置（`.claude/mcp.json`），
> 而 pi 只读 `~/.pi/agent/mcp.json`（用户级）或 `.pi/mcp.json`（项目级，需先授予项目信任）。
> 两个文件都不存在 → 现在没有任何 MCP server 真正接进 pi。
>
> 迁移方式：把 `.claude/mcp.json` 的条目搬到 `.pi/mcp.json`，`type/command/args/env` 结构基本相同，
> 差异见 Percho 的 `docs/mcp.md`（`${env:VAR}` 写法一致；远程 server 走 OAuth 时不要写凭据）。

## 4. 孤儿环境变量（无人读取）

| 变量 | 原属工具 | 建议 |
|---|---|---|
| `FACTORY_API_KEY` | Factory（`~/.factory` 已移入备份） | 可删；删除前把值记到本地备份 |
| `GLM_API_KEY` | ZCode / Codex 链路（均已卸载） | 同上 |

两者都不在 pi 的读取路径上（pi 用的是 `auth.json` 里的 key）。

## 5. 已卸载工具曾经的 key 归属

见 [`docs/SECURITY.md`](./SECURITY.md) §1.1 / §1.3。当前**活跃目录里**的明文 key 只剩：

1. `~/.pi/agent/auth.json`（3 把，正常配置，不是泄露）
2. `~/.pi/agent/sessions/**` + `traces/**` 转录里被打印过的旧 key（`sk-SW1…`、`sk-5470…`）
3. `~/Documents/xwechat_files/**/API.txt`（外部聊天记录，已外流）

其余副本（`cc-switch.db` 及 10 份备份、`.claude/history.jsonl`、TRAE 的 `mcp.json`、
各家 config）全部随工具移入 `E:/ai-tools-backup-20261027/`。

## 6. 验证命令

```bash
# pi 侧（Percho 内置，不在 PATH 时从 Percho 的终端跑）
pi mcp list          # 列出实际接入的 MCP server（当前应为空）
cat ~/.pi/agent/models.json

# 引擎侧
node claude-scene/src/index.js list
```
