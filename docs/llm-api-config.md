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

pi 只读 `.pi/mcp.json`（项目级，需先授予项目信任）或 `~/.pi/agent/mcp.json`（用户级）。
Claude Code 卸载后，原来的 `.claude/mcp.json` 成了死文件，已删（内容在 git 历史里）。

当前 `.pi/mcp.json` 只放了 3 个**无需凭据**且已实测能握手的 server：

| server | 运行时 | 验证 |
|---|---|---|
| `schemaforge` | `npx -y schemaforge-mcp` | ✅ `serverInfo.name = schemaforge-mcp` |
| `a11y` | `npx -y a11y-mcp-server` | ✅ `serverInfo.name = axe-accessibility-server` |
| `detox` | `npx -y detox-mcp` | ✅ `serverInfo.name = detox-mcp` |

> 语法差异：pi 用 `${VAR}`，Claude Code 用 `${env:VAR}`；`type: "stdio"` 在 pi 里不需要（有 `command` 就是 stdio）。
> 引擎 `handler-verify.js` 两种写法都认，按 **项目 `.pi/mcp.json` → 用户 `~/.pi/agent/mcp.json` → `.claude/mcp.json`**
> 的顺序取第一个存在的（与 pi 的「项目级覆盖同名用户级」语义一致），`/check` 的 Pass 10 会打印
> `okCount/total` 与命中的文件。

同样这 3 个 server 也装了一份在用户级 `~/.pi/agent/mcp.json`，所以任意项目目录下都能用。
两边内容相同 —— 项目级只是为了保证「克隆下来即能跑」，改的时候要一起改。

### 拿到 token 后追加到 `.pi/mcp.json` 的片段

```jsonc
"github":    { "command": "docker", "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
               "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" } },
"context7":  { "command": "npx", "args": ["-y", "@upstash/context7-mcp"], "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" } },
"tavily":    { "command": "npx", "args": ["-y", "tavily-mcp"], "env": { "TAVILY_API_KEY": "${TAVILY_API_KEY}" } },
"supabase":  { "command": "npx", "args": ["-y", "@supabase/mcp-server-supabase@latest"], "env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}" } },
"stripe":    { "command": "npx", "args": ["-y", "@stripe/mcp"], "env": { "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY}" } },
"resend":    { "command": "node", "args": ["./.mcp/resend-mcp/dist/index.js"], "env": { "RESEND_API_KEY": "${RESEND_API_KEY}" } },
"mobsf":     { "command": "npx", "args": ["-y", "mobsf-mcp"], "env": { "MOBSF_URL": "${MOBSF_URL}", "MOBSF_API_KEY": "${MOBSF_API_KEY}" } }
```

`sentry` 现在是远程 server（OAuth 登录，不写凭据）：`{ "url": "https://mcp.sentry.dev/mcp" }`。
`bearer` 已死（`@bearer/mcp` 与 `@bearer/cli` 均不可用，工具已卸载），不要再加。

## 4. 孤儿环境变量（已清理）

| 变量 | 原属工具 | 处理 |
|---|---|---|
| `FACTORY_API_KEY` | Factory（`~/.factory` 已卸） | 变量已删；值随 10-27 的备份目录删除一并消失 |
| `GLM_API_KEY` | ZCode / Codex 链路（均已卸载） | 同上 |

两者都不在 pi 的读取路径上（pi 用的是 `auth.json` 里的 key），删掉不影响任何工具。


## 5. 已卸载工具曾经的 key 归属

见 [`docs/SECURITY.md`](./SECURITY.md) §1.0 / §1.1。**2026-10-27 之后的当前状态**：

1. `~/.pi/agent/auth.json`（3 把，pi 的正常配置，不是泄露）
2. ~~`~/.pi/agent/sessions/**` + `traces/**`~~ —— 已原地脱敏（12 个副本全部抹除，残留复核 = 0）
3. ~~`~/Documents/xwechat_files/**/API.txt`~~ —— 已脱敏（该文件早已外流，抹本机副本只能止损）

其余副本（`cc-switch.db` 及 11 份备份、`.claude/history.jsonl`、各家 config、整个
`E:/ai-tools-backup-20261027/`）**全部已删除**。用户已决定**不轮换**密钥、**不重写** git 历史，
这两件事的知情风险写在 §1.0。

## 6. 验证命令

```bash
# pi 侧（Percho 内置，不在 PATH 时从 Percho 的终端跑）
pi mcp list          # 列出实际接入的 MCP server（当前应为空）
cat ~/.pi/agent/models.json

# 引擎侧
node claude-scene/src/index.js list
```
